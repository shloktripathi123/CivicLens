export const metadata = { title: "Coverage — Civic Lens" };

// Targets are commitments; "Today" is what is actually ingested. Anything not listed as sourced shows as a gap on the page.
const ROWS = [
  ["Federal officials (current and former)", "All members of Congress since 1789", "Sourced", "congress-legislators"],
  ["Federal candidates", "All FEC-registered candidates for the current cycle", "Partial: limited by the FEC API key rate limit", "fec-openfec"],
  ["State executives and legislators", "All 50 states", "Oregon governor race only", "oregon-sos-curated"],
  ["Counties and cities", "Elected officials in every county and city", "Not yet checked. Pages show a labeled gap and link to official sites", "—"],
  ["Places", "All states, counties, cities and ZIP areas", "Sourced", "census-geography"],
];

export default function Coverage() {
  return (
    <article>
      <h1>Coverage</h1>
      <p className="lead">What Civic Lens aims to cover, and what is covered today. Missing data is shown as a labeled gap, never guessed.</p>
      <table>
        <thead><tr><th>Area</th><th>Target</th><th>Today</th><th>Source</th></tr></thead>
        <tbody>
          {ROWS.map(([a, t, n, s]) => (
            <tr key={a}><th scope="row">{a}</th><td>{t}</td><td>{n}</td><td>{s === "—" ? s : <a href={`/sources/${s}`}>{s}</a>}</td></tr>
          ))}
        </tbody>
      </table>
      <p><a href="/rubric">How sources are graded</a></p>
    </article>
  );
}
