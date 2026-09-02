import { spawn } from "node:child_process";
import { chromium } from "playwright";

const port = 8080;
const baseURL = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "dev"], { stdio: "inherit", env: { ...process.env, PORT: String(port) } });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitForServer() { const deadline = Date.now() + 30_000; while (Date.now() < deadline) { try { const response = await fetch(baseURL); if (response.ok) return; } catch {} await sleep(500); } throw new Error("dev server did not become ready"); }
async function waitForText(page, text, label, timeout = 15_000) { await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout }).catch(() => { throw new Error(`${label}: expected text not rendered: ${text}`); }); }
async function waitForHydration(page, label) { await page.locator('body[data-fap-hydrated="true"]').waitFor({ state: "attached", timeout: 15_000 }).catch(() => { throw new Error(`${label}: hydration marker not observed`); }); }
async function assertNoHorizontalOverflow(page, label) { const size = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth })); if (size.scrollWidth > size.width + 1) throw new Error(`${label}: horizontal overflow ${size.scrollWidth} > ${size.width}`); }

async function testNews(page, label) {
  await page.goto(`${baseURL}/news`, { waitUntil: "domcontentloaded" });
  await waitForText(page, "市场资讯", `${label} news`);
  await waitForText(page, "AI解读", `${label} news AI`, 15_000);
  await page.waitForFunction(() => { const body = document.body.innerText; return document.querySelectorAll(".news-page article").length > 0 || body.includes("暂无可靠资讯") || body.includes("正在抓取资讯"); }, { timeout: 15_000 });
  const body = await page.locator("body").innerText();
  if (body.includes("查看原文")) throw new Error(`${label}: news still shows original-article action`);
  if (body.includes("华尔街见闻")) throw new Error(`${label}: removed source still rendered`);
  const count = await page.locator(".news-page article").count();
  if (count > 5) throw new Error(`${label}: ${count} news cards rendered before expand; expected <=5`);
  if (count > 0 && await page.getByRole("button", { name: /展开更多资讯/ }).count()) await waitForText(page, "展开更多资讯", `${label} news expand control`, 5_000);
  await assertNoHorizontalOverflow(page, `${label} news`);
}

async function testSectorFundPool(page, label) {
  await page.goto(`${baseURL}/`, { waitUntil: "domcontentloaded" });
  await waitForText(page, "总收益", `${label} home before sector`);
  await waitForHydration(page, `${label} home before sector`);
  const addSectorButton = page.getByRole("button", { name: "添加板块" });
  await addSectorButton.scrollIntoViewIfNeeded();
  await addSectorButton.waitFor({ state: "visible", timeout: 15_000 });
  await addSectorButton.click();
  const input = page.locator('input[aria-label="板块搜索"]');
  await input.fill("半导体");
  await waitForText(page, "半导体", `${label} sector suggestion`);
  await page.getByRole("button", { name: /半导体/ }).first().click();
  await waitForText(page, "相关基金", `${label} sector pool`, 15_000);
  for (const text of ["今日", "近一月", "回撤", "全部", "主动基金", "ETF"]) await waitForText(page, text, `${label} sector control`);
  const candidate = page.getByRole("button", { name: "加入候选" }).first();
  await candidate.waitFor({ state: "visible", timeout: 15_000 });
  await candidate.click();
  await waitForText(page, "已加入候选", `${label} candidate`, 8_000);
  await page.getByRole("button", { name: "回撤" }).first().click();
  await waitForText(page, "近1年最大回撤", `${label} drawdown`, 15_000);
  await assertNoHorizontalOverflow(page, `${label} sector pool`);
}

async function testFundPk(page, label) {
  await page.goto(`${baseURL}/funds`, { waitUntil: "domcontentloaded" });
  await waitForText(page, "基金排行", `${label} fund ranking`);
  await waitForHydration(page, `${label} fund ranking`);
  await page.waitForFunction(() => document.querySelectorAll('button[aria-label^="比较"]').length >= 4, { timeout: 15_000 });
  const buttons = page.locator('button[aria-label^="比较"]');
  for (let i = 0; i < 4; i += 1) await buttons.nth(i).click();
  await waitForText(page, "四基金 PK", `${label} PK`);
  await waitForText(page, "最多 4 只", `${label} PK count`);
  await waitForText(page, "最大回撤", `${label} PK drawdown`);
  await waitForText(page, "夏普", `${label} PK sharpe`);
  await waitForText(page, "趋势", `${label} PK trend`);
  await waitForText(page, "波段", `${label} PK band`);
  if (!(await page.locator("body").innerText()).includes("已选 4/4")) throw new Error(`${label}: PK did not reach 4/4`);
  await assertNoHorizontalOverflow(page, `${label} PK`);
}

async function testIndexValuation(page, label) {
  await page.goto(`${baseURL}/market`, { waitUntil: "domcontentloaded" });
  await waitForText(page, "指数估值红绿灯", `${label} index valuation`);
  for (const text of ["PE", "PB", "ROE", "PE分位", "PB分位", "综合估值百分位"]) await waitForText(page, text, `${label} valuation ${text}`);
  await assertNoHorizontalOverflow(page, `${label} index valuation`);
}

async function testSmartAlerts(page, label) {
  await page.goto(`${baseURL}/settings`, { waitUntil: "domcontentloaded" });
  await waitForText(page, "智能提醒", `${label} smart alerts`);
  await waitForHydration(page, `${label} smart alerts`);
  const selects = page.locator("select");
  await selects.first().waitFor({ state: "visible", timeout: 8_000 });
  if (await selects.first().locator("option").count() < 2) throw new Error(`${label}: no smart-alert portfolio options`);
  await selects.first().selectOption({ index: 1 });
  await page.locator('input[placeholder="阈值 %"]').fill("3");
  await page.getByRole("button", { name: "添加提醒规则" }).click();
  await waitForText(page, "停用", `${label} alert saved`, 8_000);
  await assertNoHorizontalOverflow(page, `${label} smart alerts`);
}

async function testRotationRadar(page, label) {
  await page.goto(`${baseURL}/rotation`, { waitUntil: "domcontentloaded" });
  await waitForText(page, "AI 轮动雷达", `${label} rotation`);
  await waitForText(page, "数据推断", `${label} rotation evidence`);
  await waitForText(page, "板块强度", `${label} rotation score`);
  await assertNoHorizontalOverflow(page, `${label} rotation`);
}

async function testPortfolioAndBand(page, label) {
  await page.goto(`${baseURL}/portfolio`, { waitUntil: "domcontentloaded" });
  await waitForText(page, "我的持仓", `${label} portfolio`);
  await waitForHydration(page, `${label} portfolio`);
  await waitForText(page, "000020", `${label} 20-holding render`, 15_000);
  await waitForText(page, "组合体检", `${label} portfolio insight`);
  await waitForText(page, "持仓重复度分析", `${label} overlap`);
  const body = await page.locator("body").innerText();
  if (!body.includes("20只")) throw new Error(`${label}: 20-holding summary missing`);
  await assertNoHorizontalOverflow(page, `${label} portfolio`);
  await page.goto(`${baseURL}/band`, { waitUntil: "domcontentloaded" });
  await waitForText(page, "波段信号", `${label} band`);
  await waitForText(page, "趋势强弱", `${label} band trend`);
  await waitForText(page, "卖出提示 · 做T/波段", `${label} band plan`);
  await assertNoHorizontalOverflow(page, `${label} band`);
}

async function seedHoldings(page) {
  await page.addInitScript(() => {
    const holdings = Array.from({ length: 20 }, (_, i) => ({ code: String(i + 1).padStart(6, "0"), name: `测试基金${i + 1}`, shares: 100, cost: 1 }));
    localStorage.setItem("fund_ai_pro_portfolio_v3", JSON.stringify(holdings));
    localStorage.removeItem("fund_ai_pro_board_watch_v7");
    localStorage.removeItem("fund_ai_pro_board_watch_v8");
    localStorage.removeItem("fund_ai_pro_fund_candidates_v1");
    localStorage.removeItem("fund_ai_pro_alert_rules_v1");
    localStorage.removeItem("fund_ai_pro_alert_events_v1");
  });
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  for (const viewport of [{ width: 390, height: 844, label: "390x844" }, { width: 430, height: 932, label: "430x932" }]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await seedHoldings(page);
    try {
      await page.goto(`${baseURL}/`, { waitUntil: "domcontentloaded" });
      await waitForText(page, "总收益", `${viewport.label} homepage`);
      await waitForHydration(page, `${viewport.label} homepage`);
      await waitForText(page, "今日评估", `${viewport.label} daily assessment`);
      await waitForText(page, "今日市场评分", `${viewport.label} daily score`);
      await waitForText(page, "我的持仓", `${viewport.label} portfolio section`);
      await assertNoHorizontalOverflow(page, `${viewport.label} homepage`);
      await testNews(page, viewport.label);
      await testSectorFundPool(page, viewport.label);
      await testFundPk(page, viewport.label);
      await testIndexValuation(page, viewport.label);
      await testSmartAlerts(page, viewport.label);
      await testRotationRadar(page, viewport.label);
      await testPortfolioAndBand(page, viewport.label);
    } finally { await page.close(); }
  }
  await browser.close();
  console.log("UI smoke checks passed");
} finally { server.kill("SIGTERM"); }
