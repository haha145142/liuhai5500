export type QuoteSample = {
  code: string;
  price: number | null;
  pct: number | null;
  source: string;
};

export type QuoteValidation = {
  usable: boolean;
  price: number | null;
  pct: number | null;
  status: "cross_checked" | "single_source" | "disagreed" | "unavailable";
  deviationPctPoints: number | null;
  note: string;
};

/**
 * Validate two independent real-time quote samples without silently replacing
 * the primary source with the fallback. The first usable sample remains the
 * displayed value; the second source only raises/lowers confidence.
 */
export function validateQuote(primary: QuoteSample, secondary?: QuoteSample | null): QuoteValidation {
  const pOk = primary.price != null || primary.pct != null;
  if (!pOk) {
    return {
      usable: false,
      price: null,
      pct: null,
      status: "unavailable",
      deviationPctPoints: null,
      note: "主行情源没有可靠数据",
    };
  }

  if (!secondary || (secondary.price == null && secondary.pct == null)) {
    return {
      usable: true,
      price: primary.price,
      pct: primary.pct,
      status: "single_source",
      deviationPctPoints: null,
      note: `仅 ${primary.source} 有可靠行情`,
    };
  }

  const pctDeviation = primary.pct != null && secondary.pct != null
    ? Math.abs(primary.pct - secondary.pct)
    : null;
  const priceDeviation = primary.price != null && secondary.price != null && primary.price !== 0
    ? Math.abs(primary.price - secondary.price) / Math.abs(primary.price) * 100
    : null;

  const pctAgree = pctDeviation == null || pctDeviation <= 0.15;
  const priceAgree = priceDeviation == null || priceDeviation <= 0.20;
  const agree = pctAgree && priceAgree;

  return {
    usable: true,
    price: primary.price,
    pct: primary.pct,
    status: agree ? "cross_checked" : "disagreed",
    deviationPctPoints: pctDeviation,
    note: agree
      ? `${primary.source} + ${secondary.source} 交叉一致`
      : `${primary.source} 与 ${secondary.source} 存在分歧，保留主源并降低可信度`,
  };
}
