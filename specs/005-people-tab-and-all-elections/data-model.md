# Data Model Changes (005)

All new rows keep `source_id` and `as_of`. Existing tables stay; changes are additive migrations (`ALTER TABLE ... ADD COLUMN`, `CREATE TABLE IF NOT EXISTS`).

## person
No new columns. `status` keeps `current | former | candidate`. A person who is a former president and current candidate stays one row (status = `candidate` if any open candidacy, else `current` if any open term, else `former`; computed at ingest).

## person_identifier (existing)
New `scheme` values: `wikidata`, `fec`, `govtrack` (existing `bioguide`, `lis`). Merge rule: two source records are one person when any identifier matches; the merge is logged and tested.

## person_name (existing)
New `kind` values: `alias`, `nickname`. Wikidata aliases ("Donald J. Trump", "Trump") are stored with their normalised form so prefix search finds them.

## office_term (existing, extended)
- `branch` gains `executive` and `judicial` values (today: `legislative`).
- `level` gains `state`, `local` use for governors, mayors.
- `title` examples: `President`, `Vice President`, `Governor`, `Secretary of State (U.S.)`, `Associate Justice`.
- New column `office_type TEXT` (nullable) = one of `president, vice_president, cabinet, senate, house, governor, state_legislator, judge, mayor, other`; backfilled for existing rows from `body`/`title`. Drives the People filter (FR-002).
- New column `how_filled TEXT` (election, appointment, succession).

## office, election, race (existing, extended)
- `election.type` CHECK gains `measure`. SQLite cannot alter a CHECK, so the table is rebuilt in a one-time migration guarded by `PRAGMA user_version`.
- `election.cycle INTEGER` (e.g. 2026), `election.level TEXT` (federal, state, county, local), indexed.
- `office.office_type` (same values as above, plus `school_board`, `county`, `special_district`, `statewide_other`) and `office.state`.
- `race.stage TEXT` (primary, general, runoff, special) mirrors `election.type` for display; `race.candidates_status TEXT` = `loaded | not_loaded` so a race with no candidates states why.
- `race.how_filled TEXT` (Electoral College for president, popular vote, etc.).

## roster_entry (new)
`id, name, role_category, expected_office_label, wikidata_id, bioguide_id, source_citation_url, added_on`. Loaded from `data/roster.json`; read only by tests and the Coverage report.

## coverage_category (new)
`id, kind (election|figure), label, expected_count, loaded_count, reason, fallback_url, updated_at`. Written at the end of each ingest run from live counts; the Coverage page renders it. `expected_count` comes from a derivable rule (435 districts, 35 or so Senate seats in the cycle, 56 governors) or the roster file, never from guesses.

## jurisdiction_authority (new)
`state, name, election_url, checked_at, status` — the official election authority link per state/territory (R4 tier 3), link-checked by the existing link checker.

## Invariants (tested)
1. No `person` without a graded source; no `candidacy` without an authoritative source (existing trigger).
2. Every `race` has an `office` and an `election`; every `election` appears in Coverage as loaded or gap.
3. Wikidata-only facts render with grade C and the popup, never as official.
4. Ordering of candidates/figures: alphabetical by family name unless an official ballot order is stored.
5. Exclusion rules apply to every new field; Wikidata properties for home address, spouse, children, and birth place of minors are never read.
