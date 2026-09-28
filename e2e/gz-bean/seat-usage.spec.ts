import { expect, test } from '@playwright/test';

/**
 * 拼豆营业额页的「桌型使用时长 · 上桌率」报表（GZ-BEAN-059，甲方 2026-09-28）。
 *
 * 甲方原话：「我想知道每个月 单人桌 双人桌 六人桌 分别坐了多少小时」，用途是店内调整（线下店员不填现金）。
 * 之后两轮复审又定了形态：① 要「每个座位平均多少小时」；② 门店做成**必选筛选**（不要「全部门店」，
 * 否则同一月份会被重复渲染成多段）、桌型也做筛选（可以全部）。
 *
 * 守卫（L2 要求"每个 flow 必须有数据真的来自后端"的证据）：
 *   1. 门店筛选**没有「全部门店」选项**且必选；表格里不再有门店列
 *   2. 渲染行与后端返回**逐字相等**（上桌时长 / 可售时长 / 容量 / 平均每桌·座时长）
 *   3. 默认顺序 = 月份 → 桌型（月份单调不减 + 同月单元格 rowspan 合并）
 *   4. 桌型筛选：选中一个桌型 → 每月只剩该桌型，合计行随之变化
 *   5. 表头可排序（点「上桌时长」两次 → 首行 = 该列最大值）
 *   6. 比率列不得出现 NaN / Infinity；合计行的容量与平均值必须是「—」（桌与座不同量纲）
 */

const BACKEND = process.env.ADMIN_BACKEND || 'http://localhost:8080';
const CLIENT_ID = process.env.ADMIN_CLIENT_ID || 'e5cd7e4891bf95d1d19206ce24a7b32e';
const PAGE_PATH = '/gz-bean/revenue';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** 与 revenue/index.vue 的 defaultRange() 同口径 */
function defaultRange(): [string, string] {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  return [fmt(first), fmt(today)];
}

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

/** 不传 storeId → 拿全部门店，便于按页面选中的门店过滤出期望行 */
async function fetchUsage(token: string, startDate: string, endDate: string) {
  const url = `${BACKEND}/system/gz/bean/revenue/seat-usage?startDate=${startDate}&endDate=${endDate}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, clientid: CLIENT_ID } });
  const json = (await res.json()) as { code?: number; data?: Record<string, unknown>[] };
  expect(json.code, `seat-usage 应返回 200，实际 ${JSON.stringify(json).slice(0, 200)}`).toBe(200);
  return json.data || [];
}

/**
 * 忠实重建「逻辑行」：月份是 rowspan 合并的，被合并掉的行在 DOM 里**没有月份 td**
 * （后面的列会整体左移），所以按位置取列会错位。这里按 rowspan 把月份下发回后续行，
 * 还原出「月份|桌型|桌数|上桌时长|…」的完整逻辑行，后续断言才能按列序号比。
 */
async function readLogicalRows(section: import('@playwright/test').Locator): Promise<string[][]> {
  const raw = await section.locator('tbody tr.el-table__row').evaluateAll((trs) =>
    trs.map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => ({
        text: (td as HTMLElement).innerText.trim(),
        rowspan: Number(td.getAttribute('rowspan') || '1')
      }))
    )
  );
  const out: string[][] = [];
  let monthLeft = 0;
  let curMonth = '';
  for (const tds of raw) {
    const queue = [...tds];
    const logical: string[] = [];
    if (monthLeft > 0) {
      monthLeft -= 1;
      logical.push(curMonth);
    } else {
      const td = queue.shift();
      curMonth = td ? td.text : '';
      monthLeft = td ? Math.max(0, td.rowspan - 1) : 0;
      logical.push(curMonth);
    }
    logical.push(...queue.map((td) => td.text));
    out.push(logical);
  }
  return out;
}

test.describe('拼豆营业额 · 桌型使用时长', () => {
  test('门店必选 + 桌型可筛，数字与后端逐字一致 + 合并/排序/口径说明', async ({ page }) => {
    const token = await loginAdminToken();
    const [startDate, endDate] = defaultRange();
    const allRows = await fetchUsage(token, startDate, endDate);
    expect(allRows.length, `${startDate}~${endDate} 应有可统计行（少于此说明种子数据被清了）`).toBeGreaterThan(0);

    await page.goto('/index', { waitUntil: 'domcontentloaded' });
    await page.evaluate((tk) => localStorage.setItem('Admin-Token', tk), token);
    await page.goto('/index', { waitUntil: 'domcontentloaded' });
    await page.goto(PAGE_PATH, { waitUntil: 'domcontentloaded' });

    const section = page.locator('.section').filter({ hasText: '桌型使用时长' }).first();
    await expect(section).toBeVisible({ timeout: 20000 });

    // 口径说明必须在页面上（甲方和店员都要能读到"平均怎么算的""分母是什么"）
    await expect(section).toContainText('上桌时长 ÷ 可售时长');
    await expect(section).toContainText('平均每桌/座时长');
    await expect(section).toContainText('座·小时');
    // 甲方明确说店员不填现金 → 口径说明里必须写清"与金额无关"
    await expect(section).toContainText('与金额无关');

    // 等数据真的落下来（容器先渲染空态再落数据；在此之前读门店/行都会取到空）
    const rows = section.locator('tbody tr.el-table__row');
    await expect(rows.first()).toBeVisible({ timeout: 20000 });

    // 门店必须已经选中一家（「全部门店」已去掉）。注意 Element Plus 的选择值**不在 input.value 里**，
    // 选中项渲染在 wrapper 的文本节点里 → 只能读 innerText。
    const storeSelect = page.locator('.filter-form .el-select').first();
    await expect(storeSelect).toContainText('·', { timeout: 15000 });
    const storeText = (await storeSelect.innerText()).replace(/\s+/g, ' ').trim();
    expect(storeText, '门店筛选必须已选一家店（不再是「全部门店」）').not.toBe('');
    expect(storeText, '门店筛选不得再出现「全部门店」').not.toContain('全部门店');
    await storeSelect.click();
    await expect(page.getByRole('option', { name: '全部门店' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // 期望行 = 后端返回里属于该门店的行
    const storeName = storeText.includes('·') ? storeText.split('·').pop()!.trim() : storeText;
    const usage = allRows.filter((r) => String(r.storeName) === storeName);
    expect(usage.length, `后端应有 ${storeName} 的可统计行`).toBeGreaterThan(0);

    // 门店已固定 → 表里不该再有门店列
    const heads = (await section.locator('thead th').allInnerTexts()).map((h) => h.trim());
    expect(
      heads.some((h) => h === '门店'),
      '门店已是筛选条件，表格里不应再有门店列'
    ).toBe(false);

    const idxMonth = heads.findIndex((h) => h.includes('月份'));
    const idxType = heads.findIndex((h) => h.includes('桌型'));
    const idxCap = heads.findIndex((h) => h.includes('桌数'));
    const idxUsed = heads.findIndex((h) => h.includes('上桌时长'));
    const idxAvg = heads.findIndex((h) => h.includes('平均每桌'));
    const idxSellable = heads.findIndex((h) => h.includes('可售时长'));
    const idxRate = heads.findIndex((h) => h === '上桌率');
    const cols: [string, number][] = [
      ['月份', idxMonth],
      ['桌型', idxType],
      ['桌数/座位数', idxCap],
      ['上桌时长', idxUsed],
      ['平均每桌/座时长', idxAvg],
      ['可售时长', idxSellable],
      ['上桌率', idxRate]
    ];
    for (const [name, idx] of cols) {
      expect(idx, `应有「${name}」列`).toBeGreaterThanOrEqual(0);
    }

    const rendered = await readLogicalRows(section);
    expect(rendered.length, '渲染行数应等于该门店的后端行数').toBe(usage.length);

    // 默认顺序 = 月份 → 桌型（月份单调不减；合并范围正确）
    const monthSeq = rendered.map((c) => c[idxMonth]);
    expect(monthSeq, `月份必须单调不减，实际 ${JSON.stringify(monthSeq)}`).toEqual([...monthSeq].sort());
    const firstMonth = String(usage[0].month);
    const rowsOfFirstMonth = usage.filter((r) => String(r.month) === firstMonth).length;
    const firstMonthRowspan = await rows.first().locator('td').first().getAttribute('rowspan');
    expect(Number(firstMonthRowspan), `首个月份单元格 rowspan 应 = 该月份行数 ${rowsOfFirstMonth}`).toBe(rowsOfFirstMonth);

    // 逐行比对：匹配键 = 月份 + 桌型（门店已固定，同月同名桌型唯一）
    let matched = 0;
    for (const cells of rendered) {
      const apiRow = usage.find((r) => String(r.month) === cells[idxMonth] && cells[idxType].includes(String(r.name)));
      expect(apiRow, `页面行 ${JSON.stringify([cells[idxMonth], cells[idxType]])} 应能在后端找到对应行`).toBeTruthy();
      if (!apiRow) continue;
      const unit = apiRow.bookMode === 'seat' ? '座' : '桌';
      expect(cells[idxUsed], `${cells[idxMonth]}/${apiRow.name} 上桌时长（后端 ${apiRow.usedHours}）`).toBe(String(apiRow.usedHours));
      expect(cells[idxSellable], `${cells[idxMonth]}/${apiRow.name} 可售时长（后端 ${apiRow.sellableHours}）`).toBe(String(apiRow.sellableHours));
      expect(cells[idxCap], `${cells[idxMonth]}/${apiRow.name} 桌数/座位数（后端 ${apiRow.capacityPerSlot}）`).toBe(
        `${apiRow.capacityPerSlot} ${unit}`
      );
      if (apiRow.avgHoursPerUnit === null) {
        expect(cells[idxAvg], `${cells[idxMonth]}/${apiRow.name} 容量 0 → 平均值应为「—」`).toBe('—');
      } else {
        expect(cells[idxAvg], `${cells[idxMonth]}/${apiRow.name} 平均每${unit}时长（后端 ${apiRow.avgHoursPerUnit}）`).toBe(
          Number(apiRow.avgHoursPerUnit).toFixed(1)
        );
      }
      matched += 1;
    }
    expect(matched, '必须至少有一行被真正比对过（不许空转）').toBe(usage.length);

    // 合计行：容量与平均值混量纲 → 「—」
    const summaryCells = (await section.locator('.el-table__footer td').allInnerTexts()).map((x) => x.trim());
    expect(summaryCells[0], '合计行首格应是「合计」').toBe('合计');
    expect(summaryCells[idxCap], '合计行的桌数/座位数应为「—」（混量纲）').toBe('—');
    expect(summaryCells[idxAvg], '合计行的平均值应为「—」（混量纲）').toBe('—');

    // 桌型筛选：选中一个桌型 → 每月只剩该桌型，合计行只算该桌型
    const typeFilter = section.locator('.section-title .el-select').first();
    const typeName = String(usage[0].name);
    await typeFilter.click();
    await page.getByRole('option', { name: typeName, exact: true }).first().click();
    await page.waitForTimeout(400);
    const filtered = await readLogicalRows(section);
    const expectedFiltered = usage.filter((r) => String(r.name) === typeName);
    expect(filtered.length, `桌型筛选「${typeName}」后行数应 = 该桌型的后端行数`).toBe(expectedFiltered.length);
    expect(
      filtered.every((c) => c[idxType].includes(typeName)),
      '筛选后每一行都应是该桌型'
    ).toBe(true);
    const filteredSummary = (await section.locator('.el-table__footer td').allInnerTexts()).map((x) => x.trim());
    expect(filteredSummary[idxUsed], '合计行的上桌时长应随筛选变化').toBe(String(expectedFiltered.reduce((a, r) => a + Number(r.usedHours), 0)));
    // 还原「全部桌型」
    await typeFilter.click();
    await page.getByRole('option', { name: '全部桌型', exact: true }).first().click();
    await page.waitForTimeout(400);

    // 表头可排序：点「上桌时长」两次（asc→desc）→ 首行必须是该门店最大时长那一行
    const usedHead = section.locator('thead th').filter({ hasText: '上桌时长' }).first();
    await usedHead.click();
    await usedHead.click();
    await page.waitForTimeout(500);
    const afterSort = await readLogicalRows(section);
    const maxUsed = Math.max(...usage.map((r) => Number(r.usedHours)));
    expect(Number(afterSort[0][idxUsed]), `按「上桌时长」降序后首行应是最大值 ${maxUsed}`).toBe(maxUsed);

    // 比率列不许出现 NaN / Infinity
    const bodyText = await section.innerText();
    expect(bodyText, '比率列不许出现 NaN').not.toMatch(/NaN/);
    expect(bodyText, '比率列不许出现 Infinity').not.toMatch(/Infinity/);

    await page.screenshot({ path: 'test-results/seat-usage.png', fullPage: false });
  });
});
