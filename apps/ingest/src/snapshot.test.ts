import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "@civic/db";

test("deployment validation rejects a database containing Voteview", () => {
  const dir = mkdtempSync(join(tmpdir(), "civic-snapshot-test-"));
  const path = join(dir, "snapshot.db");
  try {
    const db = openDb(path);
    db.prepare("INSERT INTO source(id,name,url,retrieved_at) VALUES('voteview','Voteview','https://voteview.com','2026-01-01')").run();
    db.close();
    const script = resolve(fileURLToPath(new URL("../../../scripts/validate-deployment-db.ts", import.meta.url)));
    const result = spawnSync(process.execPath, ["--import", "tsx", script, path], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Snapshot contains Voteview data/);
  } finally {
    for (const file of [path, `${path}-wal`, `${path}-shm`]) rmSync(file, { force: true });
    rmdirSync(dir);
  }
});
