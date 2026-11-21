import type { DB } from "@civic/db";
import { normalizeName, personId } from "@civic/domain";
import type { CandidacyStatus } from "@civic/domain";

export interface SourceDef { id: string; name: string; url: string; license: string; attribution: string; authoritative: boolean }

export function upsertSource(db: DB, s: SourceDef) {
  db.prepare(
    `INSERT OR REPLACE INTO source (id,name,url,license,attribution,retrieved_at,authoritative) VALUES (?,?,?,?,?,?,?)`,
  ).run(s.id, s.name, s.url, s.license, s.attribution, new Date().toISOString(), s.authoritative ? 1 : 0);
}

export interface OfficeDef { level: string; body: string; jurisdiction: string; title: string; district: string | null }
export interface RaceDef {
  office: OfficeDef; electionDate: string; electionType: "general" | "primary" | "runoff" | "special";
}

const today = () => new Date().toISOString().slice(0, 10);

export function upsertRace(db: DB, r: RaceDef, sourceId: string, asOf: string): string {
  const officeId = `office:${r.office.level}:${r.office.jurisdiction}:${r.office.body}:${r.office.district ?? "-"}`.toLowerCase().replace(/\s+/g, "-");
  const electionId = `election:${r.office.jurisdiction}:${r.electionDate}:${r.electionType}`;
  const raceId = `race:${electionId.slice("election:".length)}:${officeId.slice("office:".length)}`;
  db.prepare("INSERT OR IGNORE INTO office (id,level,body,jurisdiction,title,district,source_id,as_of) VALUES (?,?,?,?,?,?,?,?)")
    .run(officeId, r.office.level, r.office.body, r.office.jurisdiction, r.office.title, r.office.district, sourceId, asOf);
  db.prepare("INSERT OR IGNORE INTO election (id,date,type,jurisdiction,source_id,as_of) VALUES (?,?,?,?,?,?)")
    .run(electionId, r.electionDate, r.electionType, r.office.jurisdiction, sourceId, asOf);
  db.prepare("INSERT OR IGNORE INTO race (id,election_id,office_id,status,source_id,as_of) VALUES (?,?,?,?,?,?)")
    .run(raceId, electionId, officeId, r.electionDate >= today() ? "upcoming" : "completed", sourceId, asOf);
  return raceId;
}

export interface CandidateDef {
  externalScheme: string; externalId: string; name: string; given: string | null; family: string | null;
  party: string | null; status: CandidacyStatus; incumbent: boolean; filedOn: string | null; website: string | null;
}

export function nameRows(name: string, given: string | null, family: string | null): string[] {
  const set = new Set([name]);
  if (given && family) { set.add(`${given} ${family}`); set.add(`${family}, ${given}`); }
  return [...set];
}

/**
 * Identity matching: an existing external identifier wins; otherwise an exact normalized-name match
 * among people who hold or held an office in the same state (so a sitting official is never duplicated).
 */
export function resolvePerson(db: DB, c: CandidateDef, state: string | null): string | null {
  const byId = db.prepare("SELECT person_id AS id FROM person_identifier WHERE scheme = ? AND value = ?")
    .get(c.externalScheme, c.externalId) as { id: string } | undefined;
  if (byId) return byId.id;
  if (!state) return null;
  const norm = normalizeName(c.name);
  const rows = db.prepare(
    `SELECT DISTINCT n.person_id AS id FROM person_name n JOIN office_term t ON t.person_id = n.person_id
     WHERE n.name_norm = ? AND t.state = ?`,
  ).all(norm, state) as Array<{ id: string }>;
  return rows.length === 1 ? rows[0].id : null;
}

export function addCandidacy(
  db: DB, c: CandidateDef, raceId: string, state: string | null, sourceId: string, asOf: string,
): { personId: string; candidacyId: string; created: boolean } {
  let pid = resolvePerson(db, c, state);
  let created = false;
  if (!pid) {
    pid = personId(c.externalScheme, c.externalId);
    created = true;
    db.prepare(
      `INSERT OR IGNORE INTO person (id, canonical_name, given, family, birth_date, gender, photo_url, status, source_id, as_of)
       VALUES (?,?,?,?,NULL,NULL,NULL,'candidate',?,?)`,
    ).run(pid, c.name, c.given, c.family, sourceId, asOf);
    const insName = db.prepare("INSERT INTO person_name (person_id,name,name_norm,kind) VALUES (?,?,?,?)");
    for (const n of nameRows(c.name, c.given, c.family)) insName.run(pid, n, normalizeName(n), "variant");
  }
  db.prepare("INSERT OR IGNORE INTO person_identifier (person_id, scheme, value) VALUES (?,?,?)").run(pid, c.externalScheme, c.externalId);
  const candidacyId = `cand:${pid}:${raceId}`;
  db.prepare(
    `INSERT OR REPLACE INTO candidacy (id,person_id,race_id,party,status,incumbent,filed_on,website,source_id,as_of)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).run(candidacyId, pid, raceId, c.party, c.status, c.incumbent ? 1 : 0, c.filedOn, c.website, sourceId, asOf);
  return { personId: pid, candidacyId, created };
}

/** Coverage rows for candidate-only people and candidacy-specific sections for everyone with a candidacy. */
export function candidateCoverage(db: DB) {
  const ins = db.prepare("INSERT OR REPLACE INTO coverage (person_id, section, status) VALUES (?,?,?)");
  const people = db.prepare("SELECT DISTINCT person_id AS id FROM candidacy").all() as Array<{ id: string }>;
  const hasCoverage = db.prepare("SELECT 1 FROM coverage WHERE person_id = ?");
  const hasFin = db.prepare("SELECT 1 FROM finance_summary f JOIN candidacy c ON c.id = f.candidacy_id WHERE c.person_id = ?");
  const hasAgenda = db.prepare("SELECT 1 FROM agenda_item a JOIN candidacy c ON c.id = a.candidacy_id WHERE c.person_id = ?");
  const hasEdu = db.prepare("SELECT 1 FROM education WHERE person_id = ?");
  for (const { id } of people) {
    if (!hasCoverage.get(id)) {
      for (const s of ["identity", "terms"]) ins.run(id, s, "complete");
      for (const s of ["committees", "contact", "background", "bills", "votes", "affiliations", "ratings"]) ins.run(id, s, "unavailable");
    }
    ins.run(id, "candidacy", "complete");
    ins.run(id, "funding", hasFin.get(id) ? "complete" : "unavailable");
    ins.run(id, "agenda", hasAgenda.get(id) ? "complete" : "unavailable");
    ins.run(id, "education", hasEdu.get(id) ? "complete" : "unavailable");
    const has = (sql: string) => (db.prepare(sql).get(id) ? "complete" : "unavailable");
    ins.run(id, "committees", has("SELECT 1 FROM committee_membership WHERE person_id = ?"));
    ins.run(id, "contact", has("SELECT 1 FROM social WHERE person_id = ?"));
    ins.run(id, "background", has("SELECT 1 FROM career_item WHERE person_id = ?"));
  }
}
