import test from "node:test";
import assert from "node:assert/strict";

import { rankAkShareSectorFlow, type AkShareSectorFlow } from "./akshare-sector-flow.ts";

const rows: AkShareSectorFlow[] = [
  {
    name: "半导体",
    sectorType: "industry",
    changePct: 1.2,
    mainNetInflow: 500_000_000,
    mainNetRatio: 4.1,
    superNetInflow: 300_000_000,
    largeNetInflow: 200_000_000,
    midNetInflow: -100_000_000,
    smallNetInflow: -50_000_000,
  },
  {
    name: "银行",
    sectorType: "industry",
    changePct: -0.2,
    mainNetInflow: -200_000_000,
    mainNetRatio: -1.0,
    superNetInflow: -90_000_000,
    largeNetInflow: -80_000_000,
    midNetInflow: 100_000_000,
    smallNetInflow: 70_000_000,
  },
];

test("AKShare flow ranking prefers positive main inflow", () => {
  const ranked = rankAkShareSectorFlow(rows, 2);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0]?.row.name, "半导体");
  assert.ok(ranked[0]!.score > ranked[1]!.score);
});

test("AKShare flow ranking is bounded by requested limit", () => {
  assert.equal(rankAkShareSectorFlow(rows, 1).length, 1);
});
