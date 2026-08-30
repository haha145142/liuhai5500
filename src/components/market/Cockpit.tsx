import { useState } from "react";
import { Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { buildEvidence } from "@/lib/calc/evidence";
import { analyzeMarket } from "@/lib/data/server";
import { fmtPctShort, fmtYi } from "@/lib/format";
import type { NewsItem, Snapshot } from "@/lib/types";

export function Cockpit({ snap, news }: { snap: Snapshot; news: NewsItem[] }) {
  const ev = buildEvidence(snap, news);
  const avg = snap.indices.length && snap.indices.every((i) => i.pct != null)
    ? snap.indices.reduce((s, i) => s + (i.pct || 0), 0) / snap.indices.length
    : null;
  const boards = snap.boards.filter((b) => b.change != null);
  const strongest = boards[0];
  const weakest = boards[boards.length - 1];
  const up = snap.indices.filter((i) => (i.pct || 0) > 0).length;
  const dn = snap.indices.filter((i) => (i.pct || 0) < 0).length;
  const flow = snap.flow;
  const flowConsistency = flow
    ? Math.abs(flow.main - (flow.super + flow.large)) <= Math.max(50_000_000, Math.abs(flow.main) * 0.12)
    : null;
  const [aiText, setAiText] = useState("");
  const [busy, setBusy] = useState(false);

  const deep = async () => {
    if (snap.validation !== "cross_checked" && snap.validation !== "single_source" && snap.validation !== "cached_latest_trading_day") {
      setAiText("当前市场快照尚未完成数据校验，暂不生成 AI 市场结论。");
      return;
    }
    setBusy(true);
    try {
      const prompt = `数据状态：${snap.validation}；数据日：${snap.marketDate || "未知"}。请严格只使用以下证据：指数 ${JSON.stringify(snap.indices)}；板块 ${JSON.stringify(snap.sectors.slice(0, 8))}；资金 ${JSON.stringify(snap.flow)}；外围 ${JSON.stringify(snap.global)}；新闻 ${JSON.stringify(news.slice(0, 8).map((n) => ({title:n.title,source:n.source,publishedAt:n.publishedAt,category:n.category,sentiment:n.sentiment})))}。按7步输出中文结论；没有证据就写“暂无可靠数据”；不得把抓取时间当成发布时间，不得把小单等同于散户。`;
      const r = await analyzeMarket({ data: { prompt } });
      setAiText(r.ok ? r.text : r.error || "AI 接口暂不可用");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Glass>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-muted">今日投资结论</div>
            <h3 className="mt-1 text-lg font-semibold tracking-tight">{ev.verdict}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{ev.summary}</p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-semibold tabular-nums ${ev.score >= 60 ? "tone-up" : ev.score <= 40 ? "tone-down" : "text-fg"}`}>{ev.score}</div>
            <div className="text-[10px] text-subtle">规则评分</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Mini label="市场情绪" value={ev.verdict} />
          <Mini label="上涨 / 下跌" value={`${up} / ${dn}`} tone={avg} />
          <Mini label="风险" value={ev.risk} />
        </div>
        <p className="mt-3 text-sm text-fg">{ev.steps[6]?.body}</p>
        <button type="button" onClick={() => void deep()} disabled={busy} className="mt-3 w-full rounded-2xl bg-accent py-2.5 text-sm font-semibold text-accent-fg transition-transform active:scale-[0.98] disabled:opacity-60">{busy ? "分析中…" : "深度分析"}</button>
        {aiText ? <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">{aiText}</p> : null}
        <p className="mt-2 text-[10px] text-subtle">规则引擎基于已校验证据；深度分析按需调用。不构成投资建议。</p>
      </Glass>

      <Glass>
        <SectionTitle title="市场温度计" hint="情绪" />
        <div className="flex items-end justify-between">
          <div>
            <Tone v={avg} className="text-xl font-semibold">{avg == null ? "暂无可靠数据" : avg > 1 ? "偏热" : avg > 0 ? "温和" : avg < -1 ? "偏冷" : "中性"}</Tone>
            <div className="text-xs text-muted">{fmtPctShort(avg)}</div>
          </div>
          <div className="text-xs text-muted"><b className="tone-up">{up} 涨</b> / <b className="tone-down">{dn} 跌</b></div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border"><i className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, 50 + (avg || 0) * 10))}%` }} /></div>
      </Glass>

      <Glass>
        <SectionTitle title="市场扫描" hint="最强 / 最弱" />
        {strongest && weakest ? (
          <div className="space-y-2 text-sm">
            <Row k="最强" v={`${strongest.name} ${fmtPctShort(strongest.change)}`} tone={strongest.change} />
            <Row k="最弱" v={`${weakest.name} ${fmtPctShort(weakest.change)}`} tone={weakest.change} />
            <Row k="资金" v={flow ? `主力 ${fmtYi(flow.main)}` : "暂无可靠数据"} tone={flow?.main} />
          </div>
        ) : <p className="text-sm text-muted">暂无可靠数据</p>}
      </Glass>

      <Glass>
        <SectionTitle title="资金验证" hint="订单规模" />
        {flow ? (
          <div className="space-y-2 text-sm">
            <Row k="主力净流入" v={fmtYi(flow.main)} tone={flow.main} />
            <Row k="超大单" v={fmtYi(flow.super)} tone={flow.super} />
            <Row k="大单" v={fmtYi(flow.large)} tone={flow.large} />
            <Row k="中单" v={fmtYi(flow.mid)} tone={flow.mid} />
            <Row k="小单" v={fmtYi(flow.small)} tone={flow.small} />
            <div className="pt-1 text-[10px] text-subtle">{flowConsistency === true ? "主力≈超大单+大单，内部口径一致" : flowConsistency === false ? "主力与超大单+大单存在明显偏差，谨慎解读" : "暂无足够资金数据完成一致性校验"}</div>
            <div className="text-[10px] text-subtle">小单仅代表订单规模分类，不等同于“散户买入/卖出”。</div>
          </div>
        ) : <p className="text-sm text-muted">暂无可靠资金数据</p>}
      </Glass>
    </>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  const cls = tone == null || tone === 0 ? "text-fg" : tone > 0 ? "tone-up" : "tone-down";
  return <div className="rounded-2xl bg-bg-elevated px-2 py-2"><div className="text-[10px] text-subtle">{label}</div><div className={`mt-0.5 text-sm font-semibold ${cls}`}>{value}</div></div>;
}

function Row({ k, v, tone }: { k: string; v: string; tone?: number | null }) {
  const cls = tone == null || tone === 0 ? "text-fg" : tone > 0 ? "tone-up" : "tone-down";
  return <div className="flex items-center justify-between rounded-2xl bg-bg-elevated px-3 py-2"><span className="text-muted">{k}</span><span className={`font-semibold tabular-nums ${cls}`}>{v}</span></div>;
}