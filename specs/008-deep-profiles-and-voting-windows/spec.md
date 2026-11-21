# 008 Deep profiles and voting windows

## Spec
- Every official profile renders a "Full record" block: Identity, Affiliations, Bills passed and sponsored, Floor votes, Projects, Funding and financials, Third-party ratings, plus the existing Offices held (term details), Committees, Background and Contact blocks.
- Absolute render rule: every slot always renders. An empty slot shows "None recorded", what was checked, and that this is a source gap, not a claim that nothing exists.
- Calendar adds registration deadlines, mail-in ballot request windows, ballots-mailed windows and drop-box open/close dates per election.
- Never invent data. Dates are shown only where a rule is curated (Oregon, derived from the election date by statutory offsets, labelled rule-based). Other states show "not in our data" with the official-office link.
- County commissioners, county chairs and special-district boards (feature 006) already exist for the curated Portland-metro units; further counties need verified sources and are not seeded here.

## Plan
- DB: `official_record(person_id, section, ...)` for bills/votes/projects/funding/ratings/affiliations and `voting_window`, both cited (source_id + as_of) and in FACT_TABLES. Module `packages/db/src/deep.ts`.
- API: `/v1/people/:id` adds `deep`; `/v1/calendar` adds `windows` per election.
- Web: `DeepRecord` accordions (`<details>`); null-safe arrays in the profile page; "Key dates" block on `/elections`.

## Tasks
- A1 schema + types (`deep.ts`, `lib/api.ts`) - done
- A2 seed Oregon windows (`votingwindows.ts`) + source grade - done
- B1 `DeepRecord` component + profile integration with null guards - done
- B2 Key dates on elections page - done
- B3 tests (`deep.test.ts`, calendar) and Playwright demo update - done
