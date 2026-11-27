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

test("deployment validation rejects unverified Open States photos and text", () => {
  const dir = mkdtempSync(join(tmpdir(), "civic-snapshot-rights-test-"));
  const path = join(dir, "snapshot.db");
  const script = resolve(fileURLToPath(new URL("../../../scripts/validate-deployment-db.ts", import.meta.url)));
  try {
    const db = openDb(path);
    db.exec(`
      INSERT INTO source(id,name,url,retrieved_at,grade) VALUES
        ('openstates-people','People','https://openstates.org/','2026-01-01','B'),
        ('openstates-bills','Bills','https://openstates.org/','2026-01-01','B');
      INSERT INTO person(id,canonical_name,photo_url,status,source_id,as_of)
        VALUES('p','Example','https://example.test/photo','current','openstates-people','2026-01-01');
      INSERT INTO bill(id,jurisdiction,session,number,title,status,is_law,url,source_id,as_of)
        VALUES('b','OR','2026','HB 1','Unverified title','unknown',0,'https://example.test/bill','openstates-bills','2026-01-01');
      INSERT INTO bill_action(bill_id,date,text,source_id,as_of)
        VALUES('b','2026-01-01','Unverified action','openstates-bills','2026-01-01');
      INSERT INTO official_record(person_id,section,title,detail,publisher,url,source_id,as_of)
        VALUES('p','bills','Unverified profile title','Unverified detail','Open States','https://example.test/bill','openstates-bills','2026-01-01');
    `);
    db.close();
    const rejects = (label: string) => {
      const result = spawnSync(process.execPath, ["--import", "tsx", script, path], { encoding: "utf8" });
      assert.equal(result.status, 1);
      assert.match(result.stderr, new RegExp(`Snapshot contains ${label}`));
    };
    rejects("Open States photos");
    const clean = openDb(path);
    clean.prepare("UPDATE person SET photo_url=NULL").run();
    clean.close();
    rejects("Open States bill descriptions");
    const cleanBill = openDb(path);
    cleanBill.prepare("UPDATE bill SET title=number").run();
    cleanBill.close();
    rejects("Open States bill action descriptions");
    const cleanAction = openDb(path);
    cleanAction.prepare("UPDATE bill_action SET text='Action recorded; see source for details.'").run();
    cleanAction.close();
    rejects("Open States profile descriptions");
    const safe = openDb(path);
    safe.exec(`
      INSERT INTO bill_sponsor(bill_id,name,role,source_id,as_of,person_id)
        VALUES('b','Example','Primary sponsor','openstates-bills','2026-01-01','p');
      UPDATE official_record SET title='HB 1', detail='Primary sponsor · 2026';
    `);
    safe.close();
    const result = spawnSync(process.execPath, ["--import", "tsx", script, path], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /people: found 1, require at least 1000/);
  } finally {
    for (const file of [path, `${path}-wal`, `${path}-shm`]) rmSync(file, { force: true });
    rmdirSync(dir);
  }
});
