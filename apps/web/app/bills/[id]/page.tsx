import { notFound } from "next/navigation";
import BillStatus from "@/components/BillStatus";
import Cite from "@/components/Cite";
import { API_URL, type BillDetail } from "@/lib/api";

async function load(id: string): Promise<BillDetail | null> {
  const res = await fetch(`${API_URL}/v1/bills/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await load(decodeURIComponent(id));
  if (!b) notFound();
  return (
    <article>
      <h1>{b.number}</h1>
      <p className="lead">{b.title}</p>
      <p><BillStatus status={b.status} isLaw={b.isLaw} />{b.chapter && <span className="chip">{b.chapter}</span>}</p>
      {b.status === "unknown" ? <p className="src">Check the source to determine whether this measure became law.</p> : !b.isLaw && <p className="src">This is not shown as enacted in our data. Check the source for its current status.</p>}
      <h2>Summary</h2>
      <p>{b.summary ?? "A summary is not available in our data."} <Cite p={b.provenance} /></p>
      <p className="src">Latest status or action: {b.statusDetail ?? "not provided"}.</p>
      <h2>Sponsors</h2>
      {b.sponsors.length ? (
        <ul>{b.sponsors.map((s, i) => <li key={i}>{s.name} ({s.role})</li>)}</ul>
      ) : <p>No sponsors are listed by the source.</p>}
      <h2>Source links</h2>
      <ul>
        <li><a href={b.url}>View the bill at its source</a></li>
        {b.textUrl && <li><a href={b.textUrl}>Introduced text (official)</a></li>}
      </ul>
      <h2>History</h2>
      <ol className="timeline">
        {b.actions.map((a, i) => <li key={i}>{a.date} {a.chamber ? `(${a.chamber === "H" ? "House" : a.chamber === "S" ? "Senate" : a.chamber}) ` : ""}{a.text}</li>)}
      </ol>
      {!b.actions.length && <p>No history is available in our data.</p>}
    </article>
  );
}
