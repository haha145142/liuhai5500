import type { EvidenceResult, NewsItem, Snapshot } from "../types";
import { fmtPctShort, fmtYi } from "../format";
import { isWeekend } from "../market-hours";

function policyHit(title: string) {
  return /政策|国务院|央行|财政部|证监会|发改委|工信部|金融监管|降准|降息|LPR|MLF|国常会/.test(title);
}

export function buildEvidence(snap: Snapshot, news: NewsItem[]): EvidenceResult {
  const idx = snap.indices;
  const vals = snap.sectors.filter((s) => s.available && s.change != null);
  const q = snap.flow;
  const weekend = isWeekend();
  const strong = vals.filter((x) => x.change != null && x.flow != null && x.change > 0 && x.flow > 0).sort((a, b) => (b.flow ?? 0) - (a.flow ?? 0)).slice(0, 3);
  const weak = vals.filter((x) => x.change != null && x.flow != null && x.change < 0 && x.flow < 0).sort((a, b) => (a.flow ?? 0) - (b.flow ?? 0)).slice(0, 3);
  const checkedSectors = vals.filter((x) => x.validation === "cross_checked").length;
  const usableIndices = idx.filter((x) => x.pct != null).length;

  const step1Body = idx.length ? idx.map((x) => `${x.name} ${x.pct != null ? fmtPctShort(x.pct) : "暂无可靠数据"}`).join(" ｜ ") : weekend ? "周末休市，指数使用最近交易日数据" : "指数数据暂无可靠数据";
  const avg = vals.length ? vals.reduce((a, x) => a + (x.change ?? 0), 0) / vals.length : null;
  const step1Extra = vals.length ? `板块 ${vals.filter((x) => (x.change ?? 0) > 0).length}涨${vals.filter((x) => (x.change ?? 0) < 0).length}跌，平均 ${fmtPctShort(avg)}${checkedSectors ? `，其中 ${checkedSectors} 个板块完成 ETF 方向交叉检查` : ""}` : "暂无板块数据";

  let step2 = weekend ? "周末休市，使用最近交易日市场反应。" : "板块数据暂无可靠数据";
  if (vals.length) {
    if (strong.length >= 2) step2 = `市场有明显反应，${strong.length} 个板块涨幅与资金流向同时为正：${strong.map((x) => `${x.name} ${fmtPctShort(x.change)}`).join(" · ")}`;
    else if (weak.length >= 2) step2 = `市场反应偏冷，${weak.length} 个板块跌幅与资金流向同时为负：${weak.map((x) => `${x.name} ${fmtPctShort(x.change)}`).join(" · ")}`;
    else step2 = "市场反应平淡，涨跌分化，暂无明确主线。";
  }

  let step3 = "资金数据暂无可靠数据";
  if (q) {
    step3 = `订单规模净流${q.main >= 0 ? "入" : "出"} ${fmtYi(Math.abs(q.main))}。超大单 ${fmtYi(q.super)} · 大单 ${fmtYi(q.large)} · 中单 ${fmtYi(q.mid)} · 小单 ${fmtYi(q.small)}`;
    if (q.main > 0 && strong.length >= 2) step3 += "。资金与多板块上涨形成共振。";
    else if (q.main < 0 && weak.length >= 2) step3 += "。资金与多板块下跌形成共振。";
    else step3 += "。资金与板块尚未形成明确共振。";
  }

  const techNews = news.filter((n) => /半导体|芯片|算力|AI|光模块|通信|机器人|科技/.test(n.title));
  const step4 = news.length ? `已读取 ${news.length} 条资讯${techNews.length ? `，其中 ${techNews.length} 条科技相关` : ""}。${techNews[0] ? `最近：${techNews[0].title}` : ""}` : "资讯源暂不可用";
  const policyNews = news.filter((n) => policyHit(n.title));
  const step5 = policyNews.length ? `政策/宏观 ${policyNews.length} 条：${policyNews.slice(0, 2).map((n) => n.title).join("；")}` : "暂无政策类新闻";
  const g = snap.global;
  const step6 = g.length ? g.map((x) => `${x.name} ${x.pct != null ? fmtPctShort(x.pct) : "暂无可靠数据"}`).join(" · ") : "外围数据暂无可靠数据";

  let bull = 0; let bear = 0;
  if (strong.length >= 2) bull += 2; else if (strong.length === 1) bull += 1;
  if (weak.length >= 2) bear += 2; else if (weak.length === 1) bear += 1;
  if (q && q.main > 0) bull += 2; else if (q && q.main < 0) bear += 2;
  if (policyNews.length >= 3) bull += 2; else if (policyNews.length >= 1) bull += 1;
  const posNews = news.filter((n) => /涨|升|新高|流入|利好|突破|反弹/.test(n.title)).length;
  const negNews = news.filter((n) => /跌|崩|跳水|利空|制裁|冲突|暴雷|处罚/.test(n.title)).length;
  if (posNews > negNews * 2) bull += 1;
  if (negNews > posNews * 2) bear += 1;

  const evidenceCoverage = [usableIndices > 0, vals.length > 0, q != null, news.length > 0, g.length > 0].filter(Boolean).length;
  const crossCheckedCoverage = [usableIndices > 0, checkedSectors > 0, q != null, news.some((n) => n.publishedAt != null), g.length > 0].filter(Boolean).length;
  let verdict = "中性震荡"; let duration = "方向不明"; let confidence = "一般";
  if (weekend) { verdict = "周末观望"; duration = "下周一确认"; confidence = "周末模式"; }
  else if (evidenceCoverage < 3) { verdict = "证据不足"; duration = "等待更多数据"; confidence = "低"; }
  else if (bull - bear >= 3) { verdict = "偏利好"; duration = "短期可持续"; confidence = crossCheckedCoverage >= 4 ? "较高" : "一般"; }
  else if (bull - bear >= 1) { verdict = "温和偏多"; duration = "短期观望"; confidence = crossCheckedCoverage >= 3 ? "一般" : "偏低"; }
  else if (bear - bull >= 3) { verdict = "偏利空"; duration = "中期谨慎"; confidence = crossCheckedCoverage >= 4 ? "较高" : "一般"; }
  else if (bear - bull >= 1) { verdict = "温和偏空"; duration = "短期观望"; confidence = crossCheckedCoverage >= 3 ? "一般" : "偏低"; }

  const step7 = weekend
    ? "现在是周末，A股不开盘。以上市场数字沿用最近完成交易日数据，周一开盘后重新验证。"
    : `综合判断：${verdict}。持续性：${duration}。置信度：${confidence}。证据覆盖 ${evidenceCoverage}/5，交叉验证 ${crossCheckedCoverage}/5${strong.length ? `；关注：${strong.map((x) => x.name).join("、")}` : ""}${weak.length ? `；回避：${weak.map((x) => x.name).join("、")}` : ""}。仅供参考，不构成投资建议。`;

  const score = weekend || evidenceCoverage < 3 ? 50 : Math.max(15, Math.min(85, 50 + (bull - bear) * 8));
  const risk = avg == null ? "数据不足" : Math.abs(avg) > 1.2 ? "中高" : "中等";
  const summary = weekend ? "周末休市，今天不做实时仓位判断，市场数据沿用最近交易日。" : evidenceCoverage < 3 ? "目前关键证据不足，不强行给出方向性结论。" : avg == null ? "板块数据不足，暂不判断市场波动风险。" : `今日大盘整体${avg > 0.15 ? "偏暖" : avg < -0.15 ? "偏冷" : "震荡"}，${verdict}。`;

  return { steps: [
    { id: "1", title: "发生了什么", body: `${step1Body}。${step1Extra}`, evidence: vals.length ? `板块平均 ${fmtPctShort(avg)}` : "暂无板块数据" },
    { id: "2", title: "市场有没有反应", body: step2, evidence: `强势 ${strong.length} · 弱势 ${weak.length}` },
    { id: "3", title: "资金有没有确认", body: step3, evidence: q ? `主力 ${fmtYi(q.main)}` : "暂无可靠数据" },
    { id: "4", title: "新闻有没有催化", body: step4, evidence: news.length ? `${news.length} 条` : "暂无" },
    { id: "5", title: "政策有没有支持", body: step5, evidence: policyNews.length ? `${policyNews.length} 条政策` : "暂无" },
    { id: "6", title: "外围有没有共振", body: step6, evidence: g.length ? `${g.length} 个外围品种` : "暂无" },
    { id: "7", title: "最后判断", body: step7, evidence: `多空差 ${bull - bear}` },
  ], verdict, duration, confidence, summary, risk, score };
}

export function moneyBehavior(_news: NewsItem[]): { inst: number; hot: number; retail: number; judge: string } {
  return { inst: 0, hot: 0, retail: 0, judge: "暂无可靠的机构/游资/散户资金分类数据；不能从新闻关键词推断真实资金行为。" };
}
