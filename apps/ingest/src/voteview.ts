import type { DB } from "@civic/db";
import { upsertSource } from "./candidates.ts";

const BASE = "https://voteview.com/static/data/out";
export const CONGRESS = 119;
export const SRC = {
  id: "voteview",
  name: "Voteview (UCLA): roll-call votes and DW-NOMINATE",
  url: "https://voteview.com/",
  license: "Public download; reuse terms not specified by provider",
  attribution: "Lewis, Poole, Rosenthal, Boche, Rudkin, Sonnet. Voteview: Congressional Roll-Call Votes Database",
  authoritative: false,
};

/** Minimal RFC 4180 parser (quoted fields, embedded commas and newlines). */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f.replace(/\r$/, "")); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift() ?? [];
  return rows.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

export const CAST: Record<string, string> = {
  "1": "Yea", "2": "Yea", "3": "Yea", "4": "Nay", "5": "Nay", "6": "Nay", "7": "Present", "8": "Present", "9": "Did not vote",
};

const get = async (p: string) => {
  const r = await fetch(`${BASE}/${p}`);
  if (!r.ok) throw new Error(`${p}: ${r.status}`);
  return r.text();
};

export async function ingestVoteview(db: DB): Promise<{ votes: number; scores: number }> {
  upsertSource(db, SRC);
  try {
    const [membersCsv, rollsCsv, votesCsv] = await Promise.all([
      get(`members/HS${CONGRESS}_members.csv`), get(`rollcalls/HS${CONGRESS}_rollcalls.csv`), get(`votes/HS${CONGRESS}_votes.csv`),
    ]);
    const members = parseCsv(membersCsv);
    const rolls = parseCsv(rollsCsv);
    if (members.length < 400 || rolls.length < 100) { console.warn("Voteview: unexpected file size, skipping."); return { votes: 0, scores: 0 }; }

    const idMap = new Map<string, string>();
    for (const r of db.prepare("SELECT value, person_id FROM person_identifier WHERE scheme = 'icpsr'").all() as Array<{ value: string; person_id: string }>) idMap.set(r.value, r.person_id);

    const asOf = new Date().toISOString().slice(0, 10);
    const roll = new Map(rolls.map((r) => [`${r.chamber}|${r.rollnumber}`, r]));
    const ins = db.prepare("INSERT INTO official_record (person_id,section,title,detail,date,publisher,url,source_id,as_of) VALUES (?,?,?,?,?,?,?,?,?)");

    db.exec("BEGIN");
    db.prepare("DELETE FROM official_record WHERE source_id = ?").run(SRC.id);
    let scores = 0;
    for (const m of members) {
      const pid = idMap.get(m.icpsr);
      if (!pid || m.nominate_dim1 === "") continue;
      ins.run(pid, "ratings", `DW-NOMINATE ideology score, ${CONGRESS}th Congress: ${m.nominate_dim1}`,
        `Scholarly measure of voting behaviour on a scale from -1 (most liberal) to +1 (most conservative), computed from roll-call votes. Second dimension: ${m.nominate_dim2}. A descriptive statistic, not an advocacy rating.`,
        `${2023 + (CONGRESS - 118) * 2}-01-03`, "Voteview (UCLA)", `https://voteview.com/person/${m.icpsr}`, SRC.id, asOf);
      scores++;
    }
    let votes = 0;
    const lines = votesCsv.split("\n");
    for (let i = 1; i < lines.length; i++) {
      const [, chamber, rn, icpsr, cast] = lines[i].split(",");
      const pid = idMap.get(icpsr);
      const r = roll.get(`${chamber}|${rn}`);
      const label = CAST[cast];
      if (!pid || !r || !label || cast === "9" || cast === "0") continue;
      const bill = r.bill_number ? `${r.bill_number}: ` : "";
      const q = r.vote_question || "Roll call";
      ins.run(pid, "votes", `${label} on ${bill}${(r.vote_desc || q).slice(0, 160)}`,
        `${chamber} roll call ${rn} · ${q}${r.vote_result ? ` · Result: ${r.vote_result}` : ""} · Yea ${r.yea_count}, Nay ${r.nay_count}`,
        r.date, "Voteview (UCLA)", `https://voteview.com/rollcall/RH${String(CONGRESS).padStart(3, "0")}${String(rn).padStart(4, "0")}`.replace("RH", chamber === "Senate" ? "RS" : "RH"), SRC.id, asOf);
      votes++;
    }
    db.exec("COMMIT");
    return { votes, scores };
  } catch (e) {
    try { db.exec("ROLLBACK"); } catch { /* no open transaction */ }
    console.warn("Voteview fetch failed:", (e as Error).message);
    return { votes: 0, scores: 0 };
  }
}
