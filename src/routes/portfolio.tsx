import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FundCard } from "@/components/portfolio/FundCard";
import { EmptyNote, Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { matchFundSector } from "@/lib/data/sectors";
import { searchFund } from "@/lib/data/server";
import { fmtMoney, fmtPctShort } from "@/lib/format";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/portfolio")({ component: PortfolioPage });

function PortfolioPage() {
  const portfolio = useApp((s) => s.portfolio);
  const funds = useApp((s) => s.funds);
  const snapshot = useApp((s) => s.snapshot);
  const addHolding = useApp((s) => s.addHolding);
  const removeHolding = useApp((s) => s.removeHolding);
  const [code, setCode] = useState("");
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");
  const [hint, setHint] = useState("");
  const [hits, setHits] = useState<{ code: string; name: string; type: string }[]>([]);

  const bench = snapshot?.indices[0]?.pct ?? null;

  let total = 0;
  let pnl = 0;
  let costSum = 0;
  let missing = false;
  const high = portfolio.filter((h) => (funds[h.code]?.metrics?.bandScore ?? 50) <= 45).length;
  for (const h of portfolio) {
    const f = funds[h.code];
    const px = f?.estimate ?? f?.nav;
    costSum += h.cost * h.shares;
    if (px == null) missing = true;
    else {
      total += px * h.shares;
      pnl += (px - h.cost) * h.shares;
    }
  }
  const health = !portfolio.length ? null : Math.max(20, Math.min(95, 80 - high * 12 - (missing ? 8 : 0)));

  const onSearch = async (q: string) => {
    setCode(q);
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const r = await searchFund({ data: { q } });
    setHits(r);
  };

  const add = () => {
    if (!/^\d{6}$/.test(code) || Number(shares) <= 0 || Number(cost) <= 0) {
      setHint("请输入 6 位基金代码、份额和成本价");
      return;
    }
    const name = hits.find((h) => h.code === code)?.name || code;
    addHolding({ code, name, shares: Number(shares), cost: Number(cost) });
    setCode("");
    setShares("");
    setCost("");
    setHits([]);
    setHint("已保存，正在读取真实净值…");
  };

  const loadDemo = () => {
    addHolding({ code: "110022", name: "易方达消费行业", shares: 1000, cost: 3.2 });
    addHolding({ code: "161725", name: "招商中证白酒", shares: 800, cost: 1.1 });
    addHolding({ code: "001838", name: "国投瑞银新能源", shares: 1200, cost: 1.5 });
    setHint("已载入示例持仓，净值与估值为真实接口数据");
  };

  return (
    <div>
      <Glass>
        <SectionTitle title="组合概览" hint={`${portfolio.length} 只`} />
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-muted">持仓盈亏</div>
            <Tone v={missing ? null : pnl} className="text-3xl font-semibold">
              {missing ? "部分净值未到" : fmtMoney(pnl)}
            </Tone>
            <Tone v={missing || !costSum ? null : (pnl / costSum) * 100} className="mt-1 block text-sm font-semibold">
              {missing || !costSum ? "" : fmtPctShort((pnl / costSum) * 100)}
            </Tone>
          </div>
          <div className="text-right text-xs text-muted">
            总资产 {missing ? "—" : fmtMoney(total)}
            <br />
            成本 {fmtMoney(costSum)}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-bg-elevated p-3">
            <div className="text-[11px] text-subtle">组合健康度</div>
            <div className="text-lg font-semibold">{health == null ? "—" : `${health}`}</div>
            <div className="text-[11px] text-muted">{high} 只处于偏高/高位区</div>
          </div>
          <div className="rounded-2xl bg-bg-elevated p-3">
            <div className="text-[11px] text-subtle">仓位温度</div>
            <div className="text-lg font-semibold">{portfolio.length ? (high >= portfolio.length / 2 ? "偏热" : "适中") : "空仓"}</div>
            <div className="text-[11px] text-muted">基于波段评分，非买卖建议</div>
          </div>
        </div>
      </Glass>

      {portfolio.length ? (
        portfolio.map((h) => {
          const fname = funds[h.code]?.name || h.name;
          const rule = matchFundSector(fname);
          const sector = rule ? snapshot?.sectors.find((s) => s.id === rule.id) : undefined;
          return (
            <FundCard
              key={h.code}
              holding={h}
              fund={funds[h.code]}
              sector={sector}
              benchPct={bench}
              onRemove={() => removeHolding(h.code)}
            />
          );
        })
      ) : (
        <Glass>
          <EmptyNote>还没有持仓。添加真实基金代码后会拉取官方净值与估值。</EmptyNote>
          <button type="button" onClick={loadDemo} className="w-full rounded-2xl bg-accent py-2.5 text-sm font-semibold text-accent-fg">
            载入 3 只示例持仓
          </button>
        </Glass>
      )}

      <Glass>
        <SectionTitle title="添加基金" />
        <div className="space-y-2">
          <input
            value={code}
            onChange={(e) => void onSearch(e.target.value)}
            placeholder="6 位基金代码或名称"
            className="h-11 w-full rounded-2xl bg-bg-elevated px-3 text-sm outline-none ring-1 ring-border"
          />
          {hits.length ? (
            <div className="overflow-hidden rounded-2xl ring-1 ring-border">
              {hits.map((h) => (
                <button
                  key={h.code}
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-bg-elevated"
                  onClick={() => {
                    setCode(h.code);
                    setHits([]);
                  }}
                >
                  <span>{h.name}</span>
                  <span className="text-xs text-muted">{h.code}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <input value={shares} onChange={(e) => setShares(e.target.value)} placeholder="份额" inputMode="decimal" className="h-11 rounded-2xl bg-bg-elevated px-3 text-sm outline-none ring-1 ring-border" />
            <input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="成本价" inputMode="decimal" className="h-11 rounded-2xl bg-bg-elevated px-3 text-sm outline-none ring-1 ring-border" />
          </div>
          <button type="button" onClick={add} className="h-11 w-full rounded-2xl bg-fg text-sm font-semibold text-bg">
            保存持仓
          </button>
          {hint ? <p className="text-xs text-muted">{hint}</p> : null}
        </div>
      </Glass>
    </div>
  );
}
