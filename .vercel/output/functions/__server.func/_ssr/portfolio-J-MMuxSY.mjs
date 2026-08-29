import { i as __toESM } from "../_runtime.mjs";
import { B as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as fmtMoney, l as fmtPctShort, p as matchFundSector, u as fmtPrice } from "./format-9-Yv8U5-.mjs";
import { i as useApp, n as isTradeTime, s as searchFund } from "./router-DhF1B5rM.mjs";
import { i as Tone, n as Glass, r as SectionTitle, t as EmptyNote } from "./Glass-otXZh5Ig.mjs";
import { n as calcSwingTrade } from "./indicators-D24vzKbj.mjs";
import { t as calcSixFactor } from "./six-factor-_XDWLJ69.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/portfolio-J-MMuxSY.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function periodReturn(fund, tradingDays, current) {
	if (!fund || current == null || fund.history.length <= tradingDays) return null;
	const base = fund.history[fund.history.length - 1 - tradingDays];
	return base ? (current - base) / base * 100 : null;
}
function FundCard({ holding, fund, sector, benchPct, onRemove, onUpdate }) {
	const [open, setOpen] = (0, import_react.useState)(true);
	const [editing, setEditing] = (0, import_react.useState)(false);
	const [shares, setShares] = (0, import_react.useState)(String(holding.shares));
	const [cost, setCost] = (0, import_react.useState)(String(holding.cost));
	const name = fund?.name || holding.name || holding.code;
	const live = isTradeTime();
	const px = live ? fund?.estimate ?? fund?.nav ?? null : fund?.nav ?? fund?.estimate ?? null;
	const day = live ? fund?.estimatePct ?? fund?.dayPct ?? null : fund?.dayPct ?? fund?.estimatePct ?? null;
	const value = px != null ? px * holding.shares : null;
	const costVal = holding.cost * holding.shares;
	const pnl = value != null ? value - costVal : null;
	const pnlPct = value != null && costVal ? pnl / costVal * 100 : null;
	const mapped = matchFundSector(name);
	const six = sector && sector.available ? calcSixFactor(sector, benchPct) : null;
	const swing = calcSwingTrade(fund?.metrics ?? null, holding.cost, px || 0);
	const estimateGap = fund?.estimate != null && fund.nav ? (fund.estimate - fund.nav) / fund.nav * 100 : null;
	const periods = (0, import_react.useMemo)(() => [
		["1周", 5],
		["1月", 20],
		["3月", 60],
		["6月", 120],
		["1年", 250]
	], []);
	const saveEdit = () => {
		const s = Number(shares);
		const c = Number(cost);
		if (s > 0 && c > 0) {
			onUpdate({
				shares: s,
				cost: c
			});
			setEditing(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "glass mb-3 p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-lg font-semibold text-fg",
						children: [
							name,
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-normal text-muted",
								children: holding.code
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-1 text-xs text-muted",
						children: [
							live ? "盘中实时估值" : "收盘后官方净值",
							" · ",
							fund?.source || "等待数据"
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-right",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
						v: day,
						className: "text-2xl font-semibold",
						children: fmtPctShort(day)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[10px] text-muted",
						children: live ? "今日估值涨跌" : "最近交易日涨跌"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 rounded-2xl bg-white/60 p-3 ring-1 ring-white/70",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-muted",
							children: "当前净值/估值"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 text-xl font-semibold tabular-nums",
							children: fmtPrice(px, 4)
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-right",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs text-muted",
								children: "持仓市值"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-1 text-xl font-semibold tabular-nums",
								children: fmtMoney(value)
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 text-[11px] text-muted",
						children: [fund?.nav != null ? `官方净值 ${fmtPrice(fund.nav, 4)} · ${fund.navDate || "日期未知"}` : "官方净值暂无", fund?.estimate != null ? ` · 盘中估值 ${fmtPrice(fund.estimate, 4)}${fund.estimateTime ? ` · ${fund.estimateTime}` : ""}` : ""]
					}),
					estimateGap != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-1 text-[11px] text-muted",
						children: ["估值校验：相对最近官方净值 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
							v: estimateGap,
							children: fmtPctShort(estimateGap)
						})]
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid grid-cols-4 gap-2 text-[11px] text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						label: "持仓金额",
						value: fmtMoney(value)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						label: "持有收益",
						value: fmtMoney(pnl),
						tone: pnl
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						label: "收益率",
						value: fmtPctShort(pnlPct),
						tone: pnlPct
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						label: "成本",
						value: fmtPrice(holding.cost, 4)
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 rounded-2xl bg-bg-elevated p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
							className: "text-sm",
							children: "最近收益"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] text-muted",
							children: "按当前持仓份额回算"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 grid grid-cols-5 gap-1.5",
						children: periods.map(([label, days]) => {
							const r = periodReturn(fund, days, fund?.nav ?? fund?.estimate ?? null);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-xl bg-white/60 px-1 py-2 text-center",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[10px] text-muted",
									children: label
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
									v: r,
									className: "mt-0.5 block text-xs font-semibold",
									children: fmtPctShort(r)
								})]
							}, label);
						})
					}),
					fund?.history.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 text-[11px] text-muted",
						children: [
							"最近一周 ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
								v: periodReturn(fund, 5, fund.nav ?? fund.estimate),
								children: fmtPctShort(periodReturn(fund, 5, fund.nav ?? fund.estimate))
							}),
							"· 最近一月 ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
								v: periodReturn(fund, 20, fund.nav ?? fund.estimate),
								children: fmtPctShort(periodReturn(fund, 20, fund.nav ?? fund.estimate))
							})
						]
					}) : null
				]
			}),
			fund?.metrics ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 rounded-2xl bg-bg-elevated p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", {
							className: "text-sm",
							children: ["波段信号 · ", fund.metrics.band]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs font-semibold text-accent",
							children: [fund.metrics.bandScore, "/100"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 h-2 overflow-hidden rounded-full bg-slate-200",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full rounded-full bg-accent",
							style: { width: `${fund.metrics.bandScore}%` }
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 grid grid-cols-3 gap-2 text-center text-[11px]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
								label: "趋势",
								value: `${fund.metrics.trend} ${fund.metrics.trendScore}`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
								label: "RSI",
								value: fund.metrics.rsi.toFixed(1)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
								label: "信号强度",
								value: `${fund.metrics.sigStrength}`
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 flex flex-wrap gap-1.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tag, { children: fund.metrics.band }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tag, { children: fund.metrics.trend }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tag, { children: `RSI ${fund.metrics.rsi.toFixed(0)}` }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tag, { children: `BOLL ${fmtPrice(fund.metrics.lower, 4)} / ${fmtPrice(fund.metrics.upper, 4)}` }),
							swing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tag, { children: swing.action }) : null
						]
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-xs text-muted",
				children: "净值历史不足 35 个交易日，暂不生成可靠波段信号。"
			}),
			mapped ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 rounded-2xl bg-accent/8 p-3 text-xs text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", {
						className: "text-fg",
						children: ["映射板块：", mapped.name]
					}),
					sector?.change != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [" · 今日 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
						v: sector.change,
						children: fmtPctShort(sector.change)
					})] }) : " · 暂无板块行情",
					six ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-1",
						children: [
							"组合判断：",
							six.advice,
							" · 置信 ",
							six.confidence,
							"% · ",
							six.basis
						]
					}) : null
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "mt-3 w-full rounded-2xl bg-bg-elevated py-2 text-sm font-semibold text-fg",
				onClick: () => setOpen((v) => !v),
				children: open ? "收起原因与指标" : "为什么涨跌 / 波段建议"
			}),
			open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 space-y-2 rounded-2xl bg-white/55 p-3 text-xs leading-relaxed text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
						className: "text-fg",
						children: "综合判断："
					}), fund?.metrics?.combo || "暂无可靠波段结论"] }),
					swing ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
							className: "text-fg",
							children: "波段建议："
						}),
						swing.reason,
						" · 环境 ",
						swing.envLevel
					] }) : null,
					fund?.metrics ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
						"MACD ",
						fund.metrics.macd.toFixed(4),
						" · BIAS ",
						fund.metrics.bias.toFixed(2),
						"% · DIF ",
						fund.metrics.dif.toFixed(4),
						" · DEA ",
						fund.metrics.dea.toFixed(4)
					] }) : null,
					fund?.metrics?.sigConds.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["触发条件：", fund.metrics.sigConds.join(" · ")] }) : null
				]
			}) : null,
			editing ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid grid-cols-2 gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: shares,
						onChange: (e) => setShares(e.target.value),
						inputMode: "decimal",
						className: "h-10 rounded-xl bg-bg-elevated px-3 text-sm ring-1 ring-border",
						placeholder: "份额"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: cost,
						onChange: (e) => setCost(e.target.value),
						inputMode: "decimal",
						className: "h-10 rounded-xl bg-bg-elevated px-3 text-sm ring-1 ring-border",
						placeholder: "成本价"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: saveEdit,
						className: "rounded-xl bg-accent py-2 text-sm font-semibold text-accent-fg",
						children: "保存修改"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setEditing(false),
						className: "rounded-xl bg-bg-elevated py-2 text-sm font-semibold",
						children: "取消"
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setEditing(true),
					className: "flex-1 rounded-xl bg-bg-elevated py-2 text-sm",
					children: "编辑"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onRemove,
					className: "flex-1 rounded-xl bg-bg-elevated py-2 text-sm text-up",
					children: "删除"
				})]
			})
		]
	});
}
function Metric({ label, value, tone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl bg-white/55 px-1.5 py-2 text-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[10px] text-subtle",
			children: label
		}), tone === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-0.5 text-xs font-semibold text-fg tabular-nums",
			children: value
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
			v: tone,
			className: "mt-0.5 block text-xs font-semibold",
			children: value
		})]
	});
}
function Tag({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-fg ring-1 ring-white/70",
		children
	});
}
var ALERT_KEY = "fund_ai_pro_alerts_v1";
function readAlerts() {
	if (typeof window === "undefined") return [];
	try {
		const raw = JSON.parse(localStorage.getItem(ALERT_KEY) || "[]");
		return Array.isArray(raw) ? raw : [];
	} catch {
		return [];
	}
}
function navAt(fund, tradingDaysAgo) {
	if (!fund) return null;
	const points = fund.historyPoints;
	if (!points.length) return null;
	const idx = points.length - 1 - tradingDaysAgo;
	return idx >= 0 ? points[idx]?.nav ?? null : null;
}
function currentPrice(fund) {
	if (!fund) return null;
	return isTradeTime() ? fund.estimate ?? fund.nav ?? null : fund.nav ?? fund.estimate ?? null;
}
function monthKey(date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function monthCells(cursor) {
	const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
	const start = new Date(first);
	start.setDate(1 - first.getDay());
	return Array.from({ length: 42 }, (_, i) => {
		const d = new Date(start);
		d.setDate(start.getDate() + i);
		return d;
	});
}
function dailyPortfolioPnl(dateKey, portfolio, funds) {
	let pnl = 0;
	let found = false;
	for (const h of portfolio) {
		const p = funds[h.code]?.historyPoints.find((x) => x.date === dateKey);
		if (p?.changePct != null) {
			pnl += h.shares * p.nav * (p.changePct / 100);
			found = true;
		}
	}
	return found ? pnl : null;
}
function PortfolioPage() {
	const portfolio = useApp((s) => s.portfolio);
	const funds = useApp((s) => s.funds);
	const snapshot = useApp((s) => s.snapshot);
	const addHolding = useApp((s) => s.addHolding);
	const updateHolding = useApp((s) => s.updateHolding);
	const removeHolding = useApp((s) => s.removeHolding);
	const [code, setCode] = (0, import_react.useState)("");
	const [shares, setShares] = (0, import_react.useState)("");
	const [cost, setCost] = (0, import_react.useState)("");
	const [hint, setHint] = (0, import_react.useState)("");
	const [hits, setHits] = (0, import_react.useState)([]);
	const [alerts, setAlerts] = (0, import_react.useState)([]);
	const [alertCode, setAlertCode] = (0, import_react.useState)("");
	const [alertKind, setAlertKind] = (0, import_react.useState)("止盈");
	const [alertPct, setAlertPct] = (0, import_react.useState)("");
	const [calendarCursor, setCalendarCursor] = (0, import_react.useState)(() => /* @__PURE__ */ new Date());
	(0, import_react.useEffect)(() => setAlerts(readAlerts()), []);
	(0, import_react.useEffect)(() => {
		try {
			localStorage.setItem(ALERT_KEY, JSON.stringify(alerts));
		} catch {}
	}, [alerts]);
	const bench = snapshot?.indices[0]?.pct ?? null;
	const live = isTradeTime();
	const summary = (0, import_react.useMemo)(() => {
		let costSum = 0;
		let total = 0;
		let pnl = 0;
		let dayPnl = 0;
		let missing = false;
		for (const h of portfolio) {
			const f = funds[h.code];
			const px = currentPrice(f);
			const costVal = h.cost * h.shares;
			costSum += costVal;
			if (px == null) {
				missing = true;
				continue;
			}
			total += px * h.shares;
			pnl += (px - h.cost) * h.shares;
			if (f) dayPnl += px * h.shares * ((live ? f.estimatePct ?? f.dayPct : f.dayPct ?? f.estimatePct) || 0) / 100;
		}
		const healthBase = portfolio.filter((h) => (funds[h.code]?.metrics?.bandScore ?? 50) <= 45).length;
		const health = portfolio.length ? Math.max(20, Math.min(95, 88 - healthBase * 12 - (missing ? 8 : 0))) : null;
		return {
			costSum,
			total,
			pnl,
			dayPnl,
			missing,
			health,
			healthBase
		};
	}, [
		funds,
		live,
		portfolio
	]);
	const periodSummary = (0, import_react.useMemo)(() => {
		return [
			["1周", 5],
			["1月", 20],
			["3月", 60],
			["6月", 120],
			["1年", 250]
		].map(([label, days]) => {
			let amount = 0;
			let baseValue = 0;
			let found = false;
			for (const h of portfolio) {
				const f = funds[h.code];
				const now = f?.nav ?? f?.estimate ?? null;
				const base = navAt(f, Number(days));
				if (now != null && base != null) {
					amount += (now - base) * h.shares;
					baseValue += base * h.shares;
					found = true;
				}
			}
			return {
				label: String(label),
				amount: found ? amount : null,
				pct: found && baseValue ? amount / baseValue * 100 : null
			};
		});
	}, [funds, portfolio]);
	const calendar = (0, import_react.useMemo)(() => {
		const cells = monthCells(calendarCursor);
		const activeMonth = monthKey(calendarCursor);
		return cells.map((date) => {
			const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
			return {
				date,
				key,
				inMonth: monthKey(date) === activeMonth,
				pnl: dailyPortfolioPnl(key, portfolio, funds)
			};
		});
	}, [
		calendarCursor,
		funds,
		portfolio
	]);
	const onSearch = async (q) => {
		setCode(q);
		if (q.trim().length < 2) {
			setHits([]);
			return;
		}
		setHits(await searchFund({ data: { q } }));
	};
	const add = () => {
		if (!/^\d{6}$/.test(code) || Number(shares) <= 0 || Number(cost) <= 0) {
			setHint("请输入 6 位基金代码、份额和成本价");
			return;
		}
		const name = hits.find((h) => h.code === code)?.name || code;
		addHolding({
			code,
			name,
			shares: Number(shares),
			cost: Number(cost)
		});
		setCode("");
		setShares("");
		setCost("");
		setHits([]);
		setHint("已保存，正在读取官方净值与盘中估值…");
	};
	const addAlert = () => {
		const pct = Number(alertPct);
		if (!/^\d{6}$/.test(alertCode) || !Number.isFinite(pct) || pct <= 0) return;
		setAlerts((cur) => [...cur.filter((x) => !(x.code === alertCode && x.kind === alertKind)), {
			code: alertCode,
			kind: alertKind,
			targetPct: pct
		}]);
		setAlertCode("");
		setAlertPct("");
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
				title: "我的持仓",
				hint: `${portfolio.length} 只`,
				right: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs text-muted",
					children: live ? "盘中估值" : "收盘官方净值"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs text-muted",
						children: "整体盈亏"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
						v: summary.missing ? null : summary.pnl,
						className: "text-4xl font-semibold",
						children: summary.missing ? "—" : fmtMoney(summary.pnl)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
						v: summary.missing || !summary.costSum ? null : summary.pnl / summary.costSum * 100,
						className: "mt-1 block text-lg font-semibold",
						children: summary.missing || !summary.costSum ? "" : fmtPctShort(summary.pnl / summary.costSum * 100)
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-right text-xs text-muted",
					children: [
						live ? "盘中交叉校验" : "官方净值口径",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
						"总资产 ",
						summary.missing ? "—" : fmtMoney(summary.total),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
						"成本 ",
						fmtMoney(summary.costSum)
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid grid-cols-2 gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl bg-bg-elevated p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[11px] text-subtle",
							children: live ? "今日实时收益" : "最近交易日收益"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
							v: summary.dayPnl,
							className: "mt-1 block text-xl font-semibold",
							children: fmtMoney(summary.dayPnl)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[10px] text-muted",
							children: "数据源自动随交易时段切换"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl bg-bg-elevated p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[11px] text-subtle",
							children: "组合健康度"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 text-xl font-semibold",
							children: summary.health == null ? "—" : summary.health
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-[10px] text-muted",
							children: [summary.healthBase, " 只处于偏高/高位区"]
						})
					]
				})]
			})
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
				title: "最近收益",
				hint: "按当前持仓回算"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-5 gap-1.5",
				children: periodSummary.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl bg-bg-elevated p-2 text-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[10px] text-muted",
							children: p.label
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
							v: p.amount,
							className: "mt-1 block text-sm font-semibold",
							children: fmtMoney(p.amount)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
							v: p.pct,
							className: "text-[10px]",
							children: fmtPctShort(p.pct)
						})
					]
				}, p.label))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 rounded-2xl bg-accent/8 p-3 text-xs text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
						className: "text-fg",
						children: "总收益："
					}),
					summary.missing ? "部分基金尚无可用净值" : `${fmtMoney(summary.pnl)} · ${summary.costSum ? fmtPctShort(summary.pnl / summary.costSum * 100) : "—"}`,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-2",
						children: "盘中使用估值，收盘后自动切回官方净值。"
					})
				]
			})
		] }),
		portfolio.length ? portfolio.map((h) => {
			const fname = funds[h.code]?.name || h.name;
			const rule = matchFundSector(fname);
			const sector = rule ? snapshot?.sectors.find((s) => s.id === rule.id) : void 0;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FundCard, {
				holding: h,
				fund: funds[h.code],
				sector,
				benchPct: bench,
				onUpdate: (patch) => updateHolding(h.code, patch),
				onRemove: () => removeHolding(h.code)
			}, h.code);
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyNote, { children: "还没有持仓。添加基金后会自动拉取官方净值、盘中估值和历史指标。" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			onClick: () => addHolding({
				code: "110022",
				name: "易方达消费行业",
				shares: 1e3,
				cost: 3.2
			}),
			className: "w-full rounded-2xl bg-accent py-2.5 text-sm font-semibold text-accent-fg",
			children: "载入 1 只示例持仓"
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
				title: "收益日历",
				hint: `${calendarCursor.getFullYear()}/${String(calendarCursor.getMonth() + 1).padStart(2, "0")}`
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between rounded-2xl bg-bg-elevated px-3 py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setCalendarCursor(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1)),
						className: "size-9 rounded-full bg-white/70 text-lg",
						children: "‹"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: [
						calendarCursor.getFullYear(),
						"年",
						calendarCursor.getMonth() + 1,
						"月"
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setCalendarCursor(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1)),
						className: "size-9 rounded-full bg-white/70 text-lg",
						children: "›"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 grid grid-cols-7 gap-1 text-center text-[10px] text-muted",
				children: [[
					"日",
					"一",
					"二",
					"三",
					"四",
					"五",
					"六"
				].map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "py-1",
					children: d
				}, d)), calendar.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `min-h-12 rounded-xl p-1 ${c.inMonth ? "bg-bg-elevated" : "opacity-30"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs",
						children: c.date.getDate()
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
						v: c.pnl,
						className: "mt-1 block text-[10px] font-semibold",
						children: c.pnl == null ? "—" : fmtMoney(c.pnl)
					})]
				}, c.key))]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[10px] text-muted",
				children: "收益日历按历史官方净值与当前持仓份额估算，仅作为回顾，不代表当时实际持仓。"
			})
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
				title: "止盈 / 止损提醒",
				hint: "本地阈值 · 触发不离场"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-3 gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: alertCode,
						onChange: (e) => setAlertCode(e.target.value),
						placeholder: "基金代码",
						inputMode: "numeric",
						className: "h-11 rounded-2xl bg-bg-elevated px-3 text-sm ring-1 ring-border"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: alertKind,
						onChange: (e) => setAlertKind(e.target.value),
						className: "h-11 rounded-2xl bg-bg-elevated px-3 text-sm ring-1 ring-border",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "止盈" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "止损" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: alertPct,
						onChange: (e) => setAlertPct(e.target.value),
						placeholder: "收益率 %",
						inputMode: "decimal",
						className: "h-11 rounded-2xl bg-bg-elevated px-3 text-sm ring-1 ring-border"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: addAlert,
				className: "mt-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg",
				children: "添加提醒"
			}),
			alerts.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 space-y-2",
				children: alerts.map((a) => {
					const h = portfolio.find((x) => x.code === a.code);
					const f = funds[a.code];
					const px = currentPrice(f);
					const gain = h && px != null && h.cost ? (px - h.cost) / h.cost * 100 : null;
					const triggered = gain != null && (a.kind === "止盈" ? gain >= a.targetPct : gain <= -a.targetPct);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between rounded-2xl bg-bg-elevated p-3 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
							a.code,
							" · ",
							a.kind,
							" ",
							a.targetPct,
							"%"
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: triggered ? "font-semibold text-up" : "text-muted",
							children: gain == null ? "等待净值" : triggered ? "已触发" : `当前 ${fmtPctShort(gain)}`
						})]
					}, `${a.code}-${a.kind}`);
				})
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyNote, { children: "暂无提醒。添加一只基金并设置目标收益率即可。" })
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "添加基金" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: code,
					onChange: (e) => void onSearch(e.target.value),
					placeholder: "6 位基金代码或名称",
					className: "h-11 w-full rounded-2xl bg-bg-elevated px-3 text-sm ring-1 ring-border"
				}),
				hits.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-hidden rounded-2xl ring-1 ring-border",
					children: hits.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-bg-elevated",
						onClick: () => {
							setCode(h.code);
							setHits([]);
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: h.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted",
							children: h.code
						})]
					}, h.code))
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-2 gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: shares,
						onChange: (e) => setShares(e.target.value),
						placeholder: "份额",
						inputMode: "decimal",
						className: "h-11 rounded-2xl bg-bg-elevated px-3 text-sm ring-1 ring-border"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: cost,
						onChange: (e) => setCost(e.target.value),
						placeholder: "成本价",
						inputMode: "decimal",
						className: "h-11 rounded-2xl bg-bg-elevated px-3 text-sm ring-1 ring-border"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: add,
					className: "h-11 w-full rounded-2xl bg-fg text-sm font-semibold text-bg",
					children: "保存持仓"
				}),
				hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted",
					children: hint
				}) : null
			]
		})] })
	] });
}
//#endregion
export { PortfolioPage as component };
