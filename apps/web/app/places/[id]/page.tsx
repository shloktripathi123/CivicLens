import { notFound } from "next/navigation";
import Cite from "@/components/Cite";
import LocalGovernment from "@/components/LocalGovernment";
import Breadcrumbs from "@/components/Breadcrumbs";
import { API_URL, PLACE_TYPE_LABEL, describe, placeHref, type PlaceLevel, type PlacePage, type SectionState } from "@/lib/api";

type PlaceLoadResult = { kind: "loaded"; page: PlacePage } | { kind: "not-found" } | { kind: "unavailable" };

async function load(id: string): Promise<PlaceLoadResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1/places/${encodeURIComponent(id)}`, { cache: "no-store" });
  } catch {
    return { kind: "unavailable" };
  }
  if (res.status === 404) return { kind: "not-found" };
  if (!res.ok) return { kind: "unavailable" };
  try {
    return { kind: "loaded", page: await res.json() as PlacePage };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await load(decodeURIComponent(id));
  const place = result.kind === "loaded" ? result.page.place : null;
  return { title: place ? `${place.label}${place.type === "state" ? "" : `, ${place.stateName}`} — Civic Lens` : "Civic Lens" };
}

const STATE_TEXT: Record<SectionState, string> = {
  sourced: "● Sourced", sourced_low: "◐ Sourced, lower-credibility", not_found: "○ Checked, nothing found", not_yet_checked: "○ Not yet checked",
};
const LEVEL_TITLE = { federal: "Federal", state: "State", county: "County", city: "City or town" } as const;

function Level({ l }: { l: PlaceLevel }) {
  return (
    <section className="block" aria-labelledby={`lvl-${l.level}`}>
      <h2 id={`lvl-${l.level}`}>{LEVEL_TITLE[l.level]} <span className="chip">{STATE_TEXT[l.state]}</span></h2>
      {l.note && <p className="src">{l.note}</p>}
      {l.officials.length > 0 && (
        <>
          <h3>Officials ({l.officials.length})</h3>
          <ul className="results">
            {l.officials.slice(0, 6).map((p) => (
              <li key={p.id}>
                <a className="card" href={`/people/${p.id}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.photoUrl ? <img className="avatar" src={p.photoUrl} alt="" loading="lazy" /> : <span className="avatar" />}
                  <span><span className="name">{p.name}</span><br /><span className="meta">{describe(p)}</span></span>
                </a>
              </li>
            ))}
          </ul>
          {l.officials.length > 6 && (
            <details>
              <summary>Show {l.officials.length - 6} more</summary>
              <ul className="results">
                {l.officials.slice(6).map((p) => (
                  <li key={p.id}>
                    <a className="card" href={`/people/${p.id}`}>
                      <span><span className="name">{p.name}</span><br /><span className="meta">{describe(p)}</span></span>
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {l.races.length > 0 && (
        <>
          <h3>Races</h3>
          <ul className="results">
            {l.races.map((r) => (
              <li key={r.id}>
                <a className="card" href={`/races/${encodeURIComponent(r.id)}`}>
                  <span><span className="name">{r.office}</span><br />
                    <span className="meta">{r.electionDate} · {r.candidates.length} candidate{r.candidates.length === 1 ? "" : "s"} listed</span></span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {l.gap && (
        <p className="empty">
          {l.gap.reason}{" "}
          {l.gap.sourcesChecked.length > 0 && <>Sources checked: {l.gap.sourcesChecked.join(", ")}. </>}
          <a href={l.gap.officialSiteUrl}>Find the official government site</a>.
        </p>
      )}
    </section>
  );
}

export default async function PlaceRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await load(decodeURIComponent(id));
  if (result.kind === "not-found") notFound();
  if (result.kind === "unavailable") {
    return (
      <article>
        <h1>Location data temporarily unavailable</h1>
        <p className="empty" role="alert">We couldn't load officials and records for this location right now. Please try again shortly.</p>
        <p><a href="/">Return to search</a></p>
      </article>
    );
  }
  const p = result.page;
  const { place } = p;
  return (
    <article>
      <Breadcrumbs parents={p.parents} current={place.label} />
      <h1>{place.label}{place.type === "state" ? "" : `, ${place.stateName}`}</h1>
      <p className="lead">
        <span className="chip" style={{ marginLeft: 0 }}>{PLACE_TYPE_LABEL[place.type]}</span>{" "}
        {p.completeness.sectionsWithData} of {p.completeness.sectionsTotal} levels have sourced data. <span className="src">{p.completeness.rule}</span>
      </p>
      {p.approximateNote && <p className="empty" role="note"><strong>Approximate.</strong> {p.approximateNote}</p>}

      {p.levels.map((l) => <Level key={l.level} l={l} />)}

      {place.type !== "state" && <LocalGovernment placeId={place.id} apiUrl={API_URL} />}

      {p.overlaps.length > 0 && (
        <section className="block" aria-labelledby="overlaps-h">
          <h2 id="overlaps-h">{place.type === "zip" ? "Counties and cities this ZIP overlaps" : "ZIP areas that overlap this place"}</h2>
          <p className="src">Share is the portion of the ZIP area's land inside the place, from Census relationship files.</p>
          <ul className="plain">
            {p.overlaps.slice(0, 60).map((o) => (
              <li key={o.place.id}>
                <a href={placeHref(o.place.id)}>{o.place.label}{o.place.type === "zip" ? "" : `, ${o.place.stateName}`}</a>
                {o.share !== null && <span className="meta"> · {Math.round(o.share * 100)}% of the ZIP area</span>}
              </li>
            ))}
          </ul>
          {p.overlaps.length > 60 && <p className="meta">Showing 60 of {p.overlaps.length}.</p>}
        </section>
      )}

      {p.children.length > 0 && (
        <section className="block" aria-labelledby="children-h">
          <h2 id="children-h">Counties</h2>
          {p.cityCount ? <p className="src">{p.cityCount} cities and towns: {p.cityNote}</p> : null}
          <ul className="plain cols">
            {p.children.map((c) => <li key={c.id}><a href={placeHref(c.id)}>{c.label}</a></li>)}
          </ul>
        </section>
      )}

      {p.provenance && (
        <p><Cite p={p.provenance} label="Place data" /></p>
      )}
    </article>
  );
}
