import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/funds")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = (url.searchParams.get("code") ?? "").trim();

        if (!/^\d{6}$/.test(code)) {
          return Response.json(
            {
              ok: false,
              error: "invalid_code",
              message: "code 必须是 6 位基金代码",
            },
            {
              status: 400,
              headers: {
                "Cache-Control": "no-store",
              },
            },
          );
        }

        try {
          const { getFund } = await import("@/lib/data/server");
          const quote = await getFund({ data: { code } });

          return Response.json(
            {
              ok: true,
              code,
              data: quote,
            },
            {
              headers: {
                "Cache-Control": "no-store",
              },
            },
          );
        } catch (error) {
          console.error("[api/funds] failed", error);
          return Response.json(
            {
              ok: false,
              code,
              error: "fund_fetch_failed",
              message: "基金数据获取失败",
            },
            {
              status: 502,
              headers: {
                "Cache-Control": "no-store",
              },
            },
          );
        }
      },
    },
  },
});
