import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "@civic/db";
import { STATES } from "@civic/domain";
import { buildCalendar } from "./calendar.ts";
import { buildApp } from "./app.ts";

test("calendar links to state-specific registration and sourced EAC guide", async () => {
  const db = openDb(":memory:");
  db.exec(`INSERT INTO source(id,name,url,retrieved_at) VALUES('eac','EAC','https://www.eac.gov/','2026-01-01');
    INSERT INTO state_voting_guide(state,url,source_id,as_of)
    VALUES('CA','https://www.eac.gov/voters/register-and-vote-in-your-state?field_state_target_id=18176','eac','2026-01-01')`);
  const app = buildApp(db);
  try {
    const ca = buildCalendar(db, "ca");
    assert.equal(ca.voterInfo.registerUrl, "https://vote.gov/register/california");
    assert.equal(ca.voterInfo.votingGuide?.sourceId, "eac");
    assert.match(ca.voterInfo.votingGuide!.url, /field_state_target_id=18176$/);
    assert.equal(buildCalendar(db, "ND").voterInfo.registerUrl, "https://vote.gov/register/north-dakota");
    assert.equal(buildCalendar(db, "VI").voterInfo.registerUrl, "https://vote.gov/register/us-virgin-islands");
    assert.equal(buildCalendar(db, undefined).voterInfo.registerUrl, "https://vote.gov/register");
    assert.equal(new Set(STATES.map((state) => buildCalendar(db, state.usps).voterInfo.registerUrl)).size, STATES.length);
    assert.equal((await app.inject("/v1/calendar?state=XX")).statusCode, 404);
    assert.equal((await app.inject("/v1/calendar?state=")).statusCode, 400);
  } finally {
    await app.close();
    db.close();
  }
});
