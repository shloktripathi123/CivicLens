import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DB } from "@civic/db";
import { displayName, normalizePlaceName, placeId, STATES, stateByFips, stateByUsps } from "@civic/domain";
import { upsertSource } from "./candidates.ts";
import { parseCsv } from "./csv.ts";

const GAZ = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer";
const REL = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520";
const CACHE = resolve(process.env.CACHE_DIR ?? resolve(import.meta.dirname, "../../../data/cache/census"));

const SRC = {
  id: "census-geography",
  name: "U.S. Census Bureau Gazetteer and ZCTA relationship files",
  url: "https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html",
  license: "Public domain (U.S. government work)",
  attribution: "U.S. Census Bureau",
  authoritative: true,
};
const POPULATION_URL = "https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv";
const SRC_POPULATION = {
  id: "census-county-population",
  name: "U.S. Census Bureau 2024 county population estimates",
  url: POPULATION_URL,
  license: "Public domain (U.S. government work)",
  attribution: "U.S. Census Bureau",
  authoritative: true,
};

type Row = Record<string, string>;

/** Parse a delimited Census file (tab for Gazetteer, pipe for relationship files) into header-keyed rows. */
export function parseCensus(text: string, delimiter: "\t" | "|"): Row[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0].split(delimiter).map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cols = l.split(delimiter);
    const row: Row = {};
    header.forEach((h, i) => { row[h] = (cols[i] ?? "").trim(); });
    return row;
  });
}

export interface PlaceDef {
  id: string; type: "state" | "county" | "city" | "zip"; name: string; label: string; state: string; fips: string;
  lat: number | null; lon: number | null; parentId: string | null; approximate: boolean;
}
export interface OverlapDef { placeId: string; otherId: string; relation: string; share: number }

const num = (s: string) => (s === "" || Number.isNaN(Number(s)) ? null : Number(s));

export function countyDefs(rows: Row[]): PlaceDef[] {
  return rows.filter((r) => r.GEOID && stateByUsps(r.USPS)).map((r) => ({
    id: placeId("county", r.GEOID), type: "county" as const, name: displayName(r.NAME), label: r.NAME,
    state: r.USPS, fips: r.GEOID, lat: num(r.INTPTLAT), lon: num(r.INTPTLONG),
    parentId: placeId("state", r.USPS), approximate: false,
  }));
}

export function cityDefs(rows: Row[]): PlaceDef[] {
  return rows.filter((r) => r.GEOID && stateByUsps(r.USPS)).map((r) => ({
    id: placeId("city", r.GEOID), type: "city" as const, name: displayName(r.NAME), label: r.NAME,
    state: r.USPS, fips: r.GEOID, lat: num(r.INTPTLAT), lon: num(r.INTPTLONG),
    parentId: placeId("state", r.USPS), approximate: false,
  }));
}

export interface ZipRel { zip: string; otherGeoid: string; share: number; land: number }

/** Relationship rows with an empty ZCTA describe areas outside any ZCTA and are skipped. */
export function zipRelations(rows: Row[], otherKey: "COUNTY" | "PLACE"): ZipRel[] {
  const out: ZipRel[] = [];
  for (const r of rows) {
    const zip = r.GEOID_ZCTA5_20, other = r[`GEOID_${otherKey}_20`];
    if (!/^\d{5}$/.test(zip ?? "") || !other) continue;
    const total = Number(r.AREALAND_ZCTA5_20), part = Number(r.AREALAND_PART);
    if (!(total > 0) || Number.isNaN(part)) continue;
    out.push({ zip, otherGeoid: other, share: Math.min(1, part / total), land: part });
  }
  return out;
}

async function fetchCached(url: string, name: string): Promise<string> {
  mkdirSync(CACHE, { recursive: true });
  const file = resolve(CACHE, name);
  if (!existsSync(file)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch ${url} failed: ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return file;
}

export async function gazetteer(name: string): Promise<Row[]> {
  const file = await fetchCached(`${GAZ}/${name}.zip`, `${name}.zip`);
  return parseCensus(execFileSync("unzip", ["-p", file], { maxBuffer: 64 * 1024 * 1024 }).toString("utf8"), "\t");
}

async function relationship(name: string): Promise<Row[]> {
  const file = await fetchCached(`${REL}/${name}`, name);
  return parseCensus(readFileSync(file, "utf8"), "|");
}

export async function ingestPlaces(db: DB) {
  const asOf = new Date().toISOString().slice(0, 10);
  const [counties, cities, zctas, zc, zp] = await Promise.all([
    gazetteer("2024_Gaz_counties_national"),
    gazetteer("2024_Gaz_place_national"),
    gazetteer("2024_Gaz_zcta_national"),
    relationship("tab20_zcta520_county20_natl.txt"),
    relationship("tab20_zcta520_place20_natl.txt"),
  ]);

  const places = new Map<string, PlaceDef>();
  for (const s of STATES) {
    places.set(placeId("state", s.usps), {
      id: placeId("state", s.usps), type: "state", name: s.name, label: s.name, state: s.usps, fips: s.fips,
      lat: null, lon: null, parentId: null, approximate: false,
    });
  }
  for (const p of [...countyDefs(counties), ...cityDefs(cities)]) places.set(p.id, p);

  const countyRels = zipRelations(zc, "COUNTY");
  const placeRels = zipRelations(zp, "PLACE");

  // A ZIP's state comes from the county covering most of its land; ZIPs with no county overlap are skipped.
  const zipState = new Map<string, { state: string; land: number }>();
  for (const r of countyRels) {
    const st = stateByFips(r.otherGeoid.slice(0, 2));
    if (!st) continue;
    const cur = zipState.get(r.zip);
    if (!cur || r.land > cur.land) zipState.set(r.zip, { state: st.usps, land: r.land });
  }
  let zipCount = 0;
  for (const z of zctas) {
    const st = zipState.get(z.GEOID);
    if (!st) continue;
    places.set(placeId("zip", z.GEOID), {
      id: placeId("zip", z.GEOID), type: "zip", name: z.GEOID, label: `ZIP ${z.GEOID}`, state: st.state, fips: z.GEOID,
      lat: num(z.INTPTLAT), lon: num(z.INTPTLONG), parentId: null, approximate: true,
    });
    zipCount++;
  }

  const overlaps: OverlapDef[] = [];
  for (const r of countyRels) overlaps.push({ placeId: placeId("zip", r.zip), otherId: placeId("county", r.otherGeoid), relation: "zip-in-county", share: r.share });
  for (const r of placeRels) overlaps.push({ placeId: placeId("zip", r.zip), otherId: placeId("city", r.otherGeoid), relation: "zip-in-city", share: r.share });

  upsertSource(db, SRC);
  const insP = db.prepare(
    `INSERT OR REPLACE INTO place (id,type,name,label,name_norm,state,fips,lat,lon,parent_id,approximate,source_id,as_of)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const insO = db.prepare("INSERT OR REPLACE INTO place_overlap (place_id,other_id,relation,share,source_id,as_of) VALUES (?,?,?,?,?,?)");
  let overlapCount = 0;
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM county_geography; DELETE FROM county_population; DELETE FROM place_overlap; DELETE FROM place;");
    for (const p of places.values()) {
      insP.run(p.id, p.type, p.name, p.label, normalizePlaceName(p.name), p.state, p.fips, p.lat, p.lon, p.parentId, p.approximate ? 1 : 0, SRC.id, asOf);
    }
    for (const o of overlaps) {
      if (!places.has(o.placeId) || !places.has(o.otherId)) continue;
      insO.run(o.placeId, o.otherId, o.relation, o.share, SRC.id, asOf);
      overlapCount++;
    }
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  console.log(`places: ${places.size} (${zipCount} ZIP areas), ${overlapCount} overlaps`);
}

export function loadCountyFacts(db: DB, geography: Row[], population: Row[]) {
  const counties = new Set((db.prepare("SELECT id FROM place WHERE type='county'").all() as Array<{ id: string }>).map((row) => row.id));
  const insertGeo = db.prepare("INSERT INTO county_geography VALUES (?,?,?,?,?)");
  const insertPop = db.prepare("INSERT INTO county_population VALUES (?,?,?,?)");
  let geographyCount = 0, populationCount = 0;
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM county_geography; DELETE FROM county_population;");
    for (const row of geography) {
      const id = placeId("county", row.GEOID);
      const land = num(row.ALAND_SQMI), water = num(row.AWATER_SQMI);
      if (!counties.has(id) || land === null || water === null || land < 0 || water < 0) continue;
      insertGeo.run(id, land, water, SRC.id, "2024-01-01");
      geographyCount++;
    }
    for (const row of population) {
      if (row.SUMLEV !== "050" || !/^\d{2}$/.test(row.STATE) || !/^\d{3}$/.test(row.COUNTY)) continue;
      const id = placeId("county", row.STATE + row.COUNTY);
      if (!counties.has(id) || !/^\d+$/.test(row.POPESTIMATE2024)) continue;
      insertPop.run(id, Number(row.POPESTIMATE2024), SRC_POPULATION.id, "2024-07-01");
      populationCount++;
    }
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  console.log(`County facts: ${geographyCount}/${counties.size} geography records, ${populationCount}/${counties.size} population estimates.`);
  return { geographyCount, populationCount };
}

export async function ingestCountyFacts(db: DB) {
  const [geography, populationFile] = await Promise.all([
    gazetteer("2024_Gaz_counties_national"),
    fetchCached(POPULATION_URL, "co-est2024-alldata.csv"),
  ]);
  const population = parseCsv(readFileSync(populationFile, "utf8"));
  if (!population.length || !("POPESTIMATE2024" in population[0])) throw new Error("Census county population file has an unexpected format.");
  upsertSource(db, SRC);
  upsertSource(db, SRC_POPULATION);
  return loadCountyFacts(db, geography, population);
}
