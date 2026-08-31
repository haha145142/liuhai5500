import { createServerFn } from "@tanstack/react-start";

type DeepSeekResult =
  | { ok: true; text: string; model: string; latencyMs: number }
  | { ok: false; text: string; model: string; latencyMs: number; error: string };

async function callDeepSeek(apiKey: string, model: string, prompt: string): Promise<DeepSeekResult> {
  const key = apiKey.trim();
  const selectedModel = model.trim() || "deepseek-chat";
  if (!key) return { ok: false, text: "", model: selectedModel, latencyMs: 0, error: "未配置 DeepSeek API Key" };

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: "你是 Fund AI Pro 的连接测试助手。只需要返回一句简短中文，证明连接成功。" },
          { role: "user", content: prompt },
        ],
        max_tokens: 32,
        temperature: 0,
        stream: false,
      }),
    });

    const latencyMs = Date.now() - started;
    let body: unknown = null;
    try { body = await res.json(); } catch {}
    if (!res.ok) {
      const errorBody = body as { error?: { message?: string } } | null;
      const detail = errorBody?.error?.message ? `：${errorBody.error.message}` : "";
      return { ok: false, text: "", model: selectedModel, latencyMs, error: `HTTP ${res.status}${detail}` };
    }

    const parsed = body as { model?: string; choices?: { message?: { content?: string } }[] } | null;
    const text = parsed?.choices?.[0]?.message?.content?.trim() || "连接成功，但模型没有返回文本";
    return { ok: true, text, model: parsed?.model || selectedModel, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const message = error instanceof Error && error.name === "AbortError" ? "请求超时" : "网络请求失败";
    return { ok: false, text: "", model: selectedModel, latencyMs, error: message };
  } finally {
    clearTimeout(timer);
  }
}

export const testDeepSeek = createServerFn({ method: "POST" })
  .validator((input: { apiKey: string; model?: string }) => input)
  .handler(({ data }) => callDeepSeek(data.apiKey, data.model || "deepseek-chat", "请回复：Fund AI Pro DeepSeek 连接正常。"));

export const analyzeDeepSeek = createServerFn({ method: "POST" })
  .validator((input: { apiKey: string; model?: string; prompt: string }) => input)
  .handler(({ data }) => callDeepSeek(data.apiKey, data.model || "deepseek-chat", data.prompt));
