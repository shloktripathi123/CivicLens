import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getSummaries, getTimeline, openDb } from "@civic/db";
import { SearchIndex } from "../../api/src/search.ts";
import { loadOpenStatesPeople, type OsPerson } from "./openstates.ts";

test("imports legislators from Oregon and other states without guessing their term start", () => {
  const db = openDb(":memory:");
  try {
    db.prepare("INSERT INTO source(id,name,url,retrieved_at) VALUES('openstates-people','Open States','https://openstates.org/','2026-01-01')").run();
    const person = (state: string): OsPerson => ({
      id: `ocd-person/${state}`, name: `${state} Example`, given_name: state, family_name: "Example", party: "",
      image: "", email: "", gender: "", birth_date: "", current_role: { title: "Senator", org_classification: "upper", district: "1" },
      jurisdiction: { id: `ocd-jurisdiction/country:us/state:${state.toLowerCase()}/government`, name: state },
      openstates_url: "https://openstates.org/example", links: [], offices: [],
    });
    assert.equal(loadOpenStatesPeople(db, [person("OR"), person("CA")], "2026-11-26"), 2);
    const terms = db.prepare("SELECT state,start_date,start_date_known FROM office_term ORDER BY state").all();
    assert.deepEqual(terms.map((r) => ({ ...r })), [
      { state: "CA", start_date: "2026-11-26", start_date_known: 0 },
      { state: "OR", start_date: "2026-11-26", start_date_known: 0 },
    ]);
  } finally {
    db.close();
  }
});

test("publication ingest omits Open States photos but retains legislator records", () => {
  const db = openDb(":memory:");
  try {
    db.prepare("INSERT INTO source(id,name,url,retrieved_at) VALUES('openstates-people','Open States','https://openstates.org/','2026-01-01')").run();
    const person: OsPerson = {
      id: "ocd-person/example", name: "Example", given_name: "", family_name: "", party: "Independent",
      image: "https://example.test/portrait.jpg", email: "", gender: "", birth_date: "",
      current_role: { title: "Senator", org_classification: "upper", district: "1" },
      jurisdiction: { id: "ocd-jurisdiction/country:us/state:or/government", name: "Oregon" },
      openstates_url: "https://openstates.org/example", links: [], offices: [],
    };
    loadOpenStatesPeople(db, [person], "2026-11-26", { omitPhotos: true });
    const row = db.prepare("SELECT canonical_name, photo_url FROM person").get();
    assert.deepEqual({ ...row }, { canonical_name: "Example", photo_url: null });
    assert.equal((db.prepare("SELECT count(*) AS n FROM office_term").get() as { n: number }).n, 1);
  } finally {
    db.close();
  }
});

test("officials without a sourced start date remain searchable without inventing a term year", () => {
  const db = openDb(":memory:");
  try {
    db.exec(`
      INSERT INTO source(id,name,url,retrieved_at) VALUES('openstates-people','Open States','https://openstates.org/','2026-01-01');
      INSERT INTO person(id,canonical_name,status,source_id,as_of) VALUES('p','Example Person','current','openstates-people','2026-01-01');
      INSERT INTO person_name(person_id,name,name_norm,kind) VALUES('p','Example Person','example person','legal');
      INSERT INTO office_term(person_id,level,branch,body,title,state,start_date,start_date_known,source_id,as_of)
        VALUES('p','state','legislative','Oregon Senate','Senator','OR','2026-01-01',0,'openstates-people','2026-01-01');
    `);
    assert.equal(getTimeline(db, "p")[0].start, null);
    assert.equal(getSummaries(db, ["p"])[0].years, "");
    const index = new SearchIndex(db);
    assert.equal(index.search("Example", { role: "official" }).length, 1);
    assert.equal(index.search("Example", { year: 2026 }).length, 0);
  } finally {
    db.close();
  }
});

test("existing Open States terms migrate without presenting the old assumed start date", () => {
  const dir = mkdtempSync(join(tmpdir(), "civic-terms-test-"));
  const path = join(dir, "snapshot.db");
  try {
    const old = openDb(path);
    old.exec(`
      INSERT INTO source(id,name,url,retrieved_at) VALUES('openstates-people','Open States','https://openstates.org/','2026-01-01');
      INSERT INTO person(id,canonical_name,status,source_id,as_of) VALUES('p','Example','current','openstates-people','2026-01-01');
      INSERT INTO office_term(person_id,level,branch,body,title,state,start_date,source_id,as_of)
        VALUES('p','state','legislative','Oregon Senate','Senator','OR','2025-01-01','openstates-people','2026-01-01');
      ALTER TABLE office_term DROP COLUMN start_date_known;
    `);
    old.close();
    const migrated = openDb(path);
    try {
      assert.equal(getTimeline(migrated, "p")[0].start, null);
      assert.deepEqual(migrated.prepare("PRAGMA foreign_key_check").all(), []);
    } finally {
      migrated.close();
    }
  } finally {
    for (const file of [path, `${path}-wal`, `${path}-shm`]) rmSync(file, { force: true });
    rmdirSync(dir);
  }
});
