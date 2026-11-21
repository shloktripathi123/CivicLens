# Quickstart: Candidate Search (target behavior once Phase A lands)

1. `npm run ingest` (federal officials, as in 001), then `npm run ingest:candidates` (OR governor race plus FEC federal candidates; needs `FEC_API_KEY` in `.env`).
2. `npm run dev -w @civic/api` and `npm run dev -w @civic/web`.
3. Search "Drazen": expect Christine Drazan with a "Candidate for Governor of Oregon" badge.
4. Open the race page: Kotek and Drazan are listed alphabetically with identical fields.
5. Open the Drazan profile: Overview, Background, "What they say" (with source links and capture dates), "What they've done", Money, Coverage.
6. `npm test`: golden search tests include the candidate queries.
