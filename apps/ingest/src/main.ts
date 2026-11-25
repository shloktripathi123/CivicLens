import { backfillOfficeTypes, openDb, setExclusionRules } from "@civic/db";
import { EXCLUSIONS } from "../../api/src/exclusions.ts";
import { checkLinks } from "./linkcheck.ts";
import { ingest } from "./adapter.ts";
import { ingestExecutive } from "./executive.ts";
import { ingestOregon } from "./oregon.ts";
import { ingestOregonBills } from "./oregonLeg.ts";
import { ingestOregonLegislators } from "./oregonLegislators.ts";
import { ingestCalendar } from "./calendar.ts";
import { ingestRoster } from "./roster.ts";
import { ingestFec } from "./fec.ts";
import { ingestPlaces } from "./places.ts";
import { ingestLocalGov } from "./localgov.ts";
import { ingestVotingInfo } from "./votinginfo.ts";
import { seedVotingWindows } from "./votingwindows.ts";
import { ingestVoteview } from "./voteview.ts";
import { ingestFederalRecords } from "./federal.ts";
import { ingestOpenStates } from "./openstates.ts";
import { ingestStateBills } from "./openstatesBills.ts";
import { gradeSources } from "./sources.ts";

async function main() {
  const db = openDb();
  await ingest(db);
  await ingestExecutive(db);
  ingestOregon(db);
  await ingestRoster(db);
  await ingestOregonBills(db);
  console.log("Oregon legislators: " + (await ingestOregonLegislators(db)) + " linked to their bills.");
  console.log(`Race calendar: ${ingestCalendar(db)} statutory races ensured.`);
  await ingestFec(db);
  await ingestPlaces(db);
  console.log(`Local government: ${await ingestLocalGov(db)} school districts plus curated units.`);
  console.log(`State election offices: ${await ingestVotingInfo(db)} linked.`);
  if (process.env.SKIP_VOTEVIEW === "1") {
    console.log("Voteview skipped; existing Voteview records are not removed.");
  } else {
    const v = await ingestVoteview(db);
    console.log(`Voteview: ${v.votes} votes, ${v.scores} scores.`);
  }
  { const f = await ingestFederalRecords(db); console.log(`Federal: ${f.bills} bills, ${f.funding} funding rows.`); }
  console.log(`Open States: ${await ingestOpenStates(db)} state legislators.`);
  console.log(`Open States bills: ${await ingestStateBills(db)} sponsorship records.`);
  console.warn("LegiScan ingest is unavailable: the adapter has not been implemented.");
  console.log(`Voting windows: ${seedVotingWindows(db)} seeded.`);
  backfillOfficeTypes(db);
  gradeSources(db);
  setExclusionRules(db, EXCLUSIONS.map(({ category, description, reason }) => ({ category, description, reason })));
  if (process.env.LINKCHECK === "1") await checkLinks(db);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
