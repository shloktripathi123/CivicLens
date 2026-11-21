import { photoFor, type DB } from "@civic/db";
import { normalizeName, personId } from "@civic/domain";
import { nameVariants } from "./adapter.ts";

const URL_ = "https://unitedstates.github.io/congress-legislators/executive.json";
const SOURCE_ID = "congress-legislators";

export interface ExecTerm { type: "prez" | "viceprez"; start: string; end: string; party?: string; how?: string }
export interface ExecPerson {
  id: Record<string, string | number | string[]>;
  name: { first: string; middle?: string; last: string; suffix?: string; nickname?: string; official_full?: string };
  bio: { birthday?: string; gender?: string };
  terms: ExecTerm[];
}

const HOW: Record<string, string> = { election: "election", succession: "succession", appointment: "appointment" };

/** Stable id: the bioguide id when present, so people who also served in Congress merge into one profile. */
export function execPersonId(p: ExecPerson): string {
  if (p.id.bioguide) return personId("bioguide", String(p.id.bioguide));
  return personId("govtrack", String(p.id.govtrack));
}

export function loadExecutive(db: DB, list: ExecPerson[], asOf: string, today = asOf): number {
  const exists = db.prepare("SELECT status FROM person WHERE id = ?");
  const insPerson = db.prepare(
    `INSERT INTO person (id, canonical_name, given, family, birth_date, gender, photo_url, status, source_id, as_of)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  );
  const setStatus = db.prepare("UPDATE person SET status = ? WHERE id = ?");
  const insIdent = db.prepare("INSERT OR IGNORE INTO person_identifier (person_id, scheme, value) VALUES (?,?,?)");
  const insName = db.prepare("INSERT INTO person_name (person_id, name, name_norm, kind) VALUES (?,?,?,?)");
  const hasName = db.prepare("SELECT 1 FROM person_name WHERE person_id = ? AND name_norm = ?");
  const insTerm = db.prepare(
    `INSERT INTO office_term (person_id, level, branch, body, title, state, district, party, start_date, end_date,
       office_type, how_filled, source_id, as_of)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  let created = 0;

  for (const p of list) {
    const id = execPersonId(p);
    const open = p.terms.some((t) => t.end > today);
    const found = exists.get(id) as { status: string } | undefined;
    if (!found) {
      const canonical = p.name.official_full ?? `${p.name.first} ${p.name.last}`;
      insPerson.run(
        id, canonical, p.name.first, p.name.last, p.bio.birthday ?? null, p.bio.gender ?? null,
        p.id.bioguide ? photoFor(String(p.id.bioguide)) : null, open ? "current" : "former", SOURCE_ID, asOf,
      );
      created++;
    } else if (open && found.status !== "current") {
      setStatus.run("current", id);
    }
    for (const [scheme, v] of Object.entries(p.id)) {
      for (const val of Array.isArray(v) ? v : [v]) insIdent.run(id, scheme, String(val));
    }
    for (const v of nameVariants(p.name)) {
      const norm = normalizeName(v.name);
      if (!hasName.get(id, norm)) insName.run(id, v.name, norm, v.kind);
    }
    for (const t of p.terms) {
      const prez = t.type === "prez";
      insTerm.run(
        id, "federal", "executive",
        prez ? "President of the United States" : "Vice President of the United States",
        prez ? "President" : "Vice President",
        null, null, t.party ?? null, t.start, t.end >= t.start ? t.end : null,
        prez ? "president" : "vice_president", HOW[t.how ?? ""] ?? null, SOURCE_ID, asOf,
      );
    }
  }
  return created;
}

export async function ingestExecutive(db: DB) {
  const res = await fetch(URL_);
  if (!res.ok) throw new Error(`Fetch executive.json failed: ${res.status}`);
  const list = (await res.json()) as ExecPerson[];
  const asOf = new Date().toISOString().slice(0, 10);
  db.exec("BEGIN");
  try { loadExecutive(db, list, asOf); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
  console.log(`Executive: ${list.length} presidents and vice presidents loaded`);
}
