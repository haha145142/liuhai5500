import { t as createServerFn } from "./ssr.mjs";
import { a as parseMaybeJsonp, i as n, n as createServerRpc, r as fetchText, t as asArr } from "./fetch-util--uP0UFiK.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/sector-watch-CQuX4Gc4.js
var EM_UT = "fa5fd1943c7b386f172d6893dbfba10b";
var EM_REFERER = "https://quote.eastmoney.com/";
var CACHE_TTL = 6e4;
var cache = null;
async function fetchAllBoards(type) {
	const j = await parseMaybeJsonp(await fetchText(`https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=100&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(type === "industry" ? "m:90+t:2" : "m:90+t:3")}&fields=f12,f14,f2,f3,f62,f66,f69,f72,f75,f6&ut=${EM_UT}&_=${Date.now()}`, 9e3, { Referer: EM_REFERER }));
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
var getAllSectorWatch_createServerFn_handler = createServerRpc({
	id: "f0e85605532ca97005390bad23f2c87804ccf55f16e04c0d9b02588f27af55cb",
	name: "getAllSectorWatch",
	filename: "src/lib/data/sector-watch.ts"
}, (opts) => getAllSectorWatch.__executeServer(opts));
var getAllSectorWatch = createServerFn({ method: "GET" }).handler(getAllSectorWatch_createServerFn_handler, async () => {
	if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.rows;
	try {
		const [ind, con] = await Promise.all([fetchAllBoards("industry"), fetchAllBoards("concept")]);
		const rows = [...ind, ...con].filter((x) => x.code && x.name && x.change != null).map((x) => ({
			id: x.code,
			name: x.name,
			bkCode: x.code,
			change: x.change,
			flow: x.flow,
			super: x.super,
			large: x.large,
			mid: x.mid,
			small: x.small,
			turnover: x.turnover,
			available: true,
			streak: 0
		}));
		if (rows.length) cache = {
			ts: Date.now(),
			rows
		};
		return rows;
	} catch {
		return cache?.rows || [];
	}
});
//#endregion
export { getAllSectorWatch_createServerFn_handler };
