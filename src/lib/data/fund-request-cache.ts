import type { FundQuote } from "../types";
import { getFund } from "./server";

const CACHE_TTL_MS = 15_000;
const resolved = new Map<string, { at: number; value: FundQuote }>();
const pending = new Map<string, Promise<FundQuote>>();

/**
 * Client-side single-flight cache for fund quotes.
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
      resolved.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => pending.delete(key));

  pending.set(key, request);
  return request;
}
