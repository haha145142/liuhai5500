import { t as createServerFn } from "./ssr.mjs";
import { i as SECTOR_RULES, m as safeText, n as GLOBAL_DEFS, r as INDEX_DEFS } from "./format-B7cjnRuX.mjs";
import { t as calcIndicators } from "./indicators-D24vzKbj.mjs";
import { a as parseMaybeJsonp, i as n, n as createServerRpc, r as fetchText, t as asArr } from "./fetch-util--uP0UFiK.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/server-BWziT3vg.js
var EM_UT = "fa5fd1943c7b386f172d6893dbfba10b";
var EM_REFERER = "https://quote.eastmoney.com/";
var mem = /* @__PURE__ */ new Map();
function cached(key, ttl, data) {
	if (data) mem.set(key, {
		ts: Date.now(),
		data
	});
	const hit = mem.get(key);
	if (hit && Date.now() - hit.ts < ttl) return hit.data;
	return data;
}
function src(name, ok, note) {
	return {
		name,
		status: ok ? "ok" : "err",
		note
	};
}
async function emJson(url, timeout = 1e4) {
	return parseMaybeJsonp(await fetchText(url, timeout, { Referer: EM_REFERER }));
}
async function fetchIndices() {
	const secids = INDEX_DEFS.map((x) => x.secid).join(",");
	try {
		const j = await emJson(`https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f12,f14,f2,f3,f4&secids=${secids}&ut=${EM_UT}&_=${Date.now()}`);
		const arr = asArr(j?.data?.diff);
		const list = INDEX_DEFS.map((d) => {
			const x = arr.find((v) => String(v.f12) === d.code) || {};
			return {
				name: d.name,
				code: d.code,
				secid: d.secid,
				price: n(x.f2),
				pct: n(x.f3),
				change: n(x.f4)
			};
		});
		if (list.some((x) => x.pct != null)) return {
			list,
			source: src("指数", true, "东方财富实时行情")
		};
	} catch {}
	try {
		const lines = (await fetchText(`https://qt.gtimg.cn/q=${[
			"sh000001",
			"sz399001",
			"sz399006",
			"sh000688"
		].join(",")}`, 8e3)).split(";");
		const list = INDEX_DEFS.map((d, i) => {
			const m = (lines[i] || "").match(/=\"([^\"]*)\"/);
			const p = m ? m[1].split("~") : [];
			return {
				name: d.name,
				code: d.code,
				secid: d.secid,
				price: n(p[3]),
				pct: n(p[32]),
				change: n(p[31])
			};
		});
		return {
			list,
			source: src("指数", list.some((x) => x.pct != null), "腾讯财经兜底")
		};
	} catch {
		return {
			list: INDEX_DEFS.map((d) => ({
				name: d.name,
				code: d.code,
				secid: d.secid,
				price: null,
				pct: null,
				change: null
			})),
			source: src("指数", false, "数据源暂不可用")
		};
	}
}
async function fetchBoards() {
	const fields = "f12,f14,f2,f3,f62,f66,f69,f72,f75,f6";
	async function clist(fs, type) {
		const j = await emJson(`https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=80&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(fs)}&fields=${fields}&ut=${EM_UT}&_=${Date.now()}`, 12e3);
		return asArr(j?.data?.diff).map((x) => ({
			code: String(x.f12 || ""),
			name: String(x.f14 || ""),
			type,
			change: n(x.f3),
			flow: n(x.f62),
			super: n(x.f66),
			large: n(x.f69),
			mid: n(x.f72),
			small: n(x.f75),
			turnover: n(x.f6)
		}));
	}
	try {
		const [ind, con] = await Promise.all([clist("m:90+t:2", "industry"), clist("m:90+t:3", "concept")]);
		const all = [...ind, ...con];
		const boards = all.filter((x) => x.name && x.change != null).map((x) => ({
			code: x.code,
			name: x.name,
			type: x.type,
			change: x.change,
			flow: x.flow
		}));
		const sectors = SECTOR_RULES.map((r) => {
			const hit = all.find((x) => x.code === r.bkCode) || all.find((x) => x.name === r.name) || all.find((x) => r.searchKeys.some((k) => x.name.includes(k)));
			return {
				id: r.id,
				name: r.name,
				bkCode: r.bkCode,
				change: hit?.change ?? null,
				flow: hit?.flow ?? null,
				super: hit?.super ?? null,
				large: hit?.large ?? null,
				mid: hit?.mid ?? null,
				small: hit?.small ?? null,
				turnover: hit?.turnover ?? null,
				available: hit?.change != null,
				streak: 0,
				etfCode: r.etf?.code,
				etfName: r.etf?.name
			};
		});
		return {
			sectors,
			boards: boards.sort((a, b) => (b.change ?? -999) - (a.change ?? -999)),
			source: src("板块", sectors.some((s) => s.available), "东方财富板块资金")
		};
	} catch {
		return {
			sectors: SECTOR_RULES.map((r) => ({
				id: r.id,
				name: r.name,
				bkCode: r.bkCode,
				change: null,
				flow: null,
				super: null,
				large: null,
				mid: null,
				small: null,
				turnover: null,
				available: false,
				streak: 0,
				etfCode: r.etf?.code,
				etfName: r.etf?.name
			})),
			boards: [],
			source: src("板块", false, "数据源暂不可用")
		};
	}
}
async function fetchFlow() {
	try {
		const j = await emJson(`https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=400&po=1&np=1&fltt=2&invt=2&fid=f62&fs=${encodeURIComponent("m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23")}&fields=f62,f66,f69,f72,f75&ut=${EM_UT}&_=${Date.now()}`, 12e3);
		const arr = asArr(j?.data?.diff);
		if (!arr.length) throw new Error("empty");
		const sum = (k) => arr.reduce((s, x) => s + (n(x[k]) || 0), 0);
		return {
			flow: {
				main: sum("f62"),
				super: sum("f66"),
				large: sum("f69"),
				mid: sum("f72"),
				small: sum("f75"),
				count: arr.length
			},
			source: src("资金", true, `东方财富全A抽样 ${arr.length} 只`)
		};
	} catch {
		return {
			flow: null,
			source: src("资金", false, "数据源暂不可用")
		};
	}
}
async function fetchGlobal() {
	try {
		const q = GLOBAL_DEFS.map((x) => x.tencent).join(",");
		const chunks = (await fetchText(`https://qt.gtimg.cn/q=${q}`, 8e3)).split(";");
		const list = GLOBAL_DEFS.map((d, i) => {
			const m = (chunks[i] || "").match(/=\"([^\"]*)\"/);
			const p = m ? m[1].split("~") : [];
			return {
				name: d.name,
				price: n(p[3]),
				pct: n(p[32]) ?? n(p[31])
			};
		});
		return {
			list,
			source: src("外围", list.some((x) => x.pct != null), "腾讯财经")
		};
	} catch {
		return {
			list: [],
			source: src("外围", false, "数据源暂不可用")
		};
	}
}
var getSnapshot_createServerFn_handler = createServerRpc({
	id: "d5c85af2cdd0d4ca6f5ee19fc2d37fa786862b309025e81de5ffb43187814c88",
	name: "getSnapshot",
	filename: "src/lib/data/server.ts"
}, (opts) => getSnapshot.__executeServer(opts));
var getSnapshot = createServerFn({ method: "GET" }).handler(getSnapshot_createServerFn_handler, async () => {
	const hit = cached("snap", 2e4, null);
	if (hit) return hit;
	const [idx, boards, flow, global] = await Promise.all([
		fetchIndices(),
		fetchBoards(),
		fetchFlow(),
		fetchGlobal()
	]);
	return cached("snap", 2e4, {
		indices: idx.list,
		sectors: boards.sectors,
		boards: boards.boards.slice(0, 40),
		flow: flow.flow,
		global: global.list,
		sources: [
			idx.source,
			boards.source,
			flow.source,
			global.source
		],
		fetchedAt: Date.now()
	});
});
function hashId(s) {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = h * 31 + s.charCodeAt(i) | 0;
	return String(h);
}
function classifyNews(title) {
	if (/政策|国务院|央行|财政部|证监会|发改委|降准|降息|LPR/.test(title)) return "policy";
	if (/美股|美联储|美元|黄金|原油|纳指|标普|港股|恒生|外围/.test(title)) return "global";
	if (/半导体|芯片|白酒|新能源|军工|医药|人工智能|机器人/.test(title)) return "sector";
	if (/A股|上证|深成|创业板|大盘|北向|成交/.test(title)) return "market";
	return "other";
}
function newsSentiment(title) {
	if (/涨|升|新高|流入|利好|突破|反弹|超预期/.test(title)) return "bull";
	if (/跌|崩|跳水|利空|制裁|冲突|暴雷|处罚|下滑/.test(title)) return "bear";
	return "neutral";
}
function relatedSectors(title) {
	return SECTOR_RULES.filter((r) => r.keys.some((k) => title.includes(k))).map((r) => r.name);
}
function parsePublished(raw) {
	if (raw == null || raw === "") return null;
	if (typeof raw === "number") {
		if (raw > 0xe8d4a51000) return raw;
		if (raw > 1e9) return raw * 1e3;
		return null;
	}
	const s = String(raw).trim();
	if (!s || /刚刚|刚才|刚刚发布/.test(s)) return null;
	if (/^\d{10,13}$/.test(s)) {
		const n0 = Number(s);
		return s.length === 10 ? n0 * 1e3 : n0;
	}
	const iso = Date.parse(s.replace(/-/g, "/"));
	return Number.isFinite(iso) && iso > 0 ? iso : null;
}
function toNews(title, summary, source, publishedAt, url, fetchedAt) {
	const t = safeText(title);
	if (!t) return null;
	return {
		id: hashId(source + t),
		title: t,
		summary: safeText(summary).slice(0, 180),
		source,
		url,
		publishedAt,
		fetchedAt,
		category: classifyNews(t),
		sentiment: newsSentiment(t),
		relatedSectors: relatedSectors(t)
	};
}
async function fetchTHS(fetchedAt) {
	try {
		return ((await emJson("https://news.10jqka.com.cn/tapp/news/push/stock/?page=1&pagesize=40&track=website", 1e4))?.data?.list || []).map((x) => toNews(String(x.title || ""), String(x.digest || x.summary || ""), "同花顺", parsePublished(x.ctime), String(x.url || ""), fetchedAt)).filter((x) => !!x);
	} catch {
		return [];
	}
}
async function fetchEmFlash(fetchedAt) {
	try {
		return ((await emJson(`https://np-listapi.eastmoney.com/comm/web/getFastNewsList?client=web&biz=web_724&fastColumn=102&sortEnd=&pageSize=30&type=0&_=${Date.now()}`, 1e4))?.data?.fastNewsList || []).map((x) => toNews(String(x.title || x.showTitle || ""), String(x.digest || x.summary || ""), "东方财富快讯", parsePublished(x.showTime || x.date || x.time), String(x.url || x.code_name || ""), fetchedAt)).filter((x) => !!x);
	} catch {
		return [];
	}
}
async function fetchWscn(fetchedAt) {
	try {
		return ((await emJson("https://api-one-wscn.awtmt.com/apiv1/content/lives?channel=global-channel&client=pc&limit=20", 1e4))?.data?.items || []).map((x) => toNews(String(x.title || x.content_text || "").slice(0, 80), String(x.content_text || x.content || ""), "华尔街见闻", parsePublished(x.display_time || x.created_at), String(x.uri || x.url || ""), fetchedAt)).filter((x) => !!x);
	} catch {
		return [];
	}
}
async function fetchGuba(fetchedAt) {
	try {
		const j = await emJson("https://guba.eastmoney.com/interface/GetData.aspx?path=topics/hotlist&param=ps=15&p=1", 8e3);
		return (Array.isArray(j) ? j : j?.re || []).map((x) => toNews(String(x.title || x.post_title || ""), "股吧热帖 · 社区情绪，非官方新闻", "东方财富股吧", parsePublished(x.post_publish_time || x.time), String(x.post_url || ""), fetchedAt)).filter((x) => !!x);
	} catch {
		return [];
	}
}
var getNews_createServerFn_handler = createServerRpc({
	id: "0e39e01627c0019bc0118b3c68923d593e7efdae58ecc850dd18eac7b4936c0b",
	name: "getNews",
	filename: "src/lib/data/server.ts"
}, (opts) => getNews.__executeServer(opts));
var getNews = createServerFn({ method: "GET" }).handler(getNews_createServerFn_handler, async () => {
	const hit = cached("news", 6e4, null);
	if (hit) return hit;
	const fetchedAt = Date.now();
	const [ths, em, wscn, guba] = await Promise.all([
		fetchTHS(fetchedAt),
		fetchEmFlash(fetchedAt),
		fetchWscn(fetchedAt),
		fetchGuba(fetchedAt)
	]);
	const seen = /* @__PURE__ */ new Set();
	const items = [];
	for (const n0 of [
		...ths,
		...em,
		...wscn
	]) {
		if (seen.has(n0.title)) continue;
		seen.add(n0.title);
		items.push(n0);
	}
	items.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
	const latest = items.map((x) => x.publishedAt).filter((x) => x != null && x > 0);
	return cached("news", 6e4, {
		items: items.slice(0, 50),
		deep: items.filter((x) => x.summary.length > 40).slice(0, 12),
		sentiment: guba.slice(0, 12),
		sources: [
			src("同花顺", ths.length > 0, ths.length ? `${ths.length} 条` : "暂不可用"),
			src("东财快讯", em.length > 0, em.length ? `${em.length} 条` : "暂不可用"),
			src("华尔街见闻", wscn.length > 0, wscn.length ? `${wscn.length} 条` : "暂不可用"),
			src("社区情绪", guba.length > 0, guba.length ? `${guba.length} 条` : "暂不可用")
		],
		fetchedAt,
		latestPublishedAt: latest.length ? Math.max(...latest) : null
	});
});
var getFund_createServerFn_handler = createServerRpc({
	id: "d502d08757452348aa74f57b4a5411607d7ed89fba2ebf7b5b7e1403c5c5fdda",
	name: "getFund",
	filename: "src/lib/data/server.ts"
}, (opts) => getFund.__executeServer(opts));
var getFund = createServerFn({ method: "POST" }).validator((input) => input).handler(getFund_createServerFn_handler, async ({ data }) => {
	const code = data.code.replace(/\D/g, "").slice(0, 6);
	const empty = {
		code,
		name: code,
		type: "基金",
		nav: null,
		navDate: null,
		estimate: null,
		estimatePct: null,
		estimateTime: null,
		dayPct: null,
		weekPct: null,
		monthPct: null,
		history: [],
		historyPoints: [],
		metrics: null,
		source: "数据源暂不可用"
	};
	if (!/^\d{6}$/.test(code)) return empty;
	let name = code, nav = null, navDate = null, dayPct = null, source = "数据源暂不可用";
	const history = [];
	const historyPoints = [];
	try {
		const rawRows = (await emJson(`https://api.fund.eastmoney.com/f10/lsjz?fundCode=${code}&pageIndex=1&pageSize=400`, 12e3))?.Data?.LSJZList || [];
		for (const r of rawRows.slice().reverse()) {
			const v = n(r.DWJZ);
			if (v == null) continue;
			history.push(v);
			historyPoints.push({
				date: String(r.FSRQ || ""),
				nav: v,
				changePct: n(r.JZZZL)
			});
		}
		const last = rawRows[0];
		if (last) {
			nav = n(last.DWJZ);
			navDate = String(last.FSRQ || "") || null;
			dayPct = n(last.JZZZL);
			source = "东方财富历史净值";
		}
	} catch {}
	try {
		const gz = parseMaybeJsonp(await fetchText(`https://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`, 8e3, { Referer: "https://fund.eastmoney.com/" }));
		if (gz) {
			name = String(gz.name || name);
			if (nav == null) nav = n(gz.dwjz);
			if (!navDate) navDate = String(gz.jzrq || "") || null;
			empty.estimate = n(gz.gsz);
			empty.estimatePct = n(gz.gszzl);
			empty.estimateTime = String(gz.gztime || "") || null;
			source = source === "数据源暂不可用" ? "天天基金估值" : source + " + 天天基金估值";
		}
	} catch {}
	if (name === code) try {
		const j = await emJson(`https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${code}`, 6e3);
		const hit = (j?.Datas || []).find((x) => x.CODE === code) || j?.Datas?.[0];
		if (hit?.NAME) name = hit.NAME;
		if (hit?.CATEGORYDESC) empty.type = hit.CATEGORYDESC;
	} catch {}
	const metrics = calcIndicators(history);
	const latest = history[history.length - 1] ?? null;
	const periodPct = (days) => {
		if (latest == null || history.length <= days) return null;
		const base = history[history.length - 1 - days];
		return base ? (latest - base) / base * 100 : null;
	};
	return {
		...empty,
		code,
		name,
		nav,
		navDate,
		dayPct,
		weekPct: periodPct(5),
		monthPct: periodPct(20),
		history,
		historyPoints,
		metrics,
		source
	};
});
var searchFund_createServerFn_handler = createServerRpc({
	id: "38368aa5bcbe1c86986c53744abc9f7fb688a49ce64d4f5cde0e4d04d71e9e27",
	name: "searchFund",
	filename: "src/lib/data/server.ts"
}, (opts) => searchFund.__executeServer(opts));
var searchFund = createServerFn({ method: "POST" }).validator((input) => input).handler(searchFund_createServerFn_handler, async ({ data }) => {
	const q = data.q.trim();
	if (!q) return [];
	try {
		return ((await emJson(`https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(q)}`, 8e3))?.Datas || []).filter((x) => x.CODE && x.NAME).slice(0, 8).map((x) => ({
			code: String(x.CODE),
			name: String(x.NAME),
			type: String(x.CATEGORYDESC || "基金")
		}));
	} catch {
		return [];
	}
});
var getFundRank_createServerFn_handler = createServerRpc({
	id: "cb8805ffcf74315a64dc4280f23e4072d8b9d2531e8c56cc68aea777ea5f9eae",
	name: "getFundRank",
	filename: "src/lib/data/server.ts"
}, (opts) => getFundRank.__executeServer(opts));
var getFundRank = createServerFn({ method: "POST" }).validator((input) => input).handler(getFundRank_createServerFn_handler, async ({ data }) => {
	const sort = data.sort || "r";
	const sc = sort === "z" ? "zzf" : sort === "1n" ? "1nzf" : sort === "6y" ? "6yzf" : "rzf";
	try {
		const text = await fetchText(`https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=all&rs=&gs=0&sc=${sc}&st=desc&pi=1&pn=40&dx=1&_=${Date.now()}`, 12e3, { Referer: "https://fund.eastmoney.com/" });
		const rows = (parseMaybeJsonp(text)?.datas || []).map((line) => {
			const a = String(line).split(",");
			return {
				code: a[0] || "",
				name: a[1] || "",
				nav: n(a[4]),
				day: n(a[6]),
				week: n(a[7]),
				month: n(a[8]),
				ytd: n(a[14])
			};
		}).filter((x) => x.code && x.name);
		return {
			rows,
			source: rows.length ? "天天基金/东方财富排行" : "数据源暂不可用",
			fetchedAt: Date.now()
		};
	} catch {
		return {
			rows: [],
			source: "数据源暂不可用",
			fetchedAt: Date.now()
		};
	}
});
var analyzeMarket_createServerFn_handler = createServerRpc({
	id: "258976656f4feb5fd9a5db431afd47b55fb1695680e0adcfe50f4b89f4c8472a",
	name: "analyzeMarket",
	filename: "src/lib/data/server.ts"
}, (opts) => analyzeMarket.__executeServer(opts));
var analyzeMarket = createServerFn({ method: "POST" }).validator((input) => input).handler(analyzeMarket_createServerFn_handler, async ({ data }) => {
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) return {
		ok: false,
		error: "AI 暂不可用",
		text: ""
	};
	const res = await fetch("https://api.x.ai/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: "grok-4.5",
			max_tokens: 700,
			messages: [{
				role: "system",
				content: "你是严谨的基金投研助手。只用用户提供的证据，没有就写「暂无可靠数据」，绝不编造数字。用大白话中文。不构成投资建议。按7步：发生了什么/市场反应/资金确认/新闻催化/政策支持/外围共振/最后判断。"
			}, {
				role: "user",
				content: data.prompt.slice(0, 6e3)
			}]
		})
	});
	if (!res.ok) return {
		ok: false,
		error: `AI 接口 ${res.status}`,
		text: ""
	};
	return {
		ok: true,
		error: "",
		text: (await res.json()).choices?.[0]?.message?.content ?? ""
	};
});
var analyzeNews_createServerFn_handler = createServerRpc({
	id: "57c407fae0cd5ef4799fc602a31b13230fa9461e3c1969ac48deedbf69111048",
	name: "analyzeNews",
	filename: "src/lib/data/server.ts"
}, (opts) => analyzeNews.__executeServer(opts));
var analyzeNews = createServerFn({ method: "POST" }).validator((input) => input).handler(analyzeNews_createServerFn_handler, async ({ data }) => {
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) return {
		ok: false,
		error: "AI 暂不可用：未配置 XAI_API_KEY",
		text: ""
	};
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 25e3);
	try {
		const res = await fetch("https://api.x.ai/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`
			},
			signal: controller.signal,
			body: JSON.stringify({
				model: "grok-4.5",
				max_tokens: 1e3,
				temperature: .15,
				messages: [{
					role: "system",
					content: "你是基金投资者的新闻解读助手。只使用输入中的新闻、发布时间、板块、指数和资金证据。绝不补造事实、数字、时间或来源；没有证据就明确写‘暂无可靠数据’。必须区分新闻事实与市场推测。不要机械复述标题，不要喊单，不给确定性买卖建议。用简洁白话中文。输出结构固定为：【今日新闻结论】【最重要的新闻】【板块影响】【与我的持仓关系】【一句话提醒】。每条重要新闻写：发生了什么｜为什么重要｜影响谁｜利好/利空/中性｜证据是否验证。无法判断就写‘暂无可靠数据’。"
				}, {
					role: "user",
					content: data.prompt.slice(0, 1e4)
				}]
			})
		});
		if (!res.ok) return {
			ok: false,
			error: `AI 接口 ${res.status}`,
			text: ""
		};
		const text = (await res.json()).choices?.[0]?.message?.content?.trim() ?? "";
		return text ? {
			ok: true,
			error: "",
			text
		} : {
			ok: false,
			error: "AI 未返回有效解读",
			text: ""
		};
	} catch (e) {
		return {
			ok: false,
			error: e instanceof Error && e.name === "AbortError" ? "AI 解读超时，请稍后重试" : "AI 解读暂时不可用",
			text: ""
		};
	} finally {
		clearTimeout(timer);
	}
});
//#endregion
export { analyzeMarket_createServerFn_handler, analyzeNews_createServerFn_handler, getFundRank_createServerFn_handler, getFund_createServerFn_handler, getNews_createServerFn_handler, getSnapshot_createServerFn_handler, searchFund_createServerFn_handler };
