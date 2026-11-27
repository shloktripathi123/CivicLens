import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "@civic/db";
import { ingest } from "./adapter.ts";

test("rebuilding an existing database removes dependent records but keeps reports", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(String(input));
    return Response.json(url.pathname.endsWith("committee-membership-current.json") ? {} : []);
  });
  const db = openDb(":memory:");
  try {
    db.exec(`
      INSERT INTO source(id,name,url,retrieved_at) VALUES('old','Old','https://example.test','2026-01-01');
      INSERT INTO person(id,canonical_name,status,source_id,as_of) VALUES('p','Person','current','old','2026-01-01');
      INSERT INTO official_record(person_id,section,title,source_id,as_of) VALUES('p','votes','Vote','old','2026-01-01');
      INSERT INTO voting_window(state,election_id,kind,note,basis,url,source_id,as_of)
        VALUES('OR','old-election','registration_deadline','Note','Rule','https://example.test','old','2026-01-01');
      INSERT INTO place(id,type,name,label,name_norm,state,fips,source_id,as_of)
        VALUES('county:41001','county','Example','Example County','example','OR','41001','old','2024-01-01');
      INSERT INTO county_geography VALUES('county:41001',100,2,'old','2024-01-01');
      INSERT INTO county_population VALUES('county:41001',1000,'old','2024-07-01');
      INSERT INTO correction_report(target,kind,note,created_at) VALUES('p','factual-error','Review','2026-01-01');
    `);
    await ingest(db);
    assert.equal((db.prepare("SELECT count(*) AS n FROM official_record").get() as { n: number }).n, 0);
    assert.equal((db.prepare("SELECT count(*) AS n FROM voting_window").get() as { n: number }).n, 0);
    assert.equal((db.prepare("SELECT count(*) AS n FROM county_geography").get() as { n: number }).n, 0);
    assert.equal((db.prepare("SELECT count(*) AS n FROM county_population").get() as { n: number }).n, 0);
    assert.equal((db.prepare("SELECT count(*) AS n FROM correction_report").get() as { n: number }).n, 1);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
  }
});
