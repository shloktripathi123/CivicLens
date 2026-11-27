import BillStatus from "@/components/BillStatus";
import { API_URL, BILL_STATUS_LABEL, type Bill } from "@/lib/api";

export const metadata = { title: "Bills — Civic Lens" };

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ q?: string; state?: string; status?: string; offset?: string }> }) {
  const sp = await searchParams;
  const state = sp.state?.trim().toUpperCase() ?? "";
  const invalidState = state !== "" && !/^[A-Z]{2}$/.test(state);
  const qs = new URLSearchParams({ limit: "25" });
  if (state && !invalidState) qs.set("jurisdiction", state);
  if (sp.q) qs.set("q", sp.q);
  if (sp.status && sp.status in BILL_STATUS_LABEL) qs.set("status", sp.status);
  const parsedOffset = Number(sp.offset ?? 0);
  const invalidOffset = sp.offset !== undefined && (!/^\d+$/.test(sp.offset) || !Number.isSafeInteger(parsedOffset));
  const offset = invalidOffset ? 0 : parsedOffset;
  qs.set("offset", String(offset));
  const res = invalidState || invalidOffset ? null : await fetch(`${API_URL}/v1/bills?${qs}`, { cache: "no-store" }).catch(() => null);
  const { total, items } = res?.ok
    ? await res.json() as { total: number; items: Bill[] }
    : { total: 0, items: [] as Bill[] };
  const next = new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(state ? { state } : {}), ...(sp.status ? { status: sp.status } : {}), offset: String(offset + 25) });
  const previous = new URLSearchParams(next);
  previous.set("offset", String(Math.max(0, offset - 25)));
  return (
    <article>
      <h1>Bills</h1>
      <p className="lead">State legislation in our data. Coverage varies by state and may be incomplete; check the source for current status.</p>
      {invalidState ? <p className="empty" role="alert">Enter a two-letter state code.</p> : invalidOffset ? <p className="empty" role="alert">Invalid page offset. Clear filters to return to the first page.</p> : !res?.ok && <p className="empty" role="alert">Bills are temporarily unavailable. Please try again shortly.</p>}
      <form method="get" role="search" className="searchform">
        <label>Search bills <input name="q" defaultValue={sp.q ?? ""} /></label>
        <label>State (e.g. OR) <input name="state" defaultValue={state} maxLength={2} pattern="[A-Za-z]{2}" /></label>
        <label>Status{" "}
          <select name="status" defaultValue={sp.status ?? ""}>
            <option value="">Any</option>
            {Object.entries(BILL_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <button type="submit">Filter</button>
        {(sp.q || sp.state || sp.status || sp.offset) && <a href="/bills">Clear filters</a>}
      </form>
      {res?.ok && <p className="src">{total.toLocaleString()} bills in our data. Status may be unverified; Civic Lens does not predict outcomes.</p>}
      {res?.ok && items.length > 0 && <p className="status">Showing {offset + 1}–{offset + items.length} of {total.toLocaleString()} bills.</p>}
      {res?.ok && items.length === 0 && <p className="empty">No bills found in our data for these filters. Coverage may be incomplete.</p>}
      <ul className="results">
        {items.map((b) => (
          <li key={b.id}>
            <a className="card" href={`/bills/${encodeURIComponent(b.id)}`}>
              <span>
                <span className="name">{b.number}{b.title !== b.number && ` — ${b.title}`}</span>
                <BillStatus status={b.status} isLaw={b.isLaw} />
                <span className="chip">{b.jurisdiction}</span>
                <span className="chip">{b.session}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {res?.ok && (offset > 0 || offset + items.length < total) && (
        <nav aria-label="Bill pages">
          {offset > 0 && <a href={`/bills?${previous}`}>Previous page</a>}
          {offset > 0 && offset + items.length < total && " · "}
          {offset + items.length < total && <a href={`/bills?${next}`}>Next page</a>}
        </nav>
      )}
    </article>
  );
}
