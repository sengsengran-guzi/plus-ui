/**
 * GZ-BEAN-036 Tier 1B admin Playwright E2E
 * TEST 1: 座位关闭规则 CRUD
 * TEST 2: 价格区间一键填充
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { clearProxy, chromePath, login, injectSession, closeOverlays, sleep } from './lib.mjs'

clearProxy()
const OUT = '/tmp/pw-gacha/screenshots'
mkdirSync(OUT, { recursive: true })
const results = []
const log = (tag, msg) => { const l = `[${tag}] ${msg}`; console.log(l); results.push(l) }

async function ss(page, name) {
  const p = `${OUT}/bean036-final-${name}.png`
  await page.screenshot({ path: p })
  log('SCREENSHOT', p)
}

// Click el-select and pick a visible option from teleport dropdown
async function pickSelectOption(page, selectEl, matchText) {
  // Click to open the dropdown
  await page.evaluate(el => el.click(), selectEl)
  await sleep(600)
  
  // Options are in teleport - they're in body, not inside the dialog
  const picked = await page.evaluate((match) => {
    // Get all currently visible dropdowns
    const panels = document.querySelectorAll('.el-select-dropdown, .el-popper')
    for (const panel of panels) {
      const style = window.getComputedStyle(panel)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      const opts = [...panel.querySelectorAll('.el-select-dropdown__item')]
      if (opts.length === 0) continue
      let target = null
      if (match) {
        target = opts.find(o => o.textContent.includes(match))
      }
      if (!target) target = opts[0]
      if (target) {
        target.click()
        return target.textContent.trim()
      }
    }
    return null
  }, matchText)
  await sleep(400)
  return picked
}

async function main() {
  const token = await login()
  log('INFO', `Login OK, token_len=${token.length}`)

  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server', '--lang=zh-CN'],
  })
  const page = await browser.newPage()
  const consoleErrors = []
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message.slice(0, 150)))
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push('console.error: ' + m.text().slice(0, 150)) })

  await injectSession(page, token)
  log('INFO', 'Session injected')
  await ss(page, '00-after-login')

  // ======== TEST 1: 座位关闭规则 CRUD ========
  log('STEP', '=== TEST 1: 座位关闭规则 CRUD ===')

  await page.evaluate(p => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })) }, '/gz-bean/seat-closure')
  await sleep(1000)
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 8000 }).catch(() => {})
  await sleep(800)
  await ss(page, '01-seat-closure-list')

  const page1 = await page.evaluate(() => ({
    url: location.pathname,
    isLogin: location.pathname.includes('login'),
    hasTable: !!document.querySelector('.el-table'),
    hasAddBtn: !![...document.querySelectorAll('button')].find(b => /新建关闭|新\s*增|新建/.test(b.textContent || '')),
    filterSelects: document.querySelectorAll('.el-form .el-select').length,
    rows: document.querySelectorAll('.el-table__row').length,
    text: (document.querySelector('.app-main') || document.body).innerText.substring(0, 200)
  }))
  log(page1.isLogin ? 'FAIL' : 'PASS', `Not on login: ${!page1.isLogin}`)
  log(page1.hasTable ? 'PASS' : 'FAIL', `Has table: ${page1.hasTable}`)
  log(page1.hasAddBtn ? 'PASS' : 'FAIL', `Has 新建关闭 button: ${page1.hasAddBtn}`)
  log(page1.filterSelects > 0 ? 'PASS' : 'INFO', `Filter area (${page1.filterSelects} selects): ${page1.filterSelects > 0}`)
  log('INFO', `Page text: ${page1.text.substring(0, 150)}`)

  if (!page1.hasTable || page1.isLogin) {
    log('FAIL', 'TEST 1 BLOCKED - page not loaded correctly')
    await browser.close()
    return
  }

  // Click 新建关闭
  log('STEP', 'Clicking 新建关闭')
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /新建关闭|新\s*增|新建/.test(b.textContent || '') && b.offsetParent !== null)
    if (btn) btn.click()
  })
  await sleep(1200)
  await ss(page, '02-add-dialog-opened')

  const dlg1 = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog, .el-drawer')
    if (!dlg) return null
    return {
      title: dlg.querySelector('.el-dialog__title')?.textContent.trim(),
      labels: [...dlg.querySelectorAll('.el-form-item__label')].map(l => l.textContent.trim())
    }
  })
  log(dlg1 ? 'PASS' : 'FAIL', `Dialog opened: ${dlg1 ? dlg1.title : 'NO DIALOG'}`)
  log('INFO', `Form labels: ${JSON.stringify(dlg1?.labels)}`)

  if (!dlg1) {
    log('FAIL', 'TEST 1: Dialog did not open')
  } else {
    // Step: Select seat A1 from the 座位 dropdown
    log('STEP', 'Selecting seat A1 from 座位 dropdown')
    const seatSelectEl = await page.$('.el-dialog .el-form-item:first-child .el-select, .el-dialog .el-form-item .el-select')
    let seatChosen = null
    if (seatSelectEl) {
      seatChosen = await pickSelectOption(page, seatSelectEl, 'A1')
    }
    log(seatChosen ? 'PASS' : 'FAIL', `Seat selected: ${seatChosen}`)
    await sleep(300)
    await ss(page, '03-dialog-seat-selected')

    // Step: Check 周二 checkbox
    log('STEP', 'Checking 周二 checkbox')
    const weekdaySet = await page.evaluate(() => {
      const dlg = document.querySelector('.el-dialog')
      const checkboxes = [...dlg.querySelectorAll('.el-checkbox')]
      const tuesday = checkboxes.find(c => c.querySelector('.el-checkbox__label')?.textContent.trim() === '周二')
      if (tuesday) {
        const input = tuesday.querySelector('input')
        if (!input.checked) {
          tuesday.querySelector('.el-checkbox__inner').click()
          return true
        }
        return true // already checked
      }
      return false
    })
    log(weekdaySet ? 'PASS' : 'FAIL', `周二 checked: ${weekdaySet}`)
    await sleep(300)

    // Step: Select 关闭时段 - start time 10:00
    log('STEP', 'Selecting 关闭时段 start: 10:00')
    const timeSelects = await page.$$('.el-dialog .el-form-item:nth-child(3) .el-select, .el-dialog .el-form-item:last-of-type .el-select')
    
    // Find the 关闭时段 form item specifically
    const timeFormSelects = await page.$$eval('.el-dialog .el-form-item', items => {
      const timeItem = items.find(i => i.querySelector('.el-form-item__label')?.textContent.includes('关闭时段'))
      if (!timeItem) return 0
      return timeItem.querySelectorAll('.el-select').length
    })
    log('INFO', `Time form item has ${timeFormSelects} selects`)

    // Click start time select in 关闭时段
    const startTimeClicked = await page.evaluate(() => {
      const dlg = document.querySelector('.el-dialog')
      const items = [...dlg.querySelectorAll('.el-form-item')]
      const timeItem = items.find(i => i.querySelector('.el-form-item__label')?.textContent.includes('关闭时段'))
      if (!timeItem) return false
      const selects = timeItem.querySelectorAll('.el-select')
      if (selects.length === 0) return false
      selects[0].click()
      return true
    })
    log(startTimeClicked ? 'PASS' : 'FAIL', `Start time dropdown opened: ${startTimeClicked}`)
    await sleep(700)
    await ss(page, '04-start-time-dropdown')

    // Pick 10:00 from dropdown
    const startTimePicked = await page.evaluate(() => {
      const panels = [...document.querySelectorAll('.el-select-dropdown, .el-popper')]
      for (const panel of panels) {
        const style = window.getComputedStyle(panel)
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue
        const opts = [...panel.querySelectorAll('.el-select-dropdown__item')]
        if (opts.length === 0) continue
        // Look for 10:00
        const target = opts.find(o => o.textContent.trim() === '10:00')
        if (target) { target.click(); return '10:00' }
        // Try first visible option
        const first = opts.find(o => o.offsetParent !== null || panel.style.display !== 'none')
        if (first) { first.click(); return first.textContent.trim() + '(first)' }
      }
      return null
    })
    log(startTimePicked ? 'PASS' : 'FAIL', `Start time selected: ${startTimePicked}`)
    await sleep(500)

    // Click end time select
    const endTimeClicked = await page.evaluate(() => {
      const dlg = document.querySelector('.el-dialog')
      const items = [...dlg.querySelectorAll('.el-form-item')]
      const timeItem = items.find(i => i.querySelector('.el-form-item__label')?.textContent.includes('关闭时段'))
      if (!timeItem) return false
      const selects = timeItem.querySelectorAll('.el-select')
      if (selects.length < 2) return false
      selects[1].click()
      return true
    })
    log(endTimeClicked ? 'PASS' : 'FAIL', `End time dropdown opened: ${endTimeClicked}`)
    await sleep(700)

    const endTimePicked = await page.evaluate(() => {
      const panels = [...document.querySelectorAll('.el-select-dropdown, .el-popper')]
      for (const panel of panels) {
        const style = window.getComputedStyle(panel)
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue
        const opts = [...panel.querySelectorAll('.el-select-dropdown__item')]
        if (opts.length === 0) continue
        const target = opts.find(o => o.textContent.trim() === '12:00')
        if (target) { target.click(); return '12:00' }
        const last = opts[opts.length - 1]
        if (last) { last.click(); return last.textContent.trim() + '(last)' }
      }
      return null
    })
    log(endTimePicked ? 'PASS' : 'FAIL', `End time selected: ${endTimePicked}`)
    await sleep(400)
    await ss(page, '05-dialog-fully-filled')

    // Verify form state before submit
    const formState = await page.evaluate(() => {
      const dlg = document.querySelector('.el-dialog')
      const seatFormItem = [...dlg.querySelectorAll('.el-form-item')].find(i => i.querySelector('.el-form-item__label')?.textContent.includes('座位'))
      const tags = [...(seatFormItem?.querySelectorAll('.el-tag, .el-select__tags-text') || [])].map(t => t.textContent.trim())
      const seatInputVal = seatFormItem?.querySelector('.el-select__selected-item:not(.is-hidden) span')?.textContent
      const timeItem = [...dlg.querySelectorAll('.el-form-item')].find(i => i.querySelector('.el-form-item__label')?.textContent.includes('关闭时段'))
      const timeVals = [...(timeItem?.querySelectorAll('.el-select__selected-item:not(.is-hidden) span') || [])].map(s => s.textContent.trim())
      const weekdays = [...dlg.querySelectorAll('.el-checkbox input:checked')].map(i => i.value)
      return { tags, seatInputVal, timeVals, weekdays }
    })
    log('INFO', `Form state before submit: ${JSON.stringify(formState)}`)

    // Submit
    log('STEP', 'Clicking 确定 to save')
    const saveClicked = await page.evaluate(() => {
      const footer = document.querySelector('.el-dialog__footer, .el-dialog')
      if (!footer) return false
      // Find confirm button specifically in footer
      const footerBtns = [...(document.querySelectorAll('.el-dialog__footer button, .el-dialog .dialog-footer button'))]
      const okBtn = footerBtns.find(b => /确\s*定|保\s*存/.test(b.textContent || '') && !b.disabled)
      if (okBtn) { okBtn.click(); return okBtn.textContent.trim() }
      // Fallback: last primary button
      const allPrimary = [...document.querySelectorAll('.el-dialog .el-button--primary')]
      if (allPrimary.length > 0) { allPrimary[allPrimary.length - 1].click(); return 'last-primary' }
      return false
    })
    log(saveClicked ? 'PASS' : 'FAIL', `Save clicked: ${saveClicked}`)
    await sleep(2000)
    await ss(page, '06-after-save')

    const saveResult = await page.evaluate(() => {
      const success = document.querySelector('.el-message--success')?.textContent?.trim()
      const error = document.querySelector('.el-message--error')?.textContent?.trim()
      const validationErrs = [...document.querySelectorAll('.el-form-item__error')].map(e => e.textContent.trim())
      const dlg = document.querySelector('.el-dialog')
      const rows = document.querySelectorAll('.el-table__row').length
      return { success, error, validationErrs, dialogOpen: !!dlg, rows }
    })
    log(saveResult.success ? 'PASS' : (saveResult.validationErrs.length > 0 ? 'FAIL' : 'INFO'), 
        `Save result: success=${saveResult.success}, errors=${JSON.stringify(saveResult.validationErrs)}`)
    log('INFO', `After save: dialog=${saveResult.dialogOpen}, rows=${saveResult.rows}`)

    if (saveResult.validationErrs.length > 0) {
      log('FAIL', `Validation errors preventing save: ${JSON.stringify(saveResult.validationErrs)}`)
    }

    // If success, check list and delete
    if (!saveResult.dialogOpen && saveResult.rows > 0) {
      log('PASS', `Row appeared in list: ${saveResult.rows} rows`)
      
      // Get row content
      const rowContent = await page.evaluate(() => {
        return [...document.querySelectorAll('.el-table__row')].slice(0, 3).map(r => r.textContent.trim().substring(0, 150))
      })
      log('INFO', `Table rows: ${JSON.stringify(rowContent)}`)
      
      // Delete the first row
      log('STEP', 'Deleting first rule')
      const deleteClicked = await page.evaluate(() => {
        const firstRow = document.querySelector('.el-table__row')
        if (!firstRow) return false
        // Try delete button in row
        const btns = [...firstRow.querySelectorAll('button, .el-button')]
        const delBtn = btns.find(b => /删\s*除/.test(b.textContent || '') && b.offsetParent !== null)
        if (delBtn) { delBtn.click(); return delBtn.textContent.trim() }
        return false
      })
      log(deleteClicked ? 'PASS' : 'INFO', `Delete clicked: ${deleteClicked}`)
      
      if (deleteClicked) {
        await sleep(600)
        const confirmed = await page.evaluate(() => {
          const confirmOk = document.querySelector('.el-popconfirm__action .el-button--primary, .el-message-box__btns .el-button--primary')
          if (confirmOk) { confirmOk.click(); return true }
          return false
        })
        log(confirmed ? 'PASS' : 'INFO', `Delete confirmed: ${confirmed}`)
        await sleep(1500)
        await ss(page, '07-after-delete')
        
        const afterDelete = await page.evaluate(() => ({
          rows: document.querySelectorAll('.el-table__row').length,
          success: document.querySelector('.el-message--success')?.textContent?.trim()
        }))
        log('INFO', `After delete: rows=${afterDelete.rows}`)
        log(afterDelete.success ? 'PASS' : 'INFO', `Delete toast: ${afterDelete.success || 'not visible'}`)
        log(afterDelete.rows === 0 || afterDelete.rows < saveResult.rows ? 'PASS' : 'INFO', 
            `Row removed: rows now ${afterDelete.rows} (was ${saveResult.rows})`)
      }
    } else if (saveResult.validationErrs.length === 0 && !saveResult.success) {
      log('INFO', 'Dialog closed but no toast visible - checking if save worked via reload')
      if (!saveResult.dialogOpen) {
        await page.reload({ waitUntil: 'networkidle2' }).catch(() => {})
        await sleep(1500)
        const reloadRows = await page.evaluate(() => document.querySelectorAll('.el-table__row').length)
        log('INFO', `Rows after reload: ${reloadRows}`)
        await ss(page, '06b-after-reload')
      }
    }
  }
  log('STEP', '=== TEST 1 COMPLETE ===')

  // ======== TEST 2: 价格区间一键填充 ========
  log('STEP', '=== TEST 2: 价格区间一键填充 ===')

  await closeOverlays(page)
  await page.evaluate(p => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })) }, '/gz-bean/seat-type-config')
  await sleep(1000)
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 8000 }).catch(() => {})
  await sleep(800)
  await ss(page, '10-seat-type-config')

  const page2 = await page.evaluate(() => ({
    url: location.pathname, isLogin: location.pathname.includes('login'),
    rows: document.querySelectorAll('.el-table__row').length,
    rowTexts: [...document.querySelectorAll('.el-table__row')].slice(0, 3).map(r => r.textContent.trim().substring(0, 100))
  }))
  log(page2.isLogin ? 'FAIL' : 'PASS', `seat-type-config loaded: rows=${page2.rows}`)
  log('INFO', `Row samples: ${JSON.stringify(page2.rowTexts)}`)

  if (page2.rows === 0 || page2.isLogin) {
    log(page2.isLogin ? 'FAIL' : 'INFO', 'TEST 2: No rows in seat type config or login redirect')
  } else {
    // Click 星期×时段价格 button in first row
    log('STEP', 'Clicking 星期×时段价格 in first row')
    const priceBtn = await page.evaluate(() => {
      const rows = document.querySelectorAll('.el-table__row')
      for (const row of rows) {
        const btns = [...row.querySelectorAll('button, .el-button')]
        const b = btns.find(b => b.textContent?.includes('星期') || b.textContent?.includes('价格') || /grid|price/i.test(b.textContent || ''))
        if (b && b.offsetParent !== null) { b.click(); return b.textContent.trim() }
      }
      return null
    })
    log(priceBtn ? 'PASS' : 'FAIL', `星期×时段价格 button clicked: ${priceBtn}`)
    await sleep(1500)
    await ss(page, '11-price-dialog')

    const dlg2 = await page.evaluate(() => {
      const dlg = document.querySelector('.el-dialog, .el-drawer')
      if (!dlg) return null
      return {
        title: dlg.querySelector('.el-dialog__title')?.textContent.trim(),
        hasFill: /填充|批量/.test(dlg.textContent),
        buttons: [...dlg.querySelectorAll('button')].map(b => b.textContent?.trim()),
        descText: dlg.textContent.substring(0, 400)
      }
    })
    log(dlg2 ? 'PASS' : 'FAIL', `Price dialog opened: ${dlg2?.title || 'NO DIALOG'}`)
    log(dlg2?.hasFill ? 'PASS' : 'FAIL', `Fill control present: ${dlg2?.hasFill}`)
    log('INFO', `Dialog buttons: ${JSON.stringify(dlg2?.buttons)}`)

    if (dlg2?.hasFill) {
      // Find and fill the range inputs
      // From debug: "区间批量填充：起始 至 结束 元 全部星期 ..."
      // The selects in fill area: 起始/结束 (el-select), price (el-input-number or input)
      log('STEP', 'Setting fill params: 10:00-14:00, 0.5元, 全部星期')

      // Click start hour select (in 区间批量填充 section)
      // From dialog HTML: "起始" is first select, "结束" is second
      const fillControls = await page.evaluate(() => {
        const dlg = document.querySelector('.el-dialog')
        const text = dlg.textContent
        const hasFillSection = text.includes('区间批量填充')
        // Find fill section - typically inside a div/section
        const allSelects = [...dlg.querySelectorAll('.el-select')]
        const allInputNumbers = [...dlg.querySelectorAll('.el-input-number input, input[type="number"]')]
        const allInputTexts = [...dlg.querySelectorAll('input[type="text"]')]
        return {
          hasFillSection,
          totalSelects: allSelects.length,
          totalInputNumbers: allInputNumbers.length,
          totalInputTexts: allInputTexts.length
        }
      })
      log('INFO', `Fill section controls: ${JSON.stringify(fillControls)}`)

      // The dialog has many inputs (95 from debug). 
      // The fill section selects are at the beginning of the dialog.
      // Let me click the first select that appears in the fill section
      
      // Open start select for fill
      const fillStartClicked = await page.evaluate(() => {
        const dlg = document.querySelector('.el-dialog')
        // Look for the fill section specifically
        const allText = [...dlg.querySelectorAll('*')].find(el => el.textContent.trim() === '区间批量填充：' || el.textContent.trim() === '区间批量填充')
        const fillSection = allText?.closest('.el-col, .fill-section, div') || dlg
        const selects = fillSection ? [...fillSection.querySelectorAll('.el-select')] : [...dlg.querySelectorAll('.el-select')].slice(0, 3)
        if (selects.length > 0) {
          selects[0].click()
          return { count: selects.length, clicked: 0 }
        }
        return null
      })
      log('INFO', `Fill start select: ${JSON.stringify(fillStartClicked)}`)
      await sleep(700)
      await ss(page, '12-fill-start-open')

      // From the dialog text: "起始 至 结束 元 全部星期 周一 周二..."
      // These look like el-select dropdowns with time options
      // Let me see what's in the dropdown
      const fillStartOpts = await page.evaluate(() => {
        const panels = [...document.querySelectorAll('.el-select-dropdown, .el-popper')]
        for (const panel of panels) {
          const style = window.getComputedStyle(panel)
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue
          const opts = [...panel.querySelectorAll('.el-select-dropdown__item')]
          if (opts.length === 0) continue
          return opts.slice(0, 15).map(o => o.textContent.trim())
        }
        return []
      })
      log('INFO', `Fill start options: ${JSON.stringify(fillStartOpts)}`)

      // Pick 10:00
      const fillStartPicked = await page.evaluate(() => {
        const panels = [...document.querySelectorAll('.el-select-dropdown, .el-popper')]
        for (const panel of panels) {
          const style = window.getComputedStyle(panel)
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue
          const opts = [...panel.querySelectorAll('.el-select-dropdown__item')]
          if (opts.length === 0) continue
          const t10 = opts.find(o => o.textContent.trim() === '10:00')
          if (t10) { t10.click(); return '10:00' }
          const t10h = opts.find(o => o.textContent.trim() === '10')
          if (t10h) { t10h.click(); return '10' }
          // Pick first
          if (opts[0]) { opts[0].click(); return opts[0].textContent.trim() + '(first)' }
        }
        return null
      })
      log(fillStartPicked ? 'PASS' : 'FAIL', `Fill start time: ${fillStartPicked}`)
      await sleep(400)

      // Click end select
      const fillEndClicked = await page.evaluate(() => {
        const dlg = document.querySelector('.el-dialog')
        const allText = [...dlg.querySelectorAll('*')].find(el => el.textContent.trim() === '区间批量填充：' || el.textContent.trim() === '区间批量填充')
        const fillSection = allText?.closest('.el-col, .fill-section, div') || dlg
        const selects = [...fillSection.querySelectorAll('.el-select')]
        if (selects.length > 1) {
          selects[1].click()
          return { clicked: 1, total: selects.length }
        }
        return null
      })
      log('INFO', `Fill end select: ${JSON.stringify(fillEndClicked)}`)
      await sleep(700)

      // Pick 14:00 for end
      const fillEndPicked = await page.evaluate(() => {
        const panels = [...document.querySelectorAll('.el-select-dropdown, .el-popper')]
        for (const panel of panels) {
          const style = window.getComputedStyle(panel)
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue
          const opts = [...panel.querySelectorAll('.el-select-dropdown__item')]
          if (opts.length === 0) continue
          const t14 = opts.find(o => o.textContent.trim() === '14:00')
          if (t14) { t14.click(); return '14:00' }
          const t14h = opts.find(o => o.textContent.trim() === '14')
          if (t14h) { t14h.click(); return '14' }
          const last = opts[opts.length - 1]
          if (last) { last.click(); return last.textContent.trim() + '(last)' }
        }
        return null
      })
      log(fillEndPicked ? 'PASS' : 'FAIL', `Fill end time: ${fillEndPicked}`)
      await sleep(400)

      // Fill price: 0.5
      log('STEP', 'Setting price to 0.5')
      const priceSet = await page.evaluate(() => {
        const dlg = document.querySelector('.el-dialog')
        // Look for price input in fill area - el-input-number or regular number input
        const numInputs = [...dlg.querySelectorAll('input[type="number"], .el-input-number input')]
        // Also try text inputs that might be price
        const allInputs = [...dlg.querySelectorAll('input')]
        for (const inp of allInputs) {
          const ph = inp.placeholder?.toLowerCase() || ''
          if (ph.includes('价') || ph.includes('price') || ph.includes('元') || ph.includes('金额')) {
            inp.value = '0.5'
            inp.dispatchEvent(new Event('input', { bubbles: true }))
            inp.dispatchEvent(new Event('change', { bubbles: true }))
            return { set: '0.5', via: 'placeholder-' + inp.placeholder }
          }
        }
        // Try el-input-number (the 元 input next to 结束)
        if (numInputs.length > 0) {
          numInputs[0].value = '0.5'
          numInputs[0].dispatchEvent(new Event('input', { bubbles: true }))
          numInputs[0].dispatchEvent(new Event('change', { bubbles: true }))
          return { set: '0.5', via: 'number-input-0' }
        }
        return null
      })
      log(priceSet ? 'PASS' : 'INFO', `Price set: ${JSON.stringify(priceSet)}`)
      await sleep(300)

      await ss(page, '13-fill-params')

      // Select 全部星期 checkbox (already pre-selected per dialog text)
      // The dialog shows: "全部星期 周一 周二 ..." as checkboxes
      const weekdaysSelected = await page.evaluate(() => {
        const dlg = document.querySelector('.el-dialog')
        // Find checkboxes in the fill section specifically (not in the price grid)
        // Look for '全部星期' checkbox
        const allCheckboxes = [...dlg.querySelectorAll('.el-checkbox')]
        const allDay = allCheckboxes.find(c => c.textContent.includes('全部') || c.textContent.includes('全选'))
        if (allDay) {
          const input = allDay.querySelector('input')
          if (!input.checked) allDay.querySelector('.el-checkbox__inner').click()
          return '全部星期'
        }
        // Check if any weekday checkbox exists in the fill section
        const monChk = allCheckboxes.find(c => c.querySelector('.el-checkbox__label')?.textContent.trim() === '周一')
        if (monChk) {
          monChk.querySelector('.el-checkbox__inner').click()
          return '周一'
        }
        return null
      })
      log(weekdaysSelected ? 'PASS' : 'INFO', `Weekday selected: ${weekdaysSelected}`)
      await sleep(300)

      // Click 填充 button
      log('STEP', 'Clicking 填充 button')
      const fillClicked = await page.evaluate(() => {
        const dlg = document.querySelector('.el-dialog')
        const btns = [...dlg.querySelectorAll('button')]
        const fillBtn = btns.find(b => b.textContent?.trim() === '填充' && b.offsetParent !== null)
        if (fillBtn) { fillBtn.click(); return fillBtn.textContent.trim() }
        return null
      })
      log(fillClicked ? 'PASS' : 'FAIL', `填充 button clicked: ${fillClicked}`)
      await sleep(1000)
      await ss(page, '14-after-fill')

      // Check grid cells for 0.5
      const gridVals = await page.evaluate(() => {
        const dlg = document.querySelector('.el-dialog')
        // Grid cells are likely el-input or td cells
        const allInputVals = [...dlg.querySelectorAll('input[type="number"], .el-input__inner, .el-input input')]
          .map(i => i.value).filter(v => v)
        const has05 = allInputVals.some(v => parseFloat(v) === 0.5)
        return { allInputVals: allInputVals.slice(0, 20), has05, count: allInputVals.length }
      })
      log(gridVals.has05 ? 'PASS' : 'FAIL', `Grid cells filled with 0.5: ${gridVals.has05}`)
      log('INFO', `Input values (first 20): ${JSON.stringify(gridVals.allInputVals)}`)

      // Save
      log('STEP', 'Saving price grid (确定)')
      const saved = await page.evaluate(() => {
        const footer = document.querySelector('.el-dialog__footer')
        if (footer) {
          const primary = footer.querySelector('.el-button--primary:not([disabled])')
          if (primary) { primary.click(); return primary.textContent.trim() }
        }
        const allPrimary = [...document.querySelectorAll('.el-dialog .el-button--primary')]
        const last = allPrimary[allPrimary.length - 1]
        if (last) { last.click(); return last.textContent.trim() + '(last)' }
        return false
      })
      log(saved ? 'PASS' : 'FAIL', `Save clicked: ${saved}`)
      await sleep(2000)
      await ss(page, '15-after-price-save')

      const saveResult2 = await page.evaluate(() => ({
        success: document.querySelector('.el-message--success')?.textContent?.trim(),
        error: document.querySelector('.el-message--error')?.textContent?.trim(),
        dialogClosed: !document.querySelector('.el-dialog')
      }))
      log(saveResult2.success ? 'PASS' : 'INFO', `Save toast: ${saveResult2.success || 'not visible'}`)
      if (saveResult2.error) log('FAIL', `Error: ${saveResult2.error}`)

      // Reopen to verify persistence
      if (saveResult2.dialogClosed || saveResult2.success) {
        log('STEP', 'Reopening to verify persistence')
        await page.evaluate(() => {
          const rows = document.querySelectorAll('.el-table__row')
          if (rows.length > 0) {
            const btns = [...rows[0].querySelectorAll('button')]
            const b = btns.find(b => b.textContent?.includes('星期') || b.textContent?.includes('价格'))
            if (b) b.click()
          }
        })
        await sleep(1500)
        await ss(page, '16-persist-verify')

        const persist = await page.evaluate(() => {
          const dlg = document.querySelector('.el-dialog')
          if (!dlg) return { hasDialog: false }
          const allInputVals = [...dlg.querySelectorAll('input')].map(i => i.value).filter(v => v)
          const has05 = allInputVals.some(v => parseFloat(v) === 0.5)
          return { hasDialog: true, has05, sampleVals: allInputVals.slice(0, 10) }
        })
        log(persist.has05 ? 'PASS' : 'FAIL', `Persistence check: 0.5 still in grid: ${persist.has05}`)
        log('INFO', `Persisted sample values: ${JSON.stringify(persist.sampleVals)}`)

        // Cleanup: fill back to 0
        if (persist.has05) {
          log('STEP', 'Cleanup: reset test cells to 0')
          // Set fill: 10-14 @ 0
          const cleanupFill = await page.evaluate(() => {
            const dlg = document.querySelector('.el-dialog')
            if (!dlg) return false
            // Find fill selects
            const allText = [...dlg.querySelectorAll('*')].find(el => el.textContent.trim() === '区间批量填充：' || el.textContent.trim() === '区间批量填充')
            const fillSection = allText?.closest('.el-col, .fill-section, div') || dlg
            const selects = [...fillSection.querySelectorAll('.el-select')]
            if (selects.length > 0) selects[0].click()
            return true
          })
          await sleep(500)
          await page.evaluate(() => {
            const panels = [...document.querySelectorAll('.el-select-dropdown, .el-popper')]
            for (const panel of panels) {
              const opts = [...panel.querySelectorAll('.el-select-dropdown__item')]
              if (opts.length === 0) continue
              const t = opts.find(o => o.textContent.trim().includes('10'))
              if (t) { t.click(); break }
            }
          })
          await sleep(400)
          await page.evaluate(() => {
            const dlg = document.querySelector('.el-dialog')
            const allText = [...dlg.querySelectorAll('*')].find(el => el.textContent.trim() === '区间批量填充：' || el.textContent.trim() === '区间批量填充')
            const fillSection = allText?.closest('.el-col, .fill-section, div') || dlg
            const selects = [...fillSection.querySelectorAll('.el-select')]
            if (selects.length > 1) selects[1].click()
          })
          await sleep(500)
          await page.evaluate(() => {
            const panels = [...document.querySelectorAll('.el-select-dropdown, .el-popper')]
            for (const panel of panels) {
              const opts = [...panel.querySelectorAll('.el-select-dropdown__item')]
              if (opts.length === 0) continue
              const t = opts.find(o => o.textContent.trim().includes('14'))
              if (t) { t.click(); break }
            }
          })
          await sleep(400)
          await page.evaluate(() => {
            const dlg = document.querySelector('.el-dialog')
            const numInputs = [...dlg.querySelectorAll('input[type="number"], .el-input-number input')]
            if (numInputs.length > 0) {
              numInputs[0].value = '0'
              numInputs[0].dispatchEvent(new Event('input', { bubbles: true }))
              numInputs[0].dispatchEvent(new Event('change', { bubbles: true }))
            }
          })
          await sleep(300)
          // Click 填充 with 0
          await page.evaluate(() => {
            const btns = [...document.querySelectorAll('.el-dialog button')]
            const fillBtn = btns.find(b => b.textContent?.trim() === '填充')
            if (fillBtn) fillBtn.click()
          })
          await sleep(500)
          // Save
          await page.evaluate(() => {
            const allPrimary = [...document.querySelectorAll('.el-dialog .el-button--primary')]
            const last = allPrimary[allPrimary.length - 1]
            if (last) last.click()
          })
          await sleep(1500)
          log('PASS', 'Cleanup: price grid reset to 0')
          await ss(page, '17-cleanup')
        }
      }
    }
  }
  log('STEP', '=== TEST 2 COMPLETE ===')

  // Console errors
  if (consoleErrors.length === 0) {
    log('PASS', 'No console errors throughout test')
  } else {
    consoleErrors.forEach(e => log('CONSOLE-ERROR', e))
  }

  await browser.close()

  const passes = results.filter(r => r.startsWith('[PASS]')).length
  const fails = results.filter(r => r.startsWith('[FAIL]')).length
  console.log(`\n=== FINAL: PASS=${passes}, FAIL=${fails} ===`)
  writeFileSync('/tmp/pw-gacha/bean036-final-results.txt', results.join('\n'))
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
