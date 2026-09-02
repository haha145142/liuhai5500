import { spawn } from "node:child_process";
import { chromium } from "playwright";

const port = 8080;
const baseURL = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "dev"], { stdio: "inherit", env: { ...process.env, PORT: String(port) } });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitForServer() { const deadline = Date.now() + 30_000; while (Date.now() < deadline) { try { const response = await fetch(baseURL); if (response.ok) return; } catch {} await sleep(500); } throw new Error("dev server did not become ready"); }
async function waitForText(page, text, label, timeout = 15_000) { await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout }).catch(() => { throw new Error(`${label}: expected text not rendered: ${text}`); }); }
async function waitForHydration(page, label) { await page.locator('body[data-fap-hydrated="true"]').waitFor({ state: "attached", timeout: 15_000 }).catch(() => { throw new Error(`${label}: client hydration marker not observed`); }); }
async function assertNoHorizontalOverflow(page, label) { const size = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth })); if (size.scrollWidth > size.width + 1) throw new Error(`${label}: horizontal overflow ${size.scrollWidth} > ${size.width}`); }
async function waitForHolding(page, label, timeout = 10_000) { await page.waitForFunction(() => { try { const stored = JSON.parse(localStorage.getItem("fund_ai_pro_portfolio_v3") || "[]"); return Array.isArray(stored) && stored.some((item) => item.code === "123456" && item.shares === 100 && item.cost === 1.23); } catch { return false; } }, { timeout }).catch(() => { throw new Error(`${label}: added holding was not persisted`); }); }
async function testSectorFundPool(page, label) {
  const addSectorButton = page.getByRole("button", { name: "添加板块" }); await addSectorButton.waitFor({ state: "visible", timeout: 15_000 }); await addSectorButton.scrollIntoViewIfNeeded(); await addSectorButton.click();
  const sectorInput = page.locator('input[aria-label="板块搜索"]'); await sectorInput.waitFor({ state: "visible", timeout: 8_000 }); await sectorInput.fill("半导体"); await waitForText(page, "半导体", `${label} sector suggestion`); await page.getByRole("button", { name: /半导体/ }).first().click(); await waitForText(page, "相关基金", `${label} sector fund pool`, 15_000);
  for (const control of ["今日", "近一月", "回撤", "全部", "主动基金", "ETF"]) await waitForText(page, control, `${label} sector pool control`);
  const candidateButton = page.getByRole("button", { name: "加入候选" }).first(); await candidateButton.waitFor({ state: "visible", timeout: 15_000 }); await candidateButton.click(); await waitForText(page, "已加入候选", `${label} candidate action`, 8_000);
  const candidateState = await page.evaluate(() => { try { const rows = JSON.parse(localStorage.getItem("fund_ai_pro_fund_candidates_v1") || "[]"); return Array.isArray(rows) && rows.some((item) => item && item.code); } catch { return false; } }); if (!candidateState) throw new Error(`${label}: candidate action was not persisted`);
  const drawdownButton = page.getByRole("button", { name: "回撤" }).first(); await drawdownButton.click(); await waitForText(page, "近1年最大回撤", `${label} drawdown metric`, 15_000); const drawdownState = await page.locator("body").innerText(); if (drawdownState.includes("当前基金池数据源暂未提供可靠最大回撤字段")) throw new Error(`${label}: drawdown control is still using the placeholder implementation`); await assertNoHorizontalOverflow(page, `${label} sector fund pool`);
}
async function testFundPk(page, label) {
  await page.addInitScript(() => {
    const rows = [
      { code: "000001", name: "测试基金A", nav: 1.01, day: 1.2, week: 3.1, month: 5.2, sixMonth: 12.1, oneYear: 20.5, ytd: 15.0 },
      { code: "000002", name: "测试基金B", nav: 1.02, day: 1.0, week: 2.4, month: 4.8, sixMonth: 11.5, oneYear: 18.9, ytd: 13.4 },
      { code: "000003", name: "测试基金C", nav: 1.03, day: 0.8, week: 1.9, month: 4.1, sixMonth: 10.8, oneYear: 17.2, ytd: 12.0 },
      { code: "000004", name: "测试基金D", nav: 1.04, day: 0.6, week: 1.2, month: 3.7, sixMonth: 9.6, oneYear: 15.7, ytd: 10.5 },
    ];
    localStorage.setItem("fund_ai_pro_rank_cache_v2_r", JSON.stringify({ savedAt: Date.now(), rows, source: "UI smoke seed" }));
  });
  await page.goto(`${baseURL}/funds`, { waitUntil: "domcontentloaded" }); await waitForText(page, "基金排行", `${label} fund ranking`, 15_000); await waitForHydration(page, `${label} fund ranking`); await page.waitForFunction(() => document.querySelectorAll('button[aria-label^="比较"]').length >= 4, { timeout: 15_000 }); const pkButtons = page.locator('button[aria-label^="比较"]'); for (let i = 0; i < 4; i += 1) await pkButtons.nth(i).click(); await waitForText(page, "四基金 PK", `${label} four fund PK`, 15_000); await waitForText(page, "最多 4 只", `${label} PK max count`); await waitForText(page, "最大回撤", `${label} PK drawdown`); await waitForText(page, "夏普", `${label} PK sharpe`); await waitForText(page, "趋势", `${label} PK trend`); await waitForText(page, "波段", `${label} PK band`); const selectedText = await page.locator("body").innerText(); if (!selectedText.includes("已选 4/4")) throw new Error(`${label}: four-fund selection did not reach 4/4`); await assertNoHorizontalOverflow(page, `${label} four fund PK`);
}
async function testIndexValuation(page, label) {
  await page.goto(`${baseURL}/market`, { waitUntil: "domcontentloaded" }); await waitForText(page, "指数估值红绿灯", `${label} index valuation`); await waitForText(page, "PE", `${label} PE metric`); await waitForText(page, "PB", `${label} PB metric`); await waitForText(page, "ROE", `${label} ROE metric`); await waitForText(page, "PE分位", `${label} PE percentile metric`); await waitForText(page, "PB分位", `${label} PB percentile metric`); await waitForText(page, "综合估值百分位", `${label} composite percentile label`); await assertNoHorizontalOverflow(page, `${label} index valuation`);
}
async function testSmartAlerts(page, label) {
  await page.goto(`${baseURL}/settings`, { waitUntil: "domcontentloaded" }); await waitForText(page, "智能提醒", `${label} smart alerts`); await waitForHydration(page, `${label} smart alerts`);
  const selects = page.locator("select"); await selects.first().waitFor({ state: "visible", timeout: 8_000 }); const optionCount = await selects.first().locator("option").count(); if (optionCount < 2) throw new Error(`${label}: smart alert fund selector has no portfolio options`);
  await selects.first().selectOption({ index: 1 }); const threshold = page.locator('input[placeholder="阈值 %"]'); await threshold.fill("3");
  await page.getByRole("button", { name: "添加提醒规则" }).click(); await waitForText(page, "停用", `${label} alert rule saved`, 8_000);
  const stored = await page.evaluate(() => { try { const rows = JSON.parse(localStorage.getItem("fund_ai_pro_alert_rules_v1") || "[]"); return Array.isArray(rows) && rows.length > 0; } catch { return false; } }); if (!stored) throw new Error(`${label}: smart alert rule was not persisted`);
  await page.getByRole("button", { name: /开启系统提醒|系统提醒已开启|系统提醒已拒绝|当前浏览器不支持/ }).waitFor({ state: "visible", timeout: 8_000 });
  await assertNoHorizontalOverflow(page, `${label} smart alerts`);
}
async function testRotationRadar(page, label) {
  await page.goto(`${baseURL}/rotation`, { waitUntil: "domcontentloaded" }); await waitForText(page, "AI 轮动雷达", `${label} rotation radar`, 15_000); await waitForText(page, "数据推断", `${label} rotation evidence boundary`); await waitForText(page, "板块强度", `${label} rotation score`);
  const candidates = page.locator('button').filter({ hasText: /事实：涨幅/ });
  if (await candidates.count()) { await candidates.first().click(); await waitForText(page, "关联基金池", `${label} rotation fund pool`, 15_000); await waitForText(page, "关联基金池", `${label} rotation linked pool heading`, 15_000); const candidateButtons = page.getByRole("button", { name: "加入候选" }); if (await candidateButtons.count()) { await candidateButtons.first().click(); await waitForText(page, "已加入候选", `${label} rotation candidate action`, 8_000); const stored = await page.evaluate(() => { try { const rows = JSON.parse(localStorage.getItem("fund_ai_pro_fund_candidates_v1") || "[]"); return Array.isArray(rows) && rows.some((item) => item && item.code); } catch { return false; } }); if (!stored) throw new Error(`${label}: rotation candidate action was not persisted`); } }
  await assertNoHorizontalOverflow(page, `${label} rotation radar`);
}
async function testQuickAdd(browser, viewport) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  try {
    await page.addInitScript(() => { if (!sessionStorage.getItem("fap_quick_add_test_initialized")) { localStorage.setItem("fund_ai_pro_portfolio_v3", "[]"); localStorage.removeItem("fund_ai_pro_board_watch_v7"); localStorage.removeItem("fund_ai_pro_board_watch_v8"); sessionStorage.setItem("fap_quick_add_test_initialized", "1"); } });
    await page.goto(`${baseURL}/portfolio`, { waitUntil: "domcontentloaded" }); await waitForText(page, "我的持仓", `${viewport.label} quick add page`); await waitForHydration(page, `${viewport.label} quick add page`);
    const form = page.locator(".quick-add-fund:visible").first(); await form.waitFor({ state: "visible", timeout: 8_000 }); const codeInput = form.locator('input[aria-label="基金代码"]'); const sharesInput = form.locator('input[aria-label="持有份额"]'); const costInput = form.locator('input[aria-label="成本价"]'); await codeInput.fill("123456"); await sharesInput.fill("100"); await costInput.fill("1.23"); if (await codeInput.inputValue() !== "123456" || await sharesInput.inputValue() !== "100" || await costInput.inputValue() !== "1.23") throw new Error(`${viewport.label} quick add: input values did not settle`); const button = form.locator(".quick-add-inputs button"); await button.waitFor({ state: "visible", timeout: 8_000 }); await button.click({ timeout: 8_000 }); await waitForText(page, "已添加", `${viewport.label} quick add confirmation`, 8_000); await waitForHolding(page, `${viewport.label} quick add`); await page.reload({ waitUntil: "domcontentloaded" }); await waitForText(page, "我的持仓", `${viewport.label} quick add reload`); await waitForHydration(page, `${viewport.label} quick add reload`); await waitForHolding(page, `${viewport.label} quick add after reload`); await waitForText(page, "123456", `${viewport.label} quick add persisted row`, 10_000); await assertNoHorizontalOverflow(page, `${viewport.label} quick add`);
  } finally { await page.close(); }
}
try {
  await waitForServer(); const browser = await chromium.launch({ headless: true });
  for (const viewport of [{ width: 390, height: 844, label: "390x844" }, { width: 430, height: 932, label: "430x932" }]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    try {
      await page.addInitScript(() => { const holdings = Array.from({ length: 20 }, (_, i) => ({ code: String(i + 1).padStart(6, "0"), name: `测试基金${i + 1}`, shares: 100, cost: 1 })); localStorage.setItem("fund_ai_pro_portfolio_v3", JSON.stringify(holdings)); localStorage.removeItem("fund_ai_pro_board_watch_v7"); localStorage.removeItem("fund_ai_pro_board_watch_v8"); localStorage.removeItem("fund_ai_pro_fund_candidates_v1"); localStorage.removeItem("fund_ai_pro_alert_rules_v1"); localStorage.removeItem("fund_ai_pro_alert_events_v1"); });
      await page.goto(`${baseURL}/`, { waitUntil: "domcontentloaded" }); await waitForText(page, "我的持仓", `${viewport.label} homepage`); await waitForHydration(page, `${viewport.label} homepage`); await waitForText(page, "今日评估", `${viewport.label} daily assessment`); await waitForText(page, "今日市场评分", `${viewport.label} daily score`); if ((await page.locator("body").innerText()).trim().length < 80) throw new Error(`${viewport.label}: homepage rendered blank/minimal content`); await assertNoHorizontalOverflow(page, `${viewport.label} homepage`);
      await testSectorFundPool(page, viewport.label); await testFundPk(page, viewport.label); await testIndexValuation(page, viewport.label); await testSmartAlerts(page, viewport.label); await testRotationRadar(page, viewport.label);
      await page.goto(`${baseURL}/portfolio`, { waitUntil: "domcontentloaded" }); await waitForText(page, "我的持仓", `${viewport.label} portfolio`); await waitForHydration(page, `${viewport.label} portfolio`); await waitForText(page, "000020", `${viewport.label} 20-holding render`, 15_000); await waitForText(page, "组合体检", `${viewport.label} portfolio insight`); await waitForText(page, "持仓重复度分析", `${viewport.label} overlap`); const bodyText = await page.locator("body").innerText(); if (!bodyText.includes("20只")) throw new Error(`${viewport.label}: 20-holding portfolio summary missing after holdings rendered`); for (const code of ["000001", "000010", "000020"]) if (!bodyText.includes(code)) throw new Error(`${viewport.label}: expected holding ${code} not rendered`); await assertNoHorizontalOverflow(page, `${viewport.label} portfolio`);
      await page.goto(`${baseURL}/band`, { waitUntil: "domcontentloaded" }); await waitForText(page, "波段信号", `${viewport.label} band signal`); await waitForText(page, "趋势强弱", `${viewport.label} trend strength`); await waitForText(page, "卖出提示 · 做T/波段", `${viewport.label} swing trade plan`); await assertNoHorizontalOverflow(page, `${viewport.label} band`);
      await page.goto(`${baseURL}/market`, { waitUntil: "domcontentloaded" }); await waitForText(page, "操作建议", `${viewport.label} operation advice`); await waitForText(page, "外围市场", `${viewport.label} market data`); await assertNoHorizontalOverflow(page, `${viewport.label} market`);
    } finally { await page.close(); }
    await testQuickAdd(browser, viewport);
  }
  await browser.close(); console.log("UI smoke checks passed");
} finally { server.kill("SIGTERM"); }