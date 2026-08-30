import { fmtMoney, fmtPctShort, fmtPrice } from "@/lib/format";
import { calculateHoldingEntry, type HoldingEntryInput, type HoldingEntryMarket } from "@/lib/calc/holding-entry";
import type { FundQuote } from "@/lib/types";

export function HoldingEntryPreview({ code, shares, cost, fund, trading }: {
  code: string;
  shares: string;
  cost: string;
  fund?: FundQuote;
  trading: boolean;
}) {
  const input: HoldingEntryInput = {
    code,
    shares: Number(shares),
    cost: Number(cost),
  };
  const market: HoldingEntryMarket = trading
    ? { price: fund?.estimate ?? fund?.nav ?? null, pct: fund?.estimatePct ?? fund?.dayPct ?? null, source: fund?.estimate != null ? "live_estimate" : "none" }
    : { price: fund?.nav ?? null, pct: fund?.dayPct ?? null, source: fund?.nav != null ? "official_today" : "none" };
  const preview = calculateHoldingEntry(input, market);
  const hasPosition = Number.isFinite(input.shares) && input.shares > 0 && Number.isFinite(input.cost) && input.cost > 0;

  return (
    <div className="rounded-2xl border border-white/60 bg-white/55 p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted">即时预览</span>
        <span className="text-[10px] text-subtle">{trading ? "盘中口径" : "官方净值口径"}</span>
      </div>
      {!hasPosition ? (
        <div className="mt-2 text-xs text-muted">输入份额和成本价后立即计算。</div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <PreviewMetric label="成本金额" value={fmtMoney(preview.costValue)} />
          <PreviewMetric label="当前价格" value={preview.price == null ? "暂无可靠数据" : fmtPrice(preview.price, 4)} />
          <PreviewMetric label="当前市值" value={preview.marketValue == null ? "暂无可靠数据" : fmtMoney(preview.marketValue)} />
          <PreviewMetric label="浮动盈亏" value={preview.pnl == null ? "暂无可靠数据" : fmtMoney(preview.pnl)} tone={preview.pnl} />
          <div className="col-span-2 flex items-center justify-between rounded-xl bg-bg-elevated px-3 py-2">
            <span className="text-[10px] text-muted">收益率</span>
            <span className={preview.pnlPct == null ? "text-xs text-muted" : "text-sm font-semibold"}>{preview.pnlPct == null ? "暂无可靠数据" : fmtPctShort(preview.pnlPct)}</span>
          </div>
        </div>
      )}
      {code && !/^\d{6}$/.test(code) ? <div className="mt-2 text-[10px] text-warn">基金代码请输入 6 位数字。</div> : null}
    </div>
  );
}

function PreviewMetric({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return (
    <div className="rounded-xl bg-bg-elevated px-2.5 py-2">
      <div className="text-[10px] text-subtle">{label}</div>
      <div className={tone == null ? "mt-0.5 text-xs font-semibold text-fg tabular-nums" : `mt-0.5 text-xs font-semibold tabular-nums ${tone >= 0 ? "tone-up" : "tone-down"}`}>{value}</div>
    </div>
  );
}
