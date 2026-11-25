import { DatabaseSync } from "node:sqlite";
import { uncitedFacts } from "@civic/db";

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
  const { n: voteview } = db.prepare("SELECT count(*) AS n FROM source WHERE id = 'voteview'").get() as { n: number };
  if (voteview !== 0) throw new Error("Snapshot contains Voteview data; use a fresh database with Voteview excluded.");
  const checks: Array<[string, string, number]> = [
    ["people", "SELECT count(*) AS n FROM person", 1000],
    ["office terms", "SELECT count(*) AS n FROM office_term", 1000],
    ["states with legislators", "SELECT count(DISTINCT state) AS n FROM office_term WHERE level='state'", 40],
    ["places", "SELECT count(*) AS n FROM place", 10000],
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
  const { n: reports } = db.prepare("SELECT count(*) AS n FROM correction_report").get() as { n: number };
  if (reports !== 0) throw new Error("Snapshot contains correction reports; do not upload private submissions.");
  console.log("Snapshot checks passed. These minimums do not certify completeness or redistribution rights.");
} finally {
  db.close();
}
