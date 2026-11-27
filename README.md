# Civic Lens

Civic Lens is a civic information search application for people, places,
elections, legislation, and local government. Data coverage varies by source
and jurisdiction; consult the app's coverage and source information.

[Live demo](https://civic-lens-web.reachshlok.workers.dev/) ·
[Source code](https://github.com/shloktripathi123/CivicLens)

Search by name or place from the home page, browse people and races, or explore
elections, bills, and available local-government records. Source links and
coverage notes explain where information comes from and what is missing.
Civic Lens is not an official voter guide; confirm election details with your
state election office.

Open States ingestion can provide recent bills and legislators across the
states, including Oregon when its separate OData feed is excluded. Its bill
feed is limited by API access, rate limits, and the number of pages ingested;
missing records do not mean no bills exist. Open States bill law status is
shown as unverified, not guessed from a passage date. Open States does not
provide term start dates in the current-role feed, so those dates are shown as
not provided and year-filtered searches omit them. The Census unified
school-district dataset covers all states, but does not include every kind of
school district or local-government officeholder.

## Local development

Requirements: Node.js 22.13 or later and npm. Ingestion downloads public data
from several upstream services and may take a long time or encounter rate limits.
The database is not included in the repository.

```bash
git clone https://github.com/shloktripathi123/CivicLens.git
cd CivicLens
npm ci
cp .env.example .env
# Optionally edit .env to add API keys.
node --env-file=.env --import tsx apps/ingest/src/main.ts
```

For fuller local data, obtain keys from [Congress.gov](https://api.congress.gov/sign-up),
the [FEC via Data.gov](https://api.data.gov/signup/), and
[Open States](https://open.pluralpolicy.com/api/register/), then put them in
`.env`. A keyless ingest is incomplete; the FEC demo key is rate-limited.
The snapshot workflow described below requires all three keys.

Ingestion rebuilds portions of the database and deletes existing records.
Back up any database you want to keep before running it. The default database is
`data/civic.db`; use an absolute `DB_PATH` if choosing another location, so
commands run from different directories use the same database. If you already
copied an older `.env.example`, remove the relative `DB_PATH=data/civic.db`
line to use the default. LegiScan ingestion is currently unavailable because
its adapter has not been implemented.

Run the API and web app in separate terminals:

```bash
npm run dev:api       # http://localhost:4000
npm run dev:web       # http://localhost:3000
```

Alternatively, `./run.sh` starts the API and web app on ports 4000 and 3100.
It requires `lsof` and `curl`, loads `.env` for the API, and refuses to start
if either port is in use. Open http://localhost:3100 and press Ctrl+C in the
terminal to stop it.

The npm development commands do not load the root `.env` file. If you changed
`DB_PATH`, supply the same absolute value to the API process, for example
`DB_PATH=/absolute/path/to/civic.db npm run dev:api`. The web app defaults to
the local API in development; set `NEXT_PUBLIC_API_URL` if it is elsewhere.
Do not commit `.env` or other credentials.

## Validation

```bash
npm run typecheck
npm test
npm run test:ci
npx playwright install chromium
npm run test:e2e
NEXT_PUBLIC_API_URL=https://example.com npm run build -w @civic/web
```

The test suite requires a populated default `data/civic.db`, including data
from sources that require API keys. Some tests skip without it; others fail or
create an empty database. Some integration assertions also depend on historical
2026 records and comprehensive source coverage, so a fresh or rate-limited
ingest does not necessarily satisfy them. The full suite runs test files
sequentially to reduce interference with its search-latency measurement.
The production web build requires a
public HTTPS API URL; the example above only checks the build and is not a
working deployment.

`test:ci` runs database-independent tests. The Playwright suite starts its own
API and Next.js servers on ports 41941 and 41942, using synthetic data in an
in-memory database; it never touches the local or production database. It covers
representative navigation, searches, filters, records, source dialogs, reports,
missing pages and service errors, not every possible jurisdiction or dataset.
The existing recorded walkthrough remains available with the original
`playwright.config.ts`.

People search's office-type filter includes candidates for recognized offices
and state legislators in the corresponding chamber. Coverage still depends on
the offices and candidacies present in the selected database snapshot.

Federal election cycles advance when data is ingested. Federal races are
inferred from known office terms and may be incomplete, especially for vacant
seats. FEC filings without a matching scheduled race are omitted rather than
used to infer a contest. The ingest does not provide comprehensive state or
local races, including governor races.
Election information is not a substitute for an official sample ballot.

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

## GitHub Actions CI and deployment

Pull requests and pushes to `main` run type checking, database-independent
tests, a production web build and the isolated Playwright suite. Pushes to
`main` deploy both Workers only after CI passes. Pull requests never receive
deployment credentials. GitHub Actions must be enabled; the workflows have not
configured your repository's secrets or Cloudflare resources for you.

1. Review [third-party data terms](DATA_SOURCES.md) before publishing any database or generated
   assets. GitHub Actions artifacts in a public repository may be downloadable
   by people with repository access. Do not approve the snapshot workflow until
   you have the necessary rights for **every** included dataset. The project
   license does not grant those rights.
2. In your repository's **Settings → Environments**, configure `data-snapshot`
   with secrets `CONGRESS_API_KEY`, `FEC_API_KEY`, and `OPENSTATES_API_KEY`.
   Restrict who can dispatch and approve this environment. Configure
   `production` with secrets `CLOUDFLARE_API_TOKEN` and
   `CLOUDFLARE_ACCOUNT_ID`, and a `NEXT_PUBLIC_API_URL` variable containing the
   public HTTPS API origin. The token needs permission to deploy both Workers
   and access the configured D1 binding. Never commit or share the keys.
   Protect the environments and `main` branch so only trusted maintainers can
   change code, snapshot selection, and deployment settings.
3. The snapshot workflow must exist on `main` before it can be dispatched. On
   the first merge that adds it, there is no snapshot yet: the deployment job
   fails safely before deploying because `CIVIC_DB_RUN_ID` is missing. Once
   rights are verified, merge the workflow, then manually run **Publish data
   snapshot** on `main` from the repository's **Actions** tab. Affirm the rights
   confirmation only after checking every included dataset, and approve the
   `data-snapshot` environment if required.
4. The workflow freshly ingests data, checks integrity, citations and minimum
   coverage, rejects correction submissions, and uploads a 90-day
   `civic-lens-db` artifact. These checks do not prove complete or current data
   or redistribution rights; inspect ingestion logs and coverage. It excludes
   Voteview, Wikipedia's governor roster, Oregon Legislature OData, and the
   curated local-government dataset. Governor and local-government coverage
   will be reduced; Open States can supply Oregon legislative records, and
   Census unified school districts remain available nationwide. Other sources
   still require a rights review. Local ingestion
   retains its defaults unless `SKIP_VOTEVIEW=1` and
   `SKIP_UNREVIEWED_SOURCES=1` are set. These options do not remove existing
   records; use a fresh database. The deployment validator rejects databases
   containing any of the excluded sources.
   Set the
   `production` environment variable `CIVIC_DB_RUN_ID` to the numeric run ID
   of the successful approved snapshot (shown in its Actions URL). Then rerun
   the failed deployment job from that `main` run, or push a new commit to
   `main` after configuration.
5. A push to `main` checks the pinned run's workflow, branch, event and success,
   downloads its artifact, verifies its checksum and reruns the database checks.
   The job fails explicitly if configuration or the artifact is missing or
   expired; create and select a new snapshot before its 90-day retention ends.
   Snapshot pinning deliberately keeps data unchanged between code deployments.

CI deploys API assets built from the approved snapshot, but **does not import or
replace the remote D1 database**. That database stores correction reports;
back it up and manage its schema and any manual imports separately. The Worker
checks pending exclusion reports on each API read and fails closed if D1 cannot
be queried, which adds D1 reads and may affect quota or cost. A failed web
deployment after a successful API deployment can leave versions mismatched;
check both deployment steps and retry after correcting the failure.

## Data and licensing

The project code is licensed under the [Apache License 2.0](LICENSE).
Upstream datasets, images, and other third-party material may have separate
terms; see [data sources and reuse](DATA_SOURCES.md). The local database and
downloaded data cache are not included in the repository.
