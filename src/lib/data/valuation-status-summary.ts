import { buildValuationDisplaySummary, type ValuationDisplayInput, type ValuationDisplaySummary } from "./valuation-display";

export type { ValuationDisplaySummary };

export type FundValuationSummaryInput = ValuationDisplayInput & {
  quoteCrossCheckedWeight?: number | null;
  quoteDisagreedWeight?: number | null;
};

export function summarizeFundValuation(input: FundValuationSummaryInput): ValuationDisplaySummary {
  return buildValuationDisplaySummary(input);
}
