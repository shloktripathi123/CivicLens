import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "@civic/db";
import { electionDay, ingestCalendar, nextFederalCycle } from "./calendar.ts";

test("federal cycles advance after election day", () => {
  assert.equal(nextFederalCycle("2026-11-03"), 2026);
  assert.equal(nextFederalCycle("2026-11-04"), 2028);
  assert.equal(nextFederalCycle("2027-01-01"), 2028);
  assert.equal(nextFederalCycle("2028-11-08"), 2030);
  assert.equal(electionDay(2028), "2028-11-07");
});

test("future federal races use known terms without inventing state races", () => {
  const db = openDb(":memory:");
  try {
    db.prepare("INSERT INTO source (id,name,url,retrieved_at) VALUES ('s','s','https://example.com','2026-01-01')").run();
    db.prepare("INSERT INTO person (id,canonical_name,status,source_id,as_of) VALUES ('p','Person','current','s','2026-01-01')").run();
    const term = db.prepare(
      "INSERT INTO office_term (person_id,level,branch,body,title,state,district,start_date,end_date,source_id,as_of) VALUES ('p','federal','legislative',?,?,?,?,?,?,'s','2026-01-01')",
    );
    term.run("U.S. House", "Representative", "OR", "1", "2025-01-03", "2027-01-03");
    term.run("U.S. Senate", "Senator", "OR", null, "2023-01-03", "2029-01-03");
    term.run("U.S. Senate", "Senator", "WA", null, "2025-01-03", "2031-01-03");
    ingestCalendar(db, "2026-11-20");
    const races = db.prepare(
      "SELECT o.body, o.jurisdiction, e.date FROM race r JOIN office o ON o.id = r.office_id JOIN election e ON e.id = r.election_id",
    ).all() as Array<{ body: string; jurisdiction: string; date: string }>;
    assert.ok(races.some((r) => r.body === "U.S. House" && r.date === "2028-11-07" && r.jurisdiction === "OR"));
    assert.ok(races.some((r) => r.body === "U.S. Senate" && r.date === "2028-11-07" && r.jurisdiction === "OR"));
    assert.ok(!races.some((r) => r.body === "U.S. Senate" && r.date === "2028-11-07" && r.jurisdiction === "WA"));
    assert.ok(races.some((r) => r.body === "President" && r.date === "2028-11-07"));
    assert.ok(!races.some((r) => r.body.includes("executive")));
  } finally {
    db.close();
  }
});
