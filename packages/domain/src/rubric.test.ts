import test from "node:test";
import assert from "node:assert/strict";
import { rate, gradeFor, CRITERIA, type Criteria } from "./rubric.ts";

const all = (n: 0 | 1 | 2): Criteria =>
  Object.fromEntries(CRITERIA.map((c) => [c.key, n])) as Criteria;

test("grades follow totals only", () => {
  assert.equal(rate(all(2)).grade, "A");
  assert.equal(rate(all(1)).grade, "C");
  assert.equal(rate(all(0)).grade, "D");
  assert.equal(gradeFor(8), "B");
  assert.equal(gradeFor(10), "A");
});

test("C and D are flagged lower credibility", () => {
  assert.equal(rate(all(2)).lowerCredibility, false);
  assert.equal(rate(all(1)).lowerCredibility, true);
});

test("rate is a pure function of the six criteria", () => {
  assert.equal(rate.length, 1);
  assert.equal(CRITERIA.length, 6);
});
