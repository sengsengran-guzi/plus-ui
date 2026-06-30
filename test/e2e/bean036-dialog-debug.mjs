import { mkdirSync, writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { CFG, clearProxy, chromePath, login, injectSession, closeOverlays, sleep } from './lib.mjs'

clearProxy()
const OUT = '/tmp/pw-gacha/screenshots'
mkdirSync(OUT, { recursive: true })

async function main() {
  const token = await login()
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server', '--lang=zh-CN'],
  })
  const page = await browser.newPage()
  
  const consoleErrors = []
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message.slice(0, 200)))
  page.on('console', m => { 
    if (m.type() === 'error') consoleErrors.push('console.error: ' + m.text().slice(0, 200))
    if (m.type() === 'warn') console.log('[CONSOLE WARN]', m.text().slice(0, 100))
  })

  await injectSession(page, token)
  console.log('[INFO] Session injected')

  // Navigate to seat-closure
  await page.evaluate((path) => { 
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
  }, '/gz-bean/seat-closure')
  await sleep(1500)
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 8000 }).catch(() => {})
  await sleep(1000)

  // Click 新建关闭 (the button text we saw earlier is "新建关闭", not "新增")
  console.log('[STEP] Clicking 新建关闭 button')
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const btn = btns.find(b => /新建关闭|新增|新建/.test(b.textContent || '') && b.offsetParent !== null)
    if (btn) { btn.click(); return btn.textContent.trim() }
    return null
  })
  console.log('[INFO] Clicked:', clicked)
  await sleep(1500)
  await page.screenshot({ path: `${OUT}/bean036-d01-dialog-open.png` })

  // Get complete dialog HTML structure
  const dialogHTML = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog, .el-drawer')
    if (!dlg) return 'NO DIALOG'
    return dlg.innerHTML.substring(0, 5000)
  })
  console.log('[INFO] Dialog HTML (first 2000):', dialogHTML.substring(0, 2000))

  // Get all form items with their complete structure
  const formStructure = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog, .el-drawer')
    if (!dlg) return []
    return [...dlg.querySelectorAll('.el-form-item')].map(item => {
      const label = item.querySelector('.el-form-item__label')?.textContent.trim()
      const inputs = [...item.querySelectorAll('input')].map(i => ({ 
        type: i.type, ph: i.placeholder, val: i.value, cls: i.className, id: i.id 
      }))
      const selects = [...item.querySelectorAll('.el-select')].map(s => ({
        cls: s.className,
        inputPH: s.querySelector('input')?.placeholder,
        inputVal: s.querySelector('input')?.value,
        multiple: s.querySelector('input')?.hasAttribute('multiple')
      }))
      const checkboxGroup = [...item.querySelectorAll('.el-checkbox-group .el-checkbox')].map(c => ({
        label: c.querySelector('.el-checkbox__label')?.textContent.trim(),
        checked: c.querySelector('input')?.checked
      }))
      return { label, inputs, selects, checkboxGroup }
    })
  })
  console.log('[INFO] Form structure:', JSON.stringify(formStructure, null, 2))

  // ---- Try properly selecting seats ----
  console.log('[STEP] Selecting seats via select:first-child')
  // The dialog says labels=["座位","星期","关闭时段","备注"]
  // First form item "座位" has selects
  // Let's properly trigger el-select for seats

  // Step 1: Click the seat select to open it
  await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    const seatFormItem = [...dlg.querySelectorAll('.el-form-item')].find(i => 
      i.querySelector('.el-form-item__label')?.textContent.includes('座位'))
    if (seatFormItem) {
      const select = seatFormItem.querySelector('.el-select')
      if (select) {
        const input = select.querySelector('input')
        input?.focus()
        input?.click()
        select.click()
      }
    }
  })
  await sleep(800)
  await page.screenshot({ path: `${OUT}/bean036-d02-seat-select-open.png` })

  // Check what options are visible
  const seatOpts = await page.evaluate(() => {
    const opts = [...document.querySelectorAll('.el-select-dropdown__item')]
    return opts.filter(o => o.offsetParent !== null || getComputedStyle(o).display !== 'none').map(o => ({
      text: o.textContent.trim(),
      selected: o.classList.contains('selected'),
      visible: o.offsetParent !== null
    })).slice(0, 20)
  })
  console.log('[INFO] Seat options visible:', JSON.stringify(seatOpts))

  // Click the first option (A1)
  const firstSelected = await page.evaluate(() => {
    const opts = [...document.querySelectorAll('.el-select-dropdown__item')]
    const visible = opts.filter(o => o.offsetParent !== null)
    if (visible.length > 0) {
      visible[0].click()
      return { clicked: visible[0].textContent.trim(), total: visible.length }
    }
    return null
  })
  console.log('[INFO] Selected seat:', firstSelected)
  await sleep(500)
  await page.screenshot({ path: `${OUT}/bean036-d03-seat-selected.png` })

  // Check selected value
  const seatVal = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    const seatFormItem = [...dlg.querySelectorAll('.el-form-item')].find(i => 
      i.querySelector('.el-form-item__label')?.textContent.includes('座位'))
    if (seatFormItem) {
      // Check for selected tags (multi-select shows tags)
      const tags = [...seatFormItem.querySelectorAll('.el-tag, .el-select__tags-text')]
      const inputVal = seatFormItem.querySelector('input')?.value
      return { tags: tags.map(t => t.textContent.trim()), inputVal }
    }
    return null
  })
  console.log('[INFO] Seat form value after click:', JSON.stringify(seatVal))

  // ---- Handle time selector ----
  console.log('[STEP] Setting time selector 关闭时段')
  // Get the 关闭时段 form item
  const timeFormInfo = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    const timeFormItem = [...dlg.querySelectorAll('.el-form-item')].find(i => 
      i.querySelector('.el-form-item__label')?.textContent.includes('关闭时段'))
    if (!timeFormItem) return null
    return {
      html: timeFormItem.innerHTML.substring(0, 2000),
      inputs: [...timeFormItem.querySelectorAll('input')].map(i => ({
        type: i.type, ph: i.placeholder, val: i.value, readonly: i.readOnly, cls: i.className
      })),
      selects: [...timeFormItem.querySelectorAll('.el-select')].map(s => ({
        ph: s.querySelector('input')?.placeholder, val: s.querySelector('input')?.value
      }))
    }
  })
  console.log('[INFO] 关闭时段 form item:', JSON.stringify(timeFormInfo))

  // Click the first time select in 关闭时段
  await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    const timeFormItem = [...dlg.querySelectorAll('.el-form-item')].find(i => 
      i.querySelector('.el-form-item__label')?.textContent.includes('关闭时段'))
    if (timeFormItem) {
      const sel = timeFormItem.querySelector('.el-select, .el-time-select')
      if (sel) sel.click()
    }
  })
  await sleep(800)
  await page.screenshot({ path: `${OUT}/bean036-d04-time-select-open.png` })

  const timeOpts = await page.evaluate(() => {
    const opts = [...document.querySelectorAll('.el-select-dropdown__item, .el-time-select-item')]
    return opts.filter(o => o.offsetParent !== null).slice(0, 15).map(o => o.textContent.trim())
  })
  console.log('[INFO] Time options:', JSON.stringify(timeOpts))

  await browser.close()
  console.log('\nConsole errors:', consoleErrors)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
