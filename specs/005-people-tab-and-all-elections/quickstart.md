# Quickstart (005)

```bash
npm install
npm run ingest            # adds executive, wikidata, calendar, fec elections (resumable)
FEC_API_KEY=... npm run ingest   # full federal candidate load
npm run dev:api & npm run dev:web
npm test                  # includes roster, people, races, UI-parity tests
```

Manual checks:
1. Open `/people`, search `Trump`, `Biden`, `Newsom`, `Roberts`: each appears with office, status, link.
2. Open `/people/<biden id>`: one profile showing senator, vice president and president terms.
3. Open `/races`: filter by cycle 2028 → presidential race; cycle 2026 → Senate and House races by state; jurisdictions without candidates show a labeled gap and an official link.
4. Open `/coverage`: loaded versus expected for each election and figure category.
5. Compare with the previous build: only the "People" nav link and the new pages differ visually.
