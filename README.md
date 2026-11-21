# Civic Lens

Civic Lens is a civic information search application for people, places,
elections, legislation, and local government. Data coverage varies by source
and jurisdiction; consult the app's coverage and source information.

## Local development

Requirements: Node.js 22.13 or later and npm. Ingestion downloads public data
from several upstream services and may take a long time or encounter rate limits.

```bash
npm ci
cp .env.example .env
# Optionally edit .env to add API keys.
node --env-file=.env --import tsx apps/ingest/src/main.ts
```

Ingestion rebuilds portions of the database and deletes existing records.
Back up any database you want to keep before running it. The default database is
`data/civic.db`; `DB_PATH` changes it for the ingest process. LegiScan ingestion
is currently unavailable because its adapter has not been implemented.

Run the API and web app in separate terminals:

```bash
npm run dev:api       # http://localhost:4000
npm run dev:web       # http://localhost:3000
```

Alternatively, `./run.sh` starts the API and web app on ports 4000 and 3100.
It requires `lsof` and `curl` and refuses to start if either port is in use.

The npm development commands do not load the root `.env` file. If you changed
`DB_PATH`, supply the same value to the API process, for example
`DB_PATH=/absolute/path/to/civic.db npm run dev:api`. The web app defaults to
the local API in development; set `NEXT_PUBLIC_API_URL` if it is elsewhere.
Do not commit `.env` or other credentials.

## Validation

```bash
npm run typecheck
npm test
NEXT_PUBLIC_API_URL=https://example.com npm run build -w @civic/web
```

The test suite requires a populated default `data/civic.db`, including data
from sources that require API keys. Some tests skip without it; others fail or
create an empty database. Some integration assertions also depend on historical
2026 records and comprehensive source coverage, so a fresh or rate-limited
ingest does not necessarily satisfy them. The production web build requires a
public HTTPS API URL; the example above only checks the build and is not a
working deployment.

Federal election cycles advance when data is ingested. Federal races are
inferred from known office terms and may be incomplete, especially for vacant
seats. FEC filings without a matching scheduled race are omitted rather than
used to infer a contest. Governor data includes a curated 2026 snapshot; future state and local
races are not comprehensively covered. Election information is not a substitute
for an official sample ballot.

## Cloudflare deployment

The included Wrangler configuration and web environment example refer to an
existing deployment. Before deploying your own copy, provision your own
Cloudflare resources, replace the D1 database ID and worker names in the
configuration, and set `NEXT_PUBLIC_API_URL` to your own API's public HTTPS URL.
`NEXT_PUBLIC_API_URL` is embedded at web build time.

`npm run import:d1` imports `data/civic.db` into the **remote** D1 database
configured in `apps/api/wrangler.jsonc`; inspect the configuration and back up
the target before running it. It requires the SQLite CLI and Wrangler
authentication. `npm run deploy:api` generates API assets from that database
and deploys the API worker. The web worker can then be deployed from `apps/web`
with `npm run deploy`. These commands may modify remote resources and incur
provider charges.

## Data and licensing

The project code is licensed under the [Apache License 2.0](LICENSE).
Upstream datasets, images, and other third-party material may have separate
terms; see [data sources and reuse](DATA_SOURCES.md). The local database and
downloaded data cache are not included in the repository.
