import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { getBill, listBills, freshness, getCandidate, getProfile, getDeepProfile, getRace, listRaces, getSummaries, getTimeline, openDb, type DB } from "@civic/db";
import { SearchIndex } from "./search.ts";
import { PlaceIndex, toPlaceSummary } from "./placeSearch.ts";
import { buildCalendar } from "./calendar.ts";
import { buildLocal } from "./localGov.ts";
import { getGovUnit } from "@civic/db";
import { buildPlacePage } from "./placePage.ts";
import { districtsAt } from "./districts.ts";
import { getPlaceRow, listSources, getSourceRecord, addReport, conflictsFor, linkStatus, hiddenTargets } from "@civic/db";
import { EXCLUSIONS, reportTarget, sanitize } from "./exclusions.ts";
import { BILL_STATUSES, isZip, RUBRIC_VERSION, CRITERIA, GRADE_MEANING, type PlaceType } from "@civic/domain";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const OFFICE_TYPES = ["president", "vice_president", "cabinet", "senate", "house", "governor", "judge", "other"];

export function buildApp(db: DB = openDb()) {
  const app = Fastify({ logger: false });
  const index = new SearchIndex(db);
  const hidden = () => new Set([...hiddenTargets(db)].map(reportTarget).filter((id): id is string => id !== null));

  // Every JSON response passes through the exclusion filter (FR-025) and drops items hidden pending a report (FR-026).
  app.addHook("preHandler", async (req, reply) => {
    const id = (req.params as { id?: string } | undefined)?.id;
    if (id && hidden().has(id)) return reply.code(451).send({ error: "This item is hidden while a report is reviewed." });
  });
  app.addHook("onSend", async (_req, reply, payload) => {
    if (typeof payload !== "string" || !String(reply.getHeader("content-type") ?? "").includes("application/json")) return payload;
    return JSON.stringify(sanitize(JSON.parse(payload), hidden()));
  });
  const places = new PlaceIndex(db);
  const suggestCache = new Map<string, unknown>();

  app.register(cors, { origin: true });
  app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

  app.get("/health", async () => ({ ok: true }));

  app.get<{ Querystring: Record<string, string> }>("/v1/search", async (req, reply) => {
    const { q, level, body, state, status, party, year, limit, cursor, role, election_year, office_type } = req.query;
    if (!q || !q.trim()) return reply.code(400).send({ error: "q is required" });
    if (status && !["current", "former", "candidate"].includes(status)) return reply.code(400).send({ error: "invalid status" });
    const yearNum = year ? Number(year) : undefined;
    if (year && !Number.isInteger(yearNum)) return reply.code(400).send({ error: "invalid year" });

    if (role && role !== "candidate" && role !== "official") return reply.code(400).send({ error: "invalid role" });
    if (office_type && !OFFICE_TYPES.includes(office_type)) return reply.code(400).send({ error: "invalid office_type" });
    const eyNum = election_year ? Number(election_year) : undefined;
    if (election_year && !Number.isInteger(eyNum)) return reply.code(400).send({ error: "invalid election_year" });

    const hits = index.search(q, { level, body, state, status, party, year: yearNum, role, electionYear: eyNum, officeType: office_type });
    const size = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const offset = cursor ? Number(Buffer.from(cursor, "base64url").toString()) || 0 : 0;
    const page = hits.slice(offset, offset + size);
    const next = offset + size < hits.length ? Buffer.from(String(offset + size)).toString("base64url") : null;
    return { results: getSummaries(db, page.map((h) => h.id)), nextCursor: next, total: hits.length };
  });

  app.get<{ Querystring: { q?: string } }>("/v1/suggest", async (req, reply) => {
    const q = (req.query.q ?? "").trim();
    if (!q) return reply.code(400).send({ error: "q is required" });
    const key = q.toLowerCase();
    const cached = suggestCache.get(key);
    if (cached) return cached;
    const out = getSummaries(db, index.search(q).slice(0, 8).map((h) => h.id));
    if (suggestCache.size > 5000) suggestCache.clear();
    suggestCache.set(key, out);
    return out;
  });

  app.get<{ Params: { id: string } }>("/v1/people/:id", async (req, reply) => {
    if (!UUID.test(req.params.id)) return reply.code(404).send({ error: "not found" });
    const profile = getProfile(db, req.params.id);
    return profile ? { ...profile, deep: getDeepProfile(db, req.params.id), conflicts: conflictsFor(db, req.params.id) } : reply.code(404).send({ error: "not found" });
  });

  app.get<{ Params: { id: string } }>("/v1/people/:id/timeline", async (req, reply) => {
    if (!UUID.test(req.params.id)) return reply.code(404).send({ error: "not found" });
    const t = getTimeline(db, req.params.id);
    return t.length ? t : reply.code(404).send({ error: "not found" });
  });

  app.get<{ Params: { id: string } }>("/v1/candidates/:id", async (req, reply) => {
    if (!UUID.test(req.params.id)) return reply.code(404).send({ error: "not found" });
    const c = getCandidate(db, req.params.id);
    return c ? { ...c, conflicts: conflictsFor(db, req.params.id) } : reply.code(404).send({ error: "not found" });
  });

  app.get<{ Querystring: { jurisdiction?: string; status?: string; q?: string; limit?: string; offset?: string } }>("/v1/bills", async (req, reply) => {
    const { jurisdiction, status, q, limit, offset } = req.query;
    if (jurisdiction && !/^[A-Za-z]{2}$/.test(jurisdiction)) return reply.code(400).send({ error: "invalid jurisdiction" });
    if (status && !(BILL_STATUSES as readonly string[]).includes(status)) return reply.code(400).send({ error: "invalid status" });
    const lim = limit ? Number(limit) : 25; const off = offset ? Number(offset) : 0;
    if (!Number.isInteger(lim) || lim < 1 || !Number.isInteger(off) || off < 0) return reply.code(400).send({ error: "invalid paging" });
    return listBills(db, { jurisdiction, status, q: q?.slice(0, 100), limit: lim, offset: off });
  });

  app.get<{ Params: { id: string } }>("/v1/bills/:id", async (req, reply) => {
    return getBill(db, req.params.id) ?? reply.code(404).send({ error: "not found" });
  });

  app.get<{ Querystring: { state?: string; office?: string; year?: string } }>("/v1/races", async (req, reply) => {
    const { state, office, year } = req.query;
    const yearNum = year ? Number(year) : undefined;
    if (year && !Number.isInteger(yearNum)) return reply.code(400).send({ error: "invalid year" });
    if (state && !/^[A-Za-z]{2}$/.test(state)) return reply.code(400).send({ error: "invalid state" });
    return { items: listRaces(db, { state, office, year: yearNum }) };
  });

  app.get<{ Params: { id: string } }>("/v1/races/:id", async (req, reply) => {
    return getRace(db, req.params.id) ?? reply.code(404).send({ error: "not found" });
  });

  const PLACE_TYPES = ["state", "county", "city", "zip"];

  app.get<{ Querystring: { q?: string } }>("/v1/places/suggest", async (req, reply) => {
    const q = (req.query.q ?? "").trim();
    if (!q) return reply.code(400).send({ error: "q is required" });
    return places.search(q).slice(0, 8).map((h) => toPlaceSummary(h.place));
  });

  app.get<{ Querystring: { q?: string; type?: string; state?: string; limit?: string } }>("/v1/places/search", async (req, reply) => {
    const { q, type, state, limit } = req.query;
    if (!q || !q.trim()) return reply.code(400).send({ error: "q is required" });
    if (type && !PLACE_TYPES.includes(type)) return reply.code(400).send({ error: "invalid type" });
    if (state && !/^[A-Za-z]{2}$/.test(state)) return reply.code(400).send({ error: "invalid state" });
    const hits = places.search(q, { type: type as PlaceType | undefined, state });
    const size = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return { results: hits.slice(0, size).map((h) => toPlaceSummary(h.place)), total: hits.length };
  });

  app.get("/v1/rubric", async () => ({
    version: RUBRIC_VERSION, criteria: CRITERIA, grades: GRADE_MEANING,
    scoring: "Each criterion scores 0, 1 or 2 (total 0-12). A: 10-12, B: 8-9, C: 5-7, D: 0-4. C and D are labeled lower credibility but still shown.",
    neutrality: "Grades use only properties of the publisher. They never depend on what a claim says or which viewpoint it supports.",
  }));

  const withLink = <T extends { url: string }>(s: T) => ({ ...s, link: linkStatus(db, s.url) });

  app.get("/v1/sources", async () => ({ items: listSources(db).map(withLink) }));

  app.get<{ Params: { id: string } }>("/v1/sources/:id", async (req, reply) => {
    const s = getSourceRecord(db, req.params.id);
    return s ? withLink(s) : reply.code(404).send({ error: "not found" });
  });

  app.get("/v1/exclusions", async () => ({
    items: EXCLUSIONS.map(({ category, description, reason }) => ({ category, description, reason })),
    note: "Allegations that come from a court or other legal record may be shown, labeled with case status. Reported items are hidden until reviewed.",
  }));

  app.post<{ Body: { target?: string; kind?: string; note?: string } }>("/v1/reports", async (req, reply) => {
    const { target, kind, note } = req.body ?? {};
    if (!target?.trim() || target.length > 200 || !note || note.length > 2000 || !["excluded-category", "factual-error", "rating"].includes(kind ?? "")) {
      return reply.code(400).send({ error: "target, kind (excluded-category, factual-error, rating) and note are required" });
    }
    const normalized = reportTarget(target);
    if (kind === "excluded-category" && !normalized) return reply.code(400).send({ error: "Provide an item ID or a supported page address." });
    const id = addReport(db, { target: normalized ?? target, kind: kind!, note });
    return reply.code(201).send({ id, status: "pending", hidden: kind === "excluded-category" });
  });

  app.get("/v1/places", async () => ({
    items: places.listStates().map(toPlaceSummary),
  }));

  app.get<{ Params: { id: string } }>("/v1/places/:id", async (req, reply) => {
    const row = getPlaceRow(db, req.params.id);
    if (!row) return reply.code(404).send({ error: "not found" });
    return buildPlacePage(db, row, undefined, row.type === "zip" && row.lat != null && row.lon != null ? await districtsAt(row.lat, row.lon) : null);
  });

  app.get<{ Params: { id: string } }>("/v1/places/:id/local", async (req, reply) => {
    const row = getPlaceRow(db, req.params.id);
    return row ? buildLocal(db, row) : reply.code(404).send({ error: "not found" });
  });

  app.get<{ Params: { id: string } }>("/v1/government/:id", async (req, reply) => {
    const u = getGovUnit(db, req.params.id);
    return u ?? reply.code(404).send({ error: "not found" });
  });

  app.get<{ Params: { zip: string } }>("/v1/zip/:zip", async (req, reply) => {
    if (!isZip(req.params.zip)) return reply.code(404).send({ error: "not found" });
    const row = getPlaceRow(db, `zip:${req.params.zip}`);
    if (!row) return reply.code(404).send({ error: "not found" });
    return buildPlacePage(db, row, undefined, row.lat != null && row.lon != null ? await districtsAt(row.lat, row.lon) : null);
  });

  app.get<{ Querystring: { state?: string } }>("/v1/calendar", async (req, reply) => {
    const st = req.query.state;
    if (st !== undefined && !/^[A-Za-z]{2}$/.test(st)) return reply.code(400).send({ error: "state must be a 2-letter code" });
    return buildCalendar(db, st);
  });

  app.get("/v1/meta/freshness", async () => freshness(db));

  return app;
}
