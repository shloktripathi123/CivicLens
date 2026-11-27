import { openDb, setExclusionRules } from "@civic/db";
import { STATES } from "@civic/domain";
import { buildApp } from "../../apps/api/src/app.ts";
import { EXCLUSIONS } from "../../apps/api/src/exclusions.ts";
import { gradeSources } from "../../apps/ingest/src/sources.ts";

const db = openDb(":memory:");
db.exec(`
  INSERT INTO source(id,name,url,retrieved_at,authoritative)
    VALUES('congress-legislators','Test records','https://example.test/records','2025-01-01',1);
  INSERT INTO state_voting_guide(state,url,source_id,as_of) VALUES
    ('CA','https://www.eac.gov/voters/register-and-vote-in-your-state?field_state_target_id=18176','congress-legislators','2026-01-01');
  INSERT INTO person(id,canonical_name,given,family,status,source_id,as_of) VALUES
    ('11111111-1111-4111-8111-111111111111','Taylor Example','Taylor','Example','current','congress-legislators','2025-01-01'),
    ('22222222-2222-4222-8222-222222222222','Jordan Example','Jordan','Example','candidate','congress-legislators','2025-01-01'),
    ('33333333-3333-4333-8333-333333333333','Morgan Example','Morgan','Example','candidate','congress-legislators','2025-01-01'),
    ('44444444-4444-4444-8444-444444444444','Casey Stateholder','Casey','Stateholder','current','congress-legislators','2025-01-01');
  INSERT INTO person_name(person_id,name,name_norm,kind)
    SELECT id,canonical_name,lower(canonical_name),'canonical' FROM person;
  INSERT INTO office_term(person_id,level,branch,body,title,state,party,start_date,office_type,source_id,as_of)
    VALUES('11111111-1111-4111-8111-111111111111','state','legislative','Oregon Senate','State Senator','OR','Independent','2025-01-01','senate','congress-legislators','2025-01-01');
  INSERT INTO office_term(person_id,level,branch,body,title,state,start_date,start_date_known,office_type,source_id,as_of)
    VALUES('44444444-4444-4444-8444-444444444444','state','legislative','California Senate','State Senator','CA','2026-01-01',0,'senate','congress-legislators','2026-01-01');
  INSERT INTO office(id,level,body,jurisdiction,title,source_id,as_of) VALUES
    ('state-office','state','Oregon Senate','OR','State Senator','congress-legislators','2025-01-01'),
    ('federal-office','federal','U.S. Senate','OR','U.S. Senator','congress-legislators','2025-01-01');
  INSERT INTO election(id,date,type,jurisdiction,source_id,as_of)
    VALUES('election','2099-11-03','general','OR','congress-legislators','2025-01-01');
  INSERT INTO race(id,election_id,office_id,status,source_id,as_of) VALUES
    ('state-race','election','state-office','upcoming','congress-legislators','2025-01-01'),
    ('federal-race','election','federal-office','upcoming','congress-legislators','2025-01-01');
  INSERT INTO candidacy(id,person_id,race_id,party,status,source_id,as_of) VALUES
    ('state-candidacy','22222222-2222-4222-8222-222222222222','state-race','Independent','filed','congress-legislators','2025-01-01'),
    ('federal-candidacy','33333333-3333-4333-8333-333333333333','federal-race','Independent','filed','congress-legislators','2025-01-01');
  INSERT INTO place(id,type,name,label,name_norm,state,fips,parent_id,source_id,as_of) VALUES
    ('state:OR','state','Oregon','Oregon','oregon','OR','41',NULL,'congress-legislators','2025-01-01'),
    ('county:41001','county','Example County','Example County','example county','OR','41001','state:OR','congress-legislators','2025-01-01');
  INSERT INTO county_geography(place_id,land_sq_mi,water_sq_mi,source_id,as_of)
    VALUES('county:41001',100.5,2.1,'congress-legislators','2024-01-01');
  INSERT INTO county_population(place_id,population,source_id,as_of)
    VALUES('county:41001',12345,'congress-legislators','2024-07-01');
  INSERT INTO gov_unit(id,kind,name,state,place_id,function,official_url,source_id,as_of)
    VALUES('example-gov','county','Example County','OR','county:41001','County government','https://example.test/','congress-legislators','2025-01-01');
  INSERT INTO gov_office(id,unit_id,title,role,source_url,source_id,as_of)
    VALUES('example-office','example-gov','Commissioner','elected','https://example.test/','congress-legislators','2025-01-01');
  INSERT INTO gov_holder(office_id,name,source_id,as_of)
    VALUES('example-office','Alex Example','congress-legislators','2025-01-01');
  INSERT INTO gov_area(place_id,unit_id,relation,source_id,as_of)
    VALUES('county:41001','example-gov','contains','congress-legislators','2025-01-01');
  INSERT INTO bill(id,jurisdiction,session,number,title,summary,status,is_law,url,source_id,as_of)
    VALUES('example-bill','OR','2025','HB 1000','Example public records bill','A test bill.','introduced',0,'https://example.test/bill','congress-legislators','2025-01-01'),
    ('ocd-bill/california','CA','2026','AB 20','California example bill',NULL,'unknown',0,'https://example.test/ca-bill','congress-legislators','2026-01-01');
  INSERT INTO bill_sponsor(bill_id,name,role,source_id,as_of,person_id) VALUES
    ('example-bill','Jordan Example','Primary sponsor','congress-legislators','2025-01-01','22222222-2222-4222-8222-222222222222'),
    ('example-bill','Unmatched Sponsor','Sponsor','congress-legislators','2025-01-01',NULL);
  INSERT INTO official_record(person_id,section,title,detail,date,publisher,url,source_id,as_of)
    VALUES('22222222-2222-4222-8222-222222222222','bills','HB 1000: Example public records bill','Primary sponsor','2025-01-01','Test records','https://example.test/bill','congress-legislators','2025-01-01');
`);
const insertState = db.prepare(`INSERT OR IGNORE INTO place(id,type,name,label,name_norm,state,fips,source_id,as_of)
  VALUES(?,'state',?,?,?,?,?,'congress-legislators','2025-01-01')`);
for (const state of STATES) insertState.run(`state:${state.usps}`, state.name, state.name, state.name.toLowerCase(), state.usps, state.fips);
const insertPlace = db.prepare(`INSERT INTO place(id,type,name,label,name_norm,state,fips,parent_id,approximate,source_id,as_of)
  VALUES(?,?,?,?,?,'OR',?,?,?,'congress-legislators','2025-01-01')`);
const insertOverlap = db.prepare(`INSERT INTO place_overlap(place_id,other_id,relation,share,source_id,as_of)
  VALUES(?,'county:41001','zip-in-county',0.5,'congress-legislators','2025-01-01')`);
const insertBill = db.prepare(`INSERT INTO bill(id,jurisdiction,session,number,title,status,is_law,url,source_id,as_of)
  VALUES(?,'CA','2026',?,?,'unknown',0,?,'congress-legislators','2026-01-01')`);
const insertOffice = db.prepare(`INSERT INTO office(id,level,body,jurisdiction,title,source_id,as_of)
  VALUES(?,'state','Oregon Senate','OR',?,'congress-legislators','2025-01-01')`);
const insertRace = db.prepare(`INSERT INTO race(id,election_id,office_id,status,source_id,as_of)
  VALUES(?,'election',?,'upcoming','congress-legislators','2025-01-01')`);
const insertRecord = db.prepare(`INSERT INTO official_record(person_id,section,title,date,publisher,url,source_id,as_of)
  VALUES('22222222-2222-4222-8222-222222222222','bills',?,'2024-01-01','Test records',?,'congress-legislators','2025-01-01')`);
for (let i = 1; i <= 65; i++) {
  const number = String(i).padStart(2, "0");
  const zip = String(97000 + i);
  insertPlace.run(`zip:${zip}`, "zip", zip, `ZIP ${zip}`, zip, zip, null, 1);
  insertOverlap.run(`zip:${zip}`);
  if (i <= 35) {
    const fips = `41${String(i + 100).padStart(3, "0")}`;
    const county = `Research County ${number}`;
    insertPlace.run(`county:${fips}`, "county", county, county, county.toLowerCase(), fips, "state:OR", 0);
  }
  if (i <= 32) {
    insertBill.run(`research-bill-${number}`, `AB ${100 + i}`, `Research bill ${number}`, `https://example.test/bill/${number}`);
    insertOffice.run(`research-office-${number}`, `Research office ${number}`);
    insertRace.run(`research-race-${number}`, `research-office-${number}`);
  }
  if (i <= 12) insertRecord.run(`Research bill ${number}`, `https://example.test/record/${number}`);
}
gradeSources(db);
setExclusionRules(db, [...EXCLUSIONS]);

const app = buildApp(db);
app.addHook("onRequest", async (request, reply) => {
  const url = new URL(request.url, "http://127.0.0.1");
  if (url.pathname === "/v1/races/service-unavailable" ||
      (url.pathname === "/v1/bills" && url.searchParams.get("q") === "service-unavailable")) {
    return reply.code(503).send({ error: "Test service unavailable" });
  }
});
app.listen({ host: "127.0.0.1", port: 41941 }).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
