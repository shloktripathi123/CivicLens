import type { DB } from "@civic/db";
import { upsertSource } from "./candidates.ts";

export const SRC = {
  id: "oregon-sos-voting-rules",
  name: "Oregon Secretary of State: voting rules (curated, rule-based dates)",
  url: "https://sos.oregon.gov/voting/Pages/registration.aspx",
  license: "Public record",
  attribution: "Oregon Secretary of State",
  authoritative: true,
};
const REG_URL = "https://sos.oregon.gov/voting/Pages/registration.aspx";
const DROP_URL = "https://sos.oregon.gov/voting/Pages/drop-box-locator.aspx";

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export interface WindowDef { kind: string; start: string | null; end: string | null; note: string; basis: string; url: string }

/**
 * Oregon is the only state with deadline rules curated so far. Dates are derived from the scheduled election
 * date using Oregon's fixed statutory offsets and are labelled as rule-based, never as a personal ballot fact.
 */
export function oregonWindows(electionDate: string): WindowDef[] {
  const basis = "Derived from the election date using Oregon's statutory rules; confirm on the Secretary of State site.";
  return [
    { kind: "registration_deadline", start: null, end: shift(electionDate, -21), basis, url: REG_URL,
      note: "Last day to register or update your registration (21 days before the election)." },
    { kind: "mail_ballot_request", start: null, end: null, basis, url: REG_URL,
      note: "Oregon votes by mail: every registered voter is sent a ballot automatically, so there is no request window." },
    { kind: "mail_ballots_sent", start: shift(electionDate, -18), end: shift(electionDate, -14), basis, url: REG_URL,
      note: "Counties mail ballots between 18 and 14 days before the election." },
    { kind: "dropbox_open", start: shift(electionDate, -18), end: null, basis, url: DROP_URL,
      note: "Official drop sites can open once ballots are mailed; exact opening day varies by county." },
    { kind: "dropbox_close", start: null, end: electionDate, basis, url: DROP_URL,
      note: "Drop sites close at 8:00 p.m. on election day. Ballots must be in a drop site by then." },
  ];
}

export function seedVotingWindows(db: DB): number {
  upsertSource(db, SRC);
  db.prepare("DELETE FROM voting_window WHERE state = 'OR'").run();
  const els = db.prepare("SELECT id, date FROM election WHERE jurisdiction = 'OR' AND type = 'general'").all() as Array<{ id: string; date: string }>;
  const asOf = new Date().toISOString().slice(0, 10);
  const ins = db.prepare("INSERT INTO voting_window (state,election_id,kind,start_date,end_date,note,basis,url,source_id,as_of) VALUES ('OR',?,?,?,?,?,?,?,?,?)");
  let n = 0;
  for (const e of els) for (const w of oregonWindows(e.date)) { ins.run(e.id, w.kind, w.start, w.end, w.note, w.basis, w.url, SRC.id, asOf); n++; }
  return n;
}
