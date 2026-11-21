# Implementation Plan: Elections and Voting Calendar

**Spec**: [spec.md](./spec.md) · **Date**: 2026-10-12

## Research findings (probed 2026-10-12)

| Need | Source | Result |
|---|---|---|
| Election dates, offices, candidates | existing `election`/`race`/`candidacy` (statutory calendar + FEC) | 2026-11-03 general (57 jurisdictions), 2028-11-07 general; 216 races with candidates |
| Official state election office per state/territory | USA.gov "Election offices" `https://www.usa.gov/election-office` | 200; 58 parseable "Name (XX)" links to official sites |
| Federal register to vote | `https://www.usa.gov/register-to-vote` (official) | linked as a constant, cited |
| Registration deadlines per state | vote.gov | 403 to automated requests; **not ingested** |
| Election dates API | FEC `election-dates` | DEMO_KEY rate limited (429); **not ingested** |
| Primaries/runoffs/specials, ballot measures | no machine-usable official source reached | **gaps, labelled** |

## Decisions
- **D1** Certainty label is derived, not stored: `scheduled` for every election row; `confirmed_contest` per race with ≥1 candidacy; `personalized` is a static pointer, never data.
- **D2** New table `state_voting(state, name, official_url, source_id, as_of)` from USA.gov, graded as official government directory. Added to `FACT_TABLES` and the ingest wipe list.
- **D3** `GET /v1/calendar?state=XX` returns upcoming/past elections, per-election offices (with candidate counts, race ids), state links, explicit `notInOurData` list and a coverage statement.
- **D4** Page `/elections` (+ nav link), reusing `.filters`, `.results`, `.card`, `.block`, `.chip`, `.meta`, `.src`, `.empty`. State selection via query param.
- **D5** Server date decides upcoming vs past; injectable `now` for tests.

## Components
- `packages/db/src/voting.ts`: schema, `stateVoting`, `electionsFor`.
- `apps/ingest/src/votinginfo.ts`: parse USA.gov links (fixture-tested); warns and skips on layout change.
- `apps/api/src/calendar.ts` + route.
- `apps/web/app/elections/page.tsx`, `MainNav` link.
- Tests: parser fixture, contract (labels, no invented data, every state has a link), UI parity.
