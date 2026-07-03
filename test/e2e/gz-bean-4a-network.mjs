import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { clearProxy, chromePath, login, injectSession, sleep, CFG } from './lib.mjs';

clearProxy();
mkdirSync('/tmp/qa-4a-net', { recursive: true });

async function main() {
  const token = await login();
  const browser = await puppeteer.launch({
    executablePath: chromePath(), headless: true,
    defaultViewport: { width: 1600, height: 900 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--no-proxy-server', '--disable-gpu', '--lang=zh-CN'],
  });
  const page = await browser.newPage();
  
  const networkReqs = [];
  page.on('request', (req) => {
    if (req.url().includes('slotQuotaClose') || req.url().includes('availability')) {
      networkReqs.push({ method: req.method(), url: req.url(), postData: req.postData()?.substring(0, 200) });
    }
  });
  
  await injectSession(page, token);
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, '/gz-bean/seat-management');
  await sleep(800);
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {});
  await sleep(1000);
  
  // Click "实时余量与关闭" tab
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.el-tabs__item')];
    const t = tabs.find(t => t.textContent.includes('余量'));
    if (t) t.click();
  });
  await sleep(2500);
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {});
  
  // Clear captured requests so far
  networkReqs.length = 0;
  
  // Try to type directly into a stepper input
  const inputResult = await page.evaluateHandle(() => {
    const rows = [...document.querySelectorAll('.el-table__row')];
    for (const row of rows) {
      const inp = row.querySelector('.el-input-number input');
      if (inp && inp.offsetParent !== null) return inp;
    }
    return null;
  });
  
  if (inputResult.asElement()) {
    await inputResult.asElement().click({ clickCount: 3 });
    await inputResult.asElement().type('1');
    await inputResult.asElement().press('Tab'); // trigger blur/change
    await sleep(2500);
    await page.waitForNetworkIdle({ idleTime: 600, timeout: 8000 }).catch(() => {});
    
    console.log('Network requests captured:');
    networkReqs.forEach(r => console.log(`  ${r.method} ${r.url} data=${r.postData || '(none)'}`));
    
    if (networkReqs.some(r => r.url.includes('slotQuotaClose') && r.method === 'POST')) {
      console.log('PASS: stepper change triggered POST /slotQuotaClose (upsert API called)');
    } else if (networkReqs.length > 0) {
      console.log('INFO: requests:', JSON.stringify(networkReqs.slice(0, 3)));
    } else {
      console.log('WARN: no network requests to slotQuotaClose after stepper change');
    }
    
    // Restore
    await inputResult.asElement().click({ clickCount: 3 });
    await inputResult.asElement().type('0');
    await inputResult.asElement().press('Tab');
    await sleep(2000);
    console.log('Restored to 0');
  } else {
    console.log('FAIL: no el-input-number input found');
  }
  
  await browser.close();
  console.log('Done');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
