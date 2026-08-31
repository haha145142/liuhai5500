import { createServerFn } from "@tanstack/react-start";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";
import type { FundQuote } from "../types";

type Validation = {
  quote: FundQuote;
  checked: boolean;
  confidence: "high" | "medium" | "low";
  note: string;
};

export const validateFundQuote = createServerFn({ method: "POST" })
  .validator((input: { quote: FundQuote }) => input)
  .handler(async ({ data }): Promise<Validation> => {
    const q = data.quote;
    if (!/^\d{6}$/.test(q.code)) return { quote: q, checked: false, confidence: "low", note: "基金代码无效" };

    try {
      const raw = await fetchText(
        `https://fundgz.1234567.com.cn/js/${q.code}.js?rt=${Date.now()}`,
        7000,
        { Referer: "https://fund.eastmoney.com/" },
      );
      const gz = parseMaybeJsonp(raw) as Record<string, unknown> | null;
      const backupNav = gz ? n(gz.dwjz) : null;
      const backupPct = gz ? n(gz.gszzl) : null;
      const backupDate = gz ? String(gz.jzrq || "") : "";

      if (backupNav == null || q.nav == null) {
        return {
          quote: { ...q, estimateConfidence: q.estimate != null ? "medium" : "low" },
          checked: false,
          confidence: q.estimate != null ? "medium" : "low",
          note: "第二基金数据源暂无可用于核验的净值",
        };
      }

      const navGap = Math.abs(q.nav - backupNav) / Math.max(Math.abs(q.nav), 1e-9);
      const dateSame = !q.navDate || !backupDate || q.navDate === backupDate;
      const consistent = navGap <= 0.001 && dateSame;

      if (!consistent) {
        return {
          quote: {
            ...q,
            estimate: null,
            estimatePct: null,
            estimateTime: null,
            estimateConfidence: "low",
            valuationStatus: q.nav != null ? "stale" : "unavailable",
            source: `${q.source} · 双源核验未通过`,
          },
          checked: true,
          confidence: "low",
          note: `基金净值双源差异 ${(navGap * 100).toFixed(3)}%，${dateSame ? "日期一致" : "净值日期不一致"}，不采用可疑估值`,
        };
      }

      const estimateGap = q.estimate != null && q.nav !== 0 ? Math.abs(q.estimate - q.nav) / Math.abs(q.nav) : 0;
      const confidence = estimateGap <= 0.015 ? "high" : estimateGap <= 0.03 ? "medium" : "low";
      return {
        quote: {
          ...q,
          // Publication truth must come from the upstream official-NAV check.
          // The backup estimate endpoint's jzrq is used only for cross-checking.
          officialNavPublished: q.officialNavPublished,
          estimateConfidence: q.estimate != null ? confidence : "medium",
          valuationStatus: q.valuationStatus ?? (q.estimate != null ? "estimate" : "waiting_official_nav"),
          source: `${q.source} · 净值双源一致`,
        },
        checked: true,
        confidence,
        note: backupPct != null ? `东方财富净值 + 天天基金净值一致；估值偏离 ${(estimateGap * 100).toFixed(2)}%` : "东方财富净值 + 天天基金净值一致",
      };
    } catch {
      return {
        quote: { ...q, estimateConfidence: q.estimate != null ? "medium" : "low" },
        checked: false,
        confidence: q.estimate != null ? "medium" : "low",
        note: "第二基金数据源暂不可用，保留已获取数据",
      };
    }
  });
