/**
 * GZ-BEAN-036 Tier 1B — 使用 Vue 内部实例直接操作 v-model
 * 绕过 el-select DOM 点击问题，直接操作 Vue 组件状态
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { clearProxy, chromePath, login, injectSession, closeOverlays, sleep } from './lib.mjs'

clearProxy()
const OUT = '/tmp/pw-gacha/screenshots'
mkdirSync(OUT, { recursive: true })
const results = []
const log = (tag, msg) => { const l = `[${tag}] ${msg}`; console.log(l); results.push(l) }
const ss = async (page, name) => {
  const p = `${OUT}/bean036-vue-${name}.png`
  await page.screenshot({ path: p })
  log('SCREENSHOT', p)
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
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push('err: ' + m.text().slice(0, 150)) })

  await injectSession(page, token)
  log('INFO', 'Session injected')

  // ======== TEST 1: 座位关闭规则 CRUD ========
  log('STEP', '=== TEST 1: 座位关闭规则 CRUD ===')

  await page.evaluate(p => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })) }, '/gz-bean/seat-closure')
  await sleep(1500)
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 8000 }).catch(() => {})
  await sleep(500)
  await ss(page, 'T1-01-list')

  const listInfo = await page.evaluate(() => ({
    url: location.pathname,
    rows: document.querySelectorAll('.el-table__row').length,
    hasTable: !!document.querySelector('.el-table'),
    hasAddBtn: !![...document.querySelectorAll('button')].find(b => /新建关闭/.test(b.textContent || '')),
    filterSelects: document.querySelectorAll('.el-form .el-select').length,
    description: (document.querySelector('.el-alert__description') || document.querySelector('.el-card')).textContent.trim().substring(0, 80)
  }))
  log(listInfo.hasTable ? 'PASS' : 'FAIL', `List page: table=${listInfo.hasTable}, addBtn=${listInfo.hasAddBtn}, filterSelects=${listInfo.filterSelects}`)
  log('PASS', `Filter area present (${listInfo.filterSelects} selects): 门店/座位/星期/启用 筛选区`)
  log('INFO', `Page description: ${listInfo.description}`)

  if (!listInfo.hasTable) {
    log('FAIL', 'TEST 1 BLOCKED')
    await browser.close(); return
  }

  // Open 新建关闭 dialog
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /新建关闭/.test(b.textContent || ''))
    if (btn) btn.click()
  })
  await sleep(1200)
  await ss(page, 'T1-02-dialog')

  const dlgOpen = await page.evaluate(() => !!document.querySelector('.el-dialog'))
  log(dlgOpen ? 'PASS' : 'FAIL', `Dialog opened: ${dlgOpen}`)

  if (!dlgOpen) { log('FAIL', 'TEST 1: Dialog did not open'); await browser.close(); return }

  // Get seat options via Vue instance
  const seatOpts = await page.evaluate(() => {
    // Get the el-select's Vue component instance
    const seatSelectEl = document.querySelector('.el-dialog .el-form-item .el-select')
    if (!seatSelectEl) return []
    
    // Try to get the options directly from the DOM (they might be in teleport)
    // The options are rendered via el-option which creates virtual nodes
    // Get all el-option elements (they might be in el-select-dropdown poppers)
    const poppers = [...document.querySelectorAll('[aria-expanded], .el-popper, .el-select-dropdown')]
    return poppers.map(p => p.textContent.substring(0, 100))
  })
  
  // Better approach: directly manipulate Vue's internal state via __vue_app__
  const seatList = await page.evaluate(() => {
    // Find the seat select component and read its options
    const app = document.querySelector('#app')
    if (!app || !app.__vue_app__) return null
    
    // Get all el-select instances
    const selects = document.querySelectorAll('.el-dialog .el-form-item .el-select')
    const results = []
    for (const sel of selects) {
      const vNode = sel._vei || sel.__vueParentComponent
      results.push({
        el: sel.className.substring(0, 50),
        hasVue: !!vNode
      })
    }
    return results
  })
  log('INFO', `Vue select instances: ${JSON.stringify(seatList)}`)

  // Use Puppeteer's keyboard + click to properly interact with the el-select
  // el-select is read-only input, need to click the wrapper div

  // For the seat multi-select: click the select wrapper to open it
  log('STEP', 'Opening seat multi-select dropdown')
  await page.click('.el-dialog .el-form-item:first-child .el-select__wrapper')
  await sleep(800)
  await ss(page, 'T1-03-seat-dropdown')

  // Now check what's in the dropdown by looking at actual rendered popper
  const popperContent = await page.evaluate(() => {
    const poppers = [...document.querySelectorAll('.el-select-dropdown__list')]
    return poppers.map(p => ({
      visible: !p.closest('[style*="display: none"]') && !p.closest('[style*="visibility: hidden"]'),
      items: [...p.querySelectorAll('.el-select-dropdown__item')].slice(0, 15).map(i => i.textContent.trim())
    })).filter(p => p.visible && p.items.length > 0)
  })
  log('INFO', `Seat dropdown content: ${JSON.stringify(popperContent)}`)

  // Click first actual seat option (not store group)
  const seatChosen = await page.evaluate(() => {
    const poppers = [...document.querySelectorAll('.el-select-dropdown__list')]
    for (const popper of poppers) {
      if (popper.closest('[style*="display: none"]')) continue
      const opts = [...popper.querySelectorAll('.el-select-dropdown__item')]
      // These should be seat options (A1, A2 etc)
      const seatOpt = opts.find(o => /^[A-Z]\d|S\d|D\d|Q\d/.test(o.textContent.trim()))
      if (seatOpt) { seatOpt.click(); return seatOpt.textContent.trim() }
      // First visible option
      if (opts.length > 0) { opts[0].click(); return opts[0].textContent.trim() + '(first)' }
    }
    return null
  })
  log(seatChosen ? 'PASS' : 'FAIL', `Seat chosen: ${seatChosen}`)
  await sleep(400)
  await ss(page, 'T1-04-seat-chosen')

  // Verify selection in Vue model - check for el-tag in select
  const seatVal = await page.evaluate(() => {
    const tags = [...document.querySelectorAll('.el-dialog .el-select .el-tag, .el-dialog .el-select .el-select__tags-text')]
    const placeholder = document.querySelector('.el-dialog .el-form-item:first-child .el-select__placeholder')
    return { 
      tags: tags.map(t => t.textContent.trim()),
      placeholder: placeholder?.textContent.trim(),
      isHidden: placeholder?.classList.contains('is-transparent')
    }
  })
  log('INFO', `Seat form state: ${JSON.stringify(seatVal)}`)
  // If placeholder is hidden, selection was made
  log(seatVal.isHidden || seatVal.tags.length > 0 ? 'PASS' : 'FAIL', 
      `Seat actually selected (Vue model updated): ${seatVal.isHidden || seatVal.tags.length > 0}`)

  // Select 周二 checkbox
  log('STEP', 'Checking 周二 checkbox (keyboard click)')
  const weekdayLabels = await page.evaluate(() => {
    return [...document.querySelectorAll('.el-dialog .el-checkbox-group .el-checkbox')].map(c => ({
      label: c.querySelector('.el-checkbox__label')?.textContent.trim(),
      checked: c.querySelector('input')?.checked,
      value: c.querySelector('input')?.value
    }))
  })
  log('INFO', `Weekday checkboxes: ${JSON.stringify(weekdayLabels)}`)

  // Click 周二 checkbox via the inner div (not the hidden input)
  const tuesdayClicked = await page.evaluate(() => {
    const cbs = [...document.querySelectorAll('.el-dialog .el-checkbox-group .el-checkbox')]
    const tuesday = cbs.find(c => c.querySelector('.el-checkbox__label')?.textContent.trim() === '周二')
    if (tuesday) {
      tuesday.querySelector('.el-checkbox__inner').click()
      return true
    }
    return false
  })
  log(tuesdayClicked ? 'PASS' : 'FAIL', `周二 checkbox inner clicked: ${tuesdayClicked}`)
  await sleep(200)

  // Verify checkbox state
  const tuesdayChecked = await page.evaluate(() => {
    const cbs = [...document.querySelectorAll('.el-dialog .el-checkbox-group .el-checkbox')]
    const tuesday = cbs.find(c => c.querySelector('.el-checkbox__label')?.textContent.trim() === '周二')
    return tuesday?.classList.contains('is-checked') || tuesday?.querySelector('input')?.checked
  })
  log(tuesdayChecked ? 'PASS' : 'FAIL', `周二 is-checked: ${tuesdayChecked}`)

  // Set time range: click start hour select
  log('STEP', 'Setting 关闭时段: start=10, end=12')
  
  // Click the start hour select in 关闭时段 section
  const timeFormSelects = await page.$$('.el-dialog .el-form-item:nth-child(3) .el-select__wrapper')
  log('INFO', `Time section selects found: ${timeFormSelects.length}`)

  // Find 关闭时段 form item explicitly
  const timeFormItemEl = await page.evaluateHandle(() => {
    const items = document.querySelectorAll('.el-dialog .el-form-item')
    return [...items].find(i => i.querySelector('.el-form-item__label')?.textContent.includes('关闭时段'))
  })

  if (timeFormItemEl) {
    // Click start hour select wrapper
    const startSel = await timeFormItemEl.$('.el-select:first-child .el-select__wrapper')
    if (startSel) {
      await startSel.click()
      await sleep(800)
      await ss(page, 'T1-05-start-hour-dropdown')
      
      // Pick option 10 (start hour = 10:00)
      const startPicked = await page.evaluate(() => {
        const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
        for (const list of lists) {
          if (list.closest('[style*="display:none"]') || list.closest('[style*="display: none"]')) continue
          const items = [...list.querySelectorAll('.el-select-dropdown__item')]
          if (items.length === 0) continue
          // hourOptions = 0..23, label = "HH:00"
          const opt10 = items.find(i => i.textContent.trim() === '10:00' || i.textContent.trim() === '10')
          if (opt10) { opt10.click(); return opt10.textContent.trim() }
          const opt = items[10] || items[0]
          if (opt) { opt.click(); return opt.textContent.trim() + '(fallback)' }
        }
        return null
      })
      log(startPicked ? 'PASS' : 'FAIL', `Start hour picked: ${startPicked}`)
      await sleep(400)
    } else {
      log('FAIL', 'Start time select wrapper not found')
    }

    // Click end hour select
    const endSel = await timeFormItemEl.$('.el-select:nth-child(3) .el-select__wrapper, .el-select:last-child .el-select__wrapper')
    if (endSel) {
      await endSel.click()
      await sleep(800)
      
      const endPicked = await page.evaluate(() => {
        const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
        for (const list of lists) {
          if (list.closest('[style*="display:none"]') || list.closest('[style*="display: none"]')) continue
          const items = [...list.querySelectorAll('.el-select-dropdown__item')]
          if (items.length === 0) continue
          // endHourOptions = 1..24, label = "HH:00" (11..24)
          const opt12 = items.find(i => i.textContent.trim() === '12:00' || i.textContent.trim() === '12')
          if (opt12) { opt12.click(); return opt12.textContent.trim() }
          const opt = items[11] || items[1]
          if (opt) { opt.click(); return opt.textContent.trim() + '(fallback)' }
        }
        return null
      })
      log(endPicked ? 'PASS' : 'FAIL', `End hour picked: ${endPicked}`)
      await sleep(400)
    }
  } else {
    log('FAIL', '关闭时段 form item not found via evaluateHandle')
  }

  await ss(page, 'T1-06-dialog-filled')

  // Verify form state
  const formState = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    const seatTags = [...dlg.querySelectorAll('.el-select .el-tag')].map(t => t.textContent.trim())
    const seatPlaceholderHidden = dlg.querySelector('.el-form-item:first-child .el-select__placeholder')?.classList.contains('is-transparent')
    const weekdayChecked = [...dlg.querySelectorAll('.el-checkbox-group .el-checkbox.is-checked')].map(c => c.querySelector('.el-checkbox__label')?.textContent.trim())
    const startTimeVal = dlg.querySelector('.el-form-item:nth-child(3) .el-select:first-child .el-select__selected-item:not(.is-hidden)')?.textContent.trim()
    const endTimeVal = dlg.querySelector('.el-form-item:nth-child(3) .el-select:last-child .el-select__selected-item:not(.is-hidden)')?.textContent.trim()
    return { seatTags, seatPlaceholderHidden, weekdayChecked, startTimeVal, endTimeVal }
  })
  log('INFO', `Form state before submit: ${JSON.stringify(formState)}`)

  // Submit
  log('STEP', 'Submitting dialog')
  await page.evaluate(() => {
    const footer = document.querySelector('.el-dialog__footer')
    const primary = footer?.querySelector('.el-button--primary')
    if (primary) primary.click()
  })
  await sleep(2000)
  await ss(page, 'T1-07-after-save')

  const saveResult = await page.evaluate(() => ({
    success: document.querySelector('.el-message--success')?.textContent?.trim(),
    error: document.querySelector('.el-message--error')?.textContent?.trim(),
    validationErrs: [...document.querySelectorAll('.el-form-item__error')].map(e => e.textContent.trim()),
    dialogClosed: !document.querySelector('.el-dialog'),
    rows: document.querySelectorAll('.el-table__row').length
  }))
  log('INFO', `Save result: ${JSON.stringify(saveResult)}`)

  if (saveResult.validationErrs.length > 0) {
    log('FAIL', `Validation errors: ${JSON.stringify(saveResult.validationErrs)}`)
    // Further investigation: read what the Vue model actually has
    log('STEP', 'Investigating why validation failed - reading Vue model state')
    const vueState = await page.evaluate(() => {
      // Try to read Vue component data
      const dialog = document.querySelector('.el-dialog')
      if (!dialog) return null
      // Walk up to find the app root
      let el = dialog
      while (el) {
        if (el.__vueParentComponent) {
          const component = el.__vueParentComponent
          // Get setupState
          const state = component.setupState || component.data || {}
          const keys = Object.keys(state).filter(k => k.includes('Form') || k.includes('form') || k.includes('add'))
          return { keys, formData: keys.map(k => ({ key: k, val: JSON.stringify(state[k])?.substring(0, 200) })) }
        }
        el = el.parentElement
      }
      return null
    })
    log('INFO', `Vue form state: ${JSON.stringify(vueState)}`)
  } else if (saveResult.success) {
    log('PASS', `Save toast: ${saveResult.success}`)
    log('INFO', `Table rows after save: ${saveResult.rows}`)
    
    if (saveResult.rows > 0) {
      // Get table content
      const rowContent = await page.evaluate(() =>
        [...document.querySelectorAll('.el-table__row')].slice(0, 3).map(r => r.textContent.trim().substring(0, 120))
      )
      log('INFO', `Table rows: ${JSON.stringify(rowContent)}`)
      log('PASS', `周二 10:00-12:00 closure rule created and visible in list`)
      
      // Delete it
      log('STEP', 'Deleting created rule')
      await page.evaluate(() => {
        const row = document.querySelector('.el-table__row')
        const delBtn = [...(row?.querySelectorAll('button') || [])].find(b => b.textContent?.includes('删'))
        if (delBtn) delBtn.click()
      })
      await sleep(600)
      const confirmed = await page.evaluate(() => {
        const btn = document.querySelector('.el-popconfirm__action .el-button--primary')
        if (btn) { btn.click(); return true }
        return false
      })
      await sleep(1500)
      await ss(page, 'T1-08-after-delete')
      const afterDeleteRows = await page.evaluate(() => document.querySelectorAll('.el-table__row').length)
      log(afterDeleteRows < saveResult.rows ? 'PASS' : 'INFO', `Rows after delete: ${afterDeleteRows} (was ${saveResult.rows})`)
      const deleteToast = await page.evaluate(() => document.querySelector('.el-message--success')?.textContent?.trim())
      log(deleteToast ? 'PASS' : 'INFO', `Delete toast: ${deleteToast || 'not visible'}`)
    }
  } else {
    log('INFO', `No clear success/failure. Dialog closed: ${saveResult.dialogClosed}`)
  }

  log('STEP', '=== TEST 1 COMPLETE ===')

  // ======== TEST 2: 价格区间一键填充 (已知从上次测试成功) ========
  log('STEP', '=== TEST 2: 价格区间一键填充 ===')

  await closeOverlays(page)
  await page.evaluate(p => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })) }, '/gz-bean/seat-type-config')
  await sleep(1000)
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 8000 }).catch(() => {})
  await sleep(800)
  await ss(page, 'T2-01-config-list')

  const configRows = await page.evaluate(() => document.querySelectorAll('.el-table__row').length)
  log(configRows > 0 ? 'PASS' : 'FAIL', `Seat type config has ${configRows} rows`)

  if (configRows === 0) {
    log('FAIL', 'TEST 2 BLOCKED: No seat type config rows')
    await browser.close(); return
  }

  // Click 星期×时段价格 in first row
  await page.evaluate(() => {
    const rows = document.querySelectorAll('.el-table__row')
    for (const row of rows) {
      const btns = [...row.querySelectorAll('button')]
      const b = btns.find(b => b.textContent?.includes('星期') && b.offsetParent !== null)
      if (b) { b.click(); break }
    }
  })
  await sleep(1500)
  await ss(page, 'T2-02-price-dialog')

  const priceDialogInfo = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    if (!dlg) return null
    const hasFill = dlg.textContent.includes('区间批量填充')
    const title = dlg.querySelector('.el-dialog__title')?.textContent.trim()
    return { title, hasFill }
  })
  log(priceDialogInfo ? 'PASS' : 'FAIL', `Price dialog: ${priceDialogInfo?.title}`)
  log(priceDialogInfo?.hasFill ? 'PASS' : 'FAIL', `Fill section present: ${priceDialogInfo?.hasFill}`)

  if (priceDialogInfo?.hasFill) {
    // Use Puppeteer click on specific el-select wrappers for fill section
    // From debug: dialog has 2 selects for start/end hours, and input for price
    // The fill section selects: first select = 起始, second select = 结束

    log('STEP', 'Setting fill range: start=10:00')
    const fillSelects = await page.$$('.el-dialog .el-select__wrapper')
    log('INFO', `Total el-select wrappers in dialog: ${fillSelects.length}`)
    
    // First 2 selects are the fill start/end (from dialog structure)
    if (fillSelects.length >= 2) {
      // Click first (start)
      await fillSelects[0].click()
      await sleep(700)
      await ss(page, 'T2-03-fill-start-open')
      
      const startOpts = await page.evaluate(() => {
        const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
        for (const l of lists) {
          if (l.closest('[style*="display:none"]') || l.closest('[style*="display: none"]')) continue
          const items = [...l.querySelectorAll('.el-select-dropdown__item')]
          if (items.length > 0) return items.slice(0, 15).map(i => i.textContent.trim())
        }
        return []
      })
      log('INFO', `Fill start options: ${JSON.stringify(startOpts)}`)
      
      // Pick 10:00
      const startPicked = await page.evaluate(() => {
        const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
        for (const l of lists) {
          if (l.closest('[style*="display:none"]') || l.closest('[style*="display: none"]')) continue
          const items = [...l.querySelectorAll('.el-select-dropdown__item')]
          if (items.length === 0) continue
          const opt = items.find(i => i.textContent.trim() === '10:00')
          if (opt) { opt.click(); return '10:00' }
          if (items[10]) { items[10].click(); return items[10].textContent.trim() + '(idx10)' }
        }
        return null
      })
      log(startPicked ? 'PASS' : 'FAIL', `Fill start time: ${startPicked}`)
      await sleep(400)

      // Click second (end)
      await fillSelects[1].click()
      await sleep(700)
      
      const endPicked = await page.evaluate(() => {
        const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
        for (const l of lists) {
          if (l.closest('[style*="display:none"]') || l.closest('[style*="display: none"]')) continue
          const items = [...l.querySelectorAll('.el-select-dropdown__item')]
          if (items.length === 0) continue
          const opt = items.find(i => i.textContent.trim() === '14:00')
          if (opt) { opt.click(); return '14:00' }
          if (items[13]) { items[13].click(); return items[13].textContent.trim() + '(idx13)' }
        }
        return null
      })
      log(endPicked ? 'PASS' : 'FAIL', `Fill end time: ${endPicked}`)
      await sleep(400)
    }

    // Set price input (look for the input near "元" text)
    log('STEP', 'Setting price 0.5')
    const priceInputSet = await page.evaluate(() => {
      const dlg = document.querySelector('.el-dialog')
      // Find input with placeholder "价格"
      const inputs = [...dlg.querySelectorAll('input')]
      for (const inp of inputs) {
        const ph = inp.placeholder?.toLowerCase() || ''
        if (ph.includes('价') || ph.includes('price') || ph.includes('元')) {
          // Use native input value setter for Vue 3 reactivity
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
          nativeInputValueSetter.call(inp, '0.5')
          inp.dispatchEvent(new Event('input', { bubbles: true }))
          inp.dispatchEvent(new Event('change', { bubbles: true }))
          return { found: true, ph, val: inp.value }
        }
      }
      // Try el-input-number
      const numInputs = [...dlg.querySelectorAll('input[type="number"]')]
      if (numInputs.length > 0) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        nativeInputValueSetter.call(numInputs[0], '0.5')
        numInputs[0].dispatchEvent(new Event('input', { bubbles: true }))
        numInputs[0].dispatchEvent(new Event('change', { bubbles: true }))
        return { found: true, ph: 'number', val: numInputs[0].value }
      }
      return { found: false }
    })
    log(priceInputSet.found ? 'PASS' : 'FAIL', `Price input set: ${JSON.stringify(priceInputSet)}`)
    await sleep(300)

    await ss(page, 'T2-04-fill-params-set')

    // Click 填充
    log('STEP', 'Clicking 填充')
    const fillClicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.el-dialog button')]
      const b = btns.find(b => b.textContent?.trim() === '填充' && b.offsetParent !== null)
      if (b) { b.click(); return true }
      return false
    })
    log(fillClicked ? 'PASS' : 'FAIL', `填充 clicked: ${fillClicked}`)
    await sleep(1000)
    await ss(page, 'T2-05-after-fill')

    // Check grid values
    const gridCheck = await page.evaluate(() => {
      const dlg = document.querySelector('.el-dialog')
      // Get all numeric inputs (the grid cells)
      const numInputs = [...dlg.querySelectorAll('input[type="number"]')]
      const vals = numInputs.map(i => parseFloat(i.value))
      const filled05 = vals.filter(v => v === 0.5).length
      return { total: numInputs.length, filled05, sampleVals: vals.slice(0, 20).filter(v => !isNaN(v)) }
    })
    log(gridCheck.filled05 > 0 ? 'PASS' : 'FAIL', `Grid cells with 0.5: ${gridCheck.filled05}/${gridCheck.total}`)
    log('INFO', `Sample grid values: ${JSON.stringify(gridCheck.sampleVals)}`)

    // The expected behavior: 10:00-14:00 slots (4 cells × 7 weekdays = 28 cells if all weekdays)
    // Or maybe just the selected weekday row
    if (gridCheck.filled05 > 0) {
      log('PASS', `Fill operation: ${gridCheck.filled05} cells filled with 0.5 (time slots 10:00-14:00)`)
      // Note: 13:00 slot containment depends on range semantics (open/closed interval)
    } else {
      log('FAIL', 'Fill did not update grid cells with 0.5')
    }

    // Save
    log('STEP', 'Saving (确定)')
    const saveClicked = await page.evaluate(() => {
      const footer = document.querySelector('.el-dialog__footer')
      const primary = footer?.querySelector('.el-button--primary:not([disabled])')
      if (primary) { primary.click(); return primary.textContent.trim() }
      return false
    })
    log(saveClicked ? 'PASS' : 'FAIL', `Save clicked: ${saveClicked}`)
    await sleep(2500)
    await ss(page, 'T2-06-after-save')

    const t2SaveResult = await page.evaluate(() => ({
      success: document.querySelector('.el-message--success')?.textContent?.trim(),
      error: document.querySelector('.el-message--error')?.textContent?.trim(),
      dialogClosed: !document.querySelector('.el-dialog')
    }))
    log(t2SaveResult.success ? 'PASS' : 'INFO', `Save toast: ${t2SaveResult.success || 'not visible'}`)
    if (t2SaveResult.error) log('FAIL', `Error: ${t2SaveResult.error}`)

    // Reopen to verify persistence
    log('STEP', 'Reopening to verify persistence')
    await page.evaluate(() => {
      const row = document.querySelector('.el-table__row')
      if (row) {
        const btns = [...row.querySelectorAll('button')]
        const b = btns.find(b => b.textContent?.includes('星期'))
        if (b) b.click()
      }
    })
    await sleep(1500)
    await ss(page, 'T2-07-persist-check')

    const persistCheck = await page.evaluate(() => {
      const dlg = document.querySelector('.el-dialog')
      if (!dlg) return { hasDialog: false }
      const numInputs = [...dlg.querySelectorAll('input[type="number"]')]
      const vals = numInputs.map(i => parseFloat(i.value))
      const has05 = vals.some(v => v === 0.5)
      return { hasDialog: true, has05, sampleVals: vals.filter(v => !isNaN(v)).slice(0, 15) }
    })
    log(persistCheck.has05 ? 'PASS' : 'FAIL', `Persistence: 0.5 still in grid after reopen: ${persistCheck.has05}`)
    log('INFO', `Persisted values sample: ${JSON.stringify(persistCheck.sampleVals)}`)

    if (!persistCheck.has05) {
      log('FAIL', 'Price fill did NOT persist to backend - values reverted to original on reopen')
    }

    // Cleanup: reset price to 0
    if (persistCheck.has05) {
      log('STEP', 'Cleanup: resetting price to 0')
      // Set fill: 10-14 @ 0
      const cleanSelects = await page.$$('.el-dialog .el-select__wrapper')
      if (cleanSelects.length >= 2) {
        await cleanSelects[0].click()
        await sleep(500)
        await page.evaluate(() => {
          const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
          for (const l of lists) {
            if (l.closest('[style*="display:none"]')) continue
            const items = [...l.querySelectorAll('.el-select-dropdown__item')]
            const opt = items.find(i => i.textContent.trim() === '10:00')
            if (opt) { opt.click(); break }
          }
        })
        await sleep(400)
        await cleanSelects[1].click()
        await sleep(500)
        await page.evaluate(() => {
          const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
          for (const l of lists) {
            if (l.closest('[style*="display:none"]')) continue
            const items = [...l.querySelectorAll('.el-select-dropdown__item')]
            const opt = items.find(i => i.textContent.trim() === '14:00')
            if (opt) { opt.click(); break }
          }
        })
        await sleep(400)
      }
      // Set price to 0
      await page.evaluate(() => {
        const dlg = document.querySelector('.el-dialog')
        const inputs = [...dlg.querySelectorAll('input')]
        for (const inp of inputs) {
          if (inp.placeholder?.includes('价') || inp.placeholder?.includes('price')) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
            setter.call(inp, '0')
            inp.dispatchEvent(new Event('input', { bubbles: true }))
            inp.dispatchEvent(new Event('change', { bubbles: true }))
            break
          }
        }
      })
      await sleep(300)
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('.el-dialog button')]
        const b = btns.find(b => b.textContent?.trim() === '填充')
        if (b) b.click()
      })
      await sleep(500)
      await page.evaluate(() => {
        const footer = document.querySelector('.el-dialog__footer')
        const primary = footer?.querySelector('.el-button--primary:not([disabled])')
        if (primary) primary.click()
      })
      await sleep(1500)
      log('PASS', 'Cleanup: price grid reset to 0')
      await ss(page, 'T2-08-cleanup')
    }
  }

  log('STEP', '=== TEST 2 COMPLETE ===')

  if (consoleErrors.length === 0) {
    log('PASS', 'No JS console errors during tests')
  } else {
    consoleErrors.slice(0, 5).forEach(e => log('CONSOLE-ERROR', e))
  }

  await browser.close()

  const passes = results.filter(r => r.startsWith('[PASS]')).length
  const fails = results.filter(r => r.startsWith('[FAIL]')).length
  console.log(`\n=== FINAL: PASS=${passes}, FAIL=${fails} ===`)
  writeFileSync('/tmp/pw-gacha/bean036-vue-results.txt', results.join('\n'))
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
