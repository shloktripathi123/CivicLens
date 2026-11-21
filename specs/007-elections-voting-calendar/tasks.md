# Tasks: Elections and Voting Calendar

- [ ] T500 `state_voting` schema, added to FACT_TABLES and ingest wipe list
- [ ] T501 USA.gov election-office parser + fixture test (`votinginfo.ts`), grading entry, wire into `main.ts`
- [ ] T502 DB helpers: elections with race/candidate counts per jurisdiction
- [ ] T503 `buildCalendar` (upcoming/past, certainty labels, gaps, coverage) + `GET /v1/calendar`
- [ ] T504 `/elections` page + nav link, existing classes only
- [ ] T505 Contract tests: labels, no invented deadlines/measures/primaries, every state has an official link
- [ ] T506 UI-parity test update; full `npm test` + typecheck
- [ ] T507 Re-ingest, restart API and web, smoke-test `/elections?state=OR`
- [ ] T508 Status section in this file

## Implementation status

All of T500–T508 done. 73 tests pass; typecheck clean. Built: `state_voting` (58 official election-office links from USA.gov), `GET /v1/calendar?state=XX`, `/elections` page and nav link.

Gaps (by design, not invented): registration deadlines, early voting, primaries/runoffs/specials, ballot measures, personalized ballots. Shown as "Not in our data" with the official state link. Reason: vote.gov blocks automated access and the FEC dates API is rate-limited under DEMO_KEY. Adding a FEC personal key or a cited state-by-state seed would fill these.
