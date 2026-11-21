# Implementation Plan: CivicTrail (004)

**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md) · **Data model**: [data-model.md](./data-model.md) · **API**: [contracts/openapi.yaml](./contracts/openapi.yaml) · **Builds on**: [001](../001-legislator-search/plan.md), [002](../002-candidate-search/plan.md), [003](../003-place-search-and-sourcing/plan.md)

## Summary
Extend the shipped app (people, candidates, places, sourcing, exclusions) into six areas: My Representatives (address/ZIP → all levels), Government Explorer, Elections and Voting, How Government Works, Bills and Decisions, Learn Civics. Add bills/votes/meetings from official feeds, verified and labeled AI summaries, authored cited education content, accessibility hardening, and native apps. Preserve all 39 existing tests at every step (FR-018).

## Technical Context
Same stack: TypeScript, npm workspaces, SQLite (`node:sqlite`), Fastify, Next.js 15, node test runner. New: XML parsing for GovInfo/Senate/House feeds (one small dependency, `fast-xml-parser`), OData JSON for Oregon, a provider-agnostic `Summarizer` interface (no provider bundled), `@axe-core/playwright` or `axe-core` for accessibility tests, Expo (React Native) for native in the last phase.

## Constitution / Guardrails (carried from 003, enforced by tests)
- Every fact has a graded source (`uncitedFacts` extended to new tables).
- Exclusions apply to all new data (FR-016).
- Nothing is fabricated: unknown renders as `not_found` / `not_yet_checked`.
- Neutral ordering only (alphabetical or chronological).

## Key Decisions
1. **Audit before change.** Phase 0 turns the spec's audit table into an executable check (`npm run audit`) that prints per-area status from the DB and routes, so each increment shows measured before/after.
2. **Address resolution via the Census Geocoder** (verified, research.md). A server route calls it, maps returned layers (congressional, state upper/lower, school district, county, place) to our offices/bodies, and drops the address after the response. Request logging for that route is disabled by a Fastify route option and tested. ZIP-only searches return `splitCertainty` (`exact` only when all ZCTA area falls in one district).
3. **Bills: two official adapters.** Oregon OData (Measures, Sponsors, HistoryActions, Votes, Documents) and GovInfo BILLSTATUS XML plus Senate/House roll-call XML for federal. Adapters emit raw source signals; a single `mapStatus()` in `packages/domain` converts to the fixed status set and throws on unknown signals (data-model.md table). `isLaw` is derived from status in the database, never from UI.
4. **Votes link to people** via bioguide (House XML) and LIS id (Senate XML) through existing identifiers; unmatched members are kept as unlinked names rather than dropped.
5. **Elections.** `election`/`election_deadline` populated only from verified official pages; deadlines with `verified = 0` render as "Not verified" plus the official office link (US2-3). Oregon SOS page URLs are researched in Phase B (the guessed URL returned 404). Candidate order reuses 002's alphabetical ordering.
6. **Government Explorer content is data, not prose in components.** Bodies/seats come from the adapters (Congress, Oregon Legislature) and from authored `body` rows for the rest, each with `content_citation` rows. A build-time test fails any body or guide paragraph without a citation. Bodies without verified content render the member list (if known) plus a gap.
7. **AI summaries.** `Summarizer` interface with `summarize(text) → {text, model, version}`; a deterministic `verifySummary(summary, sourceText)` checks that every number, date, bill ID and capitalized entity appears in the source; failures are stored and never served. With no provider configured the feature is off and the UI shows the official summary. The label "AI-generated summary", model, date and source link are rendered by one component, `AiSummaryBox`, styled distinctly from official data and containing a link to the exact source text.
8. **Education content** authored in `content/guides/*.md` with front-matter (reviewer, last_reviewed, citations) and ingested into `guide`/`glossary_term`. A lint step computes a Flesch-Kincaid grade (target ≤ 9) and checks citations and neutrality word-list flags (e.g. loaded terms). Jurisdiction-specific blocks are filled from `voting_resource`/`election_deadline` when a place is chosen.
9. **Navigation.** Six top-level areas map to routes: `/representatives`, `/explore`, `/elections`, `/how-it-works`, `/bills`, `/learn`. Existing routes (`/`, `/people`, `/candidates`, `/places`, `/races`, `/rubric`, `/sources`, `/coverage`, `/exclusions`) stay as they are.
10. **Accessibility.** A shared test walks every route with axe at 360 px and 1280 px, asserting zero serious/critical violations (SC-005), plus a keyboard-only Playwright flow for the six area home pages. A no-JS check fetches pages as HTML and asserts the core content is present (FR-014).
11. **Native.** Expo app in `apps/native` consuming the same API and shared types from `packages/domain`; built last, with a parity checklist test (same labels/status strings from a shared constants file).

## Project Structure (additions)
```
apps/
  api/src/        representatives.ts, bills.ts, elections.ts, bodies.ts, meetings.ts, guides.ts, summaries.ts
  ingest/src/     oregon-leg.ts, federal-bills.ts, federal-votes.ts, elections.ts, bodies.ts, guides.ts
  web/app/        representatives/, explore/, elections/, how-it-works/, bills/, learn/
  native/         (Phase F)
packages/domain/src/  billStatus.ts, summaryVerify.ts, readability.ts
content/guides/       *.md (authored, cited)
specs/004-.../        spec, plan, research, data-model, contracts, quickstart, tasks
```

## Phases (each ends with all tests green)
| Phase | Delivers | Exit test |
|---|---|---|
| **0 Audit & section states** | `npm run audit`; `section_state` table (finishes T129); a11y test harness on existing routes (record baseline) | existing 39 pass; audit output committed to quickstart |
| **A My Representatives** | Address route + UI; ZIP `splitCertainty`; levels with labeled gaps; federal + Oregon state legislators matched by district | golden test of 10 known addresses vs. geocoder output; privacy test (no address in logs/DB) |
| **B Bills & votes (Oregon + federal)** | Adapters, `mapStatus`, bills pages, person bills/votes, enacted vs proposed styling | status-mapping table tests; SC-004 test; citation gate on new tables |
| **C Elections & Voting** | election/deadline/resource model; Oregon verified resources; elections pages | unverified deadline never rendered as a date (test) |
| **D Explorer + How It Works + Learn** | bodies, guides, glossary, readability + citation lint | lint passes; every paragraph cited |
| **E AI summaries** | Summarizer interface, verifier, `AiSummaryBox`; stays off without a provider | verifier unit tests incl. fabricated number rejected; label always present |
| **F Meetings (local) + native** | Legistar/Oregon local meeting adapters where verified; Expo app | parity checklist; per-adapter research gate before adopting |

## Risks
- **ZIP precision**: no verified ZIP→district file; mitigated with honest `possibly_split` and address prompt.
- **Local government data**: no national source; most local levels will be labeled gaps for a long time. Coverage page tracks this (FR-017).
- **AI hallucination**: mitigated by mechanical verification; failures suppressed.
- **Federal data volume**: BILLSTATUS is large; ingest only the current Congress first, with a cache like the FEC disk cache.
- **Name branding**: UI stays "Civic Lens" until the owner confirms (spec assumption).

## Complexity Tracking
No new services. One new runtime dependency (XML parser) and one dev dependency (axe). Native adds Expo, isolated to `apps/native`.
