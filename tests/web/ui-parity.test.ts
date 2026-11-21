import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../apps/web");
const css = readFileSync(resolve(root, "app/globals.css"), "utf8");

test("People page uses only existing design-system classes (UI unchanged)", () => {
  const src = readFileSync(resolve(root, "app/people/page.tsx"), "utf8") + readFileSync(resolve(root, "components/Search.tsx"), "utf8");
  const used = [...src.matchAll(/className="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/));
  for (const c of used) assert.ok(css.includes(`.${c}`), `class .${c} not in globals.css`);
});

test("Local government views use only existing design-system classes", () => {
  const src = readFileSync(resolve(root, "app/government/[id]/page.tsx"), "utf8") + readFileSync(resolve(root, "components/LocalGovernment.tsx"), "utf8");
  const used = [...src.matchAll(/className="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/));
  for (const c of used) assert.ok(css.includes(`.${c}`), `class .${c} not in globals.css`);
});

test("Elections page uses only existing design-system classes", () => {
  const src = readFileSync(resolve(root, "app/elections/page.tsx"), "utf8");
  const used = [...src.matchAll(/className="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/));
  for (const c of used) assert.ok(css.includes(`.${c}`), `class .${c} not in globals.css`);
});
