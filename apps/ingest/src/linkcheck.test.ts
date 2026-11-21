import test from "node:test";
import assert from "node:assert/strict";
import { checkLink } from "./linkcheck.ts";

const res = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

test("working link is ok and needs no archive", async () => {
  const r = await checkLink("https://a.test/x", (async () => res(200)) as typeof fetch);
  assert.equal(r.ok, true);
  assert.equal(r.archiveUrl, null);
});

test("broken link is flagged and gets the archived copy with its capture date", async () => {
  const f = (async (u: string) =>
    u.includes("archive.org")
      ? res(200, { archived_snapshots: { closest: { available: true, url: "https://web.archive.org/web/2024/https://a.test/x", timestamp: "20240315120000" } } })
      : res(404)) as unknown as typeof fetch;
  const r = await checkLink("https://a.test/x", f);
  assert.equal(r.ok, false);
  assert.equal(r.httpStatus, 404);
  assert.equal(r.archiveCapturedAt, "2024-03-15");
  assert.match(r.archiveUrl!, /web\.archive\.org/);
});

test("broken link with no archive and network errors are flagged without throwing", async () => {
  const r = await checkLink("https://a.test/x", (async () => { throw new Error("down"); }) as typeof fetch);
  assert.equal(r.ok, false);
  assert.equal(r.archiveUrl, null);
});
