import { b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { d as fmtYi, i as SECTOR_RULES, l as fmtPctShort } from "./format-9-Yv8U5-.mjs";
import { i as useApp } from "./router-DhF1B5rM.mjs";
import { i as Tone, n as Glass, r as SectionTitle, t as EmptyNote } from "./Glass-otXZh5Ig.mjs";
import { t as IndexGrid } from "./IndexGrid-Bic1Szeb.mjs";
import { t as calcSixFactor } from "./six-factor-_XDWLJ69.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/market-BQZ0X662.js
var import_jsx_runtime = require_jsx_runtime();
function MarketPage() {
	const snapshot = useApp((s) => s.snapshot);
	const selected = useApp((s) => s.selectedSectors);
	const setSectors = useApp((s) => s.setSectors);
	if (!snapshot) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyNote, { children: "正在接入行情…" });
	const bench = snapshot.indices[0]?.pct ?? null;
	const watched = snapshot.sectors.filter((s) => selected.includes(s.id));
	const flow = snapshot.flow;
	const tech = snapshot.sectors.slice(0, 8);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IndexGrid, { indices: snapshot.indices }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
			title: "全市场资金",
			hint: snapshot.sources.find((s) => s.name === "资金")?.note
		}), flow ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-2 gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlowCell, {
					label: "主力净流入",
					v: flow.main
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlowCell, {
					label: "超大单",
					v: flow.super
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlowCell, {
					label: "大单",
					v: flow.large
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlowCell, {
					label: "中单",
					v: flow.mid
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlowCell, {
					label: "小单",
					v: flow.small
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl bg-bg-elevated p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[11px] text-subtle",
						children: "抽样只数"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-lg font-semibold tabular-nums",
						children: flow.count
					})]
				})
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "资金数据源暂不可用"
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
			title: "科技八板块",
			hint: "实时"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-2 gap-2",
			children: tech.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl bg-bg-elevated p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs text-muted",
						children: s.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
						v: s.change,
						className: "mt-1 block text-lg font-semibold",
						children: s.available ? fmtPctShort(s.change) : "暂无可靠数据"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-[11px] text-subtle",
						children: ["资金 ", s.flow == null ? "—" : fmtYi(s.flow)]
					})
				]
			}, s.id))
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
			title: "自选板块建议",
			hint: "六因子"
		}), watched.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "space-y-2",
			children: watched.map((s) => {
				const r = calcSixFactor(s, bench);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl bg-bg-elevated p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
							className: "text-sm",
							children: s.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
							v: s.change,
							className: "font-semibold",
							children: s.available ? fmtPctShort(s.change) : "—"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-1 text-xs text-muted",
						children: [
							r.advice,
							" · 置信 ",
							r.confidence,
							"% · ",
							r.basis
						]
					})]
				}, s.id);
			})
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "请在下方勾选关注板块"
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "管理板块" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-wrap gap-2",
			children: SECTOR_RULES.map((r) => {
				const on = selected.includes(r.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setSectors(on ? selected.filter((x) => x !== r.id) : [...selected, r.id]),
					className: `rounded-full px-3 py-1.5 text-xs font-semibold ${on ? "bg-accent text-accent-fg" : "bg-bg-elevated text-muted"}`,
					children: r.name
				}, r.id);
			})
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
			title: "行业涨跌榜",
			hint: "东财"
		}), snapshot.boards.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "space-y-1",
			children: snapshot.boards.slice(0, 12).map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between py-1 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-fg",
					children: b.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
					v: b.change,
					className: "font-semibold",
					children: fmtPctShort(b.change)
				})]
			}, b.code + b.name))
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "暂无可靠数据"
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "外围市场" }), snapshot.global.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-2 gap-2",
			children: snapshot.global.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl bg-bg-elevated p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs text-muted",
					children: g.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
					v: g.pct,
					className: "text-base font-semibold",
					children: g.pct == null ? "暂无可靠数据" : fmtPctShort(g.pct)
				})]
			}, g.name))
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "外围数据源暂不可用"
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "px-1 pb-2 text-[10px] text-subtle",
			children: ["数据源：", snapshot.sources.map((s) => `${s.name}${s.status === "ok" ? "✓" : "×"}`).join(" · ")]
		})
	] });
}
function FlowCell({ label, v }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl bg-bg-elevated p-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[11px] text-subtle",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
			v,
			className: "text-lg font-semibold",
			children: fmtYi(v)
		})]
	});
}
//#endregion
export { MarketPage as component };
