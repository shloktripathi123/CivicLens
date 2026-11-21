import test from "node:test";
import assert from "node:assert/strict";
import { openDb, getDeepProfile } from "../../packages/db/src/index.ts";

const db = openDb();

test("every deep slot is always present; empty ones say none_recorded with what was checked", () => {
  const id = (db.prepare("SELECT id FROM person LIMIT 1").get() as { id: string }).id;
  const d = getDeepProfile(db, id);
  for (const k of ["affiliations", "bills", "votes", "projects", "funding", "ratings"] as const) {
    const s = d.sections[k];
    assert.ok(s, k);
    assert.ok(s.checked.length > 0);
    assert.equal(s.status, s.items.length ? "has_data" : "none_recorded");
  }
  assert.equal(d.sections.votes.status, "none_recorded");
});

test("party affiliations come from cited terms", () => {
  const id = (db.prepare("SELECT person_id AS id FROM office_term WHERE party IS NOT NULL LIMIT 1").get() as { id: string }).id;
  const a = getDeepProfile(db, id).sections.affiliations;
  assert.equal(a.status, "has_data");
  assert.ok(a.items.every((i) => i.provenance.sourceId && i.provenance.sourceUrl));
});

test("unknown person yields empty, non-crashing slots", () => {
  const d = getDeepProfile(db, "00000000-0000-0000-0000-000000000000");
  assert.ok(Object.values(d.sections).every((s) => s.status === "none_recorded" && s.items.length === 0));
});

test("federal members have cited floor votes and a DW-NOMINATE rating, capped for display", () => {
  const id = (db.prepare("SELECT person_id AS id FROM official_record WHERE section = 'votes' LIMIT 1").get() as { id: string }).id;
  const d = getDeepProfile(db, id);
  assert.equal(d.sections.votes.status, "has_data");
  assert.ok(d.sections.votes.items.length <= 30);
  assert.ok(d.sections.votes.items.every((i) => /^(Yea|Nay|Present) /.test(i.title) && i.url?.startsWith("https://voteview.com/")));
  assert.ok(d.sections.ratings.items.some((i) => /DW-NOMINATE/.test(i.title)));
});

test("Oregon legislators are people and their sponsored bills fill the Bills slot", () => {
  const r = db.prepare("SELECT person_id AS id FROM official_record WHERE section = 'bills' AND source_id = 'oregon-legislature-odata' LIMIT 1").get() as { id: string } | undefined;
  assert.ok(r);
  const d = getDeepProfile(db, r.id);
  assert.equal(d.sections.bills.status, "has_data");
  assert.ok(d.sections.bills.items.every((i) => i.url?.startsWith("http") && i.provenance.sourceId === "oregon-legislature-odata"));
  const t = db.prepare("SELECT body, state, office_type FROM office_term WHERE person_id = ?").get(r.id) as { body: string; state: string; office_type: string };
  assert.equal(t.state, "OR");
  assert.equal(t.office_type, "state_legislator");
});

test("federal members have cited sponsored bills and FEC funding totals", () => {
  const b = db.prepare("SELECT person_id AS id FROM official_record WHERE source_id = 'congress-gov-api' LIMIT 1").get() as { id: string } | undefined;
  const f = db.prepare("SELECT person_id AS id FROM official_record WHERE source_id = 'openfec-api' LIMIT 1").get() as { id: string } | undefined;
  assert.ok(b && f);
  assert.equal(getDeepProfile(db, b.id).sections.bills.status, "has_data");
  const fund = getDeepProfile(db, f.id).sections.funding;
  assert.equal(fund.status, "has_data");
  assert.ok(fund.items.every((i) => i.url?.includes("fec.gov")));
});

test("state legislators from many states are cited people with a term", () => {
  const n = db.prepare("SELECT COUNT(DISTINCT t.state) n FROM office_term t WHERE t.source_id = 'openstates-people'").get() as { n: number };
  assert.ok(n.n >= 45);
  const bad = db.prepare("SELECT COUNT(*) n FROM person p WHERE p.source_id = 'openstates-people' AND NOT EXISTS (SELECT 1 FROM office_term t WHERE t.person_id = p.id)").get() as { n: number };
  assert.equal(bad.n, 0);
});

test("state legislators have cited sponsored bills with links", () => {
  const r = db.prepare("SELECT person_id AS id FROM official_record WHERE source_id = 'openstates-bills' LIMIT 1").get() as { id: string } | undefined;
  assert.ok(r);
  const s = getDeepProfile(db, r.id).sections.bills;
  assert.equal(s.status, "has_data");
  assert.ok(s.items.every((i) => i.url?.startsWith("https://openstates.org/")));
});
