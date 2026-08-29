import { createServerFn } from "@tanstack/react-start";
import { asArr, fetchText, n, parseMaybeJsonp } from "./fetch-util";
import type { SectorQuote } from "../types";

const EM_UT = "fa5fd1943c7b386f172d6893dbfba10b";
const EM_REFERER = "https://quote.eastmoney.com/";

async function fetchAllBoards(type: "industry" | "concept") {
  const fs = type === "industry" ? "m:90+t:2" : "m:90+t:3";
  const j = (await parseMaybeJsonp(await fetchText(`https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=100&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(fs)}&fields=f12,f14,f2,f3,f62,f66,f69,f72,f75,f6&ut=${EM_UT}&_=${Date.now()}`, 12000, { Referer: EM_REFERER }))) as { data?: { diff?: unknown } };
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
    turnover: n(x.f6),
  }));
}

export const getAllSectorWatch = createServerFn({ method: "GET" }).handler(async (): Promise<SectorQuote[]> => {
  try {
    const [ind, con] = await Promise.all([fetchAllBoards("industry"), fetchAllBoards("concept")]);
    return [...ind, ...con]
      .filter((x) => x.code && x.name && x.change != null)
      .map((x) => ({
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
        streak: 0,
      }));
  } catch {
    return [];
  }
});
