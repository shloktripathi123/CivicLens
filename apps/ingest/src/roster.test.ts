import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "@civic/db";
import { personId } from "@civic/domain";
import { ingestRoster, loadRoster, parseGovernors, parsePositions, WIKIDATA, WIKIPEDIA } from "./roster.ts";
import { electionDay } from "./calendar.ts";

const ROW = `|-
|[[Governor of Alabama|Alabama]] ([[List of governors of Alabama|list]])
|[[File:Kay Ivey (2026).jpg|118x118px]]
! scope="row" | {{sortname|Kay|Ivey|Kay Ivey}}
| style="background-color:red;" |
|[[Alabama Republican Party|Republican]]
|{{birth date and age|1944|10|15}}
|[[Lieutenant Governor]]
|{{dts|2017|4|10}}
|2027 (term limits)
|-
|[[Governor of Nowhere|Nowhere]]
! scope="row" | {{sortname|No|One}}
|-`;

function seed() {
  const db = openDb(":memory:");
  const ins = db.prepare("INSERT INTO source (id,name,url,retrieved_at,authoritative) VALUES (?,?,?,?,0)");
  for (const s of [WIKIDATA, WIKIPEDIA]) ins.run(s.id, s.name, s.url, "2026-01-01");
  return db;
}

test("governor rows parse; unreadable or unknown rows are skipped", () => {
  const g = parseGovernors(ROW);
  assert.equal(g.length, 1);
  assert.deepEqual([g[0].name, g[0].state, g[0].party, g[0].start, g[0].birthDate], ["Kay Ivey", "AL", "Republican", "2017-04-10", "1944-10-15"]);
});

test("Wikidata rows without a start date or with a bare QID label are dropped", () => {
  const row = (name: string, start?: string) => ({
    p: { value: "http://www.wikidata.org/entity/Q1" }, pLabel: { value: name },
    posLabel: { value: "United States Secretary of State" }, ...(start ? { start: { value: start } } : {}),
  });
  const r = parsePositions([row("Marco Rubio", "2025-01-21T00:00:00Z"), row("No Start"), row("Q99", "2025-01-21T00:00:00Z")]);
  assert.deepEqual(r.map((x) => [x.name, x.title, x.officeType]), [["Marco Rubio", "Secretary of State", "cabinet"]]);
});

test("excluding Wikipedia keeps Wikidata roster data without contacting Wikipedia", async (t) => {
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0]) => {
    urls.push(String(input));
    return Response.json({ results: { bindings: [{
      p: { value: "http://www.wikidata.org/entity/Q1" }, pLabel: { value: "Example Person" },
      posLabel: { value: "United States Secretary of State" }, start: { value: "2025-01-21T00:00:00Z" },
    }] } });
  });
  const db = openDb(":memory:");
  try {
    await ingestRoster(db, { skipWikipedia: true });
    assert.equal(urls.length, 1);
    assert.match(urls[0], /^https:\/\/query\.wikidata\.org\//);
    assert.ok(db.prepare("SELECT 1 FROM person WHERE canonical_name = 'Example Person'").get());
    assert.equal(db.prepare("SELECT 1 FROM source WHERE id = 'wikipedia-en'").get(), undefined);
  } finally {
    db.close();
  }
});

test("an official with an existing identifier keeps one profile and gains the term", () => {
  const db = seed();
  const id = personId("bioguide", "R000605");
  db.prepare("INSERT INTO source (id,name,url,retrieved_at,authoritative) VALUES ('congress-legislators','x','https://x',?,1)").run("2026-01-01");
  db.prepare("INSERT INTO person (id,canonical_name,status,source_id,as_of) VALUES (?,?,?,?,?)").run(id, "Marco Rubio", "former", "congress-legislators", "2026-01-01");
  db.prepare("INSERT INTO person_identifier (person_id,scheme,value) VALUES (?,?,?)").run(id, "wikidata", "Q324546");
  const [e] = parsePositions([{ p: { value: "http://www.wikidata.org/entity/Q324546" }, pLabel: { value: "Marco Rubio" },
    posLabel: { value: "United States Secretary of State" }, start: { value: "2025-01-21T00:00:00Z" } }]);
  assert.deepEqual(loadRoster(db, [e], "2026-10-11"), { created: 0, merged: 1 });
  loadRoster(db, [e], "2026-10-11");
  assert.equal((db.prepare("SELECT COUNT(*) n FROM person").get() as { n: number }).n, 1);
  assert.equal((db.prepare("SELECT COUNT(*) n FROM office_term WHERE person_id=? AND office_type='cabinet'").get(id) as { n: number }).n, 1);
});

test("Election Day is the Tuesday after the first Monday in November", () => {
  assert.equal(electionDay(2026), "2026-11-03");
  assert.equal(electionDay(2028), "2028-11-07");
});
