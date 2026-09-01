import { spawn } from "node:child_process";
import { chromium } from "playwright";

const port = 8080;
const baseURL = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "dev"], { stdio: "inherit", env: { ...process.env, PORT: String(port) } });

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseURL);
      if (response.ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error("dev server did not become ready");
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (overflow.scrollWidth > overflow.width + 1) {
    throw new Error(`${label}: horizontal overflow ${overflow.scrollWidth} > ${overflow.width}`);
  }
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });

  for (const viewport of [
    { width: 390, height: 844, label: "390x844" },
    { width: 430, height: 932, label: "430x932" },
  ]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });

    await page.addInitScript(() => {
      const holdings = Array.from({ length: 20 }, (_, i) => ({
        code: String(i + 1).padStart(6, "0"),
        name: `测试基金${i + 1}`,
        shares: 100,
        cost: 1,
      }));
      localStorage.setItem("fund_ai_pro_portfolio_v3", JSON.stringify(holdings));
      localStorage.setItem("fund_ai_pro_board_watch_v7", JSON.stringify({ items: [] }));
    });

    await page.goto(`${baseURL}/`, { waitUntil: "domcontentloaded" });
    await page.getByText("我的组合", { exact: true }).first().waitFor({ state: "visible", timeout: 15_000 });
    if ((await page.locator("body").innerText()).trim().length < 80) throw new Error(`${viewport.label}: homepage rendered blank/minimal content`);
    await assertNoHorizontalOverflow(page, `${viewport.label} homepage`);

    await page.goto(`${baseURL}/portfolio`, { waitUntil: "domcontentloaded" });
    await page.getByText("我的持仓", { exact: false }).first().waitFor({ state: "visible", timeout: 15_000 });
    if (!(await page.locator("body").innerText()).includes("20只")) throw new Error(`${viewport.label}: 20-holding portfolio summary missing`);
    for (const code of ["000001", "000010", "000020"]) {
      if (!(await page.locator("body").innerText()).includes(code)) throw new Error(`${viewport.label}: expected holding ${code} not rendered`);
    }
    await assertNoHorizontalOverflow(page, `${viewport.label} portfolio`);

    await page.locator('input[aria-label="基金代码"]').fill("123456");
    await page.locator('input[aria-label="持有份额"]').fill("100");
    await page.locator('input[aria-label="成本价"]').fill("1.23");
    await page.getByRole("button", { name: /添加$/ }).click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("fund_ai_pro_portfolio_v3") || "[]"));
    if (!Array.isArray(stored) || !stored.some((x) => x.code === "123456" && x.shares === 100 && x.cost === 1.23)) {
      throw new Error(`${viewport.label}: add-fund interaction did not persist holding`);
    }

    await page.goto(`${baseURL}/`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "添加板块" }).click();
    const sectorInput = page.locator('input[placeholder*="半导体"]');
    await sectorInput.waitFor({ state: "visible", timeout: 5_000 });
    await sectorInput.fill("半导体");
    await assertNoHorizontalOverflow(page, `${viewport.label} sector search`);

    await page.close();
  }

  await browser.close();
  console.log("UI smoke checks passed");
} finally {
  server.kill("SIGTERM");
}
