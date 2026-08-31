import test from "node:test";
import assert from "node:assert/strict";
import { sanitizePortfolio } from "./storage";

test("portfolio persistence keeps only valid holdings and de-duplicates fund codes", () => {
  const result = sanitizePortfolio([
    { code: "000001", name: "有效基金", shares: 100, cost: 1.23 },
    { code: "000001", name: "重复基金", shares: 50, cost: 1.1 },
    { code: "bad", name: "无效", shares: 10, cost: 1 },
    { code: "000002", name: "无效份额", shares: 0, cost: 1 },
    { code: "000003", name: "无效成本", shares: 10, cost: -1 },
    null,
  ]);
  assert.deepEqual(result, [{ code: "000001", name: "有效基金", shares: 100, cost: 1.23 }]);
});

test("empty and non-array portfolio inputs never throw", () => {
  assert.deepEqual(sanitizePortfolio(null), []);
  assert.deepEqual(sanitizePortfolio({}), []);
});
