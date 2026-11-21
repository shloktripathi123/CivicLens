import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildApp } from "../../apps/api/src/app.ts";
import { openDb } from "@civic/db";

const dbPath = resolve(import.meta.dirname, "../../data/civic.db");
const skip = !existsSync(dbPath) && "run `npm run ingest` first";

test("bills: enacted vs proposed is never confused (SC-004)", { skip }, async () => {
  const app = buildApp(openDb(dbPath));
  const all = (await app.inject({ url: "/v1/bills?jurisdiction=OR&limit=100" })).json();
  assert.ok(all.total > 1000);
  for (const b of all.items) {
    assert.equal(b.isLaw, b.status === "enacted");
    assert.ok(b.provenance.sourceUrl && b.provenance.asOf && b.url.startsWith("https://"));
  }
  const enacted = (await app.inject({ url: "/v1/bills?status=enacted&limit=50" })).json();
  assert.ok(enacted.items.length > 0 && enacted.items.every((b: { isLaw: boolean; chapter: string }) => b.isLaw && b.chapter));
  const proposed = (await app.inject({ url: "/v1/bills?status=in_committee&limit=50" })).json();
  assert.ok(proposed.items.every((b: { isLaw: boolean }) => !b.isLaw));
  const one = (await app.inject({ url: `/v1/bills/${encodeURIComponent(enacted.items[0].id)}` })).json();
  assert.ok(one.actions.length > 0);
  assert.equal((await app.inject({ url: "/v1/bills?status=bogus" })).statusCode, 400);
  assert.equal((await app.inject({ url: "/v1/bills/nope" })).statusCode, 404);
  await app.close();
});
