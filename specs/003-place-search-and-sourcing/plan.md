# Implementation Plan: Place Search & Source-Credited Complete Profiles (003)

**Spec**: [spec.md](./spec.md) · **Builds on**: [001 plan](../001-legislator-search/plan.md), [002 plan](../002-candidate-search/plan.md)

## Summary
Add (1) place search over states, counties, cities and ZIP codes with place pages that gather officials, candidates and races, and (2) a uniform sourcing layer: every fact has a citation (exact URL, retrieval date, credibility grade), every section has one of four states, and every grade opens a popup explaining how it was decided.

## Technical Context
Same stack as built: TypeScript, npm workspaces, SQLite (`node:sqlite`), in-memory search index, Fastify, Next.js, Expo later. Tests: node test runner plus golden suites. No new runtime services.

## Key Decisions (see research.md)
1. **Place data from the Census.** Gazetteer files for states, counties, places (cities, towns, CDPs) and ZCTAs (ZIP areas), plus the 2020 ZCTA relationship files for ZIP→county and ZIP→place overlaps. All verified reachable. Public domain.
2. **ZIP codes are ZCTAs.** ZCTAs approximate ZIPs; the UI labels ZIP results approximate (FR-006) and shows every overlapping county and place with its land-area share.
3. **Place search extends the existing in-memory index** with a second index over place names (normalized, abbreviation-aware: "St."/"Saint", "Ft."/"Fort", state names and codes). Ranking: exact, then prefix, then fuzzy; ties by population when known, else alphabetical; ambiguity always lists all matches with state and type. One search box returns grouped People, Candidates, Races, Places.
4. **Place → people/races links.**
   - Federal: state-level (all senators, all House members of that state) is exact now. District-level needs a district boundary or crosswalk; the 2020 ZCTA→congressional crosswalk URL I tried returned 404, so exact district resolution is **unverified** and deferred. Until then place pages show the state's delegation and label district matching "not yet resolved".
   - Candidates and races: linked by `office.jurisdiction` (state) now; county/city links when those offices are loaded.
   - State, county and city officials: shown as "Not yet checked" until adapters exist (spec 001 phasing). Never omitted.
5. **Four section states are data, not UI guesses.** A `section_state` table records, per subject and section, one of `sourced`, `sourced_low`, `not_found`, `not_yet_checked`, plus the sources checked and `checked_at`. The coverage table from 001 is migrated into it (`complete/partial` → sourced; `unavailable` → `not_yet_checked` unless an adapter ran and found nothing → `not_found`).
6. **Citation on every fact.** Add `fact_citation` (fact table, fact key, source_id, exact URL, retrieved_at, credibility at capture, archive_url, stale flag). Existing `source_id`+`as_of` columns remain; the API composes citations from them and from per-record URLs (for example the bioguide page for a person, the FEC candidate page). A contract test fails if any API fact lacks a source name, URL, date and grade.
7. **Credibility rubric (own, published, versioned).** Criteria are properties of the source, never the claim's politics:
   | Criterion | Pass / partial / fail |
   |---|---|
   | Primary record (government filing, official data) | primary / secondary / tertiary |
   | Authorship transparency | named, accountable / organization only / anonymous |
   | Editorial process and corrections policy | published & followed / partial / none |
   | Independence from the subject | independent / mixed / self-published |
   | Verifiability (links to underlying documents) | yes / some / none |
   | Currency (updated within stated window) | yes / stale / unknown |
   Grades: **High** (primary + at least 4 passes), **Medium**, **Lower** (self-published, anonymous or unverifiable, or fails 3+). Self-reported campaign material is graded by the same rubric and also carries a "self-reported" tag (FR-021). Rubric weights are in `packages/domain/src/rubric.ts` and the published rubric page is generated from that file, so the popup and the rubric can't drift.
8. **Popup (FR-016a).** A `CredibilityBadge` component renders text plus an icon (not color alone) and opens an accessible dialog (focus trap, Escape, `aria-labelledby`) showing grade, per-criterion results, the written reason, rubric version, and links to the rubric and source pages. Data comes from `GET /v1/sources/{id}`. Native uses the same API with a bottom sheet.
9. **Conflicts.** When two citations give different values for the same fact key, the API returns all values with citations and `conflict: true`; the UI shows both.
10. **Exclusions (FR-025/026).** An `exclusion_rule` list is enforced at ingest (a denylist of field types: home address, personal phone/email, minors/family, IDs, financial/health, non-legal allegations) and by an API output filter test. A `report` endpoint hides an item pending review. Allegations only from court/legal-record sources and with case-status labels.
11. **Link health.** A nightly checker issues HEAD requests to cited URLs, marks `stale` on repeated failure, and looks up an archive copy through the Internet Archive availability API (reachable; the CDX endpoint was not). Respect rate limits; never block page rendering.
12. **Privacy (FR-024).** Address lookups are not built here; ZIP-only. If address search is added later it resolves server-side, unlogged.

## Data Model (additions)
- `place(id, type[state|county|city|zip], name, name_norm, state, fips, population, lat, lon, parent_id, source_id, as_of)`
- `place_alias(place_id, alias_norm)`
- `place_overlap(place_id, other_place_id, relation, share)` (ZIP↔county, ZIP↔city)
- `place_jurisdiction(place_id, office_id|district, relation, source_id)`
- `source` gains `type`, `credibility_grade`, `rationale`, `rubric_version`, `criteria_json`
- `rubric(version, criteria_json, published_at)`
- `fact_citation(id, subject_id, fact_key, source_id, url, retrieved_at, credibility_grade, archive_url, stale)`
- `section_state(subject_id, section, state, sources_checked_json, checked_at)`
- `exclusion_rule(category, reason)`; `correction_report(id, target, note, status, created_at)`

## API Additions (contracts/openapi.yaml)
- `GET /v1/search` returns grouped `{people, candidates, races, places}` when `groups=true`.
- `GET /v1/places/suggest?q=`; `GET /v1/places/search?q=&type=&state=`
- `GET /v1/places/{id}` → place, parents/children, overlaps, officials, candidates, races (each grouped by level), section states
- `GET /v1/zip/{zip}` → place page with approximate label and overlaps
- `GET /v1/sources`, `GET /v1/sources/{id}` (rating popup data); `GET /v1/rubric`
- `POST /v1/reports` (fact, rating or excluded item)
- Existing profile endpoints gain `citations[]`, `sections[]` (state per section) and `conflicts[]`.

## Web/Native
- One search box: results grouped People / Candidates / Races / Places.
- `/places/[id]` and `/zip/[zip]` pages: levels federal → state → county → city, each with a state of its own (listed, or a labeled gap with the official government link).
- `/sources/[id]`, `/rubric`, `/excluded-data` pages. `CredibilityBadge` + popup on every cited fact.
- Profiles render all sections via one `Section` component implementing the four states.

## Phases
| Phase | Scope | Exit criteria |
|---|---|---|
| A | Place tables from Census (states, counties, cities, ZCTAs, overlaps); place search and suggest; place pages with federal delegation, races by state, and labeled gaps for other levels | "Portland", "Multnomah County", "97201", "Oregon" all resolve; "Springfield" lists every match; golden place suite ≥95% top-3 |
| B | Source registry, rubric, credibility badges and popup, citations on all existing facts, four section states on person/candidate pages, source and rubric pages | SC-003/004/005 automated checks pass; popup keyboard-accessible |
| C | Conflicts, link checker with archive lookup, exclusion enforcement and reporting, correction reports | Exclusion test passes; stale link marked in fixture |
| D | District-level resolution (congressional, state legislative), state/county/city official adapters, native screens | District crosswalk source verified; per-state coverage published |

## Risks
- **Place-to-person coverage is thin below federal.** Mitigation: labeled gaps with official-site links, published per-state coverage; no fabricated lists.
- **ZCTA ≠ ZIP.** Mitigation: approximate label, overlaps shown.
- **Rubric perceived as biased.** Mitigation: properties-only criteria, published rubric, versioning, public correction path, same rubric for all sources.
- **"Show everything" vs. harm.** Mitigation: exclusion list (FR-025) enforced in code and tested.
- **Link checking load and ToS.** Mitigation: low rate, HEAD requests, back-off, cache.
- **Unverified:** the district crosswalk source, the 2024 gazetteer refresh cadence, Internet Archive availability API rate limits.

## Testing
- Golden place suite (≥300 places including ambiguous and misspelled; Phase A seeds a smaller list and grows).
- Contract tests: every fact has source name, URL, date, grade; every section has one of four states; no blank sections.
- Exclusion test: fixtures containing excluded fields never appear in responses.
- Conflict test with two disagreeing citations.
- Accessibility: popup focus trap, Escape, and non-color cues (automated axe check added in Phase B).
- Performance: suggest p95 < 300 ms, place page p95 < 2 s.

## Open Questions
None blocking. To verify before Phase D: district crosswalk data source and license.
