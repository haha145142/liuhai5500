import { i as __toESM } from "../_runtime.mjs";
import { B as require_react, b as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as fmtMoney, d as fmtYi, l as fmtPctShort } from "./format-9-Yv8U5-.mjs";
import { d as ChartCandlestick, f as Briefcase, i as Settings, o as Newspaper, p as Activity, r as Sparkles, t as Trophy, u as ChartLine } from "../_libs/lucide-react.mjs";
import { a as analyzeMarket, i as useApp } from "./router-DhF1B5rM.mjs";
import { i as Tone, n as Glass, r as SectionTitle, t as EmptyNote } from "./Glass-otXZh5Ig.mjs";
import { n as moneyBehavior, t as buildEvidence } from "./evidence-C85O0ei0.mjs";
import { t as IndexGrid } from "./IndexGrid-Bic1Szeb.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-ispLcfjY.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var ITEMS = [
	{
		to: "/portfolio",
		label: "我的持仓",
		sub: "收益 · 体检",
		icon: Briefcase,
		tint: "bg-accent/12 text-accent"
	},
	{
		to: "/market",
		label: "大盘资金",
		sub: "板块 · 资金",
		icon: ChartLine,
		tint: "bg-down/12 text-down"
	},
	{
		to: "/news",
		label: "市场资讯",
		sub: "新闻 · 解读",
		icon: Newspaper,
		tint: "bg-warn/12 text-warn"
	},
	{
		to: "/funds",
		label: "基金排行",
		sub: "强弱 · 榜单",
		icon: Trophy,
		tint: "bg-up/12 text-up"
	},
	{
		to: "/band",
		label: "波段信号",
		sub: "RSI · MACD",
		icon: Activity,
		tint: "bg-accent/12 text-accent"
	},
	{
		to: "/market",
		label: "资金意图",
		sub: "订单 · 博弈",
		icon: ChartCandlestick,
		tint: "bg-down/12 text-down"
	},
	{
		to: "/ai",
		label: "AI 证据链",
		sub: "七步判断",
		icon: Sparkles,
		tint: "bg-accent/12 text-accent"
	},
	{
		to: "/settings",
		label: "设置",
		sub: "数据源 · Key",
		icon: Settings,
		tint: "bg-muted/15 text-muted"
	}
];
function Launcher() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mb-3 grid grid-cols-4 gap-2",
		children: ITEMS.map((it) => {
			const Icon = it.icon;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: it.to,
				className: "glass-tight flex flex-col items-center gap-1.5 px-1 py-3 text-center transition-transform duration-150 active:scale-95",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `flex size-11 items-center justify-center rounded-[14px] ${it.tint}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
							className: "size-5",
							strokeWidth: 1.9
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
						className: "text-[11px] font-semibold text-fg",
						children: it.label
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
						className: "text-[9px] text-subtle",
						children: it.sub
					})
				]
			}, it.label);
		})
	});
}
function Cockpit({ snap, news }) {
	const ev = buildEvidence(snap, news);
	const mb = moneyBehavior(news);
	const avg = snap.indices.length && snap.indices.every((i) => i.pct != null) ? snap.indices.reduce((s, i) => s + (i.pct || 0), 0) / snap.indices.length : null;
	const boards = snap.boards.filter((b) => b.change != null);
	const strongest = boards[0];
	const weakest = boards[boards.length - 1];
	const up = snap.indices.filter((i) => (i.pct || 0) > 0).length;
	const dn = snap.indices.length - up;
	const [aiText, setAiText] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const deep = async () => {
		setBusy(true);
		const prompt = `证据：指数 ${JSON.stringify(snap.indices)}；板块 ${JSON.stringify(snap.sectors.slice(0, 8))}；资金 ${JSON.stringify(snap.flow)}；外围 ${JSON.stringify(snap.global)}；新闻标题 ${news.slice(0, 8).map((n) => n.title).join("；")}。请按7步输出中文结论。`;
		const r = await analyzeMarket({ data: { prompt } });
		setAiText(r.ok ? r.text : r.error || "AI 接口暂不可用，已使用规则版判断");
		setBusy(false);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs font-medium text-muted",
						children: "今日投资结论"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mt-1 text-lg font-semibold tracking-tight",
						children: ev.verdict
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm leading-relaxed text-muted",
						children: ev.summary
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-right",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `text-2xl font-semibold tabular-nums ${ev.score >= 60 ? "tone-up" : ev.score <= 40 ? "tone-down" : "text-fg"}`,
						children: ev.score
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[10px] text-subtle",
						children: "规则评分"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid grid-cols-3 gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
						label: "市场情绪",
						value: ev.verdict
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
						label: "上涨 / 下跌",
						value: `${up} / ${dn}`,
						tone: avg
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
						label: "风险",
						value: ev.risk
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-fg",
				children: ev.steps[6]?.body
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => void deep(),
				disabled: busy,
				className: "mt-3 w-full rounded-2xl bg-accent py-2.5 text-sm font-semibold text-accent-fg transition-transform active:scale-[0.98] disabled:opacity-60",
				children: busy ? "分析中…" : "深度分析"
			}),
			aiText ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted",
				children: aiText
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[10px] text-subtle",
				children: "规则引擎基于已抓取证据；深度分析按需调用。不构成投资建议。"
			})
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
				title: "市场温度计",
				hint: "情绪"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-end justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
					v: avg,
					className: "text-xl font-semibold",
					children: avg == null ? "暂无可靠数据" : avg > 1 ? "偏热" : avg > 0 ? "温和" : avg < -1 ? "偏冷" : "中性"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs text-muted",
					children: fmtPctShort(avg)
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-xs text-muted",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", {
							className: "tone-up",
							children: [up, " 涨"]
						}),
						" / ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", {
							className: "tone-down",
							children: [dn, " 跌"]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 h-1.5 overflow-hidden rounded-full bg-border",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
					className: "block h-full rounded-full bg-accent",
					style: { width: `${Math.min(100, Math.max(0, 50 + (avg || 0) * 10))}%` }
				})
			})
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
			title: "市场扫描",
			hint: "最强 / 最弱"
		}), strongest && weakest ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-2 text-sm",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
					k: "最强",
					v: `${strongest.name} ${fmtPctShort(strongest.change)}`,
					tone: strongest.change
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
					k: "最弱",
					v: `${weakest.name} ${fmtPctShort(weakest.change)}`,
					tone: weakest.change
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
					k: "资金",
					v: snap.flow ? `主力 ${fmtYi(snap.flow.main)}` : "暂无可靠数据",
					tone: snap.flow?.main
				})
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "暂无可靠数据"
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
				title: "资金行为",
				hint: "消息面统计"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-3 gap-2 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
						label: "机构",
						value: String(mb.inst)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
						label: "游资",
						value: String(mb.hot)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
						label: "散户",
						value: String(mb.retail)
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm leading-relaxed text-muted",
				children: mb.judge
			})
		] })
	] });
}
function Mini({ label, value, tone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl bg-bg-elevated px-2 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[10px] text-subtle",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: `mt-0.5 text-sm font-semibold ${tone == null || tone === 0 ? "text-fg" : tone > 0 ? "tone-up" : "tone-down"}`,
			children: value
		})]
	});
}
function Row({ k, v, tone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-between rounded-2xl bg-bg-elevated px-3 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-muted",
			children: k
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: `font-semibold tabular-nums ${tone == null || tone === 0 ? "text-fg" : tone > 0 ? "tone-up" : "tone-down"}`,
			children: v
		})]
	});
}
function Home() {
	const snapshot = useApp((s) => s.snapshot);
	const news = useApp((s) => s.news);
	const portfolio = useApp((s) => s.portfolio);
	const funds = useApp((s) => s.funds);
	let total = 0;
	let pnl = 0;
	let cost = 0;
	for (const h of portfolio) {
		const f = funds[h.code];
		const px = f?.estimate ?? f?.nav;
		cost += h.cost * h.shares;
		if (px == null) {
			total = null;
			pnl = null;
			break;
		}
		total = (total || 0) + px * h.shares;
		pnl = (pnl || 0) + (px - h.cost) * h.shares;
	}
	if (!portfolio.length) {
		total = 0;
		pnl = 0;
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Launcher, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, {
			tight: true,
			className: "flex items-end justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs text-muted",
					children: "组合资产"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 text-2xl font-semibold tabular-nums",
					children: fmtMoney(total)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
					v: pnl,
					className: "text-sm font-semibold",
					children: portfolio.length ? fmtPctShort(cost && pnl != null ? pnl / cost * 100 : null) : "尚未添加持仓"
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/portfolio",
				className: "text-xs font-semibold text-accent",
				children: "查看持仓"
			})]
		}),
		snapshot ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IndexGrid, { indices: snapshot.indices }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyNote, { children: "正在接入指数…" }),
		snapshot ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cockpit, {
			snap: snapshot,
			news: news?.items || []
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyNote, { children: "正在生成今日判断…" })
	] });
}
//#endregion
export { Home as component };
