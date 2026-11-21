# Implementation Plan: Local Government (county, city, school district, special districts)

**Spec**: [spec.md](./spec.md) · **Date**: 2026-10-11

## Summary

Add a **structure-first** local-government layer on top of the 003 place model: government units, the offices that exist in each unit's form, officeholders (also entered as people), meetings, and next-election dates, every fact cited and graded. Place pages gain a "Local government" section with only the units that apply. UI reuses existing classes.

## Research findings (probed 2026-10-11)

| Need | Source | Result |
|---|---|---|
| All school districts (names, GEOIDs, centroids) | Census Gazetteer `2024_Gaz_unsd_national.zip` | 200, usable (same loader pattern as places.ts) |
| Which school district contains a location | Census TIGERweb `School/MapServer/{0,1,2}/query` (unified, secondary, elementary), point-in-polygon | Works: Portland point → "Portland School District 1J" (4110040). Used at **request time** from the ZIP centroid, cached in memory; labelled approximate |
| County/city identity | existing `place` table (Census) | Working |
| Government structure + officeholders | Official unit sites | Reachable: TriMet board (names, district, appointed/expires dates, parseable), Port of Portland commission (9 members, governor-appointed, 4-yr, meets 2nd Wednesday 9:30), Portland.gov council (page reachable; names not machine-parseable), PPS board (page reachable, no extractable text), Multnomah County and Metro: old URLs 404 |
| Special-district registry (all districts) | Census of Governments / state registries | Download not machine-usable in this session; **no nationwide special-district list**. Special districts are therefore seeded unit by unit and the UI says coverage is partial |
| Nationwide officeholders | none exists | Officials are loaded only where a source was read; every other unit says "holder not in our data" |

### Decisions

- **D1 Structure is data, not code.** Curated JSON seed files (`data/local-gov/*.json`), each fact with `sourceUrl`; offices are listed only if present in the unit's file. No generic template.
- **D2 Only verified facts are seeded.** Selection method, term, appointing authority and meeting times are entered only where read from an official page or statute this session (TriMet, Port of Portland, Portland council, Metro, PPS, Multnomah). Anything unverified is omitted, not guessed.
- **D3 Officeholders** are parsed from the unit's page where parseable (TriMet) with a fixture test; elsewhere left empty.
- **D4 People integration.** Parsed holders become `person` + `office_term` (levels `county|city|school|special`), so they appear in the People tab.
- **D5 School district resolution** is live from TIGERweb for any ZIP/city/county place; the district links to a unit page if the unit is in the DB (all Gazetteer districts are), and shows "board not in our data" otherwise.
- **D6 Next election** is stored per office as `confirmed` or `expected` with its rule; the API never emits an unlabelled inferred date.
- **D7 Grading.** Official unit pages reuse "self-reported government site" grading; curated seeds are graded as hand-curated from a government site; Census sources are authoritative.

## Data model (additions to `@civic/db`)

- `gov_unit(id, kind county|city|school_district|special_district, name, state, place_id, fips, function, form, form_basis, predecessor, official_url, source_id, as_of)`
- `gov_office(id, unit_id, title, role elected|appointed|hired|ex_officio, selection, appointing, term_years, term_limit, seats, nonpartisan, responsibilities, next_election, election_basis confirmed|expected, election_rule, source_url, source_id, as_of)`
- `gov_holder(id, office_id, person_id, name, seat, status current|vacant|interim, start_date, end_date, email, url, source_id, as_of)`
- `gov_meeting(id, unit_id, body, schedule, location, attend, public_comment, agenda_url, minutes_url, source_id, as_of)`
- `gov_area(place_id, unit_id, relation, source_id, as_of)` — which place a curated unit serves
- New tables join `FACT_TABLES` so the citation check covers them.

## API

- `GET /v1/places/:id/local` → units that apply (county/city from `gov_area`, school districts via TIGERweb, special districts from `gov_area` by county/city/zip), each with offices, holders, meetings, completeness. Elected/appointed/hired is a field; hired staff are never in "elected".
- `GET /v1/government/:id` → one unit.
- `/v1/search` gains `level=county|city|school|special` support (existing filter, new values).

## Web

- Place page: "Local government" block listing applicable units (grouped County / City / School district / Special districts), each linking to `/government/[id]`.
- `/government/[id]`: structure explainer (labelled), offices table with selection, term, next election; officials; hired staff group; meetings and take-part; completeness. Existing classes only (UI-parity test).

## Seeds (v1)

Multnomah County, Portland (city), Portland Public Schools, Port of Portland, TriMet, Metro — structure fields only where verified (D2). A second and third county are **not** seeded in this pass (no verified source read), so cross-state structure variety is still open; this is stated in Coverage.

## Risks

- ZIP centroid may fall in a different district than parts of the ZIP → labelled approximate, overlaps never resolved silently.
- Site HTML changes break the TriMet parser → ingest skips with a warning and leaves the unit holder-less.
