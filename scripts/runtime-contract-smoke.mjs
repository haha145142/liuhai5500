import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "playwright";

const port = Number(process.env.SMOKE_PORT || 8091);
const base = `http://127.0.0.1:${port}`;
const routes = ["/", "/market", "/news", "/funds", "/portfolio"];
let server;

async function waitForServer(url, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`dev server did not start: ${url}`);
}

function hasBadNumber(text) { return /(?:NaN|Infinity|-Infinity)/.test(text); }

async function main() {
  server = spawn("npm", ["run", "dev", "--", "--port", String(port)], { stdio: "pipe", env: { ...process.env, PORT: String(port) } });
  server.stdout.on("data", (b) => process.stdout.write(`[dev] ${b}`));
  server.stderr.on("data", (b) => process.stderr.write(`[dev-err] ${b}`));
  await waitForServer(`${base}/`);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "zh-CN", timezoneId: "Asia/Shanghai" });
    const consoleErrors = [];
    const requestFailures = [];
    const badHttp = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("requestfailed", (request) => requestFailures.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "failed"}`));
    page.on("response", (response) => { if (response.status() >= 500) badHttp.push(`${response.status()} ${response.url()}`); });

    for (const routePath of routes) {
      await page.goto(`${base}${routePath}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(500);
      const html = await page.locator("body").innerText();
      if (hasBadNumber(html)) throw new Error(`${routePath} contains NaN/Infinity`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
      if (overflow) throw new Error(`${routePath} has horizontal overflow`);
    }

    await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const newsSection = page.locator('[aria-label="最新资讯"]');
    if (await newsSection.count() !== 1) throw new Error("homepage latest-news section is missing");

    await page.route(/eastmoney\.com/i, async (route) => {
      await route.fulfill({ status: 503, contentType: "text/plain", body: "simulated provider outage" });
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    const degraded = await page.locator("body").innerText();
    if (hasBadNumber(degraded)) throw new Error("provider failure caused NaN/Infinity");

    const summary = { routes: routes.length, consoleErrors, requestFailures: requestFailures.slice(0, 20), badHttp, faultInjection: "eastmoney=503", newsSection: true };
    console.log(JSON.stringify(summary, null, 2));
    if (consoleErrors.length || badHttp.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

try {
  await main();
} finally {
  if (server) {
    server.kill("SIGTERM");
    await Promise.race([once(server, "exit"), new Promise((resolve) => setTimeout(resolve, 2_000))]);
  }
}
