import type { NewsItem, Snapshot } from "../types";

export type MarketScoreV2 = {
  score: number | null;
  label: "偏强" | "温和偏多" | "中性" | "温和偏空" | "偏弱" | "证据不足";
  confidence: "高" | "中" | "低";
  factors: { name: string; score: number; detail: string }[];
  basis: string;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function calcMarketScoreV2(snapshot: Snapshot, news: NewsItem[]): MarketScoreV2 {
  const indices = snapshot.indices.filter((x) => x.pct != null).map((x) => x.pct as number);
  const sectors = snapshot.sectors.filter((x) => x.available && x.change != null).map((x) => x.change as number);
  const flow = snapshot.flow;
  const global = snapshot.global.filter((x) => x.pct != null).map((x) => x.pct as number);
  const factors: MarketScoreV2["factors"] = [];

  if (indices.length) {
    const avg = indices.reduce((a, b) => a + b, 0) / indices.length;
    factors.push({ name: "核心指数", score: clamp(avg * 10, -40, 40), detail: `核心指数平均 ${avg >= 0 ? "+" : ""}${avg.toFixed(2)}%` });
  }
  if (sectors.length) {
    const up = sectors.filter((x) => x > 0).length;
    const down = sectors.filter((x) => x < 0).length;
    const avg = sectors.reduce((a, b) => a + b, 0) / sectors.length;
    const breadth = ((up - down) / Math.max(1, up + down)) * 30;
    factors.push({ name: "市场宽度", score: clamp(breadth + avg * 4, -25, 25), detail: `${up}涨 / ${down}跌 · 平均 ${avg >= 0 ? "+" : ""}${avg.toFixed(2)}%` });
  }
  if (flow) {
    const denom = Math.max(1e9, Math.abs(flow.main));
    const score = clamp((flow.main / denom) * 20, -20, 20);
    factors.push({ name: "主力资金", score, detail: `主力净${flow.main >= 0 ? "流入" : "流出"} ${Math.abs(flow.main / 1e8).toFixed(1)}亿` });
  }
  if (global.length) {
    const avg = global.reduce((a, b) => a + b, 0) / global.length;
    factors.push({ name: "外围市场", score: clamp(avg * 4, -10, 10), detail: `外围平均 ${avg >= 0 ? "+" : ""}${avg.toFixed(2)}%` });
  }
  if (news.length) {
    const positive = news.filter((n) => n.sentiment === "bull").length;
    const negative = news.filter((n) => n.sentiment === "bear").length;
    const score = clamp(((positive - negative) / Math.max(1, positive + negative)) * 5, -5, 5);
    factors.push({ name: "资讯情绪", score, detail: `${positive} 条偏积极 · ${negative} 条偏谨慎` });
  }

  if (!indices.length || !sectors.length) {
    return { score: null, label: "证据不足", confidence: "低", factors, basis: "核心指数或市场宽度缺失，不强行给方向。" };
  }
  const raw = factors.reduce((sum, x) => sum + x.score, 0);
  const score = Math.round(clamp(50 + raw, 15, 85));
  const label = score >= 68 ? "偏强" : score >= 56 ? "温和偏多" : score <= 32 ? "偏弱" : score <= 44 ? "温和偏空" : "中性";
  const usableCount = factors.length;
  const confidence: MarketScoreV2["confidence"] = usableCount >= 4 && flow ? "高" : usableCount >= 3 ? "中" : "低";
  const basis = `量化证据模型：核心指数、市场宽度、资金、外围、资讯共 ${usableCount} 个因子；AI只负责解释，不直接生成分数。`;
  return { score, label, confidence, factors, basis };
}
