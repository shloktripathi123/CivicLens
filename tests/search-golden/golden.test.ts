import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildApp } from "../../apps/api/src/app.ts";
import { openDb } from "@civic/db";

const dbPath = resolve(import.meta.dirname, "../../data/civic.db");
const golden = JSON.parse(readFileSync(resolve(import.meta.dirname, "golden.json"), "utf8")) as Array<{ q: string; expect: string }>;
const skip = !existsSync(dbPath) && "run `npm run ingest` first";

test("golden search set: intended person in top 3 for >= 98% of queries", { skip }, async () => {
  const app = buildApp(openDb(dbPath));
  let ok = 0;
  const misses: string[] = [];
  for (const g of golden) {
    const res = await app.inject({ url: `/v1/search?q=${encodeURIComponent(g.q)}&limit=3` });
    const names = (res.json().results as Array<{ name: string }>).map((r) => r.name);
    if (names.includes(g.expect)) ok++; else misses.push(`${g.q} -> ${names.join(" | ")}`);
  }
  console.log(`golden: ${ok}/${golden.length}`, misses);
  assert.ok(ok / golden.length >= 0.98, `misses: ${misses.join("; ")}`);
  await app.close();
});

test("search API: filters, 400s, profile contract, p95 latency", { skip }, async () => {
  const app = buildApp(openDb(dbPath));
  assert.equal((await app.inject({ url: "/v1/search" })).statusCode, 400);
  assert.equal((await app.inject({ url: "/v1/people/not-a-uuid" })).statusCode, 404);

  const cur = (await app.inject({ url: "/v1/search?q=warren&status=current" })).json();
  assert.ok(cur.results.every((r: { status: string }) => r.status === "current"));
  const sen = (await app.inject({ url: "/v1/search?q=warren&body=Senate&state=MA" })).json();
  assert.equal(sen.results[0].name, "Elizabeth Warren");

  const id = sen.results[0].id;
  const p = (await app.inject({ url: `/v1/people/${id}` })).json();
  assert.equal(p.person.name, "Elizabeth Warren");
  assert.ok(p.terms.length > 0 && p.terms.every((t: { provenance: { sourceName: string; asOf: string } }) => t.provenance.sourceName && t.provenance.asOf));
  assert.ok(p.committees.length > 0);
  assert.equal(p.coverage.bills, "unavailable");

  const former = (await app.inject({ url: "/v1/search?q=lincoln&status=former" })).json();
  assert.ok(former.results.length > 0);
  const tl = (await app.inject({ url: `/v1/people/${former.results[0].id}/timeline` })).json();
  assert.ok(tl.length > 0);

  const times: number[] = [];
  for (const q of ["war", "sand", "mcconn", "cortez", "smith", "jo"]) {
    for (let i = 0; i < 5; i++) {
      const t = performance.now();
      await app.inject({ url: `/v1/search?q=${q}${i}` });
      times.push(performance.now() - t);
    }
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)];
  console.log(`search p95 ${p95.toFixed(0)}ms`);
  assert.ok(p95 < 300, `p95 ${p95}`);
  await app.close();
});
