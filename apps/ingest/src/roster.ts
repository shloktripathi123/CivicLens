import type { DB } from "@civic/db";
import { normalizeName, personId } from "@civic/domain";
import { upsertSource } from "./candidates.ts";
import { STATE_NAMES } from "./calendar.ts";

const UA = "CivicLens/0.1 (nonpartisan civic education; open source)";

export const WIKIDATA = {
  id: "wikidata", name: "Wikidata", url: "https://www.wikidata.org/", license: "CC0 1.0",
  attribution: "Wikidata contributors", authoritative: false,
};
export const WIKIPEDIA = {
  id: "wikipedia-en", name: "Wikipedia (English)", url: "https://en.wikipedia.org/", license: "CC BY-SA 4.0",
  attribution: "Wikipedia contributors", authoritative: false,
};

export interface RosterEntry {
  scheme: "wikidata" | "wikipedia"; key: string; name: string; given: string | null; family: string | null;
  birthDate: string | null; party: string | null; level: string; branch: string; body: string; title: string;
  state: string | null; start: string; officeType: string; sourceId: string; sourceUrl: string;
}

const STATE_BY_NAME = new Map(Object.entries(STATE_NAMES).map(([abbr, n]) => [n, abbr]));
const pad = (n: string) => n.padStart(2, "0");

/** Parses "List of current United States governors" wikitext. Rows that cannot be read are skipped, never guessed. */
export function parseGovernors(wikitext: string): RosterEntry[] {
  const out: RosterEntry[] = [];
  for (const row of wikitext.split(/\n\|-/)) {
    const state = /\[\[Governor of ([^|\]]+)\|/.exec(row)?.[1];
    const abbr = state ? STATE_BY_NAME.get(state) : undefined;
    const sort = /\{\{sortname\|([^|}]*)\|([^|}]*)/.exec(row);
    const link = /scope="row"\s*\|\s*\[\[([^|\]]+)/.exec(row)?.[1];
    const date = /\{\{dts\|(\d{4})\|(\d{1,2})\|(\d{1,2})/.exec(row);
    if (!abbr || !date || (!sort && !link)) continue;
    const given = sort ? sort[1].trim() : null;
    const family = sort ? sort[2].trim() : null;
    const name = sort ? `${given} ${family}` : link!.trim();
    const page = sort ? (/\{\{sortname\|[^|}]*\|[^|}]*\|([^|}=]+)\}\}/.exec(row)?.[1] ?? name) : link!;
    const party = /\n\|\s*\[\[[^\]|]*\|([^\]]+)\]\]\s*\n\|\{\{birth date/.exec(row)?.[1] ?? null;
    const birth = /\{\{birth date and age\|(\d{4})\|(\d{1,2})\|(\d{1,2})/.exec(row);
    out.push({
      scheme: "wikipedia", key: page.replace(/ /g, "_"), name, given, family,
      birthDate: birth ? `${birth[1]}-${pad(birth[2])}-${pad(birth[3])}` : null, party,
      level: "state", branch: "executive", body: `${STATE_NAMES[abbr]} executive`, title: "Governor", state: abbr,
      start: `${date[1]}-${pad(date[2])}-${pad(date[3])}`, officeType: "governor", sourceId: WIKIPEDIA.id,
      sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.replace(/ /g, "_"))}`,
    });
  }
  return out;
}

const POSITIONS: Array<[string, string, string, string]> = [
  // [exact English Wikidata label, branch, office_type, display title]
  ["Chief Justice of the United States", "judicial", "judge", "Chief Justice of the United States"],
  ["Associate Justice of the Supreme Court of the United States", "judicial", "judge", "Associate Justice of the Supreme Court"],
  ["United States Secretary of State", "executive", "cabinet", "Secretary of State"],
  ["United States Secretary of the Treasury", "executive", "cabinet", "Secretary of the Treasury"],
  ["United States Secretary of Defense", "executive", "cabinet", "Secretary of Defense"],
  ["United States Attorney General", "executive", "cabinet", "Attorney General"],
  ["United States Secretary of the Interior", "executive", "cabinet", "Secretary of the Interior"],
  ["United States Secretary of Agriculture", "executive", "cabinet", "Secretary of Agriculture"],
  ["United States Secretary of Commerce", "executive", "cabinet", "Secretary of Commerce"],
  ["United States Secretary of Labor", "executive", "cabinet", "Secretary of Labor"],
  ["United States Secretary of Health and Human Services", "executive", "cabinet", "Secretary of Health and Human Services"],
  ["United States Secretary of Housing and Urban Development", "executive", "cabinet", "Secretary of Housing and Urban Development"],
  ["United States Secretary of Transportation", "executive", "cabinet", "Secretary of Transportation"],
  ["United States Secretary of Energy", "executive", "cabinet", "Secretary of Energy"],
  ["United States Secretary of Education", "executive", "cabinet", "Secretary of Education"],
  ["United States Secretary of Veterans Affairs", "executive", "cabinet", "Secretary of Veterans Affairs"],
  ["United States Secretary of Homeland Security", "executive", "cabinet", "Secretary of Homeland Security"],
];

/**
 * Current officeholders by position label. Only name, birth date and the office term are read: no residence,
 * family or any other property is ever requested (see exclusions).
 */
export function positionsQuery(): string {
  const labels = POSITIONS.map((p) => `"${p[0]}"@en`).join(" ");
  return `SELECT ?p ?pLabel ?birth ?posLabel ?start WHERE {
    VALUES ?posLabel { ${labels} } ?pos rdfs:label ?posLabel .
    ?p p:P39 ?st . ?st ps:P39 ?pos . FILTER NOT EXISTS { ?st pq:P582 ?e }
    ?p wdt:P31 wd:Q5 ; wdt:P27 wd:Q30 . FILTER NOT EXISTS { ?p wdt:P570 ?d }
    OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?p wdt:P569 ?birth }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
}

interface Binding { [k: string]: { value: string } }

export function parsePositions(bindings: Binding[]): RosterEntry[] {
  const byLabel = new Map(POSITIONS.map((p) => [p[0], p]));
  const out: RosterEntry[] = [];
  for (const b of bindings) {
    const pos = byLabel.get(b.posLabel?.value);
    const qid = b.p?.value.split("/").pop();
    const name = b.pLabel?.value;
    if (!pos || !qid || !name || /^Q\d+$/.test(name) || !b.start) continue;
    const parts = name.split(/\s+/);
    out.push({
      scheme: "wikidata", key: qid, name, given: parts[0] ?? null, family: parts.length > 1 ? parts[parts.length - 1] : null,
      birthDate: b.birth?.value.slice(0, 10) ?? null, party: null, level: "federal", branch: pos[1],
      body: pos[0].replace(/^United States /, ""), title: pos[3], state: null, start: b.start.value.slice(0, 10),
      officeType: pos[2], sourceId: WIKIDATA.id, sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
    });
  }
  return out;
}

function findExisting(db: DB, e: RosterEntry): string | null {
  const byId = db.prepare("SELECT person_id AS id FROM person_identifier WHERE scheme = ? AND value = ?")
    .get(e.scheme, e.key) as { id: string } | undefined;
  if (byId) return byId.id;
  const norm = normalizeName(e.name);
  const rows = db.prepare("SELECT DISTINCT person_id AS id FROM person_name WHERE name_norm = ?").all(norm) as Array<{ id: string }>;
  if (e.scheme === "wikipedia" && e.state) {
    const inState = rows.filter((r) => db.prepare("SELECT 1 FROM office_term WHERE person_id = ? AND state = ?").get(r.id, e.state));
    return inState.length === 1 ? inState[0].id : null;
  }
  return rows.length === 1 ? rows[0].id : null;
}

/** Inserts or merges roster entries; an official who already has a profile keeps it and gains the new term. */
export function loadRoster(db: DB, entries: RosterEntry[], asOf: string): { created: number; merged: number } {
  let created = 0, merged = 0;
  const insTerm = db.prepare(
    `INSERT INTO office_term (person_id, level, branch, body, title, state, district, party, start_date, end_date,
       office_type, how_filled, source_id, as_of) VALUES (?,?,?,?,?,?,NULL,?,?,NULL,?,NULL,?,?)`,
  );
  const hasTerm = db.prepare("SELECT 1 FROM office_term WHERE person_id = ? AND title = ? AND (state IS ?) AND end_date IS NULL");
  for (const e of entries) {
    let id = findExisting(db, e);
    if (!id) {
      id = personId(e.scheme, e.key);
      db.prepare(
        `INSERT OR IGNORE INTO person (id, canonical_name, given, family, birth_date, gender, photo_url, status, source_id, as_of)
         VALUES (?,?,?,?,?,NULL,NULL,'current',?,?)`,
      ).run(id, e.name, e.given, e.family, e.birthDate, e.sourceId, asOf);
      db.prepare("INSERT INTO person_name (person_id,name,name_norm,kind) VALUES (?,?,?,'variant')").run(id, e.name, normalizeName(e.name));
      created++;
    } else {
      db.prepare("UPDATE person SET status = 'current' WHERE id = ? AND status = 'former'").run(id);
      merged++;
    }
    db.prepare("INSERT OR IGNORE INTO person_identifier (person_id, scheme, value) VALUES (?,?,?)").run(id, e.scheme, e.key);
    if (hasTerm.get(id, e.title, e.state)) continue;
    insTerm.run(id, e.level, e.branch, e.body, e.title, e.state, e.party, e.start, e.officeType, e.sourceId, asOf);
  }
  return { created, merged };
}

async function getJson(url: string, accept: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: accept, "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

/** Never fails the whole ingest: an unreachable source leaves the roster incomplete and says so. */
export async function ingestRoster(db: DB) {
  const asOf = new Date().toISOString().slice(0, 10);
  let entries: RosterEntry[] = [];
  try {
    const wp = (await getJson(
      "https://en.wikipedia.org/w/api.php?action=parse&page=List_of_current_United_States_governors&prop=wikitext&format=json&formatversion=2",
      "application/json",
    )) as { parse: { wikitext: string } };
    const govs = parseGovernors(wp.parse.wikitext);
    console.log(`Roster: ${govs.length} governors parsed (expected 50).`);
    entries.push(...govs);
  } catch (e) { console.warn(`Roster: governors skipped (${(e as Error).message})`); }
  try {
    const wd = (await getJson(
      `https://query.wikidata.org/sparql?query=${encodeURIComponent(positionsQuery())}`, "application/sparql-results+json",
    )) as { results: { bindings: Binding[] } };
    const people = parsePositions(wd.results.bindings);
    console.log(`Roster: ${people.length} justices and cabinet officers parsed.`);
    entries.push(...people);
  } catch (e) { console.warn(`Roster: justices and cabinet skipped (${(e as Error).message})`); }
  if (!entries.length) return;
  upsertSource(db, WIKIPEDIA);
  upsertSource(db, WIKIDATA);
  db.exec("BEGIN");
  try {
    const r = loadRoster(db, entries, asOf);
    db.exec("COMMIT");
    console.log(`Roster: ${r.created} new people, ${r.merged} merged with existing profiles.`);
  } catch (e) { db.exec("ROLLBACK"); throw e; }
}
