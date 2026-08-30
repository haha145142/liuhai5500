import { useEffect, useMemo, useState } from "react";
import { Plus, Sparkles, WifiOff } from "lucide-react";
import { useApp } from "@/lib/store";
import { fmtMoney, fmtPctShort, fmtPrice } from "@/lib/format";
import { isTradeTime } from "@/lib/market-hours";
import { getFund } from "@/lib/data/server";
import type { FundQuote } from "@/lib/types";
import "./QuickAddFund.css";

function isOfficialNavToday(fund: FundQuote | undefined) {
  if (!fund?.navDate) return false;
  if (fund.officialNavPublished === true) return true;
  const now = new Date();
  const [y, m, d] = fund.navDate.split(/[-/]/).map(Number);
  return y === now.getFullYear() && m === now.getMonth() + 1 && d === now.getDate();
}

function pickCurrentQuote(fund: FundQuote | undefined) {
  if (!fund) return { price: null as number | null, pct: null as number | null, label: "暂无行情" };
  const officialToday = isOfficialNavToday(fund);
  if (officialToday && fund.nav != null) {
    return { price: fund.nav, pct: fund.dayPct, label: "今日官方净值" };
  }
  if (isTradeTime() && fund.estimate != null) {
    return { price: fund.estimate, pct: fund.estimatePct, label: "盘中实时估值" };
  }
  if (fund.nav != null) {
    return { price: fund.nav, pct: fund.dayPct, label: fund.navDate ? `最近官方净值 · ${fund.navDate}` : "最近官方净值" };
  }
  return { price: null, pct: null, label: "暂无可靠行情" };
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
  const localCost = shareValue > 0 && costValue > 0 ? shareValue * costValue : null;
  const current = pickCurrentQuote(quote);
  const marketPrice = current.price;
  const marketValue = marketPrice != null && shareValue > 0 ? marketPrice * shareValue : null;
  const pnl = localCost != null && marketValue != null ? marketValue - localCost : null;
  const pnlPct = pnl != null && localCost ? (pnl / localCost) * 100 : null;
  const canSave = /^\d{6}$/.test(code) && shareValue > 0 && costValue > 0;

  useEffect(() => {
    if (!/^\d{6}$/.test(code)) {
      setRemoteQuote(undefined);
      setQuoteLoading(false);
      return;
    }

    let active = true;
    const cachedFund = funds[code];
    setRemoteQuote(cachedFund);
    setQuoteLoading(true);

    void getFund({ data: { code } })
      .then((fresh) => {
        if (!active) return;
        if (fresh?.code === code) setRemoteQuote(fresh);
      })
      .catch(() => {
        // Offline is a supported state: keep the local cache and local calculations.
      })
      .finally(() => {
        if (active) setQuoteLoading(false);
      });

    return () => { active = false; };
  }, [code, funds]);

  useEffect(() => {
    if (!/^\d{6}$/.test(code)) return;
    const id = window.setInterval(() => {
      const latest = funds[code];
      if (latest) setRemoteQuote(latest);
    }, 30_000);
    return () => window.clearInterval(id);
  }, [code, funds]);

  const preview = useMemo(() => {
    if (!code && !shares && !cost) return "输入完成后，这里立即计算；行情异步更新，不阻塞录入";
    if (localCost == null) return "输入份额和成本价，持仓成本马上计算";
    if (quote?.name) return `${quote.name} · ${current.label}${quoteLoading ? " · 正在校验" : ""}`;
    return quoteLoading
      ? "正在读取最新行情 · 本地成本计算已立即生效"
      : "暂无可靠行情 · 先按成本即时计算，联网后自动补齐";
  }, [code, cost, current.label, localCost, quote?.name, quoteLoading, shares]);

  const save = () => {
    if (!canSave) {
      setMessage("请输入 6 位基金代码、有效份额和成本价");
      return;
    }
    addHolding({
      code,
      name: quote?.name || code,
      shares: shareValue,
      cost: costValue,
    });
    setMessage(`已保存 · ${current.label}会自动随交易时段切换`);
    setCode("");
    setShares("");
    setCost("");
    setRemoteQuote(undefined);
  };

  return (
    <section className="quick-add-fund">
      <div className="quick-add-head">
        <div className="quick-add-title-wrap">
          <div className="quick-add-icon"><Plus size={21} strokeWidth={2.2} /></div>
          <div>
            <h2>添加基金</h2>
            <p>输入代码＋份额＋成本 · 行情自动带入</p>
          </div>
        </div>
        <div className="quick-add-offline"><WifiOff size={13} /> 断网也能计算</div>
      </div>

      <div className="quick-add-inputs">
        <div className="quick-field quick-field-code">
          <label>基金代码</label>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6位代码" autoComplete="off" />
          {quote?.name ? <span className="quick-field-hint">{quote.name}</span> : null}
        </div>
        <div className="quick-field">
          <label>持有份额</label>
          <input value={shares} onChange={(e) => setShares(e.target.value)} inputMode="decimal" placeholder="如 1000" />
        </div>
        <div className="quick-field">
          <label>成本价</label>
          <input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder="如 1.2500" />
        </div>
      </div>

      <div className="quick-add-preview">
        <div className="quick-preview-top">
          <span><Sparkles size={14} /> 即时计算</span>
          <em>{quote ? (current.label) : "离线也可算"}</em>
        </div>
        <div className="quick-metrics">
          <Metric label="持仓成本" value={localCost == null ? "—" : fmtMoney(localCost)} />
          <Metric label={current.label === "盘中实时估值" ? "盘中估值" : "当前市值"} value={marketValue == null ? "待行情" : fmtMoney(marketValue)} />
          <Metric label="当前盈亏" value={pnl == null ? "待行情" : fmtMoney(pnl)} tone={pnl} />
          <Metric label="收益率" value={pnlPct == null ? "—" : fmtPctShort(pnlPct)} tone={pnlPct} />
        </div>
        <div className="quick-quote-row">
          {marketPrice != null ? `价格 ${fmtPrice(marketPrice, 4)}` : "价格暂无"}
          {current.pct != null ? ` · 当日 ${fmtPctShort(current.pct)}` : ""}
          {quote?.navDate ? ` · 数据日 ${quote.navDate}` : ""}
        </div>
        <div className="quick-preview-note">{preview}</div>
      </div>

      <button type="button" className="quick-save" disabled={!canSave} onClick={save}>保存持仓</button>
      <div className={`quick-message ${message.startsWith("已保存") ? "ok" : message ? "warn" : ""}`}>{message || "不用手填当天净值 · 交易时段自动取盘中估值 · 官方净值发布后自动切换"}</div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return <div className="quick-metric"><span>{label}</span>{tone == null ? <b>{value}</b> : <b className={tone > 0 ? "up" : tone < 0 ? "down" : "flat"}>{value}</b>}</div>;
}
