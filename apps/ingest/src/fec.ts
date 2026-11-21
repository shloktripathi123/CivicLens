import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { openDb, type DB } from "@civic/db";
import { addCandidacy, candidateCoverage, upsertSource, type CandidateDef } from "./candidates.ts";
import { electionDay, nextFederalCycle } from "./calendar.ts";

const API = "https://api.open.fec.gov/v1";
const SRC = {
  id: "fec-openfec",
  name: "Federal Election Commission (OpenFEC)",
  url: "https://api.open.fec.gov/developers/",
  license: "Public record",
  attribution: "Federal Election Commission",
  authoritative: true,
};
const CYCLE = Number(process.env.ELECTION_CYCLE ?? nextFederalCycle(new Date().toISOString().slice(0, 10)));
if (!Number.isInteger(CYCLE) || CYCLE < 1788 || CYCLE % 2 !== 0) {
  throw new Error("ELECTION_CYCLE must be an even federal election year.");
}

export interface FecCandidate {
  candidate_id: string; name: string; party_full?: string | null; office: "H" | "S" | "P";
  state?: string; district?: string; incumbent_challenge?: string | null; first_file_date?: string | null;
}
interface FecTotals {
  candidate_id: string; receipts?: number | null; disbursements?: number | null; cash_on_hand_end_period?: number | null;
}

/** "SMITH, JOHN Q. JR." -> { name: "John Q. Smith Jr.", given: "John", family: "Smith" } */
export function parseFecName(raw: string): { name: string; given: string | null; family: string | null } {
  const title = (w: string) =>
    w.toLowerCase().replace(/(^|[-'])([a-z])/g, (_, a, b) => a + b.toUpperCase()).replace(/^Mc([a-z])/, (_, c) => "Mc" + c.toUpperCase());
  const [last, rest = ""] = raw.split(/,\s*(.*)/s);
  const parts = rest.split(/\s+/).filter(Boolean);
  const suffixRe = /^(JR|SR|II|III|IV)\.?$/i;
  const suffix = parts.filter((p) => suffixRe.test(p)).map(title);
  const given = parts.filter((p) => !suffixRe.test(p) && !/^(MR|MRS|MS|DR|HON)\.?$/i.test(p));
  const family = last.trim().split(/\s+/).map(title).join(" ");
  const first = given[0] ? title(given[0]) : null;
  const name = [...given.map(title), family, ...suffix].join(" ").trim();
  return { name, given: first, family };
}

const FEC_CACHE = resolve(process.env.CACHE_DIR ?? resolve(import.meta.dirname, "../../../data/cache"), "fec");
const FEC_TTL_MS = 24 * 3600 * 1000;

type FecPage<T> = { results: T[]; pagination: { pages: number } };

/** Pages are cached on disk so repeated ingests do not exhaust the API rate limit; a stale copy is used if the API refuses. */
async function fetchPage<T>(path: string, params: Record<string, string>, key: string, page: number): Promise<FecPage<T> | null> {
  const id = createHash("sha1").update(`${path}|${JSON.stringify(params)}|${page}`).digest("hex");
  const file = resolve(FEC_CACHE, `${id}.json`);
  const cached = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as FecPage<T>) : null;
  if (cached && Date.now() - statSync(file).mtimeMs < FEC_TTL_MS) return cached;
  const q = new URLSearchParams({ ...params, api_key: key, per_page: "100", page: String(page) });
  const res = await fetch(`${API}${path}?${q}`);
  if (res.status === 429) {
    console.warn(cached ? "FEC rate limit reached; using cached page." : "FEC rate limit reached; stopping early.");
    return cached;
  }
  if (!res.ok) throw new Error(`FEC ${path} failed: ${res.status}`);
  const data = (await res.json()) as FecPage<T>;
  mkdirSync(FEC_CACHE, { recursive: true });
  writeFileSync(file, JSON.stringify(data));
  return data;
}

async function pages<T>(path: string, params: Record<string, string>, key: string, maxPages: number): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await fetchPage<T>(path, params, key, page);
    if (!data) break;
    out.push(...data.results);
    if (page >= data.pagination.pages) break;
  }
  return out;
}

export async function ingestFec(db: DB = openDb()) {
  const key = process.env.FEC_API_KEY;
  const usingDemo = !key;
  const apiKey = key || "DEMO_KEY";
  const maxPages = Number(process.env.FEC_MAX_PAGES ?? (usingDemo ? 3 : 200));
  if (usingDemo) console.warn(`FEC_API_KEY not set: using DEMO_KEY (rate limited), capped at ${maxPages} pages. Federal candidate coverage will be partial.`);

  const asOf = new Date().toISOString().slice(0, 10);
  let list: FecCandidate[];
  let totals: FecTotals[] = [];
  try {
    list = await pages<FecCandidate>("/candidates/", { election_year: String(CYCLE), is_active_candidate: "true" }, apiKey, maxPages);
    totals = await pages<FecTotals>("/candidates/totals/", { cycle: String(CYCLE), election_full: "true" }, apiKey, maxPages);
  } catch (e) {
    console.warn(`FEC ingest skipped: ${(e as Error).message}`);
    return;
  }

  upsertSource(db, SRC);
  const electionDate = electionDay(CYCLE);
  const totalsById = new Map(totals.map((t) => [t.candidate_id, t]));
  const scheduledRace = db.prepare(
    "SELECT r.id FROM race r JOIN office o ON o.id = r.office_id JOIN election e ON e.id = r.election_id " +
    "WHERE o.level = 'federal' AND o.body = ? AND o.jurisdiction = ? AND o.district IS ? AND e.date = ? AND e.type = 'general'",
  );
  let created = 0, merged = 0, unmatched = 0;

  db.exec("BEGIN");
  try {
    for (const f of list) {
      const { name, given, family } = parseFecName(f.name);
      const state = f.office === "P" ? null : f.state ?? null;
      const district = f.office === "H" ? (f.district && f.district !== "00" ? String(Number(f.district)) : "At-large") : null;
      const body = f.office === "S" ? "U.S. Senate" : f.office === "H" ? "U.S. House" : "President";
      const race = scheduledRace.get(body, state ?? "US", district, electionDate) as { id: string } | undefined;
      if (!race) { unmatched++; continue; }
      const raceId = race.id;
      const def: CandidateDef = {
        externalScheme: "fec", externalId: f.candidate_id, name, given, family,
        party: f.party_full ?? null, status: "filed", incumbent: f.incumbent_challenge === "I",
        filedOn: f.first_file_date ?? null, website: null,
      };
      const r = addCandidacy(db, def, raceId, state, SRC.id, asOf);
      r.created ? created++ : merged++;
      const t = totalsById.get(f.candidate_id);
      if (t) {
        db.prepare("INSERT OR REPLACE INTO finance_summary (candidacy_id,cycle,receipts,disbursements,cash_on_hand,source_id,as_of) VALUES (?,?,?,?,?,?,?)")
          .run(r.candidacyId, CYCLE, t.receipts ?? null, t.disbursements ?? null, t.cash_on_hand_end_period ?? null, SRC.id, asOf);
      }
    }
    candidateCoverage(db);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  console.log(`FEC ${CYCLE}: ${list.length} candidates (${created} new people, ${merged} matched existing).`);
  if (unmatched) console.warn(`FEC: ${unmatched} filings omitted because no matching scheduled federal race was found.`);
}
