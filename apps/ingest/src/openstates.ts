import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DB } from "@civic/db";
import { normalizeName, personId } from "@civic/domain";
import { upsertSource } from "./candidates.ts";

const SRC = {
  id: "openstates-people", name: "Open States: state legislators", url: "https://openstates.org/",
  license: "Open States terms of use; no copyright claim by Open States", attribution: "Open States (Plural Policy)", authoritative: false,
};
const CACHE = resolve(process.env.CACHE_DIR ?? resolve(import.meta.dirname, "../../../data/cache"), "openstates");
const ASSEMBLY_YEAR_START = "2025-01-01";

interface OsPerson {
  id: string; name: string; party: string; given_name: string; family_name: string; image: string; email: string;
  gender: string; birth_date: string;
  current_role?: { title: string; org_classification: string; district: string };
  jurisdiction: { id: string; name: string };
  openstates_url: string; links: Array<{ url: string }>;
  offices: Array<{ voice: string; address: string; classification: string }>;
}

export const JURISDICTIONS = ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming","District of Columbia","Puerto Rico"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function page(key: string, juris: string, n: number): Promise<{ results: OsPerson[]; pagination: { max_page: number } } | null> {
  const file = resolve(CACHE, `people-${juris.replace(/ /g, "_")}-${n}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const url = `https://v3.openstates.org/people?jurisdiction=${encodeURIComponent(juris)}&per_page=50&page=${n}&include=offices&include=links`;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url, { headers: { "X-API-KEY": key } });
    if (res.status === 429) { await sleep(65_000); continue; }
    if (!res.ok) return null;
    const j = await res.json();
    writeFileSync(file, JSON.stringify(j));
    await sleep(6500);
    return j;
  }
  return null;
}

/** Imports sitting state legislators (Oregon is handled by the official OLIS feed). Resumable via on-disk page cache. */
export async function ingestOpenStates(db: DB): Promise<number> {
  const key = process.env.OPENSTATES_API_KEY;
  if (!key) { console.warn("OPENSTATES_API_KEY not set; skipping state legislators."); return 0; }
  mkdirSync(CACHE, { recursive: true });
  upsertSource(db, SRC);
  const all: OsPerson[] = [];
  for (const juris of JURISDICTIONS) {
    let max = 1;
    for (let n = 1; n <= max; n++) {
      const j = await page(key, juris, n);
      if (!j) { console.warn("Open States " + juris + " page " + n + " failed; skipping."); break; }
      max = j.pagination.max_page;
      all.push(...j.results);
    }
  }
  const people = all.filter((p) => p.current_role && !p.jurisdiction.id.includes("state:or/"));
  if (people.length < 500) { console.warn("Open States: only " + people.length + " people, skipping."); return 0; }

  const asOf = new Date().toISOString().slice(0, 10);
  const insP = db.prepare("INSERT OR REPLACE INTO person (id,canonical_name,given,family,birth_date,gender,photo_url,status,source_id,as_of) VALUES (?,?,?,?,?,?,?,'current',?,?)");
  const insI = db.prepare("INSERT OR IGNORE INTO person_identifier (person_id,scheme,value) VALUES (?,?,?)");
  const insN = db.prepare("INSERT INTO person_name (person_id,name,name_norm,kind) VALUES (?,?,?,?)");
  const insT = db.prepare("INSERT INTO office_term (person_id,level,branch,body,title,state,district,party,start_date,end_date,website,phone,address,contact_form,office_type,how_filled,source_id,as_of) VALUES (?,'state','legislative',?,?,?,?,?,?,NULL,?,?,?,?,'state_legislator',NULL,?,?)");
  const insC = db.prepare("INSERT OR REPLACE INTO coverage (person_id,section,status) VALUES (?,?,?)");

  db.exec("BEGIN");
  try {
    const stale = db.prepare("SELECT id FROM person WHERE source_id = ?").all(SRC.id) as { id: string }[];
    for (const { id } of stale) {
      for (const t of ["office_term", "person_name", "person_identifier", "coverage", "official_record"]) db.prepare("DELETE FROM " + t + " WHERE person_id = ?").run(id);
      db.prepare("DELETE FROM person WHERE id = ?").run(id);
    }
    let n = 0;
    for (const p of people) {
      const id = personId("openstates", p.id);
      const st = (/state:([a-z]{2})\//.exec(p.jurisdiction.id)?.[1] ?? "").toUpperCase();
      const upper = p.current_role!.org_classification === "upper";
      const office = p.offices.find((o) => o.classification === "capitol") ?? p.offices[0];
      const name = p.name;
      insP.run(id, name, p.given_name || null, p.family_name || null, p.birth_date || null, p.gender || null, p.image || null, SRC.id, asOf);
      insI.run(id, "openstates", p.id);
      insN.run(id, name, normalizeName(name), "legal");
      insT.run(id, p.jurisdiction.name + (upper ? " State Senate" : " Legislature (lower chamber)"), p.current_role!.title,
        st, p.current_role!.district || null, p.party || null, ASSEMBLY_YEAR_START,
        p.links[0]?.url ?? p.openstates_url, office?.voice || null, office?.address || null,
        p.email ? "mailto:" + p.email : null, SRC.id, asOf);
      for (const s of ["identity", "terms", "contact"]) insC.run(id, s, "complete");
      n++;
    }
    db.exec("COMMIT");
    return n;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
