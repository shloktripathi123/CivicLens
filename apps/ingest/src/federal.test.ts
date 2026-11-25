import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "@civic/db";
import { ingestFederalRecords } from "./federal.ts";

test("federal records use current congressional terms without Voteview data", async (t) => {
  const congressKey = process.env.CONGRESS_API_KEY;
  const fecKey = process.env.FEC_API_KEY;
  process.env.CONGRESS_API_KEY = "test-congress-key";
  process.env.FEC_API_KEY = "test-fec-key";
  t.after(() => {
    if (congressKey === undefined) delete process.env.CONGRESS_API_KEY;
    else process.env.CONGRESS_API_KEY = congressKey;
    if (fecKey === undefined) delete process.env.FEC_API_KEY;
    else process.env.FEC_API_KEY = fecKey;
  });

  const requested: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(String(input));
    requested.push(url.pathname);
    if (url.hostname === "api.congress.gov") {
      return Response.json({ sponsoredLegislation: [{ type: "HR", number: "1", title: "Test", congress: 119 }] });
    }
    return Response.json({ results: [{ cycle: 2026, receipts: 10 }] });
  });

  const db = openDb(":memory:");
  try {
    db.exec("INSERT INTO source(id,name,url,retrieved_at) VALUES('s','Test','https://example.test','2026-01-01')");
    const person = db.prepare("INSERT INTO person(id,canonical_name,status,source_id,as_of) VALUES(?,?,'current','s','2026-01-01')");
    const identifier = db.prepare("INSERT INTO person_identifier(person_id,scheme,value) VALUES(?,?,?)");
    const term = db.prepare("INSERT INTO office_term(person_id,level,branch,body,title,start_date,end_date,source_id,as_of) VALUES(?,'federal','legislative',?,'Test',?,?,'s','2026-01-01')");
    for (const id of ["house", "senate", "former", "future", "executive"]) {
      person.run(id, id);
      identifier.run(id, "bioguide", id);
      identifier.run(id, "fec", id);
    }
    term.run("house", "U.S. House", "2000-01-01", null);
    term.run("house", "U.S. House", "2000-01-01", null);
    term.run("senate", "U.S. Senate", "2000-01-01", "9998-12-31");
    term.run("former", "U.S. Senate", "2000-01-01", "2001-01-01");
    term.run("future", "U.S. House", "9999-01-01", null);
    term.run("executive", "President", "2000-01-01", null);

    assert.deepEqual(await ingestFederalRecords(db), { bills: 2, funding: 2 });
    assert.deepEqual(requested.sort(), [
      "/v1/candidate/house/totals/", "/v1/candidate/senate/totals/",
      "/v3/member/house/sponsored-legislation", "/v3/member/senate/sponsored-legislation",
    ]);
    assert.equal((db.prepare("SELECT count(*) AS n FROM official_record WHERE source_id = 'voteview'").get() as { n: number }).n, 0);
  } finally {
    db.close();
  }
});
