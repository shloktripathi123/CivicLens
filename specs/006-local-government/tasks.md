# Tasks: Local Government

Phases: A schema+seeds · B ingest (school districts, TriMet holders) · C API · D web · E tests/coverage.

## Phase A — Schema and seeds
- [ ] T400 Add `gov_*` tables + FACT_TABLES entries in `packages/db`
- [ ] T401 DB helpers: `govUnitsForPlace`, `getGovUnit`
- [ ] T402 Seed file `data/local-gov/portland-metro.json` (only verified facts, each with sourceUrl)
- [ ] T403 Source gradings for new sources

## Phase B — Ingest
- [ ] T410 Gazetteer school districts → `gov_unit` (all states)
- [ ] T411 Seed loader (units, offices, meetings, areas)
- [ ] T412 TriMet board parser + holders → person/office_term (fixture test)

## Phase C — API
- [ ] T420 `GET /v1/places/:id/local` incl. live TIGERweb school district
- [ ] T421 `GET /v1/government/:id`
- [ ] T422 `level` filter accepts county|city|school|special

## Phase D — Web
- [ ] T430 Place page "Local government" block
- [ ] T431 `/government/[id]` page
- [ ] T432 Types in `lib/api.ts`

## Phase E — Verify
- [ ] T440 Unit tests (parser, seed integrity: hired never elected, expected dates labelled)
- [ ] T441 Contract test against ingested DB
- [ ] T442 UI-parity test extended
- [ ] T443 Coverage counts for units
- [ ] T444 Regression: full suite

## Implementation status

Built: `gov_*` schema (`packages/db/src/gov.ts`), curated seed `data/local-gov/portland-metro.json`, TriMet board parser with fixture tests, Census school-district list (10,893 units), `GET /v1/places/:id/local` (live TIGERweb school-district lookup, labelled approximate), `GET /v1/government/:id`, a "Local government" block on place pages and `/government/[id]`. 64 tests pass; typecheck clean.

Not done (honest gaps): officeholders and special districts exist only for Portland-area units (Multnomah County, City of Portland, Metro, TriMet, Port of Portland); row offices (sheriff, DA, assessor, clerk, treasurer), school board members and Portland Public Schools board details, next-election dates, and recorded votes are not seeded because they were not verified from official pages; they display as "not in our data". Persons are not created as `person` records (holders live in `gov_holder`).
