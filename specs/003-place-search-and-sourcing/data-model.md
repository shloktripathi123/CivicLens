# Data Model: Place Search & Sourcing

Extends the 001 and 002 models.

```
place (state) 1──* place (county) 1──* place (city)
place (zip) *──* place (county|city) via place_overlap(share)
place ──* place_jurisdiction ──> office / district
subject (person | candidacy | place) 1──* section_state
fact 1──* fact_citation *──1 source *──1 rubric(version)
fact 1──* conflict (when citations disagree)
```

| Entity | Fields | Rules |
|---|---|---|
| place | id, type, name, name_norm, state, fips, population?, lat, lon, parent_id | Unique (type, fips or zip) |
| place_alias | place_id, alias_norm | "st louis", "saint louis" |
| place_overlap | place_id, other_place_id, relation, share | Share from land area; ZIP results flagged approximate |
| place_jurisdiction | place_id, office_id or district, relation | Only rows with a source; gaps shown as section states |
| source | id, name, url, type, credibility_grade, rationale, rubric_version, criteria_json | Grade and rationale NOT NULL |
| rubric | version, criteria_json, published_at | Append-only |
| fact_citation | subject_id, fact_key, source_id, url, retrieved_at, credibility_grade, archive_url, stale | URL, date and grade NOT NULL |
| section_state | subject_id, section, state, sources_checked_json, checked_at | state in sourced, sourced_low, not_found, not_yet_checked; every defined section has a row |
| exclusion_rule | category, reason | Enforced at ingest and in API output |
| correction_report | id, target, note, status | Reported excluded items are hidden pending review |

Section list (all subjects of the same kind show all of them): identity, offices, background, education, career, party, affiliations, bills, votes, funding, ratings, agenda, endorsements, contact. Place pages: federal, state, county, city, races, districts.
