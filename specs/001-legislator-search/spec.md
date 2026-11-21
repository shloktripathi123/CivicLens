# Feature Specification: Public Official Search (Civic Lens)

**Feature Branch**: `001-legislator-search`
**Created**: 2026-10-11
**Status**: Draft
**Input**: "Make an app which finds the bills, specifics, backgrounds, and all other affiliations and information for voters to use of any senator, congressman, and all of this info from their name in a search."

**Clarifications (2026-10-11)**: Scope covers current AND former officials/historical records at every level (federal House, Senate, executive departments, state, county, local). Third-party ratings are included with publisher labels. Platforms: responsive web AND native mobile apps (iOS, Android).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find a legislator by name (Priority: P1)

A voter types all or part of any public official's name (current or former: U.S. Senator, Representative, executive/department official, state legislator, county or local official) into a search box and gets a list of matching members, then selects one.

**Why this priority**: Name search is the entry point to everything else; on its own it delivers a usable "who is this person" lookup.

**Independent Test**: Search "Warren", "elizabeth warren", and "Warrn" (typo); each shows Elizabeth Warren among the results, with chamber, party, and state.

**Acceptance Scenarios**:

1. **Given** the search box, **When** the user enters a partial or full name, **Then** matching members appear with name, photo, chamber (Senate/House), party, state (and district for House).
2. **Given** a name shared by multiple members, **When** searched, **Then** all matches are listed and distinguishable by state/chamber/party.
3. **Given** a misspelled or differently-cased name or one with accents/nicknames, **When** searched, **Then** the closest matches are still returned.
4. **Given** a name with no match, **When** searched, **Then** a clear "no results" message with suggestions is shown.

---

### User Story 2 - View a legislator profile and background (Priority: P1)

After selecting a member, the voter sees a profile: current office, term dates, committee assignments and leadership roles, contact info and official website/social links, and biographical background (birth date/place, education, prior occupations and offices held).

**Independent Test**: Open any current member's profile; all sections render, and sections lacking data say so rather than appearing blank.

**Acceptance Scenarios**:

1. **Given** a selected member, **When** the profile opens, **Then** it shows office, party, state/district, years in office, and committees.
2. **Given** a member, **When** viewing background, **Then** education, career history, and prior offices are shown with their source.
3. **Given** missing data for a field, **When** displayed, **Then** the field is labeled "Not available" instead of omitted silently.

---

### User Story 3 - Review sponsored bills and voting record (Priority: P2)

The voter sees bills the member sponsored or cosponsored (title, number, plain-language summary, status, date) and how the member voted on bills/roll calls, filterable by topic, status, and date.

**Independent Test**: On a member's profile, filter sponsored bills by topic "Healthcare" and verify the list updates; open a bill and see summary, status, and the member's vote.

**Acceptance Scenarios**:

1. **Given** a profile, **When** the user opens Bills, **Then** sponsored and cosponsored bills are listed, newest first, with status.
2. **Given** a bill, **When** opened, **Then** the user sees its official title, plain-language summary, status history, and a link to the official text.
3. **Given** the Votes tab, **When** viewed, **Then** each vote shows bill, date, and Yea/Nay/Present/Not Voting, with a summary of attendance/missed-vote rate.
4. **Given** filters, **When** applied, **Then** results update and can be cleared.

---

### User Story 4 - Affiliations, funding, and finances (Priority: P2)

The voter sees affiliations and influences: caucus memberships, campaign finance totals (top donors, industries, PAC contributions), financial disclosures, and notable endorsements/ratings from advocacy groups where publicly sourced.

**Independent Test**: Open the Funding tab for a member; totals raised, top contributors, and top industries appear with a reporting period and source link.

**Acceptance Scenarios**:

1. **Given** a profile, **When** the Funding tab is opened, **Then** total raised/spent, top donors and industries are shown for a selectable election cycle.
2. **Given** affiliations data, **When** displayed, **Then** each item cites its source and as-of date.

---

### User Story 5 - Compare and share (Priority: P3)

The voter can compare two members side by side (party, votes on shared bills, funding) and share/bookmark a profile via a stable link.

**Independent Test**: Select two members and compare; the shared-vote agreement percentage is shown; copying the profile URL opens the same profile.

---

### Edge Cases

- Officials who changed party, chamber, or were appointed mid-term (show history).
- Historical officials with sparse or non-digitized records: show what exists and flag gaps.
- Local/county bodies with no public data feed: show profile basics only with "Not available" for the rest.
- Same person holding different offices over time (e.g., state legislator later Senator): one unified person profile with a timeline.
- Delegates and non-voting members (DC, territories) and Resident Commissioner.
- Name collisions, hyphenated/multi-part surnames, nicknames ("Bernie"), diacritics.
- Upstream data source outage or stale data: show last-updated time and cached data with a notice.
- Very long vote/bill histories: paginated loading.
- Vacant seats and recently sworn-in members with little record.
- Accessibility: screen readers, keyboard-only, mobile screens.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let users search current and former public officials at all levels (U.S. House, U.S. Senate, executive departments/agencies, state legislatures and state offices, county and local governments) by full or partial name.
- **FR-019**: Search MUST support filtering by level (federal/state/county/local), branch, body, state/locality, status (current/former), party, and time period.
- **FR-020**: System MUST provide historical records (past terms, votes, bills, funding) for former officials to the extent public data exists, and show a unified timeline when a person held multiple offices.
- **FR-021**: System MUST be delivered as a responsive web app and native iOS and Android apps with feature parity for search and profile viewing, sharing one backend/API.
- **FR-022**: System MUST show a data-coverage indicator per official/jurisdiction so users know which sections are complete, partial, or unavailable.
- **FR-023**: Third-party advocacy ratings (e.g., ACLU, NRA) MUST be included from a balanced, documented set of publishers, each labeled with publisher, year, and methodology link.
- **FR-002**: Search MUST be typo-tolerant, case-, accent-, and nickname-insensitive, and show suggestions as the user types.
- **FR-003**: Results MUST show name, photo, chamber, party, state, and district (House).
- **FR-004**: System MUST provide a profile per member with office, term dates, committees, leadership roles, and official contact/website/social links.
- **FR-005**: System MUST show biographical background: birth info, education, career history, prior offices.
- **FR-006**: System MUST list sponsored and cosponsored bills with number, title, summary, status, and date, and link to official text.
- **FR-007**: System MUST show roll-call voting records, including Yea/Nay/Present/Not Voting and missed-vote rate.
- **FR-008**: System MUST support filtering/sorting bills and votes by topic, status, date, and vote position.
- **FR-009**: System MUST show affiliations: caucuses, committees, and sourced endorsements/ratings.
- **FR-010**: System MUST show campaign finance summaries (totals, top donors, top industries, PAC contributions) per election cycle, and link to financial disclosures.
- **FR-011**: Every data point MUST display its source and as-of date; data MUST come only from public/official or reputable open sources.
- **FR-012**: System MUST remain nonpartisan: no editorial scoring, endorsements, or ranking by the app itself; third-party ratings MUST be labeled with their publisher.
- **FR-013**: System MUST present plain-language summaries of legislation alongside official titles.
- **FR-014**: System MUST refresh data at least daily and show a last-updated timestamp.
- **FR-015**: System MUST provide stable, shareable URLs/deep links (web and app) per official and allow side-by-side comparison of two officials.
- **FR-016**: Web and native apps MUST meet WCAG 2.1 AA and platform accessibility guidelines.
- **FR-017**: System MUST NOT require an account or collect personal data for search and viewing.
- **FR-018**: System MUST handle missing/failed data gracefully with explicit messages.

### Key Entities

- **Official** (covers all levels): identity, name variants/nicknames, photo, level, branch, body/chamber, party, state, district/locality, term(s), status (current/former), IDs in source systems.
- **Term/Office**: start/end dates, level, body/chamber, state/district/locality, party at the time.
- **Committee/Role**: committee or subcommittee, role (member/chair/ranking), caucus.
- **Bill**: number, congress, title, plain-language summary, topics, status history, text link, sponsor, cosponsors.
- **Vote**: roll call, date, bill/question, legislator position, result.
- **Background Entry**: education, career, prior office, with source.
- **Funding Record**: cycle, totals, donors/industries/PACs, source.
- **Affiliation/Rating**: organization, type (endorsement/rating/membership), value, as-of date, source.
- **Data Source**: name, URL, retrieved-at.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Searching a legislator's name returns the intended person in the top 3 results in ≥ 98% of tests across a sampled set of current and former officials at all levels.
- **SC-002**: Search suggestions appear within 300 ms (p95) of typing; a profile loads within 2 s (p95).
- **SC-003**: A first-time user can go from landing to viewing a member's sponsored bills in under 30 seconds, in ≥ 90% of usability tests.
- **SC-004**: 100% of displayed facts show a source and as-of date.
- **SC-005**: Federal data (all senators, House members, and cabinet-level/department heads) is complete with data no older than 24 hours; state and local coverage is tracked per jurisdiction and reaches ≥ 90% of state legislators by launch, expanding to counties/localities progressively, with coverage indicators shown.
- **SC-006**: Passes WCAG 2.1 AA automated and manual checks.
- **SC-007**: ≥ 85% of surveyed test voters report they understood a member's record and could explain a bill's purpose after using the app.

## Assumptions

- Scope is all U.S. public officials, current and historical: federal (House, Senate, executive departments/agencies; judiciary as a later phase), all 50 states and territories, counties, and municipalities. Full "everything" coverage is delivered in phases (federal, then state, then county/local), bounded by public data availability.
- Data comes from public sources (e.g., Congress.gov, GovInfo, official member/vote feeds, FEC, state legislature sites and open civic datasets, state/local campaign finance portals, financial disclosure sites); specific providers are a planning decision.
- Plain-language bill summaries use official summaries where available; any generated summaries must be labeled as such.
- No user accounts in v1; bookmarks are via URLs/deep links.
- English only in v1.
- Platforms: responsive web plus native iOS and Android apps.

## Resolved Clarifications

- **Former officials / scope**: Include former officials, historical records, and all levels of government (federal, state, county, local).
- **Ratings**: Include third-party ratings with publisher labels and a balanced set.
- **Platform**: Web and native apps.

## Open Questions (for planning)

- Phasing and priority order across levels of government, and whether judiciary is in v1.
- Native app technology (shared cross-platform codebase vs. separate iOS/Android).
- Historical depth limit (e.g., since 1789 for Congress; how far back for state/local).
