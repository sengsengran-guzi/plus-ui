import { expect, test, type Page } from '@playwright/test';

/**
 * 看板「今日可售」抽屉（ADR-0024 §3 / 甲方 2026-09-26 红框位 + Kevin 2026-09-26 返工）。
 *
 * 守四件甲方/店员能直接看见的事：
 *   1. 入口落在「过期待处理 / 刷新」那一行的右侧（靠 scoped `:deep()` 把 `#title` slot 撑成 flex，纯 CSS 实现，最易被后续改动碰坏）
 *   2. 点击后开的是**抽屉**且真的渲染出桌型行 + 逐时段余量行（接口不通 / 权限缺失时这里会红，而不是静默空抽屉）
 *   3. **不再有「今天不上小程序」**（甲方明确不要整档关停；要关满把该格 stepper 调到上限即可）
 *   4. 逐时段表四列齐（时段 / 已订 / 剩余 / 今日关闭）—— 这是「目前不同时段还剩多少」的落地形态
 *   5. **两种口径不许再混着读**（甲方 2026-09-29：「关闭了桌子，空闲座位还显示 1」）：
 *      「今天还能卖」= 档位口径（随关闭变化，= 各格剩余最小值，与展开的逐时段表对得上）；
 *      「今天没被预订的座位」= 座位口径（不受关闭影响）。两列都必须挂列头说明，且旧名「空闲座位」不得再出现。
 *
 * **只读**：不写库、不改配额 —— 断言完即止。改售卖量的真实链路由后端单测 + 人工真机验收覆盖。
 */

const BACKEND = process.env.ADMIN_BACKEND || 'http://localhost:8080';
const CLIENT_ID = process.env.ADMIN_CLIENT_ID || 'e5cd7e4891bf95d1d19206ce24a7b32e';
const BOARD = '/gz-bean/board';

async function loginAdminToken(): Promise<string> {
  // 本机代理会吞 127.0.0.1：先清代理 env（同 board-fixtures 的做法）
  for (const k of ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy']) delete process.env[k];
  process.env.NO_PROXY = '*';
  process.env.no_proxy = '*';
  const res = await fetch(`${BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', clientid: CLIENT_ID },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      grantType: 'password',
      tenantId: process.env.ADMIN_TENANT || '1001',
      username: process.env.ADMIN_USER || 'admin',
      password: process.env.ADMIN_PASS || 'admin123'
    })
  });
  const json = (await res.json()) as { data?: { access_token?: string } };
  const token = json?.data?.access_token;
  if (!token) throw new Error(`admin 登录失败: ${JSON.stringify(json).slice(0, 300)}`);
  return token;
}

async function gotoBoard(page: Page, token: string) {
  await page.goto('/index', { waitUntil: 'domcontentloaded' });
  await page.evaluate((tk) => localStorage.setItem('Admin-Token', tk), token);
  await page.goto('/index', { waitUntil: 'domcontentloaded' });
  await page.goto(BOARD, { waitUntil: 'domcontentloaded' });
  // 看板首屏要拉门店 + 座位 + 单，给足渲染时间
  await page.waitForTimeout(2500);
}

test.describe('看板「今日可售」抽屉', () => {
  test('入口在同一行右侧，点击开抽屉并渲染逐时段余量', async ({ page }) => {
    const token = await loginAdminToken();
    await gotoBoard(page, token);

    const entry = page.getByTestId('sellable-entry');
    await expect(entry).toBeVisible({ timeout: 15000 });

    // ① 位置与形态（甲方 2026-09-26：和统计条那五个格子同一行、同一视觉规格；
    //    曾经做过独占整行的大按钮，被批「太夸张了」—— 所以同时守「同行对齐」与「不许占整行」）
    await expect(entry).toContainText('今日小程序剩余座位');
    const entryBox = await entry.boundingBox();
    const metricBox = await page.locator('.board-metric').first().boundingBox();
    expect(entryBox, '入口应有布局盒').not.toBeNull();
    expect(metricBox, '统计格应有布局盒').not.toBeNull();
    if (entryBox && metricBox) {
      const sameRow = Math.abs(entryBox.y + entryBox.height / 2 - (metricBox.y + metricBox.height / 2)) < 12;
      expect(sameRow, `入口应与统计格同行（入口 y≈${entryBox.y} / 统计格 y≈${metricBox.y}）`).toBe(true);
      expect(entryBox.height, '入口高度应与统计格接近').toBeLessThanOrEqual(metricBox.height + 4);
      expect(entryBox.width, '入口不许占满整行（曾因大按钮被批太夸张）').toBeLessThan(520);
    }

    // ② 点击 → 抽屉出现；等**桌型行**真的渲染出来（不能只等表格容器：它会先渲染空态再落数据，
    //    只等容器会拍到「当前没有对小程序开放的桌型」的假空态）
    await entry.click();
    const drawer = page.getByTestId('sellable-drawer');
    await expect(drawer).toBeVisible({ timeout: 15000 });
    const table = drawer.getByTestId('sellable-table');
    await expect(table).toBeVisible({ timeout: 15000 });
    const rows = table.locator('tbody tr.el-table__row');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });

    // ③ 桌型行带着订法标签（接口没通 / 权限缺失 → 这里红）
    const bodyText = await drawer.innerText();
    expect(bodyText, '抽屉里应至少有一个带订法标签的桌型行').toMatch(/整桌|按座/);

    // ④ 展开首行 → 逐时段表出现且四列齐（「目前不同时段还剩多少 / 今天暂时关闭几个」的落地形态）
    await table.locator('.el-table__expand-icon').first().click();
    const slotTable = table.locator('.sellable-slots').first();
    await expect(slotTable).toBeVisible({ timeout: 10000 });
    await expect(slotTable.locator('tbody tr.el-table__row').first()).toBeVisible({ timeout: 10000 });
    for (const col of ['时段', '已订', '剩余', '今天关闭']) {
      await expect(slotTable.getByText(col, { exact: false }).first()).toBeVisible({ timeout: 10000 });
    }

    // ④b 口径守卫（甲方 2026-09-29）：两列各自挂列头说明；「今天还能卖」必须等于展开后各格剩余的最小值。
    //     这是只读交叉校验 —— 抽屉摘要与逐时段明细同源，一旦谁改了算法就会在这里红。
    await expect(drawer.getByText('今天还能卖').first()).toBeVisible({ timeout: 10000 });
    await expect(drawer.getByText('今天没被预订的座位').first()).toBeVisible({ timeout: 10000 });
    expect(bodyText, '「空闲座位」这个会被读成"关了还空着"的旧列名不该再出现').not.toContain('空闲座位');

    // 按**列头**定位（不按位置硬取：列增删后位置会变）
    const drawerHeads = (await table.locator('thead th').allInnerTexts()).map((h) => h.replace(/\s+/g, ''));
    const idxMinRemaining = drawerHeads.findIndex((h) => h.includes('今天还能卖'));
    expect(idxMinRemaining, '抽屉应有「今天还能卖」列').toBeGreaterThanOrEqual(0);
    const slotHeads = (await slotTable.locator('thead th').allInnerTexts()).map((h) => h.replace(/\s+/g, ''));
    const idxSlotRemaining = slotHeads.findIndex((h) => h.includes('剩余'));
    expect(idxSlotRemaining, '逐时段表应有「剩余」列').toBeGreaterThanOrEqual(0);

    const firstRowCells = await rows.first().locator('td').allInnerTexts();
    const summaryMin = Number(String(firstRowCells[idxMinRemaining]).replace(/\D/g, ''));
    const slotRemainings = await slotTable
      .locator('tbody tr.el-table__row')
      .evaluateAll(
        (trs, ci) => trs.map((tr) => Number(((tr.querySelectorAll('td')[ci] as HTMLElement)?.innerText ?? '').replace(/\D/g, ''))),
        idxSlotRemaining
      );
    expect(slotRemainings.length, '至少要有一格逐时段剩余可比').toBeGreaterThan(0);
    const minRemaining = Math.min(...slotRemainings);
    expect(summaryMin, `抽屉首行「今天还能卖」应 = 逐时段剩余最小值 ${minRemaining}（逐时段= ${JSON.stringify(slotRemainings)}）`).toBe(minRemaining);

    // ⑤ 回归守卫：甲方明确不要「今天不上小程序」整档关停按钮
    expect(bodyText, '不应再有「今天不上小程序」按钮').not.toContain('今天不上小程序');

    // ⑥ 文案/口径守卫（Kevin 2026-09-26 两轮）：
    //    a. 「全天关闭 N 个」必须出现（不能只说"按天统一/应用"，店员看不出这里是关几个座位）
    //    b. 不许再用歧义的「留 N 个」（「留」两读，被打回过一次）
    //    c. 必须能看到「长期关闭(默认)」与「今天关闭」两列 —— 覆盖关系要一眼看懂，不是两个数相加
    await expect(drawer.getByText(/全天关闭/).first()).toBeVisible({ timeout: 10000 });
    expect(bodyText, '不该再用歧义的「留 N 个」措辞').not.toMatch(/留 \d+ 个/);
    await expect(drawer.getByText('长期关闭', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    await expect(drawer.getByText('今天关闭', { exact: false }).first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'test-results/sellable-drawer.png', fullPage: false });

    // ⑦ 点蒙层应关闭抽屉（ACC-f1265c3c 在新组件上的回归守卫：不许再写回 :close-on-click-modal="false"）
    //    注意 `data-test` 落在 el-drawer **内部的面板**（role=dialog）上，不是 `.el-overlay` 蒙层；
    //    点面板左上角当然不会关 —— 必须点它的父节点（蒙层）。
    const mask = drawer.locator('xpath=..');
    await mask.click({ position: { x: 8, y: 8 } });
    await expect(drawer).toBeHidden({ timeout: 8000 });
  });
});
