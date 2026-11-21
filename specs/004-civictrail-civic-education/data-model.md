# Data Model: CivicTrail (004)

Additive only. Existing tables are unchanged. Every new fact table carries `source_id` + `as_of` and is added to `FACT_TABLES` so `uncitedFacts` enforces citation (FR-012, SC-001).

## Governance
- `body(id, name, level[federal|state|county|city|school|special], jurisdiction, place_id, responsibilities, seats, term_years, selection[elected|appointed|ex_officio|mixed], selection_detail, url, source_id, as_of)`
  - `responsibilities`, `selection_detail` are authored text and must have a citation row in `content_citation` (below).
- `seat(id, body_id, title, district, selection, appointer, confirmation, source_id, as_of)`; `office_term` gains nullable `seat_id`.

## Elections
- `election(id, jurisdiction, date, type[primary|general|special|runoff], name, source_id, as_of)`
- `election_race(election_id, race_id)` (links existing `race`)
- `election_deadline(id, election_id, kind[register|early_voting|mail_request|mail_return|in_person], date, verified INTEGER, url, source_id, as_of)` — `verified=0` rows are never rendered as dates (US2-3).
- `voting_resource(id, jurisdiction, kind[register|check_registration|polling_place|mail_ballot|id_rules], title, url, source_id, as_of)`

## Bills and decisions
- `bill(id, jurisdiction, session, number, title, status, status_detail, introduced_on, last_action_on, text_url, official_summary, source_id, as_of)`
  - `status` CHECK IN (`introduced`,`in_committee`,`passed_one_chamber`,`passed_both`,`enacted`,`vetoed`,`failed`,`withdrawn`). Fixed set, set only by adapters from source signals (FR-007). `is_law` is a generated column: `status = 'enacted'`.
- `bill_status_event(bill_id, date, action, status_after, source_id, as_of)`
- `bill_sponsor(bill_id, person_id, role[primary|co], source_id, as_of)`
- `vote(id, bill_id NULL, body, date, question, result, yes, no, other, url, source_id, as_of)`
- `vote_position(vote_id, person_id, position[yes|no|present|absent|not_voting], source_id, as_of)`
- `meeting(id, body_id, date, kind, agenda_url, minutes_url, video_url, status[scheduled|held|cancelled], source_id, as_of)` — `agenda_url`/`minutes_url` NULL renders "Not published".
- `meeting_item(meeting_id, order, title, bill_id NULL)`

## AI summaries
- `ai_summary(id, subject_type[bill|meeting], subject_id, text, model, model_version, prompt_version, source_text_url, source_text_sha256, generated_at, verification[passed|failed|skipped], failures_json)`
- Only `verification='passed'` rows are ever returned by the API. Failures stay in the table for audit.

## Education content
- `guide(id, slug, title, body_md, reading_grade, reviewer, last_reviewed, jurisdiction NULL)`
- `glossary_term(slug, term, definition, guide_id NULL)`
- `content_citation(content_type, content_id, claim_ref, source_id, url, retrieved_at)` — every guide paragraph and every body description cites at least one source; a build-time test fails otherwise.

## Section states (finishes 003 T129)
- `section_state(subject_id, section, state[sourced|sourced_low|not_found|not_yet_checked], sources_checked_json, checked_at)`; migrated from `coverage`.

## Address lookups
No table. Requests are proxied, not persisted, and excluded from access logs by route.

## Status mapping rules (tested)
| Source signal | Status |
|---|---|
| Federal action "Became Public Law" / "Signed by President" | `enacted` |
| Federal action "Vetoed by President" (without override) | `vetoed` |
| Passed House or Senate only | `passed_one_chamber` |
| Passed both, not yet presented/signed | `passed_both` |
| Oregon `ChapterNumber` not null | `enacted` |
| Oregon "Governor vetoed" history action | `vetoed` |
| Referred to committee, none passed | `in_committee` |
| Unrecognized action | ingest error (no default) |
