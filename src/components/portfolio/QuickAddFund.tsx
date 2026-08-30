import { useMemo, useState } from "react";
import { Plus, Sparkles, WifiOff } from "lucide-react";
import { useApp } from "@/lib/store";
import { fmtMoney, fmtPctShort } from "@/lib/format";
import { isTradeTime } from "@/lib/market-hours";
import "./QuickAddFund.css";

export function QuickAddFund() {
  const addHolding = useApp((s) => s.addHolding);
  const funds = useApp((s) => s.funds);
  const [code, setCode] = useState("");
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");
  const [message, setMessage] = useState("");

  const cached = /^\d{6}$/.test(code) ? funds[code] : undefined;
  const shareValue = Number(shares);
  const costValue = Number(cost);
  const localCost = shareValue > 0 && costValue > 0 ? shareValue * costValue : null;
  const marketPrice = cached ? (isTradeTime() ? (cached.estimate ?? cached.nav) : (cached.nav ?? cached.estimate)) : null;
  const marketValue = marketPrice != null && shareValue > 0 ? marketPrice * shareValue : null;
  const pnl = localCost != null && marketValue != null ? marketValue - localCost : null;
  const pnlPct = pnl != null && localCost ? (pnl / localCost) * 100 : null;
  const canSave = /^\d{6}$/.test(code) && shareValue > 0 && costValue > 0;

  const preview = useMemo(() => {
    if (!code && !shares && !cost) return "输入完成后，这里立即计算，不等接口返回";
    if (localCost == null) return "输入份额和成本价，持仓成本马上计算";
    if (cached?.name) return `${cached.name} · 已命中本地缓存数据`;
    return "当前无行情缓存 · 先按成本即时计算，联网后再补最新数据";
  }, [cached?.name, code, cost, localCost, shares]);

  const save = () => {
    if (!canSave) {
      setMessage("请输入 6 位基金代码、有效份额和成本价");
      return;
    }
    addHolding({ code, name: cached?.name || code, shares: shareValue, cost: costValue });
    setMessage("已保存到本地持仓 · 网络恢复后自动补齐行情");
    setCode("");
    setShares("");
    setCost("");
  };

  return (
    <section className="quick-add-fund">
      <div className="quick-add-head">
        <div className="quick-add-title-wrap">
          <div className="quick-add-icon"><Plus size={21} strokeWidth={2.2} /></div>
          <div>
            <h2>添加基金</h2>
            <p>本地先算 · 联网再补数据</p>
          </div>
        </div>
        <div className="quick-add-offline"><WifiOff size={13} /> 不依赖网络计算</div>
      </div>

      <div className="quick-add-inputs">
        <div className="quick-field quick-field-code">
          <label>基金代码</label>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6位代码" autoComplete="off" />
          {cached?.name ? <span className="quick-field-hint">{cached.name}</span> : null}
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
          <em>{cached ? "已命中缓存" : "离线也可算"}</em>
        </div>
        <div className="quick-metrics">
          <Metric label="持仓成本" value={localCost == null ? "—" : fmtMoney(localCost)} />
          <Metric label="当前市值" value={marketValue == null ? "待行情" : fmtMoney(marketValue)} />
          <Metric label="当前盈亏" value={pnl == null ? "待行情" : fmtMoney(pnl)} tone={pnl} />
          <Metric label="收益率" value={pnlPct == null ? "—" : fmtPctShort(pnlPct)} tone={pnlPct} />
        </div>
        <div className="quick-preview-note">{preview}</div>
      </div>

      <button type="button" className="quick-save" disabled={!canSave} onClick={save}>保存持仓</button>
      <div className={`quick-message ${message.startsWith("已保存") ? "ok" : message ? "warn" : ""}`}>{message || "输入代码 + 份额 + 成本价后，计算结果即时出现"}</div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return <div className="quick-metric"><span>{label}</span>{tone == null ? <b>{value}</b> : <b className={tone > 0 ? "up" : tone < 0 ? "down" : "flat"}>{value}</b>}</div>;
}
