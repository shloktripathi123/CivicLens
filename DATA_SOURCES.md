# Data sources and reuse

The Apache 2.0 license covers this project's code; it does not relicense
third-party datasets, text, photographs, or other materials. The downloaded
database and caches are not distributed in this repository. Check current
provider terms and the rights for the particular material before reuse.

## Snapshot review (November 26, 2026)

This is a source review, not legal advice or confirmation that the complete
snapshot is cleared. The fresh ingest is still in progress. Review its final
source inventory and contents before approving publication; the public database
artifact and generated API assets both distribute derived data. Linked photos
also need review before display, even when their image bytes are not in the
database.

| Included source or material | Evidence and remaining work |
| --- | --- |
| `congress-legislators`, including executive records | The upstream [CC0 dedication](https://github.com/unitedstates/congress-legislators/blob/main/LICENSE) covers the project data. Congress photo URLs point to the separate [unitedstates/images](https://github.com/unitedstates/images) collection, whose maintainers describe its photos as public domain. |
| `census-geography`, `census-school-districts`, `census-county-population` | Census asks users to [cite its data](https://www.census.gov/about/policies/citation.html). These imports use federal geographic and population files; retain the dataset, vintage and source links. Do not assume separately attributed third-party material is covered. |
| `wikidata` | [Wikidata's licensing policy](https://www.wikidata.org/wiki/Wikidata:Licensing) applies CC0 to structured data. The roster imports structured fields, not linked images or other namespace text. |
| `congress-gov-api` | The [Library of Congress](https://www.loc.gov/apis/additional-apis/congress-dot-gov-api/) describes its API as providing data for reuse. The import includes bill titles and action descriptions; check the rights of any incorporated third-party content rather than treating everything on a federal website as a government work. |
| `fec-openfec`, `openfec-api` | The adapters request candidate records and aggregate financial totals, not individual contributor records. The FEC's [sale-or-use restriction](https://www.fec.gov/updates/sale-or-use-contributor-information/) applies to individual contributor information; reassess if endpoints or fields change. |
| `us-election-calendar`, `usa-gov-election-offices` | The calendar computes dates from federal statutes; the directory imports government office names and links. [USA.gov](https://www.usa.gov/government-copyright) cautions that federal sites can include third-party content and government branding must not imply endorsement. |
| `openstates-people` | The [people repository](https://docs.openstates.org/contributing/people/) is dedicated under CC0, and [Open States terms](https://open.pluralpolicy.com/tos/) make no claim over collected data. The API also supplies third-party photo URLs, which the app displays; identify and clear each image or omit unverified photos before publication. |
| `openstates-bills` | Open States makes no copyright claim, but its terms require users to respect third-party rights. The import stores state bill titles and latest-action text. Review the underlying state sources and applicable rights, or exclude the unverified material; the provider's statement alone does not clear all of it. |
| `oregon-sos-voting-rules` | The app publishes its own rule-based notes and calculated dates using Oregon election information. The [Secretary of State site terms](https://sos.oregon.gov/Pages/terms-and-conditions.aspx) do not provide a general redistribution license; check the underlying rules and any copied wording before approving this source. |

Voteview, Wikipedia's governor roster, Oregon Legislature OData, and the curated
local-government dataset are excluded by the deployment workflow. Excluding
them does not resolve rights for the other included sources or external media.
Keep the workflow's rights confirmation and approval gate in place until the
remaining issues are resolved; do not treat this review as permission to approve.

- [congress-legislators](https://github.com/unitedstates/congress-legislators):
  the project dedicates its data to the public domain under CC0 1.0.
- [Congress photographs](https://github.com/unitedstates/images): the
  upstream project identifies its photos as public domain and uses CC0 1.0.
  Other photos linked by external datasets can have different rights.
- [Open States terms](https://open.pluralpolicy.com/tos/): Open States says it
  makes no copyright claim over collected data; use of its services remains
  subject to its terms. Its [people repository](https://docs.openstates.org/contributing/people/)
  is explicitly dedicated under CC0. Do not assume that this CC0 dedication
  automatically applies to every upstream third-party work or image. The
  app imports recent bill titles, latest actions, and sponsor information as
  well as legislator data; review the rights for the underlying material.
- [Wikidata](https://www.wikidata.org/wiki/Wikidata:Data_access): structured
  data is generally CC0; linked media may have separate rights.
- [Wikipedia](https://wikimediafoundation.org/what-we-do/wikimedia-projects/wikipedia/):
  text reuse is generally subject to CC BY-SA attribution and share-alike
  requirements. Check each article and media file, provide appropriate
  attribution and links, and follow the applicable license. The governor
  roster parses the [list of current governors](https://en.wikipedia.org/wiki/List_of_current_United_States_governors)
  into structured fields. The source page currently links to Wikipedia's
  homepage rather than that list or the license text; review the applicable
  attribution and licensing requirements before publishing this data. The
  deployment snapshot excludes this roster.
- [Voteview](https://voteview.com/data): the provider offers public downloads
  and requests a dataset citation. Its data page does not specify a general
  redistribution license. Confirm permission with the provider before
  redistributing a dataset or derived material; the license of its website
  software does not establish a license for its data. The deployment snapshot
  excludes Voteview; local ingestion includes it by default. Skipping ingestion
  does not remove Voteview records already present in an existing database.
- [U.S. Census Bureau](https://www.census.gov/about/policies/citation.html):
  cite the Census Bureau as the original data source. Verify rights for any
  separately attributed third-party material. The county and unified
  school-district gazetteers represent geography as of January 1, 2024.
  The county population estimates are for July 1, 2024, and do not cover
  every county-equivalent jurisdiction.
- [FEC](https://www.fec.gov/updates/sale-or-use-contributor-information/):
  public availability does not eliminate restrictions on the sale or use of
  individual contributor information. Review the FEC's rules before using or
  redistributing such information.
- [Oregon Legislature OData](https://www.oregonlegislature.gov/citizen_engagement/Pages/data.aspx):
  the Legislature provides an open-data service and links to an
  [acceptable-use agreement](https://www.oregonlegislature.gov/citizen_engagement/Documents/OLODataAcceptableUseAgreement.pdf).
  The agreement calls for electronic acceptance, receiving associated metadata,
  reporting data or service problems, and limits database full refreshes to
  once daily between 5 p.m. and 6 a.m. Pacific time. The current ingest does
  not enforce that window or explicitly fetch the metadata document. The
  published data page does not explain how to accept the agreement; contact
  [the legislative help desk](mailto:leg.helpdesk@oregonlegislature.gov)
  for the acceptance procedure and clarify compliance before use. The
  deployment snapshot excludes Oregon Legislature OData.
- Congress.gov, other Oregon sources, and local-government websites: check the
  terms and rights applicable to each source and any included third-party
  material. A "public record" label alone is not a copyright license.

The curated local-government snapshot contains historical information and
source links; review its accuracy, attribution, and reuse rights before
redistributing derived datasets or publishing them as current. It includes
holder names, office details, and meeting information from multiple official
websites, so the review must cover each source rather than assuming one
license applies to all of them. The deployment snapshot excludes this curated
data and its associated TriMet ingestion.
