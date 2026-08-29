import type { FundMetrics, SwingAdvice } from "../types";

function ema(series: number[], period: number): number | null {
  if (series.length < period) return null;
  const k = 2 / (period + 1);
  let e = series.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < series.length; i++) e = series[i] * k + e * (1 - k);
  return e;
}

export function calcIndicators(c: number[]): FundMetrics | null {
  if (c.length < 35) return null;
  const last = c[c.length - 1];
  const ma = (p: number) =>
    c.length < p ? null : c.slice(-p).reduce((a, b) => a + b, 0) / p;
  const ma5 = ma(5);
  const ma10 = ma(10);
  const ma20 = ma(20);
  const ma60 = c.length >= 60 ? ma(60) : null;

  const a = c.slice(-15);
  let g = 0;
  let l = 0;
  for (let i = 1; i < a.length; i++) {
    const d = a[i] - a[i - 1];
    if (d >= 0) g += d;
    else l -= d;
  }
  const rsi = l ? 100 - 100 / (1 + g / l) : 100;

  const m20 = c.slice(-20);
  const m = m20.reduce((s, v) => s + v, 0) / 20;
  const sd = Math.sqrt(m20.reduce((s, v) => s + (v - m) ** 2, 0) / 20);
  const upper = m + 2 * sd;
  const lower = m - 2 * sd;
  const bias = ma20 ? ((last - ma20) / ma20) * 100 : 0;

  const dif = (ema(c, 12) || 0) - (ema(c, 26) || 0);
  const signalSeries: number[] = [];
  for (let i = 26; i < c.length; i++) {
    const s = c.slice(0, i + 1);
    signalSeries.push((ema(s, 12) || 0) - (ema(s, 26) || 0));
  }
  const dea = ema(signalSeries, 9) || 0;
  const macd = (dif - dea) * 2;

  let bandScore = 50;
  if (rsi < 30) bandScore += 18;
  if (rsi > 70) bandScore -= 18;
  if (last <= lower) bandScore += 18;
  if (last >= upper) bandScore -= 18;
  if (bias < -8) bandScore += 12;
  if (bias > 8) bandScore -= 12;
  if (macd > 0 && dif > dea) bandScore += 5;
  if (macd < 0 && dif < dea) bandScore -= 5;
  bandScore = Math.max(0, Math.min(100, Math.round(bandScore)));

  let band = "震荡";
  let bandTone: FundMetrics["bandTone"] = "neutral";
  if (bandScore >= 70) {
    band = "低位区";
    bandTone = "low";
  } else if (bandScore >= 55) {
    band = "偏低";
    bandTone = "low";
  } else if (bandScore <= 30) {
    band = "高位区";
    bandTone = "high";
  } else if (bandScore <= 45) {
    band = "偏高";
    bandTone = "high";
  }

  let trendScore = 50;
  if (ma5 && ma20) trendScore += ((ma5 - ma20) / ma20) * 450;
  trendScore += dif > 0 ? 15 : -15;
  if (ma20 && ma60 != null) trendScore += ma20 > ma60 ? 10 : -10;
  trendScore += macd > 0 ? 8 : -8;
  trendScore = Math.max(0, Math.min(100, Math.round(trendScore)));

  let trend: string;
  if (trendScore >= 75) trend = "强势";
  else if (trendScore >= 60) trend = "偏强";
  else if (trendScore >= 40) trend = "震荡";
  else if (trendScore >= 25) trend = "偏弱";
  else trend = "弱势";

  let combo = "震荡观望";
  if (bandScore >= 55 && trendScore >= 60) combo = "超跌后的反转观察区";
  else if (bandScore >= 55 && trendScore < 40) combo = "下跌趋势中的超跌，不要盲目抄底";
  else if (bandScore <= 45 && trendScore >= 60) combo = "强势但存在高位风险";
  else if (bandScore <= 45 && trendScore < 40) combo = "注意回撤压力";
  else if (trendScore >= 60) combo = "趋势等待确认";
  else if (trendScore < 40) combo = "观望";

  let conf: FundMetrics["conf"] = "中";
  if (c.length >= 60 && Math.abs(bandScore - 50) > 20) conf = "高";
  if (c.length < 40) conf = "低";

  let sigStrength = 0;
  const sigConds: string[] = [];
  if (rsi < 30 || rsi > 70) {
    sigStrength += 25;
    sigConds.push("RSI极值");
  }
  if ((dif > dea && macd > 0) || (dif < dea && macd < 0)) {
    sigStrength += 25;
    sigConds.push("MACD趋势");
  }
  if (last <= lower || last >= upper) {
    sigStrength += 25;
    sigConds.push("BOLL轨道");
  }
  if (Math.abs(bias) >= 5) {
    sigStrength += 25;
    sigConds.push("BIAS偏离");
  }

  return {
    last, ma5, ma10, ma20, ma60, rsi, bias, upper, lower, macd, dif, dea,
    band, bandTone, trend, bandScore, trendScore, combo, conf, sigStrength, sigConds,
  };
}

export function calcSwingTrade(
  metrics: FundMetrics | null,
  cost: number,
  price: number,
): SwingAdvice | null {
  if (!metrics) return null;
  const p = price || metrics.last || 0;
  const rsi = metrics.rsi || 50;
  const bias = metrics.bias || 0;
  const band = metrics.bandScore || 50;
  const trend = metrics.trendScore || 50;
  const upper = metrics.upper || 0;
  const lower = metrics.lower || 0;
  const ma20 = metrics.ma20 || 0;

  const amplitude = upper && lower && ma20 ? ((upper - lower) / ma20) * 100 : Math.abs(bias) + 3;
  const step = Math.max(1.5, Math.min(6, amplitude * 0.6));
  const gainPct = cost > 0 && p ? ((p - cost) / cost) * 100 : null;

  const trendFactor = 1 - Math.abs(trend - 50) / 50;
  const bandFactor = 1 - Math.abs(band - 50) / 50;
  const rsiFactor = rsi >= 30 && rsi <= 70 ? 1 : rsi >= 20 && rsi <= 80 ? 0.6 : 0.2;
  let env = Math.round(50 * trendFactor * bandFactor * rsiFactor);
  env += (amplitude >= 3 ? 8 : 0) + (amplitude >= 5 ? 10 : 0);
  if (trend < 25 || trend > 78) env = Math.min(env, 38);
  env = Math.max(0, Math.min(100, env));

  const allowT = env >= 55 && trend >= 25 && trend <= 78;
  let envLevel = "偏弱";
  let envText = "振幅不足，减少操作";
  if (env >= 70) {
    envLevel = "优质";
    envText = "震荡充分，做T窗口好";
  } else if (env >= 55) {
    envLevel = "一般";
    envText = "可少量做T";
  }
  if (!allowT) {
    envLevel = "不宜做T";
    envText = trend > 78 ? "趋势行情禁止做T，以免卖飞" : "趋势偏弱，禁止做T以免接刀";
  }

  const buyGrid = p * (1 - step / 100);
  const sellGrid = p * (1 + step / 100);

  let action = "观望";
  let reason = "信号不明确";
  if (!allowT) {
    action = "持有观察";
    reason = envText;
  } else if (rsi < 32 || (lower && p <= lower) || bias < -6) {
    action = "低吸观察";
    reason = "超卖/触及下轨，等待收盘确认后再考虑加仓";
  } else if (rsi > 68 || (upper && p >= upper) || bias > 6) {
    action = "减仓提示";
    reason = "超买/触及上轨，震荡市可高抛一部分";
  } else if (gainPct != null && gainPct > step * 1.2) {
    action = "卖出提示";
    reason = `相对成本已有 ${gainPct.toFixed(1)}% 浮盈，可按网格落袋一部分`;
  } else {
    action = "网格等待";
    reason = `步长约 ${step.toFixed(1)}%，高抛 ${sellGrid.toFixed(4)} / 低吸 ${buyGrid.toFixed(4)}`;
  }

  return { env, envLevel, envText, allowT, buyGrid, sellGrid, action, reason };
}
