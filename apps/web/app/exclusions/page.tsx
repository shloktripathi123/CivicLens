import { API_URL } from "@/lib/api";
import ReportForm from "@/components/ReportForm";

export const metadata = { title: "What we never show — Civic Lens" };

export default async function Exclusions() {
  const d = (await fetch(`${API_URL}/v1/exclusions`, { cache: "no-store" }).then((r) => r.json())) as
    { items: Array<{ category: string; description: string; reason: string }>; note: string };
  return (
    <article>
      <h1>What Civic Lens never shows</h1>
      <p className="lead">Even when a source publishes it, these categories are removed.</p>
      <table>
        <thead><tr><th>Category</th><th>What</th><th>Why</th></tr></thead>
        <tbody>{d.items.map((e) => <tr key={e.category}><th scope="row">{e.category}</th><td>{e.description}</td><td>{e.reason}</td></tr>)}</tbody>
      </table>
      <p>{d.note}</p>
      <h2>Report a problem</h2>
      <ReportForm />
    </article>
  );
}
