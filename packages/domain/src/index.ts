import { createHash } from "node:crypto";

export type Status = "current" | "former" | "candidate";

export type CandidacyStatus = "filed" | "qualified" | "withdrawn" | "won" | "lost";

const TRANSITIONS: Record<CandidacyStatus, CandidacyStatus[]> = {
  filed: ["qualified", "withdrawn", "won", "lost"],
  qualified: ["withdrawn", "won", "lost"],
  withdrawn: [],
  won: [],
  lost: [],
};

export function canTransition(from: CandidacyStatus, to: CandidacyStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export interface CandidacyInfo {
  office: string;
  jurisdiction: string;
  electionYear: number;
  electionDate: string;
  party: string | null;
  status: CandidacyStatus;
  incumbent: boolean;
  raceId: string;
}

export interface Provenance {
  sourceId?: string;
  grade?: string | null;
  selfReported?: boolean;
  sourceName: string;
  sourceUrl: string;
  asOf: string;
}

export interface PersonSummary {
  id: string;
  name: string;
  photoUrl: string | null;
  status: Status;
  level: string;
  body: string;
  party: string | null;
  state: string | null;
  district: string | null;
  years: string;
  candidacy?: CandidacyInfo;
}

export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s: string): string[] {
  const n = normalizeName(s);
  return n ? n.split(" ") : [];
}

// Stable, source-derived UUID so the same person keeps the same URL across ingests.
export function personId(scheme: string, value: string): string {
  const h = createHash("sha1").update(`${scheme}:${value}`).digest("hex");
  const v = ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${v}${h.slice(18, 20)}-${h.slice(20, 32)}`;
}

// Common informal -> formal first names; used to expand queries.
const NICKNAMES: Record<string, string[]> = {
  bernie: ["bernard"], bernard: ["bernie"],
  bill: ["william"], billy: ["william"], will: ["william"], william: ["bill", "will", "billy"],
  bob: ["robert"], bobby: ["robert"], rob: ["robert"], robert: ["bob", "bobby", "rob"],
  dick: ["richard"], rick: ["richard"], richard: ["dick", "rick"],
  jim: ["james"], jimmy: ["james"], james: ["jim", "jimmy"],
  mike: ["michael"], michael: ["mike"],
  tom: ["thomas"], tommy: ["thomas"], thomas: ["tom", "tommy"],
  joe: ["joseph"], joseph: ["joe"],
  chuck: ["charles"], charlie: ["charles"], charles: ["chuck", "charlie"],
  ted: ["edward", "theodore"], ed: ["edward"], edward: ["ted", "ed"],
  liz: ["elizabeth"], beth: ["elizabeth"], elizabeth: ["liz", "beth"],
  kathy: ["katherine", "kathleen"], katherine: ["kathy"], kathleen: ["kathy"],
  dan: ["daniel"], daniel: ["dan"],
  dave: ["david"], david: ["dave"],
  steve: ["steven", "stephen"], steven: ["steve"], stephen: ["steve"],
  pat: ["patrick", "patricia"], patrick: ["pat"],
  nancy: ["ann"], hank: ["henry"], henry: ["hank"],
  jack: ["john"], johnny: ["john"], john: ["jack", "johnny"],
  tim: ["timothy"], timothy: ["tim"],
  chris: ["christopher"], christopher: ["chris"],
  matt: ["matthew"], matthew: ["matt"],
  andy: ["andrew"], andrew: ["andy"],
  tony: ["anthony"], anthony: ["tony"],
};

export function nicknameVariants(token: string): string[] {
  return NICKNAMES[token] ?? [];
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

const simMemo = new Map<string, number>();

function tokenSim(q: string, t: string): number {
  if (q === t) return 1;
  if (t.startsWith(q)) return 0.92;
  if (q.length < 3) return 0;
  const key = `${q}|${t}`;
  const hit = simMemo.get(key);
  if (hit !== undefined) return hit;
  const sim = (x: string, y: string) => 1 - levenshtein(x, y) / Math.max(x.length, y.length);
  // Allow typos in a still-being-typed token by comparing to an equal-length prefix.
  let best = sim(q, t.slice(0, q.length)) * 0.9;
  if (Math.abs(q.length - t.length) <= 0.3 * Math.max(q.length, t.length)) best = Math.max(best, sim(q, t));
  const v = best >= 0.7 ? best * 0.85 : 0;
  if (simMemo.size > 300_000) simMemo.clear();
  simMemo.set(key, v);
  return v;
}

/** Score 0..100 of how well a normalized name matches query tokens; 0 = no match. */
export function scoreName(queryTokens: string[], nameNorm: string): number {
  if (!queryTokens.length) return 0;
  if (nameNorm === queryTokens.join(" ")) return 100;
  const nameTokens = nameNorm.split(" ");
  let total = 0;
  for (const qt of queryTokens) {
    const alts = [qt, ...nicknameVariants(qt)];
    let best = 0;
    for (const nt of nameTokens) {
      for (const alt of alts) best = Math.max(best, tokenSim(alt, nt) * (alt === qt ? 1 : 0.95));
    }
    if (best === 0) return 0;
    total += best;
  }
  // Penalize name tokens the query did not cover so an exact full-name match outranks longer names.
  const extra = Math.max(0, nameTokens.length - queryTokens.length);
  return Math.max(1, Math.round(50 + 50 * (total / queryTokens.length) - Math.min(8, extra * 2)));
}

export function yearsLabel(start: string, end: string | null, status: Status): string {
  const s = start.slice(0, 4);
  if (status === "current" || !end) return `${s}-present`;
  const e = end.slice(0, 4);
  return s === e ? s : `${s}-${e}`;
}
export * from "./place.ts";
export * from "./rubric.ts";
export * from "./billStatus.ts";
