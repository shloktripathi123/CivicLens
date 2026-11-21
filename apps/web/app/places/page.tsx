import { API_URL, placeHref, type PlaceSummary } from "@/lib/api";
import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata = { title: "Browse places — Civic Lens" };

export default async function PlacesIndex() {
  const states: PlaceSummary[] = await fetch(`${API_URL}/v1/places`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { items: [] })).then((d) => d.items).catch(() => []);
  return (
    <article>
      <Breadcrumbs parents={[]} current="States and territories" />
      <h1>Browse by state</h1>
      <p className="lead">Choose a state or territory, then a county. Or search a city, county, state or ZIP code from the home page.</p>
      {states.length === 0 && <p className="empty" role="alert">Places are unavailable right now.</p>}
      <ul className="plain cols">
        {states.map((s) => <li key={s.id}><a href={placeHref(s.id)}>{s.label}</a></li>)}
      </ul>
    </article>
  );
}
