import { useState } from "react";
import { Tone } from "@/components/ui/Glass";
import { calcSixFactor } from "@/lib/calc/six-factor";
import { calcSwingTrade } from "@/lib/calc/indicators";
import { matchFundSector } from "@/lib/data/sectors";
import { fmtMoney, fmtPctShort, fmtPrice } from "@/lib/format";
import type { FundQuote, Holding, SectorQuote } from "@/lib/types";

export function FundCard({
  holding,
  fund,
  sector,
  benchPct,
  onRemove,
}: {
  holding: Holding;
  fund?: FundQuote;
  sector?: SectorQuote;
  benchPct: number | null;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const name = fund?.name || holding.name || holding.code;
  const px = fund?.estimate ?? fund?.nav ?? null;
  const day = fund?.estimatePct ?? fund?.dayPct ?? null;
  const value = px != null ? px * holding.shares : null;
  const costVal = holding.cost * holding.shares;
  const pnl = value != null ? value - costVal : null;
  const pnlPct = value != null ? (pnl! / costVal) * 100 : null;
  const mapped = matchFundSector(name);
  const six = sector && sector.available ? calcSixFactor(sector, benchPct) : null;
  const swing = calcSwingTrade(fund?.metrics ?? null, holding.cost, px || 0);

  return (
    <article className="glass-tight mb-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-fg">
            {name}
            <span className="ml-1 text-[11px] font-normal text-muted">{holding.code}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-subtle">
            {fund?.type || "基金"} · {fund?.source || "等待净值"}
          </div>
        </div>
        <Tone v={day} className="text-xl font-semibold">
          {fmtPctShort(day)}
        </Tone>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted">
        <div>
          持仓市值
          <b className="mt-0.5 block text-sm text-fg tabular-nums">{fmtMoney(value)}</b>
        </div>
        <div>
          浮动盈亏
          <Tone v={pnl} className="mt-0.5 block text-sm font-semibold">
            {fmtMoney(pnl)}
          </Tone>
        </div>
        <div>
          收益率
          <Tone v={pnlPct} className="mt-0.5 block text-sm font-semibold">
            {fmtPctShort(pnlPct)}
          </Tone>
        </div>
      </div>

      <div className="mt-2 text-[11px] text-muted">
        份额 {holding.shares} · 成本 {fmtPrice(holding.cost, 4)}
        {fund?.nav != null ? ` · 净值 ${fmtPrice(fund.nav, 4)}` : ""}
        {fund?.navDate ? `（${fund.navDate}）` : ""}
        {fund?.estimate != null ? ` · 估值 ${fmtPrice(fund.estimate, 4)}` : ""}
        {fund?.estimateTime ? ` · ${fund.estimateTime}` : ""}
      </div>

      {fund?.metrics ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Tag>{fund.metrics.band}</Tag>
          <Tag>{fund.metrics.trend}</Tag>
          <Tag>RSI {fund.metrics.rsi.toFixed(0)}</Tag>
          {swing ? <Tag>{swing.action}</Tag> : null}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-subtle">净值历史不足 35 日，波段指标暂无可靠数据</p>
      )}

      {mapped ? (
        <div className="mt-2 rounded-xl bg-accent/8 px-2.5 py-1.5 text-[11px] text-muted">
          映射板块 <b className="text-fg">{mapped.name}</b>
          {sector?.change != null ? (
            <>
              {" "}
              今日 <Tone v={sector.change}>{fmtPctShort(sector.change)}</Tone>
            </>
          ) : (
            " · 暂无板块行情"
          )}
          {six ? ` → ${six.advice}（置信 ${six.confidence}%）` : ""}
        </div>
      ) : null}

      <button
        type="button"
        className="mt-2 w-full rounded-xl bg-bg-elevated py-1.5 text-xs font-semibold text-fg"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "收起原因" : "为什么涨跌 / 波段建议"}
      </button>
      {open ? (
        <div className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-muted">
          <p>{fund?.metrics?.combo || "暂无可靠波段结论"}</p>
          {swing ? <p>{swing.reason} · 环境 {swing.envLevel}</p> : null}
          {fund?.metrics ? (
            <p>
              MACD {fund.metrics.macd.toFixed(4)} · BIAS {fund.metrics.bias.toFixed(2)}% · 信号强度{" "}
              {fund.metrics.sigStrength}
            </p>
          ) : null}
          <button type="button" className="text-up" onClick={onRemove}>
            删除这只基金
          </button>
        </div>
      ) : null}
    </article>
  );
}

function Tag({ children }: { children: string }) {
  return <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold text-fg">{children}</span>;
}
