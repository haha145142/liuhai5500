import type { FundQuote, Holding, SectorQuote } from "../types";

export type PortfolioHoldingRow = {
  code: string;
  name: string;
  value: number | null;
  cost: number;
  pnl: number | null;
  dayPct: number | null;
  dayPnl: number | null;
};

export type PortfolioAnalysis = {
  totalCost: number;
  marketValue: number;
  pnl: number | null;
  pnlPct: number | null;
  dayPnl: number | null;
  dayPct: number | null;
  holdingsCovered: number;
  holdingsTotal: number;
  concentrationTop1Pct: number;
  concentrationTop3Pct: number;
  avgDayPct: number | null;
  risk: "低" | "中" | "中高" | "高" | "数据不足";
  trend: "偏强" | "震荡" | "偏弱" | "数据不足";
  sectorExposures: { name: string; value: number; pct: number }[];
  topContributor: PortfolioHoldingRow | null;
  topDrag: PortfolioHoldingRow | null;
  holdingRows: PortfolioHoldingRow[];
  notes: string[];
};

function pickPrice(f?: FundQuote): number | null {
  if (!f) return null;
  const estimateUsable = f.estimate != null && f.valuationStatus !== "official_nav" && f.valuationStatus !== "unavailable";
  return estimateUsable ? f.estimate! : f.nav ?? null;
}

export function calcPortfolioAnalysis(holdings: Holding[], funds: FundQuote[], sectors: SectorQuote[]): PortfolioAnalysis {
  const rows: PortfolioHoldingRow[] = holdings.map((h) => {
    const f = funds.find((x) => x.code === h.code);
    const price = pickPrice(f);
    const cost = h.cost * h.shares;
    const value = price != null && Number.isFinite(price) && price > 0 ? price * h.shares : null;
    const pnl = value != null ? value - cost : null;
    const dayPct = f?.dayPct != null && Number.isFinite(f.dayPct) ? f.dayPct : null;
    const dayPnl = value != null && dayPct != null ? value * (dayPct / 100) : null;
    return { code: h.code, name: f?.name || h.name || h.code, value, cost, pnl, dayPct, dayPnl };
  });

  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const marketValue = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  const pnlKnown = rows.every((r) => r.pnl != null);
  const pnl = pnlKnown ? rows.reduce((s, r) => s + (r.pnl ?? 0), 0) : null;
  const pnlPct = pnl != null && totalCost > 0 ? (pnl / totalCost) * 100 : null;
  const covered = rows.filter((r) => r.value != null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const concentrationTop1Pct = marketValue > 0 && covered[0]?.value != null ? (covered[0].value / marketValue) * 100 : 0;
  const concentrationTop3Pct = marketValue > 0 ? (covered.slice(0, 3).reduce((s, r) => s + (r.value ?? 0), 0) / marketValue) * 100 : 0;

  const dayKnown = rows.filter((r) => r.value != null && r.dayPct != null);
  const dayBase = dayKnown.reduce((s, r) => s + (r.value ?? 0), 0);
  const dayPnl = dayKnown.length ? dayKnown.reduce((s, r) => s + (r.dayPnl ?? 0), 0) : null;
  const avgDayPct = dayBase > 0 ? dayKnown.reduce((s, r) => s + (r.value ?? 0) * (r.dayPct ?? 0), 0) / dayBase : null;
  const dayPct = marketValue > 0 && dayPnl != null ? (dayPnl / marketValue) * 100 : null;

  const contributors = dayKnown.slice().sort((a, b) => (b.dayPnl ?? -Infinity) - (a.dayPnl ?? -Infinity));
  const topContributor = contributors[0]?.dayPnl != null && contributors[0].dayPnl > 0 ? contributors[0] : null;
  const topDragRow = contributors.slice().sort((a, b) => (a.dayPnl ?? Infinity) - (b.dayPnl ?? Infinity))[0];
  const topDrag = topDragRow?.dayPnl != null && topDragRow.dayPnl < 0 ? topDragRow : null;

  const sectorMap = new Map<string, number>();
  for (const r of rows) {
    if (r.value == null) continue;
    const f = funds.find((x) => x.code === r.code);
    const name = f ? inferFundSectorName(f, sectors) : "未映射";
    sectorMap.set(name, (sectorMap.get(name) ?? 0) + r.value);
  }
  const sectorExposures = [...sectorMap.entries()]
    .map(([name, value]) => ({ name, value, pct: marketValue > 0 ? (value / marketValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  const notes: string[] = [];
  if (holdings.length && covered.length < holdings.length) notes.push(`${holdings.length - covered.length} 只持仓缺少可靠价格，组合市值不完整。`);
  if (concentrationTop1Pct >= 50) notes.push(`第一重仓约占组合 ${concentrationTop1Pct.toFixed(1)}%，集中度偏高。`);
  else if (concentrationTop1Pct >= 35) notes.push(`第一重仓约占组合 ${concentrationTop1Pct.toFixed(1)}%，需要关注集中度。`);
  if (concentrationTop3Pct >= 75) notes.push(`前三大持仓约占组合 ${concentrationTop3Pct.toFixed(1)}%，组合对少数资产较敏感。`);
  if (avgDayPct != null && avgDayPct > 1) notes.push(`按持仓市值加权，组合今日波动约 ${avgDayPct.toFixed(2)}%，高于普通震荡水平。`);
  if (avgDayPct != null && avgDayPct < -1) notes.push(`按持仓市值加权，组合今日回撤约 ${Math.abs(avgDayPct).toFixed(2)}%，需要关注风险传导。`);

  let risk: PortfolioAnalysis["risk"] = "数据不足";
  if (covered.length === holdings.length && holdings.length > 0) {
    if (concentrationTop1Pct >= 50 || concentrationTop3Pct >= 85) risk = "高";
    else if (concentrationTop1Pct >= 35 || concentrationTop3Pct >= 70) risk = "中高";
    else if (concentrationTop1Pct >= 25 || concentrationTop3Pct >= 55) risk = "中";
    else risk = "低";
  }

  const trend: PortfolioAnalysis["trend"] = avgDayPct == null ? "数据不足" : avgDayPct > 0.3 ? "偏强" : avgDayPct < -0.3 ? "偏弱" : "震荡";
  return { totalCost, marketValue, pnl, pnlPct, dayPnl, dayPct, holdingsCovered: covered.length, holdingsTotal: holdings.length, concentrationTop1Pct, concentrationTop3Pct, avgDayPct, risk, trend, sectorExposures, topContributor, topDrag, holdingRows: rows, notes };
}

function inferFundSectorName(fund: FundQuote, sectors: SectorQuote[]): string {
  const text = `${fund.name} ${fund.type}`;
  const rules: Array<[RegExp, string]> = [
    [/半导体|芯片|集成电路/, "半导体"], [/新能源|光伏|储能|电池|锂电/, "新能源"], [/医药|医疗|创新药|生物/, "医药"], [/消费|食品|白酒|家电/, "消费"], [/金融|银行|证券|保险/, "金融"], [/军工|国防/, "军工"], [/通信|5G/, "通信"], [/人工智能|AI|算力|机器人/, "AI/科技"],
  ];
  const hit = rules.find(([re]) => re.test(text));
  if (hit) return hit[1];
  const mapped = sectors.find((s) => s.etfName && text.includes(s.etfName));
  return mapped?.name ?? "未映射";
}
