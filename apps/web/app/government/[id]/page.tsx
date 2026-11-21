import { notFound } from "next/navigation";
import Cite from "@/components/Cite";
import { API_URL, KIND_TITLE, ROLE_LABEL, type GovUnit } from "@/lib/api";

async function load(id: string): Promise<GovUnit | null> {
  const res = await fetch(`${API_URL}/v1/government/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const u = await load(decodeURIComponent((await params).id)).catch(() => null);
  return { title: u ? `${u.name} — Civic Lens` : "Civic Lens" };
}

export default async function GovernmentRoute({ params }: { params: Promise<{ id: string }> }) {
  const u = await load(decodeURIComponent((await params).id));
  if (!u) notFound();
  return (
    <article>
      <h1>{u.name}, {u.state}</h1>
      <p className="lead"><span className="chip" style={{ marginLeft: 0 }}>{KIND_TITLE[u.kind]}</span> {u.function}</p>
      {u.form && <p>{u.form}. <span className="src">From the unit's official website.</span></p>}
      {u.officialUrl && <p><a href={u.officialUrl}>Official website</a></p>}

      <section className="block" aria-labelledby="offices-h">
        <h2 id="offices-h">Offices and officials</h2>
        {u.offices.length === 0 && <p className="empty">The board and offices of this unit are not in our data yet. Use the official website or your county elections office.</p>}
        {u.offices.map((o) => (
          <div key={o.id}>
            <h3>{o.title} <span className="chip">{ROLE_LABEL[o.role]}</span></h3>
            <p className="meta">
              {[o.selection, o.appointing && `Appointing authority: ${o.appointing}`, o.termYears && `${o.termYears}-year term`, o.termLimit,
                o.seats && `${o.seats} seat${o.seats === 1 ? "" : "s"}`, o.nonpartisan ? "Nonpartisan" : null].filter(Boolean).join(" · ")}
            </p>
            <p className="meta">
              {o.nextElection
                ? `Next election: ${o.nextElection.date} (${o.nextElection.basis}${o.nextElection.rule ? `; ${o.nextElection.rule}` : ""})`
                : "Next election: not in our data. Check your county elections office."}
            </p>
            {o.holders.length > 0 ? (
              <ul className="plain">
                {o.holders.map((h) => (
                  <li key={`${h.name}${h.seat}`}>
                    <strong>{h.name}</strong>{h.seat ? ` · ${h.seat}` : ""}
                    {h.endDate ? <span className="meta"> · term ends {h.endDate}</span> : null}
                    {h.email ? <span className="meta"> · <a href={`mailto:${h.email}`}>{h.email}</a></span> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="empty">Current members are not in our data.</p>}
            {o.holders.length > 0 && o.seats && o.holders.length < o.seats && (
              <p className="src">{o.holders.length} of {o.seats} seats listed; the official page has the full roster.</p>
            )}
            <p><Cite p={o.provenance} label="Source" /> <a className="src" href={o.sourceUrl}>Official page</a></p>
          </div>
        ))}
      </section>

      <section className="block" aria-labelledby="meet-h">
        <h2 id="meet-h">Meetings and taking part</h2>
        {u.meetings.length === 0 && <p className="empty">No meeting schedule read from an official source yet.</p>}
        {u.meetings.map((m) => (
          <div key={m.body}>
            <h3>{m.body}</h3>
            <p>{m.schedule}</p>
            {m.location && <p className="meta">Location: {m.location}</p>}
            {m.attend && <p className="meta">{m.attend}</p>}
            {m.publicComment && <p className="meta">Public comment: {m.publicComment}</p>}
            <p className="src"><a href={m.sourceUrl}>Official page</a></p>
          </div>
        ))}
      </section>

      <section className="block" aria-labelledby="comp-h">
        <h2 id="comp-h">What this page covers</h2>
        <ul className="plain">
          {u.completeness.map((c) => (
            <li key={c.item}>{c.state === "sourced" ? "● " : "○ "}{c.item}{c.note ? <span className="meta"> · {c.note}</span> : null}</li>
          ))}
        </ul>
      </section>
      <p><Cite p={u.provenance} label="Unit record" /></p>
    </article>
  );
}
