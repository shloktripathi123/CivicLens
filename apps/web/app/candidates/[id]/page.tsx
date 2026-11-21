import { notFound } from "next/navigation";
import Conflict from "@/components/Conflict";
import Cite from "@/components/Cite";
import { API_URL, STATUS_LABEL, describe, usd, type CandidateProfile, type Provenance } from "@/lib/api";

async function load(id: string): Promise<CandidateProfile | null> {
  const res = await fetch(`${API_URL}/v1/candidates/${id}`, { next: { revalidate: 3600 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await load(id).catch(() => null);
  return { title: p ? `${p.person.name}, candidate for ${p.candidacy.office} — Civic Lens` : "Civic Lens" };
}

function Src({ p }: { p: Provenance }) {
  return <Cite p={p} />;
}

const LABELS: Record<string, string> = {
  candidacy: "Candidacy", identity: "Identity", background: "Background", education: "Education", agenda: "Agenda",
  funding: "Funding", bills: "Bills", votes: "Votes", ratings: "Ratings", affiliations: "Affiliations",
};
const SHOWN = ["candidacy", "background", "education", "agenda", "funding", "bills", "votes", "ratings", "affiliations"];

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await load(id);
  if (!p) notFound();
  const { person, candidacy, race, background, committees, links, agenda, record, finance, coverage } = p;
  const hasBackground = background.items.length + background.education.length + background.career.length > 0;

  return (
    <article>
      <div className="profile-head">
        {person.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.photoUrl} alt="" />
        )}
        <div>
          <h1>{person.name}</h1>
          <p className="lead">
            Candidate for {candidacy.office} · {candidacy.electionYear} general election ({candidacy.electionDate})
          </p>
          <p>
            <span className="chip">{candidacy.party ?? "Party not available"}</span>
            <span className="chip">{STATUS_LABEL[candidacy.status] ?? candidacy.status}</span>
            {candidacy.incumbent && <span className="chip">Incumbent</span>}
          </p>
          <p><a href={`/races/${encodeURIComponent(race.id)}`}>See everyone in this race</a>
            {record.terms.length > 0 && <> · <a href={`/people/${id}`}>Full official record</a></>}</p>
          <p className="src">Data last updated {p.lastUpdated ? new Date(p.lastUpdated).toLocaleDateString() : "unknown"}</p>
        </div>
      </div>

      <section className="block" aria-labelledby="cov">
        <h2 id="cov">Data coverage</h2>
        <ul className="cov">
          {SHOWN.map((k) => <li key={k} className={coverage[k] ?? "unavailable"}>{LABELS[k]}: {coverage[k] ?? "unavailable"}</li>)}
        </ul>
      </section>

      <section className="block" aria-labelledby="ov">
        <h2 id="ov">Overview</h2>
        <ul>
          <li>Office sought: {candidacy.office}</li>
          <li>Party: {candidacy.party ?? <span className="na">Not available</span>}</li>
          <li>Status: {STATUS_LABEL[candidacy.status] ?? candidacy.status}</li>
          <li>Campaign website: {candidacy.website ? <a href={candidacy.website}>{candidacy.website}</a> : <span className="na">Not available</span>}</li>
          {record.terms.length > 0 && <li>Current or previous role: {describe(person)}</li>}
        </ul>
        <Src p={candidacy.provenance} />
      </section>

      <section className="block" aria-labelledby="bg">
        <h2 id="bg">Background</h2>
        {hasBackground ? (
          <>
            <ul>
              {background.items.map((b, i) => <li key={i}>{b.detail} <Src p={b.provenance} /></li>)}
              {background.education.map((e, i) => (
                <li key={`e${i}`}>{[e.degree, e.institution, e.year].filter(Boolean).join(", ")} <Src p={e.provenance} /></li>
              ))}
              {background.career.map((c, i) => (
                <li key={`c${i}`}>{c.title}{c.org ? `, ${c.org}` : ""}{c.start ? ` (${c.start === c.end ? c.start : `${c.start}–${c.end ?? "present"}`})` : ""} <Src p={c.provenance} /></li>
              ))}
            </ul>
          </>
        ) : <p className="na">Not available. Education and career history are not yet included.</p>}
      </section>

      <section className="block" aria-labelledby="cm">
        <h2 id="cm">Committees</h2>
        {committees.length ? (
          <ul>{committees.map((c, i) => <li key={i}>{c.name} <span className="chip">{c.role}</span> <Src p={c.provenance} /></li>)}</ul>
        ) : <p className="na">Not available. No committee assignments are documented for this candidate.</p>}
      </section>

      <section className="block" aria-labelledby="links">
        <h2 id="links">Contact and links</h2>
        {links.length || candidacy.website ? (
          <ul>
            {candidacy.website && <li><a href={candidacy.website}>Campaign website</a></li>}
            {links.map((l, i) => <li key={i}><a href={l.url}>{l.platform}: {l.handle}</a> <Src p={l.provenance} /></li>)}
          </ul>
        ) : <p className="na">Not available.</p>}
      </section>

      <section className="block" aria-labelledby="say">
        <h2 id="say">What they say</h2>
        <p className="src">Positions the campaign has stated itself. Civic Lens does not edit or summarize them.</p>
        {agenda.items.length ? (
          <ul>
            {agenda.items.map((a, i) => (
              <li key={i}><strong>{a.topic}:</strong> {a.text}{" "}
                <span className="src">From <a href={a.sourceUrl}>{a.origin}</a>, captured {a.capturedAt}</span></li>
            ))}
          </ul>
        ) : <p className="na">Not available. Agenda collection has not been added for this candidate yet.</p>}
      </section>

      <section className="block" aria-labelledby="did">
        <h2 id="did">What they’ve done</h2>
        {record.terms.length ? (
          <>
            <table>
              <thead><tr><th>Office</th><th>Party</th><th>Served</th></tr></thead>
              <tbody>
                {[...record.terms].reverse().map((t, i) => (
                  <tr key={i}>
                    <td>{t.title}<br /><span className="src">{t.body}</span></td>
                    <td>{t.party ?? <span className="na">Not available</span>}</td>
                    <td>{t.start.slice(0, 10)} → {t.end ? t.end.slice(0, 10) : "present"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Src p={record.terms[0].provenance} />
          </>
        ) : <p className="na">No offices held are in our data yet (state and local history is still being added).</p>}
        <p className="na">Bills and votes: not available yet.</p>
      </section>

      <section className="block" aria-labelledby="money">
        <h2 id="money">Money</h2>
        {finance ? (
          <>
            <ul>
              <li>Total raised ({finance.cycle} cycle): {usd(finance.receipts)}</li>
              <li>Total spent: {usd(finance.disbursements)}</li>
              <li>Cash on hand: {usd(finance.cashOnHand)}</li>
            </ul>
            <Src p={finance.provenance} />
          </>
        ) : <p className="na">Not available.</p>}
      </section>
      <Conflict items={p.conflicts ?? []} />
    </article>
  );
}
