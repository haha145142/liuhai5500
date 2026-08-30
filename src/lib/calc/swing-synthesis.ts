import type { FundMetrics, SectorQuote } from "../types";

export type SwingSynthesis = {
  score: number;
  level: "偏强" | "中性" | "偏弱";
  position: "低位" | "中位" | "高位";
  trend: "向上" | "震荡" | "向下";
  confidence: "高" | "中" | "低";
  support: string[];
  risks: string[];
  basis: string;
};

export function synthesizeSwing(metrics: FundMetrics | null, sector: SectorQuote | null = null): SwingSynthesis | null {
  if (!metrics || !Number.isFinite(metrics.last) || metrics.last <= 0) return null;

  const support: string[] = [];
  const risks: string[] = [];
  let score = 50;
  let evidence = 0;
  let independent = 0;

  // 1) Trend cluster: MA structure + MACD direction. Do not count these as separate votes twice.
  if (metrics.ma5 != null && metrics.ma20 != null && metrics.ma5 !== 0) {
    evidence++;
    if (metrics.ma5 > metrics.ma20) {
      score += 12;
      support.push("短中期均线偏多");
    } else {
      score -= 12;
      risks.push("短中期均线偏弱");
    }
  }
  if (metrics.ma20 != null && metrics.ma60 != null) {
    if (metrics.ma20 > metrics.ma60) {
      score += 5;
      support.push("中期趋势向上");
    } else {
      score -= 5;
      risks.push("中期趋势向下");
    }
  }
  if (Number.isFinite(metrics.macd) && Number.isFinite(metrics.dif) && Number.isFinite(metrics.dea)) {
    evidence++;
    if (metrics.dif > metrics.dea && metrics.macd > 0) {
      score += 8;
      support.push("MACD多头");
    } else if (metrics.dif < metrics.dea && metrics.macd < 0) {
      score -= 8;
      risks.push("MACD偏弱");
    }
  }
  independent++;

  // 2) Position cluster: RSI + BOLL + BIAS describe location, so cap their combined impact.
  let positionScore = 0;
  const positionParts: string[] = [];
  if (Number.isFinite(metrics.rsi)) {
    evidence++;
    if (metrics.rsi < 30) {
      positionScore += 12;
      positionParts.push("RSI超卖");
    } else if (metrics.rsi > 70) {
      positionScore -= 12;
      positionParts.push("RSI超买");
    }
  }
  if (metrics.ma20 != null && Number.isFinite(metrics.ma20) && metrics.ma20 !== 0) {
    const last = metrics.last;
    if (last <= metrics.lower) positionScore += 8;
    else if (last >= metrics.upper) positionScore -= 8;
  }
  if (Number.isFinite(metrics.bias)) {
    if (metrics.bias <= -6) positionScore += 6;
    else if (metrics.bias >= 6) positionScore -= 6;
  }
  positionScore = Math.max(-16, Math.min(16, positionScore));
  score += positionScore;
  if (positionScore >= 8) support.push(...positionParts);
  if (positionScore <= -8) risks.push(...positionParts);
  independent++;

  // 3) Volatility cluster: wide bands increase risk, but are not a directional vote.
  const bandWidth = metrics.ma20 && metrics.ma20 > 0 ? ((metrics.upper - metrics.lower) / metrics.ma20) * 100 : null;
  if (bandWidth != null && Number.isFinite(bandWidth)) {
    evidence++;
    if (bandWidth >= 6) risks.push("波动较高");
    else if (bandWidth <= 2.5) risks.push("波动偏低，弹性有限");
  }
  independent++;

  // 4) External sector confirmation is independent from the fund's own price series.
  if (sector?.change != null && Number.isFinite(sector.change)) {
    evidence++;
    if (sector.change > 0.5) {
      score += 6;
      support.push("所属基金主题走强");
    } else if (sector.change < -0.5) {
      score -= 6;
      risks.push("所属基金主题走弱");
    }
  }
  independent++;

  const clamped = Math.max(15, Math.min(85, Math.round(score)));
  const level: SwingSynthesis["level"] = clamped >= 62 ? "偏强" : clamped <= 38 ? "偏弱" : "中性";
  const position: SwingSynthesis["position"] = metrics.bandScore >= 65 ? "低位" : metrics.bandScore <= 35 ? "高位" : "中位";
  const trend: SwingSynthesis["trend"] = metrics.trendScore >= 62 ? "向上" : metrics.trendScore <= 38 ? "向下" : "震荡";

  let confidence: SwingSynthesis["confidence"] = "低";
  if (evidence >= 4 && independent >= 3) confidence = "高";
  else if (evidence >= 2) confidence = "中";

  return {
    score: clamped,
    level,
    position,
    trend,
    confidence,
    support: [...new Set(support)],
    risks: [...new Set(risks)],
    basis: `趋势${trend} · 位置${position} · ${level} · 证据 ${evidence} 项${sector?.change != null ? " · 含主题确认" : " · 暂无主题确认"}`,
  };
}
