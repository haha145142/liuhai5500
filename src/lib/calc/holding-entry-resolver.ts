import type { FundQuote } from "@/lib/types";
import { calculateHoldingEntry, type HoldingEntryInput, type HoldingEntryMarket } from "./holding-entry";

export type HoldingEntryResolverResult = ReturnType<typeof calculateHoldingEntry> & {
  matched: boolean;
  fundName: string | null;
  marketLabel: "盘中自算估值" | "今日官方净值" | "最近可用数据" | "暂无可靠行情";
};

/**
 * Resolves an entry preview from already-loaded local fund data.
 * It never invents a quote when the local fund store has no reliable number.
 */
export function resolveHoldingEntryPreview(input: HoldingEntryInput, funds: Record<string, FundQuote>, trading: boolean): HoldingEntryResolverResult {
  const fund = funds[input.code];
  const market: HoldingEntryMarket = trading
    ? {
        price: fund?.estimate ?? fund?.nav ?? null,
        pct: fund?.estimatePct ?? fund?.dayPct ?? null,
        source: fund?.estimate != null ? "live_estimate" : fund?.nav != null ? "latest_official" : "none",
      }
    : {
        price: fund?.nav ?? null,
        pct: fund?.dayPct ?? null,
        source: fund?.nav != null ? "official_today" : "none",
      };

  const preview = calculateHoldingEntry(input, market);
  const marketLabel = market.source === "live_estimate"
    ? "盘中自算估值"
    : market.source === "official_today"
      ? "今日官方净值"
      : market.source === "latest_official"
        ? "最近可用数据"
        : "暂无可靠行情";

  return {
    ...preview,
    matched: fund != null,
    fundName: fund?.name ?? null,
    marketLabel,
  };
}
