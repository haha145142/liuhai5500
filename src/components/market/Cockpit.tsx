import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { buildEvidence } from "@/lib/calc/evidence";
import { analyzeMarket } from "@/lib/data/server";
import { getMarketPanorama, type MarketPanorama } from "@/lib/data/market-panorama";
import { getDSKey, getDSModel } from "@/lib/storage";
import { fmtPctShort, fmtYi } from "@/lib/format";
import type { NewsItem, Snapshot } from "@/lib/types";

export function Cockpit({ snap, news }: { snap: Snapshot; news: NewsItem[] }) {
  const ev = buildEvidence(snap, news);
  const avg = snap.indices.length && snap.indices.every((i) => i.pct != null)
    ? snap.indices.reduce((s, i) => s + (i.pct || 0), 0) / snap.indices.length
    : null;
  const boards = snap.boards.filter((b) => b.change != null).slice().sort((a, b) => (b.change || 0) - (a.change || 0));
  const strongest = boards[0];
  const weakest = boards.at(-1);
  const up = snap.indices.filter((i) => (i.pct || 0) > 0).length;
  const dn = snap.indices.filter((i) => (i.pct || 0) < 0).length;
  const [panorama, setPanorama] = useState<MarketPanorama | null>(null);
  const [aiText, setAiText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const result = await getMarketPanorama();
        if (alive) setPanorama(result);
      } catch {
        if (alive) setPanorama(null);
      }
    };
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  const flow = panorama?.order ?? null;
  const flowConsistency = panorama?.validation === "consistent" ? true : panorama?.validation === "unreliable" ? false : null;

  const deep = async () => {
    if (snap.validation !== "cross_checked" && snap.validation !== "single_source" && snap.validation !== "cached_latest_trading_day") {
      setAiText("当前市场快照尚未完成数据校验，暂不生成 AI 市场结论。");
      return;
    }
    const apiKey = getDSKey();
    const model = getDSModel();
    if (!apiKey) {
      setAiText("DeepSeek 暂不可用：请先在设置中填写 Key，并点击“测试连接”。");
      return;
    }
    setBusy(true);
    try {
      const prompt = `数据状态：${snap.validation}；数据日：${snap.marketDate || "未知"}。请严格只使用以下证据：指数 ${JSON.stringify(snap.indices)}；板块 ${JSON.stringify(snap.sectors.slice(0, 8))}；资金 ${JSON.stringify(flow)}；外围 ${JSON.stringify(snap.global)}；新闻 ${JSON.stringify(news.slice(0, 8).map((n) => ({title:n.title,source:n.source,publishedAt:n.publishedAt,category:n.category,sentiment:n.sentiment})))}。按7步输出中文结论；没有证据就写“暂无可靠数据”；不得把抓取时间当成发布时间，不得把小单等同于散户。`;
      const r = await analyzeMarket({ data: { prompt, apiKey, model } });
      setAiText(r.ok ? r.text : r.error || "DeepSeek 接口暂不可用");
    } catch {
      setAiText("DeepSeek 请求失败，请检查网络、Key 或模型设置。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Glass className="market-cockpit">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted">今日投资结论</div>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">{ev.verdict}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{ev.summary}</p>
        </div>
        <div className="shrink-0 text-right"><div className={`text-2xl font-semibold tabular-nums ${ev.score >= 60 ? "tone-up" : ev.score <= 40 ? "tone-down" : "text-fg"}`}>{ev.score}</div><div className="text-[10px] text-subtle">规则评分</div></div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2"><Mini label="市场情绪" value={ev.verdict} /><Mini label="上涨 / 下跌" value={`${up} / ${dn}`} tone={avg} /><Mini label="风险" value={ev.risk} /></div>
      <div className="mt-3 rounded-2xl bg-bg-elevated/70 p-3"><div className="flex items-center justify-between text-[10px] text-subtle"><span>市场温度</span><span>{fmtPctShort(avg)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-border"><i className="block h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.min(100, Math.max(0, 50 + (avg || 0) * 10))}%` }} /></div><div className="mt-2 flex items-center justify-between text-xs"><Tone v={avg} className="font-semibold">{avg == null ? "暂无可靠数据" : avg > 1 ? "偏热" : avg > 0 ? "温和" : avg < -1 ? "偏冷" : "中性"}</Tone><span className="text-muted"><b className="tone-up">{up} 涨</b> / <b className="tone-down">{dn} 跌</b></span></div></div>
      <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-bg-elevated/70 p-3"><div className="text-[10px] text-subtle">最强板块</div><div className="mt-1 truncate text-sm font-semibold">{strongest ? strongest.name : "暂无可靠数据"}</div><Tone v={strongest?.change} className="mt-0.5 block text-xs font-semibold">{fmtPctShort(strongest?.change)}</Tone></div><div className="rounded-2xl bg-bg-elevated/70 p-3"><div className="text-[10px] text-subtle">最弱板块</div><div className="mt-1 truncate text-sm font-semibold">{weakest ? weakest.name : "暂无可靠数据"}</div><Tone v={weakest?.change} className="mt-0.5 block text-xs font-semibold">{fmtPctShort(weakest?.change)}</Tone></div></div>
      <div className="mt-3 rounded-2xl bg-bg-elevated/70 p-3">
        <div className="flex items-center justify-between gap-2"><SectionTitle title="资金验证" hint="修正后订单字段" /></div>
        {flow ? <div className="grid grid-cols-2 gap-1.5 text-xs"><Row k="主力净流入" v={fmtYi(flow.main)} tone={flow.main} /><Row k="超大单" v={fmtYi(flow.super)} tone={flow.super} /><Row k="大单" v={fmtYi(flow.large)} tone={flow.large} /><Row k="中单" v={fmtYi(flow.mid)} tone={flow.mid} /><Row k="小单" v={fmtYi(flow.small)} tone={flow.small} /><div className="flex items-center rounded-2xl bg-bg-elevated px-3 py-2 text-[10px] text-subtle">{flowConsistency === true ? "主力≈超大单+大单，口径一致" : flowConsistency === false ? "校验不通过，方向判断降级" : "正在校验资金结构"}</div></div> : <p className="text-sm text-muted">暂无可靠资金数据</p>}
        <div className="mt-2 text-[10px] leading-relaxed text-subtle">小单只是订单规模分类，不等同于散户买入/卖出。</div>
      </div>
      <p className="mt-3 text-sm text-fg">{ev.steps[6]?.body}</p>
      <button type="button" onClick={() => void deep()} disabled={busy} className="mt-3 w-full rounded-2xl bg-accent py-2.5 text-sm font-semibold text-accent-fg transition-transform active:scale-[0.98] disabled:opacity-60">{busy ? "DeepSeek 分析中…" : "深度分析"}</button>
      {aiText ? <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">{aiText}</p> : null}
      <p className="mt-2 text-[10px] text-subtle">规则引擎基于已校验证据；深度分析按需调用。未配置 Key 时请先前往 <Link to="/settings" className="text-accent">DeepSeek 设置</Link> 测试。</p>
    </Glass>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: number | null }) { const cls = tone == null || tone === 0 ? "text-fg" : tone > 0 ? "tone-up" : "tone-down"; return <div className="rounded-2xl bg-bg-elevated px-2 py-2"><div className="text-[10px] text-subtle">{label}</div><div className={`mt-0.5 text-sm font-semibold ${cls}`}>{value}</div></div>; }
function Row({ k, v, tone }: { k: string; v: string; tone?: number | null }) { const cls = tone == null || tone === 0 ? "text-fg" : tone > 0 ? "tone-up" : "tone-down"; return <div className="flex items-center justify-between rounded-2xl bg-bg-elevated px-3 py-2"><span className="text-muted">{k}</span><span className={`font-semibold tabular-nums ${cls}`}>{v}</span></div>; }
