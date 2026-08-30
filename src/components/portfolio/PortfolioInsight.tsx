import { Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { fmtMoney, fmtPctShort } from "@/lib/format";
import { calcPortfolioAnalysis } from "@/lib/calc/portfolio";
import type { FundQuote, Holding, SectorQuote } from "@/lib/types";

export function PortfolioInsight({ holdings, funds, sectors }: { holdings: Holding[]; funds: FundQuote[]; sectors: SectorQuote[] }) {
  if (!holdings.length) return null;
  const a = calcPortfolioAnalysis(holdings, funds, sectors);
  return (
    <Glass tight className="mb-2 mt-2">
      <SectionTitle title="组合诊断" hint="收益 · 风险 · 今日影响" />
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Metric label="组合市值" value={fmtMoney(a.marketValue)} />
        <Metric label="累计收益" value={a.pnlPct == null ? "暂无可靠数据" : fmtPctShort(a.pnlPct)} tone={a.pnlPct} />
        <Metric label="今日盈亏" value={a.dayPnl == null ? "暂无可靠数据" : fmtMoney(a.dayPnl)} tone={a.dayPnl} />
        <Metric label="今日波动" value={a.dayPct == null ? "暂无可靠数据" : fmtPctShort(a.dayPct)} tone={a.dayPct} />
        <Metric label="组合风险" value={a.risk} />
        <Metric label="组合趋势" value={a.trend} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <ImpactCard title="今日主要贡献" row={a.topContributor} positive />
        <ImpactCard title="今日主要拖累" row={a.topDrag} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <Metric label="第一重仓" value={`${a.concentrationTop1Pct.toFixed(1)}%`} />
        <Metric label="前三重仓" value={`${a.concentrationTop3Pct.toFixed(1)}%`} />
      </div>

      {a.sectorExposures.length ? (
        <div className="mt-3">
          <div className="text-[10px] font-semibold text-subtle">主要基金主题暴露</div>
          <div className="mt-1 space-y-1.5">
            {a.sectorExposures.slice(0, 4).map((x) => (
              <div key={x.name} className="flex items-center justify-between rounded-xl bg-bg-elevated px-2.5 py-1.5 text-[11px]">
                <span>{x.name}</span><span className="font-semibold tabular-nums">{x.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {a.notes.length ? <p className="mt-2 text-[10px] leading-relaxed text-subtle">{a.notes.join(" ")}</p> : <p className="mt-2 text-[10px] text-subtle">当前没有明显集中度风险提示。</p>}
      <p className="mt-2 text-[10px] text-subtle">组合市值覆盖 {a.holdingsCovered}/{a.holdingsTotal} 只持仓；缺少可靠价格的持仓不会被伪造估值。</p>
    </Glass>
  );
}

function ImpactCard({ title, row, positive = false }: { title: string; row: ReturnType<typeof calcPortfolioAnalysis>["topContributor"]; positive?: boolean }) {
  const v = row?.dayPnl ?? null;
  return (
    <div className="rounded-2xl bg-bg-elevated px-3 py-2.5">
      <div className="text-[10px] text-subtle">{title}</div>
      {row ? (
        <>
          <div className="mt-1 truncate text-xs font-semibold text-fg">{row.name}</div>
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <Tone v={v} className="text-sm font-bold tabular-nums">{fmtMoney(v)}</Tone>
            <span className="text-[10px] text-subtle">{fmtPctShort(row.dayPct)}</span>
          </div>
        </>
      ) : <div className="mt-1 text-xs text-subtle">{positive ? "暂无可靠贡献数据" : "暂无可靠拖累数据"}</div>}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return <div className="rounded-xl bg-bg-elevated px-2 py-2"><div className="text-[10px] text-subtle">{label}</div>{tone == null ? <div className="mt-0.5 text-sm font-semibold">{value}</div> : <Tone v={tone} className="mt-0.5 text-sm font-semibold">{value}</Tone>}</div>;
}
