import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "@civic/db";
import { personId } from "@civic/domain";
import { loadExecutive, execPersonId, type ExecPerson } from "./executive.ts";

const SRC = ["congress-legislators"];
function seed() {
  const db = openDb(":memory:");
  db.prepare("INSERT INTO source (id,name,url,retrieved_at,authoritative) VALUES (?,?,?,?,1)").run(SRC[0], "x", "https://x.test", "2026-01-01");
  return db;
}

const trump: ExecPerson = {
  id: { govtrack: 412733, wikidata: "Q22686", fec: ["P80001571"] },
  name: { first: "Donald", middle: "J.", last: "Trump" }, bio: { birthday: "1946-06-14", gender: "M" },
  terms: [
    { type: "prez", start: "2017-01-20", end: "2021-01-20", party: "Republican", how: "election" },
    { type: "prez", start: "2025-01-20", end: "2029-01-20", party: "Republican", how: "election" },
  ],
};
const biden: ExecPerson = {
  id: { bioguide: "B000444", wikidata: "Q6279" },
  name: { first: "Joseph", last: "Biden", nickname: "Joe" }, bio: {},
  terms: [{ type: "prez", start: "2021-01-20", end: "2025-01-20", party: "Democrat", how: "election" }],
};

test("two-term president becomes one current person with both terms", () => {
  const db = seed();
  loadExecutive(db, [trump], "2026-10-11");
  const id = execPersonId(trump);
  assert.equal(id, personId("govtrack", "412733"));
  assert.equal((db.prepare("SELECT status FROM person WHERE id=?").get(id) as { status: string }).status, "current");
  const terms = db.prepare("SELECT office_type, title FROM office_term WHERE person_id=? ORDER BY start_date").all(id) as Array<{ office_type: string; title: string }>;
  assert.deepEqual(terms.map((t) => t.office_type), ["president", "president"]);
  assert.ok(db.prepare("SELECT 1 FROM person_identifier WHERE person_id=? AND scheme='wikidata' AND value='Q22686'").get(id));
});

test("a former legislator keeps one profile: executive terms attach to the existing person", () => {
  const db = seed();
  const id = personId("bioguide", "B000444");
  db.prepare("INSERT INTO person (id,canonical_name,status,source_id,as_of) VALUES (?,?,?,?,?)").run(id, "Joseph R. Biden Jr.", "former", SRC[0], "2026-01-01");
  const created = loadExecutive(db, [biden], "2026-10-11");
  assert.equal(created, 0);
  assert.equal((db.prepare("SELECT COUNT(*) n FROM person").get() as { n: number }).n, 1);
  assert.equal((db.prepare("SELECT status FROM person WHERE id=?").get(id) as { status: string }).status, "former");
  assert.equal((db.prepare("SELECT COUNT(*) n FROM office_term WHERE person_id=?").get(id) as { n: number }).n, 1);
});
