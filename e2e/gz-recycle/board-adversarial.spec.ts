/**
 * GZ-RECYCLE-011 对抗性测试第二轮回归 —— 看板失败路径的三条 finding：
 *
 *   F4：业务预期拒绝（4122 / 4129）不得打 console.error（AC15「console 0 error」在真实业务拒绝路径上也成立）；
 *   F5：任一操作被后端拒绝后，看板必须自己拉回真相态（不能停留在陈旧的「可点」视图等人手动刷新）；
 *   F6：确认按钮必须有组件级重入闸（不把防重复提交全押在全局 axios 拦截器 + 后端 Redis 锁上）。
 *
 * 打真接口真库（不 mock）：夹具用真端点建手动占用，跑完按备注前缀硬删。
 * 跑法：`cd code/main/plus-ui && npx playwright test e2e/gz-recycle/board-adversarial.spec.ts --reporter=line`
 */
import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import { FX, apiManualHold, apiReleaseHold, cleanupBoardFixtures, countRowsByRemark, loginAdminToken } from './board-fixtures';

const BOARD = '/gz-recycle/appointment';

let adminToken = '';

test.beforeAll(async () => {
  cleanupBoardFixtures();
  adminToken = await loginAdminToken();
});

test.afterAll(() => {
  cleanupBoardFixtures();
});

/** 收集本页 console.error（F4 的唯一判据），返回一个可随时读的数组。 */
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/** 注入 token 进看板 + 切到夹具门店（默认选中的是第一个门店，夹具用第二个）。 */
async function gotoBoard(page: Page) {
  await page.goto('/index', { waitUntil: 'domcontentloaded' });
  await page.evaluate((tk) => localStorage.setItem('Admin-Token', tk), adminToken);
  await page.goto('/index', { waitUntil: 'domcontentloaded' });
  await expect(page).not.toHaveURL(/login/, { timeout: 30_000 });
  await page.waitForTimeout(2500);

  await page.goto(BOARD, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.board-matrix')).toBeVisible({ timeout: 30_000 });

  // 切门店（看板顶部第一个下拉）
  await page.locator('.board-header__left .el-select').first().click();
  await page.locator('.el-select-dropdown__item:visible').filter({ hasText: FX.storeName }).first().click();
  await page.waitForTimeout(1200);
}

function cell(page: Page, date: string, slotId: string) {
  return page.locator(`[data-cell-date="${date}"][data-cell-slot="${slotId}"]`);
}

async function cellKind(page: Page, date: string, slotId: string): Promise<string | null> {
  return cell(page, date, slotId).first().getAttribute('data-cell-kind');
}

test('F5+F4：释放时该行已被并发释放 → toast 4129 + 看板自动回真相态（无需手点刷新）+ console 0 error', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const [holdId] = await apiManualHold(adminToken, FX.releaseCell.date, [FX.releaseCell.slotId], `${FX.remarkPrefix}stale-release`);

  await gotoBoard(page);
  await expect.poll(() => cellKind(page, FX.releaseCell.date, FX.releaseCell.slotId)).toBe('manual');

  // 打开释放确认框（先别确认）
  await cell(page, FX.releaseCell.date, FX.releaseCell.slotId).getByRole('button', { name: '释放' }).click();
  await expect(page.locator('.el-message-box')).toBeVisible();

  // 另一个店员（带外请求）先把它释放了 → 页面此刻持有的视图已陈旧
  expect(await apiReleaseHold(adminToken, holdId)).toBe(200);

  // 确认陈旧弹窗 → 后端 4129
  await page.locator('.el-message-box__btns .el-button--primary').click();
  // 业务码（非 200）走 ElNotification.error，不是 ElMessage —— 见 src/utils/request.ts 响应拦截器
  await expect(page.locator('.el-notification').filter({ hasText: '仅手动占用记录可在看板释放' })).toBeVisible({ timeout: 10_000 });
  // ★ F4：4129 是业务预期拒绝，不该进 console.error
  expect(errors, `console.error 不应有任何输出，实际：${JSON.stringify(errors)}`).toEqual([]);

  // ★ F5：不点「刷新」，格必须自己变回空闲
  await expect.poll(() => cellKind(page, FX.releaseCell.date, FX.releaseCell.slotId), { timeout: 15_000 }).toBe('idle');
  // 旧行为下这里仍是 manual，且带着可点的 改期/释放 按钮
  await expect(cell(page, FX.releaseCell.date, FX.releaseCell.slotId).getByRole('button', { name: '释放' })).toHaveCount(0);

  // ★ F4：业务拒绝不是前端异常
  expect(errors, `console.error 不应有任何输出，实际：${JSON.stringify(errors)}`).toEqual([]);
});

test('F4+F5：手动占用撞上并发占格（4122）→ toast + 看板刷新 + 选中态清理 + console 0 error', async ({ page }) => {
  const errors = collectConsoleErrors(page);

  await gotoBoard(page);
  await expect.poll(() => cellKind(page, FX.conflictCell.date, FX.conflictCell.slotId)).toBe('idle');

  // 选中空格 → 打开手动占用弹窗
  await cell(page, FX.conflictCell.date, FX.conflictCell.slotId).click();
  await expect(page.locator('.board-selected-count')).toHaveText('已选 1 格');
  await page.getByRole('button', { name: '手动占用' }).click();
  await expect(page.locator('.el-dialog__title').filter({ hasText: '手动占用时段' })).toBeVisible();

  // 提交前该格被别人占走 → 提交必被后端 4122 拒
  await apiManualHold(adminToken, FX.conflictCell.date, [FX.conflictCell.slotId], `${FX.remarkPrefix}conflict-taker`);

  await page.locator('.el-dialog:visible textarea').fill(`${FX.remarkPrefix}conflict-loser`);
  await page.getByRole('button', { name: '确认占用' }).click();

  await expect(page.locator('.el-notification').filter({ hasText: '该时段已被预约' })).toBeVisible({ timeout: 10_000 });
  // ★ F4：业务拒绝（4122）不是前端异常 —— 断言放在刷新断言之前，修复前正是在这一步先炸
  expect(errors, `console.error 不应有任何输出，实际：${JSON.stringify(errors)}`).toEqual([]);
  // 弹窗保持打开允许改选（AC10 不变）
  await expect(page.locator('.el-dialog__title').filter({ hasText: '手动占用时段' })).toBeVisible();

  // ★ F5：看板自动刷新出别人占的那一格 + 已失效的选中态被清掉
  await page.locator('.el-dialog:visible .el-dialog__headerbtn').click();
  await expect.poll(() => cellKind(page, FX.conflictCell.date, FX.conflictCell.slotId), { timeout: 15_000 }).toBe('manual');
  await expect(page.locator('.board-selected-count')).toHaveCount(0);

  // 失败的那一笔不得落库；抢先的那一笔在
  expect(countRowsByRemark('conflict-loser')).toBe(0);
  expect(countRowsByRemark('conflict-taker', 'manual_hold')).toBe(1);
  expect(errors, `console.error 不应有任何输出，实际：${JSON.stringify(errors)}`).toEqual([]);
});

test('F6：确认占用连点两次 → 只发 1 个请求、只落 1 行，且不触发全局「请勿重复提交」拦截', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const warns: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning') warns.push(m.text());
  });

  await gotoBoard(page);
  await expect.poll(() => cellKind(page, FX.reentryCell.date, FX.reentryCell.slotId)).toBe('idle');

  await cell(page, FX.reentryCell.date, FX.reentryCell.slotId).click();
  await page.getByRole('button', { name: '手动占用' }).click();
  await page.locator('.el-dialog:visible textarea').fill(`${FX.remarkPrefix}reentry`);

  // 同步连点两次（QA 原始复现手法：一次 evaluate 里 click() 两下，按钮 disabled 还没来得及翻转）
  const fired = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.el-dialog .el-dialog__footer .el-button--primary')) as HTMLButtonElement[];
    const btn = btns[btns.length - 1];
    btn.click();
    btn.click();
    return btns.length;
  });
  expect(fired).toBeGreaterThan(0);

  await expect(page.locator('.el-message').filter({ hasText: '占用成功' })).toBeVisible({ timeout: 10_000 });

  const requests = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('manual-hold')).length);
  expect(requests, '第二次点击必须被组件级重入闸挡在发请求之前').toBe(1);
  expect(countRowsByRemark('reentry', 'manual_hold'), '连点两次只应落一行').toBe(1);
  // 组件挡住了 → 全局 axios 防重复提交拦截器根本不会被触发
  expect(
    warns.filter((w) => w.includes('请勿重复提交')),
    '不应退化到靠全局拦截器兜底'
  ).toEqual([]);
  expect(errors, `console.error 不应有任何输出，实际：${JSON.stringify(errors)}`).toEqual([]);
});

test('回归：手动占用改期 happy path 不受「禁选过去日期」影响（店员台账可挪到过去），改完可释放', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await apiManualHold(adminToken, FX.moveFrom.date, [FX.moveFrom.slotId], `${FX.remarkPrefix}move`);

  await gotoBoard(page);
  await expect.poll(() => cellKind(page, FX.moveFrom.date, FX.moveFrom.slotId)).toBe('manual');

  await cell(page, FX.moveFrom.date, FX.moveFrom.slotId).getByRole('button', { name: '改期' }).click();
  await expect(page.locator('.el-dialog__title').filter({ hasText: '预约改期' })).toBeVisible();

  // 日期选到「过去的今天所在周内某天」——手动占用允许（顾客单则被 disabled-date + 后端 4130 双重拦截）
  await page.locator('.el-dialog:visible .el-date-editor input').fill(FX.moveTo.date);
  await page.keyboard.press('Enter');
  await page.locator('.el-dialog:visible .el-select').click();
  await page.locator('.el-select-dropdown__item:visible').filter({ hasText: FX.moveTo.slotLabel }).first().click();
  await page.getByRole('button', { name: '确认改期' }).click();

  await expect(page.locator('.el-message').filter({ hasText: '改期成功' })).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => cellKind(page, FX.moveTo.date, FX.moveTo.slotId), { timeout: 15_000 }).toBe('manual');
  await expect.poll(() => cellKind(page, FX.moveFrom.date, FX.moveFrom.slotId), { timeout: 15_000 }).toBe('idle');

  // 释放 happy path（confirm 后必须真的变空闲）
  await cell(page, FX.moveTo.date, FX.moveTo.slotId).getByRole('button', { name: '释放' }).click();
  await page.locator('.el-message-box__btns .el-button--primary').click();
  await expect(page.locator('.el-message').filter({ hasText: '已释放' })).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => cellKind(page, FX.moveTo.date, FX.moveTo.slotId), { timeout: 15_000 }).toBe('idle');

  expect(errors, `console.error 不应有任何输出，实际：${JSON.stringify(errors)}`).toEqual([]);
});
