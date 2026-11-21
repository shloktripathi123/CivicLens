import { notFound } from "next/navigation";
import { API_URL } from "@/lib/api";

interface Source {
  id: string; name: string; url: string; type: string | null; grade: string; rationale: string; rubricVersion: number;
  criteria: Record<string, number>; selfReported: boolean; license: string | null; attribution: string | null;
  retrievedAt: string; factCount: number;
  link: { ok: boolean; stale: boolean; archiveUrl: string | null; archiveCapturedAt: string | null; checkedAt: string } | null;
}

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(`${API_URL}/v1/sources/${encodeURIComponent(decodeURIComponent(id))}`, { cache: "no-store" });
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`API ${res.status}`);
  const s = (await res.json()) as Source;
  const allRes = await fetch(`${API_URL}/v1/sources`, { cache: "no-store" });
  if (!allRes.ok) throw new Error(`API ${allRes.status}`);
  const all = (await allRes.json()) as { items: Source[] };
  return (
    <article>
      <h1>{s.name}</h1>
      <p className="lead">Credibility grade {s.grade} · {s.type} · rubric version {s.rubricVersion}</p>
      {(s.grade === "C" || s.grade === "D") && <p className="empty" role="note"><strong>Lower credibility.</strong> Shown because it is the best available; verify independently.</p>}
      {s.selfReported && <p className="empty">Self-reported by the subject.</p>}
      <p><a href={s.url}>Visit the source</a> · License: {s.license ?? "not stated"} · Attribution: {s.attribution ?? "n/a"}</p>
      <p>{s.rationale}.</p>
      <p className="src">Last retrieved {s.retrievedAt.slice(0, 10)} · {s.factCount.toLocaleString()} records on this site cite it. <a href="/rubric">How grading works</a>.</p>
      {s.link && !s.link.ok && (
        <p className="empty" role="note"><strong>⚠ Link broken</strong> as of {s.link.checkedAt.slice(0, 10)}.{" "}
          {s.link.archiveUrl ? <>An archived copy from {s.link.archiveCapturedAt} is <a href={s.link.archiveUrl}>available</a>.</> : "No archived copy was found."}</p>
      )}
      {s.link?.ok && <p className="src">Link checked working on {s.link.checkedAt.slice(0, 10)}.</p>}
      <h2>All sources</h2>
      <ul>{all.items.map((x) => <li key={x.id}><a href={`/sources/${x.id}`}>{x.name}</a> — grade {x.grade}</li>)}</ul>
    </article>
  );
}
