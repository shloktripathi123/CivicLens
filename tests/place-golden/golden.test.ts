import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildApp } from "../../apps/api/src/app.ts";
import { openDb } from "@civic/db";

const dbPath = resolve(import.meta.dirname, "../../data/civic.db");
const golden = JSON.parse(readFileSync(resolve(import.meta.dirname, "golden.json"), "utf8")) as Array<{ q: string; expect: string }>;
const skip = !existsSync(dbPath) && "run `npm run ingest` first";

test("place golden set: intended place in top 3 for >= 95% of queries", { skip }, async () => {
  const app = buildApp(openDb(dbPath));
  let ok = 0;
  const misses: string[] = [];
  for (const g of golden) {
    const res = await app.inject({ url: `/v1/places/search?q=${encodeURIComponent(g.q)}&limit=3` });
    const ids = (res.json().results as Array<{ id: string }>).map((r) => r.id);
    if (ids.includes(g.expect)) ok++; else misses.push(`${g.q} -> ${ids.join(" | ")}`);
  }
  console.log(`place golden: ${ok}/${golden.length}`, misses);
  assert.ok(ok / golden.length >= 0.95, `misses: ${misses.join("; ")}`);
  await app.close();
});
