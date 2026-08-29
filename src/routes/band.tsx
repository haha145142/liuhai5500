import { createFileRoute } from "@tanstack/react-router";
import { EmptyNote, Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { calcSwingTrade } from "@/lib/calc/indicators";
import { fmtPctShort, fmtPrice } from "@/lib/format";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/band")({ component: BandPage });

function BandPage() {
  const portfolio = useApp((s) => s.portfolio);
  const funds = useApp((s) => s.funds);

  if (!portfolio.length) {
    return (
      <Glass>
        <EmptyNote>添加持仓后，这里会给出 RSI / MACD / 布林 / 做 T 环境。趋势行情禁止做 T。</EmptyNote>
      </Glass>
    );
  }

  return (
    <div>
      <Glass>
        <SectionTitle title="波段信号" hint="持仓" />
        <p className="text-xs text-muted">震荡市才建议网格做 T；强势/弱势趋势禁止做 T，以免卖飞或接刀。</p>
      </Glass>
      {portfolio.map((h) => {
        const f = funds[h.code];
        const m = f?.metrics;
        const px = f?.estimate ?? f?.nav ?? 0;
        const swing = calcSwingTrade(m ?? null, h.cost, px);
        return (
          <Glass key={h.code}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold">{f?.name || h.name}</div>
                <div className="text-[11px] text-muted">{h.code}</div>
              </div>
              <Tone v={f?.dayPct} className="font-semibold">
                {fmtPctShort(f?.estimatePct ?? f?.dayPct)}
              </Tone>
            </div>
            {m ? (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat k="RSI" v={m.rsi.toFixed(1)} />
                <Stat k="BIAS" v={`${m.bias.toFixed(2)}%`} />
                <Stat k="MACD" v={m.macd.toFixed(3)} />
                <Stat k="波段" v={`${m.band} ${m.bandScore}`} />
                <Stat k="趋势" v={`${m.trend} ${m.trendScore}`} />
                <Stat k="信号" v={`${m.sigStrength}`} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">净值历史不足，指标暂无可靠数据</p>
            )}
            {swing ? (
              <div className="mt-3 rounded-2xl bg-bg-elevated p-3 text-sm">
                <b>{swing.action}</b>
                <p className="mt-1 text-xs leading-relaxed text-muted">{swing.reason}</p>
                <p className="mt-1 text-xs text-subtle">
                  做 T 环境 {swing.envLevel}（{swing.env}）
                  {swing.allowT && swing.buyGrid && swing.sellGrid
                    ? ` · 低吸 ${fmtPrice(swing.buyGrid, 4)} / 高抛 ${fmtPrice(swing.sellGrid, 4)}`
                    : ""}
                </p>
              </div>
            ) : null}
            {m ? <p className="mt-2 text-xs text-muted">{m.combo} · 置信 {m.conf}</p> : null}
          </Glass>
        );
      })}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-bg-elevated py-2">
      <div className="text-[10px] text-subtle">{k}</div>
      <div className="text-sm font-semibold tabular-nums">{v}</div>
    </div>
  );
}
