import { openDb, type DB } from "@civic/db";
import { addCandidacy, candidateCoverage, upsertRace, upsertSource, type CandidateDef } from "./candidates.ts";

/**
 * Oregon Secretary of State candidate filings (ORESTAR) have no export we could verify, so the
 * Oregon 2026 governor race is a hand-curated seed. Every row cites the SOS elections site; replace
 * with a fetched export once its format is confirmed (task T078).
 */
const SRC = {
  id: "oregon-sos-curated",
  name: "Oregon Secretary of State - Elections (curated seed)",
  url: "https://sos.oregon.gov/elections/Pages/default.aspx",
  license: "Public record",
  attribution: "Oregon Secretary of State",
  authoritative: true,
};

const GOVERNOR = { level: "state", body: "Oregon Executive", jurisdiction: "OR", title: "Governor of Oregon", district: null };

const CANDIDATES: Array<CandidateDef & { officeTerm?: { start: string } }> = [
  {
    externalScheme: "oregon-sos", externalId: "kotek-tina", name: "Tina Kotek", given: "Tina", family: "Kotek",
    party: "Democratic", status: "filed", incumbent: true, filedOn: null, website: null, officeTerm: { start: "2023-01-09" },
  },
  {
    externalScheme: "oregon-sos", externalId: "drazan-christine", name: "Christine Drazan", given: "Christine", family: "Drazan",
    party: "Republican", status: "filed", incumbent: false, filedOn: null, website: null,
  },
];

const WIKI = {
  id: "wikipedia-en", name: "Wikipedia (English)", url: "https://en.wikipedia.org/",
  license: "CC BY-SA 4.0", attribution: "Wikipedia contributors", authoritative: false,
};
const GOV = {
  id: "oregon-gov", name: "State of Oregon official websites (oregon.gov, oregonlegislature.gov)", url: "https://www.oregon.gov/",
  license: "Public record", attribution: "State of Oregon", authoritative: true,
};

interface Extras {
  education: Array<[string, string | null, number | null]>;
  career: Array<[string, string | null, string | null, string | null]>;
  committees: Array<{ id: string; name: string; chamber: string }>;
  links: Array<{ platform: string; handle: string; url: string; src: "wikipedia-en" | "oregon-gov" }>;
}
const EXTRAS: Record<string, Extras> = {
  "kotek-tina": {
    education: [["University of Oregon", "BS, religious studies", 1990], ["University of Washington", "MA", null], ["Georgetown University", "attended", null]],
    career: [
      ["Public policy advocate", "Oregon Food Bank", null, null],
      ["Policy director", "Children First for Oregon", null, null],
      ["Member, Oregon House of Representatives (District 44)", "Oregon Legislature", "2007", "2022"],
      ["Speaker of the Oregon House of Representatives", "Oregon Legislature", "2013", "2022"],
      ["Governor of Oregon", "State of Oregon", "2023", null],
    ],
    committees: [],
    links: [
      { platform: "Official website", handle: "oregon.gov/gov", url: "https://www.oregon.gov/gov/", src: "oregon-gov" },
      { platform: "Wikipedia", handle: "Tina Kotek", url: "https://en.wikipedia.org/wiki/Tina_Kotek", src: "wikipedia-en" },
    ],
  },
  "drazan-christine": {
    education: [["George Fox University", "BA", null]],
    career: [
      ["Director of communications for the Speaker of the Oregon House (1990s)", "Oregon Legislature", null, null],
      ["Member, Oregon House of Representatives (District 39)", "Oregon Legislature", "2019", "2022"],
      ["House Republican Leader", "Oregon Legislature", "2019", "2021"],
      ["2022 Republican nominee for Governor of Oregon", "Republican Party of Oregon", "2022", "2022"],
      ["Member, Oregon House of Representatives (District 51)", "Oregon Legislature", "2025", "2025"],
      ["Member, Oregon State Senate (District 26)", "Oregon Legislature", "2025", null],
    ],
    committees: [{ id: "or-house-health", name: "Oregon House Committee on Health Care (during 2019 House tenure)", chamber: "state-house" }],
    links: [
      { platform: "Legislative page", handle: "oregonlegislature.gov/drazan", url: "https://www.oregonlegislature.gov/drazan", src: "oregon-gov" },
      { platform: "Wikipedia", handle: "Christine Drazan", url: "https://en.wikipedia.org/wiki/Christine_Drazan", src: "wikipedia-en" },
    ],
  },
};

export function ingestOregon(db: DB = openDb()) {
  const asOf = new Date().toISOString().slice(0, 10);
  upsertSource(db, SRC);
  upsertSource(db, WIKI);
  upsertSource(db, GOV);
  const raceId = upsertRace(db, { office: GOVERNOR, electionDate: "2026-11-03", electionType: "general" }, SRC.id, asOf);
  for (const c of CANDIDATES) {
    const { personId: pid } = addCandidacy(db, c, raceId, "OR", SRC.id, asOf);
    if (c.officeTerm) {
      db.prepare("UPDATE person SET status = 'current' WHERE id = ?").run(pid);
      db.prepare("DELETE FROM office_term WHERE person_id = ? AND source_id = ?").run(pid, SRC.id);
      db.prepare(
        `INSERT INTO office_term (person_id, level, branch, body, title, state, district, party, start_date, end_date, source_id, as_of)
         VALUES (?,?,?,?,?,?,?,?,?,NULL,?,?)`,
      ).run(pid, "state", "executive", GOVERNOR.body, "Governor", "OR", null, c.party, c.officeTerm.start, SRC.id, asOf);
    }
  }
  for (const c of CANDIDATES) {
    const x = EXTRAS[c.externalId];
    const pid = (db.prepare("SELECT person_id AS id FROM person_identifier WHERE scheme=? AND value=?").get(c.externalScheme, c.externalId) as { id: string }).id;
    for (const t of ["education", "career_item", "social", "committee_membership"]) db.prepare(`DELETE FROM ${t} WHERE person_id = ? AND source_id IN ('wikipedia-en','oregon-gov')`).run(pid);
    for (const [inst, deg, yr] of x.education) db.prepare("INSERT INTO education (person_id,institution,degree,year,source_id,as_of) VALUES (?,?,?,?,?,?)").run(pid, inst, deg, yr, WIKI.id, asOf);
    for (const [title, org, st, en] of x.career) db.prepare("INSERT INTO career_item (person_id,title,org,start,end,source_id,as_of) VALUES (?,?,?,?,?,?,?)").run(pid, title, org, st, en, WIKI.id, asOf);
    for (const l of x.links) db.prepare("INSERT INTO social (person_id,platform,handle,url,source_id,as_of) VALUES (?,?,?,?,?,?)").run(pid, l.platform, l.handle, l.url, l.src, asOf);
    for (const m of x.committees) {
      db.prepare("INSERT OR REPLACE INTO committee (id,parent_id,name,chamber,url,source_id,as_of) VALUES (?,NULL,?,?,NULL,?,?)").run(m.id, m.name, m.chamber, WIKI.id, asOf);
      db.prepare("INSERT INTO committee_membership (person_id,committee_id,role,rank,source_id,as_of) VALUES (?,?,'Member',NULL,?,?)").run(pid, m.id, WIKI.id, asOf);
    }
  }
  candidateCoverage(db);
  console.log(`Oregon governor race seeded (${CANDIDATES.length} candidates).`);
}
