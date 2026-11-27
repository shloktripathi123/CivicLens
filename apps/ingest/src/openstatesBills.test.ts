import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getBill, getDeepProfile, listBills, openDb } from "@civic/db";
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
      openstates_url: `https://openstates.org/${id}`, first_action_date: "2026-01-01",
      latest_action_date: "2026-02-01", latest_action_description: "Passed a chamber", sponsorships,
    });

    const rows = [
      { state: "OR", bill: bill("ocd-bill/or", [
        { name: "Example", primary: true, person: { id: "ocd-person/1" } },
        { name: "Other", primary: false, person: { id: "ocd-person/unknown" } },
      ]) },
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
    assert.equal(getDeepProfile(db, "p").sections.bills.items[0].billId, "ocd-bill/or");
    db.exec(`INSERT INTO bill(id,jurisdiction,session,number,title,status,is_law,url,source_id,as_of)
      VALUES('duplicate-url','OR','2026','HB 2','Another bill','unknown',0,'https://openstates.org/ocd-bill/or','openstates-bills','2026-02-03')`);
    assert.equal(getDeepProfile(db, "p").sections.bills.items[0].billId, null);
    assert.deepEqual(getBill(db, "ocd-bill/or")?.sponsors.map((s) => [s.name, s.role, s.personId]), [
      ["Example", "Primary sponsor", "p"],
      ["Other", "Sponsor", null],
    ]);
    db.prepare("DELETE FROM person_identifier WHERE person_id = ?").run("p");
    db.prepare("DELETE FROM person WHERE id = ?").run("p");
    assert.equal(getBill(db, "ocd-bill/or")?.sponsors[0].personId, null);
  } finally {
    db.close();
  }
});

test("publication ingest retains bill identifiers, sponsors, dates and links without copied descriptions", () => {
  const db = openDb(":memory:");
  try {
    db.exec(`
      INSERT INTO source(id,name,url,retrieved_at,grade) VALUES('openstates-bills','Open States','https://openstates.org/','2026-01-01','B');
      INSERT INTO person(id,canonical_name,status,source_id,as_of) VALUES('p','Example','current','openstates-bills','2026-01-01');
      INSERT INTO person_identifier(person_id,scheme,value) VALUES('p','openstates','ocd-person/1');
    `);
    const bill: OsBill = {
      id: "ocd-bill/or", session: "2026", identifier: "HB 1", title: "Unverified title",
      openstates_url: "https://openstates.org/bill", first_action_date: "2026-01-01",
      latest_action_date: "2026-02-01", latest_action_description: "Unverified action",
      sponsorships: [{ name: "Example", primary: true, person: { id: "ocd-person/1" } }],
    };
    const rows = [{ state: "OR", bill }];
    loadStateBills(db, rows, "2026-02-02", { omitDescriptions: true });
    loadStateBills(db, rows, "2026-02-03", { omitDescriptions: true });
    const result = getBill(db, bill.id);
    assert.equal(result?.title, "HB 1");
    assert.equal(result?.statusDetail, null);
    assert.equal(result?.url, bill.openstates_url);
    assert.deepEqual(result?.sponsors.map((s) => s.name), ["Example"]);
    assert.deepEqual(result?.actions.map((a) => [a.date, a.text]), [["2026-02-01", "Action recorded; see source for details."]]);
    const record = getDeepProfile(db, "p").sections.bills.items[0];
    assert.equal(record.title, "HB 1");
    assert.equal(record.detail, "Primary sponsor · 2026");
    assert.equal(record.billId, bill.id);
  } finally {
    db.close();
  }
});

test("existing bill sponsors survive the person-link migration", () => {
  const dir = mkdtempSync(join(tmpdir(), "civic-sponsors-test-"));
  const path = join(dir, "snapshot.db");
  try {
    const old = openDb(path);
    old.exec(`
      INSERT INTO source(id,name,url,retrieved_at) VALUES('s','Source','https://example.test/','2026-01-01');
      INSERT INTO bill(id,jurisdiction,session,number,title,status,is_law,url,source_id,as_of)
        VALUES('b','CA','2026','AB 1','Example','unknown',0,'https://example.test/bill','s','2026-01-01');
      INSERT INTO bill_sponsor(bill_id,name,role,source_id,as_of) VALUES('b','Example','Sponsor','s','2026-01-01');
      ALTER TABLE bill_sponsor DROP COLUMN person_id;
    `);
    old.close();
    const migrated = openDb(path);
    try {
      assert.equal(getBill(migrated, "b")?.sponsors[0].name, "Example");
      assert.equal(getBill(migrated, "b")?.sponsors[0].personId, null);
      assert.deepEqual(migrated.prepare("PRAGMA foreign_key_check").all(), []);
    } finally {
      migrated.close();
    }
  } finally {
    for (const file of [path, `${path}-wal`, `${path}-shm`]) rmSync(file, { force: true });
    rmdirSync(dir);
  }
});
