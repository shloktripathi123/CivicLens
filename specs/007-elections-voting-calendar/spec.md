# Feature Specification: Elections and Voting Calendar

**Feature Branch**: `007-elections-voting-calendar`
**Created**: 2026-10-12
**Status**: Draft
**Depends on**: [003](../003-place-search-and-sourcing/spec.md) (source grading, citations), [005](../005-people-tab-and-all-elections/spec.md) (elections, races, candidacies), [006](../006-local-government/spec.md) (local units)
**Input**: Item 8 of the CivicTrail brief: an election calendar showing upcoming elections and voting deadlines: date, offices on the ballot, verified candidates, primary/general/special type, ballot measures, registration deadlines and official voting instructions, official sample-ballot and voter-information links. Distinguish scheduled dates from confirmed contests and personalized ballot information. Never invent dates, candidates or deadlines.

## Existing Application Audit *(preserve, then extend)*

| Area | Status | Evidence |
|---|---|---|
| `election` / `race` / `candidacy` tables; 2026 general (Nov 3) for 57 jurisdictions and the 2028 presidential general | Working | `/races`, `/v1/races` |
| Candidate lists (FEC filings, Oregon governor) with "candidate list not yet published here" for empty races | Working | `/races/[id]` |
| Statewide calendar view, upcoming vs past, per-state official voting links | **Gap** | no calendar route |
| Registration deadlines, voting instructions, sample-ballot links | **Gap** | no data |
| Ballot measures | **Gap** | no data |
| Primaries, runoffs and special elections | **Gap** | only generals exist in the data |
| Source grading, citations, exclusions | Working | governs every new fact |

All existing tests (64) keep passing. Design constraint: UX/UI unchanged; the new page reuses existing classes only.

## Core Principle: Three kinds of statement, never blended

Every item on the calendar carries exactly one **certainty label**:

1. **Scheduled date**: an election date set by statute or an official calendar (e.g. the federal general election date). Says nothing about who is running.
2. **Confirmed contest**: an office on that ballot with at least one sourced candidacy (e.g. an FEC filing). Candidate lists are labelled "as filed; may be incomplete".
3. **Personalized ballot**: what appears on *your* ballot (local races, measures, districts) is **never generated here**. We link to the state's official voter-information and sample-ballot tools.

Anything we do not hold (registration deadlines, early-voting windows, ballot measures, primaries, runoffs, special elections) is shown as **"Not in our data"** with the official state link, never estimated.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See upcoming elections (P1)
A voter opens Elections and sees upcoming elections in date order, each with date, type, and a certainty label; past elections are separated.
- **Given** the data holds the Nov 3, 2026 general, **when** the page loads before that date, **then** it is listed under "Upcoming" with "Scheduled by statute".
- **Given** an election date has passed, **then** it appears under "Past", not "Upcoming".

### User Story 2 - Pick my state (P1)
A voter picks a state and sees that state's elections, offices on the ballot with confirmed-contest counts, and candidates where sourced.
- Offices with no candidate list say "candidate list not yet published here".
- Candidate lists link to the existing race pages.

### User Story 3 - How to register and vote (P1)
For the chosen state, the page shows the official state election office, the federal register-to-vote page, and links for voter information and sample ballot.
- Registration deadline, early-voting dates and ballot-by-mail rules: "Not in our data. Confirm on your state's official site", with the link.
- No deadline is ever computed or estimated.

### User Story 4 - Ballot measures and personal ballot (P2)
The page states that ballot measures and local contests are specific to the voter's address and are not in our data, and points to the state's official sample-ballot tool.

### User Story 5 - Honest coverage (P2)
A coverage statement lists which election types and information classes are present (scheduled generals; FEC-filed federal candidates) and which are not (primaries, runoffs, specials, measures, deadlines).

### Edge Cases
- Unknown/invalid state code → 400; state with no election row → empty list with a labelled gap.
- Territories and DC appear with their official offices where the source lists them.
- A state with a link that fails link-checking is flagged, not silently dropped.

## Requirements

- **FR-001** Calendar lists every election in the data with date, type (general/primary/runoff/special), jurisdiction and certainty label.
- **FR-002** Upcoming vs past is computed from the server date.
- **FR-003** Per-election offices on the ballot with candidate counts; candidates link to race pages.
- **FR-004** Official state election-office link and federal register-to-vote link per state, each cited with source and date.
- **FR-005** Registration deadlines, early voting, ballot measures, primaries, runoffs and specials not held in data are shown as "Not in our data" with an official link; they are never estimated.
- **FR-006** Certainty labels (scheduled / confirmed contest / personalized ballot) appear in text, not colour alone.
- **FR-007** Personalized ballot content is never generated; only linked.
- **FR-008** New fact tables carry `source_id` + `as_of`, and are graded.
- **FR-009** The design system is unchanged; new views use existing classes.
- **FR-010** A coverage statement is returned by the API and rendered.

## Success Criteria
- **SC-001** Every 2026 election row in the data appears on the calendar with a certainty label.
- **SC-002** 0 registration deadlines, measures or primaries are displayed unless a cited source row exists.
- **SC-003** Every state/territory page has an official election-office link.
- **SC-004** All existing tests still pass; UI-parity test covers the new page.

## Assumptions
- Primary, runoff and special-election dates and registration deadlines are not available from a machine-readable official source during this build (vote.gov blocks automated access, FEC DEMO_KEY is rate limited), so they are left as gaps rather than seeded from memory. The data model supports them and the UI will show them when a cited source is added.
