import test from "node:test";
import assert from "node:assert/strict";
import { parseElectionOffices } from "./votinginfo.ts";

test("parses state election office links", () => {
  const html = `<ul><li><a href="https://www.sos.alabama.gov/alabama-votes">Alabama (AL)</a></li>
  <li><a class="x" href="https://sos.oregon.gov/voting-elections/Pages/default.aspx">Oregon (OR)</a></li><li><a href="/other">About us</a></li></ul>`;
  assert.deepEqual(parseElectionOffices(html).map((l) => [l.state, l.url]), [
    ["AL", "https://www.sos.alabama.gov/alabama-votes"], ["OR", "https://sos.oregon.gov/voting-elections/Pages/default.aspx"],
  ]);
});
test("returns nothing for an unrecognised layout", () => assert.equal(parseElectionOffices("<p>x</p>").length, 0));
