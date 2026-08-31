import { createFileRoute } from "@tanstack/react-router";
import { EmptyNote, Glass, SectionTitle, Tone, DataStatus } from "@/components/ui/Glass";
import { calcSwingTrade } from "@/lib/calc/indicators";
import { fmtPctShort, fmtPrice } from "@/lib/format";
import { selectFundDisplayQuote } from "@/lib/data/quote-mode";
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
        const quote = selectFundDisplayQuote(f);
        const px = quote.price;
        const swing = calcSwingTrade(m ?? null, h.cost, px ?? 0);
        const statusMode = quote.mode === "live_estimate" ? "live" : quote.mode === "official_today" ? "official" : quote.mode === "latest_official" ? "latest" : "unavailable";
        return (
          <Glass key={h.code}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{f?.name || h.name}</div>
                <div className="mt-1 text-[11px] text-muted">{h.code}</div>
              </div>
              <div className="shrink-0 text-right">
                <Tone v={quote.pct} className="font-semibold">
                  {fmtPctShort(quote.pct)}
                </Tone>
                <div className="mt-1"><DataStatus mode={statusMode} detail={quote.dataDate || undefined} /></div>
              </div>
            </div>
            {m ? (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat k="RSI" v={Number.isFinite(m.rsi) ? fmtPrice(m.rsi, 1) : "—"} />
                <Stat k="BIAS" v={Number.isFinite(m.bias) ? `${fmtPrice(m.bias, 2)}%` : "—"} />
                <Stat k="MACD" v={Number.isFinite(m.macd) ? fmtPrice(m.macd, 3) : "—"} />
                <Stat k="波段" v={`${m.band ?? "—"} ${m.bandScore ?? "—"}`} />
                <Stat k="趋势" v={`${m.trend ?? "—"} ${m.trendScore ?? "—"}`} />
                <Stat k="信号" v={m.sigStrength == null ? "—" : String(m.sigStrength)} />
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
                  {swing.allowT && swing.buyGrid != null && swing.sellGrid != null
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
