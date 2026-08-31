export type ValuationSettlement = {
  code: string;
  date: string;
  officialChangePct: number | null;
  lastIntradayEstimatePct: number | null;
  absoluteErrorPctPoints: number | null;
  settledAt: string;
  status: "settled" | "missing_intraday" | "missing_official";
};

/**
 * Pair the last intraday estimate of a trading day with that day's official
 * fund change after the official NAV has been published.
 * The official value is the ground truth for settlement and is never replaced.
 */
export function settleValuationDay(
  code: string,
  date: string,
  lastIntradayEstimatePct: number | null,
  officialChangePct: number | null,
  settledAt = new Date().toISOString(),
): ValuationSettlement {
  if (officialChangePct == null) {
    return { code, date, officialChangePct: null, lastIntradayEstimatePct, absoluteErrorPctPoints: null, settledAt, status: "missing_official" };
  }
  if (lastIntradayEstimatePct == null) {
    return { code, date, officialChangePct, lastIntradayEstimatePct: null, absoluteErrorPctPoints: null, settledAt, status: "missing_intraday" };
  }
  return {
    code,
    date,
    officialChangePct,
    lastIntradayEstimatePct,
    absoluteErrorPctPoints: Math.abs(lastIntradayEstimatePct - officialChangePct),
    settledAt,
    status: "settled",
  };
}

export function summarizeValuationSettlements(items: ValuationSettlement[]) {
  const settled = items.filter((x) => x.status === "settled" && x.absoluteErrorPctPoints != null);
  if (!settled.length) {
    return { samples: 0, maePctPoints: null, maxErrorPctPoints: null, highCoverageMaePctPoints: null };
  }
  const errors = settled.map((x) => x.absoluteErrorPctPoints as number);
  return {
    samples: settled.length,
    maePctPoints: errors.reduce((sum, x) => sum + x, 0) / errors.length,
    maxErrorPctPoints: Math.max(...errors),
    highCoverageMaePctPoints: null,
  };
}
