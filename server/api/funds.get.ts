import { defineEventHandler, getQuery } from "h3";
import { getDirectFundFallbackDirect } from "../../src/lib/data/fund-direct-fallback";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = String(query.code ?? "").trim();

  if (!/^\d{6}$/.test(code)) {
    return new Response(JSON.stringify({
      ok: false,
      error: "invalid_code",
      message: "code 必须是 6 位基金代码",
    }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  try {
    const quote = await getDirectFundFallbackDirect(code);
    if (!quote) {
      return new Response(JSON.stringify({
        ok: false,
        code,
        error: "fund_fetch_failed",
        message: "基金数据获取失败",
      }), {
        status: 502,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
    return Response.json({ ok: true, code, data: quote });
  } catch (error) {
    console.error("[api/funds] failed", error);
    return new Response(JSON.stringify({
      ok: false,
      code,
      error: "fund_fetch_failed",
      message: "基金数据获取失败",
    }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
});
