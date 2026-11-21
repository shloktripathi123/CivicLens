# Feature Specification: Local Government — County, City, School District and Special Districts

**Feature Branch**: `006-local-government`
**Created**: 2026-10-11
**Status**: Draft
**Depends on**: [003](../003-place-search-and-sourcing/spec.md) (places, ZIP/county/city lookup, source grading, completeness), [004](../004-civictrail-civic-education/spec.md) (government explainers, bills, design system), [005](../005-people-tab-and-all-elections/spec.md) (people, races, calendar)
**Input**: Items 3–6 of the CivicTrail brief: (3) County Government, (4) City Government, (5) School District Government, (6) Commissioners and Special Districts. Show the officials, what they do, how they are chosen, terms, next elections, meetings, decisions and contacts, **adapted to the actual government structure of the user's location, showing only offices and districts that apply there.**

## Existing Application Audit *(preserve, then extend)*

| Area | Status | Evidence |
|---|---|---|
| Place search by ZIP, city, county, state (33,791 ZIPs, 32,333 cities, 3,222 counties) | Working | `/places`, `/v1/places/*` |
| Place page with Federal / State / County / City level sections and a completeness statement | Working | `/places/[id]` |
| County and city level sections list officials | **Gap** | sections render as "coming soon / no sourced data"; no county or city officeholder exists in the database |
| School districts, special districts | **Gap** | no entity, no geography, no officials |
| Terms, selection method, responsibilities for local offices | **Gap** | explainers exist only for federal and Oregon state bodies |
| Meetings, agendas, recorded votes at county, city, school or district bodies | **Gap** | only Oregon Legislature bills exist |
| Source grading, citations, "never fabricate", exclusions | Working | must govern every new fact |

All "Working" rows keep passing their existing tests (55 at the time of writing).

## Design Constraint: UX and UI unchanged

The editorial broadsheet design stays. New content reuses existing components: level sections with a coverage chip, ruled result rows, credibility badge, citation lines, "empty" notices. The place page gains a **School district** and **Special districts** section alongside the existing County and City sections; no new component types or colours.

## Core Principle: Structure first, then officeholders

Local governments differ enormously (a county may be governed by a three-member commission, a board of supervisors, a county executive plus council, or a consolidated city-county; a city by a strong mayor, council-manager, commission or town meeting; school boards are elected at-large, by ward, or appointed). The product therefore models **government form** before **people**:

1. Each government unit has a **form** (e.g. "commission", "council–manager") and a list of **offices that exist in that form**, each with: responsibilities, selection method (elected, appointed by whom, hired, ex officio), term length and limits, next election date (if elected).
2. Offices are shown **only if they exist for that unit**. An office that exists but whose holder is not in our data is shown as "Office exists; holder not in our data" with an official link. An office that does not exist in that unit is not shown at all.
3. A fact is never inferred from a state default without saying so (a state-law default is labelled "Under [state] law, counties generally …", with the statute or state source cited, and never shown as a unit-specific fact).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - County government for my location (Priority: P1)

A voter looks up a ZIP or county and sees the county's governing structure and officials.

**Independent Test**: Open the county page for a seeded county (Multnomah, OR; Cook, IL; Los Angeles, CA). It shows the correct governing body (commission / board of supervisors), its members, and only the row offices that county actually has, each with selection, term and next election, plus a citation.

**Acceptance Scenarios**:
1. **Given** a county, **When** its page loads, **Then** it names the governing body (commissioners, supervisors, council, or executive plus council), the chair or presiding officer where one exists, and each member with district, party if officially listed, term end, and contact.
2. **Given** the county's structure, **When** offices are listed, **Then** only applicable offices appear from: sheriff, clerk (or recorder / auditor / register of deeds), assessor, treasurer (or tax collector), district attorney (or county/state's attorney), coroner or medical examiner, surveyor, judge of probate, and others the structure defines. Offices combined or appointed in that county appear in their actual form (e.g. "Assessor — appointed by the board").
3. **Given** each office, **Then** the page states its responsibilities in plain language, whether it is elected or appointed (and by whom), the term length, the next scheduled election date, and whether the seat is up in the next cycle.
4. **Given** a county with a consolidated city-county government or no county government in the usual sense (e.g. independent cities in Virginia, county-equivalents such as Louisiana parishes or Alaska boroughs), **Then** the page explains the difference and uses the correct name (parish, borough) and structure.
5. **Given** an unincorporated area, **Then** the county page states that county government is the primary local government and links to its services.

### User Story 2 - City government for my location (Priority: P1)

A voter looks up a city, town or ZIP and sees the city's officials and how decisions are made.

**Independent Test**: Open Portland, OR (commission → council–mayor change), Chicago, IL (strong mayor), and a council–manager city. Each shows its form, officials, and the elected vs. hired split.

**Acceptance Scenarios**:
1. **Given** a city, **Then** the page shows the mayor, council members (with ward or at-large seat), and other relevant officials (clerk, attorney, police chief, manager) with a clear label distinguishing **Elected**, **Appointed**, and **Hired employee**.
2. **Given** a council–manager city, **Then** the city manager appears in a separate "Hired staff, not elected" group with who appoints them, and the page explains why they have no vote or election.
3. **Given** each elected office, **Then** the page shows responsibilities, selection method (at-large, by ward, ranked choice, appointed), term, term limits where they exist, and next election date.
4. **Given** the city's council, **Then** the page shows its regular meeting schedule (day, time, place, how to attend or watch), and links to official agendas and minutes; recent decisions (ordinances and resolutions) are listed only when the city publishes them in a machine-readable record, each linked to the official source.
5. **Given** a ZIP spanning several places, **Then** each distinct city is shown and unincorporated parts are labelled as such.

### User Story 3 - My school district and school board (Priority: P1)

A voter sees which school district serves their location and how its board works.

**Independent Test**: Open a ZIP in Portland, OR → Portland Public Schools; a ZIP in a unified district; a ZIP split between two districts. Each shows the correct district(s), board, and participation guidance.

**Acceptance Scenarios**:
1. **Given** a location, **Then** the page identifies the school district(s) serving it, by official boundary, distinguishing elementary, secondary and unified districts. A location in more than one district lists each with a note that boundaries overlap.
2. **Given** a district, **Then** the board shows each member with zone/ward/at-large seat, term end, and official contact when published, plus the board chair, superintendent (labelled **Hired, not elected**) and how the board is selected (elected, appointed by whom).
3. **Given** the board, **Then** the page states responsibilities (budget, policy, superintendent hiring, bond measures), term lengths, and next election dates.
4. **Given** the board's meetings, **Then** the page shows the meeting schedule, links to agendas and minutes, and recorded votes when the district publishes them; where votes are not published the page says so.
5. **Given** the district, **Then** a "Take part" section explains in plain language how to attend, how and when to sign up for public comment, how to submit written comments, and how to watch remotely, each tied to the district's own published rules and linked.
6. **Given** a charter school, private school or higher-education district, **Then** they are not presented as the user's school district; community college districts are shown under special districts.

### User Story 4 - Commissioners and special districts that apply to me (Priority: P2)

A voter sees the port, transit, water, fire, parks, library, cemetery, soil and water conservation, and other special districts whose boundaries include their location.

**Independent Test**: For a Portland ZIP, the Port of Portland, TriMet, and Metro appear with their board members and selection method; a district that does not cover the ZIP does not.

**Acceptance Scenarios**:
1. **Given** a location, **Then** only the special districts whose boundary includes it are shown, grouped by function, each with its name, function, governing board, and a statement of whether the board is elected, appointed (by whom), or mixed.
2. **Given** each district, **Then** the page shows board members, terms, next election, what decisions the district makes (rates, levies, bonds, service plans), the taxing authority if any, and contact and meeting information.
3. **Given** no special district is in our data for the location, **Then** the page says "No special districts in our data for this location" and states that not all districts are published in a statewide list, with the Census and state registry links; it never states that none exist.
4. **Given** appointed board members, **Then** they are labelled **Appointed** with the appointing body and are not listed as candidates.

### User Story 5 - Structure explained and transparent completeness (Priority: P2)

For every local unit the voter can read how this kind of government works and how complete the page is.

**Acceptance Scenarios**:
1. **Given** any local unit, **Then** an "How this government works" block explains its form in plain language, citing state or charter sources, marked as an **explainer**, separate from **facts** about the unit.
2. **Given** a page, **Then** a completeness statement lists which of these are sourced for this unit: structure, officials, terms, next election, meetings, agendas/minutes, votes, contacts, and which are not, with the reason (no published source, source not machine-readable).
3. **Given** the Coverage page, **Then** it reports, per state, how many counties, cities, school districts and special districts are in the database and how many have each section sourced.

## Edge Cases

- ZIP spans several counties, cities, or districts → list each; never pick one silently.
- Vacant seats and acting/interim officeholders → shown as "Vacant" or "Interim", with the date.
- Officials who share a name → disambiguated by office and jurisdiction; local officials link to People search.
- Nonpartisan offices (most school boards, many city councils) → no party shown; never inferred.
- Special elections, recalls, and appointments to fill vacancies → labelled with the type.
- Boundaries change after redistricting or annexation → each assignment carries an "as of" date.
- Term end earlier than today → officeholder not shown as current; the seat is flagged as needing a source refresh.
- Consolidations and name changes (e.g. a city-county) → the unit shows its predecessor name.
- Meeting schedules change → each shows its as-of date and a link to the official calendar.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** The system MUST represent each county, city, school district and special district as a **government unit** with a type, official name, state, boundary or area identifier, government **form**, and source.
- **FR-002** The system MUST map a ZIP or address-level place to the **county, city, school district(s) and special districts** that serve it, using official boundary data; overlaps MUST be shown, not resolved silently.
- **FR-003** The system MUST list only offices that exist in the unit's form; it MUST NOT display a generic template of offices.
- **FR-004** Every office MUST show: title, responsibilities (explainer), selection method, appointing authority where relevant, term length, term limits where they exist, and next election date where elected.
- **FR-005** Every officeholder MUST show name, office, seat or district, start and end of term, selection method, official contact where published, and a citation; vacant and interim states MUST be representable.
- **FR-006** Elected, appointed, and hired positions MUST be visually and textually distinguished using existing chips, and hired employees (manager, superintendent, police chief) MUST NOT be listed as elected or as candidates.
- **FR-007** The system MUST show the next scheduled election date for each elected seat, derived from a sourced election calendar or the seat's term end and the state's election rule; an inferred date MUST be labelled "expected, not yet confirmed" with the rule cited.
- **FR-008** For each governing body, the system MUST show the meeting schedule, location, how to attend or watch, and links to official agendas and minutes; it MUST NOT invent schedules.
- **FR-009** The system MUST show decisions and recorded votes **only** where the body publishes them in a retrievable official record; each entry MUST link to the source and carry an as-of date; where none is available it MUST say so.
- **FR-010** For school boards, a "Take part" section MUST explain attending, public comment sign-up and limits, written comments and remote viewing, each from the district's own published policy, linked.
- **FR-011** The system MUST distinguish a unit's **facts** (sourced) from **explainers** (general descriptions of the kind of government) and from **AI summaries** (labelled and cited), and an explainer MUST name its basis (state statute, charter, or the unit's own site).
- **FR-012** All new facts MUST pass the existing source-grading rubric (003): every fact cites a graded source, self-reported government sites are labelled as such, and no fact lacks a citation.
- **FR-013** Officials MUST be added to the existing person model so they appear in the People tab and search, with level `county`, `city`, `school` or `special`, and filters for those levels.
- **FR-014** Local offices up for election MUST appear as races in the Races tab, using the existing race model, so that county, city, school board and special district elections are listed with their dates and, where sourced, candidates.
- **FR-015** The place page MUST show **County**, **City**, **School district** and **Special districts** sections, each hidden if no such unit applies and showing a clear "not in our data" state where a unit applies but data is missing.
- **FR-016** The system MUST honour the exclusions policy (003): no home addresses, family members, or minors' data, and board contacts MUST be official or public-office contacts only.
- **FR-017** The system MUST display an as-of date and a link to the official source for every unit, and MUST flag data older than a configurable freshness threshold.
- **FR-018** The completeness statement (FR-015, US5) MUST be computed from the data, not hard-coded, and the Coverage page MUST report per-state counts per unit type.
- **FR-019** UX and UI MUST remain unchanged beyond the new sections (see Design Constraint).
- **FR-020** The system MUST NOT present a state-law default as unit-specific; defaults MUST be labelled and cited (see Core Principle 3).

### Key Entities

- **Government unit**: type (county, municipality, school district, special district), name, state, FIPS or official identifier, form, boundary reference, predecessor name, source, as-of.
- **Office**: unit, title, responsibilities, selection method, appointing authority, term length, term limit, seat count, partisan or nonpartisan, source.
- **Officeholder (term)**: person, office, seat or district, status (current, vacant, interim), start, end, how filled, contact, source.
- **Meeting body and schedule**: unit, body name, recurring schedule, location, remote access, agenda and minutes links, as-of.
- **Decision / recorded vote**: body, date, item, outcome, vote tally or per-member votes where published, source link.
- **Participation guide**: unit, comment rules, sign-up method and deadlines, written submission, remote access, source link.
- **Service area (coverage)**: ZIP or place → unit, with overlap fraction where known and an as-of date.

## Success Criteria *(mandatory)*

- **SC-001** For every ZIP in the database, the page names the county and city (or "unincorporated") correctly, verified against Census data for a 200-ZIP random sample at 100%.
- **SC-002** For every ZIP in the seeded states, the school district(s) serving it match the official boundary data for a 100-ZIP sample at ≥ 98%.
- **SC-003** In the seeded counties, cities and districts, 100% of displayed offices exist in that unit's form and 0 offices are shown from a generic template (checked against the unit's own site).
- **SC-004** 100% of displayed facts have a citation, an as-of date, and a source grade; 0 uncited facts (existing citation test extended).
- **SC-005** 100% of hired positions are shown as hired, and 0 hired staff appear as elected or as candidates.
- **SC-006** Every elected seat shown has either a confirmed next election date or an "expected" label with its rule; 0 unlabelled inferred dates.
- **SC-007** Special districts appear for a location only if its boundary contains it: 0 false inclusions in a 50-location sample.
- **SC-008** Where meetings, minutes, or votes are unavailable, the page says so in 100% of cases; 0 fabricated schedules, agendas or votes.
- **SC-009** The existing 55 tests still pass, and a UI-parity test confirms new pages use only existing design-system classes.
- **SC-010** The Coverage page reports, for every state, counts of counties, cities, school districts and special districts and the share with sourced officials.

## Assumptions *(decisions taken without asking)*

- **Rollout is measured, not claimed.** Nationwide structure comes from Census data (units, boundaries, forms); officeholders come from official or published sources unit by unit. Every unit has a page; only units with a source show officials. Seeding starts with Oregon (Multnomah County, Portland, Portland Public Schools, Port of Portland, TriMet, Metro) plus one large county in two other states to prove that structures differ; further states follow as sources are added.
- **Boundary and structure sources** (named for planning, not binding): Census TIGER/Line for county, place and school-district boundaries; Census Individual Government Units for the list of local and special governments and their types; state and unit websites for officials, meetings and terms; state statutes for default structure; the existing election calendar for statutory dates. Source grades are computed by the existing rubric.
- **Self-reported unit websites** are used for officeholders and contacts, graded and labelled "self-reported by the government itself" (as in 004).
- **AI summaries** of meetings and decisions are shown only when generated from a cited official document, labelled, and linked to it (as in 004).
- **No unit-level data is inferred from other units.** Default structures are labelled as state-law defaults only.
- **Ratings, endorsements and opinions** stay out of local pages (nonpartisan).
- **Native apps** remain out of scope for this feature, as in 005.

## Out of Scope

- Property-level lookup (tax parcels, individual addresses beyond ZIP/place), and polling-place lookup.
- Real-time meeting streaming or live agenda parsing for every jurisdiction.
- Private or charter schools, higher-education institutions as school districts.
- Judicial elections below the county court level, beyond the offices listed.
- Tribal governments (flagged as a follow-up).
