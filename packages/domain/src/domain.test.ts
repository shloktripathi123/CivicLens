import test from "node:test";
import assert from "node:assert/strict";
import { normalizeName, scoreName, tokens, personId, levenshtein } from "./index.ts";

test("normalizeName strips accents and punctuation", () => {
  assert.equal(normalizeName("Nydia M. Velázquez"), "nydia m velazquez");
  assert.equal(normalizeName("Murkowski, Lisa"), "murkowski lisa");
});

test("scoreName handles exact, partial, typo, nickname", () => {
  const n = "elizabeth warren";
  assert.equal(scoreName(tokens("elizabeth warren"), n), 100);
  assert.ok(scoreName(tokens("warren"), n) > 80);
  assert.ok(scoreName(tokens("warrn"), n) > 0);
  assert.ok(scoreName(tokens("liz warren"), n) > 0);
  assert.equal(scoreName(tokens("zzzzz"), n), 0);
});

test("personId is stable and uuid-shaped", () => {
  const a = personId("bioguide", "W000817");
  assert.equal(a, personId("bioguide", "W000817"));
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test("levenshtein", () => assert.equal(levenshtein("kitten", "sitting"), 3));
