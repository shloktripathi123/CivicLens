# Feature Specification: People Tab, All U.S. Elections, and Major Figures

**Feature Branch**: `005-people-tab-and-all-elections`
**Created**: 2026-10-11
**Status**: Draft
**Depends on**: [001](../001-legislator-search/spec.md) (people, search, provenance), [002](../002-candidate-search/spec.md) (candidates, races), [003](../003-place-search-and-sourcing/spec.md) (source grading, exclusions), [004](../004-civictrail-civic-education/spec.md) (bills, design system)
**Input**: "While keeping the UX and UI completely the same, add a tab where the user can search for people specifically. In Races it should include all political races, not just the Oregon governor: presidential, Senate, etc. Every election that exists in the U.S. should be added. Figures like Donald Trump must be added. No major politician may be left out of the application."

## Existing Application Audit *(preserve, then extend)*

| Area | Status | Evidence |
|---|---|---|
| Name search (home page) mixes people, candidates and places in one box | Working | `/` search, `/v1/search` |
| Person profile pages (federal legislators, current and former, 12,770) | Working | `/people/:id` |
| Races list and race pages | **Gap** | 2 candidates, one Oregon governor race; no federal races (FEC key absent) |
| Presidents, vice presidents, cabinet, governors, judges, party leaders | **Gap** | not loaded; the legislators dataset covers Congress only. Donald Trump, Joe Biden, Barack Obama and current governors are absent unless they once served in Congress |
| A dedicated people search page | **Gap** | people are only reachable through the mixed home search |
| Visual design (editorial broadsheet, DESIGN.md, PRODUCT.md) | Working | must stay as is |

Everything marked "Working" MUST keep passing its existing tests (45 at the time of writing).

## Design Constraint: UX and UI unchanged

The visual system, layout, typography, colours, components, copy tone and page structure stay exactly as shipped. This feature adds one navigation entry ("People") and one page that reuses existing components (search entry line, filters, ruled results rows, credibility badge, citations). Races pages keep their current layout; they only gain more rows. No restyling, no new component types, no new colours.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search for people in a dedicated tab (Priority: P1)

A voter clicks "People" in the main navigation and searches by name for any political figure, current or former, at any level, without places or races in the results.

**Why this priority**: It is the explicit request and the fastest way to find a specific person.

**Independent Test**: Open `/people`, search "Trump", "Wyden", "Newsom"; each returns the matching person(s) with office, party, status and a link to the profile, and no place results.

**Acceptance Scenarios**:
1. **Given** the main navigation, **When** the page loads, **Then** a "People" link appears in the same style as the other links, and shows as current on `/people` and on person pages.
2. **Given** `/people`, **When** a name is typed, **Then** results show only people (officials, former officials, candidates, and other political figures), ranked with exact and prefix matches first.
3. **Given** filters, **When** used, **Then** the user can narrow by office type (President/Vice President, Cabinet, Senate, House, Governor, State legislator, Judge, Mayor, Candidate), status (current, former, candidate), party and state, reusing the existing filter styling.
4. **Given** a person with the same name as another, **When** listed, **Then** office, state and years disambiguate them.
5. **Given** no match, **When** searched, **Then** a plain "No people found" message appears with suggestions, never a place result substituted for a person.
6. **Given** the home page search, **When** used, **Then** it behaves exactly as before and still includes people.

---

### User Story 2 - Every major political figure is present (Priority: P1)

A voter looks up any nationally or regionally prominent political figure and finds a sourced profile.

**Why this priority**: "No major politician may be left out" is a hard completeness requirement, and the current data covers only people who served in Congress.

**Independent Test**: Run the major-figures roster check (see SC-002); search Donald Trump, Joe Biden, Barack Obama, Kamala Harris, JD Vance, a sitting governor from each state, each cabinet secretary, and each Supreme Court justice; all are found.

**Acceptance Scenarios**:
1. **Given** the figures below, **When** searched, **Then** each has a profile with office or role, party where partisan, term dates, background and sourced links:
   - Presidents and vice presidents: all, past and present (including Donald Trump, Joe Biden, Barack Obama, Kamala Harris, JD Vance).
   - Cabinet-level officers and heads of executive departments and agencies: current, and former where sourced.
   - Governors: current governor of every state and territory, plus former governors where sourced.
   - Supreme Court justices and federal appellate judges: current and former where sourced.
   - Congressional leadership, committee chairs and ranking members.
   - Major-party and other ballot-qualified presidential, Senate, House and gubernatorial candidates in a current cycle.
   - Mayors of the largest cities, state attorneys general, secretaries of state, state legislative leaders.
2. **Given** a figure with several roles over time (for example a former president who is also a current candidate), **When** shown, **Then** one profile lists every role with dates, not duplicate profiles.
3. **Given** a figure for whom some sections have no source data, **When** shown, **Then** each missing section says "Not available" with the reason, consistent with existing behaviour; the figure is never omitted for lack of detail.
4. **Given** the existing exclusions, **When** profiles are added, **Then** home addresses, family and minors stay excluded.
5. **Given** a figure from a lower-credibility source, **When** shown, **Then** the content appears with its credibility grade, as elsewhere in the app.

---

### User Story 3 - Races covers every U.S. election (Priority: P1)

A voter opens Races and finds every election, not only one state's governor: presidential, U.S. Senate, U.S. House, governors, other statewide offices, state legislatures, judicial, county, municipal, school board, special district, special elections, primaries, runoffs and ballot measures.

**Why this priority**: Explicit request ("every election that exists in the US").

**Independent Test**: Open `/races`; browse by election date, office level and state; find the 2028 presidential race, a 2026 Senate race in at least ten states, and a House race in every state with an election.

**Acceptance Scenarios**:
1. **Given** `/races`, **When** opened, **Then** races are browsable by election date/cycle, level (federal, state, county, local), office type and state, in the existing ruled-list style.
2. **Given** a race, **When** opened, **Then** it lists the office, jurisdiction, election date and stage (primary, general, runoff, special), the candidates with party and status, and sources with credibility grades.
3. **Given** a presidential election, **When** opened, **Then** it lists candidates and running mates, with a note on how the office is filled (Electoral College) and primary/caucus stages by state.
4. **Given** a Senate or House race, **When** opened, **Then** the incumbent is flagged, candidates are listed, and the page links to each candidate's profile.
5. **Given** an election whose ballot data is not yet loaded (for example a school board in a small county), **When** its jurisdiction is viewed, **Then** it is listed as a labeled gap with the reason and a link to the official election authority, never silently absent.
6. **Given** a candidate in a race who is also a known political figure (Trump, an incumbent senator), **When** shown, **Then** the candidate row links to the same person profile as the People tab.
7. **Given** past elections, **When** requested, **Then** historical races are included with results where sourced, clearly dated.
8. **Given** the Races page, **When** it loads, **Then** it stays fast with thousands of races (pagination or grouped sections, no loss of keyboard or screen-reader access).

---

### User Story 4 - Completeness is visible and honest (Priority: P2)

A user, or a maintainer, can see what is included and what is still missing.

**Acceptance Scenarios**:
1. **Given** the Coverage page, **When** opened, **Then** it lists, per election category and per figure category, how many are loaded, how many are expected from the authoritative reference, and the gap.
2. **Given** any gap, **When** listed, **Then** it names the reason (source not available, key missing, not yet ingested) and the official source to use meanwhile.
3. **Given** an automated roster check, **When** run, **Then** it fails if any figure in the maintained major-figures roster is missing from the people search.

### Edge Cases

- A person is both a former president and a current candidate: one profile, multiple roles.
- The same name belongs to several people (for example "John Smith"): disambiguated by office, state, years.
- Name variants and nicknames ("Donald J. Trump", "Donald Trump", "Trump"): all resolve to one person via sourced aliases.
- Candidates who withdraw, lose a primary or are disqualified: status shown, not deleted.
- Territories, D.C. and tribal governments: included where the data source provides them.
- Elections in the future with no certified candidate list: shown with the filing deadline, not invented candidates.
- Unofficial or contested results: labeled with source and grade, never presented as certified.
- Impersonation or satire entries: excluded; only sourced people appear.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST add a "People" entry to the main navigation and a `/people` page that searches people only.
- **FR-002**: People search MUST support name, alias and partial-name matching, with filters for office type, status, party and state.
- **FR-003**: The People page MUST reuse existing components and styles; no visual redesign.
- **FR-004**: The system MUST include profiles for every person in the major-figures roster (User Story 2), with role history and sourced links.
- **FR-005**: A person with multiple roles MUST have a single profile listing all roles with dates.
- **FR-006**: The Races area MUST include presidential, U.S. Senate, U.S. House, gubernatorial, other statewide, state legislative, judicial, county, municipal, school-board and special-district elections, plus special elections, primaries, runoffs and ballot measures, wherever an authoritative source provides them.
- **FR-007**: Races MUST be browsable by date/cycle, level, office type and state.
- **FR-008**: Each race page MUST show candidates, stage, date, incumbent flag, how the office is filled, and cited sources with credibility grades.
- **FR-009**: Race candidates who are people in the directory MUST link to the same profile.
- **FR-010**: Every fact MUST carry source, link, retrieval date and credibility grade; sources lacking a grading entry are rejected at ingest (existing rule).
- **FR-011**: The system MUST NOT invent candidates, results, dates or biographical facts; unavailable data is shown as a labeled gap.
- **FR-012**: Every jurisdiction without loaded election data MUST appear as a gap with a link to its official election authority.
- **FR-013**: The Coverage page MUST report loaded versus expected counts for election categories and major-figure categories.
- **FR-014**: An automated roster check MUST fail when a roster figure is missing from search.
- **FR-015**: Existing exclusions (home addresses, family, minors) and correction reporting MUST apply to all new profiles.
- **FR-016**: Existing pages, URLs, tests and the home-page search MUST keep working unchanged.
- **FR-017**: The People page and expanded Races pages MUST meet the same accessibility level as the rest of the app (keyboard, screen-reader labels, contrast, no horizontal scroll).
- **FR-018**: Neutrality: ordering of candidates and figures MUST use neutral rules (alphabetical, or ballot order where official), never party or popularity.

### Key Entities

- **Person (extended)**: now includes non-legislators (executives, judges, state and local officials, candidates); aliases; multiple dated roles.
- **Role**: office, jurisdiction, party (if partisan), start and end dates, how filled.
- **Election**: jurisdiction, date, type (primary, general, runoff, special, measure), cycle.
- **Race**: office on the ballot in an election; candidates; incumbent flag; results (where sourced).
- **Roster entry**: a named major figure the system must contain, used by the completeness check.
- **Coverage entry**: category, loaded count, expected count, reason and official fallback.

## Success Criteria *(mandatory)*

- **SC-001**: Searching each of 25 sample names (including Trump, Biden, Obama, Harris, Vance, five governors, five cabinet members, three justices, five congressional leaders) on `/people` returns the right person first or in the top three.
- **SC-002**: The major-figures roster check passes with 0 missing figures for presidents, vice presidents, sitting governors (all states and territories), cabinet, Supreme Court, and congressional leadership.
- **SC-003**: Races lists a presidential race, a Senate race in every state with a seat up in the current cycle, and a House race for every district in the current cycle, each with sourced candidates once candidate data is available; where candidate data is not yet available, the race exists with a labeled gap.
- **SC-004**: 100% of jurisdictions appear in Coverage as loaded or as a labeled gap with an official link.
- **SC-005**: The People page and Races pages return results within 1 second at p95 on the shipped dataset.
- **SC-006**: Visual regression: existing pages render the same as before except the added "People" nav link (no style changes).
- **SC-007**: All previously passing tests still pass; new tests cover people search, roster completeness, race browsing and neutral ordering.
- **SC-008**: 0 facts without source, link, date and grade.

## Assumptions

- **Data sources (planning decides final choices)**: the unitedstates/congress-legislators project also publishes presidents and vice presidents (executive file), which covers Trump, Biden, Obama and Harris; governors and cabinet need an additional official or well-licensed source (for example official state and White House sites, the National Governors Association, Wikidata under CC0); federal races and candidates come from the FEC (needs a real API key, tracked as an existing gap); state and local elections come from state election authorities, the Census, and open election datasets where licensing permits.
- **"Every election that exists"** is delivered as a rolling, measured coverage target: everything an authoritative source provides is ingested, and the remainder appears as labeled gaps with official links, rather than blocking release. This is stated openly on the Coverage page.
- **"Major politician"** means the roster in User Story 2; the roster is a maintained file reviewed by the owner, and additions are cheap.
- UX and UI are unchanged other than the one navigation link and the new page built from existing components.
- Web only for this feature; native apps stay in 001's backlog.
- Exclusion rules (no home addresses, family, minors) apply to all new people.
- No ranking by party or popularity (neutrality).
- Controversial or defamatory content is not added; only sourced facts with grades.

## Out of Scope

- Redesign or restyling of any page.
- Predictions, polling averages or endorsements.
- Live election-night results feeds (historical and certified results only, where sourced).
- Address lookup (tracked in 004).
- Native mobile apps.

## Open Questions (resolved by assumption; revisit at plan review)

- Which source supplies governors and cabinet if licensing blocks a preferred dataset? Assumed: official government pages plus Wikidata (CC0), graded per the rubric.
- Should ballot measures be in scope for v1 of this feature? Assumed: yes where a source provides them, otherwise a labeled gap.
- Acquisition of a real FEC API key by the owner is needed for federal candidates; until then federal races appear with labeled gaps.
