# Quickstart: Place Search & Sourcing (target behavior)

1. `npm run ingest` loads officials, candidates and, from Phase A, `ingest:places` (Census Gazetteer + ZCTA relationship files, downloaded and cached under `data/cache/`).
2. `npm run dev:api` and `npm run dev:web`.
3. Search "Portland": the Places group offers Portland, OR and Portland, ME. Open Portland, OR: federal delegation, Oregon races, and clearly labeled gaps for state, county and city levels with official-site links.
4. Search "97201": a ZIP page marked approximate lists the county and cities it overlaps.
5. Search "Springfield": every Springfield is listed with state and type.
6. Open any profile: every section shows Sourced, Sourced (lower credibility), Not found, or Not yet checked, and each fact links to its source.
7. Click a credibility badge: a popup shows the grade, each criterion and its result, the reason, the rubric version, and links to the rubric and source.
8. `npm test`: golden place suite, citation and section-state contract tests, exclusion test.
