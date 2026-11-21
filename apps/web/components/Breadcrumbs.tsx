import { placeHref, type PlaceSummary } from "@/lib/api";

export default function Breadcrumbs({ parents, current }: { parents: PlaceSummary[]; current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="crumbs">
      <a href="/places">All states</a>
      {parents.map((p) => <span key={p.id}> › <a href={placeHref(p.id)}>{p.label}</a></span>)}
      <span aria-current="page"> › {current}</span>
    </nav>
  );
}
