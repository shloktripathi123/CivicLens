import { notFound } from "next/navigation";
import { API_URL, STATUS_LABEL, type Race } from "@/lib/api";

async function load(id: string): Promise<Race | null> {
  const res = await fetch(`${API_URL}/v1/races/${encodeURIComponent(id)}`, { next: { revalidate: 3600 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export default async function RacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const race = await load(decodeURIComponent(id));
  if (!race) notFound();
  return (
    <article>
      <h1>{race.office}</h1>
      <p className="lead">{race.electionType} election · {race.electionDate} · {race.status}</p>
      <p className="src">Candidates are listed alphabetically by last name. Order does not reflect any ranking.</p>
      {race.candidates.length === 0 && (
        <p className="empty">This election is scheduled by statute, but we have no candidate list for it yet. Check your <a href="https://www.usa.gov/state-election-office">state election office</a> for official filings.</p>
      )}
      <ul className="results">
        {race.candidates.map((c) => (
          <li key={c.id}>
            <a className="card" href={`/candidates/${c.id}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="avatar" src={c.photoUrl ?? ""} alt="" loading="lazy" />
              <span>
                <span className="name">{c.name}</span>
                <span className="chip">{c.party ?? "Party not available"}</span>
                <span className="chip">{STATUS_LABEL[c.status] ?? c.status}</span>
                {c.incumbent && <span className="chip">Incumbent</span>}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}
