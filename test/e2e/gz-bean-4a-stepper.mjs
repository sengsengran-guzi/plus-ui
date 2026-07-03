import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { clearProxy, chromePath, login, injectSession, sleep, CFG } from './lib.mjs';

clearProxy();
mkdirSync('/tmp/qa-4a-stepper', { recursive: true });

const ss = async (page, name) => {
  await page.screenshot({ path: `/tmp/qa-4a-stepper/${name}.png`, fullPage: false });
  console.log(`[SS] /tmp/qa-4a-stepper/${name}.png`);
};

async function main() {
  const token = await login();
  const browser = await puppeteer.launch({
    executablePath: chromePath(), headless: true,
    defaultViewport: { width: 1600, height: 900 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--no-proxy-server', '--disable-gpu', '--lang=zh-CN'],
  });
  const page = await browser.newPage();
  await injectSession(page, token);
  
  // Navigate to seat-management
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, '/gz-bean/seat-management');
  await sleep(800);
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {});
  await sleep(1000);
  await ss(page, '01-seat-mgmt');
  
  // Click "实时余量" tab
  const tabClicked = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.el-tabs__item')];
    const target = tabs.find(t => t.textContent.includes('余量') || t.textContent.includes('时段'));
    if (target) { target.click(); return { clicked: true, text: target.textContent.trim() }; }
    return { clicked: false, available: tabs.map(t => t.textContent.trim()) };
  });
  console.log('tab click:', JSON.stringify(tabClicked));
  await sleep(2000);
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {});
  await ss(page, '02-avail-tab');
  
  const tabState = await page.evaluate(() => {
    const tbl = document.querySelector('.el-table');
    const forms = document.querySelector('.el-form');
    const selects = [...document.querySelectorAll('.el-select')].map(s => s.textContent.trim());
    return { hasTable: !!tbl, hasForms: !!forms, selects: selects.slice(0, 5), rows: document.querySelectorAll('.el-table__row').length };
  });
  console.log('tab state:', JSON.stringify(tabState));
  
  // Select store
  const storeWrap = await page.evaluateHandle(() => {
    return document.querySelector('.el-select__wrapper, .el-select');
  });
  if (storeWrap.asElement()) {
    const box = await storeWrap.asElement().boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(700);
      const storeOpt = await page.evaluate(() => {
        const opts = [...document.querySelectorAll('.el-select-dropdown__item')].filter(o => o.offsetParent !== null);
        console.log('store opts:', opts.map(o => o.textContent.trim()).join(', '));
        const opt = opts.find(o => o.textContent.includes('春熙路') || o.textContent.includes('CD001'));
        if (opt) { opt.click(); return opt.textContent.trim(); }
        else if (opts.length > 0) { opts[0].click(); return opts[0].textContent.trim(); }
        return null;
      });
      console.log('store selected:', storeOpt);
      await sleep(3000);
      await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {});
      await ss(page, '03-avail-with-store');
      
      const withStore = await page.evaluate(() => {
        const tbl = document.querySelector('.el-table');
        const rows = document.querySelectorAll('.el-table__row').length;
        const steppers = document.querySelectorAll('.el-input-number').length;
        const text = tbl?.innerText.substring(0, 300) || '';
        return { hasTable: !!tbl, rows, steppers, text };
      });
      console.log('with store:', JSON.stringify({ ...withStore, text: withStore.text.substring(0, 80) }));
      
      if (withStore.steppers > 0) {
        console.log(`PASS: ${withStore.steppers} steppers found`);
        
        // Try clicking + button on first visible stepper
        const incResult = await page.evaluate(() => {
          const rows = [...document.querySelectorAll('.el-table__row')];
          for (const row of rows) {
            const incBtn = row.querySelector('.el-input-number__increase');
            if (incBtn && incBtn.offsetParent !== null) {
              const input = row.querySelector('.el-input-number input');
              const before = input?.value;
              incBtn.click();
              return { clicked: true, before, rowText: row.innerText.substring(0, 60) };
            }
          }
          return { clicked: false };
        });
        console.log('stepper inc:', JSON.stringify(incResult));
        await sleep(2000);
        await page.waitForNetworkIdle({ idleTime: 500, timeout: 6000 }).catch(() => {});
        await ss(page, '04-stepper-after-inc');
        
        const afterInc = await page.evaluate(() => {
          const rows = [...document.querySelectorAll('.el-table__row')];
          for (const row of rows) {
            const input = row.querySelector('.el-input-number input');
            if (input) return { val: input.value, rowText: row.innerText.substring(0, 60) };
          }
          return null;
        });
        console.log('after inc:', JSON.stringify(afterInc));
        
        // Restore - click decrease
        await page.evaluate(() => {
          const rows = [...document.querySelectorAll('.el-table__row')];
          for (const row of rows) {
            const decBtn = row.querySelector('.el-input-number__decrease');
            if (decBtn && decBtn.offsetParent !== null) { decBtn.click(); return; }
          }
        });
        await sleep(1500);
        await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});
        console.log('stepper restored');
      } else {
        console.log('FAIL: no steppers found - rows:', withStore.rows);
      }
    }
  }
  
  await browser.close();
  console.log('Done. Screenshots in /tmp/qa-4a-stepper/');
}

main().catch(e => { console.error('FATAL:', e.message, e.stack?.substring(0, 300)); process.exit(1); });
