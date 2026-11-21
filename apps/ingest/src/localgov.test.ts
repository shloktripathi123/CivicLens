import test from "node:test";
import assert from "node:assert/strict";
import { isoDate, parseTrimetBoard } from "./localgov.ts";

const FIX = `<p>Previous text ends here. Dr. LaVerne Lewis President District 6: E Multnomah County View district map First appointed March 4, 2021 Term expires February 28, 2029 Committee Email x</p>
<p>bio sentence. Thomas Kim Vice-President District 1: Washington County View district map First appointed July 1, 2021 Term expires June 30, 2029</p>
<p>Tyler Frisbee Secretary/Treasurer District 4: SE Portland View district map First appointed June 1, 2023 Term expires May 31, 2027</p>`;

test("parses TriMet directors with titles and dates", () => {
  const d = parseTrimetBoard(FIX);
  assert.deepEqual(d.map((x) => [x.name, x.title, x.district]), [
    ["Dr. LaVerne Lewis", "President", "6"], ["Thomas Kim", "Vice-President", "1"], ["Tyler Frisbee", "Secretary/Treasurer", "4"],
  ]);
  assert.equal(isoDate(d[0].expires), "2029-02-28");
});

test("returns nothing when the page layout changes", () => {
  assert.equal(parseTrimetBoard("<html>nothing here</html>").length, 0);
});
