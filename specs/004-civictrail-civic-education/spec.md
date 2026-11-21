# Feature Specification: CivicTrail — Civic Education Platform

**Feature Branch**: `004-civictrail-civic-education`
**Created**: 2026-10-11
**Status**: Draft
**Depends on**: [001](../001-legislator-search/spec.md) (people, search, provenance), [002](../002-candidate-search/spec.md) (candidates, races), [003](../003-place-search-and-sourcing/spec.md) (places, source grading, exclusions)
**Input**: "Build CivicTrail, a nonpartisan, mobile-friendly civic education platform that helps users find their representatives and understand government." Six areas: My Representatives, Government Explorer, Elections and Voting, How Government Works, Bills and Decisions, Learn Civics. Verified official sources, visible citations, no fabrication, facts vs AI summaries clearly separated, proposed bills vs enacted laws clearly separated, political neutrality, accessibility. Inspect the existing app first, preserve what works, find gaps, build and test incrementally, define requirements and acceptance criteria before implementation.

**Naming**: "CivicTrail" is the product name for this feature set. The existing app ("Civic Lens") is extended, not replaced. Renaming the shipped UI is a decision for the owner (see Assumptions).

## Existing Application Audit *(preserve, then extend)*

This audit is the baseline. Everything marked "Working" MUST keep passing its existing tests (39 at the time of writing) throughout this feature.

| Area | Status | Evidence |
|---|---|---|
| Name search for officials (federal, 12,770 people incl. former) | Working | 001; `/v1/search`, `/v1/people/:id` |
| Candidates and races (FEC, Oregon governor seed) | Partial | FEC loads 0 rows without a real `FEC_API_KEY`; Oregon seed has 2 candidates |
| Place search: state, county, city, ZIP (69,402 places) | Working | 003 Phase A; `/places/:id` |
| Source credibility grades, rubric popup, source pages, coverage page | Working | 003 Phase B |
| Exclusions (no home addresses, family, minors), correction reports, link checker | Working | 003 Phase C |
| Provenance on every fact (source, link, date, grade) | Working | `uncitedFacts` ingest gate |
| ZIP → district/officials mapping (federal House district, state legislators) | **Gap** | 003 Phase D unstarted; places overlap by Census geography only |
| County, city, school district, special district officials | **Gap** | no adapters; only federal data is loaded |
| Address lookup | **Gap** | not built (privacy-sensitive) |
| Bills, votes | **Gap** | schema tables exist; bills/votes arrays empty |
| Public meetings | **Gap** | no model |
| Elections calendar, deadlines, polling/registration links | **Gap** | races exist, no deadlines or voting resources |
| Government structure explorer | **Gap** | no content |
| How government works / Learn Civics content | **Gap** | no content |
| AI summaries | **Gap** | none exist (must be introduced with strict labeling) |
| Native mobile apps | **Gap** | none; web only, responsive |
| Accessibility | Partial | a11y test covers badge dialog and landmarks; no audit across pages |
| Section state (not-found vs not-yet-checked) | **Gap** | task T129 left open |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - My Representatives by ZIP or address (Priority: P1)

A voter enters a ZIP code or street address and sees every official who represents them, grouped by level: federal, state, county, city, school district, special district.

**Why this priority**: It is the app's front door and the largest gap versus 003 (place pages list overlaps, not the voter's actual districts).

**Independent Test**: Enter a ZIP split across two congressional districts; see both with a prompt to narrow by address. Enter a full address; see exactly one House member, state senator, state representative, plus county and city officials where data exists.

**Acceptance Scenarios**:
1. **Given** a ZIP, **When** searched, **Then** all officials whose districts overlap it appear, and split ZIPs say so explicitly.
2. **Given** a street address, **When** submitted, **Then** the officials for that exact location appear, resolved through an official geocoding/boundary source, and the address is not stored or logged.
3. **Given** a level with no loaded data (for example school boards), **When** shown, **Then** it appears as a labeled gap with the reason and a link to the governing body's official site, never omitted.
4. **Given** each official, **When** listed, **Then** it shows office, party (if the office is partisan), term dates, how the office is filled, and a link to the full profile.
5. **Given** a nonpartisan office (most school boards, many city councils), **When** shown, **Then** no party label is invented.

---

### User Story 2 - Elections and Voting (Priority: P1)

A voter sees upcoming elections for their place: dates, offices, verified candidates, and official resources for registering, checking registration, finding a polling place, voting by mail, and deadlines.

**Acceptance Scenarios**:
1. **Given** a place, **When** opened, **Then** upcoming elections are listed with date, type (primary, general, special, runoff) and the races on the ballot.
2. **Given** an election, **When** opened, **Then** registration, early voting, mail ballot request and return deadlines are shown, each with a link to the state or county election office page it came from and the date retrieved.
3. **Given** a deadline that could not be verified from an official source, **When** shown, **Then** it is not displayed as a date; the app shows "Not verified" with a link to the official office.
4. **Given** candidates in a race, **When** listed, **Then** order is alphabetical by last name or randomized, never by party or poll standing, and every filed candidate appears, including minor-party and independent.
5. **Given** a candidate who withdrew or lost a primary, **When** shown, **Then** their status is current and stated, not removed silently.

---

### User Story 3 - Bills and Decisions (Priority: P1)

A voter can follow legislation, votes and public meetings that affect their place, and can tell proposed bills from enacted laws at a glance.

**Acceptance Scenarios**:
1. **Given** any bill, **When** displayed, **Then** it carries exactly one status label from a fixed set (Introduced, In committee, Passed one chamber, Passed both chambers, Signed into law/Enacted, Vetoed, Failed, Withdrawn) and enacted laws are visually distinct from proposals everywhere they appear (lists, search, profiles).
2. **Given** a bill, **When** opened, **Then** the official title, sponsors, status history with dates, roll-call votes with each member's vote, and a link to the official text on the legislature's or Congress's site are shown.
3. **Given** a bill, **When** an AI summary is displayed, **Then** it is boxed and labeled "AI-generated summary", names the model and generation date, links to the exact source text it summarized, and sits apart from the official facts above it.
4. **Given** an AI summary that cannot be generated or fails verification (see FR-011), **When** the bill is shown, **Then** no AI summary appears; the official summary or "No summary available" appears instead.
5. **Given** a public meeting (council, commission, school board), **When** listed, **Then** date, body, agenda link and minutes link come from the body's official site, and unknown items show "Not published".
6. **Given** an official's profile, **When** viewed, **Then** it lists bills sponsored and votes cast, each with the bill's status label.

---

### User Story 4 - Government Explorer (Priority: P2)

A user browses the structure of government for their place: each body, what it is responsible for, who sits on it, how many seats, how members are chosen (elected, appointed, by whom), term lengths, and how to reach it.

**Acceptance Scenarios**:
1. **Given** a body (U.S. Senate, state legislature, county board, city council, school board, special district), **When** opened, **Then** it shows responsibilities, size, term length, selection method, current members with profile links, and an official source link.
2. **Given** an appointed official (for example a department head), **When** shown, **Then** the appointing authority and confirmation process are stated.
3. **Given** a body for which structure content has not been written or verified, **When** opened, **Then** it shows the member list if known plus a clearly labeled gap, never generic filler.
4. **Given** any explanatory sentence, **When** shown, **Then** it traces to a cited source (statute, constitution, or official government page).

---

### User Story 5 - How Government Works and Learn Civics (Priority: P2)

A user reads short, plain-language guides on how elections, appointments, legislation and local government work, and finds ways to take part (register, attend a meeting, contact an official, serve as a poll worker).

**Acceptance Scenarios**:
1. **Given** a guide, **When** opened, **Then** it is written at roughly an 8th-grade reading level, each factual claim cites an official or primary source, and it shows a last-reviewed date.
2. **Given** a guide that depends on jurisdiction (voting rules, local structures), **When** the user has chosen a place, **Then** it shows that place's rules or links to its official office; with no place chosen, it says rules vary and prompts for one.
3. **Given** the participation guidance, **When** shown, **Then** it describes options across the political spectrum without recommending any party, candidate or position.
4. **Given** any guide, **When** viewed, **Then** a glossary term (for example "primary", "veto") links to a plain definition.

---

### User Story 6 - Trust, neutrality and accessibility across everything (Priority: P1)

**Acceptance Scenarios**:
1. **Given** any fact, **When** displayed, **Then** it has the 003 provenance (source, link, retrieved date, credibility grade); AI summaries and CivicTrail-written explanations are labeled as such and are never styled as official data.
2. **Given** a topic with competing views (ratings, agendas, endorsements), **When** shown, **Then** it presents sourced material from multiple publishers without CivicTrail ranking or editorializing.
3. **Given** any page used with keyboard only, a screen reader, 200% zoom, or a 360 px wide phone, **When** navigated, **Then** all content and actions remain available and meet WCAG 2.2 AA.
4. **Given** a native mobile app (iOS and Android), **When** used, **Then** it offers the same six areas with the same labels and citations as the web.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST resolve a ZIP code or street address to officials at federal, state, county, city, school district and special district levels, using official boundary data, and MUST show split ZIPs explicitly.
- **FR-002**: Address input MUST NOT be stored, logged, or sent to any third party other than the official geocoder, and the UI MUST say so.
- **FR-003**: Every government body and office MUST record selection method (elected, appointed with appointer, ex officio), term length, and seat count, each cited.
- **FR-004**: The system MUST list upcoming elections per place with date, type and races, and MUST show only deadlines and voting resources that trace to an official state or local election office page.
- **FR-005**: Candidate lists MUST be alphabetical or randomized and MUST include all filed candidates.
- **FR-006**: The system MUST ingest bills, sponsors, status history and roll-call votes from official legislative sources (federal first; Oregon first for state), and link each to official text.
- **FR-007**: Every bill MUST show one status from the fixed set in US3-1; the enacted/proposed distinction MUST be applied by the data model (not by UI text parsing) and tested.
- **FR-008**: The system MUST ingest public meeting listings, agendas and minutes from official body sites where available, and mark unavailable items "Not published".
- **FR-009**: AI summaries MUST be generated only from stored official bill text or official meeting documents, stored with model name, version, prompt version, generation date and source link, and displayed in a labeled box separate from official data.
- **FR-010**: Educational content (How It Works, Learn Civics, Explorer descriptions) MUST be authored content stored with citations, reviewer and last-reviewed date, and labeled as CivicTrail explanation.
- **FR-011**: AI summaries MUST pass an automated verification before display: every named entity, number and date in the summary must appear in the source text; failures are suppressed, logged, and never shown.
- **FR-012**: The system MUST NOT generate any fact (name, date, vote, deadline, quote) without a source; if no source exists the field shows "Not found" or "Not yet checked" (003 section states, task T129).
- **FR-013**: Neutrality: no ranking, scoring, "best/worst" labels or default sorts that favor a party, candidate or viewpoint; default ordering is alphabetical or chronological and is stated on the page.
- **FR-014**: All pages MUST meet WCAG 2.2 AA, work from 360 px wide, and not rely on color alone; core reading of profiles and place pages MUST work without JavaScript.
- **FR-015**: A native app (iOS and Android) MUST provide the six areas using the same API; feature parity is required before the native release is called complete.
- **FR-016**: All 003 exclusions (home addresses, personal phones, family, minors) and the credibility rubric MUST apply to every new data type.
- **FR-017**: Data gaps MUST appear on `/coverage` by level, area and body, so users and maintainers can see what is not yet loaded.
- **FR-018**: Existing behavior MUST be preserved: all existing tests continue to pass at every increment, and each new increment adds tests before or with its code.

### Key Entities

- **Body**: a governing body (name, level, jurisdiction, responsibilities, seat count, term length, selection method, official URL).
- **Office / Seat**: a position within a body, with district and selection method, linked to officials and terms.
- **Election**: date, type, jurisdiction, races, deadlines (each with source).
- **Bill**: identifier, jurisdiction, title, status (fixed set), status history, sponsors, official text URL, official summary.
- **Vote**: roll call on a bill or motion, per-member positions.
- **Meeting**: body, date, agenda URL, minutes URL, items.
- **AiSummary**: bill or meeting reference, text, model, prompt version, generated date, source text hash, verification result.
- **Guide / GlossaryTerm**: authored educational content with citations, reviewer, last-reviewed date.
- **Existing (unchanged)**: Person, Candidacy, Race, Place, PlaceOverlap, Source, Provenance.

## Success Criteria *(mandatory)*

- **SC-001**: 100% of displayed facts have a source link, retrieved date and credibility grade (enforced by the existing `uncitedFacts` gate extended to new tables).
- **SC-002**: 0 AI summaries displayed that fail verification; 100% of displayed AI summaries carry the label, model, date and source link.
- **SC-003**: For a test set of 50 addresses across 5 states, resolved federal and state districts match the official source in at least 98% of cases.
- **SC-004**: Every bill has a status from the fixed set; a test confirms no enacted law is ever labeled as proposed and vice versa.
- **SC-005**: Every page passes automated accessibility checks with 0 serious or critical violations, and a manual keyboard and screen reader pass succeeds on the six area home pages.
- **SC-006**: A first-time user can, from the home page, find their federal, state and local representatives with a ZIP code in under 60 seconds in usability testing.
- **SC-007**: A neutrality checklist (ordering, wording, balance of sources) passes for every guide before publication.
- **SC-008**: The existing 39 tests still pass at every increment.

## Assumptions

- Rollout is incremental: (1) section states and bill/election data models, (2) Oregon end to end (the only state with seeded data), (3) other states, (4) native apps. Each increment ships with its own acceptance tests.
- The first full-fidelity state is Oregon; other states appear as honest gaps until their data is loaded.
- Address resolution uses the U.S. Census Geocoder (official, free, no account) unless plan-phase research finds a blocking limitation.
- AI summarization needs a model provider and key; until configured, the AI summary area shows official summaries only. No fabricated placeholders.
- The product name "CivicTrail" is used in this spec; the shipped UI keeps "Civic Lens" until the owner confirms the rename.
- A real `FEC_API_KEY` is expected for federal candidate data.

## Out of Scope

- Voter registration, ballot casting, or any account system.
- Endorsing, rating or recommending candidates, parties or bills.
- Campaign donation processing.
- Real-time results reporting.
- Legal advice.

## Open Questions (resolved by assumption; revisit at plan review)

1. Rename the shipped UI to "CivicTrail" now, or keep "Civic Lens"? *Assumed: keep until confirmed.*
2. Which AI provider for summaries? *Assumed: decided in plan; provider-agnostic interface, off until configured.*
3. States beyond Oregon for local officials in v1? *Assumed: Oregon first.*
