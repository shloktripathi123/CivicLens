# Tasks: CivicTrail (004)

**Inputs**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml)
**Format**: `- [ ] T### [P] [US#] Description (path)`. `[P]` = parallelizable (different files, no dependencies). IDs continue from 003 (T104–T152).
**Rule**: every phase ends with `npm run typecheck` and `npm test` green (the existing 39 tests must keep passing, FR-018). Tests are written before or with the code they cover.
**MVP**: Phases 0, A and B. C–F follow the plan.
**Stories**: US1 My Representatives, US2 Elections and Voting, US3 Bills and Decisions, US4 Government Explorer, US5 How Government Works / Learn Civics, US6 Trust, neutrality, accessibility.

## Phase 0: Audit, section states, accessibility baseline (finishes 003 T129)

- [ ] T153 [US6] `npm run audit` script: prints per-area status (people, candidates, places, bills, votes, elections, bodies, guides, meetings, AI) from DB counts and API routes; run it and paste the baseline into `quickstart.md` (`apps/ingest/src/audit.ts`)
- [ ] T154 [US6] Add `section_state` table and migrate `coverage` into it per the 003 data-model rule (`packages/db/src/index.ts`)
- [ ] T155 [US6] Serve section states from the API for people and candidates; update web pages to render the four states, with "Not found" and "Not yet checked" visually distinct (`apps/api/src/app.ts`, `apps/web/components/Section.tsx`, people and candidates pages)
- [ ] T156 [P] [US6] Test: every section on a sample profile resolves to one of the four states; no `unavailable` string remains (`tests/contract/section-state.test.ts`)
- [ ] T157 [P] [US6] Add axe-core accessibility harness: walk every route at 360 px and 1280 px; record the baseline violation count (`tests/web/a11y-routes.test.ts`)
- [ ] T158 [P] [US6] Add no-JavaScript check: fetch HTML of home, a person, a candidate and a place page and assert core content is present (`tests/web/no-js.test.ts`)
- [ ] T159 [US6] Fix baseline serious/critical a11y violations found by T157 (`apps/web/app/**`, `globals.css`)

## Phase A: My Representatives (US1)

- [ ] T160 [US1] Census geocoder client (`geographies/address`, `layers=all`) with timeout, error mapping and a mock for tests (`apps/api/src/geocoder.ts`)
- [ ] T161 [US1] Map geocoder layers (congressional, state upper/lower, school district, county, place) to our officials and bodies (`apps/api/src/representatives.ts`)
- [ ] T162 [US1] `POST /v1/representatives` with levels, labeled gaps (reason and official URL), and per-official provenance (`apps/api/src/app.ts`)
- [ ] T163 [US1] Privacy: disable request-body logging for that route; never persist the address; test that the DB and logs contain no address after a request (`tests/contract/address-privacy.test.ts`)
- [ ] T164 [US1] `GET /v1/places/:id/representatives` with `splitCertainty` (`exact`, `possibly_split`, `unknown`); ZIPs default to `possibly_split` until overlap data is verified (`apps/api/src/representatives.ts`)
- [ ] T165 [US1] Match state legislators to districts: ingest Oregon legislators with districts from the OData `Legislators` set (`apps/ingest/src/oregon-leg.ts`)
- [ ] T166 [P] [US1] Golden test: 10 known addresses (recorded geocoder responses) resolve to the expected district sets (`tests/golden/addresses.test.ts`)
- [ ] T167 [US1] Web `/representatives` page: address and ZIP form, grouped levels, gaps with official links, "address not stored" notice, nonpartisan offices show no party (`apps/web/app/representatives/page.tsx`)
- [ ] T168 [US1] Link the form from the home page and place pages; keep existing place routes working (`apps/web/app/page.tsx`, `places/[id]/page.tsx`)
- [ ] T169 [P] [US1] Test: split ZIP shows the address prompt; nonpartisan office has no party label (`tests/contract/representatives.test.ts`)

## Phase B: Bills and Decisions (US3)

- [ ] T170 [US3] `mapStatus()` in the domain package: source signals to the fixed status set, throws on unknown signals; with table tests for every row of the data-model mapping (`packages/domain/src/billStatus.ts`, `billStatus.test.ts`)
- [ ] T171 [US3] Add `bill`, `bill_status_event`, `bill_sponsor`, `vote`, `vote_position` tables with the status CHECK and derived `is_law`; add them to `FACT_TABLES` (`packages/db/src/index.ts`)
- [ ] T172 [US3] Register sources with rubric gradings: `oregon-legislature-odata`, `govinfo-billstatus`, `senate-roll-call`, `house-clerk-roll-call` (`apps/ingest/src/sources.ts`)
- [ ] T173 [US3] Oregon adapter: Measures, MeasureSponsors, MeasureHistoryActions, MeasureVotes, MeasureDocuments for the latest sessions; link text URLs (`apps/ingest/src/oregon-leg.ts`)
- [ ] T174 [P] [US3] Federal bills adapter: GovInfo BILLSTATUS XML for the current Congress with a disk cache (`apps/ingest/src/federal-bills.ts`)
- [ ] T175 [P] [US3] Federal votes adapter: House Clerk and Senate roll-call XML; map members by bioguide and LIS id; keep unmatched names (`apps/ingest/src/federal-votes.ts`)
- [ ] T176 [US3] API: `/v1/bills`, `/v1/bills/:id`, `/v1/people/:id/bills`, `/v1/people/:id/votes` with provenance (`apps/api/src/bills.ts`)
- [ ] T177 [US3] Tests: SC-004 (no enacted bill labeled proposed and vice versa across all ingested bills); citation gate covers the new tables (`tests/contract/bills.test.ts`, `citations.test.ts`)
- [ ] T178 [US3] Web components `BillStatus` (text plus icon, enacted vs proposal styling) and bill list/detail pages `/bills`, `/bills/[id]` with text link, history, sponsors, votes (`apps/web/components/BillStatus.tsx`, `apps/web/app/bills/**`)
- [ ] T179 [US3] Add bills and votes sections to person pages and replace the "not yet available" notes (`apps/web/app/people/[id]/page.tsx`)
- [ ] T180 [P] [US3] Exclusions apply to new data: extend the response-filter test with bill and vote payloads (`tests/contract/exclusions.test.ts`)

## Phase C: Elections and Voting (US2)

- [ ] T181 [US2] Research task: locate and record the live Oregon SOS and county election-office pages for registration, early voting, mail ballots and deadlines; note exact URLs and retrieval dates in `research.md`
- [ ] T182 [US2] Add `election`, `election_race`, `election_deadline`, `voting_resource` tables (`packages/db/src/index.ts`)
- [ ] T183 [US2] Seed Oregon elections and voting resources from the verified pages (T181); unverified deadlines stored with `verified = 0` (`apps/ingest/src/elections.ts`)
- [ ] T184 [US2] API `/v1/elections`, `/v1/elections/:id` returning races (alphabetical), verified deadlines as dates, others as "Not verified" with the office link (`apps/api/src/elections.ts`)
- [ ] T185 [P] [US2] Test: an unverified deadline never serializes as a date; candidates never ordered by party (`tests/contract/elections.test.ts`)
- [ ] T186 [US2] Web `/elections` and election detail pages, and place-page election block (`apps/web/app/elections/**`, `places/[id]/page.tsx`)
- [ ] T187 [P] [US2] Show candidate status changes (withdrew, lost primary) instead of removing candidates (`apps/ingest/src/candidates.ts`, race page)

## Phase D: Explorer, How It Works, Learn Civics (US4, US5)

- [ ] T188 [US4] Add `body`, `seat`, `content_citation` tables; `office_term.seat_id` (`packages/db/src/index.ts`)
- [ ] T189 [US4] Seed bodies with cited responsibilities, size, term length and selection: U.S. Senate, U.S. House, Oregon Senate, Oregon House, Oregon Governor; each with `content_citation` rows to official pages (`apps/ingest/src/bodies.ts`)
- [ ] T190 [US4] API `/v1/bodies`, `/v1/bodies/:id` with members and citations; bodies without content return a labeled gap (`apps/api/src/bodies.ts`)
- [ ] T191 [US4] Web `/explore` and body pages including appointed-official appointer and confirmation (`apps/web/app/explore/**`)
- [ ] T192 [US5] Add `guide`, `glossary_term` tables and a markdown content ingest with front matter (reviewer, last_reviewed, citations) (`apps/ingest/src/guides.ts`)
- [ ] T193 [P] [US5] Readability and neutrality lint: Flesch-Kincaid grade ≤ 9, every paragraph cited, loaded-term flags; `npm run lint:content` (`packages/domain/src/readability.ts`, `scripts/lint-content.ts`)
- [ ] T194 [US5] Author guides from official sources: how elections work, how a bill becomes law, how appointments work, how local government works, how to take part (register, attend a meeting, contact an official, poll worker) (`content/guides/*.md`)
- [ ] T195 [US5] Author the glossary (primary, general, veto, caucus, committee, quorum, and others) with citations (`content/glossary.md`)
- [ ] T196 [US5] API `/v1/guides`, `/v1/guides/:slug` (with `?place=` block from deadlines and resources), `/v1/glossary` (`apps/api/src/guides.ts`)
- [ ] T197 [US5] Web `/how-it-works` and `/learn` pages, with glossary term links and "last reviewed" dates (`apps/web/app/how-it-works/**`, `learn/**`)
- [ ] T198 [US6] Home page redesign: six area entry points plus the existing name and place search; mobile-first (`apps/web/app/page.tsx`, `layout.tsx`)

## Phase E: AI summaries (US3)

- [ ] T199 [US3] `ai_summary` table; `Summarizer` interface with no bundled provider (`packages/db/src/index.ts`, `apps/api/src/summaries.ts`)
- [ ] T200 [US3] `verifySummary()`: every number, date, bill ID and capitalized entity must appear in the source text; unit tests including a fabricated number being rejected (`packages/domain/src/summaryVerify.ts`, `.test.ts`)
- [ ] T201 [US3] Summary job: read stored bill text, call the configured provider, verify, store; with no provider configured it exits cleanly and the UI shows the official summary (`apps/ingest/src/summarize.ts`)
- [ ] T202 [US3] API returns only `verification = 'passed'` summaries with model, date and source text URL (`apps/api/src/bills.ts`)
- [ ] T203 [US3] Web `AiSummaryBox`: labeled "AI-generated summary", visually distinct from official data, model, date, source link (`apps/web/components/AiSummaryBox.tsx`)
- [ ] T204 [P] [US3] Tests: failed summaries never returned; label always present; no box without a provider (`tests/contract/ai-summary.test.ts`)

## Phase F: Meetings and native apps (US3, US6)

- [ ] T205 [US3] Research gate: verify Oregon legislative meetings via `CommitteeMeetings` and one local source (for example Legistar for Portland) before adopting; record the result in `research.md`
- [ ] T206 [US3] Add `meeting`, `meeting_item` tables; Oregon `CommitteeMeetings` adapter with agenda and minutes links; unknown items "Not published" (`apps/ingest/src/oregon-meetings.ts`)
- [ ] T207 [US3] API `/v1/meetings` and web `/meetings` (`apps/api/src/meetings.ts`, `apps/web/app/meetings/**`)
- [ ] T208 [US6] Shared UI strings and status labels in one constants module used by web and native (`packages/domain/src/labels.ts`)
- [ ] T209 [US6] Expo app scaffold in `apps/native` using the shared API client and types (`apps/native/**`)
- [ ] T210 [US6] Native screens for the six areas, credibility sheet, AI summary box, bill status (`apps/native/**`)
- [ ] T211 [P] [US6] Parity checklist test: same area names, status strings and labels on web and native (`tests/parity.test.ts`)

## Phase G: Polish and release gates

- [ ] T212 [US6] Extend `/coverage` to list gaps by level, area and body from the DB (FR-017) (`apps/web/app/coverage/page.tsx`)
- [ ] T213 [P] [US6] Neutrality review checklist run on every guide and body description; record results (`specs/004-civictrail-civic-education/checklists/neutrality.md`)
- [ ] T214 [US6] Manual keyboard and screen-reader pass on the six area home pages; fix findings (`apps/web/**`)
- [ ] T215 [US6] Final audit: `npm run audit`, `npm run test:a11y`, `npm run lint:content`, `npm test`, `npm run typecheck`; update quickstart with results
- [ ] T216 Update the 003 tasks file to close T129 and note the 004 follow-ups (`specs/003-place-search-and-sourcing/tasks.md`)

## Dependencies
- Phase 0 → everything (section states and a11y harness are used by all later UI).
- T160–T162 → T167; T165 → T161.
- T170, T171 → T173–T176; T176 → T178, T179.
- T181 → T183 → T184 → T186.
- T188 → T189 → T190 → T191; T192, T193 → T194, T195 → T196 → T197.
- T173/T174 (bill text) → T201 → T202 → T203.
- T205 → T206 → T207; T208 → T209 → T210 → T211.
- Parallel examples: T156–T158; T174 with T175; T185 with T187; T193 with T192.

## Implementation status

**Done (Phase B, Oregon bills slice):** `mapOregonStatus`/`isLaw` with table tests (`packages/domain/src/billStatus.ts`); `bill`, `bill_sponsor`, `bill_action` tables in `FACT_TABLES`; `oregon-legislature-odata` graded; Oregon adapter (`apps/ingest/src/oregonLeg.ts`, 2025R1 + 2026R1, 3,770 bills); `GET /v1/bills`, `GET /v1/bills/:id`; web `/bills`, `/bills/[id]` with `BillStatus`; SC-004 contract test. 45/45 tests pass.

**Deviations / not done:** votes (`MeasureVotes`, 72k rows) and sponsor→person linking are deferred (Oregon legislators are not yet in `person`); federal bills not ingested; Phase 0 (audit, a11y harness), Phase A (address lookup, `/representatives`), and Phases C–G are not started. Status for desk locations is derived from history text; unknown locations throw rather than guess.
