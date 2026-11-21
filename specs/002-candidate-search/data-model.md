# Data Model: Candidate & Election Search

Extends [001 data model](../001-legislator-search/data-model.md). All tables have `source_id` and `as_of` NOT NULL.

```
person 1──* candidacy *──1 race *──1 election
                 │             └──1 office
                 ├──* agenda_item
                 ├──0..1 finance_summary
                 └──* result (via race)
person 1──* education, career_item
```

| Entity | Fields | Rules |
|---|---|---|
| office | id, level(federal/state/county/local), body, jurisdiction, title, district | Same office may be held (office_term) and sought (race) |
| election | id, date, type, jurisdiction | |
| race | id, election_id, office_id, status | One per office per election |
| candidacy | id, person_id, race_id, party, status, filed_on, website, source_id, as_of | Unique (person, race); requires an authoritative source |
| agenda_item | id, candidacy_id, topic, text, origin, source_url, captured_at | Self-reported; never joined into record data |
| finance_summary | candidacy_id, cycle, receipts, disbursements, cash_on_hand | FEC or state source |
| result | race_id, candidacy_id, votes, percent, certified | Candidacy status becomes won/lost |
| education | person_id, institution, degree, year | Provenance required |
| career_item | person_id, title, org, start, end | Provenance required |

Status transitions: filed → qualified → (withdrawn | won | lost). Profiles persist after the election.
