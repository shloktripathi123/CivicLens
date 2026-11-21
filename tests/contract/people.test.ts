import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildApp } from "../../apps/api/src/app.ts";
import { openDb } from "@civic/db";

const dbPath = resolve(import.meta.dirname, "../../data/civic.db");
const skip = !existsSync(dbPath) && "run `npm run ingest` first";

const ROSTER: Array<[string, string, string]> = [
  ["Donald Trump", "president", "current"],
  ["Barack Obama", "president", "former"],
  ["Joseph Biden", "president", "former"],
  ["Kamala Harris", "vice_president", "former"],
  ["Vance", "vice_president", "current"],
];

test("major figures are searchable with the right office type (feature 005)", { skip }, async () => {
  const app = buildApp(openDb(dbPath));
  for (const [q, type, status] of ROSTER) {
    const r = (await app.inject({ url: `/v1/search?q=${encodeURIComponent(q)}&office_type=${type}` })).json();
    assert.ok(r.results.length > 0, `${q} missing`);
    assert.ok(r.results.some((p: { status: string }) => p.status === status), `${q} status`);
  }
  assert.equal((await app.inject({ url: "/v1/search?q=a&office_type=bogus" })).statusCode, 400);
  await app.close();
});

test("governors, justices and cabinet are searchable (feature 005)", { skip }, async () => {
  const app = buildApp(openDb(dbPath));
  const total = async (q: string, t: string) => (await app.inject({ url: `/v1/search?q=${q}&office_type=${t}` })).json().total;
  assert.ok((await total("Rubio", "cabinet")) >= 1);
  assert.ok((await total("Sotomayor", "judge")) >= 1);
  for (const n of ["Ayotte", "Newsom", "Hochul"]) assert.ok((await app.inject({ url: `/v1/search?q=${n}&office_type=governor` })).json().total >= 1, n);
  const r = (await app.inject({ url: "/v1/search?q=Roberts&office_type=judge" })).json();
  assert.ok(r.results.some((p: { name: string }) => p.name.includes("John Roberts")));
  await app.close();
});

test("every statutory 2026 federal seat and the 2028 presidency exist as races", { skip }, async () => {
  const app = buildApp(openDb(dbPath));
  const races = (await app.inject({ url: "/v1/races" })).json().items as Array<{ body: string; level: string; electionDate: string; id: string }>;
  const n = (body: string, y: string) => races.filter((r) => r.body === body && r.electionDate.startsWith(y)).length;
  assert.ok(n("U.S. House", "2026") >= 435);
  assert.ok(n("U.S. Senate", "2026") >= 33);
  assert.ok(races.filter((r) => r.level === "state" && r.id.includes("executive")).length >= 36);
  assert.equal(n("President", "2028"), 1);
  await app.close();
});
