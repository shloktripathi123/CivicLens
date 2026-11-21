# Research: CivicTrail (004)

All endpoints below were requested on 2026-10-11 and the result is recorded. "Unverified" means not reachable or not confirmed, and is therefore not relied on.

| Need | Source | Result | Decision |
|---|---|---|---|
| Address → districts | U.S. Census Geocoder `geographies/address` (`layers=all`) | **Verified.** For a Salem, OR address it returned: 120th Congressional Districts, 2026 State Legislative Districts Upper and Lower, Unified School Districts, Counties, Incorporated Places, ZCTA, Census Tracts/Blocks | Use for address resolution (FR-001). Proxied server-side; address never stored or logged (FR-002). Public domain. |
| ZIP → districts | Census geocoder cannot take a ZIP alone. Census ZCTA→district relationship file (003 research) returned 404 earlier | **Unverified** | Resolve ZIP by geocoding the ZCTA internal point (in our `place` table) to get a primary district set, and report the ZIP as *possibly split* using block-level ZCTA/district overlap when available. Until verified, a ZIP page shows "districts may vary within this ZIP; enter an address" and lists only the state delegation as certain. |
| Federal bills | congress.gov API (`api.congress.gov`, 200) needs a free key; GovInfo BILLSTATUS bulk XML (`govinfo.gov/bulkdata/BILLSTATUS`, 200) needs none | **Both reachable.** | Use GovInfo BILLSTATUS bulk XML (no key, official, includes status actions, sponsors, text links). Congress.gov API is optional enrichment once a key exists. |
| Federal roll-call votes | Senate `senate.gov/legislative/LIS/roll_call_votes/...xml` (200); House `clerk.house.gov/evs/<year>/rollNNN.xml` (200) | **Verified.** | Ingest official XML; per-member positions map to bioguide IDs we already hold (Senate uses LIS IDs; map through congress-legislators `lis` ids; House XML carries bioguide). |
| Oregon bills, votes, sponsors, history, committees, meetings | Oregon Legislature OData `api.oregonlegislature.gov/odata/odataservice.svc` | **Verified.** Entity sets: Measures, MeasureSponsors, MeasureHistoryActions, MeasureVotes, MeasureDocuments, Committees, CommitteeMeetings, CommitteeAgendaItems, CommitteeMembers, Legislators, LegislativeSessions | Primary Oregon adapter. Official, structured, no key. Covers legislative meetings too (FR-008 for the legislature). |
| Oregon registration / deadlines | `sos.oregon.gov/voting/Pages/voteinoregon.aspx` | **404**, URL guess wrong | Do not guess. Phase B research task locates the live Oregon SOS and Elections Division pages, then stores each deadline with its exact URL and retrieved date. Until then the UI shows "Not verified" + link to `sos.oregon.gov/elections`. |
| Federal voting hub | `vote.gov` | 403 to curl (bot block), likely fine in browsers | Link to it as an official resource without scraping. Deadlines are never scraped from it. |
| County/city/school/special district officials | No national official dataset | **No single source** | Oregon first via county/city official websites and the Oregon SOS local government database if verified. Everything else is a labeled gap with the body's official URL. Never fill with third-party guesses. |
| Public meetings (local) | Per-body sites, often Granicus/Legistar/CivicPlus | Not surveyed | Phase C: survey Legistar (`webapi.legistar.com`) for Portland/Multnomah and fall back to "Not published". Verify before adopting. |
| AI summaries | Provider TBD | n/a | Provider-agnostic interface; disabled until a key is configured (FR-009, FR-011). |

## Key design findings

1. **The geocoder resolves the P1 gap with official data**, but only for addresses. ZIP precision is honestly limited; the spec's "split ZIP" requirement is met by showing multiple districts when overlap data supports it and a warning otherwise.
2. **Oregon is the right first end-to-end state**: its legislature API provides bills, votes, sponsors, status history, committees and meetings in one official source.
3. **Bill status must be modeled, not inferred from text.** Oregon provides `CurrentLocation`/`ChapterNumber` (an assigned chapter number means enacted) and federal BILLSTATUS provides `latestAction` and a "Became Public Law" action. The adapter maps source signals to the fixed status set; unmapped signals fail ingest loudly rather than defaulting to "enacted".
4. **AI verification is mechanical**: extract numbers, dates, proper nouns and bill IDs from the summary and require each in the source text. Anything else is suppressed.
