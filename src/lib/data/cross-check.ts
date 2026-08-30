import { createServerFn } from "@tanstack/react-start";
import { fetchText, n } from "./fetch-util";
import type { IndexQuote } from "../types";

type TencentQuote = { code: string; price: number | null; pct: number | null; change: number | null };

function parseTencent(text: string): TencentQuote[] {
  const lines = text.split(";");
  return lines.flatMap((line) => {
    const match = line.match(/v_([^=]+)="([^"]*)"/);
    if (!match) return [];
    const p = match[2].split("~");
    const code = match[1].replace(/^sh|^sz/, "");
    return [{
      code,
      price: n(p[3]),
      change: n(p[31]),
      pct: n(p[32]),
    }];
  });
}

export const crossCheckIndices = createServerFn({ method: "POST" })
  .validator((input: { indices: IndexQuote[] }) => input)
  .handler(async ({ data }): Promise<{ validated: IndexQuote[]; checked: boolean; note: string }> => {
    try {
      const tencentCodes = ["sh000001", "sz399001", "sz399006", "sh000688"];
      const text = await fetchText(`https://qt.gtimg.cn/q=${tencentCodes.join(",")}`, 7000);
      const secondary = parseTencent(text);
      if (secondary.length < 3) return { validated: data.indices, checked: false, note: "第二行情源返回不足，保留主源数据" };

      let compared = 0;
      const validated = data.indices.map((primary) => {
        const backup = secondary.find((x) => x.code === primary.code);
        if (!backup || primary.pct == null || backup.pct == null) return primary;
        compared += 1;
        const pctGap = Math.abs(primary.pct - backup.pct);
        const priceGap = primary.price != null && backup.price != null && primary.price !== 0
          ? Math.abs(primary.price - backup.price) / Math.abs(primary.price)
          : 0;
        // Small provider rounding differences are normal. Larger gaps are treated
        // as unverified instead of silently inventing a value.
        if (pctGap <= 0.08 && priceGap <= 0.003) return primary;
        return { ...primary, price: null, pct: null, change: null };
      });

      return {
        validated,
        checked: compared >= 3,
        note: compared >= 3 ? `东方财富 + 腾讯财经交叉核验 ${compared} 项` : "第二行情源无法完成足够交叉核验",
      };
    } catch {
      return { validated: data.indices, checked: false, note: "第二行情源暂不可用，保留主源数据" };
    }
  });
