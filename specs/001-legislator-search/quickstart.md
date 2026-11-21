# Quickstart (target dev flow)

1. `pnpm install`
2. `docker compose up -d postgres redis`
3. `cp .env.example .env` and add keys: `CONGRESS_GOV_API_KEY`, `OPENFEC_API_KEY`, `OPEN_STATES_API_KEY`.
4. `pnpm db:migrate && pnpm ingest --source congress-legislators --fixtures` (fixtures run offline).
5. `pnpm dev` → API :4000, web :3000; `pnpm --filter mobile start` for Expo.

## Validation scenarios (map to spec)

- Search "warrn" → Elizabeth Warren in top 3 (US1, SC-001).
- Search "Bernie" → Bernard Sanders (nickname).
- Open a profile with missing data → "Not available" shown, coverage indicator partial (US2, FR-018).
- Filter bills by topic → list updates; open bill → plain summary + vote (US3).
- Funding tab shows cycle totals with source + as-of (US4, SC-004).
- Search a former member (e.g., 1900s Congress) → profile with timeline (FR-020).
- Compare two members → agreement % + method note (US5).
- Run `pnpm test:golden` (search quality) and `pnpm test:a11y` (axe) in CI.
