# Research: Candidate & Election Search

| Topic | Decision | Rationale | Alternatives |
|---|---|---|---|
| Person identity | Reuse 001 `person`; add candidacy rows | One profile for officials and candidates | Separate candidate table (duplicates, e.g. Kotek) |
| Federal candidates | FEC OpenFEC API (candidates, committees, totals) | Authoritative and free with an api.data.gov key | Scraping |
| State candidates | Per-state Secretary of State filing lists, starting with Oregon (ORESTAR / SOS candidate filings) | Authoritative, satisfies FR-004 | Aggregators (licensing unclear) |
| Ballot data | Evaluate Google Civic, Democracy Works, Ballotpedia licenses before Phase B | Coverage vs. cost and terms | Build only from filings |
| Presidential | FEC filings plus the state primary ballot lists | Formal filing gate | Media declarations (speculative) |
| Background | Wikidata plus official bios, with provenance | Structured education and career | Wikipedia scraping |
| Agenda | Crawl campaign site issue pages and store text, URL and capture date; no summarizing or rewriting in v1 | Avoids editorializing | LLM summaries (bias risk, later with labels) |
| District lookup | Server-side lookup from census geography data | Privacy; no third-party leak of addresses | Client-side calls to vendors |
| Ordering | Alphabetical by last name | Neutral and explainable | Polls, funding (implies ranking) |

Unverified items (must be confirmed during implementation, not assumed): exact Oregon SOS data export format and URL; ballot vendor licenses; FEC rate limits.
