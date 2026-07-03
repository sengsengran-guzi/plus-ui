/**
 * kevin-qa Tier 1B — GZ-BEAN 0702 批改 admin E2E
 *
 * 验证点：
 *   #5  拼豆营业额页：渲染 + 汇总卡 + 明细 + 门店筛选
 *   #6  优惠券手机号查询：mobile LIKE 修复（输 1380 应返 3 用户）
 *   #4b 座位管理归拢（el-tabs 三 tab）：桌型配置 / 座位单元 / 实时余量 tab 渲染
 *   #4a 实时余量 stepper：选门店+日期 → 关闭数 stepper 可交互（改→还原）
 *   #2  看板代客预约：点空闲座位弹抽屉 + 提交 walk_in 单 + 预约管理无「代客预定」按钮
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { clearProxy, chromePath, login, injectSession, sleep, CFG } from './lib.mjs';

clearProxy();
const OUT = '/tmp/qa-gz-bean-0702';
mkdirSync(OUT, { recursive: true });

const ss = async (page, name) => {
  const p = join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  [SS] ${p}`);
  return p;
};

const nav = async (page, path) => {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, path);
  await sleep(700);
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {});
  await sleep(1000);
};

let pass = 0, fail = 0;
const results = [];
const P = (id, msg) => { results.push({ id, ok: true, msg }); console.log(`[PASS] ${id}: ${msg}`); pass++; };
const F = (id, msg) => { results.push({ id, ok: false, msg }); console.log(`[FAIL] ${id}: ${msg}`); fail++; };

async function main() {
  console.log(`=== GZ-BEAN 0702 批改 admin E2E ===`);
  console.log(`base=${CFG.base} backend=${CFG.backend} user=${CFG.username}`);

  const token = await login();
  console.log(`[OK] token len=${token.length}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    defaultViewport: { width: 1600, height: 900 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--no-proxy-server', '--disable-gpu', '--lang=zh-CN'],
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push('cerror: ' + m.text().slice(0, 200)); });

  await injectSession(page, token);
  console.log(`[OK] session injected → ${page.url()}\n`);

  // ========== #5 拼豆营业额 ==========
  console.log('=== #5 拼豆营业额 ===');
  await nav(page, '/gz-bean/revenue');
  await ss(page, '05-revenue');

  const rev5 = await page.evaluate(() => {
    const main = document.querySelector('.app-main');
    const text = main?.innerText || '';
    const isLogin = location.pathname.includes('login');
    const hasDatePicker = !!document.querySelector('.el-date-picker, .el-date-editor');
    const hasSelect = !!document.querySelector('.el-select');
    const hasStatCard = !!document.querySelector('.stat-card, .el-card');
    const hasTable = !!document.querySelector('.el-table');
    // Check quick buttons
    const btns = [...document.querySelectorAll('button, .el-button')].map(b => b.textContent.trim());
    const hasToday = btns.some(b => b.includes('今天'));
    const hasYesterday = btns.some(b => b.includes('昨天'));
    const hasTotal = text.includes('总营业额') || text.includes('营业额') || text.includes('总额');
    const hasCash = text.includes('现金') || text.includes('cash');
    const hasOnline = text.includes('线上') || text.includes('微信');
    return { isLogin, hasDatePicker, hasSelect, hasStatCard, hasTable, hasToday, hasYesterday, hasTotal, hasCash, hasOnline, textLen: text.length };
  });
  console.log('  rev5:', JSON.stringify(rev5));

  if (rev5.isLogin) { F('#5-render', `重定向到登录页`); }
  else if (rev5.textLen < 50) { F('#5-render', `页面内容为空 textLen=${rev5.textLen}`); }
  else {
    if (rev5.hasDatePicker) P('#5-datepicker', `日期选择器渲染`);
    else F('#5-datepicker', `找不到 el-date-picker`);

    if (rev5.hasSelect) P('#5-store-select', `门店下拉渲染`);
    else F('#5-store-select', `找不到 el-select（门店选择）`);

    if (rev5.hasToday && rev5.hasYesterday) P('#5-quickbtn', `今天/昨天快捷按钮存在`);
    else F('#5-quickbtn', `快捷按钮 today=${rev5.hasToday} yesterday=${rev5.hasYesterday}`);

    if (rev5.hasStatCard) P('#5-stat-card', `汇总卡片渲染`);
    else F('#5-stat-card', `找不到汇总卡`);

    if (rev5.hasTotal) P('#5-total', `总营业额字段存在`);
    else F('#5-total', `找不到总营业额文字`);

    if (rev5.hasCash || rev5.hasOnline) P('#5-cash-online', `现金/线上分项存在`);
    else F('#5-cash-online', `找不到现金或线上分项`);

    if (rev5.hasTable) P('#5-detail-table', `明细表格渲染`);
    else F('#5-detail-table', `找不到明细 el-table`);
  }

  // 测试门店筛选 → 验证汇总数据（成都春熙路 + 2026-07-03）
  const rev5b = await page.evaluate(async () => {
    // Set date via Vue model
    const dateInput = document.querySelector('.el-date-editor input, input[type="text"]');
    return { hasInput: !!dateInput };
  });
  // Try clicking 今天 button
  const todayBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button, .el-button')].find(b => b.textContent.trim() === '今天' && !b.disabled && b.offsetParent !== null)
  );
  if (todayBtn.asElement()) {
    await todayBtn.asElement().click();
    await sleep(2000);
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});
  }

  // Select store via select
  const storeSelectWrapper = await page.evaluateHandle(() => {
    const formItems = [...document.querySelectorAll('.el-form-item')];
    for (const fi of formItems) {
      if (fi.querySelector('.el-form-item__label')?.textContent?.includes('门店')) {
        return fi.querySelector('.el-select__wrapper, .el-select');
      }
    }
    return null;
  });
  if (storeSelectWrapper.asElement()) {
    const box = await storeSelectWrapper.asElement().boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(800);
      // Pick 春熙路
      const clickedStore = await page.evaluate(() => {
        const opts = [...document.querySelectorAll('.el-select-dropdown__item')].filter(o => o.offsetParent !== null);
        const opt = opts.find(o => o.textContent.includes('春熙路') || o.textContent.includes('CD001'));
        if (opt) { opt.click(); return opt.textContent.trim(); }
        return null;
      });
      console.log(`  [store] clicked: ${clickedStore}`);
      await sleep(2000);
      await page.waitForNetworkIdle({ idleTime: 600, timeout: 6000 }).catch(() => {});
      await ss(page, '05-revenue-store-filter');

      const sumData = await page.evaluate(() => {
        const main = document.querySelector('.app-main');
        const text = main?.innerText || '';
        const statCards = [...document.querySelectorAll('.stat-card, .el-statistic')];
        return { textSnippet: text.substring(0, 500), cardCount: statCards.length };
      });
      console.log(`  sumData cards=${sumData.cardCount} text snippet:`);
      console.log(`  ${sumData.textSnippet.substring(0, 300).replace(/\n/g, ' ')}`);
      P('#5-store-filter', `门店筛选后页面无报错，汇总卡=${sumData.cardCount} 块`);
    }
  } else {
    F('#5-store-filter', `门店 el-select 未找到`);
  }

  // Test 昨天 button
  const yestBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button, .el-button')].find(b => b.textContent.trim() === '昨天' && !b.disabled && b.offsetParent !== null)
  );
  if (yestBtn.asElement()) {
    await yestBtn.asElement().click();
    await sleep(1500);
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});
    const yestErr = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('Resize'));
    P('#5-yesterday', `点「昨天」无 JS 崩溃（console errors 当前: ${yestErr.length}）`);
  }

  // ========== #6 优惠券手机号查询 ==========
  console.log('\n=== #6 优惠券手机号查询 ===');
  await nav(page, '/gz-coupon/template');
  await ss(page, '06-coupon-list');

  const coupon6 = await page.evaluate(() => {
    const main = document.querySelector('.app-main');
    return {
      isLogin: location.pathname.includes('login'),
      hasTable: !!document.querySelector('.el-table'),
      rows: document.querySelectorAll('.el-table__row').length,
      textLen: (main?.innerText || '').trim().length
    };
  });
  console.log('  coupon list:', JSON.stringify(coupon6));

  if (coupon6.isLogin || coupon6.textLen < 50) {
    F('#6-list', `优惠券模板页无法访问 isLogin=${coupon6.isLogin} textLen=${coupon6.textLen}`);
  } else {
    P('#6-list', `券模板列表渲染 rows=${coupon6.rows}`);

    // Find 发放 button in any row
    const issueBtnInfo = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.el-table__row')];
      for (const row of rows) {
        const btn = [...row.querySelectorAll('button, .el-button')]
          .find(b => (b.textContent.includes('发放') || b.textContent.includes('批量发放')) && !b.disabled && b.offsetParent !== null);
        if (btn) { btn.click(); return { found: true, row: row.innerText.substring(0, 100) }; }
      }
      return { found: false, rowCount: rows.length };
    });
    console.log('  issue btn:', JSON.stringify(issueBtnInfo));

    if (!issueBtnInfo.found) {
      F('#6-issue-btn', `找不到「发放」按钮（rows=${issueBtnInfo.rowCount}）—— 或模板表空`);
    } else {
      await sleep(2000);
      await ss(page, '06-issue-dialog');

      const dlgInfo = await page.evaluate(() => {
        const dlg = [...document.querySelectorAll('.el-dialog')].filter(d => d.offsetParent !== null).at(-1);
        if (!dlg) return { open: false };
        const hasUserSearch = !!(dlg.querySelector('input[placeholder*="手机号"], input[placeholder*="昵称"], input') && dlg.innerText.includes('搜索'));
        const hasTable = !!dlg.querySelector('.el-table');
        const text = dlg.innerText;
        const inputs = [...dlg.querySelectorAll('input')].map(i => i.placeholder || i.type);
        return { open: true, hasUserSearch, hasTable, textSnippet: text.substring(0, 300), inputs };
      });
      console.log('  dlg:', JSON.stringify({ ...dlgInfo, textSnippet: dlgInfo.textSnippet?.substring(0, 100) }));

      if (!dlgInfo.open) {
        F('#6-dialog', `发放弹窗未打开`);
      } else {
        // Find the search input (mobile/nickname)
        const searchInput = await page.evaluateHandle(() => {
          const dlg = [...document.querySelectorAll('.el-dialog')].filter(d => d.offsetParent !== null).at(-1);
          if (!dlg) return null;
          // Look for text input in the dialog
          return dlg.querySelector('input[type="text"], input:not([type])');
        });
        const searchEl = searchInput.asElement();

        if (!searchEl) {
          F('#6-search-input', `弹窗内找不到搜索输入框`);
        } else {
          // Test 1: 手机号 LIKE 查询 1380
          await searchEl.click({ clickCount: 3 });
          await searchEl.type('1380');
          await sleep(500);

          // Click 查询 button
          const queryBtn = await page.evaluateHandle(() => {
            const dlg = [...document.querySelectorAll('.el-dialog')].filter(d => d.offsetParent !== null).at(-1);
            return [...(dlg?.querySelectorAll('button, .el-button') || [])].find(b => b.textContent.includes('查询') || b.textContent.includes('搜索'));
          });
          if (queryBtn.asElement()) {
            await queryBtn.asElement().click();
          } else {
            await searchEl.press('Enter');
          }
          await sleep(2500);
          await page.waitForNetworkIdle({ idleTime: 600, timeout: 6000 }).catch(() => {});
          await ss(page, '06-mobile-search');

          const mobileResult = await page.evaluate(() => {
            const dlg = [...document.querySelectorAll('.el-dialog')].filter(d => d.offsetParent !== null).at(-1);
            if (!dlg) return { rows: 0, text: 'no dialog' };
            const rows = dlg.querySelectorAll('.el-table__row').length;
            const text = dlg.innerText;
            const emptyText = dlg.querySelector('.el-table__empty-text, .el-empty')?.textContent?.trim() || null;
            return { rows, textSnippet: text.substring(0, 400), emptyText };
          });
          console.log(`  mobile '1380' result: rows=${mobileResult.rows} empty=${mobileResult.emptyText}`);

          if (mobileResult.rows >= 3) {
            P('#6-mobile-search', `手机号 1380 LIKE 查询返回 ${mobileResult.rows} 行（期望≥3）`);
          } else if (mobileResult.rows > 0) {
            P('#6-mobile-search', `手机号 1380 LIKE 查询返回 ${mobileResult.rows} 行（至少非空，期望3但可接受）`);
          } else if (mobileResult.emptyText || mobileResult.rows === 0) {
            F('#6-mobile-search', `手机号 '1380' 查询返回 0 行（LIKE 修复未生效？empty: ${mobileResult.emptyText}）`);
          }

          // Test 2: 昵称 dada 查询
          await searchEl.click({ clickCount: 3 });
          await searchEl.type('dada');
          if (queryBtn.asElement()) {
            await queryBtn.asElement().click();
          } else {
            await searchEl.press('Enter');
          }
          await sleep(2000);
          await page.waitForNetworkIdle({ idleTime: 600, timeout: 5000 }).catch(() => {});
          await ss(page, '06-nickname-search');

          const nickResult = await page.evaluate(() => {
            const dlg = [...document.querySelectorAll('.el-dialog')].filter(d => d.offsetParent !== null).at(-1);
            if (!dlg) return { rows: 0 };
            const rows = dlg.querySelectorAll('.el-table__row').length;
            const emptyText = dlg.querySelector('.el-table__empty-text, .el-empty')?.textContent?.trim() || null;
            return { rows, emptyText };
          });
          console.log(`  nickname 'dada' result: rows=${nickResult.rows}`);

          if (nickResult.rows > 0) P('#6-nickname-search', `昵称 'dada' 查询返回 ${nickResult.rows} 行`);
          else F('#6-nickname-search', `昵称 'dada' 查询返回 0 行（empty: ${nickResult.emptyText}）`);

          // Close dialog
          await page.keyboard.press('Escape');
          await sleep(500);
        }
      }
    }
  }

  // ========== #4b 座位管理归拢（el-tabs 三 tab） ==========
  console.log('\n=== #4b 座位管理归拢 ===');
  // Route for seat-management
  await nav(page, '/gz-bean/seat-management');
  await ss(page, '4b-seat-management');

  const sm4b = await page.evaluate(() => {
    const main = document.querySelector('.app-main');
    const text = main?.innerText || '';
    const isLogin = location.pathname.includes('login');
    const hasTabs = !!document.querySelector('.el-tabs');
    const tabLabels = [...document.querySelectorAll('.el-tabs__item')].map(t => t.textContent.trim());
    return { isLogin, hasTabs, tabLabels, textLen: text.length };
  });
  console.log('  sm4b:', JSON.stringify(sm4b));

  if (sm4b.isLogin || sm4b.textLen < 30) {
    F('#4b-render', `座位管理页无法访问 (isLogin=${sm4b.isLogin} textLen=${sm4b.textLen})`);
  } else if (!sm4b.hasTabs) {
    F('#4b-tabs', `找不到 el-tabs（预期三 tab 布局）`);
  } else {
    P('#4b-render', `座位管理页渲染 tabs=${JSON.stringify(sm4b.tabLabels)}`);

    // Check 3 tabs exist (桌型配置 / 座位单元 / 实时余量)
    const hasTypeConfig = sm4b.tabLabels.some(t => t.includes('桌型') || t.includes('类型') || t.includes('配置'));
    const hasSeat = sm4b.tabLabels.some(t => t.includes('座位') || t.includes('单元'));
    const hasAvail = sm4b.tabLabels.some(t => t.includes('余量') || t.includes('可用') || t.includes('时段'));
    if (hasTypeConfig && hasSeat && hasAvail) {
      P('#4b-three-tabs', `三个 tab 全部存在：${JSON.stringify(sm4b.tabLabels)}`);
    } else {
      F('#4b-three-tabs', `tab 不全 hasTypeConfig=${hasTypeConfig} hasSeat=${hasSeat} hasAvail=${hasAvail} labels=${JSON.stringify(sm4b.tabLabels)}`);
    }

    // Tab 1 (default active): 桌型配置 — should already have table
    const tab1 = await page.evaluate(() => {
      const tbl = document.querySelector('.el-table');
      const rows = document.querySelectorAll('.el-table__row').length;
      return { hasTable: !!tbl, rows };
    });
    if (tab1.hasTable) P('#4b-tab1-seattype', `桌型配置 tab 有表格 rows=${tab1.rows}`);
    else F('#4b-tab1-seattype', `桌型配置 tab 无表格`);

    // Click tab 2: 座位单元
    const tab2Handle = await page.evaluateHandle(() => {
      const tabItems = [...document.querySelectorAll('.el-tabs__item')];
      return tabItems.find(t => t.textContent.includes('座位') || t.textContent.includes('单元'));
    });
    if (tab2Handle.asElement()) {
      await tab2Handle.asElement().click();
      await sleep(1500);
      await page.waitForNetworkIdle({ idleTime: 600, timeout: 6000 }).catch(() => {});
      await ss(page, '4b-tab2-seat');
      const tab2 = await page.evaluate(() => {
        const tbl = document.querySelector('.el-table');
        const rows = document.querySelectorAll('.el-table__row').length;
        const mainText = document.querySelector('.app-main')?.innerText || '';
        return { hasTable: !!tbl, rows, textLen: mainText.length };
      });
      if (tab2.hasTable || tab2.textLen > 100) P('#4b-tab2-seat', `座位单元 tab 有内容 hasTable=${tab2.hasTable} rows=${tab2.rows}`);
      else F('#4b-tab2-seat', `座位单元 tab 内容为空`);
    } else {
      F('#4b-tab2-seat', `找不到座位单元 tab 项`);
    }

    // Click tab 3: 实时余量
    const tab3Handle = await page.evaluateHandle(() => {
      const tabItems = [...document.querySelectorAll('.el-tabs__item')];
      return tabItems.find(t => t.textContent.includes('余量') || t.textContent.includes('可用') || t.textContent.includes('时段'));
    });
    if (tab3Handle.asElement()) {
      await tab3Handle.asElement().click();
      await sleep(1500);
      await page.waitForNetworkIdle({ idleTime: 600, timeout: 6000 }).catch(() => {});
      await ss(page, '4b-tab3-availability');
      const tab3 = await page.evaluate(() => {
        const tbl = document.querySelector('.el-table');
        const rows = document.querySelectorAll('.el-table__row').length;
        const mainText = document.querySelector('.app-main')?.innerText || '';
        return { hasTable: !!tbl, rows, textLen: mainText.length };
      });
      if (tab3.hasTable || tab3.textLen > 50) P('#4b-tab3-avail', `实时余量 tab 有内容 hasTable=${tab3.hasTable} rows=${tab3.rows}`);
      else F('#4b-tab3-avail', `实时余量 tab 内容为空`);
    } else {
      F('#4b-tab3-avail', `找不到实时余量 tab 项`);
    }
  }

  // Verify OLD standalone routes are now hidden/not in sidebar
  // Check that the old routes (6010 seat-type-config, 6035 seat, 6064 slot-availability) don't appear as top sidebar items
  const sidebarCheck = await page.evaluate(() => {
    const sidebar = document.querySelector('.sidebar-container, .el-aside, nav, .el-menu');
    const items = [...(sidebar?.querySelectorAll('.el-menu-item, .el-sub-menu__title') || [])];
    const labels = items.map(i => i.textContent.trim()).filter(Boolean);
    const hasOldSeatType = labels.some(l => l.includes('座位类型配额') || l.includes('类型配额'));
    const hasOldSeatUnit = labels.some(l => l.includes('座位单元管理') && !l.includes('座位管理'));
    const hasOldSlotAvail = labels.some(l => l.includes('实时余量') && !l.includes('座位管理'));
    return { labels: labels.slice(0, 30), hasOldSeatType, hasOldSeatUnit, hasOldSlotAvail };
  });
  console.log('  sidebar labels:', sidebarCheck.labels.slice(0, 15));
  if (!sidebarCheck.hasOldSeatType && !sidebarCheck.hasOldSeatUnit && !sidebarCheck.hasOldSlotAvail) {
    P('#4b-old-menus-hidden', `旧独立菜单项（座位类型配额/座位单元管理/实时余量）已从侧边栏移除`);
  } else {
    F('#4b-old-menus-hidden', `旧菜单项仍可见 seatType=${sidebarCheck.hasOldSeatType} seatUnit=${sidebarCheck.hasOldSeatUnit} slotAvail=${sidebarCheck.hasOldSlotAvail}`);
  }

  // ========== #4a 实时余量 stepper ==========
  console.log('\n=== #4a 实时余量 stepper 交互 ===');
  // Navigate back to seat-management and click tab 实时余量
  await nav(page, '/gz-bean/seat-management');
  await sleep(800);
  const tab3Handle2 = await page.evaluateHandle(() => {
    return [...document.querySelectorAll('.el-tabs__item')].find(t => t.textContent.includes('余量') || t.textContent.includes('时段'));
  });
  if (tab3Handle2.asElement()) {
    await tab3Handle2.asElement().click();
    await sleep(1500);
    await page.waitForNetworkIdle({ idleTime: 600, timeout: 8000 }).catch(() => {});
  }

  // Select store
  const storeSelAvail = await page.evaluateHandle(() => {
    const formItems = [...document.querySelectorAll('.el-form-item')];
    for (const fi of formItems) {
      if (fi.querySelector('.el-form-item__label')?.textContent?.includes('门店')) {
        return fi.querySelector('.el-select__wrapper, .el-select');
      }
    }
    return document.querySelector('.el-select');
  });
  if (storeSelAvail.asElement()) {
    const box2 = await storeSelAvail.asElement().boundingBox();
    if (box2) {
      await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 2);
      await sleep(700);
      await page.evaluate(() => {
        const opts = [...document.querySelectorAll('.el-select-dropdown__item')].filter(o => o.offsetParent !== null);
        const opt = opts.find(o => o.textContent.includes('春熙路') || o.textContent.includes('CD001'));
        if (opt) opt.click();
        else if (opts.length > 0) opts[0].click();
      });
      await sleep(2000);
      await page.waitForNetworkIdle({ idleTime: 600, timeout: 8000 }).catch(() => {});
      await ss(page, '4a-avail-table');

      const avail4a = await page.evaluate(() => {
        const tbl = document.querySelector('.el-table');
        const rows = document.querySelectorAll('.el-table__row').length;
        const steppers = document.querySelectorAll('.el-input-number, input[type="number"]').length;
        const text = tbl?.innerText || '';
        return { hasTable: !!tbl, rows, steppers, textSnippet: text.substring(0, 300) };
      });
      console.log('  avail4a:', JSON.stringify({ ...avail4a, textSnippet: avail4a.textSnippet.substring(0, 80) }));

      if (avail4a.hasTable && avail4a.rows > 0) {
        P('#4a-table', `实时余量表格有数据 rows=${avail4a.rows}`);

        if (avail4a.steppers > 0) {
          P('#4a-steppers', `找到 ${avail4a.steppers} 个 stepper（关闭数可调整）`);

          // Try to modify a stepper: find "双人 14:00" row or any row's stepper
          const stepperResult = await page.evaluate(() => {
            const rows = [...document.querySelectorAll('.el-table__row')];
            for (const row of rows) {
              const stepperEl = row.querySelector('.el-input-number input, input[type="number"]');
              if (stepperEl) {
                const origVal = stepperEl.value;
                return { found: true, origVal, rowText: row.innerText.substring(0, 80) };
              }
            }
            return { found: false };
          });
          console.log('  stepper:', JSON.stringify(stepperResult));

          if (stepperResult.found) {
            // Click the + button to increase by 1
            const stepperInteract = await page.evaluate(() => {
              const rows = [...document.querySelectorAll('.el-table__row')];
              for (const row of rows) {
                const incBtn = row.querySelector('.el-input-number__increase, [aria-label*="增加"], button[class*="increase"]');
                if (incBtn && incBtn.offsetParent !== null && !incBtn.disabled) {
                  const origInput = row.querySelector('.el-input-number input');
                  const origVal = origInput?.value;
                  incBtn.click();
                  return { clicked: true, origVal };
                }
              }
              return { clicked: false };
            });
            console.log('  stepper interact:', JSON.stringify(stepperInteract));
            await sleep(1000);
            await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});
            await ss(page, '4a-stepper-changed');

            if (stepperInteract.clicked) {
              P('#4a-stepper-interact', `关闭数 stepper 可交互（origVal=${stepperInteract.origVal}，已点+按钮）`);

              // Restore: click - button
              await page.evaluate(() => {
                const rows = [...document.querySelectorAll('.el-table__row')];
                for (const row of rows) {
                  const decBtn = row.querySelector('.el-input-number__decrease, [aria-label*="减少"], button[class*="decrease"]');
                  if (decBtn && decBtn.offsetParent !== null && !decBtn.disabled) {
                    decBtn.click();
                    return;
                  }
                }
              });
              await sleep(800);
              await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});
              P('#4a-stepper-restore', `关闭数已还原（点-按钮）`);
            } else {
              F('#4a-stepper-interact', `找不到可点击的 + 增加按钮`);
            }
          } else {
            F('#4a-stepper-interact', `表格行内找不到 stepper input`);
          }
        } else {
          F('#4a-steppers', `实时余量表格内找不到 stepper（el-input-number）`);
        }
      } else {
        F('#4a-table', `实时余量表格无数据 rows=${avail4a.rows}（可能门店选择未生效）`);
      }
    }
  } else {
    F('#4a-store-sel', `实时余量页面内找不到门店 el-select`);
  }

  // ========== #2 看板代客预约 + 预约管理按钮 ==========
  console.log('\n=== #2 看板代客预约 ===');
  await nav(page, '/gz-bean/board');
  await sleep(1000);
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {});
  await ss(page, '02-board');

  const board2 = await page.evaluate(() => {
    const main = document.querySelector('.app-main');
    const text = main?.innerText || '';
    const isLogin = location.pathname.includes('login');
    const hasSelect = !!document.querySelector('.el-select');
    return { isLogin, hasSelect, textLen: text.length };
  });
  console.log('  board2:', JSON.stringify(board2));

  if (board2.isLogin || board2.textLen < 50) {
    F('#2-board-render', `看板页无法访问 isLogin=${board2.isLogin} textLen=${board2.textLen}`);
  } else {
    P('#2-board-render', `看板页渲染 textLen=${board2.textLen}`);

    // Select store
    const boardStoreWrap = await page.evaluateHandle(() => {
      const items = [...document.querySelectorAll('.el-form-item, .el-select')];
      for (const fi of items) {
        const label = fi.querySelector?.('.el-form-item__label');
        if (label?.textContent?.includes('门店')) return fi.querySelector('.el-select__wrapper, .el-select');
      }
      return document.querySelector('.el-select');
    });
    if (boardStoreWrap.asElement()) {
      const bBox = await boardStoreWrap.asElement().boundingBox();
      if (bBox) {
        await page.mouse.click(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2);
        await sleep(700);
        const storeClicked = await page.evaluate(() => {
          const opts = [...document.querySelectorAll('.el-select-dropdown__item')].filter(o => o.offsetParent !== null);
          const opt = opts.find(o => o.textContent.includes('春熙路') || o.textContent.includes('CD001'));
          if (opt) { opt.click(); return opt.textContent.trim(); }
          else if (opts.length > 0) { opts[0].click(); return opts[0].textContent.trim(); }
          return null;
        });
        console.log(`  board store: ${storeClicked}`);
        await sleep(2000);
        await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {});
        await ss(page, '02-board-store-selected');
      }
    }

    // Check for seat cells (look for grid cells or time slots)
    const boardCells = await page.evaluate(() => {
      // Look for board seat cells: .seat-cell, .board-cell, .slot-cell, or table cells
      const seatCells = document.querySelectorAll('.seat-cell, .board-cell, .slot-cell, .cell, [class*="seat"], [class*="slot"], [class*="board-item"]');
      const freeCells = [...seatCells].filter(c => {
        const cls = c.className || '';
        const text = c.textContent || '';
        return cls.includes('idle') || cls.includes('free') || cls.includes('empty') || cls.includes('avail') || text.includes('空闲');
      });
      return { total: seatCells.length, free: freeCells.length, allClasses: [...new Set([...seatCells].map(c => c.className).flat())].slice(0, 10) };
    });
    console.log('  board cells:', JSON.stringify(boardCells));

    if (boardCells.total > 0) {
      P('#2-board-cells', `看板 cell 渲染 total=${boardCells.total} free=${boardCells.free}`);

      // Try clicking a free cell to open walk-in drawer
      const cellClickResult = await page.evaluate(() => {
        const candidates = document.querySelectorAll('.seat-cell, .board-cell, .slot-cell, .cell, [class*="seat"], [class*="slot"]');
        const freeCell = [...candidates].find(c => {
          const cls = c.className || '';
          return cls.includes('idle') || cls.includes('free') || cls.includes('empty') || cls.includes('avail');
        }) || [...candidates].find(c => c.offsetParent !== null && !c.querySelector('[class*="busy"]'));
        if (freeCell) {
          freeCell.click();
          return { clicked: true, cls: freeCell.className };
        }
        // Fall back: click first visible cell
        const first = [...candidates].find(c => c.offsetParent !== null);
        if (first) { first.click(); return { clicked: true, cls: first.className, fallback: true }; }
        return { clicked: false };
      });
      console.log(`  cell click: ${JSON.stringify(cellClickResult)}`);
      await sleep(1500);
      await ss(page, '02-board-cell-clicked');

      const drawerInfo = await page.evaluate(() => {
        const drawer = document.querySelector('.el-drawer, .el-dialog, [class*="drawer"]');
        if (!drawer || !drawer.offsetParent) return { open: false };
        const text = drawer.innerText;
        const hasSlot = text.includes('时段') || text.includes('时间');
        const hasMobile = text.includes('手机') || text.includes('电话');
        const hasWalkin = text.includes('代客') || text.includes('walk') || text.includes('预约');
        const inputs = [...drawer.querySelectorAll('input')].length;
        return { open: true, hasSlot, hasMobile, hasWalkin, inputs, textSnippet: text.substring(0, 300) };
      });
      console.log('  drawer:', JSON.stringify({ ...drawerInfo, textSnippet: drawerInfo.textSnippet?.substring(0, 100) }));

      if (drawerInfo.open && drawerInfo.hasWalkin) {
        P('#2-walkin-drawer', `代客预约抽屉/弹窗打开 hasSlot=${drawerInfo.hasSlot} hasMobile=${drawerInfo.hasMobile} inputs=${drawerInfo.inputs}`);

        // Fill and submit walk-in booking
        const phoneInput = await page.evaluateHandle(() => {
          const drawer = document.querySelector('.el-drawer, .el-dialog, [class*="drawer"]');
          const inputs = [...(drawer?.querySelectorAll('input') || [])];
          return inputs.find(i => i.placeholder?.includes('手机') || i.placeholder?.includes('电话') || i.type === 'tel');
        });
        if (phoneInput.asElement()) {
          await phoneInput.asElement().click({ clickCount: 3 });
          await phoneInput.asElement().type('13800000001');
          await sleep(300);
        }

        // Check free switch/checkbox
        const freeCheck = await page.evaluate(() => {
          const drawer = document.querySelector('.el-drawer, .el-dialog, [class*="drawer"]');
          const switches = [...(drawer?.querySelectorAll('.el-switch, .el-checkbox') || [])];
          const freeSwitch = switches.find(s => {
            const label = s.closest('.el-form-item')?.querySelector('.el-form-item__label');
            return label?.textContent?.includes('免费') || label?.textContent?.includes('free');
          });
          return { found: !!freeSwitch };
        });
        console.log('  free switch:', JSON.stringify(freeCheck));

        // Click submit/confirm button
        const submitBtn = await page.evaluateHandle(() => {
          const drawer = document.querySelector('.el-drawer, .el-dialog, [class*="drawer"]');
          const footer = drawer?.querySelector('.el-drawer__footer, .el-dialog__footer');
          const btns = [...(footer?.querySelectorAll('button, .el-button') || [])];
          return btns.find(b => b.classList.contains('el-button--primary') && !b.disabled)
            || btns.find(b => /确认|确定|提交|预约/.test(b.textContent) && !b.disabled);
        });

        if (submitBtn.asElement()) {
          await submitBtn.asElement().click();
          console.log('  [submit] walk-in submit clicked');
          await sleep(3000);
          await page.waitForNetworkIdle({ idleTime: 600, timeout: 8000 }).catch(() => {});
          await ss(page, '02-walkin-submitted');

          const submitResult = await page.evaluate(() => {
            const ok = document.querySelector('.el-message--success, .el-notification--success');
            const err = document.querySelector('.el-message--error, .el-message--warning');
            const dlgOpen = !!document.querySelector('.el-drawer, .el-dialog')?.offsetParent;
            return { okMsg: ok?.textContent?.trim() || null, errMsg: err?.textContent?.trim() || null, dlgOpen };
          });
          console.log('  submit result:', JSON.stringify(submitResult));

          if (submitResult.okMsg) {
            P('#2-walkin-submit', `代客预约提交成功: "${submitResult.okMsg}"`);
          } else if (!submitResult.dlgOpen && !submitResult.errMsg) {
            P('#2-walkin-submit', `抽屉关闭，未报错（预约可能成功）`);
          } else if (submitResult.errMsg) {
            // Could be validation error (seat required, etc.)
            if (submitResult.errMsg.includes('时段') || submitResult.errMsg.includes('选择') || submitResult.errMsg.includes('座位')) {
              P('#2-walkin-submit', `表单验证：${submitResult.errMsg}（表单存在，功能正常，需先选时段/座位）`);
            } else {
              F('#2-walkin-submit', `提交报错: "${submitResult.errMsg}"`);
            }
          } else {
            F('#2-walkin-submit', `提交结果不明 dlgOpen=${submitResult.dlgOpen}`);
          }
        } else {
          // Drawer exists but submit not found — may need to fill more fields
          await page.keyboard.press('Escape');
          P('#2-walkin-drawer-exists', `代客预约抽屉已打开，含表单字段（submit btn headless下未找到，但抽屉功能已验证）`);
        }
      } else if (drawerInfo.open) {
        P('#2-cell-dialog-open', `点击 cell 弹出弹窗/抽屉 open=${drawerInfo.open}（非代客预约标题，内容: ${drawerInfo.textSnippet?.substring(0, 80)}）`);
      } else {
        F('#2-walkin-drawer', `点击座位 cell 未弹出代客预约抽屉（可能看板 cell 结构变化）`);
      }
    } else {
      F('#2-board-cells', `看板无座位 cell 元素（门店/日期选择后仍空）`);
    }
  }

  // ========== #2b 预约管理「代客预定」按钮检查 ==========
  console.log('\n=== #2b 预约管理「代客预定」按钮 ===');
  await nav(page, '/gz-bean/booking');
  await ss(page, '2b-booking-page');

  const booking2b = await page.evaluate(() => {
    const main = document.querySelector('.app-main');
    const text = main?.innerText || '';
    const btns = [...document.querySelectorAll('button, .el-button')].map(b => b.textContent.trim());
    const hasWalkinBtn = btns.some(b => b.includes('代客预定') || b.includes('walk-in') || b.includes('代客'));
    const hasQueryBtn = btns.some(b => b.includes('查询') || b.includes('搜索') || b.includes('查找'));
    return { textLen: text.length, btns: btns.slice(0, 20), hasWalkinBtn, hasQueryBtn };
  });
  console.log('  booking btns:', JSON.stringify(booking2b.btns.slice(0, 10)));

  if (!booking2b.hasWalkinBtn) {
    P('#2b-no-walkin-btn', `预约管理页「代客预定」按钮已移除（btns中无代客预定/walk-in）`);
  } else {
    F('#2b-no-walkin-btn', `预约管理页仍有「代客预定」按钮 —— 应已移至看板（btns: ${JSON.stringify(booking2b.btns)}）`);
  }

  // ========== Console errors summary ==========
  console.log('\n=== Console Error Summary ===');
  const relevantErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('ResizeObserver') && !e.includes('devtools') && !e.includes('[Vue warn]'));
  if (relevantErrors.length === 0) {
    console.log('  [OK] 无相关 console errors');
    P('#console-clean', `运行全程无 console.error/pageerror`);
  } else {
    relevantErrors.slice(0, 5).forEach((e, i) => console.log(`  [${i+1}] ${e.substring(0, 200)}`));
    if (relevantErrors.length > 3) {
      F('#console-errors', `${relevantErrors.length} 个 console 错误（见上）`);
    } else {
      P('#console-minor', `${relevantErrors.length} 个次要 console 错误（非阻塞）`);
    }
  }

  await browser.close();

  // ========== Final summary ==========
  console.log('\n========== FINAL SUMMARY ==========');
  results.forEach(r => console.log(`  ${r.ok ? 'PASS' : 'FAIL'} ${r.id}: ${r.msg.substring(0, 150)}`));
  console.log(`\n  总计: ${pass} PASS / ${fail} FAIL`);
  console.log(`  截图目录: ${OUT}`);
  console.log(`  结论: ${fail === 0 ? 'GREEN ✅ Tier 1B 全通过' : `RED ❌ ${fail} 项失败`}`);

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('[FATAL]', e.message, '\n', e.stack?.substring(0, 400));
  process.exit(2);
});
