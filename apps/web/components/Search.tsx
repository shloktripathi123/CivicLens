"use client";
import { useEffect, useRef, useState } from "react";
import { API_URL, PLACE_TYPE_LABEL, describe, placeHref, type Person, type PlaceSummary } from "@/lib/api";

export default function Search({ peopleOnly = false }: { peopleOnly?: boolean }) {
  const [officeType, setOfficeType] = useState("");
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState("");
  const [results, setResults] = useState<Person[] | null>(null);
  const [places, setPlaces] = useState<PlaceSummary[]>([]);
  const [placeTotal, setPlaceTotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placeError, setPlaceError] = useState(false);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  function params(extra?: string | null) {
    const p = new URLSearchParams({ q: q.trim(), limit: "20" });
    if (level) p.set("level", level);
    if (status) p.set("status", status);
    if (body) p.set("body", body);
    if (state) p.set("state", state.toUpperCase());
    if (officeType) p.set("office_type", officeType);
    if (extra) p.set("cursor", extra);
    return p.toString();
  }

  async function run(more?: string | null) {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const placeReq = more || peopleOnly ? null : fetch(`${API_URL}/v1/places/search?q=${encodeURIComponent(q.trim())}&limit=8`).catch(() => null);
      const res = await fetch(`${API_URL}/v1/search?${params(more)}`);
      if (!res.ok) {
        const failure = await res.json().catch(() => null) as { error?: unknown } | null;
        throw new Error(typeof failure?.error === "string" ? failure.error : "Search is temporarily unavailable. Please try again in a moment.");
      }
      const data = await res.json();
      if (mine !== seq.current) return;
      if (placeReq) {
        const pr = await placeReq;
        const pd = pr && pr.ok ? await pr.json() : null;
        if (mine !== seq.current) return;
        setPlaceError(!pd);
        setPlaces(pd?.results ?? []);
        setPlaceTotal(pd?.total ?? 0);
      }
      setResults((prev) => (more && prev ? [...prev, ...data.results] : data.results));
      setTotal(data.total);
      setCursor(data.nextCursor);
    } catch (failure) {
      if (mine === seq.current) {
        const message = failure instanceof Error ? failure.message : "";
        setError(message.startsWith("Search is temporarily unavailable")
          ? message
          : "Search is temporarily unavailable. Please try again in a moment.");
      }
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }

  useEffect(() => {
    seq.current++;
    setResults(null);
    setPlaces([]);
    setPlaceTotal(0);
    setTotal(0);
    setCursor(null);
    setError(null);
    setPlaceError(false);
    if (!q.trim()) { setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => run(), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, level, status, body, state, officeType]);

  return (
    <div className="search">
      <form role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) run(); }}>
        <label htmlFor="q" className="lead" style={{ display: "block" }}>{peopleOnly ? "Search for a person by name" : "Search by name or place"}</label>
        <input id="q" type="search" autoComplete="off" autoFocus value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={peopleOnly ? "e.g. Donald Trump, Elizabeth Warren, Kamala Harris" : "e.g. Elizabeth Warren, governor oregon, 97201, Portland, Multnomah County"} />
        <div className="filters">
          <label>Level
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">All</option><option value="federal">Federal</option>
              <option value="state">State</option>
            </select></label>
          <label>Body
            <select value={body} onChange={(e) => setBody(e.target.value)}>
              <option value="">Any</option><option value="Senate">Senate</option><option value="House">House</option>
            </select></label>
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option><option value="current">Current</option><option value="former">Former</option><option value="candidate">Candidate (not in office)</option>
            </select></label>
          {peopleOnly && (
            <label>Office type
              <select value={officeType} onChange={(e) => setOfficeType(e.target.value)}>
                <option value="">Any</option><option value="president">President</option><option value="vice_president">Vice President</option>
                <option value="senate">Senator</option><option value="house">Representative</option><option value="governor">Governor</option>
                <option value="cabinet">Cabinet</option><option value="judge">Judge or Justice</option>
              </select></label>
          )}
          <label>State (e.g. MA)
            <input value={state} maxLength={2} onChange={(e) => setState(e.target.value)} />
          </label>
          {(level || body || status || state || officeType) && <button type="button" onClick={() => {
            setLevel(""); setBody(""); setStatus(""); setState(""); setOfficeType("");
          }}>Clear filters</button>}
        </div>
      </form>

      <div className="status" role="status" aria-live="polite">
        {loading ? "Searching…" : error ? "" : results ? `${total} result${total === 1 ? "" : "s"}` : ""}
      </div>
      {error && <p className="empty" role="alert">{error}</p>}
      {placeError && !error && <p className="empty" role="alert">Place search is temporarily unavailable. People results may still be shown.</p>}
      {places.length > 0 && (
        <section aria-labelledby="places-h">
          <h2 id="places-h">Places</h2>
          <ul className="results">
            {places.map((pl) => (
              <li key={pl.id}>
                <a className="card" href={placeHref(pl.id)}>
                  <span>
                    <span className="name">{pl.label}{pl.type === "state" ? "" : `, ${pl.stateName}`}</span>
                    <span className="chip">{PLACE_TYPE_LABEL[pl.type]}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          {placeTotal > places.length && <p className="meta">{placeTotal - places.length} more places match. Add a state to narrow, for example “{q.trim()}, OR”.</p>}
        </section>
      )}
      {results && results.length === 0 && places.length === 0 && !error && !placeError && (
        <p className="empty">Nothing matches “{q}”. Check the spelling, try just a last name or a state, or remove filters.</p>
      )}
      {results && results.length > 0 && <h2>People and candidates</h2>}
      <ul className="results">
        {results?.map((p) => (
          <li key={p.id}>
            <a className="card" href={p.candidacy && p.status === "candidate" ? `/candidates/${p.id}` : `/people/${p.id}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.photoUrl ? <img className="avatar" src={p.photoUrl} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} /> : <span className="avatar" />}
              <span>
                <span className="name">{p.name}</span>
                {p.status !== "candidate" && <span className="chip">{p.status === "current" ? "Current" : "Former"}</span>}
                {p.candidacy && <span className="chip">Candidate for {p.candidacy.office} · {p.candidacy.electionYear}</span>}
                <br /><span className="meta">{describe(p)}{p.years ? ` · ${p.years}` : ""}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {cursor && <button onClick={() => run(cursor)} disabled={loading}>Show more</button>}
    </div>
  );
}
