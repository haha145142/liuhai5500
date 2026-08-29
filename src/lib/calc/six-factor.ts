import type { SectorQuote, SixFactor } from "../types";

export function calcSixFactor(s: SectorQuote, benchPct: number | null): SixFactor {
  const ch = s.change ?? 0;
  const fl = s.flow ?? 0;
  const trendVote = ch > 0.5 ? 1 : ch < -0.5 ? -1 : 0;
  const momVote = ch > 1 ? 1 : ch < -1 ? -1 : 0;
  const flowYi = fl / 1e8;
  const fundVote = flowYi > 1 ? 1 : flowYi < -1 ? -1 : 0;
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
  if (s.flow == null) confidence -= 6;
  confidence = Math.max(45, Math.min(92, confidence));

  let advice: string;
  let status: string;
  let level: string;
  if (position >= 80) {
    status = "重仓";
    advice = "积极加仓";
    level = "高";
  } else if (position >= 60) {
    status = "加仓持有";
    advice = "正常持有";
    level = "中";
  } else if (position >= 40) {
    status = "观望";
    advice = "谨慎观望";
    level = "中";
  } else if (position >= 20) {
    status = "减仓谨慎";
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
    `资金${fundVote > 0 ? "多" : fundVote < 0 ? "空" : "中"}`,
    `相对${relVote > 0 ? "强" : relVote < 0 ? "弱" : "平"}`,
  ];
  if (Math.abs(ch) > 2.5) parts.push(`波动${Math.abs(ch) > 4 ? "高" : "偏高"}`);
  if (st >= 3) parts.push(`连涨${st}天`);
  else if (st <= -3) parts.push(`连跌${-st}天`);

  return {
    position, confidence, bullN, bearN, advice, status, level, trendLabel, band, ch, fl,
    basis: parts.join(" · "),
  };
}
