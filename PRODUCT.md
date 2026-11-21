# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Inferred (no answer received; the user brief implies it): US voters and students, Oregon first, who look up their officials, bills, elections and places, often on a phone, and need to decide how far to trust what they read. Secondary: civics teachers and journalists checking a source trail.

## Product Purpose
CivicTrail (the in-app name is still "Civic Lens") is a nonpartisan civic education and information platform. Users search any public official, candidate or place (ZIP, city, county, state) and see bills, background, committees, contact details, funding and affiliations. Every fact links to its source and carries a credibility grade (A–D) with a click-through explanation of how it was graded. Success is a user who can find their representatives, understand a bill's status, and verify where each claim came from.

## Positioning
Every fact carries its source link, as-of date and a rubric-based credibility grade, including facts from weaker sources, which are shown and labelled rather than hidden. Proposed bills are visibly separated from enacted laws, and AI summaries (when enabled) are separated from facts.

## Operating Context
Data comes from unitedstates/congress-legislators, FEC, Census, the Oregon Legislature OData service and a hand-curated Oregon set. Web app (Next.js) over a Fastify API; native apps are planned.

## Capabilities and Constraints
- Search by name, ZIP, city, county, state; person, candidate, race, place, bill pages; source grading and exclusion pages.
- Bill status is one of a fixed set; "law" means enacted only.
- Never fabricate; unavailable data is stated as unavailable, never left blank.
- Undecided: native app design language; AI summary provider.

## Brand Commitments
Name shown today: "Civic Lens". Nonpartisan: no ranking by party, no color coding by party.

## Evidence on Hand
Real data only: about 12,800 federal officials, 3,770 Oregon bills, 69k places. No testimonials or usage numbers exist; none may be invented.

## Product Principles
1. Show the source before the claim is trusted.
2. Proposal is never presented as law.
3. Neutral by construction: no party colors, no ordering that implies rank.
4. Say what is missing rather than hiding it.
5. Readable first on a phone.

## Accessibility & Inclusion
WCAG 2.2 AA. Meaning is never carried by color alone. Full keyboard operation, no-JavaScript readable pages, plain language.
