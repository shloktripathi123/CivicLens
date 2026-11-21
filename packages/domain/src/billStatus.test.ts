import { test } from "node:test";
import assert from "node:assert/strict";
import { mapOregonStatus, isLaw } from "./billStatus.ts";

const h = (chamber: string, text: string) => ({ chamber, text });
test("chaptered bill is enacted and a law", () => {
  const s = mapOregonStatus({ prefix: "SB", currentLocation: "Chapter Number Assigned", chapterNumber: 216, history: [] });
  assert.equal(s, "enacted"); assert.ok(isLaw(s));
});
test("adopted resolution is not a law", () => {
  const s = mapOregonStatus({ prefix: "HCR", currentLocation: "Filed with Secretary of State", chapterNumber: null, history: [h("H", "Adopted.")] });
  assert.equal(s, "passed_both"); assert.ok(!isLaw(s));
});
test("in committee is proposed", () => {
  const s = mapOregonStatus({ prefix: "SB", currentLocation: "In Senate Committee", chapterNumber: null, history: [h("S", "Referred to Health Care.")] });
  assert.equal(s, "in_committee"); assert.ok(!isLaw(s));
});
test("passed Senate only at the House desk", () => {
  const s = mapOregonStatus({ prefix: "SB", currentLocation: "At House Desk Upon Adjournment", chapterNumber: null, history: [h("S", "Third reading.  Carried by Meek.  Passed.")] });
  assert.equal(s, "passed_one_chamber");
});
test("tabled fails, veto detected, unknown throws", () => {
  assert.equal(mapOregonStatus({ prefix: "HB", currentLocation: "House - Tabled", chapterNumber: null, history: [] }), "failed");
  assert.equal(mapOregonStatus({ prefix: "HB", currentLocation: "House Desk - Vetoed", chapterNumber: null, history: [] }), "vetoed");
  assert.throws(() => mapOregonStatus({ prefix: "HB", currentLocation: "Somewhere new", chapterNumber: null, history: [] }));
});
