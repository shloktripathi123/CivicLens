# Implementation Plan: Public Official Search (Civic Lens)

**Branch**: `001-legislator-search` | **Date**: 2026-10-11 | **Spec**: [spec.md](./spec.md)

## Summary

A name-search-first civic information product covering current and former U.S. public officials (federal → state → county/local) with profiles, bills, votes, background, affiliations, funding and sourced ratings. Delivered as a Next.js web app plus an Expo (React Native) iOS/Android app, both consuming one public read-only REST API. A batch ingestion pipeline normalizes public data sources into PostgreSQL; search runs on Postgres (trigram + full-text), with provenance (source + as-of date) stored on every fact.

## Technical Context

- **Language**: TypeScript everywhere (Node 20 LTS).
- **Monorepo**: pnpm workspaces + Turborepo.
- **Web**: Next.js (App Router, SSR/ISR for shareable, SEO-friendly profile pages).
- **Mobile**: Expo / React Native (iOS + Android), shared UI logic, API client, and types with web via `packages/`.
- **API**: Fastify + OpenAPI (zod-derived schemas); read-only public endpoints; generated typed client.
- **Storage**: PostgreSQL 16 (`pg_trgm`, `unaccent`, `tsvector`), Redis for response/suggest cache. Object storage + CDN for photos.
- **Ingestion**: Node workers on a scheduler (daily; hourly for votes during session), idempotent upserts, per-source adapters, raw payload archive for audit.
- **Testing**: Vitest (unit), Playwright (web E2E + axe a11y), Detox or Maestro (mobile smoke), contract tests against OpenAPI, adapter tests with recorded fixtures, search-quality golden set.
- **Target platforms**: Modern browsers, iOS 16+, Android 8+.
- **Performance goals**: suggest p95 < 300 ms; profile p95 < 2 s; data freshness ≤ 24 h federal (spec SC-002, SC-005).
- **Scale**: ~20k+ historical federal members, ~7.4k current state legislators (+ historical), hundreds of thousands of local officials, millions of votes/bill actions. Comfortably within a single Postgres with partitioning for votes.
- **Constraints**: no accounts/PII (FR-017); nonpartisan; every fact has provenance (FR-011); WCAG 2.1 AA (FR-016).

## Constitution Check

No project constitution exists yet (no `.specify/` memory). Applied defaults: simple architecture (one API, one DB), test-first for search quality and adapters, provenance as a hard invariant, no editorial scoring. Re-check once a constitution is added.

## Architecture

```
 Public sources ─► adapters (per source) ─► raw archive
                         │ normalize + entity resolution
                         ▼
                    PostgreSQL ◄── search index (pg_trgm/FTS)
                         ▼
                 Fastify REST API (+Redis cache, CDN)
                    ▲                ▲
              Next.js web      Expo iOS/Android
```

### Data sources (by phase)

| Phase | Level | Sources |
|-------|-------|---------|
| 1 | Federal current + historical | `unitedstates/congress-legislators` (bios, terms, IDs, social, committees, back to 1789), Congress.gov API (bills, sponsors, summaries, actions), GovInfo (text links), Senate.gov/Clerk.house.gov roll-call XML, Voteview (historical votes), OpenFEC (finance), House/Senate financial disclosure sites, Wikidata (bio, education, photos w/ license) |
| 2 | State | Open States API/bulk data (legislators, bills, votes), state campaign-finance portals / FollowTheMoney (OpenSecrets/NIMSP data via licensed or open dumps) |
| 3 | County/local + executive | Open Civic Data IDs (OCD-IDs), Census/Google Civic-style official directories, municipal open-data portals; executive departments via official org charts (USA.gov/PlumBook/agency sites) |
| Later | Judiciary | Federal Judicial Center biographical database, CourtListener |
| Ratings | Cross-cutting | Voting-record ratings published by a balanced documented set of orgs; each requires permission/licence check, publisher + year + methodology link stored (FR-023) |

Each adapter implements `fetch → normalize → upsert` with `source_id`, `retrieved_at`, `as_of`. Licensing/ToS is reviewed per source before enabling (see research.md).

### Search design

- Person-level index: `canonical_name`, `name_variants` (nicknames, maiden, diacritics-stripped, "Last, First"), plus facets (level, body, state, party, status, years active).
- Query: `unaccent(lower(q))` → trigram similarity + prefix + nickname map (e.g., Bernie→Bernard); ranked by exact > prefix > similarity, then current-over-former and office prominence as tie-breaks (documented, non-partisan).
- Suggest endpoint is cache-backed and capped to 8 results.
- Upgrade path to Typesense/OpenSearch if golden-set quality or latency targets fail (decision gate in Phase 1).

### Key design decisions

1. **One Person, many Offices**: entity resolution links the same human across levels (via bioguide, FEC, OpenStates, Wikidata IDs) to build the unified timeline (FR-020).
2. **Provenance on every fact**: `fact` rows/columns carry `source_id` + `as_of`; API responses include a `sources` block; UI components refuse to render a fact without it (SC-004).
3. **Coverage model**: `coverage(person|jurisdiction, section, status)` computed by ingestion; drives the coverage indicator (FR-022) and "Not available" states (FR-018).
4. **Plain-language summaries**: use official CRS summaries; if generated, flagged `generated=true` and labeled in UI.
5. **Nonpartisan guardrails**: no app-computed scores except neutral stats (missed-vote %, shared-vote agreement, with method shown); ratings only from labeled publishers.
6. **Cross-platform sharing**: `packages/api-client`, `packages/domain` (types, formatters), `packages/ui-tokens`; web and mobile have separate view layers.

## Project Structure

```
specs/001-legislator-search/   spec.md plan.md research.md data-model.md quickstart.md contracts/
apps/
  web/            Next.js
  mobile/         Expo
  api/            Fastify
  ingest/         workers + adapters/
packages/
  domain/         shared types, name normalization, formatting
  api-client/     generated from contracts/openapi.yaml
  db/             migrations, queries
tests/
  contract/  search-golden/  e2e-web/  e2e-mobile/  fixtures/
```

## Phasing (answers spec open questions)

- **Phase 0 – Foundations**: monorepo, DB schema, CI, provenance + coverage model, OpenAPI contract, search golden set.
- **Phase 1 – Federal MVP (P1 stories)**: congress-legislators + Congress.gov + roll-call ingestion; name search, profile, background; web first, mobile shell with search+profile in the same phase.
- **Phase 2 – Bills, votes, funding, affiliations (P2 stories)**: filters, OpenFEC, disclosures, caucuses, ratings (after licensing review).
- **Phase 3 – Historical depth**: all Congresses since 1789 (members/terms/votes via Voteview); depth for state/local limited to what sources provide.
- **Phase 4 – State legislators** (Open States), unified timelines.
- **Phase 5 – County/local + executive departments**, coverage-driven rollout by jurisdiction.
- **Phase 6 – Compare/share polish (P3)**, a11y audit, store releases. Judiciary after.

Native app tech decision: Expo/React Native (shared TypeScript, single team, store builds via EAS).

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| "Everything" local data doesn't exist in structured form | Phased, coverage indicators, per-jurisdiction adapters, community-contributed adapter template |
| Source licensing (ratings, finance, photos) | Licence review gate per source; store licence + attribution; prefer public-domain/open sources |
| Name entity-resolution errors across levels | Deterministic ID joins first; fuzzy matches go to a review queue, never auto-merged |
| API rate limits/outages | Cached raw archive, backoff, stale-data banner with last-updated (FR-014/018) |
| Perceived bias | Neutral stats only, published methodology, balanced ratings set |
| Search quality regressions | Golden-set CI test (SC-001) |

## Complexity Tracking

No constitution violations. Added complexity (monorepo, separate ingest service) is justified by two client platforms and multi-source ingestion.
