import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "@civic/db";
import { STATES } from "@civic/domain";
import { gradeSources } from "./sources.ts";
import { ingestVotingGuides, parseElectionOffices, parseVotingGuides } from "./votinginfo.ts";

test("parses state election office links", () => {
  const html = `<ul><li><a href="https://www.sos.alabama.gov/alabama-votes">Alabama (AL)</a></li>
  <li><a class="x" href="https://sos.oregon.gov/voting-elections/Pages/default.aspx">Oregon (OR)</a></li><li><a href="/other">About us</a></li></ul>`;
  assert.deepEqual(parseElectionOffices(html).map((l) => [l.state, l.url]), [
    ["AL", "https://www.sos.alabama.gov/alabama-votes"], ["OR", "https://sos.oregon.gov/voting-elections/Pages/default.aspx"],
  ]);
});
test("returns nothing for an unrecognised layout", () => assert.equal(parseElectionOffices("<p>x</p>").length, 0));

const selector = `<select name="field_state_target_id">${STATES.map((state, index) =>
  `<option value="${1000 + index}">${state.usps === "VI" ? "Virgin Islands" : state.name}</option>`,
).join("")}<option value="9999">Military &amp; Overseas</option></select>`;

test("parses all state and territory guides, and rejects incomplete or duplicate selectors", () => {
  const guides = parseVotingGuides(selector);
  assert.equal(guides.length, STATES.length);
  assert.match(guides.find((guide) => guide.state === "VI")!.url, /field_state_target_id=\d+$/);
  assert.throws(() => parseVotingGuides(selector.replace(/<option value="\d+">California<\/option>/, "")), /missing: CA/);
  assert.throws(() => parseVotingGuides(selector.replace("</select>", '<option value="22">Oregon</option></select>')), /Duplicate EAC state: OR/);
  assert.throws(() => parseVotingGuides("<p>layout changed</p>"), /selector not found/);
});

test("failed refresh preserves existing guides and successful refresh is graded", async () => {
  const db = openDb(":memory:");
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(selector);
    assert.equal(await ingestVotingGuides(db), STATES.length);
    gradeSources(db);
    const before = db.prepare("SELECT * FROM state_voting_guide ORDER BY state").all();
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    await assert.rejects(ingestVotingGuides(db), /HTTP 503/);
    assert.deepEqual(db.prepare("SELECT * FROM state_voting_guide ORDER BY state").all(), before);
    globalThis.fetch = async () => new Response(selector);
    assert.equal(await ingestVotingGuides(db), STATES.length);
    gradeSources(db);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});
