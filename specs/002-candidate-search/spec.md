# Feature Specification: Candidate & Election Search

**Feature Branch**: `002-candidate-search`
**Created**: 2026-10-11
**Status**: Draft
**Depends on**: [001-legislator-search](../001-legislator-search/spec.md) (shared Person model, search, provenance, coverage)
**Input**: "App must look for people that are running for things, also include president, governors too, basically any position and anyone who is publicly known as a candidate for that position, for example Christine Drazan and Tina Kotek as candidates for governor of Oregon. Clicking on them would show an overview, a list of bills passed, education, background, party, affiliations, and agenda, etc."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search candidates by name or by race (Priority: P1)

A voter searches a name ("Drazan", even misspelled "Drazen") or a race ("Oregon governor", "president 2028") and sees the matching candidates, each labeled with the office sought, election, party, and candidacy status. Officeholders running for re-election and challengers appear in the same results as the existing officials search.

**Why this priority**: Candidates are the main thing voters decide on; without finding them nothing else matters.

**Independent Test**: Search "Oregon governor" and see both Tina Kotek and Christine Drazan (plus other ballot-qualified candidates) listed under one race; search "Drazen" and still find Christine Drazan.

**Acceptance Scenarios**:
1. **Given** a name query, **When** matches include candidates, **Then** results show name, photo, office sought, jurisdiction, election date, party, and status (declared, qualified, on ballot, withdrawn, won, lost).
2. **Given** a race query, **When** searched, **Then** the race page lists all known candidates with the same fields, grouped by party/primary where applicable.
3. **Given** a person who is both an incumbent and a candidate (e.g., a sitting governor seeking re-election), **When** shown, **Then** they appear as one person with both roles.
4. **Given** a name with no match, **When** searched, **Then** a clear empty state suggests browsing races by location or office.

---

### User Story 2 - Candidate profile: overview, background, party, education (Priority: P1)

Clicking a candidate shows an overview (office sought, election, status, party, campaign website), biography, education, career and prior offices, and affiliations (party roles, endorsements, organizations, caucus memberships).

**Independent Test**: Open Tina Kotek's profile: overview, party, education, career, prior offices, and affiliations all render with sources; any missing section says "Not available".

**Acceptance Scenarios**:
1. **Given** a candidate, **When** the profile opens, **Then** overview, party, education, career history, prior offices, and affiliations are displayed, each with source and as-of date.
2. **Given** a first-time candidate with no public record, **When** opened, **Then** the profile says so and shows what is available (campaign site, filings, statements).
3. **Given** a candidate who withdrew or lost, **When** opened, **Then** status and result are visible and the profile remains accessible.

---

### User Story 3 - Agenda, positions, and legislative record (Priority: P1)

The profile shows the candidate's agenda: stated platform and issue positions as published by the campaign (labeled as self-reported, with a link to the source), plus the candidate's record: bills sponsored/passed or signed (for current/former legislators and executives), key votes, and executive actions. Record items come from the shared official-record data in 001.

**Independent Test**: Open a candidate who is a former legislator: see a list of bills they sponsored that passed, with status; open a candidate with no legislative history: the record section states "No prior legislative record" and the agenda still appears.

**Acceptance Scenarios**:
1. **Given** a candidate's campaign site/platform, **When** the Agenda tab is opened, **Then** issue positions are listed by topic, attributed to the candidate with source link and date captured.
2. **Given** a candidate who served in a legislature, **When** the Record tab is opened, **Then** bills sponsored, bills enacted, and key votes are shown with filters (topic, status, date).
3. **Given** a candidate who served as governor/executive, **When** the Record tab is opened, **Then** signed/vetoed legislation and notable executive actions are listed with sources.
4. **Given** agenda and record side by side, **When** viewed, **Then** they are clearly separated: "What they say" (self-reported) vs. "What they've done" (public record).

---

### User Story 4 - Browse races and ballots (Priority: P2)

A voter browses by election (date), office level (president, governor, Senate, House, state/local), and location, and sees every race with its candidates. Entering a state/ZIP shows the races on that voter's ballot.

**Independent Test**: Select Oregon and "2026 general election": the governor race appears with its candidates; select "President": all declared candidates appear with party and status.

**Acceptance Scenarios**:
1. **Given** a state/ZIP, **When** entered, **Then** the races for that area are listed by level.
2. **Given** a presidential election cycle, **When** viewed, **Then** declared candidates, primary/general phase, and status are shown.
3. **Given** a race, **When** opened, **Then** election date, office, candidate list, incumbent status, and links to official election info are shown.

---

### User Story 5 - Funding, endorsements, and comparison (Priority: P2)

Voters see campaign finance (raised, spent, top donors/industries) per candidate, endorsements and third-party ratings (publisher-labeled), and can compare two or more candidates in the same race side by side (party, education, experience, positions by topic, funding).

**Independent Test**: Compare Kotek and Drazan: the side-by-side view shows party, background, positions by topic, and funding with sources, in neutral ordering (alphabetical or ballot order, never ranked).

---

### User Story 6 - Status changes and freshness (Priority: P3)

Candidate lists update as people declare, qualify, withdraw, or win/lose; each profile shows last-updated time and status history. No accounts or alerts in this version.

### Edge Cases

- Misspelled or alternate names (Drazan/Drazen), nicknames, name changes.
- Primaries, runoffs, special elections, recalls (ballot measures are out of scope v1).
- Write-in and minor-party/independent candidates; candidates who have not qualified for the ballot.
- "Publicly known" threshold: see FR-004.
- Candidates running for multiple offices, or switching races.
- Exploratory or rumored candidates: excluded or clearly labeled.
- Candidates with no web presence, or whose site disappears: show last captured agenda and mark the source unavailable.
- Withdrawn candidates remaining on ballots; deceased candidates.
- Ranked-choice or multi-member districts.
- Conflicting information across sources: show the discrepancy and sources; do not choose silently.
- Impersonation or false claims: only authoritative sources may establish candidacy.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let users search for candidates by name, and by office, jurisdiction, election date, and party, using the same typo/nickname/accent-tolerant search as officials (001).
- **FR-002**: System MUST cover candidates for any elected position at any level: President/Vice President, U.S. Senate and House, governor and other statewide offices, state legislatures, county, municipal, school board, judicial, and other local offices, where data exists.
- **FR-003**: Each candidacy MUST have a status (exploring, declared, qualified/on ballot, withdrawn, nominee, won, lost) and election context (office, jurisdiction, election date, phase: primary/general/runoff/special).
- **FR-004**: A person MUST be listed as a candidate only when candidacy is established by an authoritative source (election authority filing/ballot list, FEC or state/local campaign finance registration, or a declared candidacy confirmed by at least one reputable independent source), labeled with which. Speculation and rumors MUST NOT be listed as candidates.
- **FR-005**: System MUST provide race pages listing all known candidates for an office/election, grouped by primary/party, in neutral order (alphabetical or official ballot order).
- **FR-006**: Candidate profile MUST show overview, party, education, career history, prior offices, affiliations (party roles, organizations, endorsements), campaign website and contact.
- **FR-007**: Candidate profile MUST show agenda/issue positions, labeled as self-reported with source URL and date captured.
- **FR-008**: Candidate profile MUST show public record from 001 where the candidate has held office: bills sponsored/cosponsored, bills enacted, signed/vetoed legislation (executives), key votes; with the same filters as 001.
- **FR-009**: System MUST visibly separate self-reported claims ("What they say") from verifiable record ("What they've done"), and MUST NOT editorialize, rate, rank, or recommend candidates.
- **FR-010**: System MUST show campaign finance summaries and sources per candidate and cycle, and endorsements/third-party ratings with publisher labels (as in 001 FR-023).
- **FR-011**: System MUST support side-by-side comparison of 2 or more candidates in the same race using a fixed neutral layout.
- **FR-012**: Users MUST be able to browse races by election, level, and location, and find the races on their ballot by state/ZIP/address (address used only transiently, not stored).
- **FR-013**: A person who is an official and a candidate MUST have a single unified profile (001 Person) with both roles and timeline.
- **FR-014**: Every fact MUST display source and as-of date; conflicting sources MUST both be shown with attribution.
- **FR-015**: Candidate lists and statuses MUST refresh at least daily (hourly in the final 30 days before an election), with last-updated shown.
- **FR-016**: Agenda text MUST be quoted or faithfully summarized with a link to the original; any machine-generated summary MUST be labeled as such.
- **FR-017**: After an election, results MUST be shown from official sources (won/lost, certified status), and candidate profiles MUST remain available as historical records.
- **FR-018**: System MUST provide a correction path: a "report an error" link per profile; campaigns may submit corrections to their own self-reported fields via a verified channel, but cannot remove sourced public record or alter others' profiles. (Verification details deferred to planning.)
- **FR-019**: Available on web and native apps (iOS/Android) with parity for search, race pages, and candidate profiles; WCAG 2.1 AA.
- **FR-020**: No user accounts or personal data collection for viewing; ZIP/address lookups MUST NOT be logged with identifiers.
- **FR-021**: Absent data MUST be shown explicitly ("Not available" / coverage indicator per section, as in 001).

### Key Entities

- **Candidacy**: person, office sought, jurisdiction, election, phase, party (for this race), status + status history, filing/ballot references, campaign website, committee IDs, incumbent flag, result.
- **Race**: office, jurisdiction/district, election date, phase, rules (e.g., ranked-choice), candidate list, results.
- **Election**: date, type (general/primary/runoff/special/recall), jurisdiction, official info URL.
- **Office**: title, level, body, term length, seat/district.
- **Agenda Item**: candidate, topic, position text, source URL, captured date, self-reported flag, generated-summary flag.
- **Candidate Background / Affiliation / Endorsement / Rating / Funding Record**: reuse 001 entities, linked to Candidacy.
- **Person**: reuse 001 Person; a person can have many Candidacies and Office Terms.

## Success Criteria *(mandatory)*

- **SC-001**: For a sample of upcoming races (including president, every governor race, and Senate races), 100% of candidates on official ballot/qualified lists are present within 48 hours of the list being published.
- **SC-002**: Searching a candidate name returns the intended person in the top 3 in ≥ 98% of tests, including common misspellings (e.g., "Drazen" → Christine Drazan).
- **SC-003**: Race search returns the full race with all candidates; a sample audit finds ≥ 95% completeness against official sources.
- **SC-004**: 100% of agenda items show a source link and captured date; 100% of facts show source and as-of date.
- **SC-005**: A voter can go from landing to a candidate's agenda in under 30 seconds in ≥ 90% of usability tests, and find the top-of-ticket races for their ZIP in under 1 minute.
- **SC-006**: In user testing, ≥ 90% of participants correctly distinguish self-reported claims from public record, and ≥ 85% of participants, across differing political leanings, rate the presentation as fair and neutral.
- **SC-007**: Profile loads p95 < 2 s; candidate/race search p95 < 300 ms.
- **SC-008**: Zero unsupported candidacies listed in audit samples (FR-004).

## Assumptions

- Builds on 001's shared Person, search, provenance, coverage, and ingestion framework; the phasing of 001's state/local data limits how much record data exists for non-federal candidates, and coverage indicators explain gaps.
- Initial priority: the 2026 U.S. general election (federal, governors, statewide), then presidential cycles, then state legislature and local races as data allows.
- Candidate/race data sources are a planning decision (e.g., election authorities, FEC and state finance filings, open election datasets, campaign websites), subject to licensing review.
- Agenda information comes from candidates' own official campaign materials (site, platform pages, filed statements, voters' pamphlet statements) and is not fact-checked by the app.
- Ballot measures, polling, predictions, and any app endorsement of candidates are out of scope.
- No accounts, alerts, or notifications in this version. English only.
- Example: the Oregon 2026 governor race includes incumbent Tina Kotek (Democratic) and Christine Drazan (Republican); the app must surface any additional qualified candidates the same way.

## Open Questions

- **[NEEDS CLARIFICATION: Candidate threshold]** Should minor-party, independent, and write-in candidates appear for all races, or only those who have formally filed/qualified? *Assumed: formally filed or qualified only (FR-004); write-ins only where an official list exists.*
- **[NEEDS CLARIFICATION: Campaign corrections]** May campaigns submit and manage their own agenda text in the app? *Assumed: yes, via a verified channel limited to self-reported fields (FR-018).*
- **[NEEDS CLARIFICATION: Early presidential field]** Should speculative/exploratory presidential candidates appear before official filing? *Assumed: no; only those with a filed declaration or a formal announcement confirmed by reputable independent sources, labeled "declared".*
