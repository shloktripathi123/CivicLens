import test from "node:test";
import assert from "node:assert/strict";
import { cityDefs, countyDefs, parseCensus, zipRelations } from "./places.ts";

const COUNTIES = "USPS\tGEOID\tANSICODE\tNAME\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG   \n" +
  "OR\t41051\t01155136\tMultnomah County\t1\t1\t1\t1\t45.5\t-122.4   \n";
const PLACES = "USPS\tGEOID\tANSICODE\tNAME\tLSAD\tFUNCSTAT\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG\n" +
  "OR\t4159000\t02411471\tPortland city\t25\tA\t1\t1\t1\t1\t45.53\t-122.65\n" +
  "XX\t9999999\t0\tNowhere city\t25\tA\t1\t1\t1\t1\t0\t0\n";
const REL = "\uFEFFOID_ZCTA5_20|GEOID_ZCTA5_20|NAMELSAD_ZCTA5_20|AREALAND_ZCTA5_20|AREAWATER_ZCTA5_20|MTFCC_ZCTA5_20|CLASSFP_ZCTA5_20|FUNCSTAT_ZCTA5_20|OID_COUNTY_20|GEOID_COUNTY_20|NAMELSAD_COUNTY_20|AREALAND_COUNTY_20|AREAWATER_COUNTY_20|MTFCC_COUNTY_20|CLASSFP_COUNTY_20|FUNCSTAT_COUNTY_20|AREALAND_PART|AREAWATER_PART\n" +
  "||||||||2759011|01003|Baldwin County|4117656199|1132956041|G4020|H1|A|339765765|927218265\n" +
  "1|97201|ZCTA5 97201|1000|10|G6350|B5|S|2|41051|Multnomah County|99999|1|G4020|H1|A|750|5\n";

test("Gazetteer parsing tolerates trailing whitespace and strips legal suffixes", () => {
  const c = countyDefs(parseCensus(COUNTIES, "\t"));
  assert.equal(c.length, 1);
  assert.equal(c[0].id, "county:41051");
  assert.equal(c[0].name, "Multnomah");
  assert.equal(c[0].lon, -122.4);
});

test("place rows in unknown states are dropped", () => {
  const p = cityDefs(parseCensus(PLACES, "\t"));
  assert.deepEqual(p.map((x) => x.id), ["city:4159000"]);
  assert.equal(p[0].name, "Portland");
});

test("relationship parsing handles the BOM and skips rows without a ZCTA", () => {
  const rel = zipRelations(parseCensus(REL, "|"), "COUNTY");
  assert.equal(rel.length, 1);
  assert.deepEqual({ zip: rel[0].zip, other: rel[0].otherGeoid, share: rel[0].share }, { zip: "97201", other: "41051", share: 0.75 });
});
