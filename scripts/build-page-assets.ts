import { mkdir, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import {
  allPlaces, childPlaces, countyFacts, getBill, getGovUnit, getSource, listBills, listSources, openDb,
} from "@civic/db";
import { STATES } from "@civic/domain";
import { buildApp } from "../apps/api/src/app.ts";
import { buildPlacePage, ZIP_APPROXIMATE_NOTE } from "../apps/api/src/placePage.ts";
import { toPlaceSummary } from "../apps/api/src/placeSearch.ts";

async function main() {
  const root = resolve(process.cwd());
  const db = openDb(resolve(root, "data/civic.db"));
  const app = buildApp(db);
  try {
    const output = resolve(root, "apps/api/static");
    await mkdir(output, { recursive: true });
    const places = allPlaces(db);
    const factsByCounty = countyFacts(db);
    const placeById = new Map(places.map((place) => [place.id, place]));
    const sourceById = new Map(listSources(db).map((source) => [source.id, source]));
    const placesByState = new Map<string, typeof places>();
    for (const place of places) {
      const statePlaces = placesByState.get(place.state) ?? [];
      statePlaces.push(place);
      placesByState.set(place.state, statePlaces);
    }

    const overlapsByPlace = new Map<string, Array<{ place: ReturnType<typeof toPlaceSummary>; relation: string; share: number | null }>>();
    const overlapRows = db.prepare(`SELECT o.place_id AS placeId,o.relation,o.share,
      p.id,p.type,p.name,p.label,p.name_norm AS nameNorm,p.state,p.fips,p.lat,p.lon,p.parent_id AS parentId,
      p.approximate,p.source_id AS sourceId,p.as_of AS asOf
      FROM place_overlap o JOIN place p ON p.id=o.other_id ORDER BY o.share DESC,p.name_norm`)
      .all() as Array<{ placeId: string; relation: string; share: number | null } & (typeof places)[number]>;
    for (const overlap of overlapRows) {
      const rows = overlapsByPlace.get(overlap.placeId) ?? [];
      rows.push({ place: toPlaceSummary(overlap), relation: overlap.relation, share: overlap.share });
      overlapsByPlace.set(overlap.placeId, rows);
    }

    const placeWrites: Promise<void>[] = [];
    for (const state of STATES) {
      const statePlaces = placesByState.get(state.usps) ?? [];
      const stateRow = statePlaces.find((place) => place.id === `state:${state.usps}`);
      if (!stateRow) continue;
      const statePage = buildPlacePage(db, stateRow);
      const sources = new Map<string, ReturnType<typeof getSource>>();
      const records = Object.fromEntries(statePlaces.map((place) => {
        const source = sourceById.get(place.sourceId);
        if (source) sources.set(place.sourceId, source as ReturnType<typeof getSource>);
        const parent = place.parentId ? placeById.get(place.parentId) : null;
        const placeStates = new Set([place.state]);
        const overlaps = overlapsByPlace.get(place.id) ?? [];
        if (place.type === "zip") {
          for (const overlap of overlaps) {
            if (overlap.place.type === "county") placeStates.add(overlap.place.state);
          }
        }
        return [place.id, {
          place: toPlaceSummary(place),
          approximateNote: place.type === "zip" ? ZIP_APPROXIMATE_NOTE : undefined,
          parents: parent ? [toPlaceSummary(parent)] : [],
          children: place.type === "state"
            ? childPlaces(db, place.id, "county").map(toPlaceSummary)
            : [],
          overlaps,
          states: [...placeStates].sort(),
          lat: place.lat,
          lon: place.lon,
          countyFacts: factsByCounty.get(place.id) ?? null,
          provenance: (() => {
            const source = sources.get(place.sourceId);
            return source ? {
              sourceId: place.sourceId,
              sourceName: source.name,
              sourceUrl: source.url,
              asOf: place.asOf,
              grade: source.grade,
              selfReported: source.selfReported,
            } : null;
          })(),
        }];
      }));
      const cityCount = statePlaces.filter((place) => place.type === "city").length;
      const payload = {
        state: state.usps,
        levels: statePage.levels,
        cityCount,
        places: records,
      };
      placeWrites.push(writeFile(resolve(output, `place-data-${state.usps}.json`), JSON.stringify(payload)));
    }
    placeWrites.push(writeFile(resolve(output, "places.json"), JSON.stringify({
      items: places.filter((place) => place.type === "state").map(toPlaceSummary)
        .sort((a, b) => a.label.localeCompare(b.label)),
    })));
    await Promise.all(placeWrites);

    const areaRows = db.prepare("SELECT place_id AS placeId,unit_id AS unitId FROM gov_area")
      .all() as Array<{ placeId: string; unitId: string }>;
    const unitsByPlace = new Map<string, Set<string>>();
    for (const { placeId, unitId } of areaRows) {
      const ids = unitsByPlace.get(placeId) ?? new Set<string>();
      ids.add(unitId);
      unitsByPlace.set(placeId, ids);
    }
    const unitStates = new Map<string, string>();
    const allUnits = new Map<string, Exclude<ReturnType<typeof getGovUnit>, null>>();
    for (const { id } of db.prepare("SELECT id FROM gov_unit").all() as Array<{ id: string }>) {
      const unit = getGovUnit(db, id);
      if (unit) {
        unitStates.set(id, unit.state);
        allUnits.set(id, unit);
      }
    }
    const localWrites: Promise<void>[] = [];
    for (const state of STATES) {
      const localPlaces: Record<string, string[]> = {};
      const unitIds = new Set([...allUnits]
        .filter(([, unit]) => unit.state === state.usps)
        .map(([id]) => id));
      for (const place of places) {
        const applicableStates = new Set([place.state]);
        const overlaps = overlapsByPlace.get(place.id) ?? [];
        if (place.type === "zip") {
          for (const overlap of overlaps) {
            if (overlap.place.type === "county") applicableStates.add(overlap.place.state);
          }
        }
        if (!applicableStates.has(state.usps)) continue;
        const ids = new Set(unitsByPlace.get(place.id) ?? []);
        if (place.type === "zip") {
          for (const overlap of overlaps) {
            for (const unitId of unitsByPlace.get(overlap.place.id) ?? []) ids.add(unitId);
          }
        }
        localPlaces[place.id] = [...ids];
        for (const unitId of ids) unitIds.add(unitId);
      }
      const units = Object.fromEntries([...unitIds].flatMap((id) => {
        const unit = allUnits.get(id);
        return unit ? [[id, unit]] : [];
      }));
      localWrites.push(writeFile(
        resolve(output, `local-data-${state.usps}.json.gz`),
        gzipSync(JSON.stringify({ state: state.usps, places: localPlaces, units })),
      ));
    }
    await Promise.all(localWrites);
    await writeFile(resolve(output, "government-index.json"), JSON.stringify({
      states: Object.fromEntries(unitStates),
    }));

    const bills = [];
    for (let offset = 0; ; offset += 100) {
      const page = listBills(db, { limit: 100, offset });
      bills.push(...page.items.map((bill) => getBill(db, bill.id)).filter((bill) => bill !== null));
      if (offset + page.items.length >= page.total || page.items.length === 0) break;
    }
    await writeFile(resolve(output, "bills.json"), JSON.stringify({ items: bills }));

    const people = db.prepare("SELECT id FROM person ORDER BY id").all() as Array<{ id: string }>;
    const peopleByShard = new Map<string, string[]>();
    for (const { id } of people) {
      const shard = id.slice(0, 2);
      const ids = peopleByShard.get(shard) ?? [];
      ids.push(id);
      peopleByShard.set(shard, ids);
    }
    const candidateIds = db.prepare("SELECT DISTINCT person_id AS id FROM candidacy").all() as Array<{ id: string }>;
    const candidatesByShard = new Map<string, string[]>();
    for (const { id } of candidateIds) {
      const shard = id.slice(0, 2);
      const ids = candidatesByShard.get(shard) ?? [];
      ids.push(id);
      candidatesByShard.set(shard, ids);
    }
    let profileCount = 0;
    for (const [shard, ids] of peopleByShard) {
      const profiles: Record<string, unknown> = {};
      const candidates: Record<string, unknown> = {};
      const timelines: Record<string, unknown> = {};
      for (const id of ids) {
        const profile = await app.inject({ method: "GET", url: `/v1/people/${id}` });
        if (profile.statusCode === 200) profiles[id] = profile.json();
        const timeline = await app.inject({ method: "GET", url: `/v1/people/${id}/timeline` });
        if (timeline.statusCode === 200) timelines[id] = timeline.json();
      }
      for (const id of candidatesByShard.get(shard) ?? []) {
        const candidate = await app.inject({ method: "GET", url: `/v1/candidates/${id}` });
        if (candidate.statusCode === 200) candidates[id] = candidate.json();
      }
      profileCount += Object.keys(profiles).length;
      const payload = JSON.stringify({ profiles, candidates, timelines });
      await writeFile(resolve(output, `profile-data-${shard}.json.gz`), gzipSync(payload));
    }

    const freshness = db.prepare("SELECT MAX(retrieved_at) AS value FROM source").get() as { value: string | null };
    await writeFile(resolve(output, "freshness.json"), JSON.stringify({ lastUpdated: freshness.value }));

    const races = await app.inject({ method: "GET", url: "/v1/races" });
    if (races.statusCode !== 200) throw new Error(`Could not build race snapshot: HTTP ${races.statusCode}`);
    await writeFile(resolve(output, "races.json"), races.body);
    const calendars: Record<string, unknown> = {};
    for (const state of STATES) {
      const calendar = await app.inject({ method: "GET", url: `/v1/calendar?state=${state.usps}` });
      if (calendar.statusCode !== 200) throw new Error(`Could not build ${state.usps} election calendar: HTTP ${calendar.statusCode}`);
      calendars[state.usps] = calendar.json();
    }
    const allCalendar = await app.inject({ method: "GET", url: "/v1/calendar" });
    if (allCalendar.statusCode !== 200) throw new Error(`Could not build election calendar: HTTP ${allCalendar.statusCode}`);
    calendars.ALL = allCalendar.json();
    await writeFile(resolve(output, "calendars.json"), JSON.stringify(calendars));
    console.log(`Built ${placeWrites.length} place snapshots, ${localWrites.length} local-government snapshots, ${bills.length} bills, ${profileCount} profiles, and election/race snapshots`);
  } finally {
    await app.close();
    db.close();
  }
}

main().catch((error: unknown) => {
  console.error("Could not build page data assets", error);
  process.exitCode = 1;
});
