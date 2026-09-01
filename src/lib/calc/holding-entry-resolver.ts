import type { FundQuote } from "@/lib/types";
import { calculateHoldingEntry, quoteFromFundState, type HoldingEntryInput } from "./holding-entry.ts";

export type HoldingEntryResolverResult = ReturnType<typeof calculateHoldingEntry> & {
  matched: boolean;
  fundName: string | null;
  marketLabel: "盘中自算估值" | "今日官方净值" | "最近可用数据" | "暂无可靠行情";
};

/**
 * Resolves an entry preview from already-loaded local fund data.
 * Uses the same quote-selection rules as the main holding-entry calculator.
 */
export function resolveHoldingEntryPreview(
  input: HoldingEntryInput,
  funds: Record<string, FundQuote>,
  trading: boolean,
): HoldingEntryResolverResult {
  const fund = funds[input.code];
  const quote = quoteFromFundState({
    estimate: fund?.estimate ?? null,
    estimatePct: fund?.estimatePct ?? null,
    nav: fund?.nav ?? null,
    dayPct: fund?.dayPct ?? null,
    navDate: fund?.navDate ?? null,
    estimateTime: fund?.estimateTime ?? null,
    officialNavPublished: fund?.officialNavPublished ?? null,
    historyPoints: fund?.historyPoints,
    tradeTime: trading,
  });

  const preview = calculateHoldingEntry(input, {
    price: quote.price,
    pct: quote.pct,
    source: quote.mode,
  });

  const marketLabel = quote.mode === "live_estimate"
    ? "盘中自算估值"
    : quote.mode === "official_today"
      ? "今日官方净值"
      : quote.mode === "latest_official"
        ? "最近可用数据"
        : "暂无可靠行情";

  return {
    ...preview,
    matched: fund != null,
    fundName: fund?.name ?? null,
    marketLabel,
  };
}
