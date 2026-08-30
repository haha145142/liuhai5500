export type HoldingEntryQuote = {
  price: number | null;
  pct: number | null;
  label: string;
  mode: "live_estimate" | "official_today" | "latest_official" | "none";
};

export type HoldingEntryPreview = {
  valid: boolean;
  shares: number | null;
  cost: number | null;
  costValue: number | null;
  price: number | null;
  marketValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
  quoteLabel: string;
  quoteMode: HoldingEntryQuote["mode"];
};

function positiveNumber(value: string | number) {
  const n = typeof value === "number" ? value : Number(value.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Add-holding preview is deliberately pure and synchronous.
 * It never invents a price: without a usable quote, market value/P&L remain null.
 */
export function previewHoldingEntry(
  sharesInput: string | number,
  costInput: string | number,
  quote: HoldingEntryQuote | null,
): HoldingEntryPreview {
  const shares = positiveNumber(sharesInput);
  const cost = positiveNumber(costInput);
  const valid = shares != null && cost != null;
  const costValue = valid ? shares! * cost! : null;
  const price = quote?.price != null && Number.isFinite(quote.price) && quote.price > 0 ? quote.price : null;
  const marketValue = valid && price != null ? shares! * price : null;
  const pnl = marketValue != null && costValue != null ? marketValue - costValue : null;
  const pnlPct = pnl != null && costValue ? (pnl / costValue) * 100 : null;

  return {
    valid,
    shares,
    cost,
    costValue,
    price,
    marketValue,
    pnl,
    pnlPct,
    quoteLabel: quote?.label ?? (price == null ? "等待可靠净值/估值" : "当前行情"),
    quoteMode: quote?.mode ?? "none",
  };
}

export function quoteFromFundState(input: {
  estimate?: number | null;
  estimatePct?: number | null;
  nav?: number | null;
  dayPct?: number | null;
  navDate?: string | null;
  estimateTime?: string | null;
  tradeTime: boolean;
}): HoldingEntryQuote {
  if (input.tradeTime && input.estimate != null && Number.isFinite(input.estimate) && input.estimate > 0) {
    return {
      price: input.estimate,
      pct: input.estimatePct ?? input.dayPct ?? null,
      label: input.estimateTime ? `盘中自算估值 · ${input.estimateTime}` : "盘中自算估值",
      mode: "live_estimate",
    };
  }

  if (input.nav != null && Number.isFinite(input.nav) && input.nav > 0) {
    return {
      price: input.nav,
      pct: input.dayPct ?? null,
      label: input.navDate ? `官方净值 · ${input.navDate}` : "官方净值",
      mode: input.navDate ? "official_today" : "latest_official",
    };
  }

  return { price: null, pct: null, label: "暂无可靠行情", mode: "none" };
}
