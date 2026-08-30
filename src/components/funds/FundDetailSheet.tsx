import type { FundQuote } from "@/lib/types";
import { fmtPctShort, fmtPrice, fmtMoney } from "@/lib/format";

type Props = {
  fund: FundQuote | null;
  shares?: number;
  cost?: number;
  onClose: () => void;
};

function pct(v: number | null | undefined) { return v == null || !Number.isFinite(v) ? "暂无可靠数据" : fmtPctShort(v); }
function confidenceText(v: FundQuote["estimateConfidence"]) { return v === "high" ? "高" : v === "medium" ? "中" : v === "low" ? "低" : "—"; }
function statusText(f: FundQuote) {
  if (f.valuationStatus === "official_nav") return "今日官方净值";
  if (f.valuationStatus === "estimate") return "盘中自算估值";
  if (f.valuationStatus === "waiting_official_nav") return "等待官方净值";
  if (f.valuationStatus === "stale") return "最近交易日";
  return "暂无可靠估值";
}

export function FundDetailSheet({ fund, shares, cost, onClose }: Props) {
  if (!fund) return null;
  const hasPosition = Number.isFinite(shares) && Number.isFinite(cost) && (shares || 0) > 0 && (cost || 0) > 0;
  const livePrice = fund.estimate != null && fund.valuationStatus === "estimate" ? fund.estimate : fund.nav;
  const marketValue = hasPosition && livePrice != null ? livePrice * (shares as number) : null;
  const positionPnl = hasPosition && livePrice != null ? (livePrice - (cost as number)) * (shares as number) : null;
  const positionPnlPct = hasPosition && cost ? ((livePrice ?? 0) - cost) / cost * 100 : null;
  const m = fund.metrics;

  return (
    <div className="fixed inset-0 z-[5000] flex items-end justify-center bg-slate-950/25 p-0 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="w-full max-w-2xl overflow-hidden rounded-t-[30px] border border-white/80 bg-white/90 shadow-[0_-24px_70px_rgba(20,50,90,.24)] backdrop-blur-2xl">
        <div className="px-4 pb-5 pt-3">
          <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-slate-400/25" />
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-slate-500">{fund.code} · {fund.type || "基金"}</div>
              <h2 className="mt-1 truncate text-xl font-extrabold tracking-tight text-slate-900">{fund.name}</h2>
            </div>
            <button type="button" onClick={onClose} className="rounded-full bg-slate-900/5 px-3 py-1.5 text-xs font-semibold text-slate-600">关闭</button>
          </div>

          <div className="mt-4 rounded-3xl border border-white/80 bg-gradient-to-br from-white/85 to-blue-50/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.95)]">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[10px] font-semibold text-slate-500">当前净值口径</div>
                <div className="mt-1 text-3xl font-black tabular-nums text-slate-900">{fmtPrice(livePrice, 4)}</div>
                <div className="mt-1 text-[10px] text-slate-500">{statusText(fund)}{fund.estimateTime ? ` · ${fund.estimateTime}` : fund.navDate ? ` · ${fund.navDate}` : ""}</div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-black tabular-nums ${((fund.estimatePct ?? fund.dayPct) ?? 0) > 0 ? "text-red-500" : ((fund.estimatePct ?? fund.dayPct) ?? 0) < 0 ? "text-emerald-600" : "text-slate-400"}`}>{pct(fund.valuationStatus === "estimate" ? fund.estimatePct : fund.dayPct)}</div>
                <div className="mt-1 text-[10px] text-slate-500">今日涨跌</div>
              </div>
            </div>

            {hasPosition ? <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white/60 p-2"><div className="text-[10px] text-slate-500">持仓市值</div><div className="mt-0.5 text-sm font-bold">{fmtMoney(marketValue)}</div></div>
              <div className="rounded-2xl bg-white/60 p-2"><div className="text-[10px] text-slate-500">持仓盈亏</div><div className="mt-0.5 text-sm font-bold">{fmtMoney(positionPnl)}</div></div>
              <div className="rounded-2xl bg-white/60 p-2"><div className="text-[10px] text-slate-500">收益率</div><div className="mt-0.5 text-sm font-bold">{pct(positionPnlPct)}</div></div>
            </div> : null}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Info label="近1周" value={pct(fund.weekPct)} />
            <Info label="近1月" value={pct(fund.monthPct)} />
            <Info label="估值可信度" value={confidenceText(fund.estimateConfidence)} />
            <Info label="重仓覆盖" value={fund.estimateCoverage == null ? "暂无可靠数据" : `${(fund.estimateCoverage * 100).toFixed(0)}%`} />
          </div>

          <div className="mt-3 rounded-2xl bg-slate-900/[.035] p-3">
            <div className="text-[10px] font-semibold text-slate-500">自算估值审计</div>
            <div className="mt-2 space-y-1.5 text-[11px] text-slate-600">
              <Row label="计算方法" value={fund.estimateMethod || "暂无可靠数据"} />
              <Row label="第三方参考偏差" value={fund.estimateDeviation == null ? "暂无可靠数据" : `${fund.estimateDeviation.toFixed(2)} 个百分点`} />
              <Row label="交叉验证" value={fund.estimateValidation || "暂无可靠数据"} />
            </div>
          </div>

          {m ? <div className="mt-3 rounded-2xl bg-slate-900/[.035] p-3">
            <div className="text-[10px] font-semibold text-slate-500">趋势与波段</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <Info label="趋势" value={m.trend || "暂无数据"} />
              <Info label="位置" value={m.band || "暂无数据"} />
              <Info label="RSI" value={Number.isFinite(m.rsi) ? m.rsi.toFixed(1) : "暂无数据"} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <Info label="MACD" value={Number.isFinite(m.macd) ? m.macd.toFixed(3) : "暂无数据"} />
              <Info label="波段分" value={Number.isFinite(m.bandScore) ? String(m.bandScore) : "暂无数据"} />
              <Info label="置信" value={m.conf || "暂无数据"} />
            </div>
          </div> : null}

          <div className="mt-3 text-[10px] leading-relaxed text-slate-500">所有估值以数据时间为准；盘中估值是模型计算值，官方净值公布后自动切换。数据不足时不编数字。仅供参考，不构成投资建议。</div>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-slate-900/[.035] px-2 py-2"><div className="text-[10px] text-slate-500">{label}</div><div className="mt-0.5 text-sm font-bold text-slate-800">{value}</div></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3"><span>{label}</span><b className="text-right text-slate-800">{value}</b></div>; }
