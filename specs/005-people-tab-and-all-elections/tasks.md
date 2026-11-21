# Tasks: People Tab, All Elections, Major Figures (005)

**Inputs**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)
**Format**: `- [ ] T### [P] [US#] Description (path)`. `[P]` = parallelizable (different files, no dependencies). IDs continue from 004 (T153 onward there); this feature uses T300+.
**Rule**: every phase ends with `npm run typecheck` and `npm test` green (the existing 45 tests keep passing, FR-016). Tests are written before or with the code they cover. UI stays identical: new pages use existing class names only.
**MVP**: Phases A, B, C (People tab and every major figure). D–F follow.
**Stories**: US1 People tab, US2 Major figures, US3 All elections in Races, US4 Visible completeness.

## Phase A: People tab (US1)

- [ ] T300 [US1] Migration: add `office_term.office_type` and `how_filled`; backfill `office_type` from `body`/`title` for existing rows; guard with `PRAGMA user_version` (`packages/db/src/index.ts`)
- [ ] T301 [P] [US1] Test: backfill maps every existing term to a non-null office type (`tests/contract/office-type.test.ts`)
- [ ] T302 [US1] `GET /v1/people?q&officeType&status&party&state&limit` reusing `search()` in person-only mode; exact > prefix > substring, alphabetical ties (`apps/api/src/people.ts`, `apps/api/src/app.ts`)
- [ ] T303 [P] [US1] Contract test: only people returned, filters narrow, no place results, ordering neutral, no-match returns an empty list (`tests/contract/people.test.ts`)
- [ ] T304 [US1] `Search` component prop `kind="person"` that targets `/v1/people`, hides the place-only options, keeps markup and classes unchanged (`apps/web/components/Search.tsx`)
- [ ] T305 [US1] `/people` index page using `Search` person mode plus the "No people found" message; `[id]` page untouched (`apps/web/app/people/page.tsx`)
- [ ] T306 [US1] Add "People" link to `MainNav`; active on `/people` and `/people/*` (`apps/web/components/MainNav.tsx`)
- [ ] T307 [P] [US1] UI-parity test: new files use only class names defined in `globals.css`; `globals.css` unchanged; nav differs by exactly one link (`tests/web/ui-parity.test.ts`)
- [ ] T308 [P] [US1] Extend the a11y test to `/people` (label, landmarks, no horizontal scroll) (`tests/web/a11y.test.ts`)

## Phase B: Presidents and vice presidents (US2)

- [ ] T310 [US2] GRADINGS entry for `congress-legislators-executive` (CC0, official-adjacent, same grade as the legislators file) (`apps/ingest/src/sources.ts`)
- [ ] T311 [US2] Adapter: fetch `executive.json`, create people and `office_term` rows (`prez`/`viceprez`, branch `executive`, `how_filled`), aliases; merge by `bioguide`/`govtrack`/`wikidata` identifiers so Biden, Harris and Vance stay one profile (`apps/ingest/src/executive.ts`, `apps/ingest/src/main.ts`)
- [ ] T312 [P] [US2] Adapter unit test with a fixture: merge, two-term president (Trump), role dates, no duplicate person (`apps/ingest/src/executive.test.ts`)
- [ ] T313 [US2] Person page: show executive roles in "Offices held" using existing table markup; verify no new classes (`apps/web/app/people/[id]/page.tsx`)
- [ ] T314 [US2] Create `data/roster.json` seed: all presidents and vice presidents with `bioguide`/`id` where known, each with a citation URL (`data/roster.json`)
- [ ] T315 [US2] Roster contract test: every roster entry resolves via the people search to a person with the expected office label; fails with a list of misses (`tests/contract/roster.test.ts`)
- [ ] T316 [P] [US2] Search test: "Trump", "Donald J. Trump", "Biden", "Obama", "Harris", "Vance" each return the right person in the top 3 (`tests/contract/people.test.ts`)

## Phase C: Governors, cabinet, justices, leadership (US2)

- [ ] T320 [US2] `data/wikidata-positions.json`: pinned position QIDs and labels for governor, cabinet offices, associate/chief justice, Speaker, majority/minority leaders, state AG, state secretary of state, big-city mayor (`data/wikidata-positions.json`)
- [ ] T321 [US2] GRADINGS entry for `wikidata` (CC0, community-edited, grade C with rationale in the rubric popup) (`apps/ingest/src/sources.ts`)
- [ ] T322 [US2] SPARQL adapter: position-held with start/end, current and former, paced requests with User-Agent, `ingest_state` cursor table for resume; property allow-list (name, aliases, birth date, position, party, official website, image) and an explicit deny-list (residence, spouse, child, sibling) (`apps/ingest/src/wikidata.ts`, `packages/db/src/index.ts`)
- [ ] T323 [P] [US2] Adapter tests: allow-list enforced, deny-list never read, rate-limit response pauses and resumes, merge with existing people by `wikidata`/`bioguide` (`apps/ingest/src/wikidata.test.ts`)
- [ ] T324 [US2] Official cross-citation: for governors and justices add a second source row linking the official page (nga.org / supremecourt.gov / whitehouse.gov) with its own grading; render both citations (`apps/ingest/src/officialLinks.ts`, `apps/ingest/src/sources.ts`)
- [ ] T325 [US2] Extend `data/roster.json` to the full seed: 56 governors, cabinet-level officers, nine justices, congressional leadership, state AGs, top-25 city mayors (`data/roster.json`)
- [ ] T326 [US2] Run ingest, then `npm run test`; fix misses until the roster test passes with 0 missing (acceptance gate for SC-002)
- [ ] T327 [P] [US2] Exclusion test: no home address, spouse, child or minor data reachable via any new person field or API response (`tests/contract/exclusions-new.test.ts`)
- [ ] T328 [P] [US2] Test: Wikidata-only facts render with grade C and a working popup; official-cited facts render with their own grade (`tests/web/a11y.test.ts`)

## Phase D: Federal races and candidates (US3)

- [ ] T330 [US3] Migration: `election.cycle`, `election.level`, `measure` type (table rebuild guarded by `PRAGMA user_version`), `office.office_type`, `office.state`, `race.stage`, `race.candidates_status`, `race.how_filled`, new indexes (`packages/db/src/index.ts`)
- [ ] T331 [P] [US3] Migration test: existing races, candidacies and tests survive; constraints hold (`tests/contract/migration-005.test.ts`)
- [ ] T332 [US3] Structural calendar generator: presidential (2028, how filled: Electoral College), every Senate seat in the cycle (class rule), every House district (from legislators data), every governor seat; all `candidates_status = not_loaded` until candidates arrive (`apps/ingest/src/calendar.ts`)
- [ ] T333 [P] [US3] Test: counts match the derivable rules (435 districts plus delegates, class-based Senate seats, governors up in the cycle) (`apps/ingest/src/calendar.test.ts`)
- [ ] T334 [US3] OpenFEC candidate adapter: `/candidates` and `/election-dates`, paced for `DEMO_KEY`, resumable via `ingest_state`; create candidacies, link to people by `fec`/`bioguide` or name+state+office, set incumbent from terms, flip `candidates_status` to `loaded` (`apps/ingest/src/fecElections.ts`)
- [ ] T335 [P] [US3] Adapter tests with fixtures: Trump presidential candidacy links to the existing Trump person, incumbent flag, withdrawn status kept (`apps/ingest/src/fecElections.test.ts`)
- [ ] T336 [US3] Update coverage so FEC state is reported honestly (key missing vs loaded) (`apps/ingest/src/main.ts`)

## Phase E: Races UI and state/local tiers (US3)

- [ ] T340 [US3] `GET /v1/races?cycle&level&officeType&state&page` and extend `GET /v1/races/:id` with how filled, stage, incumbent, candidate person ids; neutral ordering (alphabetical, or ballot order if stored) (`apps/api/src/races.ts`, `apps/api/src/app.ts`)
- [ ] T341 [P] [US3] Contract test: filters, pagination, p95 under 1 s on the full calendar, candidate ordering neutral (`tests/contract/races.test.ts`)
- [ ] T342 [US3] `data/authorities.json`: official election-authority URL for each state, D.C. and territory, with source (NASS directory); `jurisdiction_authority` table loader; link-check them with the existing checker (`data/authorities.json`, `apps/ingest/src/authorities.ts`)
- [ ] T343 [US3] Races index page: group by cycle then level using `h2` and `.results`; filter links; page links at 50 per page; gap rows for jurisdictions lacking candidates with the authority link; uses existing classes only (`apps/web/app/races/page.tsx`)
- [ ] T344 [US3] Race page: stage, how filled, incumbent flag via existing `.chip`, candidates linking to `/people/:id`, citations with the credibility badge (`apps/web/app/races/[id]/page.tsx`)
- [ ] T345 [P] [US3] Tests: race page lists candidates with profile links; gap rows present for a state without candidates; page works without JS (`tests/web/no-js.test.ts`)
- [ ] T346 [US3] State and local candidate adapters, one at a time: probe the state's official open data, add a GRADINGS entry, adapter and fixture test; start with states that publish machine-readable candidate lists (record each probe result in `research.md`) (`apps/ingest/src/states/*.ts`)
- [ ] T347 [US3] Add `measure` (ballot measure) rows where the state source provides them; otherwise a labeled gap (`apps/ingest/src/states/*.ts`)

## Phase F: Coverage and verification (US4)

- [ ] T350 [US4] `coverage_category` table and a writer at the end of ingest: expected counts from derivable rules or the roster, loaded counts from live queries, reason and fallback URL (`packages/db/src/index.ts`, `apps/ingest/src/coverageReport.ts`)
- [ ] T351 [US4] Coverage API and page section listing election categories and figure categories: loaded, expected, gap, reason, fallback link (existing table markup) (`apps/api/src/app.ts`, `apps/web/app/coverage/page.tsx`)
- [ ] T352 [P] [US4] Test: every jurisdiction appears in Coverage as loaded or a labeled gap with a valid URL (SC-004) (`tests/contract/coverage-005.test.ts`)
- [ ] T353 [P] [US4] Test: 0 facts without source, link, date and grade across all new tables (SC-008), extending `uncitedFacts` (`tests/contract/provenance.test.ts`)
- [ ] T354 [US4] Final pass: `npm run typecheck`, `npm test` (45 plus new), rebuild web, restart on :3100, manual quickstart walkthrough, update README status (`README.md`)

## Dependencies
- Phase A is independent and shippable alone.
- B needs A's `office_type` migration (T300).
- C needs B's identifier-merge logic (T311).
- D needs the migration T330; E needs D; F needs C and E.
- Within phases, `[P]` tasks can run in parallel after their implementation task.

## Implementation strategy
1. A (People tab) first, because it is visible immediately and low-risk.
2. B and C together close the "no major politician left out" requirement; the roster test is the gate.
3. D and E deliver structural completeness for all elections, then add state and local candidates incrementally; each state source is its own small task (T346) so progress is measurable on the Coverage page.

## Implementation status (2026-10-11)

Done: People tab (`/people`, `office_type` filter); presidents and VPs (executive.json); governors (Wikipedia list), Supreme Court justices and cabinet (Wikidata, grade C); statutory race calendar (all 2026 House and Senate seats, 36 governorships, 2028 presidency) with a visible "no candidate list yet" state; contract, parser and UI-parity tests (55 passing).

Open: FEC candidates are capped by DEMO_KEY (set `FEC_API_KEY` for full federal coverage); 2028 presidential candidates; state legislatures, other statewide offices, county and local elections, primaries and special elections (no sourced data yet); congressional leadership and justices missing from Wikidata (e.g. Alito); coverage-category page.
