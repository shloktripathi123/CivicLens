import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DB } from "@civic/db";
import { upsertSource } from "./candidates.ts";
import { JURISDICTIONS } from "./openstates.ts";
import { STATE_NAMES } from "./calendar.ts";

const SRC = {
  id: "openstates-bills", name: "Open States: state bills and sponsorships", url: "https://openstates.org/",
  license: "Open States terms of use; no copyright claim by Open States", attribution: "Open States (Plural Policy)", authoritative: false,
};
const CACHE = resolve(process.env.CACHE_DIR ?? resolve(import.meta.dirname, "../../../data/cache"), "openstates-bills");
const PAGES_PER_STATE = Number(process.env.OS_BILL_PAGES ?? 5);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface OsBill {
  id: string; session: string; identifier: string; title: string; openstates_url: string;
  latest_action_date: string; latest_action_description: string; first_action_date: string;
  sponsorships?: Array<{ name: string; primary: boolean; person?: { id: string } | null }>;
}

let quotaHit = false;
const STATE_CODES = new Map([...Object.entries(STATE_NAMES).map(([code, name]) => [name, code] as const),
  ["District of Columbia", "DC"], ["Puerto Rico", "PR"]]);

async function page(key: string, juris: string, n: number): Promise<{ results: OsBill[] } | null> {
  const file = resolve(CACHE, `${juris.replace(/ /g, "_")}-${n}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  if (quotaHit) return null;
  const url = `https://v3.openstates.org/bills?jurisdiction=${encodeURIComponent(juris)}&per_page=20&page=${n}&sort=updated_desc&include=sponsorships`;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url, { headers: { "X-API-KEY": key } });
    if (res.status === 429) {
      // The free tier has a hard daily cap; waiting a minute will not help.
      if ((await res.text()).includes("/day")) { quotaHit = true; console.warn("Open States daily quota reached; re-run tomorrow to continue (cached pages are kept)."); return null; }
      await sleep(65_000); continue;
    }
    if (!res.ok) return null;
    const j = await res.json();
    writeFileSync(file, JSON.stringify(j));
    await sleep(6500);
    return j;
  }
  return null;
}

/** Imports recent bills and links them to sponsoring legislators already in the database. */
export async function ingestStateBills(db: DB, { includeOregon = false }: { includeOregon?: boolean } = {}): Promise<number> {
  const key = process.env.OPENSTATES_API_KEY;
  if (!key) { console.warn("OPENSTATES_API_KEY not set; skipping state bills."); return 0; }
  mkdirSync(CACHE, { recursive: true });
  upsertSource(db, SRC);
  const rows: Array<{ state: string; bill: OsBill }> = [];
  for (const juris of JURISDICTIONS) {
    if (juris === "Oregon" && !includeOregon) continue;
    const state = STATE_CODES.get(juris);
    if (!state) throw new Error(`Unknown Open States jurisdiction: ${juris}`);
    for (let n = 1; n <= PAGES_PER_STATE; n++) {
      const j = await page(key, juris, n);
      if (!j) { console.warn("bills " + juris + " page " + n + " failed"); break; }
      for (const bill of j.results) rows.push({ state, bill });
      if (j.results.length < 20) break;
    }
  }
  if (!rows.length) return 0;
  return loadStateBills(db, rows, new Date().toISOString().slice(0, 10));
}

export function loadStateBills(db: DB, rows: Array<{ state: string; bill: OsBill }>, asOf: string): number {
  const idMap = new Map<string, string>();
  for (const r of db.prepare("SELECT value, person_id FROM person_identifier WHERE scheme = 'openstates'").all() as Array<{ value: string; person_id: string }>) idMap.set(r.value, r.person_id);
  const billInsert = db.prepare(`INSERT INTO bill (id,jurisdiction,session,number,title,summary,status,status_detail,is_law,chapter,url,text_url,introduced_on,source_id,as_of)
    VALUES (?,?,?,?,?,NULL,'unknown',?,0,NULL,?,NULL,?,?,?)
    ON CONFLICT(id) DO UPDATE SET jurisdiction=excluded.jurisdiction,session=excluded.session,number=excluded.number,
    title=excluded.title,status=excluded.status,status_detail=excluded.status_detail,is_law=0,url=excluded.url,
    introduced_on=excluded.introduced_on,source_id=excluded.source_id,as_of=excluded.as_of`);
  const sponsorInsert = db.prepare("INSERT INTO bill_sponsor (bill_id,name,role,source_id,as_of) VALUES (?,?,?,?,?)");
  const actionInsert = db.prepare("INSERT INTO bill_action (bill_id,date,chamber,text,source_id,as_of) VALUES (?,?,NULL,?,?,?)");
  const ins = db.prepare("INSERT INTO official_record (person_id,section,title,detail,date,publisher,url,source_id,as_of) VALUES (?,'bills',?,?,?,?,?,?,?)");
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM official_record WHERE source_id = ?").run(SRC.id);
    let count = 0;
    for (const { state, bill: b } of rows) {
      if (!b.id || !b.session || !b.identifier || !b.title || !b.openstates_url) {
        console.warn(`Open States: skipped incomplete bill in ${state}.`);
        continue;
      }
      billInsert.run(b.id, state, b.session, b.identifier, b.title, b.latest_action_description || null,
        b.openstates_url, b.first_action_date || null, SRC.id, asOf);
      db.prepare("DELETE FROM bill_sponsor WHERE bill_id = ?").run(b.id);
      db.prepare("DELETE FROM bill_action WHERE bill_id = ?").run(b.id);
      for (const s of b.sponsorships ?? []) {
        if (s.name) sponsorInsert.run(b.id, s.name, s.primary ? "Primary sponsor" : "Sponsor", SRC.id, asOf);
        const pid = s.person ? idMap.get(s.person.id) : undefined;
        if (pid) ins.run(pid, `${b.identifier}: ${b.title}`,
          `${s.primary ? "Primary sponsor" : "Sponsor"} · ${b.session}` + (b.latest_action_description ? ` · Latest action: ${b.latest_action_description}` : ""),
          b.first_action_date || null, "Open States", b.openstates_url, SRC.id, asOf);
      }
      if (b.latest_action_date && b.latest_action_description) actionInsert.run(b.id, b.latest_action_date, b.latest_action_description, SRC.id, asOf);
      count++;
    }
    db.exec("COMMIT");
    return count;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
