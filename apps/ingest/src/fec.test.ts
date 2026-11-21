import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "@civic/db";
import { canTransition } from "@civic/domain";
import { upsertRace } from "./candidates.ts";

const cacheDir = mkdtempSync(join(tmpdir(), "civic-fec-test-"));
process.env.CACHE_DIR = cacheDir;
process.env.ELECTION_CYCLE = "2028";
const { ingestFec, parseFecName } = await import("./fec.ts");
after(() => rmSync(cacheDir, { recursive: true, force: true }));

test("FEC name parsing", () => {
  assert.deepEqual(parseFecName("WARREN, ELIZABETH"), { name: "Elizabeth Warren", given: "Elizabeth", family: "Warren" });
  assert.equal(parseFecName("MCCONNELL, MITCH").name, "Mitch McConnell");
  assert.equal(parseFecName("O'ROURKE, ROBERT FRANCIS \"BETO\"").family, "O'Rourke");
  assert.equal(parseFecName("SMITH, JOHN Q. JR.").name, "John Q. Smith Jr.");
});

test("candidacy status transitions", () => {
  assert.ok(canTransition("filed", "qualified"));
  assert.ok(!canTransition("won", "filed"));
});

test("FEC uses the demo key and only attaches filings to known races", async (t) => {
  const original = process.env.FEC_API_KEY;
  process.env.FEC_API_KEY = "";
  t.after(() => {
    if (original === undefined) delete process.env.FEC_API_KEY;
    else process.env.FEC_API_KEY = original;
  });
  const urls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(String(input));
    urls.push(url);
    const results = url.pathname.endsWith("/candidates/") ? [
      { candidate_id: "S1", name: "SMITH, JANE", office: "S", state: "OR" },
      { candidate_id: "S2", name: "JONES, JOHN", office: "S", state: "TX" },
    ] : [];
    return Response.json({ results, pagination: { pages: 1 } });
  });
  const db = openDb(":memory:");
  try {
    db.prepare("INSERT INTO source (id,name,url,retrieved_at) VALUES ('s','s','https://example.com','2026-01-01')").run();
    upsertRace(db, {
      office: { level: "federal", body: "U.S. Senate", jurisdiction: "OR", title: "U.S. Senator from OR", district: null },
      electionDate: "2028-11-07", electionType: "general",
    }, "s", "2026-01-01");
    await ingestFec(db);
    assert.equal(urls.length, 2);
    assert.ok(urls.every((url) => url.searchParams.get("api_key") === "DEMO_KEY"));
    const rows = db.prepare("SELECT value FROM person_identifier WHERE scheme = 'fec'").all();
    assert.deepEqual(rows.map((row) => row.value), ["S1"]);
  } finally {
    db.close();
  }
});
