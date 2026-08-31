export type ValuationDisplayStatus =
  | "official_nav"
  | "estimated_cross_checked"
  | "estimated_single_source"
  | "estimated_low_coverage"
  | "waiting_official_nav"
  | "unavailable";

export type ValuationDisplay = {
  status: ValuationDisplayStatus;
  label: string;
  detail: string;
};

export function valuationDisplay(args: {
  officialNavPublished: boolean;
  estimatePct: number | null;
  coveragePct: number;
  validation: "一致" | "轻微偏差" | "明显偏差" | "无法验证";
  hasNav: boolean;
}): ValuationDisplay {
  if (args.officialNavPublished && args.hasNav) {
    return { status: "official_nav", label: "官方净值", detail: "基金官方净值已公布，优先显示官方口径" };
  }
  if (args.estimatePct == null) {
    return args.hasNav
      ? { status: "waiting_official_nav", label: "等待官方净值", detail: "当前没有可靠盘中估值，不用旧净值冒充盘中价格" }
      : { status: "unavailable", label: "暂无可靠行情", detail: "当前没有足够数据生成可信估值" };
  }
  if (args.validation === "一致" && args.coveragePct >= 60) {
    return { status: "estimated_cross_checked", label: "盘中估值 · 已校验", detail: "自算估值与参考口径一致" };
  }
  if (args.coveragePct >= 35) {
    return { status: "estimated_single_source", label: "盘中估值 · 部分校验", detail: "已有盘中估值，但覆盖或交叉验证仍有限" };
  }
  return { status: "estimated_low_coverage", label: "盘中估值 · 低覆盖", detail: "仅有少量可用持仓行情，结果只作参考" };
}
