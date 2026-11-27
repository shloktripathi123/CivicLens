import type { DatabaseSync } from "node:sqlite";

export const DEEP_SCHEMA = `
CREATE TABLE IF NOT EXISTS official_record (
  id INTEGER PRIMARY KEY AUTOINCREMENT, person_id TEXT NOT NULL,
  section TEXT NOT NULL CHECK (section IN ('bills','votes','projects','funding','ratings','affiliations')),
  title TEXT NOT NULL, detail TEXT, date TEXT, publisher TEXT, url TEXT,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_official_record ON official_record(person_id, section);
CREATE TABLE IF NOT EXISTS voting_window (
  id INTEGER PRIMARY KEY AUTOINCREMENT, state TEXT NOT NULL, election_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('registration_deadline','mail_ballot_request','mail_ballots_sent','dropbox_open','dropbox_close')),
  start_date TEXT, end_date TEXT, note TEXT NOT NULL, basis TEXT NOT NULL, url TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_voting_window ON voting_window(state, election_id);
`;

export const DEEP_SECTIONS = [
  "identity", "affiliations", "background", "terms", "committees", "bills", "votes", "projects", "funding", "ratings", "contact",
] as const;
export type DeepSection = (typeof DEEP_SECTIONS)[number];

export interface DeepItem {
  title: string; detail: string | null; date: string | null; publisher: string | null; url: string | null;
  provenance: { sourceId: string; sourceName: string; sourceUrl: string; asOf: string; grade: string | null; selfReported: boolean };
}
export interface DeepLookup { label: string; url: string }
export interface DeepSlot {
  status: "has_data" | "none_recorded";
  lookups: DeepLookup[];
  items: DeepItem[];
  checked: string;
}
export interface DeepProfile { sections: Record<"bills" | "votes" | "projects" | "funding" | "ratings" | "affiliations", DeepSlot> }

const CHECKED: Record<string, string> = {
  bills: "sponsorship records linked to this official",
  votes: "recorded floor votes linked to this official",
  projects: "official project or initiative records",
  funding: "campaign finance summaries and other funding records",
  ratings: "third-party ratings from named publishers",
  affiliations: "party affiliation per term and other recorded affiliations",
};

function prov(db: DatabaseSync, sourceId: string, asOf: string): DeepItem["provenance"] {
  const s = db.prepare("SELECT name, url, grade, self_reported FROM source WHERE id = ?").get(sourceId) as
    { name: string; url: string; grade: string | null; self_reported: number } | undefined;
  return { sourceId, sourceName: s?.name ?? sourceId, sourceUrl: s?.url ?? "", asOf, grade: s?.grade ?? null, selfReported: !!s?.self_reported };
}

type Row = { section: string; title: string; detail: string | null; date: string | null; publisher: string | null; url: string | null; source_id: string; as_of: string };

const enc = encodeURIComponent;

/** Person-specific official or nonpartisan pages built only from identifiers we already store. */
function lookupsFor(ids: Record<string, string>, name: string): Record<keyof DeepProfile["sections"], DeepLookup[]> {
  const L = (label: string, url: string) => ({ label, url });
  const out: Record<keyof DeepProfile["sections"], DeepLookup[]> = { bills: [], votes: [], projects: [], funding: [], ratings: [], affiliations: [] };
  if (ids.bioguide) {
    out.bills.push(L("Sponsored legislation (Congress.gov)", `https://www.congress.gov/member/-/${ids.bioguide}?q=%7B%22sponsorship%22%3A%22sponsored%22%7D`));
    out.projects.push(L("Member profile (Congress.gov)", `https://www.congress.gov/member/-/${ids.bioguide}`));
    out.affiliations.push(L("Biographical Directory (bioguide.congress.gov)", `https://bioguide.congress.gov/search/bio/${ids.bioguide}`));
  }
  if (ids.govtrack) {
    out.bills.push(L("Bills and report card (GovTrack)", `https://www.govtrack.us/congress/members/${ids.govtrack}`));
    out.votes.push(L("Full voting record (GovTrack)", `https://www.govtrack.us/congress/members/${ids.govtrack}#votes`));
  }
  if (ids.fec) out.funding.push(L("Filings (FEC.gov)", `https://www.fec.gov/data/candidate/${ids.fec}/`));
  if (ids.opensecrets) out.funding.push(L("Donors and industries (OpenSecrets)", `https://www.opensecrets.org/members-of-congress/summary?cid=${ids.opensecrets}`));
  if (ids.votesmart) out.ratings.push(L("Interest-group ratings (Vote Smart)", `https://justfacts.votesmart.org/candidate/evaluations/${ids.votesmart}`));
  if (ids.ballotpedia) out.affiliations.push(L("Ballotpedia", `https://ballotpedia.org/${enc(ids.ballotpedia.replace(/ /g, "_"))}`));
  if (ids.wikipedia) out.affiliations.push(L("Wikipedia", `https://en.wikipedia.org/wiki/${enc(ids.wikipedia.replace(/ /g, "_"))}`));
  if (!out.ratings.length) out.ratings.push(L("Search ratings (Vote Smart)", `https://justfacts.votesmart.org/?q=${enc(name)}`));
  return out;
}

/** Always returns every slot; an empty slot carries an explicit "none recorded" status instead of being omitted. */
export function getDeepProfile(db: DatabaseSync, personId: string): DeepProfile {
  const rows = db.prepare(`SELECT section, title, detail, date, publisher, url, source_id, as_of FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY section ORDER BY date DESC, id) AS rn FROM official_record WHERE person_id = ?
    ) WHERE rn <= 30 ORDER BY date DESC, id`).all(personId) as Row[];
  const ids: Record<string, string> = {};
  for (const r of db.prepare("SELECT scheme, value FROM person_identifier WHERE person_id = ?").all(personId) as Array<{ scheme: string; value: string }>) ids[r.scheme] ??= r.value;
  const nm = (db.prepare("SELECT canonical_name AS n FROM person WHERE id = ?").get(personId) as { n: string } | undefined)?.n ?? "";
  const lk = lookupsFor(ids, nm);
  const slot = (section: keyof DeepProfile["sections"], extra: DeepItem[] = []): DeepSlot => {
    const items = [
      ...extra,
      ...rows.filter((r) => r.section === section).map((r) => ({
        title: r.title, detail: r.detail, date: r.date, publisher: r.publisher, url: r.url, provenance: prov(db, r.source_id, r.as_of),
      })),
    ];
    return { status: items.length ? "has_data" : "none_recorded", lookups: lk[section], items, checked: CHECKED[section] };
  };

  const terms = db.prepare("SELECT body, title, party, CASE WHEN start_date_known = 1 THEN start_date END AS start_date, end_date, source_id, as_of FROM office_term WHERE person_id = ? AND party IS NOT NULL ORDER BY start_date").all(personId) as Array<Record<string, string | null>>;
  const affiliations = terms.map((t) => ({
    title: t.party as string, detail: `${t.title}, ${t.body}`, date: t.start_date, publisher: null, url: null,
    provenance: prov(db, t.source_id as string, t.as_of as string),
  }));

  const fin = db.prepare(`SELECT f.cycle, f.receipts, f.disbursements, f.cash_on_hand AS coh, f.source_id, f.as_of
    FROM finance_summary f JOIN candidacy c ON c.id = f.candidacy_id WHERE c.person_id = ? ORDER BY f.cycle DESC`).all(personId) as Array<Record<string, number | string | null>>;
  const usd = (n: unknown) => (typeof n === "number" ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : "not reported");
  const funding = fin.map((f) => ({
    title: `${f.cycle} cycle`, detail: `Receipts ${usd(f.receipts)} · Disbursements ${usd(f.disbursements)} · Cash on hand ${usd(f.coh)}`,
    date: String(f.cycle), publisher: null, url: null, provenance: prov(db, f.source_id as string, f.as_of as string),
  }));

  return { sections: {
    affiliations: slot("affiliations", affiliations), bills: slot("bills"), votes: slot("votes"),
    projects: slot("projects"), funding: slot("funding", funding), ratings: slot("ratings"),
  } };
}

export interface VotingWindow {
  id: number; state: string; electionId: string; kind: string; startDate: string | null; endDate: string | null;
  note: string; basis: string; url: string; sourceId: string; asOf: string;
}

export function windowsFor(db: DatabaseSync, state: string | undefined): VotingWindow[] {
  return db.prepare(`SELECT id, state, election_id AS electionId, kind, start_date AS startDate, end_date AS endDate, note, basis, url,
    source_id AS sourceId, as_of AS asOf FROM voting_window ${state ? "WHERE state = ?" : ""} ORDER BY COALESCE(start_date, end_date), id`)
    .all(...(state ? [state] : [])) as unknown as VotingWindow[];
}
