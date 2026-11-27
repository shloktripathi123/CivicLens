export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (
  process.env.NODE_ENV === "development" ? "http://localhost:4000" : ""
);

export interface Person {
  id: string; name: string; photoUrl: string | null; status: "current" | "former" | "candidate";
  candidacy?: Candidacy;
  level: string; body: string; party: string | null; state: string | null; district: string | null; years: string;
}
export interface Candidacy {
  office: string; jurisdiction: string; electionYear: number; electionDate: string; party: string | null;
  status: string; incumbent: boolean; raceId: string;
}
export interface Provenance { sourceId?: string; grade?: string | null; selfReported?: boolean; sourceName: string; sourceUrl: string; asOf: string }
export interface Term {
  title: string; body: string; party: string | null; state: string | null; district: string | null;
  start: string | null; end: string | null; provenance: Provenance;
}
export interface DeepItem {
  title: string; detail: string | null; date: string | null; publisher: string | null; url: string | null; provenance: Provenance;
}
export interface DeepSlot { lookups?: Array<{ label: string; url: string }>; status: "has_data" | "none_recorded"; items: DeepItem[]; checked: string }
export type DeepKey = "affiliations" | "bills" | "votes" | "projects" | "funding" | "ratings";
export interface DeepProfile { sections: Record<DeepKey, DeepSlot> }

export interface Profile {
  deep?: DeepProfile | null;
  conflicts?: import("@/components/Conflict").ConflictDto[];
  person: Person;
  terms: Term[];
  committees: Array<{ id: string; name: string; subcommittee: boolean; role: string; url: string | null; provenance: Provenance }>;
  background: Array<{ kind: string; detail: string; provenance: Provenance }>;
  contact: {
    website: string | null; phone: string | null; address: string | null; contactForm: string | null;
    social: Array<{ platform: string; handle: string; url: string; provenance?: Provenance }>; provenance: Provenance;
  };
  coverage: Record<string, "complete" | "partial" | "unavailable">;
  lastUpdated: string | null;
}

export function describe(p: Person): string {
  const place = p.state ? (p.district && p.body.includes("House") ? `${p.state}-${p.district}` : p.state) : "";
  return [p.body, place, p.party].filter(Boolean).join(" · ");
}

export interface RaceCandidate {
  id: string; name: string; photoUrl: string | null; party: string | null; status: string; incumbent: boolean;
}
export interface Race {
  id: string; office: string; body: string; jurisdiction: string; electionDate: string; electionType: string;
  status: string; ordering: string; candidates: RaceCandidate[];
}
export interface CandidateProfile {
  conflicts?: import("@/components/Conflict").ConflictDto[];
  person: Person;
  candidacy: Candidacy & { website: string | null; filedOn: string | null; provenance: Provenance };
  race: Race;
  background: {
    items: Array<{ kind: string; detail: string; provenance: Provenance }>;
    education: Array<{ institution: string; degree: string | null; year: number | null; provenance: Provenance }>;
    career: Array<{ title: string; org: string | null; start: string | null; end: string | null; provenance: Provenance }>;
  };
  committees: Array<{ name: string; url: string | null; role: string; provenance: Provenance }>;
  links: Array<{ platform: string; handle: string; url: string; provenance: Provenance }>;
  agenda: { selfReported: true; items: Array<{ topic: string; text: string; origin: string; sourceUrl: string; capturedAt: string }> };
  record: { terms: Term[]; bills: unknown[]; votes: unknown[] };
  finance: { cycle: number; receipts: number | null; disbursements: number | null; cashOnHand: number | null; provenance: Provenance } | null;
  coverage: Record<string, "complete" | "partial" | "unavailable">;
  lastUpdated: string | null;
}

export const usd = (n: number | null) => (n === null ? "Not available" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }));
export const STATUS_LABEL: Record<string, string> = { filed: "Filed", qualified: "Qualified", withdrawn: "Withdrawn", won: "Won", lost: "Lost" };

export interface PlaceSummary {
  id: string; type: "state" | "county" | "city" | "zip"; name: string; label: string; state: string; stateName: string;
  approximate: boolean;
}
export type SectionState = "sourced" | "sourced_low" | "not_found" | "not_yet_checked";
export interface PlaceLevel {
  level: "federal" | "state" | "county" | "city"; state: SectionState; officials: Person[]; races: Race[]; note?: string;
  gap?: { reason: string; sourcesChecked: string[]; officialSiteUrl: string };
}
export interface PlacePage {
  place: PlaceSummary; approximateNote?: string; parents: PlaceSummary[]; children: PlaceSummary[];
  overlaps: Array<{ place: PlaceSummary; relation: string; share: number | null }>;
  levels: PlaceLevel[]; completeness: { sectionsWithData: number; sectionsTotal: number; rule: string };
  states: string[]; cityCount?: number; cityNote?: string;
  countyFacts?: {
    geography: { landSqMi: number; waterSqMi: number; provenance: Provenance } | null;
    population: { estimate: number; provenance: Provenance } | null;
  } | null;
  provenance: Provenance | null;
}
export const PLACE_TYPE_LABEL: Record<PlaceSummary["type"], string> = { state: "State", county: "County", city: "City / town", zip: "ZIP (approximate)" };
export const placeHref = (id: string) => `/places/${encodeURIComponent(id)}`;

export interface Bill {
  id: string; jurisdiction: string; session: string; number: string; title: string; summary: string | null;
  status: string; statusDetail: string | null; isLaw: boolean | null; chapter: string | null; url: string; textUrl: string | null;
  introducedOn: string | null; provenance: Provenance;
}
export interface BillDetail extends Bill {
  sponsors: Array<{ name: string; role: string }>;
  actions: Array<{ date: string; chamber: string | null; text: string }>;
}
export const BILL_STATUS_LABEL: Record<string, string> = {
  unknown: "Status not verified",
  introduced: "Proposed — introduced", in_committee: "Proposed — in committee", passed_one_chamber: "Proposed — passed one chamber",
  passed_both: "Passed both chambers (not yet law)", enacted: "Enacted into law", vetoed: "Vetoed", failed: "Failed or died", withdrawn: "Withdrawn",
};

export interface GovProv { sourceId: string; sourceName: string; sourceUrl: string; asOf: string; grade: string | null; selfReported: boolean }
export interface GovOffice {
  id: string; title: string; role: "elected" | "appointed" | "hired" | "ex_officio"; selection: string | null; appointing: string | null;
  termYears: number | null; termLimit: string | null; seats: number | null; nonpartisan: boolean | null; responsibilities: string | null;
  nextElection: { date: string; basis: "confirmed" | "expected"; rule: string | null } | null; sourceUrl: string;
  holders: Array<{ name: string; seat: string | null; status: string; startDate: string | null; endDate: string | null; email: string | null; url: string | null }>;
  provenance: GovProv;
}
export interface GovUnit {
  id: string; kind: "county" | "city" | "school_district" | "special_district"; name: string; state: string; function: string | null;
  form: string | null; officialUrl: string | null; provenance: GovProv; offices: GovOffice[];
  meetings: Array<{ body: string; schedule: string; location: string | null; attend: string | null; publicComment: string | null; agendaUrl: string | null; minutesUrl: string | null; sourceUrl: string }>;
  completeness: Array<{ item: string; state: "sourced" | "not_in_our_data"; note?: string }>;
}
export interface LocalGov {
  placeId: string; groups: Array<{ kind: GovUnit["kind"]; units: GovUnit[] }>;
  school: { state: "resolved" | "unavailable"; note: string } | null; notes: string[];
}
export const ROLE_LABEL = { elected: "Elected", appointed: "Appointed", hired: "Hired (not elected)", ex_officio: "Serves by virtue of another office" } as const;
export const KIND_TITLE = { county: "County government", city: "City government", school_district: "School district", special_district: "Special districts" } as const;
