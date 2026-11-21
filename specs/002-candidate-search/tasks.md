# Tasks: Candidate & Election Search (002)

**Inputs**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml)
**Format**: `- [ ] T### [P] [US#] Description (path)`. `[P]` means it can run in parallel (different files, no dependencies). Task IDs continue from 001 (T001–T068).
**MVP**: Phase A (T069–T088). Phases B and C follow the plan.

## Implementation status (Phase A)
Done: T069–T077, T079–T091, verified with `npm test` (12/12, golden 25/25), `npm run typecheck` and a browser check of search, candidate and race pages.
Deviations and gaps:
- **T078/T079 Oregon:** no verifiable machine-readable export of Oregon SOS filings was found, so the Oregon governor race is a hand-curated seed (Kotek, Drazan) citing the SOS elections site. T078 stays open.
- **T080 FEC:** the adapter works. Without `FEC_API_KEY` it uses `DEMO_KEY` capped at 3 pages (300 candidates, so federal coverage is partial). Set `FEC_API_KEY` for full coverage. The test covers name parsing, not a fixture of the HTTP responses.
- **T081:** matching is by FEC ID, then exact name in the same state. Kotek stays a single person (tested).
- **Not built:** agenda, education and career data (shown as "Not available"), campaign websites, presidential races (no 2026 cycle data), Phase B and C.

## Phase 1: Schema & Foundations (blocking)
- [x] T069 Add tables office, election, race, candidacy, agenda_item, finance_summary, result, education, career_item, all with `source_id` and `as_of` NOT NULL (`packages/db/src/index.ts`)
- [x] T070 [P] Add domain types and status transition rules filed → qualified → withdrawn/won/lost (`packages/domain/src/index.ts`)
- [x] T071 [P] Add `FEC_API_KEY` to `.env.example` and a config loader (`.env.example`, `apps/ingest/src/config.ts`)
- [x] T072 Add DB queries: raceById, racesBy(state, office, year), candidacyByPerson, candidatesForRace sorted alphabetically by last name (`packages/db/src/index.ts`)
- [x] T073 Reject candidacy rows without an authoritative `source_id` (FR-004) (`packages/db/src/index.ts`)

## Phase 2: US1 – Find a candidate by name (P1)
- [x] T074 [US1] Extend `SearchIndex` with `role`, `office_sought`, `election_year` and an office/state query boost (`apps/api/src/search.ts`)
- [x] T075 [P] [US1] Add "Drazen", "Kotek", "governor oregon" and a presidential candidate to the golden suite (`tests/search-golden/golden.json`)
- [x] T076 [US1] Add `role` and `election_year` filters to `/v1/search` and the `office_sought` result field (`apps/api/src/app.ts`)
- [x] T077 [US1] Show a "Candidate for <office>" badge in search results and suggestions (`apps/web/components/Search.tsx`)

## Phase 3: Ingest (Phase A data)
- [ ] T078 [P] Verify and document the Oregon Secretary of State candidate filing export format and URL (`specs/002-candidate-search/research.md`)
- [x] T079 [US2] Oregon SOS adapter: governor race, with Kotek and Drazan as candidacies sourced from filings (`apps/ingest/src/oregon.ts`)
- [x] T080 [P] [US2] FEC adapter: federal candidates and committees, with a fixture-based test (`apps/ingest/src/fec.ts`)
- [x] T081 Identity matching: external ID first, then name plus office, so Kotek merges with the existing person and never duplicates (`apps/ingest/src/identity.ts`)
- [x] T082 [P] Fixture tests for the adapters and the merge case (`tests/ingest/`)
- [x] T083 Per-state and per-source `coverage` rows for candidate data (`apps/ingest/src/coverage.ts`)

## Phase 4: US2 – Candidate profile (P1)
- [x] T084 [US2] `GET /v1/candidates/:id` returning overview, background, agenda, record, finance, coverage and provenance (`apps/api/src/app.ts`)
- [x] T085 [P] [US2] Contract test against `contracts/openapi.yaml` (`tests/contract/candidates.test.ts`)
- [x] T086 [US2] Test that agenda items never appear in `record`, and that every candidate has an identical field set (`tests/contract/neutrality.test.ts`)
- [x] T087 [US2] Web page `/candidates/[id]`: Overview, Background, "What they say" (source link and capture date), "What they've done", Money, Coverage (`apps/web/app/candidates/[id]/page.tsx`)
- [x] T088 [US2] Link the person profile and candidate profile for dual-role people (`apps/web/app/people/[id]/page.tsx`)

## Phase 5: US3 – Race pages & browsing (P2)
- [x] T089 [US3] `GET /v1/races` and `GET /v1/races/:id` with the ordering rule in the response (`apps/api/src/app.ts`)
- [x] T090 [P] [US3] Web `/races/[id]` with candidate cards in neutral order (`apps/web/app/races/[id]/page.tsx`)
- [x] T091 [P] [US3] Web `/races` browse by state, office and year (`apps/web/app/races/page.tsx`)

## Phase 6: Phase B scope (after A is verified)
- [ ] T092 [P] Presidential: FEC filings plus state primary ballot lists (`apps/ingest/src/presidential.ts`)
- [ ] T093 [P] State SOS adapters for statewide races, one per state, each with coverage (`apps/ingest/src/states/`)
- [ ] T094 Agenda crawler: campaign issue pages stored as text, URL and `captured_at`, no rewriting, on a re-crawl schedule (`apps/ingest/src/agenda.ts`)
- [ ] T095 Wikidata and official-bio background adapter for education and career, with provenance (`apps/ingest/src/background.ts`)
- [ ] T096 [US4] `GET /v1/races/:id/compare` and the compare view (`apps/api/src/app.ts`, `apps/web/app/races/[id]/compare/page.tsx`)
- [ ] T097 [US5] ZIP to district lookup server-side, `GET /v1/ballot?zip=`, with no identifier logging, plus a privacy test (`apps/api/src/ballot.ts`)
- [ ] T098 Evaluate ballot-data vendor licences before adoption (`specs/002-candidate-search/research.md`)

## Phase 7: Phase C scope
- [ ] T099 [P] State legislature, county and local adapters (`apps/ingest/src/local/`)
- [ ] T100 Results ingest and the won/lost status update; profiles persist after the election (`apps/ingest/src/results.ts`)
- [ ] T101 Campaign agenda submission queue with a verification and moderation workflow (`apps/api/src/submissions.ts`)
- [ ] T102 Native app screens for candidate, race and ballot (`apps/mobile/`)
- [ ] T103 Freshness check: ballot-list changes appear within 48 hours (SC target) (`apps/ingest/src/freshness.ts`)

## Dependencies
- T069 blocks everything else. T072 and T073 follow T069.
- T074–T077 (search) can run in parallel with ingest (T078–T083) after T069.
- T084 needs T072 and the ingest data. T087 needs T084. T090 and T091 need T089.
- Phase 6 starts only after the MVP (T069–T088) is verified. Phase 7 follows Phase 6.

## MVP Check (Phase A done when)
1. Searching "Drazen" returns Christine Drazan with the candidate badge.
2. The Oregon governor race page lists Drazan and Kotek alphabetically with identical fields.
3. Kotek is a single person, both governor and candidate.
4. The agenda is shown separately from the record, with source links and capture dates.
5. `npm test` and `npm run typecheck` pass.
