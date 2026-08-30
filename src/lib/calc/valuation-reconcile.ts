import { recordPendingValuation, settleOfficialNav } from "./valuation-store";

export type ReconcileFundInput = {
  code: string;
  type?: string;
  estimatePct?: number | null;
  estimateTime?: string | null;
  estimateCoverage?: number;
  sourceAgreementPct?: number;
  navDate?: string | null;
  officialDayPct?: number | null;
  officialNavPublished?: boolean;
};

export function reconcileFundObservation(input: ReconcileFundInput) {
  const settled = input.officialNavPublished && input.navDate && Number.isFinite(input.officialDayPct)
    ? settleOfficialNav(input.code, input.navDate, input.officialDayPct as number)
    : [];

  const pending = !input.officialNavPublished && Number.isFinite(input.estimatePct)
    ? recordPendingValuation({
        fundCode: input.code,
        fundType: input.type,
        estimatePct: input.estimatePct,
        coveragePct: input.estimateCoverage,
        sourceAgreementPct: input.sourceAgreementPct,
        estimateTime: input.estimateTime,
      })
    : null;

  return { pending, settledCount: settled.length, settled };
}

export function shouldRecordEstimate(input: ReconcileFundInput) {
  return !input.officialNavPublished && Number.isFinite(input.estimatePct) && Number.isFinite(input.estimateCoverage) && (input.estimateCoverage as number) > 0;
}
