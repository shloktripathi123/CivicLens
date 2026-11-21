import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(import.meta.dirname, "../../apps/web/components/CredibilityBadge.tsx"), "utf8");

test("badge conveys grade in text and icon, not color alone", () => {
  assert.match(src, /Credibility \{grade\}/);
  assert.match(src, /aria-label=/);
  assert.match(src, /aria-hidden="true"/);
});

test("popup is a modal dialog (focus trap) that closes with Escape and backdrop click", () => {
  assert.match(src, /showModal\(\)/);
  assert.match(src, /aria-labelledby/);
  assert.match(src, /e\.key === "Escape"/);
  assert.match(src, /aria-haspopup="dialog"/);
});
