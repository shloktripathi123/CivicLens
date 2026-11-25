import type { DB } from "@civic/db";
import { upsertSource } from "./candidates.ts";

const CONGRESS_SRC = {
  id: "congress-gov-api", name: "Congress.gov API (Library of Congress): sponsored legislation", url: "https://www.congress.gov/",
  license: "Public domain (U.S. government work)", attribution: "Library of Congress, Congress.gov", authoritative: true,
};
const FEC_SRC = {
  id: "openfec-api", name: "OpenFEC API (Federal Election Commission): candidate financial totals", url: "https://www.fec.gov/data/",
  license: "Public domain (U.S. government work)", attribution: "Federal Election Commission", authoritative: true,
};

const SLUG: Record<string, string> = {
  S: "senate-bill", HR: "house-bill", SRES: "senate-resolution", HRES: "house-resolution",
  SJRES: "senate-joint-resolution", HJRES: "house-joint-resolution", SCONRES: "senate-concurrent-resolution", HCONRES: "house-concurrent-resolution",
};

export function billUrl(congress: number, type: string, number: string): string {
  const ord = congress % 10 === 1 && congress !== 111 ? "st" : congress % 10 === 2 && congress !== 112 ? "nd" : congress % 10 === 3 && congress !== 113 ? "rd" : "th";
  return `https://www.congress.gov/bill/${congress}${ord}-congress/${SLUG[type] ?? "bill"}/${number}`;
}

async function getJson(url: string): Promise<any | null> {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) { await new Promise((r) => setTimeout(r, 2000 * (i + 1))); continue; }
      if (!res.ok) return null;
      return await res.json();
    } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  return null;
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]!); }));
}

const usd = (n: number | null | undefined) => (n == null ? "n/a" : "$" + Math.round(n).toLocaleString("en-US"));

/** Ingest records for members with a current federal congressional term. */
export async function ingestFederalRecords(db: DB): Promise<{ bills: number; funding: number }> {
  const ckey = process.env.CONGRESS_API_KEY, fkey = process.env.FEC_API_KEY;
  const asOf = new Date().toISOString().slice(0, 10);
  const currentTerm = "EXISTS (SELECT 1 FROM office_term t WHERE t.person_id = pi.person_id " +
    "AND t.level = 'federal' AND t.body IN ('U.S. House', 'U.S. Senate') " +
    "AND t.start_date <= ? AND (t.end_date IS NULL OR t.end_date >= ?))";
  const members = db.prepare(
    "SELECT DISTINCT pi.person_id AS id, pi.value AS bioguide FROM person_identifier pi " +
    `WHERE pi.scheme = 'bioguide' AND ${currentTerm}`,
  ).all(asOf, asOf) as Array<{ id: string; bioguide: string }>;
  const ins = db.prepare("INSERT INTO official_record (person_id,section,title,detail,date,publisher,url,source_id,as_of) VALUES (?,?,?,?,?,?,?,?,?)");
  const out = { bills: 0, funding: 0 };

  if (ckey) {
    upsertSource(db, CONGRESS_SRC);
    const rows: Array<[string, any]> = [];
    await pool(members, 6, async (m) => {
      const j = await getJson(`https://api.congress.gov/v3/member/${m.bioguide}/sponsored-legislation?limit=25&format=json&api_key=${ckey}`);
      for (const b of j?.sponsoredLegislation ?? []) rows.push([m.id, b]);
    });
    if (rows.length) {
      db.exec("BEGIN");
      db.prepare("DELETE FROM official_record WHERE source_id = ?").run(CONGRESS_SRC.id);
      for (const [id, b] of rows) {
        const la = b.latestAction;
        ins.run(id, "bills", `${b.type} ${b.number}: ${b.title}`,
          `Sponsored · ${b.congress}th Congress` + (la?.text ? ` · Latest action: ${la.text}` : ""),
          b.introducedDate ?? null, "Congress.gov", billUrl(b.congress, b.type, b.number), CONGRESS_SRC.id, asOf);
        out.bills++;
      }
      db.exec("COMMIT");
    }
  } else console.warn("CONGRESS_API_KEY not set; skipping sponsored legislation.");

  if (fkey) {
    upsertSource(db, FEC_SRC);
    const fec = db.prepare(
      `SELECT DISTINCT pi.person_id AS id, pi.value AS fec FROM person_identifier pi WHERE pi.scheme = 'fec' AND ${currentTerm}`,
    ).all(asOf, asOf) as Array<{ id: string; fec: string }>;
    const rows: Array<[string, string, any]> = [];
    await pool(fec, 6, async (m) => {
      const j = await getJson(`https://api.open.fec.gov/v1/candidate/${m.fec}/totals/?sort=-cycle&per_page=3&api_key=${fkey}`);
      for (const t of j?.results ?? []) rows.push([m.id, m.fec, t]);
    });
    if (rows.length) {
      db.exec("BEGIN");
      db.prepare("DELETE FROM official_record WHERE source_id = ?").run(FEC_SRC.id);
      for (const [id, fid, t] of rows) {
        ins.run(id, "funding", `${t.cycle} election cycle: ${usd(t.receipts)} raised`,
          `Spent ${usd(t.disbursements)} · Cash on hand ${usd(t.cash_on_hand_end_period)}` + (t.coverage_end_date ? ` · Through ${String(t.coverage_end_date).slice(0, 10)}` : ""),
          t.coverage_end_date ? String(t.coverage_end_date).slice(0, 10) : null, "Federal Election Commission",
          `https://www.fec.gov/data/candidate/${fid}/?cycle=${t.cycle}`, FEC_SRC.id, asOf);
        out.funding++;
      }
      db.exec("COMMIT");
    }
  } else console.warn("FEC_API_KEY not set; skipping funding totals.");
  return out;
}
