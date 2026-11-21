import type { DB } from "@civic/db";
import { uncitedFacts } from "@civic/db";
import { RUBRIC_VERSION, explain, rate, type Criteria } from "@civic/domain";

interface Grading { type: string; selfReported?: boolean; criteria: Criteria }

// Criteria are judged from what is known about each publisher, never from the facts it supplies.
const GRADINGS: Record<string, Grading> = {
  "congress-legislators": {
    type: "community-maintained dataset of official records",
    criteria: { primaryRecord: 1, authorship: 2, editorial: 2, independence: 2, verifiability: 1, currency: 2 },
  },
  "fec-openfec": {
    type: "government API",
    criteria: { primaryRecord: 2, authorship: 2, editorial: 1, independence: 2, verifiability: 1, currency: 2 },
  },
  "us-election-calendar": {
    type: "statutory election dates (U.S. Code, USA.gov)",
    criteria: { primaryRecord: 2, authorship: 2, editorial: 2, independence: 2, verifiability: 2, currency: 1 },
  },
  "local-gov-official": {
    type: "official government websites (curated)",
    criteria: { primaryRecord: 2, authorship: 2, editorial: 1, independence: 1, verifiability: 2, currency: 1 },
  },
  "census-school-districts": {
    type: "federal statistical agency geography",
    criteria: { primaryRecord: 2, authorship: 2, editorial: 2, independence: 2, verifiability: 2, currency: 1 },
  },
  "usa-gov-election-offices": {
    type: "official federal directory of state election offices",
    criteria: { primaryRecord: 1, authorship: 2, editorial: 2, independence: 2, verifiability: 2, currency: 1 },
  },
  "wikidata": {
    type: "crowd-edited knowledge base",
    criteria: { primaryRecord: 0, authorship: 1, editorial: 1, independence: 2, verifiability: 1, currency: 1 },
  },
  "census-geography": {
    type: "government dataset",
    criteria: { primaryRecord: 2, authorship: 2, editorial: 2, independence: 2, verifiability: 1, currency: 1 },
  },
  "wikipedia-en": {
    type: "crowd-edited encyclopedia",
    criteria: { primaryRecord: 0, authorship: 1, editorial: 1, independence: 2, verifiability: 2, currency: 1 },
  },
  "oregon-gov": {
    type: "official state government websites",
    selfReported: true,
    criteria: { primaryRecord: 2, authorship: 2, editorial: 1, independence: 0, verifiability: 2, currency: 1 },
  },
  "oregon-legislature-odata": {
    type: "official government legislative record",
    criteria: { primaryRecord: 2, authorship: 2, editorial: 1, independence: 0, verifiability: 2, currency: 2 },
  },
  "congress-gov-api": {
    type: "official government legislative record",
    criteria: { primaryRecord: 2, authorship: 2, editorial: 1, independence: 0, verifiability: 2, currency: 2 },
  },
  "openfec-api": {
    type: "official government regulatory filing data",
    criteria: { primaryRecord: 2, authorship: 2, editorial: 1, independence: 2, verifiability: 2, currency: 2 },
  },
  "openstates-people": {
    type: "aggregated official legislative rosters",
    criteria: { primaryRecord: 1, authorship: 2, editorial: 2, independence: 2, verifiability: 2, currency: 2 },
  },
  "openstates-bills": {
    type: "aggregated official legislative records",
    criteria: { primaryRecord: 1, authorship: 2, editorial: 2, independence: 2, verifiability: 2, currency: 2 },
  },
  legiscan: {
    type: "aggregated official legislative records",
    criteria: { primaryRecord: 1, authorship: 2, editorial: 2, independence: 2, verifiability: 2, currency: 2 },
  },
  voteview: {
    type: "academic dataset of official roll-call records",
    criteria: { primaryRecord: 1, authorship: 2, editorial: 2, independence: 2, verifiability: 2, currency: 1 },
  },
  "oregon-sos-voting-rules": {
    type: "hand-curated by Civic Lens from a government site",
    criteria: { primaryRecord: 1, authorship: 1, editorial: 0, independence: 2, verifiability: 1, currency: 0 },
  },
  "oregon-sos-curated": {
    type: "hand-curated by Civic Lens from a government site",
    criteria: { primaryRecord: 1, authorship: 1, editorial: 0, independence: 2, verifiability: 1, currency: 0 },
  },
};

/** Grades every registered source with the rubric and fails if any fact lacks a graded source. */
export function gradeSources(db: DB) {
  const ids = (db.prepare("SELECT id FROM source").all() as Array<{ id: string }>).map((r) => r.id);
  const upd = db.prepare(
    "UPDATE source SET type=?, grade=?, rationale=?, rubric_version=?, criteria_json=?, self_reported=? WHERE id=?",
  );
  for (const id of ids) {
    const g = GRADINGS[id];
    if (!g) throw new Error(`Source ${id} has no grading; add it to apps/ingest/src/sources.ts`);
    const r = rate(g.criteria);
    upd.run(g.type, r.grade, explain(r), RUBRIC_VERSION, JSON.stringify(g.criteria), g.selfReported ? 1 : 0, id);
  }
  const bad = uncitedFacts(db);
  if (bad.length) throw new Error(`Facts without a graded source: ${JSON.stringify(bad)}`);
}
