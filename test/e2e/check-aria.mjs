import puppeteer from 'puppeteer-core';
import { clearProxy, chromePath, login, injectSession, sleep } from './lib.mjs';

clearProxy();
const token = await login();
const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server', '--lang=zh-CN'],
});
const page = await browser.newPage();
await injectSession(page, token);

await page.evaluate((p) => {
  window.history.pushState({}, '', p);
  window.dispatchEvent(new PopStateEvent('popstate', {}));
}, '/gz-coupon/template');
await sleep(2000);

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /新\s*增/.test(b.textContent) && b.offsetParent !== null);
  btn?.click();
});
await sleep(1500);

const selectInfo = await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog');
  if (!dlg) return { error: 'no dialog' };
  const selects = [...dlg.querySelectorAll('.el-select')];
  return selects.map((sel, i) => {
    const input = sel.querySelector('input');
    const wrapper = sel.querySelector('.el-select__wrapper');
    return {
      i,
      label: sel.closest('.el-form-item')?.querySelector('.el-form-item__label')?.textContent?.trim() || 'NO_LABEL',
      hasWrapper: !!wrapper,
      inputAriaControls: input?.getAttribute('aria-controls') || null,
      inputId: input?.id || null,
      currentVal: sel.querySelector('.el-select__placeholder, .el-select__selected-item')?.textContent?.trim() || sel.textContent?.trim()?.substring(0, 20) || null
    };
  });
});
console.log('Dialog selects:', JSON.stringify(selectInfo, null, 2));

// Try puppeteer click on the .el-select__wrapper element inside dialog for 发放策略
// Find by label text
const strategyWrapper = await page.evaluateHandle(() => {
  const dlg = document.querySelector('.el-dialog');
  const items = [...(dlg?.querySelectorAll('.el-form-item') || [])];
  for (const fi of items) {
    const lbl = fi.querySelector('.el-form-item__label');
    if (lbl?.textContent?.includes('发放策略')) {
      return fi.querySelector('.el-select__wrapper');
    }
  }
  return null;
});
const isFound = !!(await strategyWrapper.jsonValue());
console.log('Strategy wrapper found via evaluateHandle:', isFound);

if (isFound) {
  // Get bounding box and click via puppeteer
  const el = strategyWrapper.asElement();
  const box = await el.boundingBox();
  console.log('Bounding box:', JSON.stringify(box));
  await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
  await sleep(800);

  // Check what popper opened
  const popperInfo = await page.evaluate(() => {
    const poppers = [...document.querySelectorAll('.el-select-dropdown, .el-popper')].filter(p => p.offsetParent !== null);
    return poppers.map((p, i) => ({
      i,
      class: p.className,
      items: [...p.querySelectorAll('.el-select-dropdown__item')].map(o => ({ text: o.textContent.trim(), disabled: o.classList.contains('is-disabled') }))
    }));
  });
  console.log('Open poppers after click:', JSON.stringify(popperInfo, null, 2));
}

await browser.close();
