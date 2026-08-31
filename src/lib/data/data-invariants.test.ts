import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), "utf8");

test("official NAV publication truth comes only from historical NAV", () => {
  const live = read("live-valuation-v2.ts");
  const validation = read("validation.ts");

  assert.match(live, /const officialToday\s*=\s*latest\?\.date\s*===\s*today\(\)/);
  assert.match(live, /officialNavPublished:\s*officialToday/);
  assert.match(validation, /officialNavPublished:\s*q\.officialNavPublished/);
  assert.doesNotMatch(validation, /officialNavPublished:\s*q\.navDate\s*!=\s*null\s*&&/);
});

test("live fund validation never accepts single-source stock quotes", () => {
  const validated = read("validated-fund.ts");
  assert.match(validated, /\[\"three_source\",\"two_source\"\]/);
  assert.doesNotMatch(validated, /agreement===\"single_source\"\)\s*;/);
});

test("multi-source validation requires explicit cross-check status", () => {
  const multi = read("multi-source-quotes.ts");
  assert.match(multi, /validation = agreement === "three_source" \|\| agreement === "two_source"/);
  assert.match(multi, /agreement === "single_source" \? "single_source"/);
});
