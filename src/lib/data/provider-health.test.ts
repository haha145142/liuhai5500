import assert from "node:assert/strict";
import test from "node:test";
import { getProviderHealth, providerAllowed, providerFromUrl, recordProviderFailure, recordProviderSuccess } from "./provider-health.ts";

test("provider URL classification uses supplier names", () => {
  assert.equal(providerFromUrl("https://push2.eastmoney.com/api/qt/ulist"), "东方财富");
  assert.equal(providerFromUrl("https://qt.gtimg.cn/q=sh000001"), "腾讯财经");
  assert.equal(providerFromUrl("https://hq.sinajs.cn/list=sh000001"), "新浪财经");
});

test("circuit opens after repeated failures and closes after a success probe", () => {
  const endpoint = `https://unit-test-provider.example.test/${Date.now()}`;
  const provider = `unit-test-${Date.now()}`;
  assert.equal(providerAllowed(provider, endpoint), true);
  for (let i = 0; i < 5; i += 1) recordProviderFailure(provider, endpoint, 100 + i);
  assert.equal(getProviderHealth(provider, endpoint).state, "OPEN");
  assert.equal(providerAllowed(provider, endpoint), false);
});

test("success resets the failure streak", () => {
  const endpoint = `https://unit-test-provider.example.test/reset-${Date.now()}`;
  const provider = `unit-test-reset-${Date.now()}`;
  recordProviderFailure(provider, endpoint, 200);
  recordProviderFailure(provider, endpoint, 220);
  recordProviderSuccess(provider, endpoint, 80);
  const state = getProviderHealth(provider, endpoint);
  assert.equal(state.state, "CLOSED");
  assert.equal(state.consecutiveFailures, 0);
  assert.equal(state.successCount, 1);
  assert.equal(state.requestCount, 3);
});
