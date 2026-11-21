import { KIND_TITLE, type LocalGov } from "@/lib/api";

export default async function LocalGovernment({ placeId, apiUrl }: { placeId: string; apiUrl: string }) {
  const res = await fetch(`${apiUrl}/v1/places/${encodeURIComponent(placeId)}/local`, { cache: "no-store" }).catch(() => null);
  const g: LocalGov | null = res && res.ok ? await res.json() : null;
  if (!g) return null;
  return (
    <section className="block" aria-labelledby="local-h">
      <h2 id="local-h">Local government</h2>
      {g.notes.map((n) => <p key={n} className="src">{n}</p>)}
      {g.school && <p className={g.school.state === "resolved" ? "src" : "empty"}>{g.school.note}</p>}
      {g.groups.map((grp) => (
        <div key={grp.kind}>
          <h3>{KIND_TITLE[grp.kind]}</h3>
          {grp.units.length === 0 ? (
            <p className="empty">
              {grp.kind === "special_district"
                ? "No special districts are published in our data for this place. Ports, transit, water and fire districts may still apply; check your county's website."
                : "Not in our data for this place yet."}
            </p>
          ) : (
            <ul className="results">
              {grp.units.map((u) => (
                <li key={u.id}>
                  <a className="card" href={`/government/${encodeURIComponent(u.id)}`}>
                    <span><span className="name">{u.name}</span><br />
                      <span className="meta">{u.form ?? "Board not in our data"}{u.offices.length ? ` · ${u.offices.length} office type${u.offices.length === 1 ? "" : "s"}` : ""}</span></span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}
