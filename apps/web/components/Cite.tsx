import CredibilityBadge from "./CredibilityBadge";
import type { Provenance } from "@/lib/api";

/** Source link, date and credibility badge for any fact. */
export default function Cite({ p, label }: { p: Provenance; label?: string }) {
  return (
    <span className="src">
      {label ?? "Source"}: <a href={p.sourceUrl}>{p.sourceName}</a>, as of {p.asOf}
      {p.selfReported && " (self-reported)"}{" "}
      {p.sourceId && p.grade && <CredibilityBadge sourceId={p.sourceId} grade={p.grade} selfReported={p.selfReported} />}
    </span>
  );
}
