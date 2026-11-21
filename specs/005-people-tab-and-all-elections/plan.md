# Implementation Plan: People Tab, All Elections, Major Figures (005)

**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md) · **Data model**: [data-model.md](./data-model.md) · **Quickstart**: [quickstart.md](./quickstart.md) · **Builds on**: 001–004

## Summary
Add a People tab (people-only search), ingest presidents, vice presidents, governors, cabinet, judges and other major figures into the existing person model, and expand Races to every election level with honest coverage reporting. The UI and UX do not change: new pages use existing components and CSS classes only.

## Technical Context
Same stack: TypeScript, npm workspaces, SQLite (`node:sqlite`), Fastify, Next.js 15, node test runner. No new runtime dependencies. New adapters: `executive.json` (CC0), Wikidata SPARQL (CC0, needs a User-Agent), OpenFEC (key optional, resumable on `DEMO_KEY`).

## Guardrails (enforced by tests)
- UI parity (SC-006): a test diffs `globals.css` and checks that the only layout change is the added nav link; new pages may use only existing class names (a test scans the new files' `className` values against the stylesheet).
- Every fact graded and cited; Wikidata graded C; nothing invented; unknown shown as a labeled gap.
- Exclusions apply to all new data (never read spouse, children, residence properties).
- Neutral ordering.
- All 45 existing tests keep passing at every phase.

## Key Decisions
1. **People page = existing search in person-only mode.** `/people` (index) renders `Search` with `kind="person"`; `/people/[id]` is unchanged. API adds `GET /v1/people?q=&officeType=&status=&party=&state=` (a thin wrapper over the existing search with the new filters). Nav gets one "People" link via `MainNav` (active on `/people/*`).
2. **One person, many roles.** Adapters write identifiers first and merge on any matching identifier (R1: `bioguide`, `wikidata`, `fec`). `office_term` carries every role with dates, so Trump has two `prez` terms plus candidacy rows.
3. **Roster as the completeness contract.** `data/roster.json` plus a test that resolves each entry through the search function (SC-002, FR-014). The test is the guardrail against "left out" figures; adding a name to the roster makes the build fail until the person is ingested.
4. **Elections in three honest tiers** (research R4): structural calendar for all jurisdictions, candidates where an authoritative source exists, labeled gaps everywhere else, with official authority links.
5. **Races page** keeps its current look: a ruled list. It gains grouping headings (cycle → level) and filter links, using existing `h2`, `.results` and `.chip` classes, with pagination links at 50 rows.
6. **Coverage page** reads `coverage_category` and shows loaded, expected and gap per category, reusing its existing table styles.
7. **Resumable ingest.** FEC and Wikidata adapters store a cursor in a small `ingest_state` table; rate-limit responses pause and resume instead of failing the run.
8. **Name matching.** Aliases from Wikidata and the executive file are normalised the same way as existing names; ranking stays exact > prefix > substring, tie-break alphabetical (neutrality, FR-018).

## Phases

### Phase A — People tab (P1, smallest vertical slice)
1. `office_type` backfill migration; `GET /v1/people` with filters; contract test.
2. `/people` page and nav link; a11y test extension; UI-parity test.
3. Done when: SC-001 passes for the legislators already loaded; home search unchanged.

### Phase B — Executive branch figures (P1)
1. `executive.json` adapter with identifier merge; GRADINGS entry; tests for Trump (two presidential terms), Biden (senator + VP + president on one profile), Obama, Harris, Vance.
2. Roster file seed with presidents/VPs; roster test.
3. Done when: roster test passes for presidents and vice presidents.

### Phase C — Wikidata figures: governors, cabinet, justices, leadership (P1)
1. SPARQL adapter with pinned position QIDs, paced requests, `ingest_state` cursor; grade C GRADINGS entry; exclusion-safe property allow-list.
2. Roster extended to the full seed set (governors for 56 jurisdictions, cabinet, nine justices, leadership); roster test is the acceptance gate.
3. Where an official page confirms a role, add the second citation.
4. Done when: SC-002 passes with 0 missing.

### Phase D — Federal races and candidates (P1)
1. Migration for `election.cycle/level`, `measure` type, `race.stage/candidates_status/how_filled`.
2. Structural calendar: presidential race (2028), every Senate seat in the cycle, every House district, every governor seat, all with `candidates_status = not_loaded` until candidates arrive.
3. OpenFEC candidate adapter (resumable, `DEMO_KEY` safe), linking candidates to existing people by `fec` or name+state+office; incumbents flagged from terms.
4. Done when: SC-003 holds (races exist for every seat; candidates for as many as the key allows).

### Phase E — Races UI and state/local tiers (P1)
1. Races index: filters by cycle, level, office type, state; pagination; gap rows with authority links from `jurisdiction_authority`.
2. Race page: how filled, stage, incumbent flag, candidate links, citations.
3. State candidate adapters, one per state, added incrementally as sources are probed (Oregon already exists).
4. Done when: SC-004 and SC-005 hold; every jurisdiction in Coverage.

### Phase F — Coverage and verification (P2)
1. `coverage_category` writer at ingest end; Coverage page section.
2. Link-check the authority list; final regression, a11y, parity and latency tests.

## Project Structure (additions)
```
apps/
  api/src/        people.ts (filters), races.ts (list, filters)
  ingest/src/     executive.ts, wikidata.ts, fecElections.ts, calendar.ts, authorities.ts
  web/app/people/page.tsx          (new index page; [id] unchanged)
  web/components/MainNav.tsx       (add one link)
data/
  roster.json                      (major-figure contract)
  wikidata-positions.json          (pinned position QIDs)
  authorities.json                 (official election-authority links)
tests/
  contract/people.test.ts, contract/roster.test.ts, contract/races.test.ts
  web/ui-parity.test.ts
specs/005-people-tab-and-all-elections/
```

## Risks and Mitigations
| Risk | Mitigation |
|---|---|
| No single open dataset for "every election" | Three tiers + Coverage page; gaps are labeled, never hidden (R4) |
| Wikidata quality and vandalism | Grade C with popup; pinned position QIDs; official cross-citation; roster test catches wrong/missing entries |
| FEC rate limit on `DEMO_KEY` | Resumable cursor; owner supplies a real key for a full load |
| UI drift while adding pages | UI-parity test (class names against stylesheet, nav diff) |
| Duplicate people after merges | Identifier-based merge with logged merges and tests for Biden/Harris/Vance |
| Defamation/inaccuracy on public figures | Only cited facts; exclusions allow-list for properties; correction reports apply |
