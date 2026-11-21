import test from "node:test";
import assert from "node:assert/strict";
import { openDb, getGovUnit, uncitedFacts } from "../../packages/db/src/index.ts";
import { buildLocal } from "../../apps/api/src/localGov.ts";
import { getPlaceRow } from "../../packages/db/src/index.ts";

const db = openDb();
const zip = getPlaceRow(db, "zip:97201");
const noSchool = async () => null;

test("seed integrity: hired roles are never elected; dates carry a basis", () => {
  const offices = db.prepare("SELECT title, role, next_election, election_basis, source_url FROM gov_office").all() as Array<Record<string, string | null>>;
  assert.ok(offices.length > 0);
  for (const o of offices) {
    assert.ok(o.source_url, `${o.title} has no source link`);
    if (/administrator|manager|superintendent/i.test(o.title ?? "")) assert.notEqual(o.role, "elected", o.title ?? "");
    if (o.next_election) assert.ok(o.election_basis);
  }
  assert.deepEqual(uncitedFacts(db).filter((f) => f.table.startsWith("gov_")), []);
});

test("Portland ZIP shows county, city and the districts that apply", async () => {
  assert.ok(zip);
  const g = await buildLocal(db, zip!, noSchool);
  const names = g.groups.flatMap((x) => x.units.map((u) => u.name));
  assert.ok(names.includes("Multnomah County"));
  assert.ok(names.includes("City of Portland"));
  assert.ok(names.includes("Port of Portland"));
  assert.equal(g.school?.state, "unavailable");
});

test("districts that do not apply to a place are excluded", async () => {
  const other = getPlaceRow(db, "county:41003"); // Benton County, OR
  assert.ok(other);
  const g = await buildLocal(db, other!, noSchool);
  assert.deepEqual(g.groups.flatMap((x) => x.units).filter((u) => u.kind === "special_district"), []);
});

test("Multnomah board structure is sourced and complete", () => {
  const u = getGovUnit(db, "county:41051:gov")!;
  assert.equal(u.offices.find((o) => o.id === "mult-comm")?.holders.length, 4);
  assert.ok(u.meetings[0].schedule.includes("Thursdays"));
});

test("a school district without a published board reports the gap", () => {
  const u = getGovUnit(db, "sd:4110040")!;
  assert.equal(u.offices.length, 0);
  assert.ok(u.completeness.some((c) => c.item === "Officeholders" && c.state === "not_in_our_data"));
});

test("school district coverage covers every state", () => {
  const n = (db.prepare("SELECT COUNT(DISTINCT state) AS n FROM gov_unit WHERE kind='school_district'").get() as { n: number }).n;
  assert.ok(n >= 50);
});
