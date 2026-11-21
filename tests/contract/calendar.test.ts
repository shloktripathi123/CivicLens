import test from "node:test";
import assert from "node:assert/strict";
import { openDb, uncitedFacts } from "../../packages/db/src/index.ts";
import { buildCalendar } from "../../apps/api/src/calendar.ts";

const db = openDb();

test("before Nov 3 2026 the general is upcoming and labelled scheduled", () => {
  const c = buildCalendar(db, "OR", new Date("2026-10-12"));
  assert.ok(c.upcoming.some((e) => e.date === "2026-11-03" && e.label === "scheduled"));
  assert.equal(c.past.length, 0);
});

test("after the date it moves to past", () => {
  const c = buildCalendar(db, "OR", new Date("2026-11-04"));
  assert.ok(c.past.some((e) => e.date === "2026-11-03"));
});

test("contests are confirmed only with a sourced candidacy", () => {
  const c = buildCalendar(db, undefined, new Date("2026-10-12"));
  for (const e of c.upcoming) for (const k of e.contests) assert.equal(k.label === "confirmed_contest", k.candidates > 0);
});

test("Oregon deadlines are rule-derived and labelled; other states declare the gap", () => {
  const c = buildCalendar(db, "OR", new Date("2026-10-12"));
  const w = c.upcoming.find((e) => e.date === "2026-11-03")!.windows;
  const by = Object.fromEntries(w.map((x) => [x.kind, x]));
  assert.equal(by.registration_deadline.endDate, "2026-10-13");
  assert.equal(by.dropbox_close.endDate, "2026-11-03");
  assert.ok(w.every((x) => /confirm/i.test(x.basis) && x.url.startsWith("https://")));
  assert.ok(!c.notInOurData.some((n) => /^Registration deadlines/.test(n)));
  const mi = buildCalendar(db, "MI", new Date("2026-10-12"));
  assert.ok(mi.upcoming.every((e) => e.windows.length === 0));
  assert.ok(mi.notInOurData.some((n) => /Registration deadlines/.test(n)));
  assert.ok(c.notInOurData.some((n) => /Ballot measures/.test(n)));
  assert.ok(c.upcoming.every((e) => e.type === "general"));
});

test("every state with a 2026 election has an official election-office link", () => {
  const states = (db.prepare("SELECT DISTINCT jurisdiction AS s FROM election WHERE date = '2026-11-03' AND jurisdiction <> 'US'").all() as Array<{ s: string }>).map((r) => r.s);
  const missing = states.filter((s) => !buildCalendar(db, s).voterInfo.stateOffice);
  assert.deepEqual(missing, []);
});

test("new fact tables are cited and graded", () => assert.deepEqual(uncitedFacts(db).filter((f) => /^(state_voting|voting_window|official_record)$/.test(f.table)), []));
