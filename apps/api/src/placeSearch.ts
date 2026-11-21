import { isZip, parsePlaceQuery, scoreName, stateByUsps, type PlaceSummary, type PlaceType } from "@civic/domain";
import { allPlaces, type DB, type PlaceRow } from "@civic/db";

const TYPE_ORDER: Record<PlaceType, number> = { state: 0, county: 1, city: 2, zip: 3 };

export function toPlaceSummary(p: PlaceRow): PlaceSummary {
  return {
    id: p.id, type: p.type, name: p.name, label: p.label, state: p.state,
    stateName: stateByUsps(p.state)?.name ?? p.state, approximate: p.approximate,
  };
}

export interface PlaceHit { place: PlaceRow; score: number }

export class PlaceIndex {
  private named: PlaceRow[] = [];
  private zips: PlaceRow[] = [];
  private byId = new Map<string, PlaceRow>();

  constructor(private db: DB) { this.rebuild(); }

  rebuild() {
    const all = allPlaces(this.db);
    this.byId = new Map(all.map((p) => [p.id, p]));
    this.zips = all.filter((p) => p.type === "zip").sort((a, b) => a.name.localeCompare(b.name));
    this.named = all.filter((p) => p.type !== "zip");
  }

  /**
   * Ranked by match score. Ties are ordered neutrally and deterministically: state, county, city, then
   * state name and place name alphabetically. No popularity or population signal is used.
   */
  search(q: string, opts: { type?: PlaceType; state?: string } = {}): PlaceHit[] {
    const trimmed = q.trim();
    if (!trimmed) return [];

    if (/^\d{3,5}$/.test(trimmed)) {
      if (opts.type && opts.type !== "zip") return [];
      if (isZip(trimmed)) {
        const exact = this.byId.get(`zip:${trimmed}`);
        return exact && (!opts.state || exact.state === opts.state.toUpperCase()) ? [{ place: exact, score: 100 }] : [];
      }
      return this.zips
        .filter((p) => p.name.startsWith(trimmed) && (!opts.state || p.state === opts.state.toUpperCase()))
        .map((place) => ({ place, score: 80 }));
    }

    const parsed = parsePlaceQuery(trimmed);
    const state = (opts.state ?? parsed.state)?.toUpperCase();
    const type = opts.type ?? parsed.type;
    if (!parsed.tokens.length) return [];

    const hits: PlaceHit[] = [];
    for (const p of this.named) {
      if (type && p.type !== type) continue;
      if (state && p.state !== state && !(p.type === "state" && p.id === `state:${state}`)) continue;
      const s = scoreName(parsed.tokens, p.nameNorm);
      if (s > 0) hits.push({ place: p, score: s });
    }
    // A bare two-letter token is a state abbreviation ("OR").
    if (parsed.tokens.length === 1 && parsed.tokens[0].length === 2 && !state) {
      const st = this.byId.get(`state:${parsed.tokens[0].toUpperCase()}`);
      if (st && !hits.some((h) => h.place.id === st.id)) hits.push({ place: st, score: 90 });
    }
    hits.sort((a, b) =>
      b.score - a.score ||
      TYPE_ORDER[a.place.type] - TYPE_ORDER[b.place.type] ||
      a.place.state.localeCompare(b.place.state) ||
      a.place.name.localeCompare(b.place.name) ||
      a.place.id.localeCompare(b.place.id));
    return hits;
  }

  listStates(): PlaceRow[] {
    return this.named.filter((p) => p.type === "state").sort((a, b) => a.name.localeCompare(b.name));
  }

  get(id: string): PlaceRow | undefined { return this.byId.get(id); }
}
