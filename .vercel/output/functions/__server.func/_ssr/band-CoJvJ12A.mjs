import { b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { l as fmtPctShort, u as fmtPrice } from "./format-B7cjnRuX.mjs";
import { i as useApp } from "./router-Byr1StPg.mjs";
import { i as Tone, n as Glass, r as SectionTitle, t as EmptyNote } from "./Glass-BjTxdcl0.mjs";
import { n as calcSwingTrade } from "./indicators-D24vzKbj.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/band-CoJvJ12A.js
var import_jsx_runtime = require_jsx_runtime();
function BandPage() {
	const portfolio = useApp((s) => s.portfolio);
	const funds = useApp((s) => s.funds);
	if (!portfolio.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Glass, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyNote, { children: "添加持仓后，这里会给出 RSI / MACD / 布林 / 做 T 环境。趋势行情禁止做 T。" }) });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
		title: "波段信号",
		hint: "持仓"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-xs text-muted",
		children: "震荡市才建议网格做 T；强势/弱势趋势禁止做 T，以免卖飞或接刀。"
	})] }), portfolio.map((h) => {
		const f = funds[h.code];
		const m = f?.metrics;
		const px = f?.estimate ?? f?.nav ?? 0;
		const swing = calcSwingTrade(m ?? null, h.cost, px);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm font-semibold",
					children: f?.name || h.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[11px] text-muted",
					children: h.code
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
					v: f?.dayPct,
					className: "font-semibold",
					children: fmtPctShort(f?.estimatePct ?? f?.dayPct)
				})]
			}),
			m ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid grid-cols-3 gap-2 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						k: "RSI",
						v: m.rsi.toFixed(1)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						k: "BIAS",
						v: `${m.bias.toFixed(2)}%`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						k: "MACD",
						v: m.macd.toFixed(3)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						k: "波段",
						v: `${m.band} ${m.bandScore}`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						k: "趋势",
						v: `${m.trend} ${m.trendScore}`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						k: "信号",
						v: `${m.sigStrength}`
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted",
				children: "净值历史不足，指标暂无可靠数据"
			}),
			swing ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 rounded-2xl bg-bg-elevated p-3 text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: swing.action }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs leading-relaxed text-muted",
						children: swing.reason
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-xs text-subtle",
						children: [
							"做 T 环境 ",
							swing.envLevel,
							"（",
							swing.env,
							"）",
							swing.allowT && swing.buyGrid && swing.sellGrid ? ` · 低吸 ${fmtPrice(swing.buyGrid, 4)} / 高抛 ${fmtPrice(swing.sellGrid, 4)}` : ""
						]
					})
				]
			}) : null,
			m ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-xs text-muted",
				children: [
					m.combo,
					" · 置信 ",
					m.conf
				]
			}) : null
		] }, h.code);
	})] });
}
function Stat({ k, v }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl bg-bg-elevated py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[10px] text-subtle",
			children: k
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-sm font-semibold tabular-nums",
			children: v
		})]
	});
}
//#endregion
export { BandPage as component };
