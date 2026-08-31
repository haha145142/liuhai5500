import type { FundQuote } from "../types";
import { getFund } from "./server";
import { getDirectFundFallback } from "./fund-direct-fallback";

const CACHE_TTL_MS = 15_000;
const resolved = new Map<string, { at: number; value: FundQuote }>();
const pending = new Map<string, Promise<FundQuote>>();
const quickPending = new Map<string, Promise<FundQuote | null>>();

/**
 * Client-side single-flight cache for the complete fund quote.
 * Concurrent views asking for the same code share one request.
 */
export async function requestFund(code: string): Promise<FundQuote> {
  const key = code.trim();
  if (!/^\d{6}$/.test(key)) throw new Error("基金代码无效");

  const cached = resolved.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const running = pending.get(key);
  if (running) return running;

  const request = getFund({ data: { code: key } })
    .then((value) => {
      if (value.nav != null || value.estimate != null || value.historyPoints.length > 0 || value.metrics != null) {
        resolved.set(key, { at: Date.now(), value });
      }
      return value;
    })
    .finally(() => pending.delete(key));

  pending.set(key, request);
  return request;
}

/**
 * Fast first-pass quote used by the add-fund UI.
 * It only reads the lightweight official NAV/history payload so the user can
 * see fund name, NAV, day change and basic indicators before the full
 * multi-source valuation finishes. The full request remains independent.
 */
export async function requestFundFast(code: string): Promise<FundQuote | null> {
  const key = code.trim();
  if (!/^\d{6}$/.test(key)) throw new Error("基金代码无效");

  const running = quickPending.get(key);
  if (running) return running;

  const request = getDirectFundFallback({ data: { code: key } }).finally(() => quickPending.delete(key));
  quickPending.set(key, request);
  return request;
}
