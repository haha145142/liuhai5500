import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useApp } from "@/lib/store";
import { requestFund, requestFundFast } from "@/lib/data/fund-request-cache";
import type { FundQuote } from "@/lib/types";
import "./QuickAddFund.css";

function hasUsableQuote(value: FundQuote | null | undefined): value is FundQuote {
  return !!value && (value.nav != null || value.historyPoints.length > 0 || value.metrics != null);
}

export function QuickAddFund() {
  const addHolding = useApp((s) => s.addHolding);
  const funds = useApp((s) => s.funds);
  const [code, setCode] = useState("");
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");
  const [remoteQuote, setRemoteQuote] = useState<FundQuote | undefined>();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const cached = /^\d{6}$/.test(code) ? funds[code] : undefined;
  const quote = remoteQuote?.code === code ? remoteQuote : cached;

  useEffect(() => {
    if (!/^\d{6}$/.test(code)) {
      setRemoteQuote(undefined);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void requestFundFast(code).then((fast) => {
      if (active && hasUsableQuote(fast)) setRemoteQuote(fast);
    }).catch(() => {});
    void requestFund(code)
      .then((fresh) => {
        if (active && fresh?.code === code && hasUsableQuote(fresh)) setRemoteQuote(fresh);
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [code]);

  const save = () => {
    const s = Number(shares);
    const c = Number(cost);
    if (!/^\d{6}$/.test(code) || s <= 0 || c <= 0) {
      setMessage("请输入6位基金代码、持有份额和成本价");
      return;
    }
    addHolding({ code, name: quote?.name || code, shares: s, cost: c }, quote);
    setMessage("已添加");
    setCode("");
    setShares("");
    setCost("");
    setRemoteQuote(undefined);
  };

  return (
    <div className="quick-add-fund">
      <div className="quick-add-title"><Plus size={17} /><span>添加基金</span></div>
      <div className="quick-add-inputs">
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="基金代码（如 008888）" aria-label="基金代码" />
        <input value={shares} onChange={(e) => setShares(e.target.value)} inputMode="decimal" placeholder="持有份额" aria-label="持有份额" />
        <input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder="成本价" aria-label="成本价" />
        <button type="button" onClick={save}><Plus size={16} />添加</button>
      </div>
      {(message || quote?.name || loading) ? <div className={`quick-add-status ${message === "已添加" ? "ok" : ""}`}>{message || (quote?.name ? `${quote.name}${loading ? " · 正在更新" : ""}` : "正在读取基金数据…")}</div> : null}
    </div>
  );
}
