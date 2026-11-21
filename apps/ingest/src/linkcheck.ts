import type { DB } from "@civic/db";

type Fetcher = typeof fetch;

export interface LinkResult { url: string; ok: boolean; httpStatus: number | null; archiveUrl: string | null; archiveCapturedAt: string | null }

/** Checks one URL; when it is broken, looks for an archived copy via the Internet Archive availability API. */
export async function checkLink(url: string, f: Fetcher = fetch): Promise<LinkResult> {
  let httpStatus: number | null = null;
  try {
    let res = await f(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (res.status === 405 || res.status === 403) res = await f(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15000) });
    httpStatus = res.status;
    if (res.ok) return { url, ok: true, httpStatus, archiveUrl: null, archiveCapturedAt: null };
  } catch { /* network failure counts as broken */ }

  try {
    const r = await f(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(15000) });
    const j = (await r.json()) as { archived_snapshots?: { closest?: { available?: boolean; url?: string; timestamp?: string } } };
    const c = j.archived_snapshots?.closest;
    if (c?.available && c.url) {
      const t = c.timestamp ?? "";
      return { url, ok: false, httpStatus, archiveUrl: c.url, archiveCapturedAt: t ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}` : null };
    }
  } catch { /* no archive available */ }
  return { url, ok: false, httpStatus, archiveUrl: null, archiveCapturedAt: null };
}

/** A link is flagged stale after it fails; a later success clears the flag. */
export async function checkLinks(db: DB, f: Fetcher = fetch) {
  const urls = (db.prepare("SELECT DISTINCT url FROM source").all() as Array<{ url: string }>).map((r) => r.url);
  const up = db.prepare(
    `INSERT OR REPLACE INTO link_check (url, ok, http_status, stale, archive_url, archive_captured_at, checked_at) VALUES (?,?,?,?,?,?,?)`,
  );
  let broken = 0;
  for (const url of urls) {
    const r = await checkLink(url, f);
    if (!r.ok) broken++;
    up.run(url, r.ok ? 1 : 0, r.httpStatus, r.ok ? 0 : 1, r.archiveUrl, r.archiveCapturedAt, new Date().toISOString());
  }
  console.log(`link check: ${urls.length} source links, ${broken} broken`);
}
