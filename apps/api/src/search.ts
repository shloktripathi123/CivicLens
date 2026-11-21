import { scoreName, tokens } from "@civic/domain";
import { allPersonMeta, allSearchNames, type DB, type PersonMeta } from "@civic/db";

export interface SearchFilters {
  level?: string; body?: string; state?: string; status?: string; party?: string; year?: number;
  role?: string; electionYear?: number; officeType?: string;
}

export interface Hit { id: string; score: number }

interface NameEntry { personId: string; nameNorm: string }

export class SearchIndex {
  private names: NameEntry[] = [];
  private meta = new Map<string, PersonMeta>();

  constructor(private db: DB) { this.rebuild(); }

  rebuild() {
    this.names = allSearchNames(this.db).map((r) => ({ personId: r.personId, nameNorm: r.nameNorm }));
    this.meta = new Map(allPersonMeta(this.db).map((m) => [m.id, m]));
  }

  private passes(m: PersonMeta, f: SearchFilters): boolean {
    if (f.level && m.level !== f.level) return false;
    if (f.status && m.status !== f.status) return false;
    if (f.state && !m.states.split(",").includes(f.state.toUpperCase())) return false;
    if (f.body && !m.bodies.toLowerCase().includes(f.body.toLowerCase()) && !m.officeSought.includes(f.body.toLowerCase())) return false;
    if (f.party && !m.parties.toLowerCase().includes(f.party.toLowerCase())) return false;
    if (f.officeType && !m.officeTypes.split(",").includes(f.officeType)) return false;
    if (f.role === "candidate" && !m.candidate) return false;
    if (f.role === "official" && m.startYear === 9999) return false;
    if (f.electionYear !== undefined && m.electionYear !== f.electionYear) return false;
    if (f.year !== undefined && !(m.startYear <= f.year && (m.endYear === null || f.year <= m.endYear))) return false;
    return true;
  }

  /** Ranked by match score; ties favor current officials, then most recent service (neutral, documented). */
  search(q: string, filters: SearchFilters = {}): Hit[] {
    const qt = tokens(q);
    if (!qt.length) return [];
    const best = new Map<string, number>();
    for (const n of this.names) {
      const s = scoreName(qt, n.nameNorm);
      if (s > 0 && s > (best.get(n.personId) ?? 0)) best.set(n.personId, s);
    }
    // Office queries ("governor oregon") match candidates by the office they seek, below any name match.
    for (const [id, m] of this.meta) {
      if (!m.candidate || best.has(id)) continue;
      const words = m.officeSought.split(/[^a-z0-9]+/).filter(Boolean);
      if (qt.every((t) => t.length > 2 && words.some((w) => w.startsWith(t)))) best.set(id, 50);
    }
    const hits: Hit[] = [];
    for (const [id, score] of best) {
      const m = this.meta.get(id);
      if (m && this.passes(m, filters)) hits.push({ id, score });
    }
    const rank = (h: Hit) => this.meta.get(h.id)!;
    hits.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ma = rank(a), mb = rank(b);
      // Office-only matches are neutral: alphabetical by last name.
      if (a.score === 50 && ma.candidate && mb.candidate) return ma.family.localeCompare(mb.family);
      if (ma.status !== mb.status) return ma.status === "current" ? -1 : 1;
      const lv = (l: string) => (l === "federal" ? 0 : l === "state" ? 1 : 2);
      if (lv(ma.level) !== lv(mb.level)) return lv(ma.level) - lv(mb.level);
      return (mb.endYear ?? 9999) - (ma.endYear ?? 9999);
    });
    return hits;
  }
}
