import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildApp } from "../../apps/api/src/app.ts";
import { openDb } from "@civic/db";

const dbPath = resolve(import.meta.dirname, "../../data/civic.db");
const skip = !existsSync(dbPath) && "run `npm run ingest` first";

async function findId(app: ReturnType<typeof buildApp>, q: string, name: string): Promise<string> {
  const r = (await app.inject({ url: `/v1/search?q=${encodeURIComponent(q)}` })).json();
  const hit = r.results.find((x: { name: string }) => x.name === name);
  assert.ok(hit, `${name} not found for "${q}"`);
  return hit.id;
}

test("typo search finds the candidate with a candidacy badge payload", { skip }, async () => {
  const app = buildApp(openDb(dbPath));
  const r = (await app.inject({ url: "/v1/search?q=Drazen&role=candidate" })).json();
  assert.equal(r.results[0].name, "Christine Drazan");
  assert.equal(r.results[0].candidacy.office, "Governor of Oregon");
  assert.equal((await app.inject({ url: "/v1/search?q=x&role=bogus" })).statusCode, 400);
  await app.close();
});

test("candidate profile contract, Kotek dual role, agenda separate from record", { skip }, async () => {
  const app = buildApp(openDb(dbPath));
  const kotek = await findId(app, "Kotek", "Tina Kotek");
  const k = (await app.inject({ url: `/v1/candidates/${kotek}` })).json();
  assert.equal(k.person.status, "current");
  assert.equal(k.candidacy.incumbent, true);
  assert.ok(k.record.terms.some((t: { title: string }) => t.title === "Governor"), "holds office and is a candidate in one profile");
  assert.ok(k.candidacy.provenance.sourceName && k.candidacy.provenance.asOf);
  for (const key of ["person", "candidacy", "race", "background", "agenda", "record", "finance", "coverage"]) assert.ok(key in k, key);
  assert.equal(k.agenda.selfReported, true);
  assert.ok(!("agenda" in k.record), "agenda items never appear in the record");
  assert.equal(k.coverage.agenda, "unavailable");

  const people = (await app.inject({ url: `/v1/search?q=Tina%20Kotek` })).json().results.filter((x: { name: string }) => x.name === "Tina Kotek");
  assert.equal(people.length, 1, "no duplicate person");
  assert.equal((await app.inject({ url: "/v1/candidates/not-a-uuid" })).statusCode, 404);
  await app.close();
});

test("race page: neutral alphabetical order and identical field sets", { skip }, async () => {
  const app = buildApp(openDb(dbPath));
  const { items } = (await app.inject({ url: "/v1/races?state=OR&office=governor&year=2026" })).json();
  assert.equal(items.length, 1);
  const race = (await app.inject({ url: `/v1/races/${encodeURIComponent(items[0].id)}` })).json();
  assert.equal(race.ordering, "alphabetical-by-last-name");
  assert.deepEqual(race.candidates.map((c: { name: string }) => c.name), ["Christine Drazan", "Tina Kotek"]);
  const shapes = new Set(race.candidates.map((c: object) => Object.keys(c).sort().join(",")));
  assert.equal(shapes.size, 1);
  assert.equal((await app.inject({ url: "/v1/races/nope" })).statusCode, 404);
  assert.equal((await app.inject({ url: "/v1/races?year=abc" })).statusCode, 400);

  const d = (await app.inject({ url: `/v1/search?q=Drazan` })).json().results[0];
  const prof = (await app.inject({ url: `/v1/candidates/${d.id}` })).json();
  assert.deepEqual(Object.keys(prof.candidacy).sort(), Object.keys(
    (await app.inject({ url: `/v1/candidates/${(await app.inject({ url: "/v1/search?q=Kotek" })).json().results[0].id}` })).json().candidacy).sort());
  await app.close();
});

test("candidacy without an authoritative source is rejected", () => {
  const db = openDb(":memory:");
  db.prepare("INSERT INTO source (id,name,url,retrieved_at,authoritative) VALUES ('s','s','u','t',0)").run();
  db.prepare("INSERT INTO person (id,canonical_name,status,source_id,as_of) VALUES ('p','P','candidate','s','d')").run();
  db.prepare("INSERT INTO office (id,level,body,jurisdiction,title,source_id,as_of) VALUES ('o','state','b','OR','t','s','d')").run();
  db.prepare("INSERT INTO election (id,date,type,jurisdiction,source_id,as_of) VALUES ('e','2026-11-03','general','OR','s','d')").run();
  db.prepare("INSERT INTO race (id,election_id,office_id,status,source_id,as_of) VALUES ('r','e','o','upcoming','s','d')").run();
  assert.throws(() => db.prepare("INSERT INTO candidacy (id,person_id,race_id,status,source_id,as_of) VALUES ('c','p','r','filed','s','d')").run(), /authoritative/);
  db.prepare("UPDATE source SET authoritative = 1").run();
  db.prepare("INSERT INTO candidacy (id,person_id,race_id,status,source_id,as_of) VALUES ('c','p','r','filed','s','d')").run();
});
