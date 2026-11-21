import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildApp } from "../../apps/api/src/app.ts";
import { openDb } from "@civic/db";

const dbPath = resolve(import.meta.dirname, "../../data/civic.db");
const skip = !existsSync(dbPath) && "run `npm run ingest` first";

test("ZIP page is labeled approximate, lists overlaps, and shows labeled gaps", { skip }, async () => {
  const app = buildApp(openDb(dbPath));
  const res = await app.inject({ url: "/v1/zip/97201" });
  assert.equal(res.statusCode, 200);
  const d = res.json();
  assert.equal(d.place.approximate, true);
  assert.match(d.approximateNote, /approximate/i);
  assert.ok(d.overlaps.length >= 1 && d.overlaps.every((o: { share: number }) => o.share > 0 && o.share <= 1));
  const federal = d.levels.find((l: { level: string }) => l.level === "federal");
  // Narrowed to the ZIP's district when the Census geocoder answers; otherwise the whole delegation (2 senators + 6 representatives).
  assert.ok(federal.officials.length === 3 || federal.officials.length === 8, "2 senators + 1 district representative, or the full delegation");
  for (const l of d.levels.filter((x: { state: string }) => x.state === "not_yet_checked")) {
    assert.ok(l.gap.reason && l.gap.officialSiteUrl.startsWith("https://"), "gaps carry a reason and an official link");
    assert.deepEqual(l.officials, [], "gaps are never filled with inferred data");
  }
  assert.equal(d.completeness.sectionsTotal, d.levels.length);
  assert.equal((await app.inject({ url: "/v1/zip/00000" })).statusCode, 404);
  assert.equal((await app.inject({ url: "/v1/zip/abcde" })).statusCode, 404);
  await app.close();
});

test("ambiguous names return every match with state and type; bad input is rejected", { skip }, async () => {
  const app = buildApp(openDb(dbPath));
  const r = (await app.inject({ url: "/v1/places/search?q=springfield&type=city" })).json();
  const states = new Set(r.results.map((x: { state: string }) => x.state));
  assert.ok(states.size >= 10, "Springfield exists in many states and none are collapsed");
  assert.ok(r.results.every((x: { type: string; stateName: string }) => x.type === "city" && x.stateName));
  assert.equal((await app.inject({ url: "/v1/places/search" })).statusCode, 400);
  assert.equal((await app.inject({ url: "/v1/places/search?q=x&type=galaxy" })).statusCode, 400);
  assert.equal((await app.inject({ url: "/v1/places/county:00000" })).statusCode, 404);
  await app.close();
});

test("state page lists counties and county page lists overlapping ZIPs", { skip }, async () => {
  const app = buildApp(openDb(dbPath));
  const st = (await app.inject({ url: "/v1/places/state:OR" })).json();
  assert.equal(st.children.length, 36);
  const co = (await app.inject({ url: "/v1/places/county:41051" })).json();
  assert.equal(co.parents[0].id, "state:OR");
  assert.ok(co.overlaps.some((o: { place: { type: string } }) => o.place.type === "zip"));
  await app.close();
});

test("place suggest p95 under 300 ms", { skip }, async () => {
  const app = buildApp(openDb(dbPath));
  const queries = ["p", "po", "port", "portland", "st lou", "spring", "new y", "97", "972", "cook", "los ang", "or"];
  const times: number[] = [];
  for (let round = 0; round < 5; round++) {
    for (const q of queries) {
      const t = performance.now();
      const res = await app.inject({ url: `/v1/places/suggest?q=${encodeURIComponent(q)}` });
      times.push(performance.now() - t);
      assert.equal(res.statusCode, 200);
    }
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)];
  console.log(`place suggest p95 ${p95.toFixed(0)} ms`);
  assert.ok(p95 < 300, `p95 ${p95}`);
  await app.close();
});
