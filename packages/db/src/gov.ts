import type { DatabaseSync } from "node:sqlite";

type DB = DatabaseSync;

export const GOV_SCHEMA = `
CREATE TABLE IF NOT EXISTS gov_unit (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('county','city','school_district','special_district')),
  name TEXT NOT NULL, state TEXT NOT NULL, place_id TEXT, fips TEXT, function TEXT,
  form TEXT, form_basis TEXT, predecessor TEXT, official_url TEXT,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gov_unit_fips ON gov_unit(fips);
CREATE TABLE IF NOT EXISTS gov_office (
  id TEXT PRIMARY KEY, unit_id TEXT NOT NULL REFERENCES gov_unit(id),
  title TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('elected','appointed','hired','ex_officio')),
  selection TEXT, appointing TEXT, term_years INTEGER, term_limit TEXT, seats INTEGER, nonpartisan INTEGER,
  responsibilities TEXT, next_election TEXT, election_basis TEXT CHECK (election_basis IN ('confirmed','expected')),
  election_rule TEXT, source_url TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL,
  CHECK (next_election IS NULL OR election_basis IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_gov_office_unit ON gov_office(unit_id);
CREATE TABLE IF NOT EXISTS gov_holder (
  id INTEGER PRIMARY KEY AUTOINCREMENT, office_id TEXT NOT NULL REFERENCES gov_office(id), person_id TEXT,
  name TEXT NOT NULL, seat TEXT, status TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('current','vacant','interim')),
  start_date TEXT, end_date TEXT, email TEXT, url TEXT,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gov_holder_office ON gov_holder(office_id);
CREATE TABLE IF NOT EXISTS gov_meeting (
  id INTEGER PRIMARY KEY AUTOINCREMENT, unit_id TEXT NOT NULL REFERENCES gov_unit(id),
  body TEXT NOT NULL, schedule TEXT NOT NULL, location TEXT, attend TEXT, public_comment TEXT,
  agenda_url TEXT, minutes_url TEXT, source_url TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gov_area (
  place_id TEXT NOT NULL, unit_id TEXT NOT NULL REFERENCES gov_unit(id), relation TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL,
  PRIMARY KEY (place_id, unit_id)
);
`;

export const GOV_FACT_TABLES = ["gov_unit", "gov_office", "gov_holder", "gov_meeting", "gov_area"];

type Row = Record<string, string | number | null>;

export interface GovProv { sourceId: string; sourceName: string; sourceUrl: string; asOf: string; grade: string | null; selfReported: boolean }
export interface GovOfficeDto {
  id: string; title: string; role: string; selection: string | null; appointing: string | null; termYears: number | null;
  termLimit: string | null; seats: number | null; nonpartisan: boolean | null; responsibilities: string | null;
  nextElection: { date: string; basis: "confirmed" | "expected"; rule: string | null } | null; sourceUrl: string;
  holders: Array<{ name: string; personId: string | null; seat: string | null; status: string; startDate: string | null; endDate: string | null; email: string | null; url: string | null }>;
  provenance: GovProv;
}
export interface GovUnitDto {
  id: string; kind: string; name: string; state: string; function: string | null; form: string | null; formBasis: string | null;
  predecessor: string | null; officialUrl: string | null; provenance: GovProv;
  offices: GovOfficeDto[];
  meetings: Array<{ body: string; schedule: string; location: string | null; attend: string | null; publicComment: string | null; agendaUrl: string | null; minutesUrl: string | null; sourceUrl: string }>;
  completeness: Array<{ item: string; state: "sourced" | "not_in_our_data"; note?: string }>;
}

function prov(db: DB, sourceId: string, asOf: string): GovProv {
  const s = db.prepare("SELECT name, url, grade, self_reported FROM source WHERE id = ?").get(sourceId) as
    { name: string; url: string; grade: string | null; self_reported: number };
  return { sourceId, sourceName: s.name, sourceUrl: s.url, asOf, grade: s.grade, selfReported: !!s.self_reported };
}

export function getGovUnit(db: DB, id: string): GovUnitDto | null {
  const u = db.prepare("SELECT * FROM gov_unit WHERE id = ?").get(id) as Row | undefined;
  if (!u) return null;
  const offices = (db.prepare("SELECT * FROM gov_office WHERE unit_id = ? ORDER BY CASE role WHEN 'elected' THEN 0 WHEN 'appointed' THEN 1 WHEN 'ex_officio' THEN 2 ELSE 3 END, rowid").all(id) as Row[]).map((o) => ({
    id: o.id as string, title: o.title as string, role: o.role as string,
    selection: o.selection as string | null, appointing: o.appointing as string | null,
    termYears: o.term_years as number | null, termLimit: o.term_limit as string | null, seats: o.seats as number | null,
    nonpartisan: o.nonpartisan === null ? null : o.nonpartisan === 1,
    responsibilities: o.responsibilities as string | null,
    nextElection: o.next_election ? { date: o.next_election as string, basis: o.election_basis as "confirmed" | "expected", rule: o.election_rule as string | null } : null,
    sourceUrl: o.source_url as string,
    holders: (db.prepare("SELECT * FROM gov_holder WHERE office_id = ? ORDER BY seat, name").all(o.id as string) as Row[]).map((h) => ({
      name: h.name as string, personId: h.person_id as string | null, seat: h.seat as string | null, status: h.status as string,
      startDate: h.start_date as string | null, endDate: h.end_date as string | null, email: h.email as string | null, url: h.url as string | null,
    })),
    provenance: prov(db, o.source_id as string, o.as_of as string),
  }));
  const meetings = (db.prepare("SELECT * FROM gov_meeting WHERE unit_id = ?").all(id) as Row[]).map((m) => ({
    body: m.body as string, schedule: m.schedule as string, location: m.location as string | null, attend: m.attend as string | null,
    publicComment: m.public_comment as string | null, agendaUrl: m.agenda_url as string | null, minutesUrl: m.minutes_url as string | null,
    sourceUrl: m.source_url as string,
  }));
  const any = (f: (o: GovOfficeDto) => boolean) => offices.some(f);
  const item = (name: string, ok: boolean, note?: string) => ({ item: name, state: ok ? "sourced" as const : "not_in_our_data" as const, ...(ok ? {} : { note }) });
  return {
    id: u.id as string, kind: u.kind as string, name: u.name as string, state: u.state as string, function: u.function as string | null,
    form: u.form as string | null, formBasis: u.form_basis as string | null, predecessor: u.predecessor as string | null,
    officialUrl: u.official_url as string | null, provenance: prov(db, u.source_id as string, u.as_of as string),
    offices, meetings,
    completeness: [
      item("Structure and offices", offices.length > 0, "No published structure has been read for this unit."),
      item("Officeholders", any((o) => o.holders.length > 0), "Holders were not available in a source we could read."),
      item("Terms", any((o) => o.termYears !== null), "Term lengths not stated in a source we read."),
      item("Next election dates", any((o) => o.nextElection !== null), "No confirmed or rule-based date available."),
      item("Meeting schedule", meetings.length > 0, "No meeting schedule read from an official source."),
      item("Agendas and minutes", meetings.some((m) => m.agendaUrl || m.minutesUrl), "No agenda or minutes link recorded."),
      item("Recorded votes", false, "Votes are shown only where a body publishes them in a retrievable record; none retrieved."),
    ],
  };
}

/** Units attached to a place and its parents (zip → county/city, city → county) through gov_area. */
export function govUnitIdsForPlaces(db: DB, placeIds: string[]): string[] {
  if (!placeIds.length) return [];
  const q = db.prepare(`SELECT unit_id FROM gov_area WHERE place_id IN (${placeIds.map(() => "?").join(",")})`).all(...placeIds) as Array<{ unit_id: string }>;
  return [...new Set(q.map((r) => r.unit_id))];
}

export function govUnitByFips(db: DB, kind: string, fips: string): string | null {
  const r = db.prepare("SELECT id FROM gov_unit WHERE kind = ? AND fips = ?").get(kind, fips) as { id: string } | undefined;
  return r?.id ?? null;
}
