import type { DB } from "@civic/db";
import { normalizeName, personId } from "@civic/domain";
import { upsertSource } from "./candidates.ts";

const BASE = "https://api.oregonlegislature.gov/odata/odataservice.svc";
const SRC = {
  id: "oregon-legislature-odata", name: "Oregon Legislature OLIS (OData service)", url: "https://olis.oregonlegislature.gov/liz/",
  license: "Public record", attribution: "Oregon State Legislature", authoritative: true,
};
// Current assembly: the 83rd Legislative Assembly convened Jan 13, 2025.
const ASSEMBLY_START = "2025-01-13";

export interface OLegislator {
  SessionKey: string; LegislatorCode: string; FirstName: string; LastName: string; CapitolAddress: string | null;
  CapitolPhone: string | null; Title: string; Chamber: string; Party: string | null; DistrictNumber: string | null;
  EmailAddress: string | null; WebSiteUrl: string | null;
}

/** Keeps each legislator's row from the most recent session in the feed. */
export function latestPerLegislator(rows: OLegislator[], current: string[]): OLegislator[] {
  const best = new Map<string, OLegislator>();
  for (const r of rows) {
    if (!current.includes(r.SessionKey)) continue;
    const prev = best.get(r.LegislatorCode);
    if (!prev || current.indexOf(r.SessionKey) < current.indexOf(prev.SessionKey)) best.set(r.LegislatorCode, r);
  }
  return [...best.values()];
}

export async function ingestOregonLegislators(db: DB, sessions = ["2026R1", "2025R1"]): Promise<number> {
  upsertSource(db, SRC);
  const rows: OLegislator[] = [];
  try {
    for (const s of sessions) {
      const url = BASE + "/Legislators?$format=json&$filter=" + encodeURIComponent("SessionKey eq '" + s + "'");
      const res = await fetch(url);
      if (!res.ok) throw new Error("Legislators " + s + ": HTTP " + res.status);
      rows.push(...((await res.json()) as { value: OLegislator[] }).value);
    }
  } catch (e) {
    console.warn("Oregon legislators fetch failed:", (e as Error).message);
    return 0;
  }
  const list = latestPerLegislator(rows, sessions);
  if (list.length < 60) { console.warn("Oregon legislators: only " + list.length + " rows, skipping."); return 0; }

  const asOf = new Date().toISOString().slice(0, 10);
  const insP = db.prepare("INSERT OR REPLACE INTO person (id,canonical_name,given,family,birth_date,gender,photo_url,status,source_id,as_of) VALUES (?,?,?,?,NULL,NULL,NULL,'current',?,?)");
  const insI = db.prepare("INSERT OR IGNORE INTO person_identifier (person_id,scheme,value) VALUES (?,?,?)");
  const insN = db.prepare("INSERT INTO person_name (person_id,name,name_norm,kind) VALUES (?,?,?,?)");
  const insT = db.prepare("INSERT INTO office_term (person_id,level,branch,body,title,state,district,party,start_date,end_date,website,phone,address,contact_form,office_type,how_filled,source_id,as_of) VALUES (?,'state','legislative',?,?,'OR',?,?,?,NULL,?,?,?,?,'state_legislator',NULL,?,?)");
  const insC = db.prepare("INSERT OR REPLACE INTO coverage (person_id,section,status) VALUES (?,?,?)");

  db.exec("BEGIN");
  try {
    // Remove people created by an earlier run (never ones that existed before, e.g. candidates).
    const stale = db.prepare("SELECT DISTINCT pi.person_id AS id FROM person_identifier pi JOIN person p ON p.id = pi.person_id WHERE pi.scheme = 'oregon-legislator' AND p.source_id = ?").all(SRC.id) as { id: string }[];
    for (const { id } of stale) {
      for (const t of ["office_term", "person_name", "person_identifier", "coverage", "official_record", "person"]) {
        db.prepare("DELETE FROM " + t + (t === "person" ? " WHERE id = ?" : " WHERE person_id = ?")).run(id);
      }
    }
    db.prepare("DELETE FROM office_term WHERE source_id = ?").run(SRC.id);
    const byName = new Map<string, OLegislator[]>();
    for (const l of list) {
      const k = normalizeName(l.FirstName + " " + l.LastName);
      byName.set(k, [...(byName.get(k) ?? []), l]);
    }
    for (const [norm, group] of byName) {
      const l = group[0]!;
      // Same person already known (e.g. a 2026 candidate): attach to them instead of duplicating.
      const existing = db.prepare("SELECT pn.person_id AS id FROM person_name pn JOIN person_identifier pi ON pi.person_id = pn.person_id AND pi.scheme = 'oregon-sos' WHERE pn.name_norm = ? LIMIT 1").get(norm) as { id: string } | undefined;
      const id = existing?.id ?? personId("oregon-legislator", l.LegislatorCode);
      const senate = l.Chamber === "S";
      const name = (l.FirstName + " " + l.LastName).trim();
      if (!existing) {
        insP.run(id, name, l.FirstName, l.LastName, SRC.id, asOf);
        const rev = l.LastName + ", " + l.FirstName;
        insN.run(id, name, norm, "legal");
        insN.run(id, rev, normalizeName(rev), "variant");
        for (const s of ["identity", "terms", "contact"]) insC.run(id, s, "complete");
      }
      for (const g of group) insI.run(id, "oregon-legislator", g.LegislatorCode);
      insT.run(id, senate ? "Oregon State Senate" : "Oregon House of Representatives", senate ? "State Senator" : "State Representative",
        l.DistrictNumber, l.Party, ASSEMBLY_START, l.WebSiteUrl, l.CapitolPhone, l.CapitolAddress,
        l.EmailAddress ? "mailto:" + l.EmailAddress : null, SRC.id, asOf);
    }
    // Link legislator-authored bills already ingested (sponsor name is the OLIS LegislatorCode).
    db.prepare("DELETE FROM official_record WHERE source_id = ? AND section = 'bills'").run(SRC.id);
    db.prepare(
      "INSERT INTO official_record (person_id,section,title,detail,date,publisher,url,source_id,as_of) " +
      "SELECT pi.person_id, 'bills', b.number || ': ' || b.title, " +
      "CASE WHEN s.role = 'Chief' THEN 'Chief sponsor' ELSE 'Sponsor' END || ' · ' || b.session || ' · ' || b.status || CASE WHEN b.is_law = 1 THEN ' (became law)' ELSE '' END, " +
      "b.introduced_on, 'Oregon Legislature', b.url, ?, ? " +
      "FROM bill_sponsor s JOIN bill b ON b.id = s.bill_id " +
      "JOIN person_identifier pi ON pi.scheme = 'oregon-legislator' AND pi.value = s.name",
    ).run(SRC.id, asOf);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return byNameCount(list);
}

function byNameCount(list: OLegislator[]): number {
  return new Set(list.map((l) => normalizeName(l.FirstName + " " + l.LastName))).size;
}
