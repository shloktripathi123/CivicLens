# Implementation Plan: Candidate & Election Search (002)

**Spec**: [spec.md](./spec.md) · **Builds on**: [001 plan](../001-legislator-search/plan.md)

## Summary
Extend Civic Lens so people running for any office (president, governor, Congress, state, local) are searchable and have profiles. Candidates reuse the 001 `person` entity, search index, provenance (`source_id`, `as_of`) and `coverage` model. Add `office`, `election`, `race` and `candidacy` entities, race pages, ballot browsing, and a separate self-reported agenda section.

## Technical Context
Same stack as 001 as implemented: TypeScript, npm workspaces, SQLite (`node:sqlite`) with in-memory search index, Fastify API, Next.js web, Expo native (later). Tests: node test runner plus the golden search suite.

## Key Decisions (see research.md)
1. **One person, many roles.** A candidate who is a sitting official (e.g. Kotek, governor) is a single `person` with an `office_term` and a `candidacy`. Candidacy never creates a duplicate person. Identity matching uses external IDs first (FEC, Ballotpedia, Wikidata), then name plus office.
2. **Authoritative-source gate (FR-004).** A `candidacy` row requires a `source_id` pointing at an official filing or ballot list, or a registered committee. Ingest rejects rows without one.
3. **Say vs. done.** `agenda_item` stores self-reported positions with `source_url`, `captured_at` and `origin` (campaign site, filing, debate). It is never merged with record data in the API or UI.
4. **Neutral ordering.** Race candidates are ordered alphabetically by last name, with the ordering rule exposed in the response. No ranking or scoring.
5. **Data sources by phase.**
   - P1: FEC API (federal candidates, finance, requires a free api.data.gov key); the Oregon Secretary of State candidate filing list for the Oregon governor example.
   - P2: Ballotpedia / Democracy Works / Google Civic style ballot data (check licensing in research); state SOS filing lists as per-state adapters.
   - P3: county and local filings, presidential primary data.
   - Each source is an adapter in `apps/ingest` that writes `source` rows and per-state `coverage`.
6. **Search.** Extend `SearchIndex` with `role` (`candidate`, `official`, or both), `office_sought` and `election_year`. The Drazan/Drazen typo case is added to the golden suite. Candidates for the same race are boosted when the query contains an office or state term.
7. **Privacy.** ZIP and address lookups resolve to districts server-side via a district lookup and are not logged with identifiers.
8. **Campaign submissions (open question 2).** Phase 3; a verified-channel submission queue with moderation. Not in the MVP.

## Data Model (additions)
- `office(id, level, body, jurisdiction, title, district)`
- `election(id, date, type[general|primary|runoff|special], jurisdiction)`
- `race(id, election_id, office_id, status[upcoming|completed])`
- `candidacy(id, person_id, race_id, party, status[filed|qualified|withdrawn|won|lost], filed_on, website, source_id, as_of)`
- `agenda_item(id, candidacy_id, topic, text, origin, source_url, captured_at)`
- `education`, `career_item` (shared with 001 background; Wikidata-sourced, with provenance)
- `finance_summary(candidacy_id, receipts, disbursements, cash_on_hand, cycle, source_id, as_of)`
- `result(race_id, candidacy_id, votes, percent, certified)`

All tables carry `source_id` and `as_of` NOT NULL.

## API Additions (contracts/openapi.yaml)
- `GET /v1/search` gains `role` and `election_year` filters and an `office_sought` field on results.
- `GET /v1/candidates/{id}` returns overview, background, agenda (self-reported), record (from 001), finance, endorsements and coverage.
- `GET /v1/races?state=&office=&year=` and `GET /v1/races/{id}` return candidates in neutral order.
- `GET /v1/races/{id}/compare` returns candidates side by side by topic.
- `GET /v1/ballot?zip=` returns the races for a ZIP, with the district resolved server-side.

## Web/Native
- Search results show a "Candidate for Governor of Oregon" badge.
- `/candidates/[id]` page: Overview, Background, "What they say", "What they've done", Money, Coverage.
- `/races/[id]` page with candidate cards and a compare view.
- `/ballot` ZIP lookup.

## Phases
| Phase | Scope | Exit criteria |
|---|---|---|
| A | Schema, race and candidacy ingest for the Oregon governor race plus FEC federal candidates, candidate profile and race page | Searching "Drazen" returns Christine Drazan; Kotek is shown as both governor and candidate |
| B | Presidential cycle, all-state governor and statewide races (SOS adapters), agenda ingest, compare, ballot lookup | SC for 48-hour ballot-list freshness is met for the covered states |
| C | State legislature, county and local, results, campaign agenda submissions, native apps | Coverage dashboard shows per-state completeness |

## Risks
- **No single national source for state and local candidates.** Mitigation: per-state adapters with explicit coverage, and "Not available" states shown instead of guesses.
- **Licensing of aggregated ballot data.** Mitigation: use government filings first; verify the license before using Ballotpedia-style data.
- **Identity merges across sources.** Mitigation: external IDs first, manual review queue, tests for the Kotek-style dual role.
- **Agenda text staleness.** Mitigation: show `captured_at` and re-crawl on a schedule.
- **Nonpartisan perception.** Mitigation: neutral ordering, identical fields for every candidate, and "Not provided" shown consistently.

## Testing
- Golden search additions: Drazen, Kotek, "governor oregon", a presidential candidate.
- Contract tests against openapi.yaml.
- Fixture-based adapter tests for each source.
- Test that agenda items never appear in the record section.
- Test that ordering is alphabetical and that candidates have identical field sets.

## Open Questions
Carried from the spec (assumptions in effect): minor-party and write-in inclusion (formally filed only), campaign submissions (Phase C), speculative presidential candidates (excluded). Also to verify before Phase B: the license terms of ballot data vendors.
