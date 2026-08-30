import type { SectorQuote, SixFactor } from "../types";

export function calcSixFactor(s: SectorQuote, benchPct: number | null): SixFactor {
  const hasChange = s.change != null && Number.isFinite(s.change);
  const hasFlow = s.flow != null && Number.isFinite(s.flow);
  const ch = hasChange ? Number(s.change) : 0;
  const fl = hasFlow ? Number(s.flow) : 0;

  // Missing data is not the same thing as a neutral signal. When the core
  // market quote itself is missing, do not synthesize a directional score.
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

  const trendVote = ch > 0.5 ? 1 : ch < -0.5 ? -1 : 0;
  const momVote = ch > 1 ? 1 : ch < -1 ? -1 : 0;
  const flowYi = fl / 1e8;
  // Flow contributes only when it actually exists. A missing flow is kept as
  // "unknown" rather than being described as neutral money flow.
  const fundVote = !hasFlow ? 0 : flowYi > 1 ? 1 : flowYi < -1 ? -1 : 0;
  const relDiff = ch - (benchPct ?? 0);
  const relVote = relDiff > 0.3 ? 1 : relDiff < -0.3 ? -1 : 0;
  let volVote = 0;
  if (Math.abs(ch) > 4) volVote = -1;
  else if (Math.abs(ch) > 2.5) volVote = -0.5;
  const st = s.streak || 0;
  let streakVote = 0;
  if (st >= 3) streakVote = -0.5;
  else if (st <= -3) streakVote = 0.5;

  const votes = [trendVote, momVote, fundVote, relVote, volVote, streakVote];
  const bullN = votes.filter((v) => v >= 1).length;
  const bearN = votes.filter((v) => v <= -1).length;
  let position = Math.round(50 + bullN * 7.5 - bearN * 7.5);
  position = Math.max(10, Math.min(90, position));

  let confidence = 65 + (bullN - bearN) * 4;
  if (!hasFlow) confidence = Math.min(confidence, 55);
  confidence = Math.max(25, Math.min(92, confidence));

  let advice: string;
  let status: string;
  let level: string;
  if (!hasFlow && Math.abs(bullN - bearN) >= 2) {
    status = "信号待资金确认";
    advice = "谨慎观望";
    level = "中";
  } else if (position >= 80) {
    status = "重仓";
    advice = "积极观察";
    level = "高";
  } else if (position >= 60) {
    status = "偏强";
    advice = "正常持有";
    level = "中";
  } else if (position >= 40) {
    status = "观望";
    advice = "谨慎观望";
    level = "中";
  } else if (position >= 20) {
    status = "偏弱";
    advice = "减仓观望";
    level = "低";
  } else {
    status = "回避";
    advice = "空仓观望";
    level = "低";
  }

  const trendLabel = ch > 1 ? "强" : ch > 0 ? "偏强" : ch < -1 ? "弱" : ch < -0.5 ? "偏弱" : "震荡";
  const band = position >= 80 ? "高位" : position >= 60 ? "偏高" : position >= 40 ? "震荡" : "低位";
  const parts = [
    `趋势${trendVote > 0 ? "多" : trendVote < 0 ? "空" : "中"}`,
    `动量${momVote > 0 ? "多" : momVote < 0 ? "空" : "中"}`,
    hasFlow ? `资金${fundVote > 0 ? "多" : fundVote < 0 ? "空" : "中"}` : "资金未知",
    `相对${relVote > 0 ? "强" : relVote < 0 ? "弱" : "平"}`,
  ];
  if (Math.abs(ch) > 2.5) parts.push(`波动${Math.abs(ch) > 4 ? "高" : "偏高"}`);
  if (st >= 3) parts.push(`连涨${st}天`);
  else if (st <= -3) parts.push(`连跌${-st}天`);

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
