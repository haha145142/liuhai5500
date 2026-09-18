import { defineEventHandler, getQuery } from "h3";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = String(query.code ?? "").trim();

  if (!/^\\d{6}$/.test(code)) {
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
    const { getFund } = await import("../../src/lib/data/server");
    const quote = await getFund({ data: { code } });
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
