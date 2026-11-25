import BillStatus from "@/components/BillStatus";
import { API_URL, BILL_STATUS_LABEL, type Bill } from "@/lib/api";

export const metadata = { title: "Bills — Civic Lens" };

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; offset?: string }> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ jurisdiction: "OR", limit: "25" });
  if (sp.q) qs.set("q", sp.q);
  if (sp.status && sp.status in BILL_STATUS_LABEL) qs.set("status", sp.status);
  const offset = Math.max(0, Number(sp.offset) || 0);
  qs.set("offset", String(offset));
  const res = await fetch(`${API_URL}/v1/bills?${qs}`, { cache: "no-store" }).catch(() => null);
  const { total, items } = res?.ok
    ? await res.json() as { total: number; items: Bill[] }
    : { total: 0, items: [] as Bill[] };
  const next = new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), offset: String(offset + 25) });
  return (
    <article>
      <h1>Bills</h1>
      <p className="lead">Oregon Legislature bills in our data. A bill is only a law once it is shown as “Enacted into law”.</p>
      {!res?.ok && <p className="empty" role="alert">Bills are temporarily unavailable. Please try again shortly.</p>}
      <form method="get" role="search" className="searchform">
        <label>Search bills <input name="q" defaultValue={sp.q ?? ""} /></label>
        <label>Status{" "}
          <select name="status" defaultValue={sp.status ?? ""}>
            <option value="">Any</option>
            {Object.entries(BILL_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <button type="submit">Filter</button>
      </form>
      {res?.ok && <p className="src">{total.toLocaleString()} bills. Status is mapped from the legislature’s own records; Civic Lens does not predict outcomes.</p>}
      <ul className="results">
        {items.map((b) => (
          <li key={b.id}>
            <a className="card" href={`/bills/${encodeURIComponent(b.id)}`}>
              <span>
                <span className="name">{b.number} — {b.title}</span>
                <BillStatus status={b.status} isLaw={b.isLaw} />
                <span className="chip">{b.session}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {offset + 25 < total && <p><a href={`/bills?${next}`}>Next page</a></p>}
    </article>
  );
}
