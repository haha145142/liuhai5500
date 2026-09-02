import { useEffect, useState } from "react";
import { Glass } from "@/components/ui/Glass";
import { getMarketMoneyFlow, type MarketMoneyFlow } from "@/lib/data/market-money-flow";
import { fmtYi } from "@/lib/format";

function tone(v: number | null) { return v == null ? "text-slate-400" : v > 0 ? "text-up" : v < 0 ? "text-down" : "text-slate-500"; }

export function MarketMoneyFlow() {
  const [data, setData] = useState<MarketMoneyFlow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const value = await getMarketMoneyFlow();
        if (alive) setData(value);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    const id = window.setInterval(load, 5 * 60_000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  return (
    <section className="mt-3" aria-label="全市场资金雷达">
      <Glass tight className="overflow-hidden rounded-[24px] border border-white/75 bg-white/52 p-3 shadow-[0_14px_38px_rgba(38,78,112,.07)] backdrop-blur-[22px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[16px] font-semibold tracking-tight text-slate-950">全市场资金雷达</div>
            <div className="mt-0.5 text-[10px] text-slate-500">全市场资金脉络 · 订单规模口径 · 观察资金进出与市场放缩量</div>
          </div>
          <span className="shrink-0 rounded-full bg-white/75 px-2.5 py-1 text-[9px] text-slate-500">{loading && !data ? "读取中" : data ? "全市场" : "暂无可靠数据"}</span>
        </div>

        {data ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric label="主力净流入" value={fmtYi(data.main)} tone={tone(data.main)} />
              <Metric label="超大单" value={fmtYi(data.super)} tone={tone(data.super)} />
              <Metric label="大单" value={fmtYi(data.large)} tone={tone(data.large)} />
              <Metric label="中单" value={fmtYi(data.mid)} tone={tone(data.mid)} />
              <Metric label="小单" value={fmtYi(data.small)} tone={tone(data.small)} />
              <Metric label="样本覆盖" value={`${data.count.toLocaleString()}只`} tone="text-slate-800" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Metric label="沪深成交额" value={data.turnover == null ? "暂无可靠数据" : `${(data.turnover / 1e8).toFixed(0)}亿`} tone="text-slate-800" />
              <Metric label="较前一交易日" value={data.turnoverChangePct == null ? "暂无可靠数据" : `${data.turnoverChangePct >= 0 ? "+" : ""}${data.turnoverChangePct.toFixed(1)}% · ${data.turnoverState}`} tone={data.turnoverChangePct == null ? "text-slate-400" : data.turnoverChangePct >= 0 ? "text-up" : "text-down"} />
            </div>
            <div className="mt-2 rounded-[15px] bg-white/58 px-3 py-2.5 text-[10px] leading-[1.55] text-slate-500">
              <b className="text-slate-800">怎么看：</b>超大单 + 大单作为大资金/主力订单规模代理；中单、小单用于观察小额资金行为。这里看的是订单规模，不冒充真实机构或散户身份。资金先经过结构校验，校验不足时不用于方向判断。
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-400">
              <span>{data.marketDate} · {data.source}</span>
              <span>{data.validation === "fully_consistent" ? "结构一致" : data.validation === "partially_consistent" ? "部分一致" : "不可用于方向判断"}</span>
            </div>
          </>
        ) : (
          <div className="mt-3 rounded-[16px] bg-white/55 px-3 py-5 text-center text-[10px] text-slate-400">暂无可靠的全市场资金快照，不用假数字补位。</div>
        )}
      </Glass>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="rounded-[16px] bg-white/62 px-3 py-2.5 ring-1 ring-white/75"><div className="text-[10px] text-slate-400">{label}</div><div className={`mt-1 text-[15px] font-bold tabular-nums ${tone}`}>{value}</div></div>;
}
