import { createFileRoute } from "@tanstack/react-router";
import { IndexGrid } from "@/components/market/IndexGrid";
import { EmptyNote, Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { calcSixFactor } from "@/lib/calc/six-factor";
import { SECTOR_RULES } from "@/lib/data/sectors";
import { fmtPctShort, fmtYi } from "@/lib/format";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/market")({ component: MarketPage });

function MarketPage() {
  const snapshot = useApp((s) => s.snapshot);
  const selected = useApp((s) => s.selectedSectors);
  const setSectors = useApp((s) => s.setSectors);
  if (!snapshot) return <EmptyNote>正在接入行情…</EmptyNote>;

  const bench = snapshot.indices[0]?.pct ?? null;
  const watched = snapshot.sectors.filter((s) => selected.includes(s.id));
  const flow = snapshot.flow;

  return (
    <div>
      <IndexGrid indices={snapshot.indices} />

      <Glass>
        <SectionTitle title="全市场资金" hint={snapshot.sources.find((s) => s.name === "资金")?.note} />
        {flow ? (
          <div className="grid grid-cols-2 gap-2">
            <FlowCell label="主力净流入" v={flow.main} />
            <FlowCell label="超大单" v={flow.super} />
            <FlowCell label="大单" v={flow.large} />
            <FlowCell label="中单" v={flow.mid} />
            <FlowCell label="小单" v={flow.small} />
            <div className="rounded-2xl bg-bg-elevated p-3"><div className="text-[11px] text-subtle">抽样只数</div><div className="text-lg font-semibold tabular-nums">{flow.count}</div></div>
          </div>
        ) : <p className="text-sm text-muted">资金数据源暂不可用</p>}
      </Glass>

      <Glass>
        <SectionTitle title="我的关注板块" hint={`${watched.length} 个 · 实时六因子`} />
        {watched.length ? (
          <div className="space-y-2">
            {watched.map((s) => {
              const r = calcSixFactor(s, bench);
              return (
                <div key={s.id} className="rounded-2xl bg-bg-elevated p-3">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-sm">{s.name}</b>
                    <Tone v={s.change} className="font-semibold">{s.available ? fmtPctShort(s.change) : "暂无可靠数据"}</Tone>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px]">
                    <Mini label="综合分" value={`${r.position}/100`} />
                    <Mini label="判断" value={r.advice} />
                    <Mini label="置信" value={`${r.confidence}%`} />
                  </div>
                  <div className="mt-2 text-[11px] text-muted">资金 {s.flow == null ? "—" : fmtYi(s.flow)} · {r.basis}</div>
                </div>
              );
            })}
          </div>
        ) : <p className="text-sm text-muted">还没有关注板块，请在下方添加。</p>}
      </Glass>

      <Glass>
        <SectionTitle title="管理关注板块" hint="自由添加 / 移除" />
        <p className="mb-3 text-[11px] leading-relaxed text-muted">只显示你选择的板块数据。这个月关注商业航天，下个月换锂矿/有色金属，都可以直接调整；取消关注后不再出现在“我的关注板块”。</p>
        <div className="flex flex-wrap gap-2">
          {SECTOR_RULES.map((r) => {
            const on = selected.includes(r.id);
            return (
              <button key={r.id} type="button" onClick={() => setSectors(on ? selected.filter((x) => x !== r.id) : [...selected, r.id])} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${on ? "bg-accent text-accent-fg" : "bg-bg-elevated text-muted"}`}>
                {on ? "✓ " : "+ "}{r.name}
              </button>
            );
          })}
        </div>
      </Glass>

      <Glass>
        <SectionTitle title="行业涨跌榜" hint="东财" />
        {snapshot.boards.length ? <div className="space-y-1">{snapshot.boards.slice(0, 12).map((b) => <div key={b.code + b.name} className="flex items-center justify-between py-1 text-sm"><span className="text-fg">{b.name}</span><Tone v={b.change} className="font-semibold">{fmtPctShort(b.change)}</Tone></div>)}</div> : <p className="text-sm text-muted">暂无可靠数据</p>}
      </Glass>

      <Glass>
        <SectionTitle title="外围市场" />
        {snapshot.global.length ? <div className="grid grid-cols-2 gap-2">{snapshot.global.map((g) => <div key={g.name} className="rounded-2xl bg-bg-elevated p-3"><div className="text-xs text-muted">{g.name}</div><Tone v={g.pct} className="text-base font-semibold">{g.pct == null ? "暂无可靠数据" : fmtPctShort(g.pct)}</Tone></div>)}</div> : <p className="text-sm text-muted">外围数据源暂不可用</p>}
      </Glass>
      <p className="px-1 pb-2 text-[10px] text-subtle">数据源：{snapshot.sources.map((s) => `${s.name}${s.status === "ok" ? "✓" : "×"}`).join(" · ")}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white/60 p-2"><div className="text-[10px] text-subtle">{label}</div><div className="mt-0.5 text-xs font-semibold">{value}</div></div>; }
function FlowCell({ label, v }: { label: string; v: number }) { return <div className="rounded-2xl bg-bg-elevated p-3"><div className="text-[11px] text-subtle">{label}</div><Tone v={v} className="text-lg font-semibold">{fmtYi(v)}</Tone></div>; }
