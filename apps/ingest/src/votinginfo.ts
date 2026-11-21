import type { DB } from "@civic/db";
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
