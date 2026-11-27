import type { DB } from "@civic/db";
import { STATES, stateByName, stateByUsps } from "@civic/domain";
import { upsertSource } from "./candidates.ts";

const URL_ = "https://www.usa.gov/election-office";
export const SRC = {
  id: "usa-gov-election-offices",
  name: "USA.gov: State election offices",
  url: URL_,
  license: "Public domain (U.S. government work)",
  attribution: "USA.gov (U.S. General Services Administration)",
  authoritative: true,
};

export interface StateLink { state: string; name: string; url: string }

const EAC_URL = "https://www.eac.gov/voters/register-and-vote-in-your-state";
const EAC_SRC = {
  id: "eac-state-voting-guides",
  name: "U.S. Election Assistance Commission: State voting information",
  url: EAC_URL,
  license: "Federal government directory links; verify rights for linked material",
  attribution: "U.S. Election Assistance Commission",
  authoritative: true,
};

export function parseVotingGuides(html: string): Array<{ state: string; url: string }> {
  const selector = html.match(/<select\b[^>]*\bname="field_state_target_id"[^>]*>([\s\S]*?)<\/select>/i);
  if (!selector) throw new Error("EAC state selector not found");
  const guides = new Map<string, string>();
  for (const match of selector[1].matchAll(/<option\b[^>]*\bvalue="(\d+)"[^>]*>\s*([^<]+?)\s*<\/option>/gi)) {
    const name = match[2].trim();
    const state = name === "Virgin Islands" ? stateByUsps("VI") : stateByName(name);
    if (!state) continue;
    if (guides.has(state.usps)) throw new Error(`Duplicate EAC state: ${state.usps}`);
    guides.set(state.usps, `${EAC_URL}?field_state_target_id=${match[1]}`);
  }
  const missing = STATES.filter((state) => !guides.has(state.usps)).map((state) => state.usps);
  if (missing.length) throw new Error(`EAC state selector missing: ${missing.join(", ")}`);
  return [...guides].map(([state, url]) => ({ state, url }));
}

export async function ingestVotingGuides(db: DB): Promise<number> {
  const res = await fetch(EAC_URL);
  if (!res.ok) throw new Error(`EAC state directory returned HTTP ${res.status}`);
  const guides = parseVotingGuides(await res.text());
  const asOf = new Date().toISOString().slice(0, 10);
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM state_voting_guide").run();
    upsertSource(db, EAC_SRC);
    const insert = db.prepare("INSERT INTO state_voting_guide (state,url,source_id,as_of) VALUES (?,?,?,?)");
    for (const guide of guides) insert.run(guide.state, guide.url, EAC_SRC.id, asOf);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return guides.length;
}

/** Parse "Name (XX)" links to each state or territory's official election office. */
export function parseElectionOffices(html: string): StateLink[] {
  const out = new Map<string, StateLink>();
  for (const m of html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>\s*([^<(]{3,50}?)\s*\(([A-Z]{2})\)\s*<\/a>/g)) {
    out.set(m[3], { state: m[3], name: m[2].trim(), url: m[1] });
  }
  return [...out.values()];
}

export async function ingestVotingInfo(db: DB): Promise<number> {
  upsertSource(db, SRC);
  try {
    const res = await fetch(URL_, { headers: { "User-Agent": "Mozilla/5.0" } });
    const links = parseElectionOffices(await res.text());
    if (links.length < 50) { console.warn(`Election offices: parsed ${links.length}, expected ~58; skipping.`); return 0; }
    const asOf = new Date().toISOString().slice(0, 10);
    const ins = db.prepare("INSERT OR REPLACE INTO state_voting (state,name,official_url,source_id,as_of) VALUES (?,?,?,?,?)");
    for (const l of links) ins.run(l.state, l.name, l.url, SRC.id, asOf);
    return links.length;
  } catch (e) {
    console.warn("Election offices fetch failed:", (e as Error).message);
    return 0;
  }
}
