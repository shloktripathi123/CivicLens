"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { API_URL } from "@/lib/api";
const TEXT: Record<string, string> = { A: "High", B: "Good", C: "Lower", D: "Low" };

interface Source {
  name: string; url: string; type: string | null; grade: string; rationale: string;
  rubricVersion: number; criteria: Record<string, number>; selfReported: boolean; license: string | null;
}
interface Rubric {
  version: number; grades: Record<string, string>;
  criteria: Array<{ key: string; label: string; question: string; scores: string[] }>;
}

export default function CredibilityBadge({ sourceId, grade, selfReported }: { sourceId: string; grade: string; selfReported?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<{ s: Source; r: Rubric } | null>(null);
  const [err, setErr] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function open() {
    ref.current?.showModal();
    if (data) return;
    setErr(false);
    try {
      const [s, r] = await Promise.all([
        fetch(`${API_URL}/v1/sources/${encodeURIComponent(sourceId)}`),
        fetch(`${API_URL}/v1/rubric`),
      ]);
      if (!s.ok || !r.ok) throw new Error("Grading details unavailable");
      setData({ s: await s.json(), r: await r.json() });
    } catch { setErr(true); }
  }

  return (
    <>
      <button type="button" className={`cred cred-${grade}`} onClick={open} aria-haspopup="dialog"
        aria-label={`Source credibility: ${TEXT[grade]} (grade ${grade}). Show how this is graded.`}>
        <span className="meter" aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} className={i < "DCBA".indexOf(grade) + 1 ? "on" : ""} />)}</span>
        Credibility {grade} · {TEXT[grade]}
      </button>
      {mounted && createPortal(
      <dialog ref={ref} className="cred-dialog" aria-labelledby={`cred-h-${sourceId}`}
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
        onKeyDown={(e) => { if (e.key === "Escape") ref.current?.close(); }}>
        <h2 id={`cred-h-${sourceId}`}>How this source is graded</h2>
        {err && <p>Could not load the grading details. See <a href="/rubric">the published rubric</a>.</p>}
        {!data && !err && <p>Loading…</p>}
        {data && (
          <>
            <p><strong>{data.s.name}</strong> ({data.s.type}) is graded <strong>{data.s.grade}</strong>. {data.r.grades[data.s.grade]}</p>
            {data.s.selfReported && <p><strong>Self-reported:</strong> this information comes from the subject themselves.</p>}
            <table>
              <caption className="sr">Rubric results, version {data.r.version}</caption>
              <thead><tr><th>Criterion</th><th>Result</th><th>Score</th></tr></thead>
              <tbody>
                {data.r.criteria.map((c) => (
                  <tr key={c.key}><td>{c.label}</td><td>{c.scores[data.s.criteria[c.key]]}</td><td>{data.s.criteria[c.key]}/2</td></tr>
                ))}
              </tbody>
            </table>
            <p className="src">Grades use only facts about the publisher, never the content of a claim. Rubric version {data.s.rubricVersion}.</p>
            <p><a href={data.s.url}>Visit the source</a> · <a href={`/sources/${encodeURIComponent(sourceId)}`}>Source details</a> · <a href="/rubric">Full rubric</a></p>
          </>
        )}
        <button type="button" onClick={() => ref.current?.close()}>Close</button>
      </dialog>, document.body)}
    </>
  );
}
