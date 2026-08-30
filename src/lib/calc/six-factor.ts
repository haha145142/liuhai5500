import type { SectorQuote, SixFactor } from "../types";

/**
 * Evidence model for sector/market direction.
 * Price-derived signals are intentionally grouped into one price cluster so
 * that trend + momentum do not count the same move multiple times.
 */
export function calcSixFactor(s: SectorQuote, benchPct: number | null): SixFactor {
  const hasChange = s.change != null && Number.isFinite(s.change);
  const hasFlow = s.flow != null && Number.isFinite(s.flow);
  const hasBench = benchPct != null && Number.isFinite(benchPct);
  const ch = hasChange ? Number(s.change) : 0;
  const fl = hasFlow ? Number(s.flow) : 0;
  const relDiff = hasBench ? ch - Number(benchPct) : null;
  const st = Number.isFinite(s.streak) ? s.streak || 0 : 0;

  if (!hasChange) {
    return {
      position: 50,
      confidence: 25,
      bullN: 0,
      bearN: 0,
      advice: "数据不足",
      status: "暂无可靠判断",
      level: "—",
      trendLabel: "暂无数据",
      band: "暂无数据",
      ch: 0,
      fl: 0,
      basis: "缺少可靠板块行情，暂不生成方向性结论",
    };
  }

  // One price-cluster vote: trend + momentum describe the same price path.
  const priceVote = ch > 1 ? 1 : ch < -1 ? -1 : ch > 0.3 ? 0.5 : ch < -0.3 ? -0.5 : 0;
  const flowVote = hasFlow ? (fl > 1e8 ? 1 : fl < -1e8 ? -1 : 0) : null;
  const relativeVote = relDiff == null ? null : relDiff > 0.3 ? 1 : relDiff < -0.3 ? -1 : 0;

  // Streak and volatility are risk modifiers, not independent direction votes.
  const volatilityRisk = Math.abs(ch) > 4 ? 2 : Math.abs(ch) > 2.5 ? 1 : 0;
  const streakRisk = Math.abs(st) >= 3 ? 1 : 0;

  const evidence = [priceVote, flowVote, relativeVote].filter((v): v is number => v != null);
  const bullN = evidence.filter((v) => v > 0.5).length;
  const bearN = evidence.filter((v) => v < -0.5).length;
  const score = evidence.reduce((sum, v) => sum + v, 0);
  let position = Math.round(50 + score * 15);
  if (volatilityRisk >= 2) position -= score > 0 ? 3 : score < 0 ? -3 : 0;
  position = Math.max(10, Math.min(90, position));

  let confidence = 48;
  if (hasFlow) confidence += 20;
  if (hasBench) confidence += 12;
  if (evidence.length >= 3 && Math.abs(score) >= 1.5) confidence += 10;
  if (volatilityRisk > 0) confidence -= volatilityRisk * 4;
  if (streakRisk > 0) confidence -= 2;
  confidence = Math.max(25, Math.min(92, Math.round(confidence)));

  let advice = "谨慎观望";
  let status = "观望";
  let level = "中";
  if (!hasFlow && Math.abs(score) >= 1) {
    status = "信号待资金确认";
    advice = "谨慎观望";
  } else if (position >= 78 && confidence >= 65) {
    status = "强势";
    advice = "积极观察";
    level = "高";
  } else if (position >= 60) {
    status = "偏强";
    advice = "正常持有";
  } else if (position < 22 && confidence >= 65) {
    status = "回避";
    advice = "空仓观望";
    level = "低";
  } else if (position < 40) {
    status = "偏弱";
    advice = "减仓观望";
    level = "低";
  }

  const trendLabel = ch > 1 ? "强" : ch > 0 ? "偏强" : ch < -1 ? "弱" : ch < -0.5 ? "偏弱" : "震荡";
  const band = position >= 78 ? "高位" : position >= 60 ? "偏高" : position >= 40 ? "震荡" : "低位";
  const parts = [
    `价格${priceVote > 0 ? "偏多" : priceVote < 0 ? "偏空" : "中性"}`,
    hasFlow ? `资金${flowVote! > 0 ? "偏多" : flowVote! < 0 ? "偏空" : "中性"}` : "资金未知",
    hasBench ? `相对${relativeVote! > 0 ? "强" : relativeVote! < 0 ? "弱" : "平"}` : "基准未知",
  ];
  if (volatilityRisk > 0) parts.push(`波动${volatilityRisk >= 2 ? "高" : "偏高"}`);
  if (st >= 3) parts.push(`连涨${st}天`);
  else if (st <= -3) parts.push(`连跌${-st}天`);
  if (evidence.length < 3) parts.push("证据不完整");

  return {
    position,
    confidence,
    bullN,
    bearN,
    advice,
    status,
    level,
    trendLabel,
    band,
    ch,
    fl,
    basis: parts.join(" · "),
  };
}
