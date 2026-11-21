# Research: Place Search & Sourcing

| Topic | Decision | Rationale | Alternatives |
|---|---|---|---|
| Place data | Census Gazetteer files (states, counties, places, ZCTAs) | Public domain, national, verified reachable | GeoNames (license/attribution), commercial geocoders |
| ZIP mapping | Census 2020 ZCTA↔county and ZCTA↔place relationship files with land-area shares | Public, shows overlaps honestly | HUD-USPS crosswalk (needs a token, adds a dependency) |
| ZIP fidelity | ZCTAs labeled approximate | ZCTAs are not USPS ZIPs | Paid ZIP boundaries |
| Congressional district for a place | Deferred; show state delegation and say district is unresolved | The ZCTA→district URL tried returned 404, so no verified source yet | Guess from lat/lon (rejected: could mislead) |
| Place index | In-memory second index like 001's name index | Same pattern, fast, no new service | SQLite FTS5 |
| Ambiguity ranking | All matches shown; order by population if known, else alphabetical | Neutral and explainable | Pick the biggest silently (rejected by FR-003) |
| Section states | Stored table `section_state` | Honest "Not found" vs "Not yet checked" needs recorded checks | Derive from absence of rows (cannot tell the two apart) |
| Citations | `fact_citation` plus composition from existing `source_id`/`as_of` | Reuses current provenance | Rewrite all tables |
| Credibility | Own rubric, properties of the source only, versioned and published | User requirement; avoids judging claim content | Third-party media ratings (extra context only) |
| Popup | Accessible dialog fed by `/v1/sources/{id}`; rubric page generated from the same code | Popup and published rubric cannot diverge | Static text |
| Archive links | Internet Archive availability API | Reachable in testing | CDX API (not reachable in testing), self-archiving |
| Exclusions | Ingest denylist plus output filter test plus report endpoint | Defense in depth for FR-025 | Manual review only |

## Verified during planning
- Reachable: 2024 Gazetteer counties, places and ZCTA zips; ZCTA↔county and ZCTA↔place relationship files; archive.org availability endpoint.
- Place file columns: `USPS, GEOID, ANSICODE, NAME, LSAD, FUNCSTAT, ALAND, AWATER, ..., INTPTLAT, INTPTLONG`. Relationship file is pipe-delimited with a BOM.
- Not reachable: ZCTA→congressional district file (404 at the guessed path); archive.org CDX endpoint.
- Place file has no population; population needs another source (Census population estimates) and is optional.

## Verified Census file formats (T104)
- Gazetteer files are tab-separated; `counties` has USPS, GEOID, NAME, INTPTLAT, INTPTLONG; `place` adds LSAD and FUNCSTAT; `zcta` has GEOID only (no state). The last header cell can carry trailing spaces, so cells are trimmed.
- Relationship files are pipe-delimited with a UTF-8 BOM. Rows with an empty `GEOID_ZCTA5_20` describe land outside any ZCTA and are skipped. Share = `AREALAND_PART / AREALAND_ZCTA5_20`.
- A ZIP's state is taken from the county covering most of its land.
