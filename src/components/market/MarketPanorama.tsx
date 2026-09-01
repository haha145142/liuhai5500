import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, WalletCards } from "lucide-react";
import { getMarketPanorama, type MarketPanorama, type MarketFlowRow } from "@/lib/data/market-panorama";
import { fmtYi, fmtPctShort } from "@/lib/format";
import { Glass, Tone } from "@/components/ui/Glass";

export function MarketPanorama() {
  const [data, setData] = useState<MarketPanorama | null>(null);
  const [open, setOpen] = useState<"in" | "out" | null>(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const next = await getMarketPanorama();
        if (alive) setData(next);
      } catch {
        if (alive) setData(null);
      }
    };
    void run();
    const timer = window.setInterval(run, 30_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  const order = data?.order;
  const orderLabel = data?.validation === "consistent" ? "结构一致" : data?.validation === "partial" ? "部分一致" : data?.validation === "unreliable" ? "校验不通过" : "暂无数据";

  return (
    <section className="mt-3 grid gap-3">
      <Glass className="overflow-hidden rounded-[24px] border border-white/75 bg-white/48 p-3 shadow-[0_18px_48px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[22px] saturate-150">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><WalletCards size={17} className="text-blue" /><h2 className="text-[17px] font-semibold tracking-tight">今天钱往哪儿跑</h2><span className="rounded-full bg-blue/10 px-2 py-0.5 text-[9px] font-medium text-blue">全市场</span></div>
            <p className="mt-1 text-[10px] text-subtle">按东方财富板块主力净流入排序，不用股票名代替板块。</p>
          </div>
          <span className="shrink-0 text-[9px] text-subtle">{data?.marketDate || "等待"}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <FlowGroup title="净流入 TOP5" rows={data?.topIn || []} positive open={open === "in"} onToggle={() => setOpen(open === "in" ? null : "in")} />
          <FlowGroup title="净流出 TOP5" rows={data?.topOut || []} open={open === "out"} onToggle={() => setOpen(open === "out" ? null : "out")} />
        </div>
        <div className="mt-2 text-[9px] text-subtle">来源：{data?.source || "等待可靠数据"}</div>
      </Glass>

      <Glass className="overflow-hidden rounded-[24px] border border-white/75 bg-white/48 p-3 shadow-[0_18px_48px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[22px] saturate-150">
        <div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-[17px] font-semibold tracking-tight">今天谁在买卖</h2><span className="rounded-full bg-blue/10 px-2 py-0.5 text-[9px] font-medium text-blue">订单分层</span></div><p className="mt-1 text-[10px] text-subtle">小单只是订单规模分类，不等于散户行为。</p></div><span className="rounded-full bg-bg-elevated px-2 py-1 text-[9px] text-muted">{orderLabel}</span></div>
        {order ? <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MoneyCell label="主力净流入" value={order.main} />
            <MoneyCell label="超大单" value={order.super} />
            <MoneyCell label="大单" value={order.large} />
            <MoneyCell label="中单" value={order.mid} />
            <MoneyCell label="小单" value={order.small} />
            <div className="rounded-[16px] bg-white/55 px-3 py-2 ring-1 ring-white/75"><div className="text-[9px] text-subtle">样本</div><div className="mt-1 text-[15px] font-semibold tabular-nums">{order.count} 只</div></div>
          </div>
          <div className="mt-2 rounded-[16px] bg-white/55 px-3 py-2.5 text-[10px] leading-relaxed text-subtle">主力 = 超大单 + 大单为内部一致性检查；若校验不通过，只展示原始订单规模，不给出“谁在买”的确定结论。</div>
        </> : <div className="mt-3 rounded-[16px] bg-white/55 px-3 py-4 text-center text-xs text-muted">当前全A股订单数据不可用，暂不猜测买卖方向。</div>}
      </Glass>
    </section>
  );
}

function FlowGroup({ title, rows, positive, open, onToggle }: { title: string; rows: MarketFlowRow[]; positive?: boolean; open: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-[18px] bg-white/52 p-2.5 ring-1 ring-white/75">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-2 text-left"><span className="text-[11px] font-semibold">{title}</span>{open ? <ChevronUp size={14} className="text-subtle" /> : <ChevronDown size={14} className="text-subtle" />}</button>
      <div className="mt-2 space-y-1.5">
        {rows.slice(0, open ? 5 : 3).map((row, i) => <div key={`${row.code}-${row.name}`} className="flex items-center gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-lg bg-bg-elevated text-[9px] font-bold text-subtle">{i + 1}</span><span className="min-w-0 flex-1 truncate text-[10px] font-medium">{row.name}</span><Tone v={row.main} className="text-[10px] font-semibold tabular-nums">{row.main == null ? "—" : fmtYi(row.main)}</Tone>{row.change != null ? <span className="text-[9px] text-subtle">{fmtPctShort(row.change)}</span> : null}</div>)}
        {!rows.length ? <div className="py-4 text-center text-[10px] text-muted">暂无可靠数据</div> : null}
      </div>
      {!open && rows.length > 3 ? <div className={`mt-1 text-center text-[9px] ${positive ? "text-blue" : "text-subtle"}`}>点击展开 TOP5</div> : null}
    </div>
  );
}

function MoneyCell({ label, value }: { label: string; value: number }) {
  return <div className="rounded-[16px] bg-white/52 px-3 py-2 ring-1 ring-white/70"><div className="text-[9px] text-subtle">{label}</div><Tone v={value} className="mt-1 text-[16px] font-bold tabular-nums">{fmtYi(value)}</Tone></div>;
}
