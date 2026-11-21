# Tasks: Place Search & Sourcing (003)

**Inputs**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml)
**Format**: `- [ ] T### [P] [US#] Description (path)`. `[P]` = parallelizable (different files, no dependencies). IDs continue from 002 (T069–T103).
**MVP**: Phase A (T104–T123). Phases B, C, D follow the plan.
**Stories**: US1 place search, US2 complete profiles with sources, US3 credibility explanation, US4 browse hierarchy.

## Implementation status (Phase A)
Done: T104–T123. Verified with `npm test` (24/24), typecheck, and the web app in a browser. Deviations:
- `place_alias` and `place_jurisdiction` tables were not created. Abbreviations are handled by `normalizePlaceName`, and jurisdictions arrive with Phase D sourced rows.
- Census files carry no state file or population, so states come from a static table and ambiguous names are ordered alphabetically by type and state.
- Counties and cities are siblings under a state. No sourced county→city relation was loaded, so city pages do not show a county parent. ZIPs link to their overlapping counties and cities.
- Races are not a separate search group; they appear on place pages and via "governor oregon" in people search (T118).
- T110 uses inline fixtures in the test file rather than fixture files. T121 is folded into `tests/contract/places.test.ts`.
- Federal candidate lists are partial until a full `FEC_API_KEY` is used.

## Implementation status (Phase B)
Done: T124–T128, T130–T138 (T129 open). Deviations:
- No separate `fact_citation` table. Every fact row already carries `source_id` and `as_of`, so a citation is that row joined to its source (URL, retrieved date, grade). `uncitedFacts()` fails ingest, and `tests/contract/citations.test.ts` fails, if any fact lacks a graded source. Citations are per source, not per exact record URL, so Verifiability is scored at most 1 for every current source.
- `rubric` is code (`packages/domain/src/rubric.ts`, version 1), not a table; the grade, reason and criteria are stored on `source`.
- T129 (`section_state` table and `coverage` migration) is not built. Place pages already label each level sourced / not yet checked; person and candidate pages still use the older complete/partial/unavailable coverage.
- `SectionShell` is not a separate component; the place page `Level` renders the states. `Cite` replaces the per-page `Src` helpers and shows the badge on every cited fact.
- The coverage page (T137) is a static table of targets versus today.
- The Oregon seed is graded C (hand-curated, no editorial process) and labeled lower credibility.
- T136 is a source-level check of the badge, plus a manual browser check (popup opens, lists six criteria, closes with Esc).

## Implementation status (Phase C)
Done: T139–T146. Deviations:
- Conflict detection covers education (degree and year for the same institution from different sources). Only one source supplies education today, so conflicts appear once a second source is added; tested with fixtures.
- Exclusions are enforced by a response filter on every JSON response (field-name based, any depth) plus a published list. Court-record allegations (with `caseStatus` and `recordUrl`) pass; other allegations are dropped. Current adapters ingest no excluded field, and office phone/address are official offices.
- Reports of kind `excluded-category` hide the target id (451 on direct access, removed from lists) until reviewed. There is no reviewer UI yet; status changes are made in the database.
- The link checker runs with `LINKCHECK=1 npm run ingest` (first run: 4 source links, 0 broken). It checks source URLs, not every per-fact URL, and keeps only the archive link and capture date, not a copy of the value.

## Phase A: Places (US1, US4) — MVP

- [x] T104 [US1] Verify Census file formats (Gazetteer for states, counties, places, ZCTAs; ZCTA↔county and ZCTA↔place relationship files; BOM, pipe delimiters, empty leading fields) and record column indexes in research.md (specs/003-place-search-and-sourcing/research.md)
- [x] T105 [US1] Add tables `place`, `place_alias`, `place_overlap`, `place_jurisdiction` with unique (type, fips/zip) and read queries `getPlace`, `childrenOf`, `overlapsOf` (packages/db/src/index.ts)
- [x] T106 [P] [US1] Add place types, `normalizePlaceName` (st/saint, abbreviations, state names/USPS codes) and ZIP validation (packages/domain/src/place.ts)
- [x] T107 [P] [US1] Unit tests for place normalization and ZIP validation (packages/domain/src/place.test.ts)
- [x] T108 [US1] Census places adapter: download and cache Gazetteer files, load states, counties, places, ZCTAs; parse with the verified columns (apps/ingest/src/places.ts)
- [x] T109 [US1] Load ZCTA↔county and ZCTA↔place overlaps with land-area share; mark ZIP rows approximate (apps/ingest/src/places.ts)
- [x] T110 [P] [US1] Parser tests using small fixture files for each Census format (apps/ingest/src/places.test.ts, apps/ingest/fixtures/)
- [x] T111 [US1] Wire places adapter into `npm run ingest` and add place counts to the ingest report (apps/ingest/src/main.ts)
- [x] T112 [US1] Place `SearchIndex` (separate in-memory index): typo tolerance, alias handling, neutral ordering for ambiguous names, exact ZIP lookup (apps/api/src/placeSearch.ts)
- [x] T113 [US1] Routes `GET /v1/places/suggest`, `/v1/places/search`, `/v1/places/{id}`, `/v1/zip/{zip}` per contract, with `approximate` flag on ZIP results (apps/api/src/app.ts)
- [x] T114 [US1] Place page payload: parent chain, children, state's federal delegation (via existing term data), state races, overlaps; district shown as "not resolved" (apps/api/src/app.ts, packages/db/src/index.ts)
- [x] T115 [P] [US1] Contract tests for place routes, including ZIP approximate label and ambiguous "Springfield" (tests/contract/places.test.ts)
- [x] T116 [P] [US1] Golden place suite: ZIP, city with abbreviation ("St. Louis"), county, state, typo, ambiguous name (tests/place-golden/golden.json, golden.test.ts)
- [x] T117 [US1] Add place API types and client functions (apps/web/lib/api.ts)
- [x] T118 [US1] Grouped search box: People, Candidates, Races, Places, with suggestions under 300 ms (apps/web/components/Search.tsx)
- [x] T119 [US1] Place page with delegation, races, overlaps, ZIP-approximate notice, and labeled gaps with links to official sites (apps/web/app/places/[id]/page.tsx)
- [x] T120 [US4] Browse hierarchy country → state → county → city with breadcrumbs (apps/web/app/places/page.tsx, apps/web/components/Breadcrumbs.tsx)
- [x] T121 [P] [US1] Latency check: suggest p95 < 300 ms, place page < target in plan (tests/perf/places.test.ts)
- [x] T122 [US1] Rebuild web, run `npm test`, typecheck, and verify ZIP 97201, "Portland", "Multnomah County", "Oregon" in the browser (manual)
- [x] T123 [US1] Update README and quickstart with place ingest and search (README.md, specs/003-place-search-and-sourcing/quickstart.md)

## Phase B: Sourcing layer (US2, US3)

- [x] T124 [US3] Rubric as code: six criteria (primary record, authorship transparency, editorial process, independence, verifiability, currency), grading function, version number (packages/domain/src/rubric.ts)
- [x] T125 [P] [US3] Rubric unit tests: grade depends only on source properties, never claim content (packages/domain/src/rubric.test.ts)
- [x] T126 [US2] Migrate: `source` gets type, grade, rationale, rubric_version, criteria_json; add `rubric`, `fact_citation`, `section_state`; migrate `coverage` to sourced / sourced_low / not_found / not_yet_checked (packages/db/src/index.ts)
- [x] T127 [US2] Source registry seeded for existing adapters (Congress legislators, FEC, Oregon SOS, Census), each graded by the rubric with a written reason (apps/ingest/src/sources.ts)
- [x] T128 [US2] Record `fact_citation` (exact URL, retrieved_at, grade) for every fact the adapters write; fail ingest on a fact without a citation (apps/ingest/src/adapter.ts, candidates.ts, fec.ts, oregon.ts)
- [ ] T129 [US2] Compute `section_state` per subject and section, including sources checked and checked_at; completeness summary (apps/ingest/src/coverage.ts)
- [x] T130 [US2] Routes `GET /v1/sources`, `/v1/sources/{id}`, `/v1/rubric`; include citations and section states in person, candidate, race, place payloads (apps/api/src/app.ts)
- [x] T131 [P] [US2] Contract test: every returned fact has source name, URL, date and grade (tests/contract/citations.test.ts)
- [x] T132 [US3] `CredibilityBadge` component: text plus icon, opens accessible dialog (focus trap, Esc, keyboard) with grade, per-criterion result, reason, rubric version, links (apps/web/components/CredibilityBadge.tsx)
- [x] T133 [US2] `SectionShell` component showing the four states, sources checked, and completeness summary; apply to person, candidate, race and place pages (apps/web/components/SectionShell.tsx, apps/web/app/**)
- [x] T134 [US2] Citation links on every fact, with self-reported label for agenda and bio (apps/web/components/Cite.tsx)
- [x] T135 [P] [US3] Source page and published rubric page generated from `rubric.ts` (apps/web/app/sources/[id]/page.tsx, apps/web/app/rubric/page.tsx)
- [x] T136 [P] [US3] Accessibility tests for the popup and states conveyed without color alone (tests/web/a11y.test.ts)
- [x] T137 [US2] Published coverage targets per level and state (FR-014) (apps/web/app/coverage/page.tsx, apps/api/src/app.ts)
- [x] T138 [US2] Run tests, typecheck, and browser-verify a profile, a race and a place page, including opening the popup (manual)

## Phase C: Conflicts, link health, exclusions (US2)

- [x] T139 [US2] Conflict detection across sources for the same fact; API returns all values flagged as conflicting (packages/db/src/index.ts, apps/api/src/app.ts)
- [x] T140 [P] [US2] Conflict display component listing every value with its source and grade (apps/web/components/Conflict.tsx)
- [x] T141 [US2] Link checker job using the archive.org availability API; store `archive_url`, `stale`, retained value and capture date (apps/ingest/src/linkcheck.ts)
- [x] T142 [P] [US2] Link checker tests with mocked responses (apps/ingest/src/linkcheck.test.ts)
- [x] T143 [US2] `exclusion_rule` table and the FR-025 category list; enforce at ingest and in an API response filter (packages/db/src/index.ts, apps/api/src/exclusions.ts)
- [x] T144 [P] [US2] Tests proving excluded categories never appear in any response (tests/contract/exclusions.test.ts)
- [x] T145 [US2] `POST /v1/reports` and `correction_report` table; reported items hidden pending review; public exclusions page (apps/api/src/app.ts, apps/web/app/exclusions/page.tsx)
- [x] T146 [US2] Run tests, typecheck and browser verification (manual)

## Phase D: District resolution and sub-state coverage

- [ ] T147 [US1] Find and verify a source for place → congressional district (not found yet); document in research.md before coding (specs/003-place-search-and-sourcing/research.md)
- [ ] T148 [US1] District resolution using the verified source; keep "not resolved" where it does not apply (apps/ingest/src/districts.ts, apps/api/src/app.ts)
- [ ] T149 [US2] State legislator adapter for at least one pilot state (Oregon), with sources and citations (apps/ingest/src/state-legislators.ts)
- [ ] T150 [US2] County and city official adapter for at least one pilot jurisdiction (apps/ingest/src/local.ts)
- [ ] T151 [US1] Street-address lookup resolved server-side without storing the address (FR-024), only if a verified geocoder is chosen (apps/api/src/address.ts)
- [ ] T152 [US2] Native app parity for place search, source links and the credibility popup (apps/mobile/**) — depends on 001's native tasks

## Dependencies

- T104 → T108–T110. T105, T106 → T108, T112. T112 → T113 → T114 → T117–T119.
- Phase B needs Phase A's place pages for the section shell (T133). T124 → T127, T132. T126 → T127–T129.
- Phase C needs T126 and T128. Phase D needs Phases A and B.
- Parallelizable: T106/T107, T110, T115/T116, T121, T125, T131, T135/T136, T140, T142, T144.

## Notes

- Hand-seeded or partial data below the federal level must appear as labeled gaps (state `not_yet_checked` or `not_found`), never as invented values.
- T147 is deliberately research-first because no ZCTA→district crosswalk was reachable during planning.
