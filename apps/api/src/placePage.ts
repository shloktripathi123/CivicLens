import {
  childPlaces, countPlaces, getPlaceRow, getSource, listSources, listRaces, overlapsOf, sittingOfficials, type DB, type PlaceRow, type RaceDto,
} from "@civic/db";
import { stateByUsps, type PlaceSummary } from "@civic/domain";
import { toPlaceSummary } from "./placeSearch.ts";
import { narrowOfficials, type Districts } from "./districts.ts";

export type SectionState = "sourced" | "sourced_low" | "not_found" | "not_yet_checked";

export interface Level {
  level: "federal" | "state" | "county" | "city";
  state: SectionState;
  officials: unknown[];
  races: RaceDto[];
  note?: string;
  gap?: { reason: string; sourcesChecked: string[]; officialSiteUrl: string };
}

const SITES = {
  state: "https://www.usa.gov/state-governments",
  local: "https://www.usa.gov/local-governments",
};

const ZIP_NOTE =
  "ZIP codes are mail-delivery routes, not legal boundaries. This page uses the Census Bureau's ZIP Code Tabulation Area " +
  "(ZCTA), which approximates a ZIP code. A ZIP can overlap several counties, cities and districts, so every overlap is listed.";

export function buildPlacePage(db: DB, place: PlaceRow, summary: (p: PlaceRow) => PlaceSummary = toPlaceSummary, districts?: Districts | null) {
  const overlaps = overlapsOf(db, place.id);
  const states = new Set<string>([place.state]);
  if (place.type === "zip") {
    for (const o of overlaps) if (o.place.type === "county") states.add(o.place.state);
  }
  const stateList = [...states].sort();
  const stateName = stateList.map((s) => stateByUsps(s)?.name ?? s).join(", ");

  const parents: PlaceSummary[] = [];
  let children: PlaceSummary[] = [];
  let extra: Record<string, unknown> = {};
  if (place.type !== "state") {
    const st = getPlaceRow(db, `state:${place.state}`);
    if (st) parents.push(summary(st));
  }
  if (place.type === "state") {
    children = childPlaces(db, place.id, "county").map(summary);
    extra = { cityCount: countPlaces(db, place.state, "city"), cityNote: "Search by city name to open a city page." };
  }

  const races = listRaces(db, {}).filter((r) => stateList.includes(r.jurisdiction));
  const fed = narrowOfficials(sittingOfficials(db, "federal", stateList) as any[], districts, "federal");
  const federal: Level = {
    level: "federal",
    state: "sourced",
    officials: fed.items,
    races: races.filter((r) => r.level === "federal"),
    note: fed.narrowed
      ? "Your U.S. senators and the U.S. representative for the district at this ZIP's center point (Census Bureau geocoder). A ZIP can cross district lines, so check the official lookup if you live near an edge. Candidate lists come from FEC filings ingested so far and may be incomplete."
      : "Shown for the whole state. Matching a place to a specific congressional district is not resolved for this place. Candidate lists come from FEC filings ingested so far and may be incomplete.",
  };
  const st = narrowOfficials(sittingOfficials(db, "state", stateList) as any[], districts, "state");
  const stateOfficials = st.items;
  const stateRaces = races.filter((r) => r.level === "state");
  const stateLevel: Level = {
    level: "state",
    state: stateOfficials.length || stateRaces.length ? "sourced" : "not_yet_checked",
    officials: stateOfficials,
    races: stateRaces,
    note: stateOfficials.length || stateRaces.length ? (st.narrowed ? "Statewide offices plus the state senator and representative for the district at this ZIP's center point (Census Bureau geocoder). A ZIP can cross district lines." : "Partial: only offices with an ingested source are listed.") : undefined,
    gap: stateOfficials.length || stateRaces.length ? undefined : {
      reason: `No state-level data has been ingested for ${stateName} yet.`,
      sourcesChecked: [], officialSiteUrl: SITES.state,
    },
  };
  const levels: Level[] = [federal, stateLevel];
  // County and city officials are shown by the local-government block (gov_unit data), not as empty levels here.

  const withData = levels.filter((l) => l.state === "sourced" || l.state === "sourced_low").length;
  const src = getSource(db, place.sourceId);
  return {
    place: summary(place),
    approximateNote: place.type === "zip" ? ZIP_NOTE : undefined,
    parents,
    children,
    overlaps: overlaps.map((o) => ({ place: summary(o.place), relation: o.relation, share: o.share })),
    levels,
    completeness: {
      sectionsWithData: withData,
      sectionsTotal: levels.length,
      rule: "Levels of government that have sourced data for this place, out of the levels that apply to it.",
    },
    states: stateList,
    lat: place.lat, lon: place.lon,
    provenance: src ? provenanceOf(db, src.id, place.asOf) : null,
    ...extra,
  };
}

function provenanceOf(db: DB, id: string, asOf: string) {
  const s = listSources(db).find((x) => x.id === id)!;
  return { sourceId: s.id, sourceName: s.name, sourceUrl: s.url, asOf, grade: s.grade, selfReported: s.selfReported };
}
