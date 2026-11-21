# Research & Decisions

| Topic | Decision | Rationale | Alternatives |
|-------|----------|-----------|--------------|
| Native apps | Expo / React Native | Shares TypeScript, API client, domain logic with web; EAS handles store builds | Flutter (no code share with web), separate Swift/Kotlin (2x cost) |
| Web | Next.js App Router | SSR/ISR for fast, indexable, shareable profile URLs | SPA (worse SEO/share previews) |
| API | Fastify + OpenAPI | Fast, schema-first; generates typed clients for web/mobile | GraphQL (more complexity for read-only, cacheable resources) |
| DB | PostgreSQL | Relational model of people/terms/votes; trigram+FTS adequate for name search | Dedicated search engine (kept as upgrade path) |
| Search | pg_trgm + unaccent + nickname table | Meets typo/accent/nickname needs (FR-002) at this scale | Typesense/OpenSearch if golden set or p95 fails |
| Entity resolution | ID-based joins (Bioguide, FEC, Open States, Wikidata, OCD-ID); fuzzy → manual review | Avoids merging different people with the same name | Name-only matching (unsafe) |
| Historical votes | Voteview for pre-modern Congresses | Open, comprehensive since 1789 | Scraping archives |
| State data | Open States | Standardized across 50 states | 50 bespoke scrapers |
| Local data | OCD-IDs + per-jurisdiction adapters, coverage indicators | Honest about gaps | Promise full parity (infeasible) |
| Ratings | Balanced multi-publisher set, licence-gated | FR-012/023 | App-computed scores (violates nonpartisan) |
| Freshness | Daily batch, hourly votes in session | Meets FR-014 | Real-time streaming (unneeded) |
| Accessibility | axe in CI + manual screen reader passes; RN accessibility props | WCAG 2.1 AA | Late-stage audit only |

## Open items to validate during Phase 0
- API keys/ToS/rate limits for Congress.gov, OpenFEC, Open States.
- Licensing for ratings publishers, photo usage, FollowTheMoney/state finance data.
- Historical depth for state/local by jurisdiction (document per-state coverage).
