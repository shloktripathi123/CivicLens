# Tasks: Public Official Search (Civic Lens)

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml), [research.md](./research.md)
**Format**: `[ID] [P?] [Story] Description` — `[P]` = parallelizable (different files, no dependencies). Stories: US1 search, US2 profile/background, US3 bills & votes, US4 affiliations/funding, US5 compare/share.
**Tests**: Included, since the plan requires golden-set search, contract, adapter, and a11y tests.

## Phase 1: Setup

- [x] T001 Initialize pnpm + Turborepo monorepo with `apps/{web,mobile,api,ingest}`, `packages/{domain,api-client,db}`, `tests/`
- [x] T002 [P] Configure TypeScript, ESLint, Prettier, Vitest at repo root
- [x] T003 [P] Add `docker-compose.yml` (Postgres 16, Redis) and `.env.example` (CONGRESS_GOV_API_KEY, OPENFEC_API_KEY, OPEN_STATES_API_KEY)
- [ ] T004 [P] CI workflow: lint, typecheck, unit, contract, golden search, axe a11y

## Phase 2: Foundational (blocks all stories)

- [x] T005 `packages/db`: migrations for source, person, person_identifier, person_name, jurisdiction, body, office_term (data-model.md); enable `pg_trgm`, `unaccent`
- [x] T006 `packages/db`: migrations for committee, committee_membership, caucus_membership, background_entry, coverage
- [ ] T007 `packages/db`: migrations for bill, bill_cosponsor, bill_action, bill_topic, roll_call (partitioned by year), vote
- [ ] T008 `packages/db`: migrations for funding_cycle, funding_contributor, disclosure, rating_publisher, rating, endorsement
- [x] T009 DB constraint/lint: reject fact rows missing `source_id` + `as_of`; non-overlapping `office_term` check
- [x] T010 [P] `packages/domain`: shared types, name normalization (unaccent, lowercase, "Last, First"), nickname map
- [x] T011 [P] `apps/api`: Fastify scaffold, error handling, Redis cache plugin, rate limiting, CORS
- [ ] T012 Generate typed client in `packages/api-client` from `contracts/openapi.yaml`; add contract-test harness in `tests/contract/`
- [x] T013 `apps/ingest`: adapter framework (`fetch → normalize → upsert`), raw payload archive, scheduler, idempotent upsert, provenance stamping, coverage computation
- [ ] T014 Source licensing review checklist + `source` seed records (license, attribution) in `docs/sources.md`
- [ ] T015 [P] Shared design tokens and accessibility conventions in `packages/domain` (or `packages/ui-tokens`)

**Checkpoint**: schema, API shell, ingest framework ready.

## Phase 3: User Story 1 — Find an official by name (P1) 🎯 MVP

- [x] T016 [P] [US1] Golden search set `tests/search-golden/golden.json` (exact, partial, typo, nickname, accent, collisions, former members) + runner asserting top-3 ≥ 98%
- [x] T017 [P] [US1] Contract tests for `/v1/search` and `/v1/suggest` in `tests/contract/`
- [x] T018 [P] [US1] Adapter: `unitedstates/congress-legislators` (current + historical) → person, person_identifier, person_name, office_term in `apps/ingest/adapters/congress-legislators/`, with fixtures
- [x] T019 [US1] Name-variant generator populating `person_name` (nicknames, diacritics-stripped, maiden/variants) — depends on T010, T018
- [x] T020 [US1] Search service: trigram + prefix + FTS ranking, facets filters (level, body, state, status, party, year) in `apps/api/src/search/`
- [x] T021 [US1] `/v1/search` and `/v1/suggest` routes (suggest cached, max 8, p95 < 300 ms) — depends on T020
- [x] T022 [P] [US1] Web: search page with typeahead, filters, results list, empty state with suggestions in `apps/web/`
- [ ] T023 [P] [US1] Mobile: search screen with typeahead, filters, results in `apps/mobile/`
- [x] T024 [US1] Performance test for suggest p95 and golden-set CI gate

**Checkpoint**: Search works end to end for federal officials, current and former.

## Phase 4: User Story 2 — Profile and background (P1)

- [ ] T025 [P] [US2] Contract tests for `/v1/people/{id}` and `/timeline`
- [x] T026 [P] [US2] Adapter: committees, leadership, caucus data from congress-legislators → committee tables
- [ ] T027 [P] [US2] Adapter: Wikidata bio (birth, education, career, prior offices, photo + license) → background_entry
- [ ] T028 [US2] Entity resolution: deterministic ID joins; fuzzy candidates to review queue table + CLI in `apps/ingest/resolve/`
- [x] T029 [US2] Profile service + coverage indicator logic in `apps/api/src/people/`
- [x] T030 [US2] `/v1/people/{id}`, `/v1/people/{id}/timeline` routes — depends on T029
- [x] T031 [P] [US2] Web: profile page (SSR/ISR, stable URL, source + as-of on every fact, "Not available" states, coverage badges)
- [ ] T032 [P] [US2] Mobile: profile screen + deep link handling
- [ ] T033 [P] [US2] Playwright + axe a11y tests for search and profile pages

## Phase 5: User Story 3 — Bills and votes (P2)

- [ ] T034 [P] [US3] Contract tests for `/v1/people/{id}/bills`, `/votes`, `/v1/bills/{id}`
- [ ] T035 [P] [US3] Adapter: Congress.gov bills, sponsors, cosponsors, actions, CRS summaries, topics
- [ ] T036 [P] [US3] Adapter: House Clerk / Senate roll-call XML → roll_call, vote (hourly in session)
- [ ] T037 [P] [US3] Adapter: Voteview historical votes (pre-modern Congresses)
- [ ] T038 [US3] Bills/votes services: filters (topic, status, date, position), cursor pagination, missed-vote % with method note
- [ ] T039 [US3] Routes `/v1/people/{id}/bills`, `/votes`, `/v1/bills/{id}` — depends on T038
- [ ] T040 [P] [US3] Web: Bills and Votes tabs, filters, bill detail with plain summary, "generated" label if applicable
- [ ] T041 [P] [US3] Mobile: Bills and Votes screens with filters and infinite scroll

## Phase 6: User Story 4 — Affiliations, funding, ratings (P2)

- [ ] T042 [P] [US4] Contract tests for `/funding`, `/ratings`
- [ ] T043 [P] [US4] Adapter: OpenFEC (totals, top donors/industries, PACs per cycle) → funding tables
- [ ] T044 [P] [US4] Adapter: House/Senate financial disclosure links → disclosure
- [ ] T045 [US4] Ratings licensing review per publisher; seed a balanced publisher set with methodology links (blocks T046)
- [ ] T046 [P] [US4] Adapter/import for ratings and endorsements with publisher, year, methodology URL
- [ ] T047 [US4] Funding and ratings services/routes `/v1/people/{id}/funding`, `/ratings`
- [ ] T048 [P] [US4] Web: Funding and Affiliations tabs with cycle selector
- [ ] T049 [P] [US4] Mobile: Funding and Affiliations screens

## Phase 7: User Story 5 — Compare and share (P3)

- [ ] T050 [P] [US5] Contract test for `/v1/compare`
- [ ] T051 [US5] Compare service: shared-vote agreement % with method note; neutral stats only
- [ ] T052 [US5] `/v1/compare` route
- [ ] T053 [P] [US5] Web: compare view, share/copy link, Open Graph previews
- [ ] T054 [P] [US5] Mobile: compare view, native share sheet, universal links / app links

## Phase 8: Expansion — state, local, executive (spec scope; phased)

- [ ] T055 [P] Adapter: Open States (state legislators, bills, votes) with per-state coverage records
- [ ] T056 [P] Adapter: state campaign-finance sources (licence-reviewed)
- [ ] T057 [P] Jurisdiction/OCD-ID seeding for counties and municipalities
- [ ] T058 [P] Adapter template + docs for county/local directories; first pilot jurisdictions
- [ ] T059 [P] Adapter: executive departments/agency officials (official org charts)
- [ ] T060 Extend entity resolution to cross-level unified timelines (state → federal)
- [ ] T061 Coverage dashboard (internal) tracking completeness per jurisdiction and level

## Phase 9: Polish and release

- [ ] T062 [P] `/v1/meta/freshness` endpoint + stale-data banner on web and mobile
- [ ] T063 [P] Manual accessibility audit (screen readers, keyboard, dynamic type) against WCAG 2.1 AA
- [ ] T064 [P] Performance and load tests (profile p95 < 2 s); CDN/cache tuning
- [ ] T065 [P] Nonpartisan review: methodology page, neutral wording audit, ratings balance check
- [ ] T066 [P] Privacy review: confirm no accounts/PII; minimal analytics only
- [ ] T067 EAS build config and App Store / Google Play submissions
- [ ] T068 Run `quickstart.md` validation scenarios end to end; update docs

## Implementation status (2026-10-11)

Implemented: federal MVP slice (web + API + ingest). Done tasks are checked above.
Deviations from plan: SQLite (`node:sqlite`) replaces Postgres/Redis for local dev (no Docker available; in-memory search index and suggest cache); npm workspaces replace pnpm; migrations are a single idempotent schema in `packages/db`; tasks T006-T008 are partly covered (committee/social/coverage tables built; bills, votes, funding, ratings tables deferred); T007/T008 not done.
Not yet done: native mobile app (T023, T032), Wikidata background (T027), entity-resolution review queue (T028), timeline route is implemented but without UI (part of T030/T031), a11y automation (T033), CI (T004), and Phases 5-9.

## Dependencies and order

- Setup → Foundational → US1 → US2 (US2 reuses person data from US1) → US3 / US4 (parallel after US2) → US5 (needs votes from US3) → Expansion → Polish.
- Within a story: tests and adapters first, then services, routes, then web/mobile UI (parallel).
- T045 blocks T046; T028 blocks T060.

## MVP

Phases 1–4 (T001–T033): federal current and former officials, with search and profile on web and mobile.
