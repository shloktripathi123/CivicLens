import { DatabaseSync } from "node:sqlite";
import { uncitedFacts } from "@civic/db";
import { STATES } from "@civic/domain";

const path = process.argv[2];
if (!path) throw new Error("Usage: node --import tsx scripts/validate-deployment-db.ts <database>");
const db = new DatabaseSync(path, { readOnly: true });
try {
  const integrity = db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
  if (integrity.integrity_check !== "ok") throw new Error(`Database integrity check failed: ${integrity.integrity_check}`);
  const foreignKeyError = db.prepare("PRAGMA foreign_key_check").get();
  if (foreignKeyError) throw new Error(`Database foreign key check failed: ${JSON.stringify(foreignKeyError)}`);
  const uncited = uncitedFacts(db);
  if (uncited.length) throw new Error(`Facts without graded sources: ${JSON.stringify(uncited)}`);
  const excludedSources = ["voteview", "wikipedia-en", "oregon-legislature-odata", "local-gov-official"];
  const sourceExists = db.prepare("SELECT 1 FROM source WHERE id = ?");
  for (const id of excludedSources) {
    if (sourceExists.get(id)) throw new Error(`Snapshot contains excluded source ${id}; use a fresh database with excluded sources skipped.`);
  }
  const unverifiedChecks: Array<[string, string]> = [
    ["Open States photos", "SELECT count(*) AS n FROM person WHERE source_id='openstates-people' AND photo_url IS NOT NULL"],
    ["Open States bill descriptions", `SELECT count(*) AS n FROM bill WHERE source_id='openstates-bills'
      AND (title <> number OR summary IS NOT NULL OR status_detail IS NOT NULL OR text_url IS NOT NULL OR chapter IS NOT NULL)`],
    ["Open States bill action descriptions", `SELECT count(*) AS n FROM bill_action a JOIN bill b ON b.id=a.bill_id
      WHERE (a.source_id='openstates-bills' OR b.source_id='openstates-bills')
      AND a.text <> 'Action recorded; see source for details.'`],
    ["Open States profile descriptions", `SELECT count(*) AS n FROM official_record r WHERE r.source_id='openstates-bills'
      AND NOT EXISTS (SELECT 1 FROM bill b JOIN bill_sponsor s ON s.bill_id=b.id
        WHERE b.source_id='openstates-bills' AND b.url=r.url AND s.person_id=r.person_id
        AND r.title=b.number AND r.detail=s.role || ' · ' || b.session AND r.publisher='Open States')`],
  ];
  for (const [label, sql] of unverifiedChecks) {
    const { n } = db.prepare(sql).get() as { n: number };
    if (n) throw new Error(`Snapshot contains ${label}; use a fresh ingest with unverified content omitted.`);
  }
  const checks: Array<[string, string, number]> = [
    ["people", "SELECT count(*) AS n FROM person", 1000],
    ["office terms", "SELECT count(*) AS n FROM office_term", 1000],
    ["states with legislators", "SELECT count(DISTINCT state) AS n FROM office_term WHERE level='state'", 40],
    ["places", "SELECT count(*) AS n FROM place", 10000],
    ["county geography records", "SELECT count(*) AS n FROM county_geography", 3000],
    ["county population estimates", "SELECT count(*) AS n FROM county_population", 3000],
    ["races", "SELECT count(*) AS n FROM race", 100],
    ["bills", "SELECT count(*) AS n FROM bill", 100],
    ["state voting offices", "SELECT count(*) AS n FROM state_voting", 50],
    ["campaign finance summaries", "SELECT count(*) AS n FROM finance_summary", 1],
    ["federal legislative records", "SELECT count(*) AS n FROM official_record WHERE source_id='congress-gov-api'", 1],
  ];
  for (const [label, sql, minimum] of checks) {
    const { n } = db.prepare(sql).get() as { n: number };
    if (n < minimum) throw new Error(`${label}: found ${n}, require at least ${minimum}`);
    console.log(`${label}: ${n}`);
  }
  const guideExists = db.prepare("SELECT 1 FROM state_voting_guide WHERE state = ?");
  const missingGuides = STATES.filter((state) => !guideExists.get(state.usps)).map((state) => state.usps);
  if (missingGuides.length) throw new Error(`Missing EAC state voting guides: ${missingGuides.join(", ")}`);
  console.log(`state voting guides: ${STATES.length}`);
  const { n: reports } = db.prepare("SELECT count(*) AS n FROM correction_report").get() as { n: number };
  if (reports !== 0) throw new Error("Snapshot contains correction reports; do not upload private submissions.");
  console.log("Snapshot checks passed. These minimums do not certify completeness or redistribution rights.");
} finally {
  db.close();
}
