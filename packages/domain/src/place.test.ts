import test from "node:test";
import assert from "node:assert/strict";
import { displayName, isZip, normalizePlaceName, parsePlaceQuery, stateByFips, stateByName } from "./place.ts";

test("normalizePlaceName expands common abbreviations", () => {
  assert.equal(normalizePlaceName("St. Louis"), "saint louis");
  assert.equal(normalizePlaceName("Ft. Worth"), "fort worth");
  assert.equal(normalizePlaceName("Mt Vernon"), "mount vernon");
});

test("displayName strips Census legal suffixes", () => {
  assert.equal(displayName("Portland city"), "Portland");
  assert.equal(displayName("Multnomah County"), "Multnomah");
  assert.equal(displayName("Abanda CDP"), "Abanda");
  assert.equal(displayName("Spring City borough"), "Spring City");
  assert.equal(displayName("Juneau city and borough"), "Juneau");
  assert.equal(displayName("Nashville-Davidson metropolitan government (balance)"), "Nashville-Davidson");
});

test("parsePlaceQuery extracts state and type hints only when a name remains", () => {
  assert.deepEqual(parsePlaceQuery("Portland, Oregon"), { tokens: ["portland"], state: "OR", type: undefined });
  assert.deepEqual(parsePlaceQuery("portland or"), { tokens: ["portland"], state: "OR", type: undefined });
  assert.deepEqual(parsePlaceQuery("new york"), { tokens: ["new", "york"], state: undefined, type: undefined });
  assert.deepEqual(parsePlaceQuery("Oregon"), { tokens: ["oregon"], state: undefined, type: undefined });
  assert.deepEqual(parsePlaceQuery("Kansas City, West Virginia").state, "WV");
  assert.equal(parsePlaceQuery("Multnomah County").type, "county");
});

test("ZIP validation and state lookup", () => {
  assert.ok(isZip("97201"));
  assert.ok(!isZip("9720"));
  assert.ok(!isZip("97201-1234"));
  assert.equal(stateByFips("41")?.usps, "OR");
  assert.equal(stateByName("New Mexico")?.usps, "NM");
});
