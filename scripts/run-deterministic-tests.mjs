import { spawnSync } from "node:child_process";

const tests = [
  "src/lib/app-data/app-data.test.ts",
  "src/lib/auth/gate-identity.test.ts",
  "src/lib/data/live-valuation.test.ts",
  "src/lib/data/valuation-calibration.test.ts",
  "src/lib/data/valuation-status.test.ts",
  "src/lib/data/valuation-coverage.test.ts",
  "src/lib/market-hours.test.ts",
  "src/lib/market-phase-time-travel.test.ts",
  "src/lib/data/data-invariants.test.ts",
  "src/lib/data/akshare-sector-flow.test.ts",
  "src/lib/data/cache-policy.test.ts",
  "src/lib/data/provider-health.test.ts",
  "src/lib/data/fund-valuation-state.test.ts",
  "src/lib/calc/portfolio-returns.test.ts",
  "src/lib/calc/period-returns.test.ts",
  "src/lib/calc/portfolio-periods.test.ts",
  "src/lib/calc/holding-entry.test.ts",
  "src/lib/calc/holding-entry-resolver.test.ts",
  "src/lib/calc/indicators.test.ts",
];

const result = spawnSync(process.execPath, [
  "--experimental-strip-types",
  "--experimental-loader",
  "./scripts/resolve-ts-loader.mjs",
  "--test",
  ...tests,
], { stdio: "inherit" });

if (result.error) throw result.error;
process.exit(result.status ?? 1);
