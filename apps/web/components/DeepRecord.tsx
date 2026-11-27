import Cite from "@/components/Cite";
import FilterableList from "@/components/FilterableList";
import type { DeepKey, DeepProfile, DeepSlot, Person } from "@/lib/api";

const TITLES: Record<DeepKey, string> = {
  affiliations: "Affiliations", bills: "Sponsored legislation", votes: "Floor votes",
  projects: "Projects", funding: "Funding and financials", ratings: "Third-party ratings",
};
const ORDER: DeepKey[] = ["affiliations", "bills", "votes", "projects", "funding", "ratings"];

type Lookup = { href: string; label: string } | null;

function Slot({ k, slot, officialUrl }: { k: DeepKey; slot: DeepSlot | undefined; officialUrl: Lookup }) {
  const items = slot?.items ?? [];
  const has = slot?.status === "has_data" && items.length > 0;
  return (
    <details open={has}>
      <summary>{TITLES[k]}<span className="chip">{has ? `${items.length} recorded` : "None recorded"}</span></summary>
      {k === "bills" && <p className="src">Sponsorship does not by itself mean a bill passed or show how this person voted. Records may be incomplete.</p>}
      {has ? (
        <FilterableList label={`${TITLES[k].toLowerCase()} records`} listClassName="" pageSize={10} items={items.map((i, n) => ({
          id: String(n), text: [i.title, i.detail, i.publisher, i.date].filter(Boolean).join(" "), content: (
            <>
              {i.billId ? <a href={`/bills/${encodeURIComponent(i.billId)}`}>{i.title}</a> : i.url ? <a href={i.url}>{i.title}</a> : i.title}
              {i.billId && i.url && <> · <a href={i.url}>Source record</a></>}
              {i.publisher && <span className="src"> · {i.publisher}</span>}
              {i.date && <span className="src"> · {i.date.slice(0, 10)}</span>}
              {i.detail && <><br /><span className="meta">{i.detail}</span></>}{" "}
              <Cite p={i.provenance} />
            </>
          ),
        }))} />
      ) : (
        <p className="na">
          No recorded history in our data for {slot?.checked ?? "this record type"}. This is a gap in our sources,
          not a statement that nothing exists.
          {officialUrl && !(slot?.lookups ?? []).length && <> Look it up at <a href={officialUrl.href}>{officialUrl.label}</a>.</>}
        </p>
      )}
      {(slot?.lookups ?? []).length > 0 && (
        <p className="meta">Verify at the source: {(slot?.lookups ?? []).map((l, n) => <span key={l.url}>{n > 0 && " · "}<a href={l.url}>{l.label}</a></span>)}</p>
      )}
    </details>
  );
}

export function RecordSections({ deep, person, sections }: { deep: DeepProfile | null | undefined; person: Person; sections: DeepKey[] }) {
  const officialUrl: Lookup = person.level === "federal" ? { href: "https://www.congress.gov/members", label: "Congress.gov" } : null;
  return <div className="deep">{sections.map((key) => <Slot key={key} k={key} slot={deep?.sections[key]} officialUrl={officialUrl} />)}</div>;
}

export default function DeepRecord({ deep, person }: { deep: DeepProfile | null | undefined; person: Person }) {
  return (
    <section className="block" aria-labelledby="deep-h">
      <h2 id="deep-h">Full record</h2>
      <div className="deep">
        <details>
          <summary>Identity<span className="chip">Recorded</span></summary>
          <ul>
            <li>Name: {person.name}</li>
            <li>Status: {person.status === "current" ? "Current official" : "Former official"}</li>
            {person.body && <li>Body: {person.body}</li>}
            {person.years && <li>Years: {person.years}</li>}
          </ul>
        </details>
        <RecordSections deep={deep} person={person} sections={ORDER} />
      </div>
    </section>
  );
}
