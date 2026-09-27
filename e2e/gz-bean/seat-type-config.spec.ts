import { expect, test, type Page } from '@playwright/test';

/**
 * 座位管理 → 桌型配置：两个弹窗的职责边界（ADR-0024 §2 / §6，GZ-BEAN-057/058）。
 *
 * 守四件事：
 *   1. **编辑座位类型**弹窗里**没有**「对小程序开放」开关（= ADR-0023 的临时桌 `mp_visible`；
 *      甲方 2026-09-26 选 A：摘入口、留字段）。防它被重新加回来。
 *   2. 同一个弹窗里有「长期关闭」（GZ-BEAN-057）。
 *   3. **价格配置已集中**：编辑弹窗里不再有「基础单价 / 包天基础价」输入，只有一句指向
 *      「星期 × 时段价格」的只读说明（GZ-BEAN-058）。
 *   4. **星期 × 时段价格**弹窗里有可编辑的「全局默认价」（基础单价 / 包天基础价）。
 *
 * **只读**：只开弹窗看结构，不保存、不改库。
 */

const BACKEND = process.env.ADMIN_BACKEND || 'http://localhost:8080';
const CLIENT_ID = process.env.ADMIN_CLIENT_ID || 'e5cd7e4891bf95d1d19206ce24a7b32e';
const SEAT_MGMT = '/gz-bean/seat-management';

async function loginAdminToken(): Promise<string> {
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

async function gotoSeatManagement(page: Page, token: string) {
  await page.goto('/index', { waitUntil: 'domcontentloaded' });
  await page.evaluate((tk) => localStorage.setItem('Admin-Token', tk), token);
  await page.goto('/index', { waitUntil: 'domcontentloaded' });
  await page.goto(SEAT_MGMT, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
}

test.describe('座位类型编辑弹窗', () => {
  test('没有「对小程序开放」开关、有「长期关闭」、价格已挪走', async ({ page }) => {
    const token = await loginAdminToken();
    await gotoSeatManagement(page, token);

    // 等到桌型行出来（避免在数据到位前断言，变成空转通过）
    const editBtn = page.getByRole('button', { name: '编辑' }).first();
    await expect(editBtn).toBeVisible({ timeout: 15000 });
    await editBtn.click();

    const dialog = page.locator('.el-dialog:visible').first();
    await expect(dialog).toBeVisible({ timeout: 10000 });
    // 弹窗真的渲染了表单（不是空壳）——「类型名称」是必填项，它必须在
    await expect(dialog.getByText('类型名称', { exact: false }).first()).toBeVisible({ timeout: 10000 });

    const dialogText = await dialog.innerText();

    // ① 桌型级 mp 可见性入口已摘（ADR-0024 §2）
    expect(dialogText, '编辑弹窗里不应再出现「对小程序开放」').not.toContain('对小程序开放');
    expect(dialogText, '编辑弹窗里不应再出现「已开放 / 未开放」这对开关文案').not.toMatch(/已开放|未开放/);
    await expect(dialog.locator('.el-switch'), '编辑弹窗里不应再有开关控件').toHaveCount(0);

    // ② GZ-BEAN-057：长期关闭数必须在这里可控
    await expect(dialog.getByText('长期关闭', { exact: false }).first(), '桌型配置里要有「长期关闭」').toBeVisible({
      timeout: 10000
    });

    // ③ GZ-BEAN-058：价格配置已集中到「星期 × 时段价格」——这里不许再有价格**表单项**，只留只读指路。
    //    注意判据是「不是 el-form-item 的 label」：指路那句里本来就会提到这两个名字。
    const labels = await dialog.locator('.el-form-item__label').allInnerTexts();
    expect(labels.join('|'), '基础单价 / 包天基础价都不该再是表单项').not.toMatch(/基础单价|包天基础价/);
    expect(dialogText, '应指向「星期 × 时段价格」').toContain('星期 × 时段价格');

    await page.waitForTimeout(800); // 等弹窗动画收尾，别截到半透明过渡帧
    await page.screenshot({ path: 'test-results/seat-type-dialog.png', fullPage: false });
  });
});

test.describe('星期 × 时段价格弹窗', () => {
  test('「全局默认价」（基础单价 / 包天基础价）在这里可编辑', async ({ page }) => {
    const token = await loginAdminToken();
    await gotoSeatManagement(page, token);

    const priceBtn = page.getByRole('button', { name: '星期×时段价格' }).first();
    await expect(priceBtn).toBeVisible({ timeout: 15000 });
    await priceBtn.click();

    const dialog = page.locator('.el-dialog:visible').filter({ hasText: '星期' }).first();
    await expect(dialog).toBeVisible({ timeout: 10000 });

    await expect(dialog.getByText('全局默认价').first(), '要有「全局默认价」区块').toBeVisible({ timeout: 10000 });
    await expect(dialog.getByText('基础单价', { exact: false }).first(), '要有基础单价').toBeVisible();
    const defaults = dialog.locator('.wp-defaults input');
    await expect(defaults.first(), '全局默认价必须可编辑（不是只读展示）').toBeVisible();
    expect(await defaults.count(), '至少一个可编辑输入（基础单价）').toBeGreaterThanOrEqual(1);

    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-results/weekday-price-dialog.png', fullPage: false });
  });
});
