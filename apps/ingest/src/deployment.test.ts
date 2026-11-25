import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { openDb } from "@civic/db";

test("deployment validation rejects each excluded source in an existing database", () => {
  const dir = mkdtempSync(join(tmpdir(), "civic-snapshot-test-"));
  const path = join(dir, "snapshot.db");
  try {
    const db = openDb(path);
    db.close();
    for (const id of ["voteview", "wikipedia-en", "oregon-legislature-odata", "local-gov-official"]) {
      const fixture = openDb(path);
      fixture.prepare("DELETE FROM source").run();
      fixture.prepare("INSERT INTO source (id,name,url,retrieved_at) VALUES (?,?,?,?)")
        .run(id, id, "https://example.test", "2026-01-01");
      fixture.close();
      const result = spawnSync(process.execPath, ["--import", "tsx", resolve("scripts/validate-deployment-db.ts"), path], { encoding: "utf8" });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp(`Snapshot contains excluded source ${id}`));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
