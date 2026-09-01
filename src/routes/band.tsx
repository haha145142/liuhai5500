import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EmptyNote, Glass, SectionTitle, Tone, DataStatus } from "@/components/ui/Glass";
import { calcSwingTrade } from "@/lib/calc/indicators";
import { fmtPctShort, fmtPrice } from "@/lib/format";
import { selectFundDisplayQuote } from "@/lib/data/quote-mode";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/band")({ component: BandPage });

type HoldingLike = { code: string; name: string; shares: number; cost: number };

function BandPage() {
  const portfolio = useApp((s) => s.portfolio) as HoldingLike[];
  const funds = useApp((s) => s.funds);

  if (!portfolio.length) {
    return (
      <Glass>
        <EmptyNote>添加持仓后，这里会显示波段信号与趋势强弱。</EmptyNote>
      </Glass>
    );
  }

  return (
    <div className="space-y-3 pb-3">
      <Glass className="mb-0 px-4 py-3">
        <SectionTitle title="📊 波段信号 · 趋势强弱" hint="一眼判断" />
        <p className="mt-[-4px] text-[11px] leading-[1.45] text-muted">
          上面看波段位置，下面看趋势方向；颜色和分数只服务于一个问题：现在到底是在变强还是变弱。
        </p>
      </Glass>

      <div className="space-y-3">
        {portfolio.map((holding) => (
          <FundSignalGroup key={holding.code} holding={holding} fund={funds[holding.code]} />
        ))}
      </div>
    </div>
  );
}

function FundSignalGroup({ holding, fund }: { holding: HoldingLike; fund: any }) {
  const [expanded, setExpanded] = useState(false);
  const metrics = fund?.metrics;
  const quote = selectFundDisplayQuote(fund);
  const price = quote.price;
  const swing = calcSwingTrade(metrics ?? null, holding.cost, price ?? 0);
  const statusMode =
    quote.mode === "live_estimate"
      ? "live"
      : quote.mode === "official_today"
        ? "official"
        : quote.mode === "latest_official"
          ? "latest"
          : "unavailable";

  const bandScore = metrics?.bandScore ?? null;
  const trendScore = metrics?.trendScore ?? null;
  const bandLabel = metrics?.band ?? "—";
  const trendLabel = metrics?.trend ?? "—";

  return (
    <section>
      <div className="mb-2 px-1">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold tracking-tight text-fg">
              {fund?.name || holding.name}
            </h3>
            <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-muted">
              <span>{holding.code}</span>
              <span>·</span>
              <DataStatus mode={statusMode} detail={quote.dataDate || undefined} />
            </div>
          </div>
          <Tone v={quote.pct} className="shrink-0 text-[18px] font-bold leading-none">
            {fmtPctShort(quote.pct)}
          </Tone>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SignalCard
          title="波段信号"
          label={bandLabel}
          score={bandScore}
          tone={metrics?.bandTone ?? "neutral"}
          subtitle={bandSubtitle(metrics?.bandTone, bandLabel)}
          markerText={bandScore == null ? "—" : `${bandScore}/100`}
          compact="波段位置"
        />
        <SignalCard
          title="趋势强弱"
          label={trendLabel}
          score={trendScore}
          tone={trendTone(trendScore)}
          subtitle={trendSubtitle(trendScore, trendLabel)}
          markerText={trendScore == null ? "—" : `${trendScore}/100`}
          compact="趋势方向"
        />
      </div>

      <Glass className="mb-0 mt-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="block w-full text-left"
          aria-expanded={expanded}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-fg">组合判断</div>
              <p className="mt-0.5 text-[10.5px] leading-[1.45] text-muted">
                {metrics?.combo || "暂无可靠组合判断"}
              </p>
            </div>
            <span className="mt-0.5 shrink-0 rounded-full bg-white/55 px-2 py-0.5 text-[9px] font-semibold text-muted">
              {expanded ? "收起详情" : "指标详情"} {expanded ? "⌃" : "⌄"}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-subtle">
            <span>
              RSI {formatMetric(metrics?.rsi, 1)} · BIAS {formatMetric(metrics?.bias, 2)}% · MACD {formatMetric(metrics?.macd, 3)}
            </span>
            <span className="shrink-0 font-medium">置信 {metrics?.conf ?? "—"}</span>
          </div>
        </button>

        {expanded ? (
          <div className="mt-2.5 border-t border-black/[.045] pt-2.5">
            {metrics ? (
              <>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <Stat k="RSI" v={formatMetric(metrics.rsi, 1)} />
                  <Stat k="BIAS" v={`${formatMetric(metrics.bias, 2)}%`} />
                  <Stat k="MACD" v={formatMetric(metrics.macd, 3)} />
                  <Stat k="BOLL上轨" v={fmtPrice(metrics.upper, 4)} />
                  <Stat k="BOLL下轨" v={fmtPrice(metrics.lower, 4)} />
                  <Stat k="MA20" v={fmtPrice(metrics.ma20, 4)} />
                </div>

                {swing ? (
                  <div className="mt-2 rounded-[14px] bg-bg-elevated p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-[12px] text-fg">{swing.action}</b>
                      <span className="text-[9px] font-semibold text-muted">做 T 环境 {swing.envLevel}</span>
                    </div>
                    <p className="mt-0.5 text-[9.5px] leading-[1.45] text-muted">{swing.reason}</p>
                    {swing.allowT && swing.buyGrid != null && swing.sellGrid != null ? (
                      <p className="mt-1 text-[9px] text-subtle">
                        低吸 {fmtPrice(swing.buyGrid, 4)} · 高抛 {fmtPrice(swing.sellGrid, 4)} · 环境 {swing.env}/100
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-[10px] text-muted">净值历史不足，暂时没有可靠指标。</p>
            )}
          </div>
        ) : null}
      </Glass>
    </section>
  );
}

function SignalCard({
  title,
  label,
  score,
  tone,
  subtitle,
  markerText,
  compact,
}: {
  title: string;
  label: string;
  score: number | null;
  tone: "low" | "high" | "neutral";
  subtitle: string;
  markerText: string;
  compact: string;
}) {
  const pct = score == null ? 50 : Math.max(0, Math.min(100, score));
  const toneClass =
    tone === "low"
      ? "border-sky-200/80 bg-white/72"
      : tone === "high"
        ? "border-orange-200/80 bg-white/72"
        : "border-white/80 bg-white/68";
  const labelClass =
    tone === "low"
      ? "text-sky-600"
      : tone === "high"
        ? "text-orange-600"
        : "text-slate-600";

  return (
    <Glass className={`mb-0 min-h-[164px] border px-3 py-3 ${toneClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-medium text-muted">{title}</div>
          <div className={`mt-1 text-[22px] font-bold leading-none ${labelClass}`}>{label}</div>
        </div>
        <div className="text-right">
          <div className="text-[8px] uppercase tracking-[0.08em] text-subtle">{compact}</div>
          <div className={`mt-0.5 text-[14px] font-bold tabular-nums ${labelClass}`}>{markerText}</div>
        </div>
      </div>

      <p className="mt-2 min-h-[28px] text-[9.5px] leading-[1.45] text-muted">{subtitle}</p>

      <div className="mt-3">
        <div
          className="relative h-2.5 overflow-hidden rounded-full"
          style={{
            background:
              "linear-gradient(90deg,#ef5350 0%,#f6a21a 26%,#8ca1bb 49%,#4d7fd0 72%,#24a67a 100%)",
          }}
        >
          <span
            className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-slate-700/90 bg-white shadow-[0_2px_8px_rgba(15,23,42,.2)]"
            style={{ left: `calc(${pct}% - 10px)` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[8px] text-subtle">
          <span>弱</span>
          <span>中</span>
          <span>强</span>
        </div>
      </div>

      <div className="mt-2 inline-flex rounded-full bg-white/58 px-2 py-0.5 text-[8.5px] font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,.8)]">
        {label}
      </div>
    </Glass>
  );
}

function trendTone(score: number | null): "low" | "high" | "neutral" {
  if (score == null) return "neutral";
  if (score >= 60) return "low";
  if (score <= 40) return "high";
  return "neutral";
}

function trendSubtitle(score: number | null, label: string) {
  if (score == null) return "趋势指标暂时不足，等待更多历史净值。";
  if (score >= 75) return `当前${label}，方向非常明确，重点关注是否继续走强。`;
  if (score >= 60) return `当前${label}，价格与多周期动量整体偏向上。`;
  if (score >= 40) return `当前${label}，多空力量暂时没有形成明显单边。`;
  if (score >= 25) return `当前${label}，多周期动量开始偏弱，留意回撤。`;
  return `当前${label}，趋势明显偏弱，优先控制追涨与补仓。`;
}

function bandSubtitle(tone: "low" | "high" | "neutral" | undefined, label: string) {
  if (tone === "low") return `当前处于${label}，位置相对更低，适合观察反弹或企稳信号。`;
  if (tone === "high") return `当前处于${label}，位置相对偏高，注意冲高回落风险。`;
  return `当前处于${label}，位置中性，等待方向进一步确认。`;
}

function formatMetric(value: number | null | undefined, digits: number) {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-[12px] bg-bg-elevated py-1.5">
      <div className="text-[8px] text-subtle">{k}</div>
      <div className="text-[11px] font-semibold tabular-nums text-fg">{v}</div>
    </div>
  );
}
