import type { DatabaseSync } from "node:sqlite";

export const VOTING_SCHEMA = `
CREATE TABLE IF NOT EXISTS state_voting (
  state TEXT PRIMARY KEY, name TEXT NOT NULL, official_url TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES source(id), as_of TEXT NOT NULL
);
`;

export interface ElectionContest {
  raceId: string; office: string; level: string; candidates: number;
}
export interface ElectionRow {
  id: string; date: string; type: string; jurisdiction: string; sourceId: string; asOf: string; contests: ElectionContest[];
}

export function stateVotingLink(db: DatabaseSync, state: string) {
  return db.prepare("SELECT state, name, official_url AS officialUrl, source_id AS sourceId, as_of AS asOf FROM state_voting WHERE state = ?")
    .get(state) as { state: string; name: string; officialUrl: string; sourceId: string; asOf: string } | undefined;
}

export function electionsFor(db: DatabaseSync, state?: string): ElectionRow[] {
  const els = db.prepare(`SELECT id, date, type, jurisdiction, source_id AS sourceId, as_of AS asOf FROM election
    ${state ? "WHERE jurisdiction = ?" : ""} ORDER BY date, jurisdiction`).all(...(state ? [state] : [])) as Array<Omit<ElectionRow, "contests">>;
  const q = db.prepare(`SELECT r.id AS raceId, o.title AS office, o.level AS level,
      (SELECT COUNT(*) FROM candidacy c WHERE c.race_id = r.id) AS candidates
    FROM race r JOIN office o ON o.id = r.office_id WHERE r.election_id = ? ORDER BY o.level, o.title`);
  return els.map((e) => ({ ...e, contests: q.all(e.id) as unknown as ElectionContest[] }));
}
