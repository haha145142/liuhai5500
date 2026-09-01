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

/** Backward-compatible input shape used by older portfolio components. */
export type HoldingEntryInput = {
  code: string;
  shares: number;
  cost: number;
};

/** Backward-compatible market quote shape used by older portfolio components. */
export type HoldingEntryMarket = {
  price: number | null;
  pct: number | null;
  source: "live_estimate" | "official_today" | "latest_official" | "none";
};

function positiveNumber(value: string | number) {
  const n = typeof value === "number" ? value : Number(value.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function sameChinaDate(dateText: string | null | undefined, now = new Date()) {
  if (!dateText) return false;
  const [y, m, d] = dateText.split(/[-/]/).map(Number);
  if (![y, m, d].every(Number.isFinite)) return false;
  const china = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  return y === Number(china.year) && m === Number(china.month) && d === Number(china.day);
}

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

/** Backward-compatible adapter for the legacy calculation API. */
export function calculateHoldingEntry(input: HoldingEntryInput, market: HoldingEntryMarket): HoldingEntryPreview {
  const quote: HoldingEntryQuote = {
    price: market.price,
    pct: market.pct,
    label: market.source === "live_estimate"
      ? "盘中自算估值"
      : market.source === "official_today"
        ? "今日官方净值"
        : market.source === "latest_official"
          ? "最近官方净值"
          : "暂无可靠行情",
    mode: market.source,
  };
  return previewHoldingEntry(input.shares, input.cost, quote);
}

export function quoteFromFundState(input: {
  estimate?: number | null;
  estimatePct?: number | null;
  nav?: number | null;
  dayPct?: number | null;
  navDate?: string | null;
  estimateTime?: string | null;
  officialNavPublished?: boolean | null;
  historyPoints?: Array<{ date: string; changePct: number | null }>;
  tradeTime: boolean;
}): HoldingEntryQuote {
  // During trading, never downgrade a live preview to an older official NAV.
  // An absent/unreliable estimate must remain explicitly unavailable.
  if (input.tradeTime) {
    if (input.estimate != null && Number.isFinite(input.estimate) && input.estimate > 0) {
      return {
        price: input.estimate,
        pct: input.estimatePct ?? input.dayPct ?? null,
        label: input.estimateTime ? `盘中自算估值 · ${input.estimateTime}` : "盘中自算估值",
        mode: "live_estimate",
      };
    }

    return { price: null, pct: null, label: "暂无可靠行情", mode: "none" };
  }

  if (input.nav != null && Number.isFinite(input.nav) && input.nav > 0) {
    const officialToday = input.officialNavPublished === true && sameChinaDate(input.navDate);
    const historicalPct = input.navDate
      ? input.historyPoints?.find((point) => point.date === input.navDate)?.changePct
      : null;
    return {
      price: input.nav,
      pct: input.dayPct ?? (historicalPct != null && Number.isFinite(historicalPct) ? historicalPct : null),
      label: officialToday
        ? (input.navDate ? `今日官方净值 · ${input.navDate}` : "今日官方净值")
        : (input.navDate ? `最近官方净值 · ${input.navDate}` : "最近官方净值"),
      mode: officialToday ? "official_today" : "latest_official",
    };
  }

  return { price: null, pct: null, label: "暂无可靠行情", mode: "none" };
}
