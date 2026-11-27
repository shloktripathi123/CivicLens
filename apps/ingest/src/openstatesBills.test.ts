import test from "node:test";
import assert from "node:assert/strict";
import { getBill, listBills, openDb } from "@civic/db";
import { loadStateBills, type OsBill } from "./openstatesBills.ts";

test("imports bills across states even without a matched sponsor and keeps law status unverified", () => {
  const db = openDb(":memory:");
  try {
    db.exec(`
      INSERT INTO source(id,name,url,retrieved_at,grade) VALUES('openstates-bills','Open States','https://openstates.org/','2026-01-01','B');
      INSERT INTO person(id,canonical_name,status,source_id,as_of) VALUES('p','Example','current','openstates-bills','2026-01-01');
      INSERT INTO person_identifier(person_id,scheme,value) VALUES('p','openstates','ocd-person/1');
    `);
    const bill = (id: string, sponsorships: OsBill["sponsorships"]): OsBill => ({
      id, session: "2026", identifier: "HB 1", title: "Example bill",
      openstates_url: "https://openstates.org/example", first_action_date: "2026-01-01",
      latest_action_date: "2026-02-01", latest_action_description: "Passed a chamber", sponsorships,
    });
    const rows = [
      { state: "OR", bill: bill("ocd-bill/or", [{ name: "Example", primary: true, person: { id: "ocd-person/1" } }]) },
      { state: "CA", bill: bill("ocd-bill/ca", []) },
    ];
    assert.equal(loadStateBills(db, rows, "2026-02-02"), 2);
    assert.equal(loadStateBills(db, rows, "2026-02-03"), 2);
    assert.equal(listBills(db, { jurisdiction: "CA" }).total, 1);
    const california = getBill(db, "ocd-bill/ca");
    assert.equal(california?.status, "unknown");
    assert.equal(california?.isLaw, null);
    assert.equal(california?.actions.length, 1);
    assert.equal((db.prepare("SELECT count(*) AS n FROM official_record").get() as { n: number }).n, 1);
    assert.equal(getBill(db, "ocd-bill/or")?.sponsors.length, 1);
  } finally {
    db.close();
  }
});
