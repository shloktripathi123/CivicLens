import test from "node:test";
import assert from "node:assert/strict";
import { openDb, conflictsFor } from "@civic/db";
import { buildApp } from "../../apps/api/src/app.ts";
import { sanitize, excludedKeys } from "../../apps/api/src/exclusions.ts";

const seeded = () => {
  const db = openDb(":memory:");
  const now = "2026-01-01";
  db.prepare("INSERT INTO source (id,name,url,retrieved_at,grade) VALUES ('a','A','https://a.test',?, 'A'),('b','B','https://b.test',?, 'C')").run(now, now);
  db.prepare("INSERT INTO person (id,canonical_name,status,source_id,as_of) VALUES ('p1','Pat Doe','current','a',?)").run(now);
  db.prepare("INSERT INTO education (person_id,institution,degree,year,source_id,as_of) VALUES ('p1','State University','BA',1990,'a',?),('p1','State University','BS',1991,'b',?)").run(now, now);
  return db;
};

test("excluded fields are stripped at any depth; court-record allegations survive", () => {
  const data = {
    name: "x", homeAddress: "1 Main", nested: [{ personalPhone: "555", ok: 1, spouse: "y" }],
    allegations: [{ caseStatus: "charged", recordUrl: "https://court.test/1", text: "t" }],
  };
  const out = sanitize(data, new Set()) as Record<string, unknown>;
  const json = JSON.stringify(out);
  for (const k of excludedKeys().filter((k) => k !== "allegations" && k !== "allegation")) assert.ok(!json.includes(`"${k}"`), k);
  assert.ok(json.includes("court.test"), "legal-record allegations are kept");
  assert.equal(JSON.stringify(sanitize({ allegations: [{ text: "rumor" }] }, new Set())).includes("rumor"), false);
});

test("conflicting values from two sources are all returned, none chosen", () => {
  const c = conflictsFor(seeded(), "p1");
  assert.deepEqual(c.map((x) => x.field).sort(), ["degree", "year"]);
  assert.equal(c[0].values.length, 2);
  assert.deepEqual(c[0].values.map((v) => v.sourceId).sort(), ["a", "b"]);
});

test("reported item is hidden pending review, report validated, rules published", async () => {
  const db = seeded();
  const app = buildApp(db);
  assert.equal((await app.inject({ url: "/v1/people/p1" })).statusCode, 404, "not a UUID, unaffected");
  assert.equal((await app.inject({ method: "POST", url: "/v1/reports", payload: { target: "x" } })).statusCode, 400);
  const ok = await app.inject({ method: "POST", url: "/v1/reports", payload: { target: "/v1/sources/a", kind: "excluded-category", note: "n" } });
  assert.equal(ok.statusCode, 201);
  const hidden = await app.inject({ method: "POST", url: "/v1/reports", payload: { target: "a", kind: "excluded-category", note: "home address shown" } });
  assert.equal(hidden.json().hidden, true);
  assert.equal((await app.inject({ url: "/v1/sources/a" })).statusCode, 451);
  const list = (await app.inject({ url: "/v1/sources" })).json();
  assert.ok(!list.items.some((s: { id: string }) => s.id === "a"));
  const ex = (await app.inject({ url: "/v1/exclusions" })).json();
  assert.ok(ex.items.length >= 6 && ex.items.every((e: { reason: string }) => e.reason));
});
