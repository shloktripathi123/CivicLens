import { openDb, setExclusionRules } from "@civic/db";
import { buildApp } from "../../apps/api/src/app.ts";
import { EXCLUSIONS } from "../../apps/api/src/exclusions.ts";
import { gradeSources } from "../../apps/ingest/src/sources.ts";

const db = openDb(":memory:");
db.exec(`
  INSERT INTO source(id,name,url,retrieved_at,authoritative)
    VALUES('congress-legislators','Test records','https://example.test/records','2025-01-01',1);
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
`);
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
