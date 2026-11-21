import { getGovUnit, govUnitIdsForPlaces, type DB, type GovUnitDto, type PlaceRow } from "@civic/db";

interface SchoolHit { geoid: string; name: string }
const cache = new Map<string, SchoolHit | null>();
const LAYERS = [0, 1, 2];

/** Resolve the school district at a point via Census TIGERweb. Returns null on any failure (caller labels it). */
export async function schoolDistrictAt(lat: number, lon: number, fetcher: typeof fetch = fetch): Promise<SchoolHit | null> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  for (const layer of LAYERS) {
    try {
      const u = new URL(`https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/School/MapServer/${layer}/query`);
      u.search = new URLSearchParams({
        geometry: `${lon},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
        outFields: "NAME,GEOID", returnGeometry: "false", f: "json",
      }).toString();
      const res = await fetcher(u, { signal: AbortSignal.timeout(6000) });
      const j = (await res.json()) as { features?: Array<{ attributes: { NAME: string; GEOID: string } }> };
      const a = j.features?.[0]?.attributes;
      if (a) { const hit = { geoid: a.GEOID, name: a.NAME }; cache.set(key, hit); return hit; }
    } catch { return null; }
  }
  cache.set(key, null);
  return null;
}

const KINDS = ["county", "city", "school_district", "special_district"] as const;

export async function buildLocal(db: DB, place: PlaceRow, lookup = schoolDistrictAt) {
  const ids = [place.id];
  if (place.type === "zip") {
    for (const o of db.prepare("SELECT other_id FROM place_overlap WHERE place_id = ?").all(place.id) as Array<{ other_id: string }>) ids.push(o.other_id);
  }
  const unitIds = new Set(govUnitIdsForPlaces(db, ids));
  let school: { state: "resolved" | "unavailable"; note: string } | null = null;
  if (place.type !== "state" && place.lat !== null && place.lon !== null) {
    const hit = await lookup(place.lat, place.lon);
    const row = hit && (db.prepare("SELECT id FROM gov_unit WHERE id = ?").get(`sd:${hit.geoid}`) as { id: string } | undefined);
    if (row) {
      unitIds.add(row.id);
      school = { state: "resolved", note: place.type === "zip"
        ? "Matched using the center point of this ZIP area, so it may differ for addresses elsewhere in the ZIP. Confirm with your district."
        : "Matched using the center point of this place. Confirm with your district." };
    } else school = { state: "unavailable", note: "The school district for this location could not be determined right now." };
  }
  const units = [...unitIds].map((id) => getGovUnit(db, id)).filter((u): u is GovUnitDto => !!u);
  const groups = KINDS.map((kind) => ({ kind, units: units.filter((u) => u.kind === kind) }));
  const covered = db.prepare("SELECT COUNT(*) AS n FROM gov_unit WHERE kind <> 'school_district'").get() as { n: number };
  return {
    placeId: place.id, groups, school,
    notes: [
      "Only units known to apply to this place are shown. Not all special districts (ports, transit, water, fire and others) are published in our data yet.",
      "Officials hired by a government, such as a city administrator or superintendent, are not elected and are labelled as hired.",
    ],
    coverage: { curatedUnits: covered.n },
  };
}
