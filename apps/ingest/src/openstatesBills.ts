import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DB } from "@civic/db";
import { upsertSource } from "./candidates.ts";
import { JURISDICTIONS } from "./openstates.ts";

const SRC = {
  id: "openstates-bills", name: "Open States: state bills and sponsorships", url: "https://openstates.org/",
  license: "Open States terms of use; no copyright claim by Open States", attribution: "Open States (Plural Policy)", authoritative: false,
};
const CACHE = resolve(process.env.CACHE_DIR ?? resolve(import.meta.dirname, "../../../data/cache"), "openstates-bills");
const PAGES_PER_STATE = Number(process.env.OS_BILL_PAGES ?? 5);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface OsBill {
  session: string; identifier: string; title: string; openstates_url: string;
  latest_action_date: string; latest_action_description: string; latest_passage_date: string; first_action_date: string;
  sponsorships: Array<{ primary: boolean; person?: { id: string } | null }>;
}

let quotaHit = false;

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

/** Attaches each state's most recently active bills to their sponsoring legislators (those already imported). */
export async function ingestStateBills(db: DB): Promise<number> {
  const key = process.env.OPENSTATES_API_KEY;
  if (!key) { console.warn("OPENSTATES_API_KEY not set; skipping state bills."); return 0; }
  mkdirSync(CACHE, { recursive: true });
  upsertSource(db, SRC);
  const idMap = new Map<string, string>();
  for (const r of db.prepare("SELECT value, person_id FROM person_identifier WHERE scheme = 'openstates'").all() as Array<{ value: string; person_id: string }>) idMap.set(r.value, r.person_id);

  const rows: Array<[string, OsBill, boolean]> = [];
  for (const juris of JURISDICTIONS) {
    if (juris === "Oregon") continue;
    for (let n = 1; n <= PAGES_PER_STATE; n++) {
      const j = await page(key, juris, n);
      if (!j) { console.warn("bills " + juris + " page " + n + " failed"); break; }
      for (const b of j.results) for (const s of b.sponsorships) {
        const pid = s.person ? idMap.get(s.person.id) : undefined;
        if (pid) rows.push([pid, b, s.primary]);
      }
      if (j.results.length < 20) break;
    }
  }
  if (!rows.length) return 0;
  const asOf = new Date().toISOString().slice(0, 10);
  const ins = db.prepare("INSERT INTO official_record (person_id,section,title,detail,date,publisher,url,source_id,as_of) VALUES (?,'bills',?,?,?,?,?,?,?)");
  db.exec("BEGIN");
  db.prepare("DELETE FROM official_record WHERE source_id = ?").run(SRC.id);
  for (const [pid, b, primary] of rows) {
    ins.run(pid, `${b.identifier}: ${b.title}`,
      `${primary ? "Primary sponsor" : "Cosponsor"} · ${b.session}` + (b.latest_action_description ? ` · Latest action: ${b.latest_action_description}` : "") + (b.latest_passage_date ? ` · Passed ${b.latest_passage_date.slice(0, 10)}` : ""),
      b.first_action_date || null, "Open States", b.openstates_url, SRC.id, asOf);
  }
  db.exec("COMMIT");
  return rows.length;
}
