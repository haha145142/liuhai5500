import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Glass, Tone, DataStatus } from "@/components/ui/Glass";
import { buildEvidence } from "@/lib/calc/evidence";
import { useApp } from "@/lib/store";

export function TodayAssessment() {
  const snapshot = useApp((s) => s.snapshot);
  const news = useApp((s) => s.news);
  const result = useMemo(() => snapshot ? buildEvidence(snapshot, news?.items || []) : null, [news, snapshot]);

  const score = result?.score ?? null;
  const scoreLabel = score == null ? "等待数据" : score >= 68 ? "偏强" : score >= 56 ? "温和偏多" : score <= 32 ? "偏弱" : score <= 44 ? "温和偏空" : "中性";
  const scoreTone = score == null ? 0 : score - 50;
  const coverage = snapshot ? `${result?.verdict === "证据不足" ? "证据不足" : `${result?.confidence || "一般"} · 覆盖${result ? `${result.steps.length}/7` : "—"}`}` : "等待行情数据";
  const step7 = result?.steps?.find((x) => x.id === "7");

  return (
    <section className="mt-3" aria-label="今日评估">
      <Glass className="overflow-hidden rounded-[24px] border border-white/75 bg-white/54 p-3 shadow-[0_16px_44px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.96)] backdrop-blur-[22px] saturate-150">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-[16px]">📝</span>
              <div>
                <div className="text-[16px] font-semibold tracking-tight text-fg">今日评估</div>
                <div className="mt-0.5 text-[9px] text-muted">交易日自动评分 · 事实与推断分开</div>
              </div>
            </div>
          </div>
          <DataStatus mode={snapshot?.validation === "cross_checked" ? "live" : "latest"} detail={snapshot?.marketDate || undefined} />
        </div>

        <div className="mt-3 rounded-[18px] bg-white/58 p-3 ring-1 ring-white/80">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[9px] text-muted">今日市场评分</div>
              <Tone v={scoreTone} className="mt-0.5 block text-[28px] font-bold leading-none tracking-tight">{score == null ? "—" : score}</Tone>
            </div>
            <div className="text-right">
              <div className="text-[13px] font-semibold text-fg">{scoreLabel}</div>
              <div className="mt-1 text-[8px] text-subtle">{coverage}</div>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gradient-to-r from-red-200 via-slate-200 to-emerald-200">
            <span className="block h-full w-2 rounded-full bg-slate-900/85 shadow-[0_0_0_3px_rgba(255,255,255,.8)]" style={{ marginLeft: `calc(${Math.max(4, Math.min(96, score ?? 50))}% - 4px)` }} />
          </div>
        </div>

        <div className="mt-2.5 rounded-[18px] bg-white/50 px-3 py-2.5">
          <div className="text-[11px] font-semibold text-fg">今天怎么看</div>
          <p className="mt-1 text-[10px] leading-[1.55] text-muted">{result?.summary || "等待可靠行情、资金、新闻与政策数据后生成今日评估。"}</p>
        </div>

        {step7 ? <div className="mt-2 rounded-[16px] border border-blue-200/70 bg-blue-50/45 p-2.5"><div className="text-[10px] font-semibold text-blue-700">综合判断</div><p className="mt-1 text-[9px] leading-[1.5] text-muted">{step7.body}</p></div> : null}

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {result?.steps?.slice(0, 6).map((step) => (
            <div key={step.id} className="rounded-[14px] bg-white/54 px-2.5 py-2 ring-1 ring-white/70">
              <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-medium text-fg">{step.title}</span><span className="text-[8px] text-subtle">{step.evidence}</span></div>
              <p className="mt-1 line-clamp-2 text-[8px] leading-[1.45] text-muted">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 text-[8px] text-subtle">
          <span>单日评分只反映当前证据，不代表后市确定方向。</span>
          <Link to="/ai" className="shrink-0 rounded-full border border-blue-200/70 bg-white/55 px-2.5 py-1 text-[9px] font-medium text-blue-600">看完整证据链 →</Link>
        </div>
      </Glass>
    </section>
  );
}
