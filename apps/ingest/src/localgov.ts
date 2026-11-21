import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DB } from "@civic/db";
import { upsertSource } from "./candidates.ts";
import { gazetteer } from "./places.ts";

const SEED = resolve(import.meta.dirname, "../../../data/local-gov/portland-metro.json");
const SRC_SEED = {
  id: "local-gov-official",
  name: "Official local-government websites (curated, each fact linked to its page)",
  url: "https://www.usa.gov/local-governments",
  license: "Public information published by each government",
  attribution: "Each unit's official website",
  authoritative: true,
};
const SRC_SD = {
  id: "census-school-districts",
  name: "U.S. Census Bureau Gazetteer: school districts",
  url: "https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html",
  license: "Public domain (U.S. government work)",
  attribution: "U.S. Census Bureau",
  authoritative: true,
};

export interface TrimetDirector { name: string; title: string | null; district: string; area: string; appointed: string; expires: string }

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function isoDate(s: string): string | null {
  const m = s.match(/^(\w+) (\d{1,2}), (\d{4})$/);
  const mi = m ? MONTHS.indexOf(m[1]) : -1;
  return m && mi >= 0 ? `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
}

/** Parse TriMet's board page text. Returns only complete entries; the caller warns if fewer than expected. */
export function parseTrimetBoard(html: string): TrimetDirector[] {
  const t = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
  const tok = String.raw`(?!(?:Vice-)?President\b|Secretary\b|Treasurer\b)[A-Z][\w’'-]+`;
  const re = new RegExp(String.raw`((?:(?:Dr|Mr|Ms|Mrs)\. )?${tok}(?: ${tok}){1,2}) ((?:Vice-)?President |Secretary/Treasurer |Secretary |Treasurer )?District (\d): (.{3,60}?) View district map First appointed (\w+ \d{1,2}, \d{4}) Term expires (\w+ \d{1,2}, \d{4})`, "g");
  return [...t.matchAll(re)].map((m) => ({ name: m[1], title: m[2]?.trim() ?? null, district: m[3], area: m[4].trim(), appointed: m[5], expires: m[6] }));
}

interface SeedOffice {
  id: string; title: string; role: string; selection?: string; appointing?: string; termYears?: number; termLimit?: string;
  seats?: number; nonpartisan?: boolean; sourceUrl: string; holders: Array<{ name: string; seat?: string; email?: string }>;
}
interface SeedUnit {
  id: string; kind: string; name: string; state: string; fips?: string; placeIds: string[]; function?: string; form?: string;
  officialUrl?: string; offices: SeedOffice[];
  meetings: Array<{ body: string; schedule: string; location?: string; attend?: string; publicComment?: string; sourceUrl: string }>;
}

export function loadSeeds(db: DB, seed: { asOf: string; units: SeedUnit[] }) {
  const s = SRC_SEED.id, a = seed.asOf;
  const uU = db.prepare("INSERT OR REPLACE INTO gov_unit (id,kind,name,state,place_id,fips,function,form,form_basis,official_url,source_id,as_of) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
  const uO = db.prepare("INSERT OR REPLACE INTO gov_office (id,unit_id,title,role,selection,appointing,term_years,term_limit,seats,nonpartisan,source_url,source_id,as_of) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
  const uH = db.prepare("INSERT INTO gov_holder (office_id,name,seat,email,source_id,as_of) VALUES (?,?,?,?,?,?)");
  const uM = db.prepare("INSERT INTO gov_meeting (unit_id,body,schedule,location,attend,public_comment,source_url,source_id,as_of) VALUES (?,?,?,?,?,?,?,?,?)");
  const uA = db.prepare("INSERT OR REPLACE INTO gov_area (place_id,unit_id,relation,source_id,as_of) VALUES (?,?,?,?,?)");
  for (const u of seed.units) {
    uU.run(u.id, u.kind, u.name, u.state, u.placeIds[0] ?? null, u.fips ?? null, u.function ?? null, u.form ?? null, "published", u.officialUrl ?? null, s, a);
    for (const o of u.offices) {
      uO.run(o.id, u.id, o.title, o.role, o.selection ?? null, o.appointing ?? null, o.termYears ?? null, o.termLimit ?? null,
        o.seats ?? null, o.nonpartisan === undefined ? null : o.nonpartisan ? 1 : 0, o.sourceUrl, s, a);
      for (const h of o.holders) uH.run(o.id, h.name, h.seat ?? null, h.email ?? null, s, a);
    }
    for (const m of u.meetings) uM.run(u.id, m.body, m.schedule, m.location ?? null, m.attend ?? null, m.publicComment ?? null, m.sourceUrl, s, a);
    for (const p of u.placeIds) uA.run(p, u.id, u.kind === "county" || u.kind === "city" ? "governs" : "serves part of", s, a);
  }
}

async function loadTrimet(db: DB, asOf: string) {
  try {
    const res = await fetch("https://trimet.org/about/board.htm", { headers: { "User-Agent": "Mozilla/5.0" } });
    const dirs = parseTrimetBoard(await res.text());
    if (dirs.length < 5) { console.warn(`TriMet board: parsed ${dirs.length}, expected 7; keeping seed without holders.`); return; }
    const ins = db.prepare("INSERT INTO gov_holder (office_id,name,seat,start_date,end_date,source_id,as_of) VALUES ('trimet-board',?,?,?,?,?,?)");
    for (const d of dirs) ins.run(d.title ? `${d.name} (${d.title})` : d.name, `District ${d.district}: ${d.area}`, isoDate(d.appointed), isoDate(d.expires), "local-gov-official", asOf);
    console.log(`TriMet board: ${dirs.length} directors.`);
  } catch (e) {
    console.warn("TriMet board fetch failed:", (e as Error).message);
  }
}

export async function ingestLocalGov(db: DB): Promise<number> {
  upsertSource(db, SRC_SEED);
  upsertSource(db, SRC_SD);
  const asOf = new Date().toISOString().slice(0, 10);
  loadSeeds(db, JSON.parse(readFileSync(SEED, "utf8")));
  await loadTrimet(db, asOf);
  const rows = await gazetteer("2024_Gaz_unsd_national");
  const ins = db.prepare("INSERT OR IGNORE INTO gov_unit (id,kind,name,state,fips,function,source_id,as_of) VALUES (?,?,?,?,?,?,?,?)");
  let n = 0;
  for (const r of rows) {
    if (!r.GEOID) continue;
    ins.run(`sd:${r.GEOID}`, "school_district", r.NAME, r.USPS, r.GEOID, "Public school district", SRC_SD.id, asOf);
    n++;
  }
  return n;
}
