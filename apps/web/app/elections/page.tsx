import { API_URL } from "@/lib/api";

export const metadata = { title: "Elections and voting — Civic Lens" };

interface Contest { raceId: string; office: string; level: string; candidates: number; label: string; note: string }
interface Win { id: number; kind: string; startDate: string | null; endDate: string | null; note: string; basis: string; url: string }
interface Election { windows?: Win[]; id: string; date: string; type: string; jurisdiction: string; labelText: string; contests: Contest[]; asOf: string }
interface Calendar {
  today: string; state: string | null; upcoming: Election[]; past: Election[];
  voterInfo: { stateOffice: { name: string; url: string; asOf: string } | null; registerUrl: string; personalBallot: string };
  notInOurData: string[]; coverage: string;
}

const CONTEST_TEXT: Record<string, string> = { confirmed_contest: "● Confirmed contest", scheduled: "○ Scheduled, no candidates listed" };

const WIN_LABEL: Record<string, string> = {
  registration_deadline: "Voter registration deadline", mail_ballot_request: "Mail-in ballot request window",
  mail_ballots_sent: "Ballots mailed to voters", dropbox_open: "Drop boxes open", dropbox_close: "Drop boxes close",
};
const winDate = (w: Win) => (w.startDate && w.endDate ? `${w.startDate} to ${w.endDate}` : w.startDate ? `From ${w.startDate}` : w.endDate ?? "No request needed");

function ElectionBlock({ e }: { e: Election }) {
  return (
    <section className="block" aria-labelledby={`el-${e.id}`}>
      <h2 id={`el-${e.id}`}>{e.date} · {e.type} election{e.jurisdiction === "US" ? "" : ` · ${e.jurisdiction}`}</h2>
      <p className="src"><span className="chip" style={{ marginLeft: 0 }}>○ Scheduled date</span> {e.labelText}</p>
      <h3>Key dates</h3>
      {(e.windows ?? []).length > 0 ? (
        <ul className="windows">
          {(e.windows ?? []).map((w) => (
            <li key={w.id}>
              <strong>{WIN_LABEL[w.kind] ?? w.kind}:</strong> {winDate(w)}<br />
              <span className="meta">{w.note} {w.basis} <a href={w.url}>Official source</a></span>
            </li>
          ))}
        </ul>
      ) : <p className="na">Registration, mail-in ballot and drop-box dates are not yet published here for this election. Use the official election office link above or <a href="https://www.usa.gov/register-to-vote">USA.gov</a> for your exact deadlines.</p>}
      <h3>Offices on the ballot</h3>
      <ul className="results">
        {e.contests.map((c) => (
          <li key={c.raceId}>
            <a className="card" href={`/races/${encodeURIComponent(c.raceId)}`}>
              <span><span className="name">{c.office}</span><br />
                <span className="meta">{CONTEST_TEXT[c.label]} · {c.candidates > 0 ? `${c.candidates} candidate${c.candidates === 1 ? "" : "s"}. ` : ""}{c.note}</span></span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function ElectionsPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  const res = await fetch(`${API_URL}/v1/calendar${state ? `?state=${encodeURIComponent(state)}` : ""}`, { cache: "no-store" }).catch(() => null);
  const cal: Calendar | null = res?.ok ? await res.json() : null;
  return (
    <article>
      <h1>Elections and voting</h1>
      <p className="lead">Scheduled dates, offices and filed candidates. Pick a state for its official voting information.</p>
      <form className="filters" method="get">
        <label>State (e.g. OR)<input name="state" maxLength={2} defaultValue={state} /></label>
        <button type="submit">Show</button>
      </form>
      {!cal && <p className="empty" role="alert">{res?.status === 400 ? "Enter a 2-letter state code." : "The calendar is unavailable right now."}</p>}
      {cal && (
        <>
          <section className="block" aria-labelledby="how-h">
            <h2 id="how-h">Register and vote{cal.state ? ` in ${cal.state}` : ""}</h2>
            <p className="src">Three kinds of information appear here and are never mixed: a scheduled date, a confirmed contest with filed candidates, and your personal ballot, which we do not generate.</p>
            <ul className="plain">
              <li><a href={cal.voterInfo.registerUrl}>Register to vote (USA.gov)</a></li>
              {cal.voterInfo.stateOffice
                ? <li><a href={cal.voterInfo.stateOffice.url}>{cal.voterInfo.stateOffice.name} official election office</a> <span className="meta">· USA.gov directory, as of {cal.voterInfo.stateOffice.asOf}. Use it for your sample ballot, voter lookup and deadlines.</span></li>
                : <li className="meta">Choose a state to see its official election office.</li>}
            </ul>
            <p className="empty">{cal.voterInfo.personalBallot}</p>
            <h3>Not in our data</h3>
            <ul className="plain">{cal.notInOurData.map((n) => <li key={n}>{n}: not in our data. Confirm on your state's official site.</li>)}</ul>
          </section>

          <h2>Upcoming</h2>
          {cal.upcoming.length === 0 && <p className="empty">No upcoming elections in our data{cal.state ? ` for ${cal.state}` : ""}.</p>}
          {cal.upcoming.map((e) => <ElectionBlock key={e.id} e={e} />)}

          {cal.past.length > 0 && (
            <>
              <h2>Past</h2>
              {cal.past.map((e) => <ElectionBlock key={e.id} e={e} />)}
            </>
          )}
          <p className="src">{cal.coverage}</p>
        </>
      )}
    </article>
  );
}
