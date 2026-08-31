export type ValuationDisplayInput = {
  mode: "official_nav" | "estimate" | "waiting_official_nav" | "unavailable";
  estimateConfidence?: "high" | "medium" | "low";
  coveragePct?: number | null;
  crossCheckedWeightPct?: number | null;
  historicalMaePctPoints?: number | null;
  historicalSampleCount?: number | null;
};

export type ValuationDisplaySummary = {
  title: string;
  detail: string;
  tone: "official" | "good" | "watch" | "muted" | "danger";
};

export function summarizeValuation(input: ValuationDisplayInput): ValuationDisplaySummary {
  if (input.mode === "official_nav") {
    return { title: "官方净值", detail: "基金公司净值已公布", tone: "official" };
  }
  if (input.mode === "unavailable") {
    return { title: "暂无可靠行情", detail: "没有足够数据支持当前估值", tone: "danger" };
  }
  if (input.mode === "waiting_official_nav") {
    return { title: "等待官方净值", detail: "当前没有可用盘中估值", tone: "muted" };
  }

  const coverage = input.coveragePct != null ? `覆盖 ${input.coveragePct.toFixed(0)}%` : "覆盖未知";
  const cross = input.crossCheckedWeightPct != null ? `交叉 ${input.crossCheckedWeightPct.toFixed(0)}%` : "交叉未知";
  const hist = input.historicalMaePctPoints != null && input.historicalSampleCount != null
    ? `近20日误差 ${input.historicalMaePctPoints.toFixed(2)} 个百分点（${input.historicalSampleCount}日）`
    : "历史样本不足";

  if (input.estimateConfidence === "high") return { title: "盘中估值 · 已校验", detail: `${coverage} · ${cross} · ${hist}`, tone: "good" };
  if (input.estimateConfidence === "medium") return { title: "盘中估值 · 需观察", detail: `${coverage} · ${cross} · ${hist}`, tone: "watch" };
  return { title: "盘中估值 · 低置信度", detail: `${coverage} · ${cross} · ${hist}`, tone: "muted" };
}
