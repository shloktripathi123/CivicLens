import CredibilityBadge from "./CredibilityBadge";

export interface ConflictDto {
  subject: string; field: string;
  values: Array<{ value: string; sourceId: string; sourceName: string; sourceUrl: string; grade: string | null; asOf: string }>;
}

/** Every disagreeing value, each with its source; none is picked. */
export default function Conflict({ items }: { items: ConflictDto[] }) {
  if (!items?.length) return null;
  return (
    <section className="block" aria-labelledby="conflicts-h">
      <h2 id="conflicts-h">Sources disagree</h2>
      {items.map((c, i) => (
        <div key={i} className="empty" role="note">
          <strong>⚠ Conflict: {c.field} for {c.subject}.</strong> Civic Lens shows every value and does not pick one.
          <ul>
            {c.values.map((v) => (
              <li key={v.sourceId}>
                {v.value} — <a href={v.sourceUrl}>{v.sourceName}</a>, as of {v.asOf}{" "}
                {v.grade && <CredibilityBadge sourceId={v.sourceId} grade={v.grade} />}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
