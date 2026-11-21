import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import worker from "./worker.ts";

const bill = {
  id: "or-2025-sb-23",
  jurisdiction: "OR",
  session: "2025",
  number: "SB 23",
  title: "Test measure",
  summary: "A test bill.",
  status: "enacted",
  status_detail: "Signed by the governor",
  is_law: 1,
  chapter: "1",
  url: "https://olis.oregonlegislature.gov/liz/2025R1/Measures/Overview/SB23",
  text_url: null,
  introduced_on: "2025-01-01",
  source_id: "oregon-legislature",
  as_of: "2025-01-01",
  source_name: "Oregon Legislature",
  source_url: "https://www.oregonlegislature.gov/",
  grade: "A",
  self_reported: 0,
};

const city = {
  id: "city:2507000",
  type: "city",
  name: "Boston",
  label: "Boston city",
  name_norm: "boston",
  state: "MA",
  fips: "2507000",
  lat: 42.36,
  lon: -71.06,
  parent_id: "state:MA",
  approximate: 0,
  source_id: "census-geography",
  as_of: "2025-01-01",
};

const personId = "73c63fc6-1885-579c-bfb0-8b2a651a6767";
const race = {
  id: "race:OR:2026-general:senate",
  office: "U.S. Senator",
  body: "U.S. Senate",
  level: "federal",
  jurisdiction: "OR",
  district: null,
  electionDate: "2026-11-03",
  electionType: "general",
  status: "confirmed",
  ordering: "alphabetical-by-last-name",
  candidates: [],
};
const personProfile = { person: { id: personId, name: "Ron Wyden" }, terms: [] };
const governmentUnit = {
  id: "gu:county:MA:25025",
  kind: "county",
  name: "Suffolk County",
  state: "MA",
  offices: [],
};
const personTimeline = [{ title: "Senator", body: "U.S. Senate" }];

function mockEnv() {
  const db = {
    prepare(sql: string) {
      let params: Array<string | number | null> = [];
      return {
        bind(...values: Array<string | number | null>) { params = values; return this; },
        async all<T>() {
          if (sql.includes("FROM bill b")) return { results: [bill] as T[], success: true };
          if (sql.includes("FROM place WHERE id=?") && params[0] === "state:MA") {
            return { results: [{ ...city, id: "state:MA", type: "state", name: "Massachusetts", label: "Massachusetts",
              name_norm: "massachusetts", fips: "25", parent_id: null }] as T[], success: true };
          }
          return { results: [] as T[], success: true };
        },
        async first<T>() {
          if (sql.includes("COUNT(*) AS n FROM bill")) return { n: 1 } as T;
          if (sql.includes("FROM bill b") && params[0] === bill.id) return bill as T;
          if (sql.includes("FROM place WHERE id=?")) {
            return (params[0] === city.id ? city : params[0] === "state:MA"
              ? { ...city, id: "state:MA", type: "state", name: "Massachusetts", label: "Massachusetts",
                name_norm: "massachusetts", fips: "25", parent_id: null }
              : null) as T | null;
          }
          if (sql.includes("FROM source WHERE id=?")) {
            return { name: "U.S. Census Bureau", url: "https://www.census.gov/", grade: "A", self_reported: 0 } as T;
          }
          return null;
        },
        async run() { return { success: true, meta: { last_row_id: 1 } }; },
      };
    },
  };
  return {
    DB: db,
    ASSETS: {
      async fetch(request: Request) {
        const path = new URL(request.url).pathname;
        if (path.endsWith("/bills.json")) return Response.json({ items: [{
          id: bill.id, jurisdiction: bill.jurisdiction, session: bill.session, number: bill.number,
          title: bill.title, summary: bill.summary, status: bill.status, statusDetail: bill.status_detail,
          isLaw: true, chapter: bill.chapter, url: bill.url, textUrl: bill.text_url, introducedOn: bill.introduced_on,
          provenance: { sourceId: bill.source_id, sourceName: bill.source_name, sourceUrl: bill.source_url,
            asOf: bill.as_of, grade: bill.grade, selfReported: false },
          sponsors: [{ name: "Test Sponsor", role: "primary" }],
          actions: [{ date: "2025-01-02", chamber: "H", text: "Introduced" }],
        }] });
        if (path.endsWith("/place-data-MA.json")) return Response.json({
          state: "MA",
          levels: [
            { level: "federal", state: "sourced", officials: [], races: [] },
            { level: "state", state: "not_yet_checked", officials: [], races: [] },
          ],
          cityCount: 1,
          places: {
            [city.id]: {
              place: { id: city.id, type: city.type, name: city.name, label: city.label,
                state: "MA", stateName: "Massachusetts", approximate: false },
              parents: [], children: [], overlaps: [], states: ["MA"], lat: null, lon: null,
              provenance: null,
            },
          },
        });
        if (path.endsWith("/places.json")) return Response.json({ items: [] });
        if (path.endsWith("/freshness.json")) return Response.json({ lastUpdated: "2025-01-01" });
        if (path.endsWith("/races.json")) return Response.json({ items: [race] });
        if (path.endsWith("/calendars.json")) return Response.json({ OR: { state: "OR", elections: [] }, ALL: { elections: [] } });
        if (path.endsWith("/government-index.json")) {
          return Response.json({ states: { [governmentUnit.id]: "MA" } });
        }
        if (path.endsWith("/local-data-MA.json.gz")) {
          return new Response(gzipSync(Buffer.from(JSON.stringify({
            state: "MA",
            places: { [city.id]: [governmentUnit.id] },
            units: { [governmentUnit.id]: governmentUnit },
          }))));
        }
        if (path.endsWith(`/profile-data-${personId.slice(0, 2)}.json.gz`)) {
          return new Response(gzipSync(Buffer.from(JSON.stringify({
            profiles: { [personId]: personProfile },
            candidates: {},
            timelines: { [personId]: personTimeline },
          }))));
        }
        return new Response("{}", { status: 404 });
      },
    },
  } as never;
}

async function get(path: string) {
  return worker.fetch(new Request(`https://civic-lens-api.test${path}`), mockEnv());
}

test("Cloudflare API serves bill list and detail pages from shared static data", async () => {
  const list = await get("/v1/bills?jurisdiction=OR&limit=1");
  assert.equal(list.status, 200);
  const data = await list.json() as { total: number; items: Array<{ id: string; isLaw: boolean; provenance: { sourceUrl: string } }> };
  assert.equal(data.total, 1);
  assert.equal(data.items[0].id, bill.id);
  assert.equal(data.items[0].isLaw, true);
  assert.equal(data.items[0].provenance.sourceUrl, bill.source_url);

  const detail = await get(`/v1/bills/${bill.id}`);
  assert.equal(detail.status, 200);
  assert.equal((await detail.json() as { id: string }).id, bill.id);
});

test("Cloudflare API serves a location detail page with explicit government levels", async () => {
  const response = await get(`/v1/places/${encodeURIComponent(city.id)}`);
  assert.equal(response.status, 200);
  const page = await response.json() as {
    place: { id: string; label: string };
    levels: Array<{ level: string; state: string; officials: unknown[] }>;
    completeness: { sectionsTotal: number };
  };
  assert.equal(page.place.id, city.id);
  assert.equal(page.place.label, "Boston city");
  assert.deepEqual(page.levels.map((level) => level.level), ["federal", "state"]);
  assert.equal(page.completeness.sectionsTotal, 2);
});

test("Cloudflare API validates bill, race, and calendar filters", async () => {
  assert.equal((await get("/v1/bills?status=unknown")).status, 400);
  assert.equal((await get("/v1/races?state=invalid")).status, 400);
  assert.equal((await get("/v1/calendar?state=invalid")).status, 400);
});

test("Cloudflare API serves profiles, races, and election calendars from static snapshots", async () => {
  const profile = await get(`/v1/people/${personId}`);
  assert.equal(profile.status, 200);
  assert.deepEqual(await profile.json(), personProfile);
  const timeline = await get(`/v1/people/${personId}/timeline`);
  assert.equal(timeline.status, 200);
  assert.deepEqual(await timeline.json(), personTimeline);

  const raceList = await get("/v1/races?state=OR&year=2026");
  assert.equal(raceList.status, 200);
  assert.deepEqual((await raceList.json() as { items: unknown[] }).items, [race]);

  const raceDetail = await get(`/v1/races/${encodeURIComponent(race.id)}`);
  assert.equal(raceDetail.status, 200);
  assert.deepEqual(await raceDetail.json(), race);

  const calendar = await get("/v1/calendar?state=OR");
  assert.equal(calendar.status, 200);
  assert.deepEqual(await calendar.json(), { state: "OR", elections: [] });
  const freshness = await get("/v1/meta/freshness");
  assert.equal(freshness.status, 200);
  assert.deepEqual(await freshness.json(), { lastUpdated: "2025-01-01" });
});

test("Cloudflare API serves local-government links and details from static snapshots", async () => {
  const local = await get(`/v1/places/${encodeURIComponent(city.id)}/local`);
  assert.equal(local.status, 200);
  const localData = await local.json() as { groups: Array<{ kind: string; units: Array<{ id: string }> }> };
  assert.deepEqual(localData.groups.find((group) => group.kind === "county")?.units.map((unit) => unit.id), [governmentUnit.id]);

  const unit = await get(`/v1/government/${encodeURIComponent(governmentUnit.id)}`);
  assert.equal(unit.status, 200);
  assert.deepEqual(await unit.json(), governmentUnit);
});
