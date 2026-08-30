import type { ValuationObservation } from "./valuation-calibration";

export type ValuationObservationRecord = ValuationObservation & {
  fundCode: string;
  estimateTime: string;
  officialDate: string;
  createdAt: string;
};

export function buildValuationObservation(input: {
  fundCode: string;
  estimatePct: number | null | undefined;
  officialPct: number | null | undefined;
  fundType?: string;
  coveragePct?: number;
  sourceAgreementPct?: number;
  estimateTime?: string | null;
  officialDate?: string | null;
}): ValuationObservationRecord | null {
  if (!Number.isFinite(input.estimatePct) || !Number.isFinite(input.officialPct)) return null;
  if (!input.fundCode || !input.officialDate) return null;
  return {
    fundCode: input.fundCode,
    fundType: input.fundType,
    estimatePct: input.estimatePct as number,
    officialPct: input.officialPct as number,
    coveragePct: input.coveragePct,
    sourceAgreementPct: input.sourceAgreementPct,
    estimateTime: input.estimateTime || "unknown",
    officialDate: input.officialDate,
    createdAt: new Date().toISOString(),
  };
}

export function isMatureObservation(record: ValuationObservationRecord) {
  return Boolean(
    record.fundCode &&
      Number.isFinite(record.estimatePct) &&
      Number.isFinite(record.officialPct) &&
      record.officialDate,
  );
}
