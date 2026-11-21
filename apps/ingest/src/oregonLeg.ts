import type { DB } from "@civic/db";
import { isLaw, mapOregonStatus } from "@civic/domain";
import { upsertSource } from "./candidates.ts";

const BASE = "https://api.oregonlegislature.gov/odata/odataservice.svc";
export const SESSIONS = ["2026R1", "2025R1"];
const SRC = {
  id: "oregon-legislature-odata", name: "Oregon Legislature OLIS (OData service)", url: "https://olis.oregonlegislature.gov/liz/",
  license: "Public record", attribution: "Oregon State Legislature", authoritative: true,
};

async function page<T>(entity: string, session: string, order: string): Promise<T[]> {
  const out: T[] = [];
  for (let skip = 0; ; skip += 1000) {
    const url = `${BASE}/${entity}?$format=json&$filter=${encodeURIComponent(`SessionKey eq '${session}'`)}&$top=1000&$skip=${skip}&$orderby=${order}`;
    let res: Response | undefined;
    for (let i = 0; i < 3 && !res?.ok; i++) res = await fetch(url);
    if (!res?.ok) throw new Error(`${entity} ${session}: HTTP ${res?.status}`);
    const v = ((await res.json()) as { value: T[] }).value;
    out.push(...v);
    if (v.length < 1000) return out;
  }
}

interface M { MeasurePrefix: string; MeasureNumber: number; CatchLine: string | null; MeasureSummary: string | null; CurrentLocation: string; ChapterNumber: number | null }
interface S { MeasurePrefix: string; MeasureNumber: number; LegislatoreCode: string | null; CommitteeCode: string | null; SponsorType: string; SponsorLevel: string }
interface H { MeasurePrefix: string; MeasureNumber: number; Chamber: string; ActionDate: string; ActionText: string }

const key = (p: string, n: number) => `${p} ${n}`;

export async function ingestOregonBills(db: DB) {
  const asOf = new Date().toISOString().slice(0, 10);
  upsertSource(db, SRC);
  const insB = db.prepare("INSERT OR REPLACE INTO bill (id,jurisdiction,session,number,title,summary,status,status_detail,is_law,chapter,url,text_url,introduced_on,source_id,as_of) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  const insS = db.prepare("INSERT INTO bill_sponsor (bill_id,name,role,source_id,as_of) VALUES (?,?,?,?,?)");
  const insA = db.prepare("INSERT INTO bill_action (bill_id,date,chamber,text,source_id,as_of) VALUES (?,?,?,?,?,?)");
  let total = 0;
  for (const session of SESSIONS) {
    const [measures, sponsors, history] = await Promise.all([
      page<M>("Measures", session, "MeasurePrefix,MeasureNumber"),
      page<S>("MeasureSponsors", session, "MeasurePrefix,MeasureNumber,LegislatoreCode"),
      page<H>("MeasureHistoryActions", session, "MeasurePrefix,MeasureNumber,ActionDate"),
    ]);
    const hBy = new Map<string, H[]>(); for (const h of history) (hBy.get(key(h.MeasurePrefix, h.MeasureNumber)) ?? hBy.set(key(h.MeasurePrefix, h.MeasureNumber), []).get(key(h.MeasurePrefix, h.MeasureNumber))!).push(h);
    const sBy = new Map<string, S[]>(); for (const s of sponsors) (sBy.get(key(s.MeasurePrefix, s.MeasureNumber)) ?? sBy.set(key(s.MeasurePrefix, s.MeasureNumber), []).get(key(s.MeasurePrefix, s.MeasureNumber))!).push(s);
    db.exec("BEGIN");
    try {
      for (const m of measures) {
        const k = key(m.MeasurePrefix, m.MeasureNumber);
        const hs = hBy.get(k) ?? [];
        const status = mapOregonStatus({ prefix: m.MeasurePrefix, currentLocation: m.CurrentLocation, chapterNumber: m.ChapterNumber, history: hs.map((h) => ({ chamber: h.Chamber, text: h.ActionText })) });
        const compact = `${m.MeasurePrefix}${m.MeasureNumber}`;
        const id = `or:${session}:${compact}`;
        const title = (m.CatchLine ?? "").trim() || m.MeasureSummary?.trim().slice(0, 140) || `${k} (no title provided by source)`;
        insB.run(id, "OR", session, k, title, m.MeasureSummary?.trim() || null, status, m.CurrentLocation, isLaw(status) ? 1 : 0,
          m.ChapterNumber != null ? `Chapter ${m.ChapterNumber}` : null,
          `https://olis.oregonlegislature.gov/liz/${session}/Measures/Overview/${compact}`,
          `https://olis.oregonlegislature.gov/liz/${session}/Downloads/MeasureDocument/${compact}/Introduced`,
          hs[0]?.ActionDate.slice(0, 10) ?? null, SRC.id, asOf);
        for (const s of sBy.get(k) ?? []) insS.run(id, s.LegislatoreCode ?? (s.CommitteeCode ? `Committee ${s.CommitteeCode}` : `Not named by source (${s.SponsorType})`), s.SponsorLevel, SRC.id, asOf);
        for (const h of hs) insA.run(id, h.ActionDate.slice(0, 10), h.Chamber, h.ActionText, SRC.id, asOf);
        total++;
      }
      db.exec("COMMIT");
    } catch (e) { db.exec("ROLLBACK"); throw e; }
  }
  console.log(`Oregon bills ingested: ${total}`);
}
