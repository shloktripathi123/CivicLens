# Feature Specification: Place Search & Complete, Source-Credited Profiles

**Feature Branch**: `003-place-search-and-sourcing`
**Created**: 2026-10-11
**Status**: Draft
**Depends on**: [001](../001-legislator-search/spec.md) (people, search, provenance, coverage), [002](../002-candidate-search/spec.md) (candidates, races)
**Input**: "I must be able to search a ZIP code or a city or a county or a state and it must show up. Additionally all areas must be filled; if info is from uncredible sources, that will be mentioned, but all information must be added. Include links to sources where info is pulled from."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search by place and see everyone and every race there (Priority: P1)

A voter types a state ("Oregon"), a county ("Multnomah County"), a city ("Portland"), or a ZIP code ("97201") and gets that place's officials, candidates and races on one page, grouped by level (federal, state, county, city/local).

**Why this priority**: Most voters know where they live, not who represents them. This is the second main way into the app, next to name search.

**Independent Test**: Search "Portland" and see its mayor and council, Multnomah County officials, Oregon state legislators for the area, Oregon's U.S. House and Senate members, and every upcoming race on the ballot there, each linked to its profile.

**Acceptance Scenarios**:
1. **Given** a state, county, city or ZIP, **When** searched, **Then** a place page lists officials and open races for that place and every level of government that covers it.
2. **Given** an ambiguous name ("Springfield", "Washington", "Jefferson County"), **When** searched, **Then** the user chooses among all matches, each labeled with state and type.
3. **Given** a place with partial data (for example no local officials loaded yet), **When** opened, **Then** each missing level appears as a clearly marked gap with the reason and a link to the official government site, never as a blank or an omission.
4. **Given** a misspelling ("Portlnd", "Multnoma"), **When** searched, **Then** the intended place is still suggested.
5. **Given** a place that spans several districts (a city split across congressional districts), **When** opened, **Then** all districts are shown and the user can narrow by street address (see Privacy).
6. **Given** a typed place name that is also a person's name, **When** searched, **Then** both people and places are offered in separate groups.

---

### User Story 2 - Complete profiles: every section filled, with its source (Priority: P1)

Every profile (official, candidate, place) shows every section. Nothing is hidden because the data is weak. A section is in one of four states:
- **Sourced**: data and a link to where it came from.
- **Sourced, lower credibility**: data is shown, labeled with why the source is rated lower (for example self-published, anonymous, partisan advocacy, unverified wiki edit, news report with a single source), and a link.
- **Not found**: the app searched its sources and found nothing, and says which sources were checked.
- **Not yet checked**: no source for this section has been connected yet.

**Why this priority**: The requirement is that all information is included and that voters can judge it themselves.

**Independent Test**: Open any profile. Every section (identity, offices, background, education, career, party, affiliations, bills, votes, funding, ratings, agenda, endorsements, contact) is present with one of the four states, and every datum has a visible source link.

**Acceptance Scenarios**:
1. **Given** any displayed fact, **When** viewed, **Then** it has a source name, a clickable link to the exact page where it was found, the date it was retrieved, and a credibility label.
2. **Given** a fact available only from a lower-credibility source, **When** shown, **Then** it is displayed (not dropped) and visibly labeled with the reason.
3. **Given** two sources that disagree (different birth dates, different education), **When** shown, **Then** both values are displayed with their sources and the conflict is flagged, and the app does not silently pick one.
4. **Given** a section with no data, **When** shown, **Then** it is in the "Not found" or "Not yet checked" state; the two are visually distinct.
5. **Given** a source link that no longer works, **When** the system detects it, **Then** the link is marked stale and an archived copy link is offered where one exists.

---

### User Story 3 - Understand how reliable each source is (Priority: P2)

A voter can click any credibility label to see the source's type, who runs it, how its rating was decided, and which other facts in the app come from it.

**Acceptance Scenarios**:
1. **Given** a credibility label, **When** clicked, **Then** a popup opens explaining how that grade was decided (criteria, result of each, reason, rubric version) with links to the full rubric and the source page.
2. **Given** the full list of sources, **When** viewed, **Then** every source has a type (government record, official campaign material, major news, advocacy organization, reference wiki, other) and a rating with a stated reason.
3. **Given** a rating the app assigned, **When** a user disagrees, **Then** they can submit a correction request that is reviewed.

---

### User Story 4 - Browse places and areas without knowing a name (Priority: P3)

A voter can browse from a state to its counties to its cities, and from any place to its parent and child places, each showing coverage.

**Acceptance Scenarios**:
1. **Given** a state page, **When** opened, **Then** its counties, cities, and a completeness summary per level are shown.
2. **Given** a ZIP code that spans several places, **When** searched, **Then** the cities, counties and districts it touches are listed, and the page notes that ZIP codes are mail-delivery areas, not exact political boundaries.

---

### Edge Cases
- Cities that sit in several counties, counties that share a name across states, and consolidated city-counties (for example Denver, San Francisco).
- Unincorporated places and tribal areas with no municipal government.
- Territories and the District of Columbia.
- ZIP codes that cross city or county lines, and ZIPs that are not areas at all (PO boxes, unique-organization ZIPs).
- Sources that are slow, down, or rate-limited: show the last good data with its date instead of an empty section.
- Facts that are contested or legally sensitive: show the source and label, do not state them as the app's own claim.
- A source removes or edits a fact after capture: keep the captured version with its date.
- Very large result lists (a state with thousands of local officials): paginate and group, never truncate silently.

## Requirements *(mandatory)*

### Functional Requirements

**Place search**
- **FR-001**: The system MUST let users search by state, county, city/town, and ZIP code. (Telephone area codes are out of scope.)
- **FR-002**: Place matching MUST tolerate typos, abbreviations ("St." / "Saint", "OR" / "Oregon") and partial entry, and MUST show suggestions while typing.
- **FR-003**: Ambiguous place names MUST present all matches with state and type, ranked neutrally (alphabetical, or by population when disclosed), never silently choosing one.
- **FR-004**: A place page MUST list the officials, the candidates and the races covering that place, grouped by level of government.
- **FR-005**: The system MUST resolve each place to its overlapping districts and jurisdictions (congressional, state legislative, county, municipal, school, special districts) using official boundary data, and show which apply.
- **FR-006**: ZIP results MUST be labeled approximate where a ZIP does not map exactly to political boundaries, and MUST show every city, county and district it overlaps.
- **FR-007**: Place search MUST be usable together with name search from one search box, with results grouped as People, Candidates, Races and Places.
- **FR-008**: Users MUST be able to browse the hierarchy country → state → county → city and back.

**Completeness**
- **FR-009**: Every profile and place page MUST display every defined section, each in one of four states: Sourced, Sourced (lower credibility), Not found, Not yet checked.
- **FR-010**: "Not found" MUST list the sources that were checked and when. "Not yet checked" MUST name the source type that would fill it.
- **FR-011**: The system MUST NOT hide or omit available data because of source quality; lower-credibility data MUST be shown with a label.
- **FR-012**: The system MUST NOT invent, infer or fill in data to avoid an empty section. A gap stays a visible gap.
- **FR-013**: Each place and profile MUST show a completeness summary (for example "11 of 14 sections have data") and the overall rule for how it is computed.
- **FR-014**: Coverage targets MUST be published per level of government and per state so users can see what is and is not included.

**Source credit and credibility**
- **FR-015**: Every displayed fact MUST carry: source name, a direct link to the page or record, retrieval date, and credibility label.
- **FR-016**: Every source MUST have a recorded type, a credibility rating, and a written reason for the rating, following one published rubric of Civic Lens's own, applied equally regardless of political leaning.
- **FR-016a**: Every credibility label MUST be clickable and open a popup explaining how the grade was decided: the rating, the criteria checked (each with pass, partial or fail), the written reason for this source, the rubric version, and a link to the full rubric. The popup MUST be keyboard and screen-reader accessible, closable with Escape, and available on web and native apps.
- **FR-017**: Credibility labels MUST be based on source properties (primary government record, editorial standards, correction policy, transparency of authorship, self-published or not), never on the political content of the claim.
- **FR-018**: Conflicting values from different sources MUST all be shown, flagged as a conflict, each with its source.
- **FR-019**: The system MUST retain the captured value and capture date, and offer an archive link when the original is gone, and MUST flag broken links.
- **FR-020**: Users MUST be able to open a source page showing its rating, rationale, and the facts that depend on it, and to report an error in a fact or a rating.
- **FR-021**: Self-reported material (campaign agenda, candidate bio) MUST be labeled self-reported, separate from independently documented facts.

**Excluded information**
- **FR-025**: The system MUST NOT display, even when sourced: home addresses or personal phone/email of officials and candidates (only official offices and campaign contact), any information about minors or family members who are not themselves public figures, government ID, financial account or health details, and criminal allegations that are not from a court or other legal record. Allegations from legal records MAY be shown, labeled with case status (charged, convicted, dismissed, acquitted).
- **FR-026**: Excluded categories MUST be listed publicly with the reason, and a user MUST be able to report a displayed item that appears to belong to an excluded category; reported items are hidden pending review.

**Quality and platforms**
- **FR-022**: Place search MUST return suggestions in under 300 ms and a full place page in under 2 seconds at the 95th percentile, on web and native apps.
- **FR-023**: Web and native apps MUST offer the same place search, source links and credibility labels, and meet WCAG 2.2 AA. A credibility label MUST NOT rely on color alone.
- **FR-024**: Searches by street address, when offered, MUST be resolved server-side without storing the address or tying it to an identifier.

### Key Entities
- **Place**: type (country, state, county, city/town, ZIP), name, FIPS or code, parent/children, population (optional), boundary reference.
- **Jurisdiction / District**: a government unit or electoral district (congressional, legislative, county, municipal, school, special), linked to places through boundary overlap.
- **Place–Jurisdiction link**: overlap, with share of coverage where known.
- **Section state**: per profile or place, section, state (sourced, lower-credibility, not found, not yet checked), sources checked, checked-at.
- **Source**: name, URL, type, credibility rating, rationale, per-criterion results, rubric version, owner.
- **Rubric**: versioned list of criteria, how each is scored, and how scores map to a rating; published.
- **Exclusion rule**: category of data that is never displayed (see FR-025), with the legal or safety reason.
- **Fact citation**: fact, source, exact URL, retrieved-at, credibility at capture, archive URL, stale flag.
- **Conflict**: fact, competing values and their citations.
- **Correction report**: target (fact or rating), reporter note, status, resolution.

## Success Criteria *(mandatory)*

- **SC-001**: 95% of searches for a real US state, county, city, or ZIP return the intended place in the top 3 (verified on a golden list of at least 300 places).
- **SC-002**: For every state, 100% of counties and the largest 100 cities (or all, if fewer) are searchable.
- **SC-003**: 100% of displayed facts have a source name, a working direct link (or flagged stale), a retrieval date, and a credibility label (automated check).
- **SC-004**: 100% of profile and place sections render in one of the four states; there are zero blank or missing sections (automated check).
- **SC-005**: Every source has a documented rating and rationale; 0 sources without one.
- **SC-006**: In moderated user testing, at least 90% of participants correctly say whether a given fact came from a lower-credibility source and where to see why.
- **SC-007**: Place suggestions p95 under 300 ms and place page p95 under 2 s.
- **SC-008**: Federal coverage for place pages is 100% in phase 1, with published per-state coverage for state, county and local levels.

## Assumptions
- "All information must be added" is treated as a goal the app is visibly honest about, not a promise of 100% data on day one. Gaps are displayed as gaps (FR-012, FR-014), not fabricated, because filling gaps with guesses would break the sourcing requirement.
- Lower-credibility data is shown and labeled rather than excluded, per the request. Material that is unlawful (for example doxxing-level personal data such as home addresses or private contact details) is excluded regardless of source.
- Boundary and place data comes from US Census geography (places, counties, ZIP Code Tabulation Areas) and official district files; ZIP Code Tabulation Areas come from the Census, with a ZIP-to-city/county crosswalk.
- Builds on the existing provenance (source id and as-of date on every fact) and coverage model; adds links to exact pages, credibility ratings, and the four-state section model.
- Scope is US places. Phase 1: states, counties, cities, ZIPs, federal officials and races. Later phases: state, county and local officials as their data is added (spec 001 phasing).

## Resolved Clarifications
- **Area codes vs ZIP codes**: ZIP codes only; telephone area codes are not supported.
- **Credibility rubric**: Civic Lens's own rubric. Each label opens a clickable popup explaining how the grade was decided (FR-016a). Third-party ratings, if ever shown, are extra context only.
- **Excluded data**: yes, certain categories are never shown (FR-025). The category list is my proposal based on the earlier assumption; adjust it if you want different ones.

## Open Questions
- None blocking. The exact rubric criteria and weights are a design task for the plan and will be published in the app.
