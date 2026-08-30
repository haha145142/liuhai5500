import { n as TSS_SERVER_FUNCTION } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/fetch-util--uP0UFiK.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
async function fetchText(url, timeout = 1e4, headers = {}) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), timeout);
	try {
		try {
			const r = await fetch(url, {
				signal: ctrl.signal,
				cache: "no-store",
				headers: {
					Accept: "application/json,text/plain,*/*",
					"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
					Connection: "close",
					...headers
				}
			});
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			return await r.text();
		} catch {
			const { execFile } = await import("node:child_process");
			const args = [
				"-4",
				"--http1.1",
				"--max-time",
				String(Math.max(5, Math.ceil(timeout / 1e3))),
				"-sS",
				"-H",
				"Accept: application/json,text/plain,*/*",
				"-H",
				"User-Agent: Mozilla/5.0",
				"-H",
				"Connection: close"
			];
			for (const [k, v] of Object.entries(headers)) args.push("-H", `${k}: ${v}`);
			args.push(url);
			return await new Promise((resolve, reject) => {
				execFile("curl", args, {
					timeout: timeout + 3e3,
					maxBuffer: 4194304
				}, (error, stdout, stderr) => {
					if (error) {
						reject(/* @__PURE__ */ new Error(`curl failed: ${error.message}${stderr ? `: ${stderr.trim()}` : ""}`));
						return;
					}
					resolve(stdout);
				});
			});
		}
	} finally {
		clearTimeout(t);
	}
}
function parseMaybeJsonp(text) {
	const trimmed = text.trim();
	try {
		return JSON.parse(trimmed);
	} catch {
		const m = trimmed.match(/^[a-zA-Z_$][\w$]*\((.*)\)\s*;?\s*$/s);
		if (m) try {
			return JSON.parse(m[1]);
		} catch {
			return null;
		}
		const i = trimmed.indexOf("{");
		const j = trimmed.lastIndexOf("}");
		if (i >= 0 && j > i) try {
			return JSON.parse(trimmed.slice(i, j + 1));
		} catch {
			return null;
		}
		return null;
	}
}
function asArr(v) {
	if (Array.isArray(v)) return v;
	if (v && typeof v === "object") return Object.values(v);
	return [];
}
function n(v) {
	if (v == null || v === "" || v === "-" || v === "—") return null;
	const x = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
	return Number.isFinite(x) ? x : null;
}
//#endregion
export { parseMaybeJsonp as a, n as i, createServerRpc as n, fetchText as r, asArr as t };
