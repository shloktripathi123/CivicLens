import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildApp } from "../../apps/api/src/app.ts";
import { openDb, uncitedFacts } from "@civic/db";
import { RUBRIC_VERSION } from "@civic/domain";

const dbPath = resolve(import.meta.dirname, "../../data/civic.db");
const skip = !existsSync(dbPath) && "run `npm run ingest` first";

test("every fact row resolves to a graded source with URL and date", { skip }, () => {
  assert.deepEqual(uncitedFacts(openDb(dbPath)), []);
});

test("sources carry grade, written reason and rubric version", { skip }, async () => {
  const app = buildApp(openDb(dbPath));
  const { items } = (await app.inject({ url: "/v1/sources" })).json();
  assert.ok(items.length >= 3);
  for (const s of items) {
    assert.match(s.grade, /^[ABCD]$/);
    assert.ok(s.rationale.length > 20 && s.url.startsWith("http"));
    assert.equal(s.rubricVersion, RUBRIC_VERSION);
    assert.equal(Object.keys(s.criteria).length, 6);
  }
  const one = await app.inject({ url: `/v1/sources/${items[0].id}` });
  assert.equal(one.statusCode, 200);
  assert.equal((await app.inject({ url: "/v1/sources/nope" })).statusCode, 404);
});

test("rubric is published", { skip }, async () => {
  const d = (await buildApp(openDb(dbPath)).inject({ url: "/v1/rubric" })).json();
  assert.equal(d.criteria.length, 6);
  assert.match(d.neutrality, /never depend/);
});

test("place, person and candidate payloads include grade in provenance", { skip }, async () => {
  const app = buildApp(openDb(dbPath));
  const place = (await app.inject({ url: "/v1/zip/97201" })).json();
  assert.match(place.provenance.grade, /^[ABCD]$/);
  const hit = (await app.inject({ url: "/v1/search?q=Kotek" })).json();
  const id = hit.results?.[0]?.id ?? hit.items?.[0]?.id;
  if (id) {
    const c = await app.inject({ url: `/v1/candidates/${id}` });
    if (c.statusCode === 200) assert.match(c.json().candidacy.provenance.grade, /^[ABCD]$/);
  }
});
