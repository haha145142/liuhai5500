import { useEffect, useMemo, useState } from "react";
import { Plus, Sparkles, WifiOff } from "lucide-react";
import { useApp } from "@/lib/store";
import { fmtMoney, fmtPctShort, fmtPrice } from "@/lib/format";
import { requestFund } from "@/lib/data/fund-request-cache";
import { selectFundDisplayQuote } from "@/lib/data/quote-mode";
import { previewHoldingEntry, quoteFromFundState } from "@/lib/calc/holding-entry";
import { buildValuationDisplaySummary } from "@/lib/data/valuation-display";
import type { FundQuote } from "@/lib/types";
import "./QuickAddFund.css";

function safeFixed(value: number | null | undefined, digits: number) {
  return value != null && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

export function QuickAddFund() {
  const addHolding = useApp((s) => s.addHolding);
  const funds = useApp((s) => s.funds);
  const [code, setCode] = useState("");
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");
  const [remoteQuote, setRemoteQuote] = useState<FundQuote | undefined>();
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [message, setMessage] = useState("");

  const cached = /^\d{6}$/.test(code) ? funds[code] : undefined;
  const quote = remoteQuote?.code === code ? remoteQuote : cached;
  const shareValue = Number(shares);
  const costValue = Number(cost);
  const current = selectFundDisplayQuote(quote);
  const entryQuote = quoteFromFundState({
    estimate: quote?.estimate,
    estimatePct: quote?.estimatePct,
    nav: quote?.nav,
    dayPct: quote?.dayPct,
    navDate: quote?.navDate,
    estimateTime: quote?.estimateTime,
    officialNavPublished: quote?.officialNavPublished,
    tradeTime: current.mode === "live_estimate",
  });
  const previewResult = previewHoldingEntry(shares, cost, entryQuote);
  const marketPrice = previewResult.price;
  const marketValue = previewResult.marketValue;
  const pnl = previewResult.pnl;
  const pnlPct = previewResult.pnlPct;
  const canSave = /^\d{6}$/.test(code) && shareValue > 0 && costValue > 0;
  const ownEstimate = quote?.estimateMethod?.includes("穿透估值") || quote?.source?.startsWith("自有穿透估值");
  const displaySummary = buildValuationDisplaySummary({
    valuationStatus: quote?.valuationStatus,
    estimateConfidence: quote?.estimateConfidence,
    estimateCoverage: quote?.estimateCoverage,
    estimateValidation: quote?.estimateValidation,
    historyMae20: quote?.historyMae20,
    historySample20: quote?.historySample20,
  });
  const auditLine = quote
    ? ownEstimate
      ? `自有穿透估值 · 覆盖 ${safeFixed(quote.estimateCoverage, 1)}% · ${quote.estimateValidation || "待验证"}${quote.estimateDeviation != null ? ` · 偏差 ${safeFixed(quote.estimateDeviation, 2)} 个百分点` : ""}`
      : "估值引擎正在等待可靠持仓数据"
    : "输入基金代码后自动启动穿透估值";

  useEffect(() => {
    if (!/^\d{6}$/.test(code)) {
      setRemoteQuote(undefined);
      setQuoteLoading(false);
      return;
    }
    let active = true;
    setQuoteLoading(true);
    setMessage("");
    void requestFund(code)
      .then((fresh) => {
        if (active && fresh?.code === code) setRemoteQuote(fresh);
      })
      .catch(() => {})
      .finally(() => { if (active) setQuoteLoading(false); });
    return () => { active = false; };
  }, [code]);

  const preview = useMemo(() => {
    if (!code && !shares && !cost) return "输入完成后，这里立即计算；行情异步更新，不阻塞录入";
    if (previewResult.costValue == null) return "输入份额和成本价，持仓成本马上计算";
    if (quote?.name) return `${quote.name} · ${previewResult.quoteLabel}${quoteLoading ? " · 正在校验" : ""}`;
    return quoteLoading ? "正在读取最新行情 · 本地成本计算已立即生效" : "暂无可靠行情 · 先按成本即时计算，联网后自动补齐";
  }, [code, cost, previewResult.costValue, previewResult.quoteLabel, quote?.name, quoteLoading, shares]);

  const save = () => {
    if (!canSave) {
      setMessage("请输入 6 位基金代码、有效份额和成本价");
      return;
    }
    addHolding({ code, name: quote?.name || code, shares: shareValue, cost: costValue }, quote);
    setMessage(`已保存 · ${previewResult.quoteLabel}会自动随交易时段切换`);
    setCode(""); setShares(""); setCost(""); setRemoteQuote(undefined);
  };

  return (
    <section className="quick-add-fund">
      <div className="quick-add-head">
        <div className="quick-add-title-wrap">
          <div className="quick-add-icon"><Plus size={21} strokeWidth={2.2} /></div>
          <div><h2>添加基金</h2><p>输入代码＋份额＋成本 · 行情自动带入</p></div>
        </div>
        <div className="quick-add-offline"><WifiOff size={13} /> 断网也能计算</div>
      </div>
      <div className="quick-add-inputs">
        <div className="quick-field quick-field-code"><label>基金代码</label><input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6位代码" autoComplete="off" />{quote?.name ? <span className="quick-field-hint">{quote.name}</span> : null}</div>
        <div className="quick-field"><label>持有份额</label><input value={shares} onChange={(e) => setShares(e.target.value)} inputMode="decimal" placeholder="如 1000" /></div>
        <div className="quick-field"><label>成本价</label><input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder="如 1.2500" /></div>
      </div>
      <div className="quick-add-preview">
        <div className="quick-preview-top"><span><Sparkles size={14} /> 即时计算</span><em>{current.label}</em></div>
        <div className="quick-metrics">
          <Metric label="持仓成本" value={previewResult.costValue == null ? "—" : fmtMoney(previewResult.costValue)} />
          <Metric label={previewResult.quoteMode === "live_estimate" ? "盘中估值" : "当前市值"} value={marketValue == null ? "待行情" : fmtMoney(marketValue)} />
          <Metric label="当前盈亏" value={pnl == null ? "待行情" : fmtMoney(pnl)} tone={pnl} />
          <Metric label="收益率" value={pnlPct == null ? "—" : fmtPctShort(pnlPct)} tone={pnlPct} />
        </div>
        <div className="quick-quote-row">{marketPrice != null ? `价格 ${fmtPrice(marketPrice, 4)}` : "价格暂无"}{entryQuote.pct != null ? ` · 当日 ${fmtPctShort(entryQuote.pct)}` : ""}{quote?.navDate ? ` · 数据日 ${quote.navDate}` : ""}</div>
        {quote ? (
          <div className="quick-trust-row">
            <span>{displaySummary.mode}</span>
            <span>{displaySummary.coverage}</span>
            <span>{displaySummary.validation}</span>
            <span>{displaySummary.history}</span>
          </div>
        ) : null}
        <div className="quick-preview-note">{preview}</div>
        <div className="quick-preview-note">{auditLine}</div>
      </div>
      <button type="button" className="quick-save" disabled={!canSave} onClick={save}>保存持仓</button>
      <div className={`quick-message ${message.startsWith("已保存") ? "ok" : message ? "warn" : ""}`}>{message || "不用手填当天净值 · 交易时段自动取盘中估值 · 官方净值发布后自动切换"}</div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return <div className="quick-metric"><span>{label}</span>{tone == null ? <b>{value}</b> : <b className={tone > 0 ? "up" : tone < 0 ? "down" : "flat"}>{value}</b>}</div>;
}
