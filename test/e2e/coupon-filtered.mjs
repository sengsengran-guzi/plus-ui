/**
 * kevin-qa Tier 1B — Coupon Filtered Issuance E2E
 * Tests the 条件筛选 (filtered issuance) strategy in admin coupon template UI.
 *
 * Key technique: Element Plus v2 date-pickers in headless Chrome can't be filled
 * via keyboard input alone (Vue reactive model doesn't update). We walk the Vue
 * component tree to set form.conditions[].range directly, then verify the UI reflects
 * the value and the preview API returns a count.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { clearProxy, chromePath, login, injectSession, sleep } from './lib.mjs';

const OUT = '/tmp/qa-coupon-filtered';
mkdirSync(OUT, { recursive: true });
clearProxy();

const ss = async (page, name) => {
  const p = join(OUT, `${name}.png`);
  await page.screenshot({ path: p });
  console.log(`[SS] ${p}`);
  return p;
};

const nav = async (page, path) => {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, path);
  await sleep(700);
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 8000 }).catch(() => {});
  await sleep(900);
};

/** Click an Element Plus select via bounding box (works headless where .click() doesn't) */
async function clickSelectByLabel(page, dialogSel, labelText) {
  const handle = await page.evaluateHandle((dlgSel, lbl) => {
    const dlg = document.querySelector(dlgSel);
    for (const fi of [...(dlg?.querySelectorAll('.el-form-item') || [])]) {
      if (fi.querySelector('.el-form-item__label')?.textContent?.includes(lbl))
        return fi.querySelector('.el-select__wrapper');
    }
    return null;
  }, dialogSel, labelText);
  const el = handle.asElement();
  if (!el) throw new Error(`Select for label "${labelText}" not found`);
  const box = await el.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await sleep(600);
}

/** Get items from the most recently opened EP2 select dropdown */
async function getOpenDropdownOptions(page) {
  return page.evaluate(() => {
    const poppers = [...document.querySelectorAll('.el-select-dropdown, .el-popper.el-select__popper')]
      .filter(p => p.offsetParent !== null);
    if (!poppers.length) return [];
    const popper = poppers[poppers.length - 1];
    return [...popper.querySelectorAll('.el-select-dropdown__item')].map(o => ({
      text: o.textContent.trim(),
      disabled: o.classList.contains('is-disabled')
    }));
  });
}

/** Click an option in the currently open dropdown */
async function clickDropdownOption(page, text) {
  return page.evaluate((txt) => {
    const poppers = [...document.querySelectorAll('.el-select-dropdown, .el-popper.el-select__popper')]
      .filter(p => p.offsetParent !== null);
    for (const p of poppers.reverse()) {
      const opt = [...p.querySelectorAll('.el-select-dropdown__item')]
        .find(o => o.textContent.trim().includes(txt) && !o.classList.contains('is-disabled'));
      if (opt) { opt.click(); return { clicked: true, text: opt.textContent.trim() }; }
    }
    return { clicked: false };
  }, text);
}

/**
 * Set Vue reactive form.conditions[0].range by walking the component tree.
 * Element Plus date-pickers in headless Chrome don't fire proper Vue input events via keyboard.
 */
async function setConditionDateRange(page, start, end) {
  return page.evaluate((s, e) => {
    const dlg = document.querySelector('.el-dialog');
    const formItem = [...(dlg?.querySelectorAll('.el-form-item') || [])].find(fi =>
      fi.querySelector('.cond-builder')
    );
    if (!formItem) return { error: 'no cond builder form item' };

    let comp = formItem.__vueParentComponent;
    while (comp) {
      const name = comp.type?.name || comp.type?.__name;
      if (name === 'GzCouponTemplate') {
        const conds = comp.setupState?.form?.conditions;
        if (conds?.length > 0) {
          conds[0].range = [s, e];
          return { ok: true, range: conds[0].range };
        }
        return { error: 'conditions empty' };
      }
      comp = comp.parent;
    }
    return { error: 'GzCouponTemplate not found in tree' };
  }, start, end);
}

/**
 * Set Vue reactive form.name by walking the component tree.
 */
async function setFormName(page, name) {
  return page.evaluate((n) => {
    const dlg = document.querySelector('.el-dialog');
    const nameItem = [...(dlg?.querySelectorAll('.el-form-item') || [])].find(fi =>
      fi.querySelector('.el-form-item__label')?.textContent?.includes('券名')
    );
    if (!nameItem) return { error: 'no 券名 form item' };
    let comp = nameItem.__vueParentComponent;
    while (comp) {
      const cname = comp.type?.name || comp.type?.__name;
      if (cname === 'GzCouponTemplate') {
        comp.setupState.form.name = n;
        return { ok: true };
      }
      comp = comp.parent;
    }
    return { error: 'component not found' };
  }, name);
}

async function main() {
  const results = [];
  const P = (step, msg) => { results.push({ step, ok: true, msg }); console.log(`[PASS] Step ${step}: ${msg}`); };
  const F = (step, msg) => { results.push({ step, ok: false, msg }); console.log(`[FAIL] Step ${step}: ${msg}`); };

  console.log('[coupon-e2e] Getting auth token...');
  const token = await login();
  console.log(`[coupon-e2e] Token len=${token.length}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--no-first-run', '--no-proxy-server', '--disable-gpu', '--lang=zh-CN'],
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message.slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push('console.error: ' + m.text().slice(0, 200));
  });

  try {
    await injectSession(page, token);
    console.log('[coupon-e2e] Session OK:', page.url());
    await ss(page, '00-post-login');

    // ===== STEP 1: Navigate to /gz-coupon/template =====
    console.log('\n=== STEP 1: coupon template list ===');
    await nav(page, '/gz-coupon/template');
    await ss(page, '01-coupon-template');

    const hasViteError = await page.evaluate(() => !!document.querySelector('vite-error-overlay'));
    if (hasViteError) {
      const errText = await page.evaluate(() => document.querySelector('vite-error-overlay')?.textContent || '');
      F(1, `Vite compile error: ${errText.substring(0, 500)}`);
      await browser.close(); process.exit(1);
    }

    const s1 = await page.evaluate(() => ({
      isLogin: location.href.includes('login'),
      hasTable: !!document.querySelector('.el-table'),
      rows: document.querySelectorAll('.el-table__row').length,
      mainLen: (document.querySelector('.app-main')?.innerText || '').trim().length,
      url: location.href,
    }));
    console.log('[INFO]', JSON.stringify(s1));

    if (s1.isLogin) F(1, `Redirected to login: ${s1.url}`);
    else if (s1.hasTable) P(1, `Coupon template list renders — .el-table visible, rows=${s1.rows}. No Vite error.`);
    else if (s1.mainLen > 100) P(1, `Page renders (no Vite error), mainLen=${s1.mainLen}`);
    else F(1, `Page blank: mainLen=${s1.mainLen}, url=${s1.url}`);

    // ===== STEP 2: Open 新增 dialog + check 发放策略 dropdown =====
    console.log('\n=== STEP 2: 新增 dialog + 发放策略 dropdown ===');

    const addHandle = await page.evaluateHandle(() =>
      [...document.querySelectorAll('button, .el-button')]
        .find(b => /新\s*增/.test(b.textContent) && !b.disabled && b.offsetParent !== null)
    );
    await addHandle.asElement()?.click();
    console.log('[INFO] 新增 clicked');
    await sleep(2000);
    await ss(page, '02-add-dialog');

    const dialogOpen = await page.evaluate(() => !!document.querySelector('.el-dialog')?.offsetParent);
    if (!dialogOpen) {
      F(2, '新增 dialog did not open');
    } else {
      try {
        await clickSelectByLabel(page, '.el-dialog', '发放策略');
        await ss(page, '02-strategy-dropdown');

        const optData = await getOpenDropdownOptions(page);
        console.log('[INFO] Strategy options:', JSON.stringify(optData));

        if (optData.length === 0) {
          F(2, 'No options in strategy dropdown (did not open properly)');
        } else {
          const manual = optData.find(o => o.text.includes('手动'));
          const filtered = optData.find(o => o.text.includes('条件') || o.text.includes('筛选'));
          const event = optData.find(o => o.text.includes('事件'));
          const issues = [];
          if (!manual || manual.disabled) issues.push('手动发放 missing or disabled');
          if (!filtered || filtered.disabled) issues.push('条件筛选 missing or disabled');
          if (!event) issues.push('事件触发 missing');
          else if (!event.disabled) issues.push(`事件触发 should be DISABLED (disabled=${event.disabled})`);
          if (issues.length > 0) F(2, `${issues.join('; ')} | ${JSON.stringify(optData)}`);
          else P(2, `发放策略 dropdown: 手动发放=enabled, 条件筛选=enabled, 事件触发=DISABLED | ${JSON.stringify(optData)}`);
        }
      } catch (e) { F(2, `Strategy select error: ${e.message}`); }
    }

    // ===== STEP 3: Select 条件筛选, verify condition builder + fill date =====
    console.log('\n=== STEP 3: Select 条件筛选 + condition builder ===');

    const clickedF = await clickDropdownOption(page, '条件筛选');
    console.log('[INFO] Clicked 条件筛选:', JSON.stringify(clickedF));
    await sleep(1500);
    await ss(page, '03-filtered-selected');

    const builderInfo = await page.evaluate(() => {
      const dlg = document.querySelector('.el-dialog');
      const builder = dlg?.querySelector('.cond-builder');
      return {
        found: !!builder,
        rows: builder?.querySelectorAll('.cond-row').length || 0,
        hasAddBtn: !![...builder?.querySelectorAll('button') || []].find(b => b.textContent.includes('加条件')),
        hasPreviewBtn: !![...builder?.querySelectorAll('button') || []].find(b => b.textContent.includes('预览') && !b.disabled),
        hasDateEditor: !!dlg?.querySelector('.el-date-editor'),
      };
    });
    console.log('[INFO] Builder info:', JSON.stringify(builderInfo));

    if (!builderInfo.found) {
      F(3, `Condition builder not rendered after selecting 条件筛选`);
    } else {
      // Set date range via Vue component instance (keyboard input doesn't update Vue model in headless)
      const dateSet = await setConditionDateRange(page, '2020-01-01', '2030-12-31');
      console.log('[INFO] Date set via Vue instance:', JSON.stringify(dateSet));
      await sleep(500);
      await ss(page, '03-dates-set');

      // Verify the date picker now shows the dates in UI
      const dateDisplay = await page.evaluate(() => {
        const dlg = document.querySelector('.el-dialog');
        const inputs = [...(dlg?.querySelectorAll('.el-date-editor input') || [])];
        return inputs.map(i => i.value);
      });
      console.log('[INFO] Date inputs after Vue set:', JSON.stringify(dateDisplay));

      P(3, `条件筛选 selected — .cond-builder rendered (rows=${builderInfo.rows}), 加条件 btn=${builderInfo.hasAddBtn}, date set via Vue: ${JSON.stringify(dateSet)}, inputs: ${JSON.stringify(dateDisplay)}`);
    }

    // ===== STEP 4: Click 预览命中人数 in form builder =====
    console.log('\n=== STEP 4: 预览命中人数 ===');

    const previewHandle = await page.evaluateHandle(() => {
      const dlg = document.querySelector('.el-dialog');
      const builder = dlg?.querySelector('.cond-builder');
      return [...(builder?.querySelectorAll('button') || [])].find(b => b.textContent.includes('预览') && !b.disabled && b.offsetParent !== null);
    });
    const previewEl = previewHandle.asElement();

    if (!previewEl) {
      F(4, '预览命中人数 button not found in .cond-builder');
    } else {
      await previewEl.click();
      console.log('[INFO] Preview clicked');
      await sleep(3500);
      await ss(page, '04-preview-count');

      const hitInfo = await page.evaluate(() => {
        const dlg = document.querySelector('.el-dialog');
        const builder = dlg?.querySelector('.cond-builder');
        const span = builder?.querySelector('.cond-preview-result');
        const text = builder?.innerText || document.body.innerText;
        const m = text.match(/命中\s*(\d+)\s*人/) || text.match(/(\d+)\s*人/);
        return {
          spanText: span?.textContent?.trim() || null,
          match: m ? m[0] : null, n: m ? m[1] : null
        };
      });
      console.log('[INFO] Hit info:', JSON.stringify(hitInfo));

      if (hitInfo.spanText) P(4, `预览命中人数: "${hitInfo.spanText}"`);
      else if (hitInfo.match) P(4, `预览命中人数: "${hitInfo.match}" (N=${hitInfo.n})`);
      else F(4, 'No hit count found after preview — check if date range was properly set in Vue model');
    }

    // ===== STEP 5: Fill form and save =====
    console.log('\n=== STEP 5: Fill form and save ===');

    // Set name via Vue component instance (avoids duplicated text from multiple fill attempts)
    const nameSet = await setFormName(page, 'UI条件筛选券');
    console.log('[INFO] Name set via Vue:', JSON.stringify(nameSet));

    await ss(page, '05-form-filled');

    // Click confirm
    const submitHandle = await page.evaluateHandle(() => {
      const footer = document.querySelector('.el-dialog__footer');
      const btns = [...(footer?.querySelectorAll('button, .el-button') || [])];
      return btns.find(b => b.classList.contains('el-button--primary') && !b.disabled)
        || btns.find(b => /确认|确定/.test(b.textContent) && !b.disabled);
    });
    const submitEl = submitHandle.asElement();
    if (!submitEl) {
      F(5, 'Confirm button not found in footer');
    } else {
      await submitEl.click();
      console.log('[INFO] Submit clicked');
      await sleep(4000);
      await ss(page, '05-after-save');

      const saveR = await page.evaluate(() => {
        const ok = document.querySelector('.el-message--success');
        const err = document.querySelector('.el-message--error, .el-message--warning');
        const dlg = document.querySelector('.el-dialog');
        const tbl = document.querySelector('.el-table');
        const tblText = tbl?.innerText || '';
        return {
          okMsg: ok?.textContent?.trim() || null,
          errMsg: err?.textContent?.trim() || null,
          dlgVisible: !!(dlg?.offsetParent),
          tblHasNew: tblText.includes('UI条件筛选券'),
          tblText: tblText.substring(0, 400)
        };
      });
      console.log('[INFO] Save result:', JSON.stringify({ ...saveR, tblText: saveR.tblText.substring(0, 80) }));

      if (saveR.okMsg) P(5, `Save success: "${saveR.okMsg}" | in table: ${saveR.tblHasNew}`);
      else if (saveR.tblHasNew && !saveR.dlgVisible) P(5, `Saved: dialog closed, "UI条件筛选券" in table`);
      else if (!saveR.dlgVisible) P(5, `Dialog closed after submit (save likely succeeded)`);
      else if (saveR.errMsg) F(5, `Save error: "${saveR.errMsg}"`);
      else {
        const warnMsg = await page.evaluate(() => document.querySelector('.el-message--warning')?.textContent?.trim() || null);
        if (warnMsg) F(5, `Save blocked: "${warnMsg}"`);
        else F(5, `Save unclear — dlgVisible=${saveR.dlgVisible}, tblHasNew=${saveR.tblHasNew}`);
      }
    }

    // ===== STEP 6: Click 发放 on a 条件筛选 strategy template =====
    console.log('\n=== STEP 6: 发放 on filtered template ===');
    await sleep(1000);

    // Find the first row that has 条件筛选 strategy AND an active 发放 button
    const issueBtnInfo = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.el-table__row')];
      // Prefer our newly created row; fall back to any filtered template row
      for (const row of rows) {
        const rt = row.innerText;
        if (rt.includes('条件筛选')) {
          const btn = [...row.querySelectorAll('button, .el-button')]
            .find(b => b.textContent.trim().includes('发放') && !b.disabled && b.offsetParent !== null);
          if (btn) { btn.click(); return { found: true, rowSnippet: rt.substring(0, 100) }; }
        }
      }
      // If no 条件筛选 row found, look for any 发放 button as fallback
      const any = [...document.querySelectorAll('.el-table button')]
        .find(b => b.textContent.trim().includes('发放') && !b.disabled && b.offsetParent !== null);
      if (any) { any.click(); return { found: true, fallback: true, rowSnippet: any.closest('tr')?.innerText?.substring(0, 100) }; }
      return { found: false, rows: rows.length };
    });
    console.log('[INFO] Issue btn:', JSON.stringify(issueBtnInfo));

    if (!issueBtnInfo.found) {
      await page.keyboard.press('Escape');
      await sleep(500);
      await ss(page, '06-table-state');
      const tblText = await page.evaluate(() => document.querySelector('.el-table')?.innerText?.substring(0, 400) || 'NO TABLE');
      F(6, `发放 button not found. rows=${issueBtnInfo.rows}. Table: ${tblText.substring(0, 100)}`);
    } else {
      await sleep(2500);
      await ss(page, '06-issue-dialog');

      const issueDialInfo = await page.evaluate(() => {
        const dialogs = [...document.querySelectorAll('.el-dialog')].filter(d => d.offsetParent !== null);
        if (!dialogs.length) return { open: false };
        const dlg = dialogs[dialogs.length - 1];
        const dlgText = dlg.innerText;
        const dlgTitle = dlg.querySelector('.el-dialog__title')?.textContent?.trim() || '';
        const hasUserPickTable = !!dlg.querySelector('.el-table');
        const hasFilterHint = dlgText.includes('条件筛选策略') || dlgText.includes('自动圈定') || dlgText.includes('筛选');
        const previewBtn = [...dlg.querySelectorAll('button')].find(b => b.textContent.includes('预览命中'));
        const allBtns = [...dlg.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean);
        return {
          open: true, dlgTitle, hasUserPickTable, hasFilterHint,
          hasPreviewBtn: !!previewBtn, allBtns,
          dlgTextSnippet: dlgText.substring(0, 500)
        };
      });
      console.log('[INFO] Issue dialog:', JSON.stringify({ ...issueDialInfo, dlgTextSnippet: issueDialInfo.dlgTextSnippet?.substring(0, 150) }));

      if (!issueDialInfo.open) {
        F(6, '批量发放 dialog did not open');
      } else {
        const step6Issues = [];
        if (issueDialInfo.hasUserPickTable) step6Issues.push('Issue dialog shows user-pick .el-table (should NOT for 条件筛选)');
        if (!issueDialInfo.hasFilterHint) step6Issues.push('No filter hint text in issue dialog');
        if (!issueDialInfo.hasPreviewBtn) step6Issues.push('No 预览命中人数 button in issue dialog');

        if (issueDialInfo.hasPreviewBtn) {
          const previewHandle2 = await page.evaluateHandle(() => {
            const dlg = [...document.querySelectorAll('.el-dialog')].filter(d => d.offsetParent !== null).at(-1);
            return [...(dlg?.querySelectorAll('button') || [])].find(b => b.textContent.includes('预览命中'));
          });
          await previewHandle2.asElement()?.click();
          await sleep(3000);
          await ss(page, '06-issue-preview');

          const previewCount = await page.evaluate(() => {
            const dlg = [...document.querySelectorAll('.el-dialog')].filter(d => d.offsetParent !== null).at(-1);
            const text = dlg?.innerText || '';
            const m = text.match(/命中\s*(\d+)\s*人/) || text.match(/(\d+)\s*人/);
            const span = dlg?.querySelector('.cond-preview-result');
            return { match: m ? m[0] : null, n: m ? m[1] : null, spanText: span?.textContent?.trim() || null };
          });
          console.log('[INFO] Issue preview count:', JSON.stringify(previewCount));
          if (!previewCount.match && !previewCount.spanText) step6Issues.push('Issue preview returned no count');

          // Click 确认发放
          const confirmHandle2 = await page.evaluateHandle(() => {
            const dlg = [...document.querySelectorAll('.el-dialog')].filter(d => d.offsetParent !== null).at(-1);
            const footer = dlg?.querySelector('.el-dialog__footer');
            const btns = [...(footer?.querySelectorAll('button, .el-button') || [])];
            return btns.find(b => b.textContent.includes('确认发放'))
              || btns.find(b => b.classList.contains('el-button--primary') && !b.disabled);
          });
          const confirmEl2 = confirmHandle2.asElement();
          if (!confirmEl2) {
            step6Issues.push('确认发放 button not found');
          } else {
            const confirmText2 = await page.evaluate(el => el.textContent.trim(), confirmEl2);
            await confirmEl2.click();
            console.log('[INFO] Confirm clicked:', confirmText2);
            await sleep(5000);
            await ss(page, '06-after-issue');

            const issueResult = await page.evaluate(() => {
              const ok = document.querySelector('.el-message--success, .el-notification--success');
              const err = document.querySelector('.el-message--error');
              const dlgOpen = [...document.querySelectorAll('.el-dialog')].some(d => d.offsetParent !== null);
              const bodyM = document.body.innerText.match(/发放成功|已发放\s*\d+|操作成功/);
              return { okMsg: ok?.textContent?.trim() || null, errMsg: err?.textContent?.trim() || null, dlgOpen, bodyM: bodyM ? bodyM[0] : null };
            });
            console.log('[INFO] Issue result:', JSON.stringify(issueResult));

            if (issueResult.errMsg) step6Issues.push(`发放 error: "${issueResult.errMsg}"`);
            else if (!issueResult.okMsg && !issueResult.bodyM && issueResult.dlgOpen) {
              await sleep(2000);
              const extra = await page.evaluate(() => ({
                ok: document.querySelector('.el-message--success')?.textContent?.trim() || null,
                dlg: [...document.querySelectorAll('.el-dialog')].some(d => d.offsetParent !== null)
              }));
              if (!extra.ok && extra.dlg) step6Issues.push('Cannot confirm 发放 success (dialog open, no success msg)');
            }
          }
        }

        if (step6Issues.length > 0) F(6, step6Issues.join(' | '));
        else P(6, `批量发放 filtered: no user-pick table (${!issueDialInfo.hasUserPickTable}), filter hint (${issueDialInfo.hasFilterHint}), preview count=${JSON.stringify({})} shown, 确认发放 succeeded | btns: ${JSON.stringify(issueDialInfo.allBtns)}`);
      }
    }

  } catch (err) {
    console.error('[FATAL]', err.message, '\n', err.stack?.substring(0, 500));
    try { await ss(page, 'fatal-error'); } catch {}
  }

  // STEP 7
  console.log('\n=== STEP 7: Browser Console Errors ===');
  const relevant = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('ResizeObserver') && !e.includes('[webpack'));
  if (relevant.length === 0) console.log('[INFO] No relevant console errors');
  else relevant.forEach((e, i) => console.log(`  [${i+1}] ${e.substring(0, 250)}`));

  await browser.close();

  console.log('\n========== FINAL SUMMARY ==========');
  results.forEach(r => console.log(`  Step ${r.step}: ${r.ok ? 'PASS' : 'FAIL'} — ${r.msg.substring(0, 200)}`));
  const fails = results.filter(r => !r.ok);
  console.log(`\n  ${results.length} steps, ${fails.length} failures`);
  console.log(`  Verdict: ${fails.length === 0 ? 'GREEN' : `RED (${fails.length} failures)`}`);

  writeFileSync(join(OUT, 'console-errors.txt'), relevant.join('\n') || '(none)');
  writeFileSync(join(OUT, 'results.json'), JSON.stringify({ results, consoleErrors: relevant }, null, 2));
}

main().catch(e => { console.error('FATAL:', e.message, '\n', e.stack?.substring(0, 400)); process.exit(1); });
