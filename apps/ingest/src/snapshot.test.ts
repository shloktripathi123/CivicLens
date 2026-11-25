import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "@civic/db";

test("deployment validation rejects a database containing an excluded source", () => {
  const dir = mkdtempSync(join(tmpdir(), "civic-snapshot-test-"));
  const path = join(dir, "snapshot.db");
  try {
    const script = resolve(fileURLToPath(new URL("../../../scripts/validate-deployment-db.ts", import.meta.url)));
    for (const id of ["voteview", "wikipedia-en", "oregon-legislature-odata", "local-gov-official"]) {
      const db = openDb(path);
      db.prepare("DELETE FROM source").run();
      db.prepare("INSERT INTO source(id,name,url,retrieved_at) VALUES(?,?,?,?)").run(id, id, "https://example.test", "2026-01-01");
      db.close();
      const result = spawnSync(process.execPath, ["--import", "tsx", script, path], { encoding: "utf8" });
      assert.equal(result.status, 1);
      assert.match(result.stderr, new RegExp(`Snapshot contains excluded source ${id}`));
    }
  } finally {
    for (const file of [path, `${path}-wal`, `${path}-shm`]) rmSync(file, { force: true });
    rmdirSync(dir);
  }
});
