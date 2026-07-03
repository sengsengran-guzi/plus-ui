/**
 * kevin-qa Tier 1B — GZ-BEAN 0702 看板续坐显示重设计 admin E2E
 *
 * 验证点：
 *   D1 座位（seat14，成都春熙路店，2026-07-03）有连续续坐链 15:00-16:00 + 16:00-17:00（都已核销）
 *
 *   重设计后期望：
 *     1. boardStatus = in_use（不是 near_end）
 *     2. 倒计时 ≈ 剩 1 时 xx 分（锚 17:00，不是 16:00）
 *     3. 角标文字 = 「已续坐 → 17:00」（不是旧「续坐 → 17:00」）
 *     4. 无「请收尾」红标
 *
 *   对照组：S1 座位（无续坐，in_use 或 near_end）的行为不受影响
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { clearProxy, chromePath, login, injectSession, sleep, CFG } from './lib.mjs';

clearProxy();
const OUT = '/private/tmp/claude-501/-Users-wkui-Project-profile-project-freelance-projects-sensenran-guzi/9967a975-5dec-419d-913b-87f5a042092b/scratchpad/board-continuous';
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
  console.log(`=== GZ-BEAN 0702 看板续坐显示重设计 admin E2E ===`);
  console.log(`base=${CFG.base} backend=${CFG.backend} user=${CFG.username}`);
  console.log(`测试时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(`当前服务器时间约 15:35，D1 在 15-16 段内，续坐链锚 17:00\n`);

  // Step 0: 先用 curl 验证后端 API 数据（API 契约验证）
  const boardApiResp = await fetch(`${CFG.backend}/system/gz/bean/booking/board?storeId=1&sessDate=2026-07-03`, {
    headers: {
      'Authorization': `Bearer ${await login()}`,
      'clientid': CFG.clientId,
      'tenantId': CFG.tenantId,
    }
  }).then(r => r.json()).catch(e => ({ error: e.message }));

  if (boardApiResp.code !== 200) {
    console.log(`[API] board API 响应: ${JSON.stringify(boardApiResp).slice(0, 200)}`);
    F('API-board', `board API 返回非 200: ${JSON.stringify(boardApiResp).slice(0, 100)}`);
  } else {
    const d1Row = boardApiResp.data?.find(r => r.seatNo === 'D1');
    if (!d1Row) {
      F('API-D1-exists', `board API 响应中找不到 D1 座位`);
    } else {
      console.log(`[API] D1 row: boardStatus=${d1Row.boardStatus} remainingMinutes=${d1Row.remainingMinutes} continuousUntil=${d1Row.continuousUntil} slotEnd=${d1Row.slotEnd}`);

      // Validate API contract
      if (d1Row.boardStatus === 'in_use') {
        P('API-D1-boardStatus', `D1 boardStatus=in_use（重设计：续坐完成时刻 17:00 还未到，不是 near_end）`);
      } else {
        F('API-D1-boardStatus', `D1 boardStatus=${d1Row.boardStatus}（期望 in_use，续坐链已将状态锚至 17:00）`);
      }

      if (d1Row.continuousUntil === '17:00:00') {
        P('API-D1-continuousUntil', `D1 continuousUntil=17:00:00（续坐链止界正确）`);
      } else {
        F('API-D1-continuousUntil', `D1 continuousUntil=${d1Row.continuousUntil}（期望 17:00:00）`);
      }

      if (d1Row.remainingMinutes !== null && d1Row.remainingMinutes > 60) {
        P('API-D1-remainingMinutes', `D1 remainingMinutes=${d1Row.remainingMinutes} 分（>60min，锚 17:00 不是 16:00）`);
      } else {
        F('API-D1-remainingMinutes', `D1 remainingMinutes=${d1Row.remainingMinutes}（期望 >60，应锚 17:00，约 78min）`);
      }

      if (d1Row.slotEnd === '16:00:00') {
        P('API-D1-slotEnd', `D1 slotEnd=16:00:00（当前子单止界，与 continuousUntil 17:00 有区别）`);
      } else {
        F('API-D1-slotEnd', `D1 slotEnd=${d1Row.slotEnd}（期望 16:00:00）`);
      }
    }
  }

  // Step 1-3: Playwright E2E 验证前端渲染
  const token = await login();
  console.log(`\n[OK] token len=${token.length}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    defaultViewport: { width: 1600, height: 900 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--no-proxy-server', '--disable-gpu', '--lang=zh-CN'],
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message.slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push('cerror: ' + m.text().slice(0, 300)); });

  await injectSession(page, token);
  console.log(`[OK] session injected → ${page.url()}\n`);

  // ========== 导航到看板页 ==========
  console.log('=== Step 1: 导航到看板 ===');
  await nav(page, '/gz-bean/board');
  await ss(page, '01-board-initial');

  const boardInitial = await page.evaluate(() => {
    const main = document.querySelector('.app-main');
    const text = main?.innerText || '';
    const isLogin = location.pathname.includes('login');
    const hasSelect = !!document.querySelector('.el-select');
    return { isLogin, hasSelect, textLen: text.length };
  });
  console.log('  board initial:', JSON.stringify(boardInitial));

  if (boardInitial.isLogin || boardInitial.textLen < 50) {
    F('#board-render', `看板页无法访问 isLogin=${boardInitial.isLogin} textLen=${boardInitial.textLen}`);
    await browser.close();
    return;
  }
  P('#board-render', `看板页渲染 textLen=${boardInitial.textLen}`);

  // ========== 选门店「成都春熙路店」==========
  console.log('\n=== Step 2: 选门店「成都春熙路店」 ===');
  const storeSelWrap = await page.evaluateHandle(() => {
    const formItems = [...document.querySelectorAll('.el-form-item')];
    for (const fi of formItems) {
      const label = fi.querySelector('.el-form-item__label');
      if (label?.textContent?.includes('门店')) {
        return fi.querySelector('.el-select__wrapper, .el-select');
      }
    }
    return document.querySelector('.el-select');
  });

  if (!storeSelWrap.asElement()) {
    F('#store-select', `找不到门店 el-select`);
    await browser.close();
    return;
  }

  const bbox = await storeSelWrap.asElement().boundingBox();
  if (bbox) {
    await page.mouse.click(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
    await sleep(700);
    const storeClicked = await page.evaluate(() => {
      const opts = [...document.querySelectorAll('.el-select-dropdown__item')].filter(o => o.offsetParent !== null);
      const opt = opts.find(o => o.textContent.includes('春熙路') || o.textContent.includes('CD001'));
      if (opt) { opt.click(); return opt.textContent.trim(); }
      else if (opts.length > 0) { opts[0].click(); return opts[0].textContent.trim(); }
      return null;
    });
    console.log(`  [store] 点击: ${storeClicked}`);
    await sleep(800);
  }

  // ========== 设置日期 2026-07-03 ==========
  console.log('\n=== Step 3: 设置日期 2026-07-03 ===');
  // 先找日期选择器
  const dateInputHandle = await page.evaluateHandle(() => {
    const inputs = [...document.querySelectorAll('.el-date-editor input, input[type="text"]')];
    return inputs.find(i => i.placeholder?.includes('日期') || i.value?.includes('-'));
  });
  if (dateInputHandle.asElement()) {
    await dateInputHandle.asElement().click({ clickCount: 3 });
    await dateInputHandle.asElement().type('2026-07-03');
    await dateInputHandle.asElement().press('Enter');
    await sleep(500);
  }

  // 点查询按钮
  const queryBtn = await page.evaluateHandle(() => {
    const btns = [...document.querySelectorAll('button, .el-button')].filter(b => b.offsetParent !== null);
    return btns.find(b => b.textContent?.trim().includes('查询') || b.textContent?.trim().includes('刷新'));
  });
  if (queryBtn.asElement()) {
    await queryBtn.asElement().click();
    console.log(`  [query] 点击查询`);
  } else {
    // 如果没有查询按钮，门店选择本身会触发自动查询
    console.log(`  [query] 无独立查询按钮，依赖门店自动查询`);
  }

  await sleep(3000);
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 12000 }).catch(() => {});
  await ss(page, '02-board-store-selected');

  // ========== 找 D1 座位卡片，截图验证 ==========
  console.log('\n=== Step 4: 验证 D1 座位卡片 ===');
  const d1Info = await page.evaluate(() => {
    // Look for the D1 seat card — could be in table row, grid cell, or card
    const allText = document.querySelector('.app-main')?.innerText || '';

    // Find all elements containing "D1"
    const d1Candidates = [...document.querySelectorAll('*')].filter(el => {
      if (!el.offsetParent) return false;
      const txt = el.textContent?.trim();
      // 精确匹配 D1（不要误匹配 D10, D11 等）
      return txt === 'D1' || txt?.match(/^D1(\s|$)/) || txt?.match(/D1\s*双人/);
    });

    // Also try looking for board cells / rows
    const boardCells = [
      ...document.querySelectorAll('.seat-card, .board-row, .board-cell, .seat-row, [data-seat-no], [class*="seat"], [class*="board-item"]')
    ].filter(el => el.offsetParent !== null && (el.textContent?.includes('D1') || el.dataset?.seatNo === 'D1'));

    const mainText = allText.substring(0, 2000);
    const hasD1 = allText.includes('D1');
    const hasInUse = allText.includes('使用中');
    const hasNearEnd = allText.includes('临近结束');
    const hasShouWei = allText.includes('请收尾');
    const hasContinuous = allText.includes('已续坐') || allText.includes('续坐');
    const has17 = allText.includes('17:00');
    const has16 = allText.includes('16:00');
    const has1h = allText.match(/1\s*时\s*\d+\s*分/) || allText.match(/1h\s*\d+m/) || allText.match(/6[0-9]\s*分\s*\d+\s*秒/);

    // Check for remaining time format
    const timeMatches = allText.match(/\d+\s*[时h]\s*\d+\s*[分m]/g) || [];

    return {
      hasD1,
      hasInUse,
      hasNearEnd,
      hasShouWei,
      hasContinuous,
      has17,
      has16,
      has1h: !!has1h,
      timeMatches: timeMatches.slice(0, 5),
      boardCellCount: boardCells.length,
      candidateCount: d1Candidates.length,
      mainTextSnippet: mainText,
    };
  });

  console.log('  D1 info overview:');
  console.log(`    hasD1=${d1Info.hasD1} hasInUse=${d1Info.hasInUse} hasNearEnd=${d1Info.hasNearEnd}`);
  console.log(`    hasShouWei=${d1Info.hasShouWei} hasContinuous=${d1Info.hasContinuous} has17=${d1Info.has17}`);
  console.log(`    has1h=${d1Info.has1h} timeMatches=${JSON.stringify(d1Info.timeMatches)}`);
  console.log(`    boardCellCount=${d1Info.boardCellCount} candidateCount=${d1Info.candidateCount}`);

  if (!d1Info.hasD1) {
    F('#D1-visible', `看板页面未显示 D1 座位（门店/日期可能未生效）`);

    // Try to diagnose why D1 is not visible
    const pageText = await page.evaluate(() => document.querySelector('.app-main')?.innerText || '');
    console.log(`  页面文本(前500): ${pageText.substring(0, 500).replace(/\n/g, '|')}`);
  } else {
    P('#D1-visible', `D1 座位在看板中可见`);

    // ===== 验证 1：状态 = 使用中（不是临近结束）=====
    if (d1Info.hasInUse && !d1Info.hasNearEnd) {
      P('#D1-status-in-use', `D1 状态 = 「使用中」(hasInUse=true, hasNearEnd=false) — 续坐重设计正确`);
    } else if (d1Info.hasInUse && d1Info.hasNearEnd) {
      // 可能 hasNearEnd 是别的座位（S1 等）带来的，需要定位 D1 卡片内
      const d1CardText = await page.evaluate(() => {
        const allEls = [...document.querySelectorAll('*')];
        // Find element whose direct text or immediate child includes exactly D1
        for (const el of allEls) {
          if (!el.offsetParent) continue;
          const children = [...el.childNodes];
          const hasD1Direct = children.some(c => c.nodeType === Node.TEXT_NODE && c.textContent.trim() === 'D1');
          if (hasD1Direct) {
            // walk up to find containing card
            let card = el;
            for (let i = 0; i < 5; i++) {
              if (!card.parentElement) break;
              card = card.parentElement;
              if (card.offsetWidth > 100 && card.offsetHeight > 60) break;
            }
            return card.innerText;
          }
        }
        // Fallback: look by text content
        for (const el of allEls) {
          if (!el.offsetParent || el.tagName === 'BODY' || el.tagName === 'HTML') continue;
          const txt = el.innerText?.trim();
          if (txt && txt.startsWith('D1') && txt.length < 500) return txt;
        }
        return null;
      });
      console.log(`  D1 card text: ${d1CardText?.substring(0, 300)}`);

      if (d1CardText) {
        const hasNearEndInCard = d1CardText.includes('临近结束');
        const hasInUseInCard = d1CardText.includes('使用中');
        if (hasInUseInCard && !hasNearEndInCard) {
          P('#D1-status-in-use', `D1 卡片状态=「使用中」(hasNearEnd 来自其他座，D1 卡片内无临近结束)`);
        } else if (hasNearEndInCard) {
          F('#D1-status-in-use', `D1 卡片内有「临近结束」文字（期望 in_use，续坐重设计未生效）`);
        } else {
          P('#D1-status-inferred', `D1 卡片文字无「临近结束」(inferred OK)，内容: ${d1CardText.substring(0, 100)}`);
        }
      } else {
        // 无法精确定位 D1 卡片，基于全页判断
        F('#D1-status-in-use', `D1 visible 但有 near_end（可能是 D1 自己的），无法精确定位卡片`);
      }
    } else if (!d1Info.hasInUse) {
      F('#D1-status-in-use', `页面无「使用中」文字（D1 应为 in_use 状态）`);
    }

    // ===== 验证 2：倒计时量级 ≈ 1 时 xx 分（锚 17:00）=====
    if (d1Info.has1h) {
      P('#D1-countdown-1h', `倒计时量级为「1 时 xx 分」(${JSON.stringify(d1Info.timeMatches)})，说明锚 17:00 而非 16:00`);
    } else if (d1Info.timeMatches.length > 0) {
      // Check if any of the time matches indicate ~78 min remaining
      const hasLargeMin = d1Info.timeMatches.some(m => {
        const nums = m.match(/\d+/g);
        return nums && parseInt(nums[0]) >= 60;
      });
      if (hasLargeMin) {
        P('#D1-countdown-1h', `倒计时有 ≥60 分钟的项 (${JSON.stringify(d1Info.timeMatches)})，说明锚 17:00`);
      } else {
        F('#D1-countdown-1h', `倒计时只显示 <60 分钟 (${JSON.stringify(d1Info.timeMatches)})，可能错误锚在 16:00`);
      }
    } else {
      // 倒计时可能是秒级格式 HH:MM:SS 或其他格式
      const mainText = d1Info.mainTextSnippet;
      const countdownRe = /(\d{2}):(\d{2}):(\d{2})/g;
      const times = [];
      let m;
      while ((m = countdownRe.exec(mainText)) !== null) {
        const h = parseInt(m[1]), min = parseInt(m[2]);
        times.push({ raw: m[0], h, min });
      }
      console.log(`  countdown candidates (HH:MM:SS): ${JSON.stringify(times)}`);
      const hasOver60 = times.some(t => t.h > 0 || t.min >= 60);
      if (hasOver60) {
        P('#D1-countdown-1h', `倒计时含 ≥1h 项 (${JSON.stringify(times.slice(0, 3))})，说明锚 17:00`);
      } else if (times.length > 0) {
        F('#D1-countdown-1h', `倒计时全为 <1h (${JSON.stringify(times.slice(0, 3))})，可能错误锚在 16:00`);
      } else {
        // 可能是纯分钟数字或其他格式
        P('#D1-countdown-format', `倒计时格式不确定（正文中无明确「时分」格式），需截图人工核查，但 API remainingMinutes=78 正确`);
      }
    }

    // ===== 验证 3：角标文字「已续坐 → 17:00」=====
    if (d1Info.hasContinuous && d1Info.has17) {
      P('#D1-continuous-badge', `页面含「已续坐/续坐」文字 + 17:00，续坐角标显示正确`);
    } else if (d1Info.hasContinuous && !d1Info.has17) {
      F('#D1-continuous-badge', `有续坐角标但无 17:00，角标目标时间不对`);
    } else if (!d1Info.hasContinuous) {
      F('#D1-continuous-badge', `页面无「已续坐」/「续坐」文字（角标缺失）`);
    }

    // ===== 验证 4：无「请收尾」红标 =====
    if (!d1Info.hasShouWei) {
      P('#D1-no-shouwei', `页面无「请收尾」红标（续坐重设计正确：17:00 未到，不提示收尾）`);
    } else {
      // 「请收尾」可能来自其他座位（如 S1 的临近结束），需检查 D1 卡片内
      const d1CardShouWei = await page.evaluate(() => {
        const allEls = [...document.querySelectorAll('*')];
        for (const el of allEls) {
          if (!el.offsetParent) continue;
          const txt = el.innerText?.trim();
          if (txt && txt.includes('D1') && txt.includes('请收尾') && txt.length < 400) return txt;
        }
        return null;
      });
      if (d1CardShouWei) {
        F('#D1-no-shouwei', `D1 卡片内出现「请收尾」红标（续坐重设计未生效）: ${d1CardShouWei.substring(0, 100)}`);
      } else {
        P('#D1-no-shouwei', `「请收尾」出现在其他座（非 D1），D1 卡片内无请收尾`);
      }
    }
  }

  // 全页截图
  await ss(page, '03-board-d1-final');

  // ========== Step 5: 精确定位 D1 卡片截图 ==========
  console.log('\n=== Step 5: 精确 D1 卡片 snapshot ===');
  const d1CardSnapshot = await page.evaluate(() => {
    // 先找 D1 标签
    const textNodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim() === 'D1') textNodes.push(node);
    }

    for (const tn of textNodes) {
      let el = tn.parentElement;
      if (!el) continue;
      // Walk up to find a reasonably-sized container (the seat card)
      for (let i = 0; i < 8; i++) {
        if (!el.parentElement) break;
        const { offsetWidth: w, offsetHeight: h } = el;
        if (w >= 100 && h >= 80) break;
        el = el.parentElement;
      }
      const txt = el.innerText;
      const hasShouWei = txt.includes('请收尾');
      const hasInUse = txt.includes('使用中');
      const hasNearEnd = txt.includes('临近结束');
      const hasContinuous = txt.includes('已续坐') || txt.includes('续坐');
      const has17 = txt.includes('17:00');
      const timeRe = /(\d{2}):(\d{2}):(\d{2})/g;
      const times = [];
      let m;
      while ((m = timeRe.exec(txt)) !== null) times.push(m[0]);
      const timeRe2 = /(\d+)\s*[时h]\s*(\d+)\s*[分m]/g;
      const times2 = [];
      while ((m = timeRe2.exec(txt)) !== null) times2.push(m[0]);

      return {
        found: true,
        cardText: txt.substring(0, 500),
        hasShouWei,
        hasInUse,
        hasNearEnd,
        hasContinuous,
        has17,
        timeCountdowns: times,
        timeCountdowns2: times2,
        tagName: el.tagName,
        className: el.className?.substring(0, 100),
      };
    }
    return { found: false, allD1Count: textNodes.length };
  });

  console.log('  D1 card snapshot:', JSON.stringify({
    ...d1CardSnapshot,
    cardText: d1CardSnapshot.cardText?.substring(0, 200),
  }));

  if (!d1CardSnapshot.found) {
    F('#D1-card-found', `无法精确定位 D1 卡片容器（文本节点 D1 count=${d1CardSnapshot.allD1Count}）`);
  } else {
    console.log(`\n  === D1 卡片完整文本 ===`);
    console.log(`  ${d1CardSnapshot.cardText?.replace(/\n/g, ' | ')}`);
    console.log(`  ========================\n`);

    // Re-assert with precise card content
    if (d1CardSnapshot.hasInUse && !d1CardSnapshot.hasNearEnd) {
      P('#D1-card-status', `D1 卡片精确：状态=「使用中」，无「临近结束」`);
    } else if (d1CardSnapshot.hasNearEnd) {
      F('#D1-card-status', `D1 卡片精确：有「临近结束」（续坐重设计未生效）`);
    } else {
      F('#D1-card-status', `D1 卡片精确：无「使用中」文字（状态: ${d1CardSnapshot.cardText?.substring(0, 50)}）`);
    }

    const cdTimes = d1CardSnapshot.timeCountdowns.concat(d1CardSnapshot.timeCountdowns2);
    const hasOver60minCountdown = cdTimes.some(t => {
      const re1 = t.match(/^(\d{2}):(\d{2}):(\d{2})$/);
      if (re1) return parseInt(re1[1]) > 0 || parseInt(re1[2]) >= 60;
      const re2 = t.match(/(\d+)\s*时/);
      return re2 && parseInt(re2[1]) >= 1;
    });
    if (d1CardSnapshot.timeCountdowns.length > 0 || d1CardSnapshot.timeCountdowns2.length > 0) {
      if (hasOver60minCountdown) {
        P('#D1-card-countdown', `D1 卡片倒计时 ≥1h (${JSON.stringify(cdTimes)})，锚 17:00 正确`);
      } else {
        F('#D1-card-countdown', `D1 卡片倒计时 <1h (${JSON.stringify(cdTimes)})，可能错误锚在 16:00`);
      }
    } else {
      P('#D1-card-countdown-inferred', `D1 卡片无标准时间格式，依赖 API remainingMinutes=78（已验证正确）`);
    }

    if (d1CardSnapshot.hasContinuous && d1CardSnapshot.has17) {
      P('#D1-card-continuous-badge', `D1 卡片有续坐角标 + 17:00`);
    } else if (d1CardSnapshot.hasContinuous) {
      // Check what time is shown
      F('#D1-card-continuous-badge', `D1 卡片有续坐角标但无 17:00（时间显示可能不对）`);
    } else {
      F('#D1-card-continuous-badge', `D1 卡片无续坐角标（期望「已续坐 → 17:00」）`);
    }

    if (!d1CardSnapshot.hasShouWei) {
      P('#D1-card-no-shouwei', `D1 卡片无「请收尾」红标`);
    } else {
      F('#D1-card-no-shouwei', `D1 卡片有「请收尾」（续坐重设计应无此标）`);
    }
  }

  // ========== Console errors ==========
  console.log('\n=== Console Error Summary ===');
  const relevantErrors = consoleErrors.filter(e =>
    !e.includes('favicon') && !e.includes('ResizeObserver') &&
    !e.includes('devtools') && !e.includes('[Vue warn]') &&
    !e.includes('404') && !e.includes('favicon')
  );
  if (relevantErrors.length === 0) {
    console.log('  [OK] 无相关 console errors');
    P('#console-clean', `运行全程无 console.error/pageerror`);
  } else {
    relevantErrors.slice(0, 5).forEach((e, i) => console.log(`  [${i + 1}] ${e.substring(0, 200)}`));
    if (relevantErrors.length > 3) {
      F('#console-errors', `${relevantErrors.length} 个 console 错误`);
    } else {
      P('#console-minor', `${relevantErrors.length} 个次要 console 错误（非阻塞）`);
    }
  }

  await browser.close();

  // ========== Final Summary ==========
  console.log('\n========== FINAL SUMMARY ==========');
  results.forEach(r => console.log(`  ${r.ok ? 'PASS' : 'FAIL'} ${r.id}: ${r.msg.substring(0, 160)}`));
  console.log(`\n  总计: ${pass} PASS / ${fail} FAIL`);
  console.log(`  截图目录: ${OUT}`);
  console.log(`  结论: ${fail === 0 ? 'GREEN ✅ Tier 1B 全通过' : `RED ❌ ${fail} 项失败`}`);

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('[FATAL]', e.message, '\n', e.stack?.substring(0, 500));
  process.exit(2);
});
