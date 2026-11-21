import { API_URL } from "@/lib/api";

export const metadata = { title: "How sources are graded — Civic Lens" };

interface Rubric {
  version: number; scoring: string; neutrality: string; grades: Record<string, string>;
  criteria: Array<{ key: string; label: string; question: string; scores: string[] }>;
}

export default async function RubricPage() {
  const r = (await fetch(`${API_URL}/v1/rubric`, { cache: "no-store" }).then((x) => x.json())) as Rubric;
  return (
    <article>
      <h1>How sources are graded</h1>
      <p className="lead">Rubric version {r.version}. Every fact shows where it came from and a credibility grade.</p>
      <p>{r.neutrality}</p>
      <p>{r.scoring}</p>
      <h2>Criteria</h2>
      <table>
        <thead><tr><th>Criterion</th><th>Question</th><th>0</th><th>1</th><th>2</th></tr></thead>
        <tbody>
          {r.criteria.map((c) => (
            <tr key={c.key}><th scope="row">{c.label}</th><td>{c.question}</td>{c.scores.map((s, i) => <td key={i}>{s}</td>)}</tr>
          ))}
        </tbody>
      </table>
      <h2>Grades</h2>
      <ul>{Object.entries(r.grades).map(([g, m]) => <li key={g}><strong>{g}</strong>: {m}</li>)}</ul>
      <p><a href="/sources/census-geography">See graded sources</a> · <a href="/coverage">Coverage</a></p>
    </article>
  );
}
