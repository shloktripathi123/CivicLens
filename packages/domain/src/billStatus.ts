export const BILL_STATUSES = ["unknown", "introduced", "in_committee", "passed_one_chamber", "passed_both", "enacted", "vetoed", "failed", "withdrawn"] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];

export const BILL_STATUS_LABEL: Record<BillStatus, string> = {
  unknown: "Status not verified",
  introduced: "Proposed — introduced",
  in_committee: "Proposed — in committee",
  passed_one_chamber: "Proposed — passed one chamber",
  passed_both: "Passed both chambers (not yet law)",
  enacted: "Enacted into law",
  vetoed: "Vetoed",
  failed: "Failed or died",
  withdrawn: "Withdrawn",
};

export interface OregonSignals {
  prefix: string;
  currentLocation: string;
  chapterNumber: number | null;
  history: Array<{ chamber: string; text: string }>;
}

const KNOWN_LOCATIONS = [
  /^In (House|Senate) Committee/, /^Chapter Number Assigned$/, /^Filed with Secretary of State$/,
  /^At (House|Senate|Presidents) Desk Upon Adjournment$/, /^(House|Senate)( Desk)? - (Tabled|Failed|Vetoed)$/,
  /^Senate Presidents Desk - Awaiting Referral$/, /^(House|Senate) Desk - /,
];

/** Maps Oregon Legislature signals to the fixed status set. Throws on unrecognised locations so drift is never silently mislabelled. */
export function mapOregonStatus(s: OregonSignals): BillStatus {
  if (!KNOWN_LOCATIONS.some((r) => r.test(s.currentLocation))) throw new Error(`Unknown Oregon CurrentLocation: ${s.currentLocation}`);
  const loc = s.currentLocation;
  const passed = (chamber: string) => s.history.some((h) => h.chamber === chamber && /(Third reading|Read).*\b(Passed|Adopted)\b|\bAdopted\.$/.test(h.text));
  const isResolution = /^(H|S)(CR|JR|R|M)$/.test(s.prefix) || /CR$|JR$/.test(s.prefix);
  if (/vetoed/i.test(loc) || s.history.some((h) => /vetoed/i.test(h.text))) return "vetoed";
  if (s.chapterNumber != null && !isResolution) return "enacted";
  if (/Failed|Tabled/.test(loc)) return "failed";
  if (s.chapterNumber != null || loc === "Filed with Secretary of State") return "passed_both";
  const both = passed("H") && passed("S");
  if (both || (isResolution && (passed("H") || passed("S")) && /Filed/.test(loc))) return "passed_both";
  if (passed("H") || passed("S")) return "passed_one_chamber";
  if (/Committee/.test(loc)) return "in_committee";
  return s.history.some((h) => /Referred to/.test(h.text) && !/desk/i.test(h.text)) ? "in_committee" : "introduced";
}

/** Law status is derived from the mapped status only, never from display text. */
export const isLaw = (s: BillStatus) => s === "enacted";
