import {
  BILL_STATUSES, CRITERIA, GRADE_MEANING, RUBRIC_VERSION,
  nicknameVariants, parsePlaceQuery, scoreName, stateByFips, stateByUsps, tokens,
} from "@civic/domain";
import { reportTarget, sanitize } from "./exclusions.ts";

function fuzzyPatterns(token: string): string[] {
  const patterns = new Set([token, ...nicknameVariants(token)]);
  if (token.length >= 4) {
    for (let i = 0; i < token.length; i++) patterns.add(token.slice(0, i) + token.slice(i + 1));
  }
  return [...patterns].filter((part) => part.length >= 2);
}

interface D1Result<T> {
  results: T[];
  success: boolean;
}

interface D1Statement {
  bind(...values: (string | number | null)[]): D1Statement;
  all<T>(): Promise<D1Result<T>>;
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta: { last_row_id: number } }>;
}

interface D1Database {
  prepare(query: string): D1Statement;
}

interface Env {
  DB: D1Database;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

interface SearchSnapshot {
  names: Array<{ personId: string; nameNorm: string }>;
  people: Record<string, {
    meta: {
      id: string;
      status: "current" | "former" | "candidate";
      level: string;
      body: string;
      state: string | null;
      party: string | null;
      startYear: number;
      endYear: number | null;
      bodies: string;
      parties: string;
      states: string;
      family: string;
      candidate: boolean;
      officeTypes: string;
      officeSought: string;
      electionYear: number | null;
    };
    person: ReturnType<typeof summary>;
  }>;
  places: PlaceRow[];
}

interface SearchRow {
  id: string;
  nameNorm: string;
  status: "current" | "former" | "candidate";
  level: string;
  body: string;
  state: string | null;
  party: string | null;
  startYear: number;
  endYear: number | null;
  bodies: string;
  parties: string;
  states: string;
  officeTypes: string;
  candidate: number;
  officeSought: string;
  electionYear: number | null;
  family: string;
  canonicalName: string;
  photoUrl: string | null;
  district: string | null;
  startDate: string | null;
  endDate: string | null;
  candidacyId: string | null;
  candidacyParty: string | null;
  candidacyStatus: string | null;
  incumbent: number | null;
  office: string | null;
  soughtLevel: string | null;
  soughtDistrict: string | null;
  jurisdiction: string | null;
  electionDate: string | null;
  raceId: string | null;
}

interface DbPlace {
  id: string;
  type: "state" | "county" | "city" | "zip";
  name: string;
  label: string;
  name_norm: string;
  state: string;
  fips: string;
  lat: number | null;
  lon: number | null;
  parent_id: string | null;
  approximate: number;
  source_id: string;
  as_of: string;
}

interface BillAsset {
  id: string;
  jurisdiction: string;
  session: string;
  number: string;
  title: string;
  summary: string | null;
  status: string;
  statusDetail: string | null;
  isLaw: boolean | null;
  chapter: string | null;
  url: string;
  textUrl: string | null;
  introducedOn: string | null;
  provenance: {
    sourceId: string;
    sourceName: string;
    sourceUrl: string;
    asOf: string;
    grade: string | null;
    selfReported: boolean;
  };
  sponsors: Array<{ name: string; role: string }>;
  actions: Array<{ date: string; chamber: string | null; text: string }>;
}

interface PlaceAssetRecord {
  place: {
    id: string; type: "state" | "county" | "city" | "zip"; name: string; label: string;
    state: string; stateName: string; approximate: boolean;
  };
  approximateNote?: string;
  parents: Array<{ id: string; type: string; name: string; label: string; state: string; stateName: string; approximate: boolean }>;
  children: Array<{ id: string; type: string; name: string; label: string; state: string; stateName: string; approximate: boolean }>;
  overlaps: Array<{ place: { id: string; type: string; name: string; label: string; state: string; stateName: string; approximate: boolean }; relation: string; share: number | null }>;
  states: string[];
  lat: number | null;
  lon: number | null;
  countyFacts?: {
    geography: { landSqMi: number; waterSqMi: number; provenance: PlaceAssetRecord["provenance"] } | null;
    population: { estimate: number; provenance: PlaceAssetRecord["provenance"] } | null;
  } | null;
  provenance: { sourceId: string; sourceName: string; sourceUrl: string; asOf: string; grade: string | null; selfReported: boolean } | null;
}

interface PlaceDataAsset {
  state: string;
  levels: Array<{
    level: "federal" | "state";
    state: "sourced" | "sourced_low" | "not_found" | "not_yet_checked";
    officials: Array<{ id: string }>;
    races: Array<{ id: string }>;
    note?: string;
    gap?: { reason: string; sourcesChecked: string[]; officialSiteUrl: string };
  }>;
  cityCount: number;
  places: Record<string, PlaceAssetRecord>;
}

interface RaceRow {
  id: string;
  status: string;
  title: string;
  body: string;
  level: string;
  jurisdiction: string;
  district: string | null;
  date: string;
  type: string;
}

interface PlaceRow {
  id: string;
  type: "state" | "county" | "city" | "zip";
  name: string;
  label: string;
  name_norm: string;
  state: string;
  approximate: number;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
    },
  });
}

function parsePageCursor(cursor: string | null): number {
  if (!cursor) return 0;
  try {
    const value = Number(atob(cursor.replace(/-/g, "+").replace(/_/g, "/")));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function makeCursor(offset: number): string {
  return btoa(String(offset)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const searchAssetCache = new Map<string, Promise<unknown>>();
const compressedAssetCache = new Map<string, Promise<unknown>>();

function searchAsset<T>(env: Env, origin: string, path: string): Promise<T> {
  const cached = searchAssetCache.get(path);
  if (cached) return cached as Promise<T>;
  const pending = env.ASSETS.fetch(new Request(new URL(path, origin))).then(async (response) => {
    if (!response.ok) throw new Error(`Search index asset ${path} returned HTTP ${response.status}`);
    return await response.json() as T;
  }).catch((error: unknown) => {
    searchAssetCache.delete(path);
    throw error;
  });
  searchAssetCache.set(path, pending);
  return pending;
}

function yearsLabel(start: string | null, end: string | null, status: string): string {
  if (!start) return "";
  const first = start.slice(0, 4);
  if (status === "current" || !end) return `${first}-present`;
  const last = end.slice(0, 4);
  return first === last ? first : `${first}-${last}`;
}

function summary(row: SearchRow) {
  const hasCandidacy = row.candidacyId !== null;
  const hasTerm = row.body !== "";
  const state = hasTerm ? row.state : (/^[A-Z]{2}$/.test(row.jurisdiction ?? "") ? row.jurisdiction : null);
  return {
    id: row.id,
    name: row.canonicalName,
    photoUrl: row.photoUrl,
    status: row.status,
    level: hasTerm ? row.level : hasCandidacy ? row.soughtLevel ?? "federal" : "federal",
    body: hasTerm ? row.body : row.office ?? "",
    party: row.party ?? row.candidacyParty,
    state,
    district: hasTerm ? row.district : row.soughtDistrict,
    years: yearsLabel(row.startDate, row.endDate, row.status === "candidate" ? "former" : row.status),
    ...(hasCandidacy ? {
      candidacy: {
        office: row.office,
        jurisdiction: row.jurisdiction,
        electionYear: Number(row.electionDate?.slice(0, 4)),
        electionDate: row.electionDate,
        party: row.candidacyParty,
        status: row.candidacyStatus,
        incumbent: row.incumbent === 1,
        raceId: row.raceId,
      },
    } : {}),
  };
}

const SEARCH_SELECT = `
  SELECT p.id, pn.name_norm AS nameNorm, p.status,
    COALESCE(t.level, o.level, 'federal') AS level, COALESCE(t.body, '') AS body, t.state, t.party,
    CAST(COALESCE((SELECT MIN(substr(start_date,1,4)) FROM office_term WHERE person_id=p.id), '9999') AS INTEGER) AS startYear,
    CAST((SELECT MAX(substr(COALESCE(end_date,'9999'),1,4)) FROM office_term WHERE person_id=p.id) AS INTEGER) AS endYear,
    COALESCE((SELECT group_concat(DISTINCT body) FROM office_term WHERE person_id=p.id), '') AS bodies,
    COALESCE((SELECT group_concat(DISTINCT party) FROM office_term WHERE person_id=p.id), '') AS parties,
    COALESCE((SELECT group_concat(DISTINCT state) FROM office_term WHERE person_id=p.id), '') ||
      ',' || COALESCE((SELECT group_concat(DISTINCT o2.jurisdiction) FROM candidacy c2
        JOIN race r2 ON r2.id=c2.race_id JOIN office o2 ON o2.id=r2.office_id WHERE c2.person_id=p.id), '') AS states,
    COALESCE((SELECT group_concat(DISTINCT office_type) FROM office_term WHERE person_id=p.id), '') AS officeTypes,
    EXISTS(SELECT 1 FROM candidacy WHERE person_id=p.id) AS candidate,
    COALESCE((SELECT group_concat(o.title || ' ' || o.jurisdiction, ' ')
      FROM candidacy c JOIN race ra ON ra.id=c.race_id JOIN office o ON o.id=ra.office_id
      WHERE c.person_id=p.id), '') AS officeSought,
    (SELECT MAX(CAST(substr(e.date,1,4) AS INTEGER))
      FROM candidacy c JOIN race ra ON ra.id=c.race_id JOIN election e ON e.id=ra.election_id
      WHERE c.person_id=p.id) AS electionYear,
    lower(COALESCE(p.family, p.canonical_name)) AS family, p.canonical_name AS canonicalName,
    p.photo_url AS photoUrl, t.district, t.start_date AS startDate, t.end_date AS endDate,
    c.id AS candidacyId, c.party AS candidacyParty, c.status AS candidacyStatus,
    c.incumbent, o.title AS office, o.jurisdiction, e.date AS electionDate,
    o.level AS soughtLevel, o.district AS soughtDistrict, ra.id AS raceId
  FROM person_name pn JOIN person p ON p.id=pn.person_id
  LEFT JOIN office_term t ON t.id=(SELECT id FROM office_term WHERE person_id=p.id ORDER BY start_date DESC LIMIT 1)
  LEFT JOIN candidacy c ON c.id=(SELECT c2.id FROM candidacy c2 JOIN race r2 ON r2.id=c2.race_id
    JOIN election e2 ON e2.id=r2.election_id WHERE c2.person_id=p.id ORDER BY e2.date DESC LIMIT 1)
  LEFT JOIN race ra ON ra.id=c.race_id
  LEFT JOIN office o ON o.id=ra.office_id
  LEFT JOIN election e ON e.id=ra.election_id`;

function matchesNameToken(nameNorm: string, patterns: string[]): boolean {
  return nameNorm.split(" ").some((word) => patterns.some((pattern) => word.startsWith(pattern)));
}

async function searchPeopleSnapshot(env: Env, url: URL): Promise<Response> {
  const params = url.searchParams;
  const q = (params.get("q") ?? "").trim();
  if (!q) return json({ error: "q is required" }, 400);
  const queryTokens = tokens(q);
  if (!queryTokens.length) return json({ results: [], nextCursor: null, total: 0 });
  const patterns = queryTokens.map(fuzzyPatterns);
  if (patterns.some((parts) => !parts.length)) return json({ results: [], nextCursor: null, total: 0 });

  const letters = [...new Set(patterns[0].map((pattern) => pattern[0]))];
  const shards = await Promise.all(letters.map((letter) =>
    searchAsset<Pick<SearchSnapshot, "names" | "people">>(env, url.origin, `/people-search-${letter}.json`)));
  const names = shards.flatMap((shard) => shard.names);
  const people: SearchSnapshot["people"] = Object.assign({}, ...shards.map((shard) => shard.people));
  const officeIndex = await searchAsset<Pick<SearchSnapshot, "people">>(env, url.origin, "/office-search.json");
  Object.assign(people, officeIndex.people);
  const best = new Map<string, number>();
  for (const name of names) {
    if (!matchesNameToken(name.nameNorm, patterns[0])) continue;
    const score = scoreName(queryTokens, name.nameNorm);
    if (score > (best.get(name.personId) ?? 0)) best.set(name.personId, score);
  }
  for (const [id, entry] of Object.entries(people)) {
    if (!entry.meta.candidate || best.has(id)) continue;
    const officeWords = entry.meta.officeSought.split(/[^a-z0-9]+/).filter(Boolean);
    if (queryTokens.every((token) => token.length > 2 && officeWords.some((word) => word.startsWith(token)))) {
      best.set(id, 50);
    }
  }

  const hits = [...best].flatMap(([id, score]) => {
    const entry = people[id];
    if (!entry || !passesSnapshot(entry.meta, params)) return [];
    return [{ id, score, ...entry }];
  }).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.score === 50 && a.meta.candidate && b.meta.candidate) {
      return a.meta.family.localeCompare(b.meta.family);
    }
    if (a.meta.status !== b.meta.status) return a.meta.status === "current" ? -1 : 1;
    const levelOrder = (level: string) => level === "federal" ? 0 : level === "state" ? 1 : 2;
    return levelOrder(a.meta.level) - levelOrder(b.meta.level) ||
      (b.meta.endYear ?? 9999) - (a.meta.endYear ?? 9999);
  });
  const offset = parsePageCursor(params.get("cursor"));
  const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), 50);
  return json({
    results: hits.slice(offset, offset + limit).map((hit) => hit.person),
    nextCursor: offset + limit < hits.length ? makeCursor(offset + limit) : null,
    total: hits.length,
  });
}

function passesSnapshot(meta: SearchSnapshot["people"][string]["meta"], filters: URLSearchParams): boolean {
  const level = filters.get("level");
  const status = filters.get("status");
  const state = filters.get("state")?.toUpperCase();
  const body = filters.get("body")?.toLowerCase();
  const party = filters.get("party")?.toLowerCase();
  const officeType = filters.get("office_type");
  const year = Number(filters.get("year"));
  const electionYear = Number(filters.get("election_year"));
  const role = filters.get("role");
  if (level && meta.level !== level) return false;
  if (status && meta.status !== status) return false;
  if (state && !meta.states.split(",").includes(state)) return false;
  if (body && !meta.bodies.toLowerCase().includes(body) && !meta.officeSought.toLowerCase().includes(body)) return false;
  if (party && !meta.parties.toLowerCase().includes(party)) return false;
  if (officeType && !meta.officeTypes.split(",").includes(officeType)) return false;
  if (role === "candidate" && !meta.candidate) return false;
  if (role === "official" && !meta.bodies) return false;
  if (filters.has("year") && (!Number.isInteger(year) || meta.startYear > year || (meta.endYear !== null && year > meta.endYear))) return false;
  if (filters.has("election_year") && meta.electionYear !== electionYear) return false;
  return true;
}

function compressedAsset<T>(env: Env, origin: string, path: string): Promise<T> {
  const cached = compressedAssetCache.get(path);
  if (cached) return cached as Promise<T>;
  const pending = env.ASSETS.fetch(new Request(new URL(path, origin))).then(async (response) => {
    if (!response.ok) throw new Error(`Page data asset ${path} returned HTTP ${response.status}`);
    const stream = new Blob([await response.arrayBuffer()]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).json() as T;
  }).catch((error: unknown) => {
    compressedAssetCache.delete(path);
    throw error;
  });
  compressedAssetCache.set(path, pending);
  if (compressedAssetCache.size > 4) {
    const oldest = compressedAssetCache.keys().next().value;
    if (oldest && oldest !== path) compressedAssetCache.delete(oldest);
  }
  return pending;
}

interface ProfileSnapshot {
  profiles: Record<string, unknown>;
  candidates: Record<string, unknown>;
  timelines: Record<string, unknown>;
}

async function profileSnapshot(
  env: Env, origin: string, id: string, kind: "profiles" | "candidates" | "timelines",
): Promise<Response> {
  const shard = await compressedAsset<ProfileSnapshot>(env, origin, `/profile-data-${id.slice(0, 2)}.json.gz`);
  const profile = shard[kind][id];
  return profile ? json(profile) : json({ error: "not found" }, 404);
}

interface LocalDataSnapshot {
  state: string;
  places: Record<string, string[]>;
  units: Record<string, { id: string; kind: string; name: string; offices: unknown[] }>;
}

async function localGovernmentSnapshot(env: Env, origin: string, id: string): Promise<Response> {
  const placeResponse = await placePage(env, origin, id);
  if (!placeResponse.ok) return placeResponse;
  const page = await placeResponse.json() as { place: { id: string; type: string }; states: string[] };
  const packs = await Promise.all(page.states.map((state) =>
    compressedAsset<LocalDataSnapshot>(env, origin, `/local-data-${state}.json.gz`)));
  const unitIds = new Set(packs.flatMap((pack) => pack.places[id] ?? []));
  const units = new Map<string, LocalDataSnapshot["units"][string]>();
  for (const pack of packs) {
    for (const unitId of unitIds) {
      const unit = pack.units[unitId];
      if (unit) units.set(unitId, unit);
    }
  }
  const placePacks = await Promise.all(page.states.map((state) =>
    searchAsset<PlaceDataAsset>(env, origin, `/place-data-${state}.json`)));
  const placeRecord = placePacks.map((pack) => pack.places[id]).find(Boolean);
  let school: { state: "resolved" | "unavailable"; note: string } | null = null;
  if (page.place.type !== "state" && placeRecord?.lat !== null && placeRecord?.lat !== undefined &&
    placeRecord.lon !== null && placeRecord.lon !== undefined) {
    school = { state: "unavailable", note: "The school district for this location could not be determined right now." };
    for (const layer of [0, 1, 2]) {
      try {
        const endpoint = new URL(`https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/School/MapServer/${layer}/query`);
        endpoint.search = new URLSearchParams({
          geometry: `${placeRecord.lon},${placeRecord.lat}`,
          geometryType: "esriGeometryPoint",
          inSR: "4326",
          spatialRel: "esriSpatialRelIntersects",
          outFields: "NAME,GEOID",
          returnGeometry: "false",
          f: "json",
        }).toString();
        const response = await fetch(endpoint, { signal: AbortSignal.timeout(6000) });
        if (!response.ok) break;
        const result = await response.json() as { features?: Array<{ attributes: { GEOID: string } }> };
        const district = result.features?.[0]?.attributes;
        if (!district) continue;
        const unitId = `sd:${district.GEOID}`;
        const unit = packs.map((pack) => pack.units[unitId]).find(Boolean);
        if (unit) {
          units.set(unitId, unit);
          school = {
            state: "resolved",
            note: page.place.type === "zip"
              ? "Matched using the center point of this ZIP area, so it may differ for addresses elsewhere in the ZIP. Confirm with your district."
              : "Matched using the center point of this place. Confirm with your district.",
          };
        }
        break;
      } catch {
        break;
      }
    }
  }
  const allUnits = [...units.values()];
  const kinds = ["county", "city", "school_district", "special_district"] as const;
  return json({
    placeId: id,
    groups: kinds.map((kind) => ({ kind, units: allUnits.filter((unit) => unit.kind === kind) })),
    school,
    notes: [
      "Only units known to apply to this place are shown. Not all special districts (ports, transit, water, fire and others) are published in our data yet.",
      "Officials hired by a government, such as a city administrator or superintendent, are not elected and are labelled as hired.",
    ],
  });
}

async function governmentSnapshot(env: Env, origin: string, id: string): Promise<Response> {
  const index = await searchAsset<{ states: Record<string, string> }>(env, origin, "/government-index.json");
  const state = index.states[id];
  if (!state) return json({ error: "not found" }, 404);
  const data = await compressedAsset<LocalDataSnapshot>(env, origin, `/local-data-${state}.json.gz`);
  const unit = data.units[id];
  return unit ? json(unit) : json({ error: "not found" }, 404);
}

interface RaceAsset {
  id: string;
  office: string;
  body: string;
  jurisdiction: string;
  electionDate: string;
}

async function listRaceAssets(env: Env, origin: string, url: URL): Promise<Response> {
  const state = url.searchParams.get("state");
  const office = url.searchParams.get("office");
  const year = url.searchParams.get("year");
  if (state && !/^[A-Za-z]{2}$/.test(state)) return json({ error: "invalid state" }, 400);
  if (year && !Number.isInteger(Number(year))) return json({ error: "invalid year" }, 400);
  const data = await searchAsset<{ items: RaceAsset[] }>(env, origin, "/races.json");
  const items = data.items.filter((race) =>
    (!state || race.jurisdiction === state.toUpperCase()) &&
    (!office || `${race.office} ${race.body}`.toLowerCase().includes(office.toLowerCase())) &&
    (!year || race.electionDate.slice(0, 4) === year));
  return json({ items });
}

async function searchPlaces(env: Env, url: URL): Promise<Response> {
  const params = url.searchParams;
  const q = (params.get("q") ?? "").trim();
  if (!q) return json({ error: "q is required" }, 400);
  const type = params.get("type");
  if (type && !["state", "county", "city", "zip"].includes(type)) return json({ error: "invalid type" }, 400);
  const stateParam = params.get("state");
  if (stateParam && !/^[A-Za-z]{2}$/.test(stateParam)) return json({ error: "invalid state" }, 400);
  const parsed = parsePlaceQuery(q);
  const state = (stateParam ?? parsed.state)?.toUpperCase();
  const placeType = type ?? parsed.type;
  const numericZip = /^\d{3,5}$/.test(q);
  const queryTokens = parsed.tokens;
  let found: PlaceRow[];
  let candidates: PlaceRow[];
  if (numericZip) {
    const shard = await searchAsset<Pick<SearchSnapshot, "places">>(env, url.origin, `/place-search-${q[0]}.json`);
    candidates = shard.places;
  } else {
    if (!queryTokens.length) return json({ results: [], total: 0 });
    const patterns = queryTokens.map(fuzzyPatterns);
    if (patterns.some((parts) => !parts.length)) return json({ results: [], total: 0 });
    const letters = [...new Set(patterns[0].map((pattern) => pattern[0]))];
    const shards = await Promise.all(letters.map((letter) =>
      searchAsset<Pick<SearchSnapshot, "places">>(env, url.origin, `/place-search-${letter}.json`)));
    candidates = shards.flatMap((shard) => shard.places);
  }

  if (numericZip) {
    if (placeType && placeType !== "zip") return json({ results: [], total: 0 });
    found = candidates.filter((place) => place.type === "zip" && place.name.startsWith(q));
  } else {
    const patterns = queryTokens.map(fuzzyPatterns);
    if (patterns.some((parts) => !parts.length)) return json({ results: [], total: 0 });
    found = candidates.filter((place) => patterns.every((parts) => matchesNameToken(place.name_norm, parts)));
  }
  if (placeType) found = found.filter((place) => place.type === placeType);
  if (state) found = found.filter((place) => place.state === state || (place.type === "state" && place.id === `state:${state}`));

  if (!numericZip) {
    const scores = found.map((place) => ({ place, score: scoreName(queryTokens, place.name_norm) }))
      .filter((hit) => hit.score > 0);
    found = scores.sort((a, b) =>
      b.score - a.score ||
      ["state", "county", "city", "zip"].indexOf(a.place.type) - ["state", "county", "city", "zip"].indexOf(b.place.type) ||
      a.place.state.localeCompare(b.place.state) || a.place.name.localeCompare(b.place.name) || a.place.id.localeCompare(b.place.id),
    ).map((hit) => hit.place);
    if (queryTokens.length === 1 && queryTokens[0].length === 2 && !state) {
      const abbreviation = candidates.find((place) =>
        place.id === `state:${queryTokens[0].toUpperCase()}` && place.type === "state");
      if (abbreviation && !found.some((p) => p.id === abbreviation.id)) found.unshift(abbreviation);
    }
  }
  const total = found.length;
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 200);
  return json({
    results: found.slice(0, limit).map((p) => ({
      id: p.id, type: p.type, name: p.name, label: p.label, state: p.state,
      stateName: stateByUsps(p.state)?.name ?? p.state, approximate: !!p.approximate,
    })),
    total,
  });
}

async function peopleProfile(db: D1Database, id: string): Promise<Response> {
  const row = await db.prepare(`${SEARCH_SELECT} WHERE p.id=? LIMIT 1`).bind(id).first<SearchRow>();
  if (!row) return json({ error: "not found" }, 404);
  const [terms, person, committees, social, coverage, education, career, sourceDate] = await Promise.all([
    db.prepare(`SELECT t.title,t.body,t.level,t.branch,t.party,t.state,t.district,
      t.start_date AS start,t.end_date AS end,t.source_id AS sourceId,t.as_of AS asOf,
      s.name AS sourceName,s.url AS sourceUrl,s.grade,s.self_reported AS selfReported
      FROM office_term t JOIN source s ON s.id=t.source_id WHERE t.person_id=? ORDER BY t.start_date`)
      .bind(id).all<Record<string, unknown>>(),
    db.prepare("SELECT birth_date,source_id AS sourceId,as_of AS asOf FROM person WHERE id=?")
      .bind(id).first<{ birth_date: string | null; sourceId: string; asOf: string }>(),
    db.prepare(`SELECT c.id,c.name,c.parent_id,c.url,m.role,m.source_id AS sourceId,m.as_of AS asOf,
      s.name AS sourceName,s.url AS sourceUrl,s.grade,s.self_reported AS selfReported
      FROM committee_membership m JOIN committee c ON c.id=m.committee_id
      JOIN source s ON s.id=m.source_id WHERE m.person_id=? ORDER BY c.parent_id IS NOT NULL,c.name`)
      .bind(id).all<Record<string, unknown>>(),
    db.prepare(`SELECT x.platform,x.handle,x.url,x.source_id AS sourceId,x.as_of AS asOf,
      s.name AS sourceName,s.url AS sourceUrl,s.grade,s.self_reported AS selfReported
      FROM social x JOIN source s ON s.id=x.source_id WHERE x.person_id=?`)
      .bind(id).all<Record<string, unknown>>(),
    db.prepare("SELECT section,status FROM coverage WHERE person_id=?").bind(id).all<{section:string;status:string}>(),
    db.prepare(`SELECT institution,degree,year,source_id AS sourceId,as_of AS asOf,
      s.name AS sourceName,s.url AS sourceUrl,s.grade,s.self_reported AS selfReported
      FROM education e JOIN source s ON s.id=e.source_id WHERE e.person_id=?`)
      .bind(id).all<Record<string, unknown>>(),
    db.prepare(`SELECT title,org,start,end,source_id AS sourceId,as_of AS asOf,
      s.name AS sourceName,s.url AS sourceUrl,s.grade,s.self_reported AS selfReported
      FROM career_item c JOIN source s ON s.id=c.source_id WHERE c.person_id=? ORDER BY start`)
      .bind(id).all<Record<string, unknown>>(),
    db.prepare("SELECT MAX(retrieved_at) AS value FROM source").first<{value:string|null}>(),
  ]);
  const provenance = (r: Record<string, unknown>) => ({
    sourceId: r.sourceId, sourceName: r.sourceName, sourceUrl: r.sourceUrl, asOf: r.asOf,
    grade: r.grade ?? null, selfReported: !!r.selfReported,
  });
  const mappedTerms = terms.results.map((t) => ({
    title: t.title, body: t.body, level: t.level, branch: t.branch, party: t.party, state: t.state,
    district: t.district, start: t.start, end: t.end, provenance: provenance(t),
  }));
  const background: Array<Record<string, unknown>> = [];
  if (person?.birth_date) background.push({
    kind: "birth", detail: `Born ${person.birth_date}`,
    provenance: provenance({
      sourceId: person.sourceId, asOf: person.asOf,
      ...await db.prepare("SELECT name AS sourceName,url AS sourceUrl,grade,self_reported AS selfReported FROM source WHERE id=?")
        .bind(person.sourceId).first<Record<string, unknown>>(),
    }),
  });
  for (const item of education.results) background.push({
    kind: "education",
    detail: `Education: ${item.institution}${item.degree ? ` (${item.degree})` : ""}${item.year ? `, ${item.year}` : ""}`,
    provenance: provenance(item),
  });
  for (const item of career.results) background.push({
    kind: "career",
    detail: `${item.title}${item.org ? `, ${item.org}` : ""}${item.start ? ` (${item.start === item.end ? item.start : `${item.start}–${item.end ?? "present"}`})` : ""}`,
    provenance: provenance(item),
  });
  const latestTerm = await db.prepare(`SELECT t.website,t.phone,t.address,t.contact_form,t.source_id AS sourceId,t.as_of AS asOf,
    s.name AS sourceName,s.url AS sourceUrl,s.grade,s.self_reported AS selfReported
    FROM office_term t JOIN source s ON s.id=t.source_id WHERE t.person_id=? ORDER BY t.start_date DESC LIMIT 1`)
    .bind(id).first<Record<string, unknown>>();
  const personSource = person ? await db.prepare("SELECT name AS sourceName,url AS sourceUrl,grade,self_reported AS selfReported FROM source WHERE id=?")
    .bind(person.sourceId).first<Record<string, unknown>>() : null;
  const contactSource = latestTerm ?? (person ? { sourceId: person.sourceId, asOf: person.asOf, ...personSource } : {});
  const profile = {
    person: summary(row),
    terms: mappedTerms.map(({title,body,party,state,district,start,end,provenance:p}) => ({title,body,party,state,district,start,end,provenance:p})),
    committees: committees.results.map((c) => ({
      id:c.id,name:c.name,subcommittee:c.parent_id!==null,chamber:null,url:c.url,role:c.role,provenance:provenance(c),
    })),
    background,
    contact: {
      website: latestTerm?.website ?? null, phone: latestTerm?.phone ?? null, address: latestTerm?.address ?? null,
      contactForm: latestTerm?.contact_form ?? null,
      social: social.results.map((s) => ({platform:s.platform,handle:s.handle,url:s.url,provenance:provenance(s)})),
      provenance: provenance(contactSource),
    },
    identifiers: (await db.prepare("SELECT scheme,value FROM person_identifier WHERE person_id=?").bind(id).all<{scheme:string;value:string}>()).results,
    coverage: Object.fromEntries(coverage.results.map((c) => [c.section,c.status])),
    lastUpdated: sourceDate?.value ?? null,
  };
  return json(profile);
}

async function candidateProfile(db: D1Database, id: string): Promise<Response> {
  const candidacy = await db.prepare(`SELECT c.id,c.party,c.status,c.incumbent,c.website,c.filed_on,c.source_id,c.as_of,
    o.title AS office,o.jurisdiction,e.date AS electionDate,ra.id AS raceId
    FROM candidacy c JOIN race ra ON ra.id=c.race_id JOIN election e ON e.id=ra.election_id
    JOIN office o ON o.id=ra.office_id WHERE c.person_id=? ORDER BY e.date DESC LIMIT 1`)
    .bind(id).first<{ id: string; party: string | null; status: string; incumbent: number; website: string | null;
      filed_on: string | null; source_id: string; as_of: string; office: string; jurisdiction: string;
      electionDate: string; raceId: string }>();
  if (!candidacy) return json({ error: "not found" }, 404);
  const profileResponse = await peopleProfile(db, id);
  if (!profileResponse.ok) return profileResponse;
  const profile = await profileResponse.json() as {
    person: ReturnType<typeof summary>;
    terms: Array<Record<string, unknown>>;
    committees: Array<Record<string, unknown>>;
    background: Array<{ kind: string; detail: string; provenance: Record<string, unknown> }>;
    contact: { social: Array<Record<string, unknown>> };
    coverage: Record<string, string>;
    lastUpdated: string | null;
  };
  const [raceRow, source, education, career, agenda, finance] = await Promise.all([
    db.prepare(`${RACE_SELECT} WHERE ra.id=?`).bind(candidacy.raceId).first<RaceRow>(),
    db.prepare("SELECT name AS sourceName,url AS sourceUrl,grade,self_reported AS selfReported FROM source WHERE id=?")
      .bind(candidacy.source_id).first<{ sourceName: string; sourceUrl: string; grade: string | null; selfReported: number }>(),
    db.prepare(`SELECT e.institution,e.degree,e.year,e.source_id AS sourceId,e.as_of AS asOf,
      s.name AS sourceName,s.url AS sourceUrl,s.grade,s.self_reported AS selfReported FROM education e
      JOIN source s ON s.id=e.source_id WHERE e.person_id=?`).bind(id).all<Record<string, unknown>>(),
    db.prepare(`SELECT c.title,c.org,c.start,c.end,c.source_id AS sourceId,c.as_of AS asOf,
      s.name AS sourceName,s.url AS sourceUrl,s.grade,s.self_reported AS selfReported FROM career_item c
      JOIN source s ON s.id=c.source_id WHERE c.person_id=?`).bind(id).all<Record<string, unknown>>(),
    db.prepare(`SELECT topic,text,origin,source_url AS sourceUrl,captured_at AS capturedAt
      FROM agenda_item WHERE candidacy_id=? ORDER BY topic`).bind(candidacy.id)
      .all<{ topic: string; text: string; origin: string; sourceUrl: string; capturedAt: string }>(),
    db.prepare(`SELECT f.cycle,f.receipts,f.disbursements,f.cash_on_hand AS cashOnHand,
      f.source_id AS sourceId,f.as_of AS asOf,s.name AS sourceName,s.url AS sourceUrl,s.grade,
      s.self_reported AS selfReported FROM finance_summary f JOIN source s ON s.id=f.source_id
      WHERE f.candidacy_id=? ORDER BY f.cycle DESC LIMIT 1`).bind(candidacy.id)
      .first<Record<string, unknown>>(),
  ]);
  if (!raceRow) return json({ error: "not found" }, 404);
  const provenance = {
    sourceId: candidacy.source_id,
    sourceName: source?.sourceName ?? candidacy.source_id,
    sourceUrl: source?.sourceUrl ?? "",
    asOf: candidacy.as_of,
    grade: source?.grade ?? null,
    selfReported: source?.selfReported === 1,
  };
  const race = await raceDto(db, raceRow);
  return json({
    person: profile.person,
    candidacy: {
      office: candidacy.office,
      jurisdiction: candidacy.jurisdiction,
      electionYear: Number(candidacy.electionDate.slice(0, 4)),
      electionDate: candidacy.electionDate,
      party: candidacy.party,
      status: candidacy.status,
      incumbent: candidacy.incumbent === 1,
      raceId: candidacy.raceId,
      website: candidacy.website,
      filedOn: candidacy.filed_on,
      provenance,
    },
    race,
    background: {
      items: profile.background,
      education: education.results.map(({ institution, degree, year, ...prov }) => ({
        institution, degree, year, provenance: prov,
      })),
      career: career.results.map(({ title, org, start, end, ...prov }) => ({ title, org, start, end, provenance: prov })),
    },
    committees: profile.committees,
    links: profile.contact.social,
    agenda: { selfReported: true, items: agenda.results },
    record: { terms: profile.terms, bills: [], votes: [] },
    finance: finance ? {
      cycle: finance.cycle,
      receipts: finance.receipts,
      disbursements: finance.disbursements,
      cashOnHand: finance.cashOnHand,
      provenance: {
        sourceId: finance.sourceId, sourceName: finance.sourceName, sourceUrl: finance.sourceUrl,
        asOf: finance.asOf, grade: finance.grade, selfReported: finance.selfReported === 1,
      },
    } : null,
    coverage: profile.coverage,
    lastUpdated: profile.lastUpdated,
  });
}

async function listBills(env: Env, url: URL): Promise<Response> {
  const jurisdiction = url.searchParams.get("jurisdiction");
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim().slice(0, 100);
  const limit = Number(url.searchParams.get("limit") ?? 25);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  if (jurisdiction && !/^[A-Za-z]{2}$/.test(jurisdiction)) return json({ error: "invalid jurisdiction" }, 400);
  if (status && !(BILL_STATUSES as readonly string[]).includes(status)) return json({ error: "invalid status" }, 400);
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(offset) || offset < 0) {
    return json({ error: "invalid paging" }, 400);
  }
  const data = await searchAsset<{ items: BillAsset[] }>(env, url.origin, "/bills.json");
  const query = q?.toLowerCase();
  const results = data.items.filter((bill) =>
    (!jurisdiction || bill.jurisdiction === jurisdiction.toUpperCase()) &&
    (!status || bill.status === status) &&
    (!query || [bill.title, bill.number, bill.summary ?? ""].some((value) => value.toLowerCase().includes(query))))
    .sort((a, b) => b.session.localeCompare(a.session) || a.number.localeCompare(b.number));
  return json({ total: results.length, items: results.slice(offset, offset + Math.min(limit, 100)) });
}

async function billDetails(env: Env, origin: string, id: string): Promise<Response> {
  const data = await searchAsset<{ items: BillAsset[] }>(env, origin, "/bills.json");
  const bill = data.items.find((item) => item.id === id);
  return bill ? json(bill) : json({ error: "not found" }, 404);
}

function placeSummary(row: DbPlace) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    label: row.label,
    state: row.state,
    stateName: stateByUsps(row.state)?.name ?? row.state,
    approximate: !!row.approximate,
  };
}

async function getPlaceRow(db: D1Database, id: string): Promise<DbPlace | null> {
  return db.prepare(`SELECT id,type,name,label,name_norm,state,fips,lat,lon,parent_id,approximate,source_id,as_of
    FROM place WHERE id=?`).bind(id).first<DbPlace>();
}

const RACE_SELECT = `SELECT ra.id,ra.status,o.title,o.body,o.level,o.jurisdiction,o.district,e.date,e.type
  FROM race ra JOIN office o ON o.id=ra.office_id JOIN election e ON e.id=ra.election_id`;

async function raceDtos(db: D1Database, rows: RaceRow[]) {
  const candidates = new Map<string, Array<{ id: string; name: string; photoUrl: string | null;
    family: string | null; given: string | null; party: string | null; status: string; incumbent: number }>>();
  for (let offset = 0; offset < rows.length; offset += 80) {
    const batch = rows.slice(offset, offset + 80);
    if (!batch.length) continue;
    const ids = batch.map((row) => row.id);
    const marks = ids.map(() => "?").join(",");
    const result = await db.prepare(`SELECT c.race_id AS raceId,p.id,p.canonical_name AS name,
      p.photo_url AS photoUrl,p.family,p.given,c.party,c.status,c.incumbent
      FROM candidacy c JOIN person p ON p.id=c.person_id WHERE c.race_id IN (${marks})`)
      .bind(...ids).all<{ raceId: string; id: string; name: string; photoUrl: string | null;
        family: string | null; given: string | null; party: string | null; status: string; incumbent: number }>();
    for (const candidate of result.results) {
      const list = candidates.get(candidate.raceId) ?? [];
      list.push(candidate);
      candidates.set(candidate.raceId, list);
    }
  }
  return rows.map((row) => ({
    id: row.id,
    office: row.title,
    body: row.body,
    level: row.level,
    jurisdiction: row.jurisdiction,
    district: row.district,
    electionDate: row.date,
    electionType: row.type,
    status: row.status,
    ordering: "alphabetical-by-last-name",
    candidates: (candidates.get(row.id) ?? [])
      .sort((a, b) =>
        (a.family ?? a.name).localeCompare(b.family ?? b.name) ||
        (a.given ?? "").localeCompare(b.given ?? "") || a.name.localeCompare(b.name))
      .map(({ id, name, photoUrl, party, status, incumbent }) => ({
        id, name, photoUrl, party, status, incumbent: incumbent === 1,
      })),
  }));
}

async function raceDto(db: D1Database, row: RaceRow) {
  return (await raceDtos(db, [row]))[0];
}

async function listRaces(db: D1Database, url: URL): Promise<Response> {
  const state = url.searchParams.get("state");
  const office = url.searchParams.get("office");
  const year = url.searchParams.get("year");
  if (state && !/^[A-Za-z]{2}$/.test(state)) return json({ error: "invalid state" }, 400);
  if (year && !Number.isInteger(Number(year))) return json({ error: "invalid year" }, 400);
  const where: string[] = [];
  const args: Array<string | number> = [];
  if (state) { where.push("o.jurisdiction=?"); args.push(state.toUpperCase()); }
  if (office) {
    where.push("(LOWER(o.title) LIKE ? OR LOWER(o.body) LIKE ?)");
    args.push(`%${office.toLowerCase()}%`, `%${office.toLowerCase()}%`);
  }
  if (year) { where.push("substr(e.date,1,4)=?"); args.push(year); }
  const rows = await db.prepare(`${RACE_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY e.date DESC,o.jurisdiction,o.title LIMIT 2000`).bind(...args).all<RaceRow>();
  return json({ items: await raceDtos(db, rows.results) });
}

async function placePage(env: Env, origin: string, id: string): Promise<Response> {
  let stateCodes: string[] = [];
  if (id.startsWith("state:")) {
    stateCodes = [id.slice("state:".length).toUpperCase()];
  } else if (id.startsWith("zip:")) {
    const zip = id.slice("zip:".length);
    const shard = await searchAsset<Pick<SearchSnapshot, "places">>(env, origin, `/place-search-${zip[0]}.json`);
    const place = shard.places.find((candidate) => candidate.id === id);
    if (place) stateCodes = [place.state];
  } else {
    const fips = id.slice(id.indexOf(":") + 1, id.indexOf(":") + 3);
    const state = stateByFips(fips);
    if (state) stateCodes = [state.usps];
  }
  if (!stateCodes.length) return json({ error: "not found" }, 404);
  const packs = await Promise.all(stateCodes.map((state) =>
    searchAsset<PlaceDataAsset>(env, origin, `/place-data-${state}.json`)));
  const basePack = packs[0];
  const record = packs.map((pack) => pack.places[id]).find(Boolean);
  if (!record) return json({ error: "not found" }, 404);
  stateCodes = record.states;
  const finalPacks = stateCodes.length === packs.length ? packs : await Promise.all(stateCodes.map((state) =>
    searchAsset<PlaceDataAsset>(env, origin, `/place-data-${state}.json`)));
  const levelNames = ["federal", "state"] as const;
  const levels = levelNames.map((name) => {
    const matching = finalPacks.flatMap((pack) => pack.levels.filter((level) => level.level === name));
    const officials = new Map<string, unknown>();
    const races = new Map<string, unknown>();
    for (const level of matching) {
      for (const official of level.officials) officials.set(official.id, official);
      for (const race of level.races) races.set(race.id, race);
    }
    const values = [...officials.values()] as Array<{ body: string; district: string | null; name: string }>;
    values.sort((a, b) => a.body.localeCompare(b.body) ||
      (a.district ?? "").localeCompare(b.district ?? "", undefined, { numeric: true }) || a.name.localeCompare(b.name));
    const hasData = values.length > 0 || races.size > 0;
    return {
      level: name,
      state: name === "federal" || hasData ? "sourced" : "not_yet_checked",
      officials: values,
      races: [...races.values()],
      ...(matching.find((level) => level.note)?.note
        ? { note: matching.find((level) => level.note)?.note }
        : name === "state" && hasData ? { note: "Partial: only offices with an ingested source are listed." } : {}),
      ...(name === "state" && !hasData ? { gap: {
        reason: `No state-level data has been ingested for ${stateCodes.map((code) => stateByUsps(code)?.name ?? code).join(", ")} yet.`,
        sourcesChecked: [],
        officialSiteUrl: "https://www.usa.gov/state-governments",
      } } : {}),
    };
  });
  return json({
    place: record.place,
    ...(record.approximateNote ? { approximateNote: record.approximateNote } : {}),
    parents: record.parents,
    children: record.children,
    overlaps: record.overlaps,
    levels,
    completeness: {
      sectionsWithData: levels.filter((level) => level.state === "sourced" || level.state === "sourced_low").length,
      sectionsTotal: levels.length,
      rule: "Levels of government that have sourced data for this place, out of the levels that apply to it.",
    },
    states: stateCodes,
    lat: record.lat,
    lon: record.lon,
    countyFacts: record.countyFacts ?? null,
    provenance: record.provenance,
    ...(record.place.type === "state" ? {
      cityCount: basePack.cityCount,
      cityNote: "Search by city name to open a city page.",
    } : {}),
  });
}

async function governmentUnit(db: D1Database, id: string) {
  const unit = await db.prepare("SELECT * FROM gov_unit WHERE id=?").bind(id).first<Record<string, unknown>>();
  if (!unit) return null;
  const [officeResult, meetingResult] = await Promise.all([
    db.prepare("SELECT * FROM gov_office WHERE unit_id=? ORDER BY CASE role WHEN 'elected' THEN 0 WHEN 'appointed' THEN 1 WHEN 'ex_officio' THEN 2 ELSE 3 END,rowid")
      .bind(id).all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM gov_meeting WHERE unit_id=?").bind(id).all<Record<string, unknown>>(),
  ]);
  const offices = await Promise.all(officeResult.results.map(async (office) => {
    const [holders, source] = await Promise.all([
      db.prepare("SELECT * FROM gov_holder WHERE office_id=? ORDER BY seat,name")
        .bind(String(office.id)).all<Record<string, unknown>>(),
      db.prepare("SELECT name,url,grade,self_reported FROM source WHERE id=?")
        .bind(String(office.source_id)).first<{ name: string; url: string; grade: string | null; self_reported: number }>(),
    ]);
    return {
      id: office.id,
      title: office.title,
      role: office.role,
      selection: office.selection,
      appointing: office.appointing,
      termYears: office.term_years,
      termLimit: office.term_limit,
      seats: office.seats,
      nonpartisan: office.nonpartisan === null ? null : office.nonpartisan === 1,
      responsibilities: office.responsibilities,
      nextElection: office.next_election ? {
        date: office.next_election,
        basis: office.election_basis,
        rule: office.election_rule,
      } : null,
      sourceUrl: office.source_url,
      holders: holders.results.map((holder) => ({
        name: holder.name, personId: holder.person_id, seat: holder.seat, status: holder.status,
        startDate: holder.start_date, endDate: holder.end_date, email: holder.email, url: holder.url,
      })),
      provenance: {
        sourceId: office.source_id, sourceName: source?.name ?? String(office.source_id),
        sourceUrl: source?.url ?? "", asOf: office.as_of, grade: source?.grade ?? null,
        selfReported: source?.self_reported === 1,
      },
    };
  }));
  const unitSource = await db.prepare("SELECT name,url,grade,self_reported FROM source WHERE id=?")
    .bind(String(unit.source_id)).first<{ name: string; url: string; grade: string | null; self_reported: number }>();
  const meetings = meetingResult.results.map((meeting) => ({
    body: meeting.body, schedule: meeting.schedule, location: meeting.location, attend: meeting.attend,
    publicComment: meeting.public_comment, agendaUrl: meeting.agenda_url, minutesUrl: meeting.minutes_url,
    sourceUrl: meeting.source_url,
  }));
  const has = (predicate: (office: (typeof offices)[number]) => boolean) => offices.some(predicate);
  return {
    id: unit.id, kind: unit.kind, name: unit.name, state: unit.state, function: unit.function,
    form: unit.form, formBasis: unit.form_basis, predecessor: unit.predecessor, officialUrl: unit.official_url,
    provenance: {
      sourceId: unit.source_id, sourceName: unitSource?.name ?? String(unit.source_id),
      sourceUrl: unitSource?.url ?? "", asOf: unit.as_of, grade: unitSource?.grade ?? null,
      selfReported: unitSource?.self_reported === 1,
    },
    offices,
    meetings,
    completeness: [
      { item: "Structure and offices", state: offices.length ? "sourced" : "not_in_our_data",
        ...(offices.length ? {} : { note: "No published structure has been read for this unit." }) },
      { item: "Officeholders", state: has((office) => office.holders.length > 0) ? "sourced" : "not_in_our_data",
        ...(has((office) => office.holders.length > 0) ? {} : { note: "Holders were not available in a source we could read." }) },
      { item: "Terms", state: has((office) => office.termYears !== null) ? "sourced" : "not_in_our_data",
        ...(has((office) => office.termYears !== null) ? {} : { note: "Term lengths not stated in a source we read." }) },
      { item: "Next election dates", state: has((office) => office.nextElection !== null) ? "sourced" : "not_in_our_data",
        ...(has((office) => office.nextElection !== null) ? {} : { note: "No confirmed or rule-based date available." }) },
      { item: "Meeting schedule", state: meetings.length ? "sourced" : "not_in_our_data",
        ...(meetings.length ? {} : { note: "No meeting schedule read from an official source." }) },
      { item: "Agendas and minutes", state: meetings.some((meeting) => meeting.agendaUrl || meeting.minutesUrl) ? "sourced" : "not_in_our_data",
        ...(meetings.some((meeting) => meeting.agendaUrl || meeting.minutesUrl) ? {} : { note: "No agenda or minutes link recorded." }) },
      { item: "Recorded votes", state: "not_in_our_data", note: "Votes are shown only where a body publishes them in a retrievable record; none retrieved." },
    ],
  };
}

async function localGovernment(db: D1Database, id: string): Promise<Response> {
  const place = await getPlaceRow(db, id);
  if (!place) return json({ error: "not found" }, 404);
  const placeIds = [place.id];
  if (place.type === "zip") {
    const overlaps = await db.prepare("SELECT other_id AS id FROM place_overlap WHERE place_id=?")
      .bind(place.id).all<{ id: string }>();
    placeIds.push(...overlaps.results.map((row) => row.id));
  }
  const marks = placeIds.map(() => "?").join(",");
  const areas = await db.prepare(`SELECT DISTINCT unit_id AS id FROM gov_area WHERE place_id IN (${marks})`)
    .bind(...placeIds).all<{ id: string }>();
  const ids = areas.results.map((row) => row.id);
  let school: { state: "resolved" | "unavailable"; note: string } | null = null;
  if (place.type !== "state" && place.lat !== null && place.lon !== null) {
    school = { state: "unavailable", note: "The school district for this location could not be determined right now." };
    for (const layer of [0, 1, 2]) {
      try {
        const endpoint = new URL(`https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/School/MapServer/${layer}/query`);
        endpoint.search = new URLSearchParams({
          geometry: `${place.lon},${place.lat}`, geometryType: "esriGeometryPoint", inSR: "4326",
          spatialRel: "esriSpatialRelIntersects", outFields: "NAME,GEOID", returnGeometry: "false", f: "json",
        }).toString();
        const response = await fetch(endpoint, { signal: AbortSignal.timeout(6000) });
        if (!response.ok) break;
        const result = await response.json() as { features?: Array<{ attributes: { NAME: string; GEOID: string } }> };
        const district = result.features?.[0]?.attributes;
        if (!district) continue;
        const unitId = `sd:${district.GEOID}`;
        const unit = await db.prepare("SELECT id FROM gov_unit WHERE id=?").bind(unitId).first<{ id: string }>();
        if (unit) {
          ids.push(unit.id);
          school = {
            state: "resolved",
            note: place.type === "zip"
              ? "Matched using the center point of this ZIP area, so it may differ for addresses elsewhere in the ZIP. Confirm with your district."
              : "Matched using the center point of this place. Confirm with your district.",
          };
        }
        break;
      } catch {
        break;
      }
    }
  }
  const uniqueIds = [...new Set(ids)];
  const units = (await Promise.all(uniqueIds.map((unitId) => governmentUnit(db, unitId))))
    .filter((unit): unit is NonNullable<typeof unit> => unit !== null);
  const kinds = ["county", "city", "school_district", "special_district"] as const;
  const groups = kinds.map((kind) => ({ kind, units: units.filter((unit) => unit.kind === kind) }));
  return json({
    placeId: place.id,
    groups,
    school,
    notes: [
      "Only units known to apply to this place are shown. Not all special districts (ports, transit, water, fire and others) are published in our data yet.",
      "Officials hired by a government, such as a city administrator or superintendent, are not elected and are labelled as hired.",
    ],
  });
}

async function electionCalendar(db: D1Database, url: URL): Promise<Response> {
  const stateParam = url.searchParams.get("state");
  if (stateParam !== null && !/^[A-Za-z]{2}$/.test(stateParam)) {
    return json({ error: "state must be a 2-letter code" }, 400);
  }
  const state = stateParam?.toUpperCase();
  const elections = await db.prepare(`SELECT id,date,type,jurisdiction,source_id AS sourceId,as_of AS asOf
    FROM election ${state ? "WHERE jurisdiction=?" : ""} ORDER BY date,jurisdiction`)
    .bind(...(state ? [state] : [])).all<{ id: string; date: string; type: string; jurisdiction: string; sourceId: string; asOf: string }>();
  const windows = await db.prepare(`SELECT id,state,election_id AS electionId,kind,start_date AS startDate,
    end_date AS endDate,note,basis,url,source_id AS sourceId,as_of AS asOf
    FROM voting_window ${state ? "WHERE state=?" : ""} ORDER BY COALESCE(start_date,end_date),id`)
    .bind(...(state ? [state] : [])).all<{ id: number; state: string; electionId: string; kind: string; startDate: string | null;
      endDate: string | null; note: string; basis: string; url: string; sourceId: string; asOf: string }>();
  const contests = new Map<string, Array<{ raceId: string; office: string; level: string; candidates: number }>>();
  if (elections.results.length) {
    for (let offset = 0; offset < elections.results.length; offset += 80) {
      const batch = elections.results.slice(offset, offset + 80);
      const marks = batch.map(() => "?").join(",");
      const result = await db.prepare(`SELECT r.election_id AS electionId,r.id AS raceId,o.title AS office,
        o.level,COUNT(c.id) AS candidates FROM race r JOIN office o ON o.id=r.office_id
        LEFT JOIN candidacy c ON c.race_id=r.id WHERE r.election_id IN (${marks})
        GROUP BY r.id,o.title,o.level ORDER BY o.level,o.title`).bind(...batch.map((e) => e.id))
        .all<{ electionId: string; raceId: string; office: string; level: string; candidates: number }>();
      for (const contest of result.results) {
        const list = contests.get(contest.electionId) ?? [];
        list.push({ raceId: contest.raceId, office: contest.office, level: contest.level, candidates: contest.candidates });
        contests.set(contest.electionId, list);
      }
    }
  }
  const voting = state
    ? await db.prepare("SELECT name,official_url AS officialUrl,source_id AS sourceId,as_of AS asOf FROM state_voting WHERE state=?")
      .bind(state).first<{ name: string; officialUrl: string; sourceId: string; asOf: string }>()
    : null;
  const windowsByElection = new Map<string, typeof windows.results>();
  for (const window of windows.results) {
    const list = windowsByElection.get(window.electionId) ?? [];
    list.push(window);
    windowsByElection.set(window.electionId, list);
  }
  const items = elections.results.map((election) => ({
    ...election,
    label: "scheduled" as const,
    labelText: "Scheduled date (set by statute). This does not mean any particular contest or candidate is confirmed.",
    contests: (contests.get(election.id) ?? []).map((contest) => ({
      ...contest,
      label: contest.candidates > 0 ? "confirmed_contest" as const : "scheduled" as const,
      note: contest.candidates > 0 ? "Candidates as filed; the list may be incomplete." : "Candidate list not yet published here.",
    })),
    windows: windowsByElection.get(election.id) ?? [],
  }));
  const today = new Date().toISOString().slice(0, 10);
  const deadlineItems = ["Registration deadlines", "Early-voting and ballot-by-mail dates"];
  const notInOurData = windows.results.length
    ? ["Primary, runoff and special-election dates", "Ballot measures", "Local contests and your personal sample ballot",
      "Registration, mail-ballot and drop-box dates for states other than Oregon"]
    : [...deadlineItems, "Primary, runoff and special-election dates", "Ballot measures", "Local contests and your personal sample ballot"];
  return json({
    today,
    state: state ?? null,
    upcoming: items.filter((item) => item.date >= today),
    past: items.filter((item) => item.date < today),
    voterInfo: {
      stateOffice: voting ? { name: voting.name, url: voting.officialUrl, sourceId: voting.sourceId, asOf: voting.asOf } : null,
      registerUrl: "https://www.usa.gov/register-to-vote",
      personalBallot: "Your ballot depends on your address. Use your state's official voter-information and sample-ballot tools; Civic Lens does not generate a ballot.",
    },
    notInOurData,
    coverage: "Present: scheduled general-election dates, offices, and federal candidates from FEC filings. Absent: the items listed under 'Not in our data'. Confirm all deadlines with your state's official site.",
  });
}

function exclusionsPage(): Response {
  return json({
    items: [
      { category: "home-address", description: "Home addresses of officials and candidates", reason: "Safety: only official offices and campaign contact details are shown." },
      { category: "personal-contact", description: "Personal phone numbers and email addresses", reason: "Privacy and safety: only official or campaign contact is shown." },
      { category: "family-and-minors", description: "Information about minors or family members who are not themselves public figures", reason: "Privacy and child safety." },
      { category: "government-id", description: "Government identification numbers", reason: "Identity theft risk." },
      { category: "financial-account", description: "Bank or other financial account details", reason: "Fraud risk. Campaign finance totals from regulators are not affected." },
      { category: "health", description: "Health and medical details", reason: "Privacy." },
      { category: "unsupported-allegation", description: "Criminal allegations that do not come from a court or other legal record", reason: "Defamation risk. Court-record allegations may be shown with case status." },
    ],
    note: "Allegations that come from a court or other legal record may be shown, labeled with case status. Reported items are hidden until reviewed.",
  });
}

const router = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
      } });
    }
    try {
      if (url.pathname === "/health") {
        const result = await env.DB.prepare("SELECT 1 AS ok").first<{ok:number}>();
        return json({ ok: result?.ok === 1, database: "d1" });
      }
      if (request.method === "GET" && url.pathname === "/v1/search") {
        return await searchPeopleSnapshot(env, url);
      }
      if (request.method === "GET" && url.pathname === "/v1/places/search") {
        return await searchPlaces(env, url);
      }
      if (request.method === "GET" && url.pathname === "/v1/places") {
        return await searchAsset(env, url.origin, "/places.json").then((data) => json(data));
      }
      if (request.method === "GET" && url.pathname === "/v1/bills") {
        return await listBills(env, url);
      }
      const billMatch = url.pathname.match(/^\/v1\/bills\/(.+)$/);
      if (request.method === "GET" && billMatch) return await billDetails(env, url.origin, decodeURIComponent(billMatch[1]));
      if (request.method === "GET" && url.pathname === "/v1/races") {
        return await listRaceAssets(env, url.origin, url);
      }
      const raceMatch = url.pathname.match(/^\/v1\/races\/(.+)$/);
      if (request.method === "GET" && raceMatch) {
        const data = await searchAsset<{ items: RaceAsset[] }>(env, url.origin, "/races.json");
        const race = data.items.find((item) => item.id === decodeURIComponent(raceMatch[1]));
        return race ? json(race) : json({ error: "not found" }, 404);
      }
      if (request.method === "GET" && url.pathname === "/v1/rubric") {
        return json({
          version: RUBRIC_VERSION,
          criteria: CRITERIA,
          grades: GRADE_MEANING,
          scoring: "Each criterion scores 0, 1 or 2 (total 0-12). A: 10-12, B: 8-9, C: 5-7, D: 0-4. C and D are labeled lower credibility but still shown.",
          neutrality: "Grades use only properties of the publisher. They never depend on what a claim says or which viewpoint it supports.",
        });
      }
      if (request.method === "GET" && url.pathname === "/v1/exclusions") return exclusionsPage();
      if (request.method === "GET" && url.pathname === "/v1/calendar") {
        const state = url.searchParams.get("state");
        if (state !== null && !/^[A-Za-z]{2}$/.test(state)) return json({ error: "state must be a 2-letter code" }, 400);
        const data = await searchAsset<Record<string, { today: string; upcoming: Array<{ date: string }>; past: Array<{ date: string }> }>>(env, url.origin, "/calendars.json");
        const calendar = data[state?.toUpperCase() ?? "ALL"];
        if (!calendar) return json({ error: "not found" }, 404);
        const today = new Date().toISOString().slice(0, 10);
        const elections = [...calendar.past, ...calendar.upcoming].sort((a, b) => a.date.localeCompare(b.date));
        return json({
          ...calendar, today,
          upcoming: elections.filter((e) => e.date >= today),
          past: elections.filter((e) => e.date < today),
        });
      }
      if (request.method === "GET" && url.pathname === "/v1/sources") {
        return await searchAsset(env, url.origin, "/sources.json").then((data) => json(data));
      }
      const sourceMatch = url.pathname.match(/^\/v1\/sources\/(.+)$/);
      if (request.method === "GET" && sourceMatch) {
        const sourceId = decodeURIComponent(sourceMatch[1]);
        const data = await searchAsset<{ items: Array<{ id: string }> }>(env, url.origin, "/sources.json");
        const source = data.items.find((item) => item.id === sourceId);
        return source ? json(source) : json({ error: "not found" }, 404);
      }
      const placeLocalMatch = url.pathname.match(/^\/v1\/places\/(.+)\/local$/);
      if (request.method === "GET" && placeLocalMatch) {
        return await localGovernmentSnapshot(env, url.origin, decodeURIComponent(placeLocalMatch[1]));
      }
      const governmentMatch = url.pathname.match(/^\/v1\/government\/(.+)$/);
      if (request.method === "GET" && governmentMatch) {
        return await governmentSnapshot(env, url.origin, decodeURIComponent(governmentMatch[1]));
      }
      const placeMatch = url.pathname.match(/^\/v1\/places\/(.+)$/);
      if (request.method === "GET" && placeMatch && !placeMatch[1].endsWith("/local")) {
        return await placePage(env, url.origin, decodeURIComponent(placeMatch[1]));
      }
      const candidateMatch = url.pathname.match(/^\/v1\/candidates\/([0-9a-f-]{36})$/);
      if (request.method === "GET" && candidateMatch) {
        return await profileSnapshot(env, url.origin, candidateMatch[1], "candidates");
      }
      if (request.method === "GET" && url.pathname === "/v1/meta/freshness") {
        return await searchAsset(env, url.origin, "/freshness.json").then((data) => json(data));
      }
      if (request.method === "POST" && url.pathname === "/v1/reports") {
        const body = await request.json().catch(() => null) as { target?: unknown; kind?: unknown; note?: unknown } | null;
        if (!body || typeof body.target !== "string" || !body.target.trim() || body.target.length > 200 ||
          typeof body.note !== "string" || !body.note || body.note.length > 2000 ||
          typeof body.kind !== "string" || !["excluded-category", "factual-error", "rating"].includes(body.kind)) {
          return json({ error: "target, kind (excluded-category, factual-error, rating) and note are required" }, 400);
        }
        const target = reportTarget(body.target);
        if (body.kind === "excluded-category" && !target) return json({ error: "Provide an item ID or a supported page address." }, 400);
        const result = await env.DB.prepare(`INSERT INTO correction_report (target,kind,note,created_at)
          VALUES (?,?,?,?)`).bind(target ?? body.target, body.kind, body.note, new Date().toISOString()).run();
        if (!result.success) throw new Error("Could not save report");
        return json({ id: result.meta.last_row_id, status: "pending", hidden: body.kind === "excluded-category" }, 201);
      }
      const timelineMatch = url.pathname.match(/^\/v1\/people\/([0-9a-f-]{36})\/timeline$/);
      if (request.method === "GET" && timelineMatch) {
        return await profileSnapshot(env, url.origin, timelineMatch[1], "timelines");
      }
      const profileMatch = url.pathname.match(/^\/v1\/people\/([0-9a-f-]{36})$/);
      if (request.method === "GET" && profileMatch) {
        return await profileSnapshot(env, url.origin, profileMatch[1], "profiles");
      }
      return json({ error: "not found" }, 404);
    } catch (error) {
      console.error("D1 API request failed", error);
      const message = error instanceof Error ? error.message : String(error);
      if (/exceeded D1's free tier daily row read limit/i.test(message)) {
        return json({
          error: "Civic Lens data pages are temporarily unavailable because the service reached its daily data-read limit. Please try again after midnight UTC.",
          code: "daily_read_limit",
        }, 503);
      }
      return json({ error: "Search is temporarily unavailable. Please try again in a moment." }, 503);
    }
  },
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "GET" || !new URL(request.url).pathname.startsWith("/v1/")) {
      return router.fetch(request, env);
    }
    try {
      const reports = await env.DB.prepare(
        "SELECT target FROM correction_report WHERE status = 'pending' AND kind = 'excluded-category'",
      ).all<{ target: string }>();
      if (!reports.success) throw new Error("Could not load pending correction reports");
      const hidden = new Set(reports.results.map((r) => reportTarget(r.target)).filter((id): id is string => id !== null));
      const path = new URL(request.url).pathname;
      const id = path === "/v1/places/search" || path === "/v1/places/suggest" ? null : reportTarget(path);
      if (id && hidden.has(id)) return json({ error: "This item is hidden while a report is reviewed." }, 451);
      const response = await router.fetch(request, env);
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return response;
      return json(sanitize(await response.json(), hidden), response.status);
    } catch (error) {
      console.error("Could not enforce pending corrections", error);
      return json({ error: "Data is temporarily unavailable while corrections are checked." }, 503);
    }
  },
};
