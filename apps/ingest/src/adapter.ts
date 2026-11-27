import { openDb, photoFor, type DB } from "@civic/db";
import { normalizeName, personId } from "@civic/domain";

const BASE = "https://unitedstates.github.io/congress-legislators";
const SRC = {
  id: "congress-legislators",
  name: "unitedstates/congress-legislators",
  url: "https://github.com/unitedstates/congress-legislators",
  license: "CC0-1.0 (public domain)",
  attribution: "The @unitedstates project",
};

interface Term {
  type: "rep" | "sen"; start: string; end: string; state: string; district?: number;
  party?: string; url?: string; phone?: string; address?: string; contact_form?: string;
}
interface Legislator {
  id: Record<string, string | number | string[]>;
  name: { first: string; middle?: string; last: string; suffix?: string; nickname?: string; official_full?: string };
  bio: { birthday?: string; gender?: string };
  terms: Term[];
  leadership_roles?: Array<{ title: string; chamber: string; start: string; end?: string }>;
}
interface Membership { name: string; rank: number; title?: string; party: string; bioguide: string }
interface CommitteeJson {
  type: string; name: string; url?: string; thomas_id: string;
  subcommittees?: Array<{ name: string; thomas_id: string }>;
}
interface Social { id: { bioguide: string }; social: Record<string, string> }

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`Fetch ${file} failed: ${res.status}`);
  return (await res.json()) as T;
}

function tx(db: DB, fn: () => void) {
  db.exec("BEGIN");
  try { fn(); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
}

const SOCIAL_URL: Record<string, (h: string) => string> = {
  twitter: (h) => `https://twitter.com/${h}`,
  facebook: (h) => `https://www.facebook.com/${h}`,
  instagram: (h) => `https://www.instagram.com/${h}`,
  youtube: (h) => `https://www.youtube.com/${h}`,
};

export function nameVariants(n: Legislator["name"]): Array<{ name: string; kind: string }> {
  const full = n.official_full ?? `${n.first} ${n.last}`;
  const map = new Map<string, { name: string; kind: string }>();
  const put = (s: string | undefined, kind: string) => {
    if (!s?.trim()) return;
    const norm = normalizeName(s);
    if (norm && !map.has(norm)) map.set(norm, { name: s, kind });
  };
  put(full, "legal");
  put(`${n.first} ${n.last}`, "variant");
  if (n.middle) put(`${n.first} ${n.middle} ${n.last}`, "variant");
  if (n.nickname) put(`${n.nickname} ${n.last}`, "nickname");
  put(`${n.last}, ${n.first}`, "variant");
  return [...map.values()];
}

function loadLegislators(db: DB, list: Legislator[], status: "current" | "former", asOf: string) {
  const insPerson = db.prepare(
    `INSERT OR REPLACE INTO person (id, canonical_name, given, family, birth_date, gender, photo_url, status, source_id, as_of)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  );
  const insIdent = db.prepare("INSERT OR IGNORE INTO person_identifier (person_id, scheme, value) VALUES (?,?,?)");
  const insName = db.prepare("INSERT INTO person_name (person_id, name, name_norm, kind) VALUES (?,?,?,?)");
  const insTerm = db.prepare(
    `INSERT INTO office_term (person_id, level, branch, body, title, state, district, party, start_date, end_date,
       leadership_role, website, phone, address, contact_form, source_id, as_of)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );

  for (const l of list) {
    const bio = String(l.id.bioguide);
    const id = personId("bioguide", bio);
    const canonical = l.name.official_full ?? `${l.name.first} ${l.name.last}`;
    insPerson.run(id, canonical, l.name.first, l.name.last, l.bio.birthday ?? null, l.bio.gender ?? null, photoFor(bio), status, SRC.id, asOf);

    for (const [scheme, v] of Object.entries(l.id)) {
      for (const val of Array.isArray(v) ? v : [v]) insIdent.run(id, scheme, String(val));
    }
    for (const v of nameVariants(l.name)) insName.run(id, v.name, normalizeName(v.name), v.kind);

    const openRoles = (l.leadership_roles ?? []).filter((r) => !r.end).map((r) => r.title);
    const lastIdx = l.terms.length - 1;
    l.terms.forEach((t, i) => {
      const senate = t.type === "sen";
      const district = senate ? null : t.district === 0 ? "At-large" : String(t.district ?? "");
      insTerm.run(
        id, "federal", "legislative", senate ? "U.S. Senate" : "U.S. House", senate ? "Senator" : "Representative",
        t.state, district, t.party ?? null, t.start, t.end >= t.start ? t.end : null,
        status === "current" && i === lastIdx && openRoles.length ? [...new Set(openRoles)].join("; ") : null,
        t.url ?? null, t.phone ?? null, t.address ?? null, t.contact_form ?? null, SRC.id, asOf,
      );
    });
  }
}

export async function ingest(db: DB = openDb()) {
  const asOf = new Date().toISOString().slice(0, 10);
  const [current, historical, committees, membership, social] = await Promise.all([
    getJson<Legislator[]>("legislators-current.json"),
    getJson<Legislator[]>("legislators-historical.json"),
    getJson<CommitteeJson[]>("committees-current.json"),
    getJson<Record<string, Membership[]>>("committee-membership-current.json"),
    getJson<Social[]>("legislators-social-media.json"),
  ]);

  tx(db, () => {
    for (const t of ["official_record", "voting_window", "state_voting", "gov_area", "gov_holder", "gov_meeting", "gov_office", "gov_unit", "bill_action", "bill_sponsor", "bill", "county_geography", "county_population", "place_overlap", "place", "result", "finance_summary", "agenda_item", "candidacy", "race", "election", "office", "education", "career_item", "coverage", "social", "committee_membership", "committee", "office_term", "person_name", "person_identifier", "person", "source"])
      db.exec(`DELETE FROM ${t}`);
    db.prepare("INSERT INTO source (id,name,url,license,attribution,retrieved_at) VALUES (?,?,?,?,?,?)").run(
      SRC.id, SRC.name, SRC.url, SRC.license, SRC.attribution, new Date().toISOString(),
    );

    loadLegislators(db, current, "current", asOf);
    loadLegislators(db, historical, "former", asOf);

    const insC = db.prepare("INSERT OR REPLACE INTO committee (id,parent_id,name,chamber,url,source_id,as_of) VALUES (?,?,?,?,?,?,?)");
    for (const c of committees) {
      insC.run(c.thomas_id, null, c.name, c.type, c.url ?? null, SRC.id, asOf);
      for (const s of c.subcommittees ?? []) insC.run(c.thomas_id + s.thomas_id, c.thomas_id, s.name, c.type, null, SRC.id, asOf);
    }

    const insM = db.prepare("INSERT INTO committee_membership (person_id,committee_id,role,rank,source_id,as_of) VALUES (?,?,?,?,?,?)");
    const knownCommittee = db.prepare("SELECT 1 FROM committee WHERE id = ?");
    const knownPerson = db.prepare("SELECT 1 FROM person WHERE id = ?");
    for (const [cid, members] of Object.entries(membership)) {
      if (!knownCommittee.get(cid)) continue;
      for (const m of members) {
        const pid = personId("bioguide", m.bioguide);
        if (!knownPerson.get(pid)) continue;
        insM.run(pid, cid, m.title ?? "Member", m.rank ?? null, SRC.id, asOf);
      }
    }

    const insS = db.prepare("INSERT INTO social (person_id,platform,handle,url,source_id,as_of) VALUES (?,?,?,?,?,?)");
    for (const s of social) {
      const pid = personId("bioguide", s.id.bioguide);
      if (!knownPerson.get(pid)) continue;
      for (const [platform, handle] of Object.entries(s.social)) {
        const build = SOCIAL_URL[platform];
        if (build && handle) insS.run(pid, platform, handle, build(handle), SRC.id, asOf);
      }
    }

    // Coverage reflects exactly what this adapter provides; bills/votes/funding arrive in later phases.
    const insCov = db.prepare("INSERT INTO coverage (person_id, section, status) VALUES (?,?,?)");
    const people = db.prepare("SELECT id, status, birth_date FROM person").all() as Array<{ id: string; status: string; birth_date: string | null }>;
    const hasCm = db.prepare("SELECT 1 FROM committee_membership WHERE person_id = ?");
    const hasWeb = db.prepare("SELECT 1 FROM office_term WHERE person_id = ? AND website IS NOT NULL");
    for (const p of people) {
      insCov.run(p.id, "identity", "complete");
      insCov.run(p.id, "terms", "complete");
      insCov.run(p.id, "committees", hasCm.get(p.id) ? "complete" : p.status === "current" ? "partial" : "unavailable");
      insCov.run(p.id, "contact", p.status === "current" && hasWeb.get(p.id) ? "complete" : "unavailable");
      insCov.run(p.id, "background", p.birth_date ? "partial" : "unavailable");
      for (const s of ["bills", "votes", "funding", "affiliations", "ratings"]) insCov.run(p.id, s, "unavailable");
    }
  });

  const count = (db.prepare("SELECT COUNT(*) AS n FROM person").get() as { n: number }).n;
  console.log(`Ingested ${count} people (${current.length} current, ${historical.length} former).`);
}
