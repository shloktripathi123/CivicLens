# Data Model

All fact-bearing tables include `source_id` (FK → `source`) and `as_of` (date). `id` fields are UUIDs; external IDs live in `person_identifier`.

- **source**(id, name, url, license, attribution, retrieved_at)
- **person**(id, canonical_name, given, family, suffix, birth_date, birth_place, death_date, photo_url, photo_license, status[current|former])
- **person_identifier**(person_id, scheme[bioguide|fec|openstates|wikidata|ocd|govtrack|...], value)
- **person_name**(person_id, name, kind[legal|nickname|variant|maiden|ascii]) — feeds search
- **jurisdiction**(id, level[federal|state|county|local], name, state, ocd_id, parent_id)
- **body**(id, jurisdiction_id, branch[legislative|executive|judicial], name, chamber)
- **office_term**(id, person_id, body_id, title, district, party, start_date, end_date, leadership_role, appointed bool)
- **committee**(id, body_id, parent_id, name) / **committee_membership**(person_id, committee_id, role, start, end)
- **caucus_membership**(person_id, caucus, start, end)
- **background_entry**(id, person_id, kind[education|career|prior_office|military|other], org, title, start_year, end_year, detail)
- **bill**(id, body_id, session, number, title, plain_summary, summary_generated bool, status, introduced_date, text_url, sponsor_person_id)
- **bill_cosponsor**(bill_id, person_id, date, withdrawn_date)
- **bill_action**(bill_id, date, text, status)
- **bill_topic**(bill_id, topic)
- **roll_call**(id, body_id, date, question, bill_id?, result, yea, nay, present, not_voting) — partitioned by year
- **vote**(roll_call_id, person_id, position[yea|nay|present|not_voting])
- **funding_cycle**(id, person_id, cycle, total_raised, total_spent, cash_on_hand, period_end)
- **funding_contributor**(funding_cycle_id, name, kind[individual|pac|org], industry, amount)
- **disclosure**(id, person_id, year, url, kind)
- **rating_publisher**(id, name, url, methodology_url, license_status)
- **rating**(id, person_id, publisher_id, year, value, label)
- **endorsement**(id, person_id, org, cycle, url)
- **coverage**(subject_type[person|jurisdiction], subject_id, section, status[complete|partial|unavailable], updated_at)

**Derived (neutral, method shown)**: missed-vote %, shared-vote agreement % between two persons.

**Invariants**: no fact row without `source_id` + `as_of`; person merges only via deterministic ID match or reviewed queue; `office_term` dates non-overlapping per (person, body, seat).
