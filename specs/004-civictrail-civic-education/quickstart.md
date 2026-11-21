# Quickstart: CivicTrail (004)

Validation scenarios run after each phase. All require `npm test` (existing 39 + new) green.

1. **Audit**: `npm run audit` (Phase 0) prints each area's status; compare with the spec's audit table.
2. **Address**: `curl -X POST localhost:4000/v1/representatives -d '{"address":"900 Court St NE, Salem, OR"}'` returns one U.S. House member, two U.S. senators, one state senator, one state representative, county and school district entries (or labeled gaps). Confirm the address is absent from the DB and server logs.
3. **ZIP**: `/v1/places/zip:97229/representatives` returns `splitCertainty` and prompts for an address when not `exact`.
4. **Bills**: open an Oregon enacted bill (has chapter number) and a pending one; the first shows status "Enacted" and law styling, the second "In committee" with proposal styling.
5. **Elections**: an unverified deadline shows "Not verified" with a link, never a date.
6. **AI summary**: with no provider configured, no AI box appears. With a stub provider returning a number not in the source, the summary is suppressed and logged.
7. **Accessibility**: `npm run test:a11y` reports 0 serious/critical violations at 360 px and 1280 px on every route; keyboard flow completes.
8. **Neutrality/citations**: `npm run lint:content` passes (every guide paragraph cited, grade ≤ 9, no flagged wording).
