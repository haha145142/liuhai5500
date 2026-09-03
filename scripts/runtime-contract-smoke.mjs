import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "playwright";

const port = Number(process.env.SMOKE_PORT || 8091);
const base = `http://127.0.0.1:${port}`;
const routes = ["/", "/market", "/news", "/funds", "/portfolio"];
const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];
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
function isExpectedAbort(errorText = "") { return /ERR_ABORTED|NS_BINDING_ABORTED|aborted/i.test(errorText); }

async function assertHealthyPage(page, routePath) {
  await page.goto(`${base}${routePath}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(800);
  const html = await page.locator("body").innerText();
  if (!html.trim()) throw new Error(`${routePath} rendered an empty body`);
  if (hasBadNumber(html)) throw new Error(`${routePath} contains NaN/Infinity`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  if (overflow) throw new Error(`${routePath} has horizontal overflow`);
  const root = page.locator("#root");
  if (await root.count() && !(await root.innerText()).trim()) throw new Error(`${routePath} root is empty after hydration`);
}

async function stopDevServer() {
  if (!server || server.killed) return;
  const pid = server.pid;
  if (pid && process.platform !== "win32") {
    try { process.kill(-pid, "SIGTERM"); } catch {}
  } else {
    server.kill("SIGTERM");
  }
  await Promise.race([
    once(server, "exit"),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (pid && process.platform !== "win32") {
    try { process.kill(-pid, "SIGKILL"); } catch {}
  }
}

async function main() {
  server = spawn("npm", ["run", "dev", "--", "--port", String(port)], {
    stdio: "pipe",
    env: { ...process.env, PORT: String(port) },
    detached: process.platform !== "win32",
  });
  server.stdout.on("data", (b) => process.stdout.write(`[dev] ${b}`));
  server.stderr.on("data", (b) => process.stderr.write(`[dev-err] ${b}`));
  await waitForServer(`${base}/`);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, locale: "zh-CN", timezoneId: "Asia/Shanghai" });
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const requestFailures = [];
      const badHttp = [];
      page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("requestfailed", (request) => {
        const errorText = request.failure()?.errorText || "failed";
        if (!isExpectedAbort(errorText)) requestFailures.push(`${request.method()} ${request.url()} :: ${errorText}`);
      });
      page.on("response", (response) => { if (response.status() >= 500) badHttp.push(`${response.status()} ${response.url()}`); });

      for (const routePath of routes) await assertHealthyPage(page, routePath);

      await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      const newsSection = page.locator('[aria-label="最新资讯"]');
      if (await newsSection.count() !== 1) throw new Error("homepage latest-news section is missing");
      if (!(await page.locator('section[aria-label="最新资讯"]').innerText()).trim()) throw new Error("homepage latest-news section is empty DOM");

      await page.route(/eastmoney\.com/i, async (route) => {
        await route.fulfill({ status: 503, contentType: "text/plain", body: "simulated provider outage" });
      });
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(900);
      const degraded = await page.locator("body").innerText();
      if (hasBadNumber(degraded)) throw new Error("provider failure caused NaN/Infinity");
      if (/数据异常|undefined/.test(degraded)) throw new Error("provider failure leaked undefined/error text into UI");

      const summary = { viewport, routes: routes.length, consoleErrors, pageErrors, requestFailures, badHttp, faultInjection: "eastmoney=503", newsSection: true };
      console.log(JSON.stringify(summary, null, 2));
      if (consoleErrors.length || pageErrors.length || requestFailures.length || badHttp.length) process.exitCode = 1;
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

try {
  await main();
} finally {
  await stopDevServer();
}
