// Test: set Vue reactive cond range directly
import puppeteer from 'puppeteer-core';
import { clearProxy, chromePath, login, injectSession, sleep } from './lib.mjs';
import { writeFileSync } from 'node:fs';

clearProxy();
const token = await login();
const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
  args: ['--no-sandbox', '--no-proxy-server', '--lang=zh-CN'],
});
const page = await browser.newPage();
await injectSession(page, token);

await page.evaluate((p) => {
  window.history.pushState({}, '', p);
  window.dispatchEvent(new PopStateEvent('popstate', {}));
}, '/gz-coupon/template');
await sleep(2000);

// Click 新增
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find(b => /新\s*增/.test(b.textContent) && b.offsetParent !== null)?.click();
});
await sleep(1500);

// Click 发放策略 select via mouse
const stratWrap = await page.evaluateHandle(() => {
  const dlg = document.querySelector('.el-dialog');
  const items = [...(dlg?.querySelectorAll('.el-form-item') || [])];
  for (const fi of items) {
    if (fi.querySelector('.el-form-item__label')?.textContent?.includes('发放策略'))
      return fi.querySelector('.el-select__wrapper');
  }
  return null;
});
const box = await stratWrap.asElement().boundingBox();
await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
await sleep(600);

// Click 条件筛选
await page.evaluate(() => {
  const poppers = [...document.querySelectorAll('.el-select-dropdown, .el-popper.el-select__popper')].filter(p => p.offsetParent !== null);
  for (const p of poppers.reverse()) {
    const opt = [...p.querySelectorAll('.el-select-dropdown__item')].find(o => o.textContent.includes('条件筛选') && !o.classList.contains('is-disabled'));
    if (opt) { opt.click(); return; }
  }
});
await sleep(1500);

// Now try to set the date range via Vue instance
const setResult = await page.evaluate(() => {
  // Find the Vue instance on the dialog or its children
  const dlg = document.querySelector('.el-dialog');
  if (!dlg) return { error: 'no dialog' };

  // Try Vue 3: __vueParentComponent on elements
  const condRows = [...(dlg.querySelectorAll('.cond-row') || [])];
  console.log('condRows:', condRows.length);

  if (condRows.length === 0) return { error: 'no cond-row found' };

  // Try to access the date picker's exposed value via el-date-editor
  const dateEditor = dlg.querySelector('.el-date-editor');
  if (!dateEditor) return { error: 'no date editor' };

  // Check Vue instance on date editor
  const vueEl = dateEditor.__vueParentComponent;
  console.log('dateEditor vue component:', vueEl ? 'found' : 'not found');
  if (vueEl) {
    const proxy = vueEl.proxy;
    console.log('proxy keys:', proxy ? Object.keys(proxy).slice(0, 10) : 'null');
  }

  // The parent form item with 筛选条件
  const formItems = [...dlg.querySelectorAll('.el-form-item')];
  const condItem = formItems.find(fi => fi.querySelector('.el-form-item__label')?.textContent?.includes('筛选条件') || fi.querySelector('.cond-builder'));
  if (condItem) {
    const vueComp = condItem.__vueParentComponent;
    console.log('condItem vue comp:', vueComp ? 'found' : 'not');
    // Walk up to find GzCouponTemplate component
    let parent = vueComp;
    while (parent) {
      const name = parent.type?.name || parent.type?.__name;
      if (name) console.log('  comp name:', name);
      if (name === 'GzCouponTemplate') {
        const form = parent.setupState?.form;
        console.log('form.conditions:', JSON.stringify(form?.conditions || 'N/A'));
        if (form?.conditions?.length > 0) {
          form.conditions[0].range = ['2020-01-01', '2030-12-31'];
          return { success: true, setRange: form.conditions[0].range };
        }
      }
      parent = parent.parent;
    }
  }
  return { error: 'could not find GzCouponTemplate component via walk' };
});
console.log('Set result:', JSON.stringify(setResult));

await page.screenshot({ path: '/tmp/qa-coupon-filtered/vue-instance-test.png' });
await browser.close();
