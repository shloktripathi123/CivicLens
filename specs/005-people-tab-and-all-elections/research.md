# Research: People Tab, All Elections, Major Figures (005)

Probed 2026-10-11 with curl/node (Python SSL fails on this machine).

## R1. Presidents and vice presidents
- **Decision**: ingest `https://unitedstates.github.io/congress-legislators/executive.json` (same CC0 project as the legislator data, already graded).
- **Evidence**: returns 80 people; last entries Biden, Obama, Pence, Trump, Harris, Vance; each has `terms[]` with `type` (prez/viceprez), `start`, `end`, `party`, `how`.
- **Consequence**: Trump, Biden, Obama, Harris, Vance are covered with dated roles and no new licence. Some people also appear in `legislators-*.json` (Biden, Harris, Vance); they are matched by `bioguide`/`id` fields and merged into one person (FR-005).

## R2. Governors, cabinet, judges, state/local leaders
- **Decision**: Wikidata via SPARQL (CC0), restricted to position-held statements with start/end qualifiers; every row stores the Wikidata QID as an identifier and the entity URL as the citation. Cross-check against official pages for the roster (R5).
- **Evidence**: `https://query.wikidata.org/sparql` answered a position-held query with JSON. A User-Agent header is required. (The probe's position ID was a placeholder; real position QIDs are resolved in the adapter by label search and pinned in a config file with a test.)
- **Grade**: Wikidata is crowd-edited, so it gets grade C ("Lower") under the existing rubric, shown with the popup like any C source. Items that also appear on an official page (R5) are cited to that page too, and the official page is graded B or A.
- **Rejected**: scraping Wikipedia HTML (licence and fragility); paid political-data APIs (licence cost, not in repo budget).

## R3. Federal races and candidates
- **Decision**: FEC OpenFEC API (`/candidates`, `/candidates/search`, `/election-dates`).
- **Evidence**: `https://api.open.fec.gov/v1/candidates/search/?api_key=DEMO_KEY&q=trump` returned data. `DEMO_KEY` is rate limited (about 30 requests per hour), so a real key is still required for a full load; the adapter paces requests and resumes from a cursor table so it can finish on the demo key slowly.
- **Consequence**: presidential, Senate and House candidates come from one source. Incumbent flag from FEC `incumbent_challenge`. Office terms from legislators data reconcile the incumbent.

## R4. State and local elections
- **Decision**: three tiers, all measured on the Coverage page.
  1. **Calendar tier (all 50 states + DC + territories)**: one `election` row per jurisdiction per cycle from FEC election dates and state election-authority pages, one `race` row per seat from structure we can derive for certain (every House district, every Class Senate seat, every governor seat), no candidates invented.
  2. **Candidate tier**: candidates where an authoritative open dataset exists. Ballotpedia is not machine-usable under its terms; the Democracy Works / Google Civic style APIs need keys. Chosen first targets: the Oregon SOS (already in), then states that publish open candidate lists (to be probed per state during the phase, each as a separate small adapter).
  3. **Gap tier**: every jurisdiction without candidates shows a labeled gap with its official election-authority link (FR-012). The link list is authored once from the National Association of Secretaries of State directory and link-checked.
- **Why**: "every election in the US" has no single open dataset. Tier 1 gives full structural completeness truthfully; tier 2 raises candidate depth state by state; tier 3 keeps honesty. Coverage page shows loaded vs expected per tier.

## R5. The major-figures roster
- **Decision**: `data/roster.json`, authored by the owner team, with `name`, `role_category`, `must_have_office_label`, and optional `wikidata`/`bioguide` id. The roster test resolves each entry through the people search and fails on a miss (FR-014).
- **Seed**: presidents/VPs (from R1), the 100 senators and 435 House members (from existing data), sitting governors of 56 jurisdictions, cabinet-level officers, nine Supreme Court justices, congressional leadership. Every seed entry cites an official page in the roster for the cross-check.

## R6. People-only search
- **Decision**: reuse the existing `search()` in `apps/api/src/search.ts` by adding a `kind=person` restriction and the new filters (`officeType`, `party`, `state`, `status`); no new ranking logic beyond adding aliases to `person_name`. The new page `/people` reuses `Search.tsx` with a prop that selects person-only mode.
- **Why**: FR-003 and SC-006 require UI parity; reusing the component guarantees the same markup and styles.

## R7. Performance with thousands of races
- Index `race(election_id)`, `race(office_id)`, `office(level, jurisdiction)`. Races page paginates by cycle then level, 50 per page, server rendered, links as plain anchors (works without JS).
