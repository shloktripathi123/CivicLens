import { notFound, redirect } from "next/navigation";
import Conflict from "@/components/Conflict";
import Cite from "@/components/Cite";
import DeepRecord from "@/components/DeepRecord";
import { API_URL, describe, type Profile, type Provenance } from "@/lib/api";

async function load(id: string): Promise<Profile | null> {
  const res = await fetch(`${API_URL}/v1/people/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await load(id).catch(() => null);
  return { title: p ? `${p.person.name} — Civic Lens` : "Civic Lens" };
}

function Src({ p }: { p: Provenance }) {
  return <Cite p={p} />;
}

const SECTION_LABELS: Record<string, string> = {
  identity: "Identity", terms: "Terms", committees: "Committees", contact: "Contact", background: "Background",
  bills: "Bills", votes: "Votes", funding: "Funding", affiliations: "Affiliations", ratings: "Ratings",
};

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await load(id);
  if (!p) notFound();
  if ((p.terms ?? []).length === 0 && p.person.candidacy) redirect(`/candidates/${id}`);
  const { person, contact } = p;
  const terms = p.terms ?? [];
  const committees = p.committees ?? [];
  const background = p.background ?? [];
  const coverage = p.coverage ?? {};
  const ordered = [...terms].reverse();

  return (
    <article>
      <div className="profile-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {person.photoUrl && <img src={person.photoUrl} alt={`Official portrait of ${person.name}`} />}
        <div>
          <h1>{person.name} <span className="chip">{person.status === "current" ? "Current" : "Former"}</span></h1>
          <p className="lead">{describe(person)} · {person.years}</p>
          {person.candidacy && (
            <p><a href={`/candidates/${id}`}>Candidate for {person.candidacy.office} ({person.candidacy.electionYear}) — view candidate profile</a></p>
          )}
          <p className="src">Data last updated {p.lastUpdated ? new Date(p.lastUpdated).toLocaleDateString() : "unknown"}</p>
          <nav aria-label="Profile sections" className="src">
            Jump to: <a href="#terms">Offices</a> · <a href="#comm">Committees</a> · <a href="#contact">Contact</a> · <a href="#deep-h">Full record</a>
          </nav>
        </div>
      </div>

      <section className="block" aria-labelledby="cov">
        <h2 id="cov">Data coverage</h2>
        <ul className="cov">
          {Object.entries(coverage).map(([k, v]) => (
            <li key={k} className={v}>{SECTION_LABELS[k] ?? k}: {v}</li>
          ))}
        </ul>
        <p className="src">Coverage varies by person and source. See the full record below for available details.</p>
      </section>

      <section className="block" aria-labelledby="terms">
        <h2 id="terms">Offices held</h2>
        <table>
          <thead><tr><th>Office</th><th>State / district</th><th>Party</th><th>Served</th></tr></thead>
          <tbody>
            {ordered.map((t, i) => (
              <tr key={i}>
                <td>{t.title}<br /><span className="src">{t.body}</span></td>
                <td>{t.state}{t.district ? ` · ${t.district}` : ""}</td>
                <td>{t.party ?? <span className="na">Not available</span>}</td>
                <td>{t.start ? t.start.slice(0, 10) : "Start not provided"} → {t.end ? t.end.slice(0, 10) : "present"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {terms[0] && <Src p={terms[0].provenance} />}
      </section>

      <section className="block" aria-labelledby="comm">
        <h2 id="comm">Committees</h2>
        {committees.length ? (
          <>
            <ul>
              {committees.map((c) => (
                <li key={c.id}>
                  {c.url ? <a href={c.url}>{c.name}</a> : c.name}
                  {c.subcommittee && <span className="src"> (subcommittee)</span>}
                  {c.role !== "Member" && <span className="chip">{c.role}</span>}
                </li>
              ))}
            </ul>
            <Src p={committees[0].provenance} />
          </>
        ) : (
          <p className="na">Not available{person.status === "former" ? " (committee history is not yet included for former members)" : ""}.</p>
        )}
      </section>

      <section className="block" aria-labelledby="bg">
        <h2 id="bg">Background</h2>
        {background.length ? (
          <ul>{background.map((b, i) => <li key={i}>{b.detail} <Src p={b.provenance} /></li>)}</ul>
        ) : <p className="na">Not available.</p>}
      </section>

      <section className="block" aria-labelledby="contact">
        <h2 id="contact">Contact and links</h2>
        {(contact.website || contact.phone || contact.address || contact.contactForm || (contact.social ?? []).length) ? (
          <>
            <ul>
              {contact.website && <li><a href={contact.website}>Official website</a></li>}
              {contact.contactForm && <li><a href={contact.contactForm}>Contact form</a></li>}
              {contact.phone && <li>Phone: {contact.phone}</li>}
              {contact.address && <li>Office: {contact.address}</li>}
              {(contact.social ?? []).map((s) => <li key={s.platform}><a href={s.url}>{s.platform}: {s.handle}</a> {s.provenance && <Src p={s.provenance} />}</li>)}
            </ul>
            <Src p={contact.provenance} />
          </>
        ) : <p className="na">Not available.</p>}
      </section>
      <DeepRecord deep={p.deep} person={person} />
      <Conflict items={p.conflicts ?? []} />
    </article>
  );
}
