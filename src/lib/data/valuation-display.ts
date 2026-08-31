export type ValuationDisplayInput = {
  valuationStatus?: "official_nav" | "estimate" | "waiting_official_nav" | "unavailable" | "stale" | null;
  estimateConfidence?: "high" | "medium" | "low" | null;
  estimateCoverage?: number | null;
  estimateValidation?: string | null;
  historyMae20?: number | null;
  historySample20?: number | null;
};

export type ValuationDisplaySummary = {
  mode: string;
  coverage: string;
  validation: string;
  history: string;
  tone: "official" | "high" | "medium" | "low" | "neutral";
};

function pct(v: number) { return `${Math.round(v)}%`; }

export function buildValuationDisplaySummary(input: ValuationDisplayInput): ValuationDisplaySummary {
  const mode = input.valuationStatus === "official_nav"
    ? "官方净值"
    : input.valuationStatus === "estimate"
      ? `盘中估值${input.estimateConfidence === "high" ? " · 已校验" : input.estimateConfidence === "medium" ? " · 需观察" : " · 低置信度"}`
      : input.valuationStatus === "waiting_official_nav"
        ? "等待官方净值"
        : input.valuationStatus === "stale"
          ? "最近官方净值"
          : "暂无可靠行情";

  const coverage = input.estimateCoverage != null && input.estimateCoverage > 0
    ? `覆盖 ${pct(input.estimateCoverage)}`
    : "覆盖未知";

  const validation = input.estimateValidation || "尚无交叉验证";

  const history = input.historyMae20 != null && (input.historySample20 ?? 0) >= 5
    ? `20日MAE ${input.historyMae20.toFixed(2)}%`
    : "历史样本不足";

  const tone = input.valuationStatus === "official_nav"
    ? "official"
    : input.estimateConfidence === "high"
      ? "high"
      : input.estimateConfidence === "medium"
        ? "medium"
        : input.valuationStatus === "estimate"
          ? "low"
          : "neutral";

  return { mode, coverage, validation, history, tone };
}
