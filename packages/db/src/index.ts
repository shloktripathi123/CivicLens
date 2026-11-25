import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GOV_SCHEMA, GOV_FACT_TABLES } from "./gov.ts";
export * from "./gov.ts";
import { VOTING_SCHEMA } from "./voting.ts";
import { DEEP_SCHEMA } from "./deep.ts";
export * from "./voting.ts";
export * from "./deep.ts";
import {
  normalizeName,
  yearsLabel,
  type CandidacyInfo,
  type CandidacyStatus,
  type PersonSummary,
  type Provenance,
  type Status,
} from "@civic/domain";

export type DB = DatabaseSync;

// Every fact table carries source_id + as_of (NOT NULL) so provenance cannot be omitted.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS source (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL,
  license TEXT, attribution TEXT, retrieved_at TEXT NOT NULL,
  authoritative INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS person (
  id TEXT PRIMARY KEY, canonical_name TEXT NOT NULL, given TEXT, family TEXT,
  birth_date TEXT, gender TEXT, photo_url TEXT, status TEXT NOT NULL CHECK (status IN ('current','former','candidate')),
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS person_identifier (
  person_id TEXT NOT NULL REFERENCES person(id), scheme TEXT NOT NULL, value TEXT NOT NULL,
  PRIMARY KEY (person_id, scheme, value)
);
CREATE TABLE IF NOT EXISTS person_name (
  person_id TEXT NOT NULL REFERENCES person(id), name TEXT NOT NULL, name_norm TEXT NOT NULL, kind TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_person_name_norm ON person_name(name_norm);
CREATE TABLE IF NOT EXISTS office_term (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id TEXT NOT NULL REFERENCES person(id),
  level TEXT NOT NULL, branch TEXT NOT NULL, body TEXT NOT NULL, title TEXT NOT NULL,
  state TEXT, district TEXT, party TEXT, start_date TEXT NOT NULL, end_date TEXT,
  leadership_role TEXT, website TEXT, phone TEXT, address TEXT, contact_form TEXT,
  office_type TEXT, how_filled TEXT,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL,
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_term_person ON office_term(person_id);
CREATE TABLE IF NOT EXISTS committee (
  id TEXT PRIMARY KEY, parent_id TEXT, name TEXT NOT NULL, chamber TEXT NOT NULL, url TEXT,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS committee_membership (
  person_id TEXT NOT NULL REFERENCES person(id), committee_id TEXT NOT NULL REFERENCES committee(id),
  role TEXT NOT NULL, rank INTEGER,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cm_person ON committee_membership(person_id);
CREATE TABLE IF NOT EXISTS social (
  person_id TEXT NOT NULL REFERENCES person(id), platform TEXT NOT NULL, handle TEXT NOT NULL, url TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS coverage (
  person_id TEXT NOT NULL REFERENCES person(id), section TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('complete','partial','unavailable')),
  PRIMARY KEY (person_id, section)
);
CREATE TABLE IF NOT EXISTS office (
  id TEXT PRIMARY KEY, level TEXT NOT NULL, body TEXT NOT NULL, jurisdiction TEXT NOT NULL,
  title TEXT NOT NULL, district TEXT,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS election (
  id TEXT PRIMARY KEY, date TEXT NOT NULL, type TEXT NOT NULL CHECK (type IN ('general','primary','runoff','special')),
  jurisdiction TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS race (
  id TEXT PRIMARY KEY, election_id TEXT NOT NULL REFERENCES election(id), office_id TEXT NOT NULL REFERENCES office(id),
  status TEXT NOT NULL CHECK (status IN ('upcoming','completed')),
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS candidacy (
  id TEXT PRIMARY KEY, person_id TEXT NOT NULL REFERENCES person(id), race_id TEXT NOT NULL REFERENCES race(id),
  party TEXT, status TEXT NOT NULL CHECK (status IN ('filed','qualified','withdrawn','won','lost')),
  incumbent INTEGER NOT NULL DEFAULT 0, filed_on TEXT, website TEXT,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL,
  UNIQUE (person_id, race_id)
);
CREATE INDEX IF NOT EXISTS idx_candidacy_person ON candidacy(person_id);
CREATE INDEX IF NOT EXISTS idx_candidacy_race ON candidacy(race_id);
CREATE TRIGGER IF NOT EXISTS candidacy_requires_authoritative_source
BEFORE INSERT ON candidacy
WHEN (SELECT authoritative FROM source WHERE id = NEW.source_id) IS NOT 1
BEGIN SELECT RAISE(ABORT, 'candidacy requires an authoritative source'); END;
CREATE TABLE IF NOT EXISTS agenda_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT, candidacy_id TEXT NOT NULL REFERENCES candidacy(id),
  topic TEXT NOT NULL, text TEXT NOT NULL, origin TEXT NOT NULL, source_url TEXT NOT NULL, captured_at TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS finance_summary (
  candidacy_id TEXT NOT NULL REFERENCES candidacy(id), cycle INTEGER NOT NULL,
  receipts REAL, disbursements REAL, cash_on_hand REAL,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL,
  PRIMARY KEY (candidacy_id, cycle)
);
CREATE TABLE IF NOT EXISTS result (
  race_id TEXT NOT NULL REFERENCES race(id), candidacy_id TEXT NOT NULL REFERENCES candidacy(id),
  votes INTEGER, percent REAL, certified INTEGER NOT NULL DEFAULT 0,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL,
  PRIMARY KEY (race_id, candidacy_id)
);
CREATE TABLE IF NOT EXISTS education (
  person_id TEXT NOT NULL REFERENCES person(id), institution TEXT NOT NULL, degree TEXT, year INTEGER,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS career_item (
  person_id TEXT NOT NULL REFERENCES person(id), title TEXT NOT NULL, org TEXT, start TEXT, end TEXT,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS place (
  id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK (type IN ('state','county','city','zip')),
  name TEXT NOT NULL, label TEXT NOT NULL, name_norm TEXT NOT NULL, state TEXT NOT NULL, fips TEXT NOT NULL,
  lat REAL, lon REAL, parent_id TEXT, approximate INTEGER NOT NULL DEFAULT 0,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_place_state_type ON place(state, type);
CREATE TABLE IF NOT EXISTS place_overlap (
  place_id TEXT NOT NULL REFERENCES place(id), other_id TEXT NOT NULL REFERENCES place(id),
  relation TEXT NOT NULL, share REAL,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL,
  PRIMARY KEY (place_id, other_id)
);
CREATE INDEX IF NOT EXISTS idx_overlap_other ON place_overlap(other_id);
CREATE TABLE IF NOT EXISTS exclusion_rule (
  category TEXT PRIMARY KEY, description TEXT NOT NULL, reason TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS correction_report (
  id INTEGER PRIMARY KEY AUTOINCREMENT, target TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('excluded-category','factual-error','rating')),
  note TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','upheld','dismissed')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bill (
  id TEXT PRIMARY KEY, jurisdiction TEXT NOT NULL, session TEXT NOT NULL, number TEXT NOT NULL,
  title TEXT NOT NULL, summary TEXT, status TEXT NOT NULL, status_detail TEXT, is_law INTEGER NOT NULL,
  chapter TEXT, url TEXT NOT NULL, text_url TEXT, introduced_on TEXT,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bill_status ON bill(jurisdiction, status);
CREATE TABLE IF NOT EXISTS bill_sponsor (
  bill_id TEXT NOT NULL REFERENCES bill(id), name TEXT NOT NULL, role TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bill_sponsor ON bill_sponsor(bill_id);
CREATE TABLE IF NOT EXISTS bill_action (
  bill_id TEXT NOT NULL REFERENCES bill(id), date TEXT NOT NULL, chamber TEXT, text TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bill_action ON bill_action(bill_id);
CREATE TABLE IF NOT EXISTS link_check (
  url TEXT PRIMARY KEY, ok INTEGER NOT NULL, http_status INTEGER, stale INTEGER NOT NULL DEFAULT 0,
  archive_url TEXT, archive_captured_at TEXT, checked_at TEXT NOT NULL
);
`;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function openDb(path = process.env.DB_PATH ?? resolve(ROOT, "data/civic.db")): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  db.exec(GOV_SCHEMA);
  db.exec(VOTING_SCHEMA);
  db.exec(DEEP_SCHEMA);
  migrate(db);
  return db;
}

const SOURCE_COLUMNS: Array<[string, string]> = [
  ["type", "TEXT"], ["grade", "TEXT"], ["rationale", "TEXT"],
  ["rubric_version", "INTEGER"], ["criteria_json", "TEXT"], ["self_reported", "INTEGER NOT NULL DEFAULT 0"],
];

function migrate(db: DB) {
  const have = new Set((db.prepare("PRAGMA table_info(source)").all() as Array<{ name: string }>).map((c) => c.name));
  for (const [name, type] of SOURCE_COLUMNS) if (!have.has(name)) db.exec(`ALTER TABLE source ADD COLUMN ${name} ${type}`);
  const haveTerm = new Set((db.prepare("PRAGMA table_info(office_term)").all() as Array<{ name: string }>).map((c) => c.name));
  for (const name of ["office_type", "how_filled"]) if (!haveTerm.has(name)) db.exec(`ALTER TABLE office_term ADD COLUMN ${name} TEXT`);
  backfillOfficeTypes(db);
}

/** Fills office_term.office_type for rows that lack it, from body and title. Idempotent. */
export function backfillOfficeTypes(db: DB) {
  if (!db.prepare("SELECT 1 FROM office_term WHERE office_type IS NULL LIMIT 1").get()) return;
  db.exec(`UPDATE office_term SET office_type = CASE
    WHEN body = 'U.S. Senate' THEN 'senate'
    WHEN body = 'U.S. House' THEN 'house'
    WHEN title = 'President' THEN 'president'
    WHEN title = 'Vice President' THEN 'vice_president'
    WHEN title = 'Governor' THEN 'governor'
    WHEN title LIKE 'Secretary of %' OR title = 'Attorney General' OR title LIKE '%Cabinet%' THEN 'cabinet'
    WHEN title LIKE '%Justice%' OR title LIKE '%Judge%' THEN 'judge'
    ELSE 'other' END WHERE office_type IS NULL`);
}

export interface SourceRecord {
  id: string; name: string; url: string; type: string | null; grade: string | null; rationale: string | null;
  rubricVersion: number | null; criteria: Record<string, number> | null; selfReported: boolean;
  license: string | null; attribution: string | null; retrievedAt: string; factCount: number;
}

const FACT_TABLES = ["person", "office_term", "committee", "committee_membership", "office", "candidacy", "finance_summary", "education", "career_item", "agenda_item", "social", "place", "place_overlap", "bill", "bill_sponsor", "bill_action", "state_voting", "official_record", "voting_window", ...GOV_FACT_TABLES];

export function listSources(db: DB): SourceRecord[] {
  const rows = db.prepare("SELECT * FROM source ORDER BY name").all() as Array<Record<string, unknown>>;
  const counts = new Map<string, number>();
  for (const t of FACT_TABLES) {
    for (const r of db.prepare(`SELECT source_id AS id, COUNT(*) AS n FROM ${t} GROUP BY source_id`).all() as Array<{ id: string; n: number }>) {
      counts.set(r.id, (counts.get(r.id) ?? 0) + r.n);
    }
  }
  return rows.map((r) => ({
    id: r.id as string, name: r.name as string, url: r.url as string, type: r.type as string | null,
    grade: r.grade as string | null, rationale: r.rationale as string | null,
    rubricVersion: r.rubric_version as number | null,
    criteria: r.criteria_json ? JSON.parse(r.criteria_json as string) : null,
    selfReported: !!r.self_reported, license: r.license as string | null, attribution: r.attribution as string | null,
    retrievedAt: r.retrieved_at as string, factCount: counts.get(r.id as string) ?? 0,
  }));
}

export function getSourceRecord(db: DB, id: string) {
  return listSources(db).find((s) => s.id === id);
}

/** Facts whose source is missing or ungraded; ingest and tests require this to be empty. */
export function uncitedFacts(db: DB): Array<{ table: string; count: number }> {
  const out: Array<{ table: string; count: number }> = [];
  for (const t of FACT_TABLES) {
    const n = (db.prepare(
      `SELECT COUNT(*) AS n FROM ${t} f LEFT JOIN source s ON s.id = f.source_id WHERE s.id IS NULL OR s.grade IS NULL OR s.url = '' OR f.as_of = ''`,
    ).get() as { n: number }).n;
    if (n) out.push({ table: t, count: n });
  }
  return out;
}

export function photoFor(bioguide: string | undefined): string | null {
  return bioguide ? `https://unitedstates.github.io/images/congress/225x275/${bioguide}.jpg` : null;
}

// ---------- Read side ----------

interface SummaryRow {
  id: string; canonical_name: string; photo_url: string | null; status: Status;
  body: string | null; party: string | null; state: string | null; district: string | null;
  start_date: string | null; end_date: string | null; level: string | null;
}

const SUMMARY_SQL = `
SELECT p.id, p.canonical_name, p.photo_url, p.status,
       t.body, t.party, t.state, t.district, t.start_date, t.end_date, t.level
FROM person p
LEFT JOIN office_term t ON t.id = (
  SELECT id FROM office_term WHERE person_id = p.id ORDER BY start_date DESC LIMIT 1
)`;

function toSummary(db: DB, r: SummaryRow): PersonSummary {
  const first = db
    .prepare("SELECT MIN(start_date) AS s FROM office_term WHERE person_id = ?")
    .get(r.id) as { s: string | null };
  const candidacy = latestCandidacy(db, r.id);
  const sought = candidacy
    ? (db.prepare(
        `SELECT o.level, o.body, o.jurisdiction, o.district FROM candidacy c JOIN race ra ON ra.id = c.race_id
         JOIN office o ON o.id = ra.office_id WHERE c.id = ?`,
      ).get(candidacy.candidacyId) as { level: string; body: string; jurisdiction: string; district: string | null })
    : null;
  const noTerm = r.body === null && sought;
  return {
    id: r.id,
    name: r.canonical_name,
    photoUrl: r.photo_url,
    status: r.status,
    level: noTerm ? sought.level : r.level ?? "federal",
    body: noTerm ? sought.body : r.body ?? "",
    party: r.party ?? candidacy?.info.party ?? null,
    state: noTerm ? stateOf(sought.jurisdiction) : r.state,
    district: noTerm ? sought.district : r.district,
    years: first.s ? yearsLabel(first.s, r.end_date, r.status === "candidate" ? "former" : r.status) : "",
    ...(candidacy ? { candidacy: candidacy.info } : {}),
  };
}

const stateOf = (jurisdiction: string): string | null => (/^[A-Z]{2}$/.test(jurisdiction) ? jurisdiction : null);

function latestCandidacy(db: DB, personId: string): { candidacyId: string; info: CandidacyInfo } | null {
  const r = db
    .prepare(
      `SELECT c.id AS cid, c.party, c.status, c.incumbent, o.title, o.jurisdiction, e.date, ra.id AS raceId
       FROM candidacy c JOIN race ra ON ra.id = c.race_id JOIN election e ON e.id = ra.election_id
       JOIN office o ON o.id = ra.office_id
       WHERE c.person_id = ? ORDER BY e.date DESC LIMIT 1`,
    )
    .get(personId) as Record<string, string | number | null> | undefined;
  if (!r) return null;
  return {
    candidacyId: r.cid as string,
    info: {
      office: r.title as string, jurisdiction: r.jurisdiction as string,
      electionYear: Number(String(r.date).slice(0, 4)), electionDate: r.date as string,
      party: r.party as string | null, status: r.status as CandidacyStatus,
      incumbent: r.incumbent === 1, raceId: r.raceId as string,
    },
  };
}

export interface SearchRow { personId: string; name: string; nameNorm: string }

/** All searchable names, used to build the in-memory search index. */
export function allSearchNames(db: DB): SearchRow[] {
  return (
    db.prepare("SELECT person_id AS personId, name, name_norm AS nameNorm FROM person_name").all() as unknown as SearchRow[]
  );
}

export interface PersonMeta {
  id: string; status: Status; level: string; body: string; state: string | null;
  party: string | null; startYear: number; endYear: number | null; bodies: string; parties: string; states: string;
  family: string; candidate: boolean; officeTypes: string; officeSought: string; electionYear: number | null; sought: string;
}

/** Light per-person facets used for filtering and ranking. */
export function allPersonMeta(db: DB): PersonMeta[] {
  const rows = db
    .prepare(
      `SELECT p.id, p.status, COALESCE(p.family, p.canonical_name) AS family,
              COALESCE(
                (SELECT level FROM office_term WHERE person_id=p.id ORDER BY start_date DESC LIMIT 1),
                (SELECT o.level FROM candidacy c JOIN race ra ON ra.id=c.race_id JOIN office o ON o.id=ra.office_id
                 JOIN election e ON e.id=ra.election_id WHERE c.person_id=p.id ORDER BY e.date DESC LIMIT 1)
              ) AS level,
              (SELECT body FROM office_term WHERE person_id=p.id ORDER BY start_date DESC LIMIT 1) AS body,
              (SELECT state FROM office_term WHERE person_id=p.id ORDER BY start_date DESC LIMIT 1) AS state,
              (SELECT party FROM office_term WHERE person_id=p.id ORDER BY start_date DESC LIMIT 1) AS party,
              (SELECT MIN(substr(start_date,1,4)) FROM office_term WHERE person_id=p.id) AS startYear,
              (SELECT MAX(substr(COALESCE(end_date,'9999'),1,4)) FROM office_term WHERE person_id=p.id) AS endYear,
              (SELECT group_concat(DISTINCT body) FROM office_term WHERE person_id=p.id) AS bodies,
              (SELECT group_concat(DISTINCT party) FROM office_term WHERE person_id=p.id) AS parties,
              (SELECT group_concat(DISTINCT state) FROM office_term WHERE person_id=p.id) AS states,
              (SELECT group_concat(DISTINCT office_type) FROM office_term WHERE person_id=p.id) AS officeTypes,
              (SELECT group_concat(DISTINCT CASE
                 WHEN lower(body) LIKE '%senate%' OR lower(title) LIKE '%senator%' THEN 'senate'
                 WHEN lower(body) LIKE '%house%' OR lower(title) LIKE '%representative%' THEN 'house'
                 ELSE NULL END) FROM office_term WHERE person_id=p.id AND level='state') AS legislativeTypes,
              (SELECT group_concat(DISTINCT CASE
                 WHEN lower(o.title) LIKE '%vice president%' THEN 'vice_president'
                 WHEN lower(o.title) LIKE '%president%' THEN 'president'
                 WHEN lower(o.body) LIKE '%senate%' OR lower(o.title) LIKE '%senator%' THEN 'senate'
                 WHEN lower(o.body) LIKE '%house%' OR lower(o.title) LIKE '%representative%' THEN 'house'
                 WHEN lower(o.title) LIKE '%governor%' THEN 'governor'
                 WHEN lower(o.title) LIKE '%justice%' OR lower(o.title) LIKE '%judge%' THEN 'judge'
                 ELSE NULL END)
               FROM candidacy c JOIN race ra ON ra.id=c.race_id JOIN office o ON o.id=ra.office_id
               WHERE c.person_id=p.id) AS candidateTypes,
              (SELECT COUNT(*) FROM candidacy WHERE person_id=p.id) AS ncand,
              (SELECT group_concat(o.title || ' ' || o.jurisdiction, ' ') FROM candidacy c JOIN race ra ON ra.id=c.race_id
                 JOIN office o ON o.id=ra.office_id WHERE c.person_id=p.id) AS officeSought,
              (SELECT MAX(substr(e.date,1,4)) FROM candidacy c JOIN race ra ON ra.id=c.race_id
                 JOIN election e ON e.id=ra.election_id WHERE c.person_id=p.id) AS candYear,
              (SELECT group_concat(DISTINCT o.jurisdiction) FROM candidacy c JOIN race ra ON ra.id=c.race_id
                 JOIN office o ON o.id=ra.office_id WHERE c.person_id=p.id) AS candStates
       FROM person p`,
    )
    .all() as Array<Record<string, string | null>>;
  return rows.map((r) => ({
    id: r.id as string,
    status: r.status as Status,
    level: r.level ?? "federal",
    body: r.body ?? "",
    state: r.state,
    party: r.party,
    startYear: r.startYear ? Number(r.startYear) : 9999,
    endYear: r.endYear === "9999" ? null : r.endYear ? Number(r.endYear) : 0,
    bodies: r.bodies ?? "",
    parties: r.parties ?? "",
    states: [r.states, r.candStates].filter(Boolean).join(","),
    family: (r.family ?? "").toLowerCase(),
    candidate: Number(r.ncand) > 0,
    officeTypes: [r.officeTypes, r.legislativeTypes, r.candidateTypes].filter(Boolean).join(","),
    officeSought: (r.officeSought ?? "").toLowerCase(),
    electionYear: r.candYear ? Number(r.candYear) : null,
    sought: r.officeSought ?? "",
  }));
}

export function getSummaries(db: DB, ids: string[]): PersonSummary[] {
  const stmt = db.prepare(`${SUMMARY_SQL} WHERE p.id = ?`);
  return ids
    .map((id) => stmt.get(id) as SummaryRow | undefined)
    .filter((r): r is SummaryRow => !!r)
    .map((r) => toSummary(db, r));
}

export interface TermDto {
  title: string; body: string; level: string; branch: string; party: string | null;
  state: string | null; district: string | null; start: string; end: string | null;
  provenance: Provenance;
}

function provFor(db: DB, sourceId: string, asOf: string): Provenance {
  const s = db.prepare("SELECT name, url, grade, self_reported FROM source WHERE id = ?").get(sourceId) as
    { name: string; url: string; grade: string | null; self_reported: number };
  return { sourceId, sourceName: s.name, sourceUrl: s.url, asOf, grade: s.grade, selfReported: !!s.self_reported };
}

export function getTimeline(db: DB, id: string): TermDto[] {
  const rows = db
    .prepare("SELECT * FROM office_term WHERE person_id = ? ORDER BY start_date")
    .all(id) as Array<Record<string, string | null>>;
  return rows.map((t) => ({
    title: t.title as string, body: t.body as string, level: t.level as string, branch: t.branch as string,
    party: t.party, state: t.state, district: t.district,
    start: t.start_date as string, end: t.end_date,
    provenance: provFor(db, t.source_id as string, t.as_of as string),
  }));
}

export function getProfile(db: DB, id: string) {
  const row = db.prepare(`${SUMMARY_SQL} WHERE p.id = ?`).get(id) as SummaryRow | undefined;
  if (!row) return null;
  const person = db.prepare("SELECT * FROM person WHERE id = ?").get(id) as Record<string, string | null>;
  const terms = getTimeline(db, id);

  const latest = (db
    .prepare("SELECT website, phone, address, contact_form, source_id, as_of FROM office_term WHERE person_id = ? ORDER BY start_date DESC LIMIT 1")
    .get(id) as Record<string, string | null> | undefined) ?? {
      website: null, phone: null, address: null, contact_form: null, source_id: person.source_id as string, as_of: person.as_of as string,
    };

  const committees = (
    db
      .prepare(
        `SELECT c.id, c.name, c.parent_id, c.chamber, c.url, m.role, m.rank, m.source_id, m.as_of
         FROM committee_membership m JOIN committee c ON c.id = m.committee_id
         WHERE m.person_id = ? ORDER BY c.parent_id IS NOT NULL, c.name`,
      )
      .all(id) as Array<Record<string, string | number | null>>
  ).map((c) => ({
    id: c.id, name: c.name, subcommittee: c.parent_id !== null, chamber: c.chamber, url: c.url, role: c.role,
    provenance: provFor(db, c.source_id as string, c.as_of as string),
  }));

  const social = (
    db.prepare("SELECT platform, handle, url, source_id, as_of FROM social WHERE person_id = ?").all(id) as Array<
      Record<string, string>
    >
  ).map((s) => ({ platform: s.platform, handle: s.handle, url: s.url, provenance: provFor(db, s.source_id, s.as_of) }));

  const identifiers = db
    .prepare("SELECT scheme, value FROM person_identifier WHERE person_id = ?")
    .all(id) as Array<{ scheme: string; value: string }>;

  const coverage: Record<string, string> = {};
  for (const c of db.prepare("SELECT section, status FROM coverage WHERE person_id = ?").all(id) as Array<{
    section: string; status: string;
  }>) coverage[c.section] = c.status;

  const lastUpdated = (
    db.prepare("SELECT MAX(retrieved_at) AS t FROM source").get() as { t: string | null }
  ).t;

  const background = [] as Array<{ kind: string; detail: string; provenance: Provenance }>;
  if (person.birth_date) {
    background.push({
      kind: "birth",
      detail: `Born ${person.birth_date}`,
      provenance: provFor(db, person.source_id as string, person.as_of as string),
    });
  }

  for (const e of db.prepare("SELECT institution, degree, year, source_id, as_of FROM education WHERE person_id = ?").all(id) as Array<Record<string, string | number | null>>) {
    background.push({ kind: "education", detail: `Education: ${e.institution}${e.degree ? ` (${e.degree})` : ""}${e.year ? `, ${e.year}` : ""}`, provenance: provFor(db, e.source_id as string, e.as_of as string) });
  }
  for (const c of db.prepare("SELECT title, org, start, end, source_id, as_of FROM career_item WHERE person_id = ? ORDER BY start").all(id) as Array<Record<string, string | null>>) {
    background.push({ kind: "career", detail: `${c.title}${c.org ? `, ${c.org}` : ""}${c.start ? ` (${c.start === c.end ? c.start : `${c.start}–${c.end ?? "present"}`})` : ""}`, provenance: provFor(db, c.source_id as string, c.as_of as string) });
  }

  return {
    person: toSummary(db, row),
    terms,
    committees,
    background,
    contact: {
      website: latest.website, phone: latest.phone, address: latest.address, contactForm: latest.contact_form,
      social,
      provenance: provFor(db, latest.source_id as string, latest.as_of as string),
    },
    identifiers,
    coverage,
    lastUpdated,
  };
}

export function freshness(db: DB) {
  return db.prepare("SELECT name, url, retrieved_at AS retrievedAt FROM source ORDER BY name").all();
}

export { normalizeName };

// ---------- Candidates & races ----------

export interface RaceDto {
  id: string; office: string; body: string; level: string; jurisdiction: string; district: string | null;
  electionDate: string; electionType: string; status: string;
  ordering: "alphabetical-by-last-name";
  candidates: Array<{
    id: string; name: string; photoUrl: string | null; party: string | null; status: CandidacyStatus; incumbent: boolean;
  }>;
}

const lastKey = (family: string | null, name: string) => (family ?? name.split(" ").pop() ?? name).toLowerCase();

/** Candidates are always ordered alphabetically by last name, then first name (neutral, documented). */
export function candidatesForRace(db: DB, raceId: string): RaceDto["candidates"] {
  const rows = db
    .prepare(
      `SELECT p.id, p.canonical_name AS name, p.family, p.given, p.photo_url AS photoUrl, c.party, c.status, c.incumbent
       FROM candidacy c JOIN person p ON p.id = c.person_id WHERE c.race_id = ?`,
    )
    .all(raceId) as Array<Record<string, string | number | null>>;
  rows.sort((a, b) =>
    lastKey(a.family as string | null, a.name as string).localeCompare(lastKey(b.family as string | null, b.name as string)) ||
    String(a.given ?? "").localeCompare(String(b.given ?? "")) || String(a.name).localeCompare(String(b.name)));
  return rows.map((r) => ({
    id: r.id as string, name: r.name as string, photoUrl: r.photoUrl as string | null,
    party: r.party as string | null, status: r.status as CandidacyStatus, incumbent: r.incumbent === 1,
  }));
}

const RACE_SQL = `
SELECT ra.id, ra.status, o.title, o.body, o.level, o.jurisdiction, o.district, e.date, e.type
FROM race ra JOIN office o ON o.id = ra.office_id JOIN election e ON e.id = ra.election_id`;

function toRace(db: DB, r: Record<string, string | null>): RaceDto {
  return {
    id: r.id as string, office: r.title as string, body: r.body as string, level: r.level as string,
    jurisdiction: r.jurisdiction as string, district: r.district, electionDate: r.date as string,
    electionType: r.type as string, status: r.status as string,
    ordering: "alphabetical-by-last-name", candidates: candidatesForRace(db, r.id as string),
  };
}

export function getRace(db: DB, id: string): RaceDto | null {
  const r = db.prepare(`${RACE_SQL} WHERE ra.id = ?`).get(id) as Record<string, string | null> | undefined;
  return r ? toRace(db, r) : null;
}

export function listRaces(db: DB, f: { state?: string; office?: string; year?: number }): RaceDto[] {
  const where: string[] = [];
  const args: Array<string | number> = [];
  if (f.state) { where.push("o.jurisdiction = ?"); args.push(f.state.toUpperCase()); }
  if (f.office) { where.push("(LOWER(o.title) LIKE ? OR LOWER(o.body) LIKE ?)"); args.push(`%${f.office.toLowerCase()}%`, `%${f.office.toLowerCase()}%`); }
  if (f.year !== undefined) { where.push("substr(e.date,1,4) = ?"); args.push(String(f.year)); }
  const sql = `${RACE_SQL} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY e.date DESC, o.jurisdiction, o.title LIMIT 2000`;
  return (db.prepare(sql).all(...args) as Array<Record<string, string | null>>).map((r) => toRace(db, r));
}

/** Candidate profile. Agenda (self-reported) and record (public) are returned as separate sections. */
export function getCandidate(db: DB, personId: string) {
  const row = db.prepare(`${SUMMARY_SQL} WHERE p.id = ?`).get(personId) as SummaryRow | undefined;
  if (!row) return null;
  const cand = latestCandidacy(db, personId);
  if (!cand) return null;
  const summary = toSummary(db, row);
  const person = db.prepare("SELECT birth_date, source_id, as_of FROM person WHERE id = ?").get(personId) as Record<string, string | null>;
  const cRow = db.prepare("SELECT website, filed_on, source_id, as_of FROM candidacy WHERE id = ?").get(cand.candidacyId) as Record<string, string | null>;
  const race = getRace(db, cand.info.raceId)!;

  const education = (db.prepare("SELECT institution, degree, year, source_id, as_of FROM education WHERE person_id = ?").all(personId) as Array<Record<string, string | number | null>>)
    .map((e) => ({ institution: e.institution, degree: e.degree, year: e.year, provenance: provFor(db, e.source_id as string, e.as_of as string) }));
  const career = (db.prepare("SELECT title, org, start, end, source_id, as_of FROM career_item WHERE person_id = ?").all(personId) as Array<Record<string, string | null>>)
    .map((e) => ({ title: e.title, org: e.org, start: e.start, end: e.end, provenance: provFor(db, e.source_id as string, e.as_of as string) }));

  const agenda = (db.prepare("SELECT topic, text, origin, source_url, captured_at FROM agenda_item WHERE candidacy_id = ? ORDER BY topic").all(cand.candidacyId) as Array<Record<string, string>>)
    .map((a) => ({ topic: a.topic, text: a.text, origin: a.origin, sourceUrl: a.source_url, capturedAt: a.captured_at }));

  const fin = db.prepare("SELECT cycle, receipts, disbursements, cash_on_hand AS cashOnHand, source_id, as_of FROM finance_summary WHERE candidacy_id = ? ORDER BY cycle DESC LIMIT 1")
    .get(cand.candidacyId) as Record<string, string | number | null> | undefined;

  const terms = getTimeline(db, personId);
  const coverage: Record<string, string> = {};
  for (const c of db.prepare("SELECT section, status FROM coverage WHERE person_id = ?").all(personId) as Array<{ section: string; status: string }>) coverage[c.section] = c.status;

  const background = [] as Array<{ kind: string; detail: string; provenance: Provenance }>;
  if (person.birth_date) background.push({ kind: "birth", detail: `Born ${person.birth_date}`, provenance: provFor(db, person.source_id as string, person.as_of as string) });

  return {
    person: summary,
    candidacy: { ...cand.info, website: cRow.website, filedOn: cRow.filed_on, provenance: provFor(db, cRow.source_id as string, cRow.as_of as string) },
    race,
    background: { items: background, education, career },
    committees: (db.prepare("SELECT c.name, c.url, m.role, m.source_id, m.as_of FROM committee_membership m JOIN committee c ON c.id = m.committee_id WHERE m.person_id = ?").all(personId) as Array<Record<string, string | null>>)
      .map((c) => ({ name: c.name, url: c.url, role: c.role, provenance: provFor(db, c.source_id as string, c.as_of as string) })),
    links: (db.prepare("SELECT platform, handle, url, source_id, as_of FROM social WHERE person_id = ?").all(personId) as Array<Record<string, string>>)
      .map((l) => ({ platform: l.platform, handle: l.handle, url: l.url, provenance: provFor(db, l.source_id, l.as_of) })),
    agenda: { selfReported: true, items: agenda },
    record: { terms, bills: [], votes: [] },
    finance: fin
      ? { cycle: fin.cycle, receipts: fin.receipts, disbursements: fin.disbursements, cashOnHand: fin.cashOnHand, provenance: provFor(db, fin.source_id as string, fin.as_of as string) }
      : null,
    coverage,
    lastUpdated: (db.prepare("SELECT MAX(retrieved_at) AS t FROM source").get() as { t: string | null }).t,
  };
}

// ---------- Places ----------

export interface PlaceRow {
  id: string; type: "state" | "county" | "city" | "zip"; name: string; label: string; nameNorm: string;
  state: string; fips: string; lat: number | null; lon: number | null; parentId: string | null;
  approximate: boolean; sourceId: string; asOf: string;
}

const PLACE_COLS = `id, type, name, label, name_norm AS nameNorm, state, fips, lat, lon, parent_id AS parentId,
  approximate, source_id AS sourceId, as_of AS asOf`;

function toPlace(r: Record<string, unknown>): PlaceRow {
  return { ...(r as unknown as PlaceRow), approximate: r.approximate === 1 };
}

export function allPlaces(db: DB): PlaceRow[] {
  return (db.prepare(`SELECT ${PLACE_COLS} FROM place`).all() as Array<Record<string, unknown>>).map(toPlace);
}

export function getPlaceRow(db: DB, id: string): PlaceRow | null {
  const r = db.prepare(`SELECT ${PLACE_COLS} FROM place WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return r ? toPlace(r) : null;
}

export function getSource(db: DB, id: string) {
  return db.prepare("SELECT id, name, url, license, attribution, retrieved_at AS retrievedAt FROM source WHERE id = ?")
    .get(id) as { id: string; name: string; url: string; license: string | null; attribution: string | null; retrievedAt: string } | undefined;
}

export function childPlaces(db: DB, parentId: string, type: string): PlaceRow[] {
  return (db.prepare(`SELECT ${PLACE_COLS} FROM place WHERE parent_id = ? AND type = ? ORDER BY name_norm, fips`)
    .all(parentId, type) as Array<Record<string, unknown>>).map(toPlace);
}

export function countPlaces(db: DB, state: string, type: string): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM place WHERE state = ? AND type = ?").get(state, type) as { n: number }).n;
}

export interface OverlapRow { place: PlaceRow; relation: string; share: number | null }

/** Overlaps in either direction (a ZIP lists its counties and cities; a county or city lists its ZIPs). */
export function overlapsOf(db: DB, id: string): OverlapRow[] {
  const rows = db.prepare(
    `SELECT o.relation, o.share, p.id, p.type, p.name, p.label, p.name_norm AS nameNorm, p.state, p.fips, p.lat, p.lon,
            p.parent_id AS parentId, p.approximate, p.source_id AS sourceId, p.as_of AS asOf
     FROM place_overlap o JOIN place p ON p.id = CASE WHEN o.place_id = ?1 THEN o.other_id ELSE o.place_id END
     WHERE o.place_id = ?1 OR o.other_id = ?1
     ORDER BY o.share DESC, p.name_norm`,
  ).all(id) as Array<Record<string, unknown>>;
  return rows.map((r) => ({ place: toPlace(r), relation: String(r.relation), share: (r.share as number | null) ?? null }));
}

/** Sitting officials of a level for the given states (federal: whole state delegation; districts are not resolved). */
export function sittingOfficials(db: DB, level: string, states: string[]): PersonSummary[] {
  if (!states.length) return [];
  const marks = states.map(() => "?").join(",");
  const ids = db.prepare(
    `SELECT DISTINCT p.id FROM person p JOIN office_term t ON t.person_id = p.id
     WHERE p.status = 'current' AND t.level = ? AND t.state IN (${marks})
       AND (t.end_date IS NULL OR t.end_date >= date('now'))`,
  ).all(level, ...states) as Array<{ id: string }>;
  return getSummaries(db, ids.map((r) => r.id)).sort((a, b) =>
    a.body.localeCompare(b.body) || (a.district ?? "").localeCompare(b.district ?? "", undefined, { numeric: true }) || a.name.localeCompare(b.name));
}

// ---------- Exclusions, reports, link health, conflicts ----------

export function setExclusionRules(db: DB, rules: Array<{ category: string; description: string; reason: string }>) {
  db.exec("DELETE FROM exclusion_rule");
  const ins = db.prepare("INSERT INTO exclusion_rule (category, description, reason) VALUES (?,?,?)");
  for (const r of rules) ins.run(r.category, r.description, r.reason);
}

export function listExclusionRules(db: DB) {
  return db.prepare("SELECT category, description, reason FROM exclusion_rule ORDER BY category").all() as
    Array<{ category: string; description: string; reason: string }>;
}

export function addReport(db: DB, r: { target: string; kind: string; note: string }) {
  const res = db.prepare("INSERT INTO correction_report (target, kind, note, created_at) VALUES (?,?,?,?)")
    .run(r.target, r.kind, r.note, new Date().toISOString());
  return Number(res.lastInsertRowid);
}

/** Targets hidden while a report of an excluded category awaits review. */
export function hiddenTargets(db: DB): Set<string> {
  return new Set((db.prepare("SELECT target FROM correction_report WHERE status = 'pending' AND kind = 'excluded-category'").all() as Array<{ target: string }>).map((r) => r.target));
}

export function linkStatus(db: DB, url: string) {
  const r = db.prepare("SELECT ok, http_status AS httpStatus, stale, archive_url AS archiveUrl, archive_captured_at AS archiveCapturedAt, checked_at AS checkedAt FROM link_check WHERE url = ?")
    .get(url) as { ok: number; httpStatus: number | null; stale: number; archiveUrl: string | null; archiveCapturedAt: string | null; checkedAt: string } | undefined;
  return r ? { ...r, ok: !!r.ok, stale: !!r.stale } : null;
}

export interface Conflict {
  subject: string; field: string;
  values: Array<{ value: string; sourceId: string; sourceName: string; sourceUrl: string; grade: string | null; asOf: string }>;
}

/** Same fact reported differently by different sources; every value is returned, none is chosen. */
export function conflictsFor(db: DB, personId: string): Conflict[] {
  const rows = db.prepare(
    `SELECT e.institution, e.degree, e.year, e.source_id, e.as_of, s.name, s.url, s.grade
     FROM education e JOIN source s ON s.id = e.source_id WHERE e.person_id = ?`,
  ).all(personId) as Array<{ institution: string; degree: string | null; year: number | null; source_id: string; as_of: string; name: string; url: string; grade: string | null }>;
  const by = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = normalizeName(r.institution);
    by.set(k, [...(by.get(k) ?? []), r]);
  }
  const out: Conflict[] = [];
  for (const group of by.values()) {
    if (new Set(group.map((g) => g.source_id)).size < 2) continue;
    for (const field of ["degree", "year"] as const) {
      if (new Set(group.map((g) => String(g[field] ?? ""))).size < 2) continue;
      out.push({
        subject: group[0].institution, field,
        values: group.map((g) => ({
          value: String(g[field] ?? "not stated"), sourceId: g.source_id, sourceName: g.name, sourceUrl: g.url, grade: g.grade, asOf: g.as_of,
        })),
      });
    }
  }
  return out;
}

export interface BillRow {
  id: string; jurisdiction: string; session: string; number: string; title: string; summary: string | null;
  status: string; statusDetail: string | null; isLaw: boolean; chapter: string | null; url: string; textUrl: string | null;
  introducedOn: string | null; provenance: Provenance;
}

function billRow(db: DB, r: Record<string, unknown>): BillRow {
  return {
    id: r.id as string, jurisdiction: r.jurisdiction as string, session: r.session as string, number: r.number as string,
    title: r.title as string, summary: (r.summary as string) ?? null, status: r.status as string,
    statusDetail: (r.status_detail as string) ?? null, isLaw: r.is_law === 1, chapter: (r.chapter as string) ?? null,
    url: r.url as string, textUrl: (r.text_url as string) ?? null, introducedOn: (r.introduced_on as string) ?? null,
    provenance: provFor(db, r.source_id as string, r.as_of as string),
  };
}

export function listBills(db: DB, f: { jurisdiction?: string; status?: string; q?: string; limit?: number; offset?: number }) {
  const where: string[] = []; const args: Array<string | number> = [];
  if (f.jurisdiction) { where.push("jurisdiction = ?"); args.push(f.jurisdiction.toUpperCase()); }
  if (f.status) { where.push("status = ?"); args.push(f.status); }
  if (f.q) { where.push("(title LIKE ? OR number LIKE ? OR summary LIKE ?)"); const l = `%${f.q}%`; args.push(l, l, l); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM bill ${w}`).get(...args) as { n: number }).n;
  const rows = db.prepare(`SELECT * FROM bill ${w} ORDER BY session DESC, number LIMIT ? OFFSET ?`)
    .all(...args, Math.min(f.limit ?? 25, 100), f.offset ?? 0) as Array<Record<string, unknown>>;
  return { total, items: rows.map((r) => billRow(db, r)) };
}

export function getBill(db: DB, id: string) {
  const r = db.prepare("SELECT * FROM bill WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!r) return null;
  const sponsors = db.prepare("SELECT name, role FROM bill_sponsor WHERE bill_id = ? ORDER BY role, name").all(id) as Array<{ name: string; role: string }>;
  const actions = db.prepare("SELECT date, chamber, text FROM bill_action WHERE bill_id = ? ORDER BY date, rowid").all(id) as Array<{ date: string; chamber: string | null; text: string }>;
  return { ...billRow(db, r), sponsors, actions };
}
