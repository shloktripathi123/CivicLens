import { API_URL } from "@/lib/api";

export const metadata = { title: "Coverage — Civic Lens" };

const ROWS = [
  { area: "Federal officials (current and former)", target: "All members of Congress since 1789", note: "Coverage varies by record and source.", sources: ["congress-legislators"] },
  { area: "Federal candidates", target: "All FEC-registered candidates for the current cycle", note: "Incomplete; unmatched filings are omitted and API limits may restrict coverage.", sources: ["fec-openfec"] },
  { area: "State executives and legislators", target: "All 50 states", note: "Coverage varies by state and ingest; state races are not comprehensive.", sources: ["openstates-people", "oregon-sos-curated"] },
  { area: "Counties and cities", target: "Elected officials in every county and city", note: "Partial. Place pages identify gaps and link to official sites.", sources: ["local-gov-official"] },
  { area: "Places", target: "All states, counties, cities and ZIP areas", note: "Coverage depends on the Census data ingested.", sources: ["census-geography"] },
] as const;

export default async function Coverage() {
  const res = await fetch(`${API_URL}/v1/sources`, { cache: "no-store" }).catch(() => null);
  const sources: Array<{ id: string; name: string }> = res?.ok ? (await res.json()).items : [];
  return (
    <article>
      <h1>Coverage</h1>
      <p className="lead">What Civic Lens aims to cover and the limitations of its data. Missing data is shown as a labeled gap, never guessed.</p>
      {!res?.ok && <p className="empty" role="alert">Source information is temporarily unavailable.</p>}
      <table>
        <thead><tr><th>Area</th><th>Target</th><th>Coverage notes</th><th>Available sources</th></tr></thead>
        <tbody>
          {ROWS.map((row) => {
            const available = sources.filter((source) => row.sources.some((id) => id === source.id));
            return <tr key={row.area}><th scope="row">{row.area}</th><td>{row.target}</td><td>{row.note}</td><td>
              {available.length ? available.map((source, i) => <span key={source.id}>{i > 0 && ", "}<a href={`/sources/${encodeURIComponent(source.id)}`}>{source.name}</a></span>) : "Not available"}
            </td></tr>;
          })}
        </tbody>
      </table>
      <p><a href="/rubric">How sources are graded</a></p>
    </article>
  );
}
