/**
 * GZ-JP-108 accept #3 —— 「按客人聚合视图 + 批量推进 + 批量发货 E2E」。
 *
 * <p>打真接口真库（不 mock）：夹具用 SQL 造 3 张已付款订单 / 4 个商品行，跑完硬删。
 * 每个写操作都<b>两道断言</b>：UI 显示对 + <b>库里真的写对了</b>（`queryItemStatus`）——
 * 页面弹「操作成功」而库没变过，是这类看板最典型的假绿。</p>
 *
 * <p>覆盖任务卡 AC：按客人聚合 / 可展开 / 组内多选 / <b>跨订单同客人可一起发货</b> /
 * <b>跨客人勾选置灰</b> / 批量推进（可跳过中间态）/ 批量发货（快递 + 单号）/
 * <b>标记购买失败有二次确认</b>。</p>
 */
import { expect, test } from '@playwright/test';
import {
  FX,
  cleanupFulfillFixtures,
  loginAdminToken,
  queryItemStatus,
  seedFulfillFixtures
} from './fulfill-fixtures';

/** 看板路由（菜单 14030 段 component = gz-jp/fulfill/index）。 */
const BOARD = '/gz-jp/fulfill';

/** 夹具行的库主键 —— 与 fulfill-fixtures.ts 的 INSERT 逐条对应（不是顺序递增，别想当然）。 */
const ROW = {
  /** E2E-A1-购买中   purchasing  @order A1 */
  a1: 99101,
  /** E2E-A1-已发货   delivered   @order A1（终态，验勾选框禁用） */
  a1Done: 99104,
  /** E2E-A2-分拣中   cn_sorting  @order A2（与 a1 凑跨订单同包裹） */
  a2: 99102,
  /** E2E-B1-购买中   purchasing  @order B1（客人乙） */
  b1: 99103
} as const;

/** admin token（beforeAll 取一次，各用例注入同一份会话）。 */
let adminToken = '';

test.beforeAll(async () => {
  seedFulfillFixtures();
  adminToken = await loginAdminToken();
});

test.afterAll(() => {
  cleanupFulfillFixtures();
});

/**
 * 注入会话 → 进看板 → 用夹具订单号收敛列表。
 *
 * <p>★ 走「注入 token」而不是 UI 填表单登录（沿用 test/e2e/lib.mjs 的既有做法）：
 * 登录页有验证码 / 租户下拉等变数，UI 登录是这类 admin E2E 最常见的不稳定源。</p>
 *
 * <p>⚠️ plus-ui 的 `useStorage('Admin-Token', null)` 默认值是 null ⇒ VueUse 用 'any'
 * 序列化器，read/write 是恒等/String（<b>不是 JSON</b>）。所以必须写<b>原始 token</b>，
 * `JSON.stringify` 加的引号会让后端 401。</p>
 */
async function gotoBoard(page: import('@playwright/test').Page) {
  await page.goto('/index', { waitUntil: 'domcontentloaded' });
  await page.evaluate((tk) => localStorage.setItem('Admin-Token', tk), adminToken);
  await page.goto('/index', { waitUntil: 'domcontentloaded' });
  // 等 getInfo + generateRoutes 把动态路由注册上，否则直接 goto 看板会被打回 404/login
  await expect(page).not.toHaveURL(/login/, { timeout: 30_000 });
  await page.waitForTimeout(2500);

  await page.goto(BOARD, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('filter-event')).toBeVisible({ timeout: 30_000 });

  // ★ 按【场】收敛到本次夹具的 4 行 —— 不能用 orderNo：后端那个筛选是**精确匹配**
  // （GZ-JP-106 契约），传前缀 'JPO-E2E108-' 一条也匹配不上，会静默得到空看板。
  await page.getByTestId('filter-event').click();
  await page.locator('.el-select-dropdown__item:visible').filter({ hasText: FX.eventName }).first().click();
  await page.getByTestId('btn-search').click();
  await expect(page.getByTestId('group-table')).toBeVisible({ timeout: 30_000 });
  // 等分组真的渲染出来（搜索是异步的，group-table 的壳先在、行后到）
  await expect(page.getByTestId(`group-name-${FX.userA}`)).toBeVisible({ timeout: 30_000 });
}

/** 展开某个客人的分组（Element Plus 展开行）。 */
async function expandUser(page: import('@playwright/test').Page, userId: string) {
  const table = page.getByTestId(`item-table-${userId}`);
  if (!(await table.isVisible().catch(() => false))) {
    await page.getByTestId(`group-name-${userId}`).click();
    await expect(table).toBeVisible({ timeout: 15_000 });
  }
  return table;
}

/** 勾选某一行（行上没有 data-test，靠唯一商品名定位）。 */
async function checkRowByName(page: import('@playwright/test').Page, userId: string, name: string) {
  const table = await expandUser(page, userId);
  const row = table.locator('tr.el-table__row', { hasText: name }).first();
  await expect(row).toBeVisible();
  await row.locator('.el-checkbox').first().click();
  return row;
}

test.describe('GZ-JP-108 履约看板', () => {
  test('★ 按客人聚合：组头显示客人 + 款数，展开后是该客人的商品行（跨订单同组）', async ({ page }) => {
    await gotoBoard(page);

    // 两个客人 = 两个分组（不是 4 行平铺）
    await expect(page.getByTestId(`group-name-${FX.userA}`)).toBeVisible();
    await expect(page.getByTestId(`group-name-${FX.userB}`)).toBeVisible();

    // ★ 客人甲的组里应同时有 A1 与 A2 两张订单的货（跨订单聚合，REQ-FULFILL-006）
    const tableA = await expandUser(page, FX.userA);
    await expect(tableA.locator('tr.el-table__row', { hasText: FX.itemA1Name })).toBeVisible();
    await expect(tableA.locator('tr.el-table__row', { hasText: FX.itemA2Name })).toBeVisible();
    // 用 first()：订单 A1 下有 2 个商品行 ⇒ 订单号列本来就出现 2 次（不是重复渲染）
    await expect(tableA.getByText(FX.orderA1No).first()).toBeVisible();
    await expect(tableA.getByText(FX.orderA2No).first()).toBeVisible();

    // 客人乙的货不能混进甲的组
    await expect(tableA.locator('tr.el-table__row', { hasText: FX.itemB1Name })).toHaveCount(0);
  });

  test('★ 终态行（已发货）不可勾选', async ({ page }) => {
    await gotoBoard(page);
    const tableA = await expandUser(page, FX.userA);
    const doneRow = tableA.locator('tr.el-table__row', { hasText: FX.itemA1DoneName }).first();
    await expect(doneRow).toBeVisible();
    // terminal=true 的行 checkbox 必须是 disabled（后端也拦，但 UI 应提前反馈）
    await expect(doneRow.locator('.el-checkbox.is-disabled')).toHaveCount(1);
  });

  test('★ 跨客人勾选 → 批量发货置灰并提示', async ({ page }) => {
    await gotoBoard(page);
    await checkRowByName(page, FX.userA, FX.itemA1Name);
    await checkRowByName(page, FX.userB, FX.itemB1Name);

    // 一个运单号只属一个客人 → 发货按钮必须禁用 + 给出原因
    await expect(page.getByTestId('btn-ship')).toBeDisabled();
    await expect(page.getByTestId('cross-user-warning')).toBeVisible();

    // 清空勾选后跨客人警告应消失（操作条本身仍在，按钮只是回到禁用态，不会被卸载）
    await page.getByTestId('btn-clear-selection').click();
    await expect(page.getByTestId('cross-user-warning')).not.toBeVisible();
  });

  test('★ 批量推进（跳过中间态：购买中 → 清关中），UI 与库双断言', async ({ page }) => {
    await gotoBoard(page);
    await checkRowByName(page, FX.userA, FX.itemA1Name);

    await page.getByTestId('btn-advance').click();
    await expect(page.getByTestId('advance-dialog')).toBeVisible();

    // 目标状态下拉不应出现 purchasing（起点）与 delivered（必须走发货按钮）
    await page.getByTestId('advance-target').click();
    const options = page.locator('.el-select-dropdown__item:visible');
    await expect(options.filter({ hasText: '发货完毕' })).toHaveCount(0);
    // ★ 跳过 await_seller_ship / jp_shipped，直接选清关中
    await options.filter({ hasText: '清关中' }).first().click();

    await page.getByTestId('advance-confirm').click();

    // 全成功时页面只弹绿条、不弹结果弹窗（有被拒的行才值得打断店员 —— 页面刻意的设计）
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 20_000 });

    // ★ 库里真的变了（不是只弹了个成功提示）
    await expect
      .poll(() => queryItemStatus(ROW.a1).status, { timeout: 15_000 })
      .toBe('customs');
  });

  test('★ 批量发货：跨订单同客人共用一个运单号，UI 与库双断言', async ({ page }) => {
    await gotoBoard(page);
    // A1（上一用例已推到 customs）与 A2（cn_sorting）分属两张订单，一起发
    await checkRowByName(page, FX.userA, FX.itemA1Name);
    await checkRowByName(page, FX.userA, FX.itemA2Name);
    await expect(page.getByTestId('selected-count')).toContainText('2');

    await page.getByTestId('btn-ship').click();
    await expect(page.getByTestId('ship-dialog')).toBeVisible();
    // 跨订单提示应出现（同客人允许，但要让店员看见这批来自不同订单）
    await expect(page.getByTestId('ship-cross-order-hint')).toBeVisible();

    await page.getByTestId('ship-carrier').click();
    await page.locator('.el-select-dropdown__item:visible').filter({ hasText: '顺丰速运' }).first().click();
    const tracking = `SFE2E${Date.now().toString().slice(-8)}`;
    await page.getByTestId('ship-tracking').fill(tracking);
    await page.getByTestId('ship-confirm').click();
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 20_000 });

    // ★ 两行都 delivered 且共用同一个单号（同单号即同包裹，不建包裹表）
    await expect
      .poll(() => queryItemStatus(ROW.a1).status, { timeout: 15_000 })
      .toBe('delivered');
    const a1 = queryItemStatus(ROW.a1);
    const a2 = queryItemStatus(ROW.a2);
    expect(a2.status).toBe('delivered');
    expect(a1.tracking).toBe(tracking);
    expect(a2.tracking).toBe(tracking);
  });

  test('★★ 批量标记购买失败必须二次确认（会触发真实退款，不可逆）', async ({ page }) => {
    await gotoBoard(page);
    await checkRowByName(page, FX.userB, FX.itemB1Name);

    await page.getByTestId('btn-mark-failed').click();
    const dialog = page.getByTestId('mark-failed-dialog');
    await expect(dialog).toBeVisible();
    // 必须明确警示会退款
    await expect(page.getByTestId('mark-failed-warning')).toBeVisible();

    // ★ 未勾确认框时，确认按钮必须禁用 —— 这就是「二次确认」的落点
    await expect(page.getByTestId('mark-failed-confirm')).toBeDisabled();
    expect(queryItemStatus(ROW.b1).status).toBe('purchasing'); // 此刻库里绝不能已经变

    await page.getByTestId('mark-failed-ack').click();
    await expect(page.getByTestId('mark-failed-confirm')).toBeEnabled();
    await page.getByTestId('mark-failed-confirm').click();

    await expect(page.getByTestId('result-dialog')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('result-marked')).toContainText('1');
    await page.getByTestId('result-close').click();

    // ★ 库里落到分支终态
    expect(queryItemStatus(ROW.b1).status).toBe('purchase_failed');
  });
});
