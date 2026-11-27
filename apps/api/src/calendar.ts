import { electionsFor, stateVotingGuide, stateVotingLink, windowsFor, type DB, type ElectionRow } from "@civic/db";
import { stateByUsps } from "@civic/domain";

export const REGISTER_URL = "https://vote.gov/register";

const DEADLINE_ITEMS = ["Registration deadlines except any listed below", "Early-voting and ballot-by-mail dates except any listed below"];

export const NOT_IN_OUR_DATA = [
  ...DEADLINE_ITEMS,
  "Primary, runoff and special-election dates",
  "Most state and local contests, including governor races",
  "Ballot measures",
  "Local contests and your personal sample ballot",
];

export function buildCalendar(db: DB, state: string | undefined, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const st = state?.toUpperCase();
  const link = st ? stateVotingLink(db, st) : undefined;
  const guide = st ? stateVotingGuide(db, st) : undefined;
  const stateInfo = st ? stateByUsps(st) : undefined;
  const stateSlug = stateInfo?.name.toLowerCase().replace(/\./g, "").replace(/\s+/g, "-");
  const wins = windowsFor(db, st);
  const items = electionsFor(db, st).map((e: ElectionRow) => ({
    id: e.id, date: e.date, type: e.type, jurisdiction: e.jurisdiction,
    label: "scheduled" as const,
    labelText: "Scheduled date (set by statute). This does not mean any particular contest or candidate is confirmed.",
    contests: e.contests.map((c) => ({
      ...c,
      label: c.candidates > 0 ? ("confirmed_contest" as const) : ("scheduled" as const),
      note: c.candidates > 0 ? "Candidates as filed; the list may be incomplete." : "Candidate list not yet published here.",
    })),
    windows: wins.filter((w) => w.electionId === e.id),
    sourceId: e.sourceId, asOf: e.asOf,
  }));
  return {
    today, state: st ?? null,
    upcoming: items.filter((i) => i.date >= today),
    past: items.filter((i) => i.date < today),
    voterInfo: {
      stateOffice: link ? { name: link.name, url: link.officialUrl, sourceId: link.sourceId, asOf: link.asOf } : null,
      votingGuide: guide ?? null,
      registerUrl: stateSlug ? `${REGISTER_URL}/${stateSlug}` : REGISTER_URL,
      personalBallot: "Your ballot depends on your address. Use your state's official voter-information and sample-ballot tools; Civic Lens does not generate a ballot.",
    },
    notInOurData: NOT_IN_OUR_DATA,
    coverage: "Federal general-election races are inferred from known office terms and may be incomplete. State and local race coverage is incomplete. Federal candidates come from FEC filings. Confirm dates and deadlines with your state's official site.",
  };
}
