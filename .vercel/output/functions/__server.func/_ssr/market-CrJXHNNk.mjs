import { i as __toESM } from "../_runtime.mjs";
import { B as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as createServerFn } from "./ssr.mjs";
import { d as fmtYi, i as SECTOR_RULES, l as fmtPctShort } from "./format-B7cjnRuX.mjs";
import { i as useApp, l as createSsrRpc } from "./router-Byr1StPg.mjs";
import { i as Tone, n as Glass, r as SectionTitle, t as EmptyNote } from "./Glass-BjTxdcl0.mjs";
import { t as IndexGrid } from "./IndexGrid-DUNpmhuE.mjs";
import { t as calcSixFactor } from "./six-factor-_XDWLJ69.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/market-CrJXHNNk.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var getAllSectorWatch = createServerFn({ method: "GET" }).handler(createSsrRpc("f0e85605532ca97005390bad23f2c87804ccf55f16e04c0d9b02588f27af55cb"));
function MarketPage() {
	const snapshot = useApp((s) => s.snapshot);
	const selected = useApp((s) => s.selectedSectors);
	const setSectors = useApp((s) => s.setSectors);
	const [allSectors, setAllSectors] = (0, import_react.useState)([]);
	const [sectorLoading, setSectorLoading] = (0, import_react.useState)(false);
	const [sectorQuery, setSectorQuery] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		let alive = true;
		setSectorLoading(true);
		getAllSectorWatch().then((rows) => {
			if (alive) setAllSectors(rows);
		}).finally(() => {
			if (alive) setSectorLoading(false);
		});
		return () => {
			alive = false;
		};
	}, []);
	const bench = snapshot?.indices[0]?.pct ?? null;
	const flow = snapshot?.flow ?? null;
	const knownById = new Map((snapshot?.sectors ?? []).map((s) => [s.id, s]));
	const allByCode = new Map(allSectors.map((s) => [s.bkCode, s]));
	const selectedCodes = selected.map((id) => SECTOR_RULES.find((r) => r.id === id)?.bkCode || id);
	const watched = selectedCodes.map((code) => allByCode.get(code) || knownById.get(code)).filter((s) => !!s);
	const managerRows = (0, import_react.useMemo)(() => {
		const rows = allSectors.length ? allSectors : (snapshot?.boards ?? []).map((b) => ({
			id: b.code,
			name: b.name,
			bkCode: b.code,
			change: b.change,
			flow: b.flow,
			super: null,
			large: null,
			mid: null,
			small: null,
			turnover: null,
			available: b.change != null,
			streak: 0
		}));
		const q = sectorQuery.trim().toLowerCase();
		return q ? rows.filter((s) => s.name.toLowerCase().includes(q)) : rows;
	}, [
		allSectors,
		snapshot?.boards,
		sectorQuery
	]);
	if (!snapshot) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyNote, { children: "正在接入行情…" });
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
			title: "我的关注板块",
			hint: `${watched.length} 个 · 实时六因子`
		}), watched.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "space-y-2",
			children: watched.map((s) => {
				const r = calcSixFactor(s, bench);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl bg-bg-elevated p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
								className: "text-sm",
								children: s.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
								v: s.change,
								className: "font-semibold",
								children: s.available ? fmtPctShort(s.change) : "暂无可靠数据"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 grid grid-cols-3 gap-2 text-center text-[10px]",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
									label: "综合分",
									value: `${r.position}/100`
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
									label: "判断",
									value: r.advice
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
									label: "置信",
									value: `${r.confidence}%`
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 text-[11px] text-muted",
							children: [
								"资金 ",
								s.flow == null ? "—" : fmtYi(s.flow),
								" · ",
								r.basis
							]
						})
					]
				}, s.bkCode);
			})
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "还没有关注板块，请在下方添加。你不添加，就不会显示它的数据。"
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
				title: "管理关注板块",
				hint: sectorLoading ? "正在加载全部板块…" : `${managerRows.length} 个可选`
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-2 text-[11px] leading-relaxed text-muted",
				children: "这里是市场全部可选板块，不是让你全部添加。搜索一个板块，点一下“＋”即可加入；只有你主动选择的板块才会出现在上面的关注区。"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				value: sectorQuery,
				onChange: (e) => setSectorQuery(e.target.value),
				placeholder: "搜索板块，例如：医药、黄金、商业航天、锂矿…",
				className: "mb-3 h-10 w-full rounded-xl bg-bg-elevated px-3 text-xs ring-1 ring-border outline-none"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "max-h-[420px] space-y-1.5 overflow-y-auto pr-1",
				children: [managerRows.map((s) => {
					const on = selectedCodes.includes(s.bkCode);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setSectors(on ? selected.filter((x) => (SECTOR_RULES.find((r) => r.id === x)?.bkCode || x) !== s.bkCode) : [...selected, s.bkCode]),
						className: "flex w-full items-center justify-between rounded-xl bg-bg-elevated px-3 py-2 text-left",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", {
								className: "text-xs",
								children: [on ? "✓ " : "+ ", s.name]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-2 text-[10px] text-subtle",
								children: "板块"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
							v: s.change,
							className: "ml-2 shrink-0 text-xs font-semibold",
							children: s.available ? fmtPctShort(s.change) : "—"
						})]
					}, s.bkCode);
				}), !managerRows.length && !sectorLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "py-4 text-center text-xs text-muted",
					children: "没有找到这个板块"
				}) : null]
			})
		] }),
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
function Mini({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl bg-white/60 p-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[10px] text-subtle",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-0.5 text-xs font-semibold",
			children: value
		})]
	});
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
