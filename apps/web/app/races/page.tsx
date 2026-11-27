import { API_URL, type Race } from "@/lib/api";
import FilterableList from "@/components/FilterableList";

export const metadata = { title: "Races — Civic Lens" };

export default async function RacesPage({ searchParams }: { searchParams: Promise<{ state?: string; office?: string; year?: string }> }) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const k of ["state", "office", "year"] as const) if (sp[k]) q.set(k, sp[k]!);
  const res = await fetch(`${API_URL}/v1/races?${q}`, { cache: "no-store" }).catch(() => null);
  const items: Race[] = res?.ok ? (await res.json()).items : [];
  return (
    <article>
      <h1>Races</h1>
      <form className="filters" method="get">
        <label>State (e.g. OR)<input name="state" maxLength={2} defaultValue={sp.state} /></label>
        <label>Office<input name="office" defaultValue={sp.office} placeholder="governor, senate…" /></label>
        <label>Year<input name="year" defaultValue={sp.year} inputMode="numeric" /></label>
        <button type="submit">Filter</button>
        {(sp.state || sp.office || sp.year) && <a href="/races">Clear filters</a>}
      </form>
      {!res?.ok && <p className="empty" role="alert">{res?.status === 400 ? "Enter a valid two-letter state and whole-number year." : "Races are unavailable right now."}</p>}
      {res?.ok && items.length === 0 && <p className="empty">No races match these filters.</p>}
      {res?.ok && items.length === 2000 && <p className="src">Showing up to 2,000 races returned by the service; use the filters to narrow the results.</p>}
      <FilterableList label="races" listClassName="results" search={false} items={items.map((r) => ({
        id: r.id, text: "", content: (
            <a className="card" href={`/races/${encodeURIComponent(r.id)}`}>
              <span>
                <span className="name">{r.office}</span><br />
                <span className="meta">{r.electionDate} · {r.candidates.length === 0 ? "candidate list not yet published here" : `${r.candidates.length} candidate${r.candidates.length === 1 ? "" : "s"}`}</span>
              </span>
            </a>
        ),
      }))} />
    </article>
  );
}
