import type { DB } from "@civic/db";
import { upsertRace, upsertSource } from "./candidates.ts";

const SRC = {
  id: "us-election-calendar",
  name: "U.S. Election Day statutes and USA.gov election dates",
  url: "https://www.usa.gov/election-day",
  license: "Public record",
  attribution: "U.S. Code (2 U.S.C. §7, 3 U.S.C. §1) and USA.gov",
  authoritative: true,
};

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky",
  LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/** Election Day: the Tuesday after the first Monday in November. */
export function electionDay(year: number): string {
  const d = new Date(Date.UTC(year, 10, 1));
  const toMonday = (8 - d.getUTCDay()) % 7;
  d.setUTCDate(1 + toMonday + 1);
  return d.toISOString().slice(0, 10);
}

/** The next federal general-election cycle, including election day itself. */
export function nextFederalCycle(asOf: string): number {
  const year = Number(asOf.slice(0, 4));
  const evenYear = year + year % 2;
  return asOf <= electionDay(evenYear) ? evenYear : evenYear + 2;
}

/**
 * Federal general-election dates and races inferred from known office terms.
 * State and local race coverage requires a separate source.
 */
export function ingestCalendar(db: DB, asOf = new Date().toISOString().slice(0, 10)): number {
  upsertSource(db, SRC);
  let n = 0;
  const race = (level: string, body: string, jurisdiction: string, title: string, district: string | null, d: string) => {
    upsertRace(db, { office: { level, body, jurisdiction, title, district }, electionDate: d, electionType: "general" }, SRC.id, asOf);
    n++;
  };
  const next = nextFederalCycle(asOf);
  for (const year of [next - 2, next]) {
    const date = electionDay(year);
    const knownOn = date < asOf ? date : asOf;
    const houses = db.prepare(
      "SELECT DISTINCT state, district FROM office_term WHERE body = 'U.S. House' AND start_date <= ? AND end_date >= ? AND state IS NOT NULL",
    ).all(knownOn, knownOn) as Array<{ state: string; district: string }>;
    for (const h of houses) race("federal", "U.S. House", h.state, `U.S. Representative, ${h.state}-${h.district}`, h.district, date);
    const senators = db.prepare(
      "SELECT DISTINCT state FROM office_term WHERE body = 'U.S. Senate' AND start_date <= ? AND end_date = ? AND state IS NOT NULL",
    ).all(date, `${year + 1}-01-03`) as Array<{ state: string }>;
    for (const s of senators) race("federal", "U.S. Senate", s.state, `U.S. Senator from ${s.state}`, null, date);
  }
  const presidentialYear = next + (4 - next % 4) % 4;
  race("federal", "President", "US", "President of the United States", null, electionDay(presidentialYear));
  return n;
}
