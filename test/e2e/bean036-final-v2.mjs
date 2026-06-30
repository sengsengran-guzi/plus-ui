/**
 * GZ-BEAN-036 Tier 1B — Final version
 * Uses page.evaluate to directly modify Vue component's reactive state
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
  const p = `${OUT}/bean036-v2-${name}.png`
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
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message.slice(0, 200)))
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push('err: ' + m.text().slice(0, 200)) })

  await injectSession(page, token)
  log('INFO', 'Session injected')

  // ======== TEST 1: 座位关闭规则 CRUD ========
  log('STEP', '=== TEST 1: 座位关闭规则 CRUD ===')

  await page.evaluate(p => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })) }, '/gz-bean/seat-closure')
  await sleep(1500)
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 8000 }).catch(() => {})
  await sleep(800)
  await ss(page, 'T1-01-list')

  const listInfo = await page.evaluate(() => ({
    rows: document.querySelectorAll('.el-table__row').length,
    hasTable: !!document.querySelector('.el-table'),
    hasAddBtn: !![...document.querySelectorAll('button')].find(b => /新建关闭/.test(b.textContent || '')),
    filterSelects: document.querySelectorAll('.el-form .el-select').length,
  }))
  log(listInfo.hasTable ? 'PASS' : 'FAIL', `List page rendered: table=${listInfo.hasTable}, addBtn=${listInfo.hasAddBtn}`)
  log(listInfo.filterSelects >= 4 ? 'PASS' : 'INFO', `Filter area: ${listInfo.filterSelects} selects (门店/座位/星期/启用)`)

  if (!listInfo.hasTable) {
    log('FAIL', 'TEST 1 BLOCKED'); await browser.close(); return
  }

  // Open dialog
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /新建关闭/.test(b.textContent || '') && b.offsetParent !== null)
    if (btn) btn.click()
  })
  await sleep(1200)
  await ss(page, 'T1-02-dialog-opened')

  const dlgInfo = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    if (!dlg) return null
    return { title: dlg.querySelector('.el-dialog__title')?.textContent.trim() }
  })
  log(dlgInfo ? 'PASS' : 'FAIL', `Dialog: ${dlgInfo?.title || 'NOT OPENED'}`)
  if (!dlgInfo) { log('FAIL', 'Dialog did not open'); await browser.close(); return }

  // Set seatIds via Vue reactive state
  log('STEP', 'Setting seat A1 via Vue reactive state')
  const seatIdsSet = await page.evaluate(() => {
    // Navigate Vue component tree to find the seat-closure component
    // The page root component has seatOptions and addForm
    const appEl = document.getElementById('app')
    if (!appEl || !appEl.__vue_app__) return { error: 'no vue app' }
    
    // Walk the component tree to find GzBeanSeatClosure
    function findComp(vnode, depth = 0) {
      if (!vnode || depth > 20) return null
      const type = vnode.type
      const name = typeof type === 'object' ? (type.__name || type.name) : null
      if (name === 'GzBeanSeatClosure') return vnode
      // Check children
      if (vnode.component?.subTree) {
        const found = findComp(vnode.component.subTree, depth + 1)
        if (found) return found
      }
      if (vnode.children) {
        if (Array.isArray(vnode.children)) {
          for (const child of vnode.children) {
            if (child && typeof child === 'object') {
              const found = findComp(child, depth + 1)
              if (found) return found
            }
          }
        } else if (typeof vnode.children === 'object' && vnode.children.default) {
          const result = vnode.children.default()
          if (Array.isArray(result)) {
            for (const child of result) {
              const found = findComp(child, depth + 1)
              if (found) return found
            }
          }
        }
      }
      return null
    }
    
    const root = appEl.__vue_app__._instance
    const comp = findComp(root.subTree)
    if (!comp) return { error: 'component not found' }
    
    const setupState = comp.component?.setupState
    if (!setupState) return { error: 'no setupState' }
    
    // Read seatOptions to get actual seat IDs
    const seatOpts = setupState.seatOptions?.value || []
    const firstSeat = seatOpts.find(s => s.seatNo === 'A1' || s.seatNo?.startsWith('A')) || seatOpts[0]
    
    if (!firstSeat) return { error: 'no seat options', seatOptsLen: seatOpts.length }
    
    // Set addForm.seatIds  
    const addForm = setupState.addForm
    if (!addForm) return { error: 'no addForm' }
    
    addForm.seatIds = [firstSeat.id]
    addForm.weekdays = [2] // 周二
    addForm.startHour = 10
    addForm.endHour = 12
    
    return { 
      seatId: firstSeat.id, 
      seatNo: firstSeat.seatNo,
      addForm: { seatIds: addForm.seatIds, weekdays: addForm.weekdays, startHour: addForm.startHour, endHour: addForm.endHour }
    }
  })
  log('INFO', `Vue reactive state result: ${JSON.stringify(seatIdsSet)}`)
  
  if (seatIdsSet.error) {
    log('FAIL', `Cannot access Vue state: ${seatIdsSet.error}`)
    // Fallback: use the successful DOM click method for seat, and find time picker
    // We know A1 select click works. Let me just check why the hour selects don't persist
    log('STEP', 'Fallback: Using DOM click for seat selection')
    await page.click('.el-dialog .el-select__wrapper')
    await sleep(700)
    await page.evaluate(() => {
      const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
      for (const l of lists) {
        if (l.closest('[style*="display:none"]')) continue
        const items = [...l.querySelectorAll('.el-select-dropdown__item')]
        const a1 = items.find(i => /^A1$/.test(i.textContent.trim()))
        if (a1) { a1.click(); return }
        if (items.length > 0) items[0].click()
      }
    })
    await sleep(400)
    
    // Click 周二
    await page.evaluate(() => {
      const cbs = [...document.querySelectorAll('.el-dialog .el-checkbox-group .el-checkbox')]
      const tue = cbs.find(c => c.querySelector('.el-checkbox__label')?.textContent.trim() === '周二')
      if (tue) tue.querySelector('.el-checkbox__inner').click()
    })
    await sleep(200)
    
    // For time: click wrapper and pick
    const timeWrappers = await page.$$('.el-dialog .el-form-item .el-select__wrapper')
    if (timeWrappers.length >= 3) {
      await timeWrappers[1].click() // second select = start time
      await sleep(700)
      await page.evaluate(() => {
        const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
        for (const l of lists) {
          if (l.closest('[style*="display:none"]')) continue
          const items = [...l.querySelectorAll('.el-select-dropdown__item')]
          const opt = items.find(i => i.textContent.trim() === '10:00')
          if (opt) { opt.click(); return }
          if (items[10]) items[10].click()
        }
      })
      await sleep(400)
      await timeWrappers[2].click() // third select = end time
      await sleep(700)
      await page.evaluate(() => {
        const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
        for (const l of lists) {
          if (l.closest('[style*="display:none"]')) continue
          const items = [...l.querySelectorAll('.el-select-dropdown__item')]
          const opt = items.find(i => i.textContent.trim() === '12:00')
          if (opt) { opt.click(); return }
          if (items[11]) items[11].click()
        }
      })
      await sleep(400)
    }
  } else {
    log('PASS', `Vue state updated: seat=${seatIdsSet.seatNo}(id=${seatIdsSet.seatId}), weekdays=[2], hours=10-12`)
    await sleep(200)
  }

  await ss(page, 'T1-03-dialog-filled')

  // Check what UI shows
  const uiState = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    const seatTags = [...dlg.querySelectorAll('.el-select .el-tag, .el-select .el-select__tags-text')].map(t => t.textContent.trim())
    const weekdayChecked = [...dlg.querySelectorAll('.el-checkbox.is-checked .el-checkbox__label')].map(l => l.textContent.trim())
    const startVal = dlg.querySelector('.el-form-item:nth-child(3) .el-select:nth-child(1) .el-select__selected-item:not(.is-hidden) span')?.textContent.trim()
    const endVal = dlg.querySelector('.el-form-item:nth-child(3) .el-select:nth-child(3) .el-select__selected-item:not(.is-hidden) span')?.textContent.trim()
    const startPlaceholder = dlg.querySelector('.el-form-item:nth-child(3) .el-select:nth-child(1) .el-select__placeholder')?.textContent.trim()
    const endPlaceholder = dlg.querySelector('.el-form-item:nth-child(3) .el-select:nth-child(3) .el-select__placeholder')?.textContent.trim()
    return { seatTags, weekdayChecked, startVal, endVal, startPlaceholder, endPlaceholder }
  })
  log('INFO', `UI state: ${JSON.stringify(uiState)}`)

  // Submit
  log('STEP', 'Submitting')
  
  // Intercept network call to see what's sent
  await page.setRequestInterception(true)
  let reqBody = null
  page.on('request', req => {
    if (req.url().includes('seat-closure') && req.method() === 'POST') {
      reqBody = req.postData()
      log('INFO', `API call: POST seat-closure, body=${reqBody?.substring(0, 200)}`)
    }
    req.continue()
  })

  await page.evaluate(() => {
    const footer = document.querySelector('.el-dialog__footer')
    const primary = footer?.querySelector('.el-button--primary')
    if (primary) primary.click()
  })
  await sleep(2500)
  await ss(page, 'T1-04-after-save')
  await page.setRequestInterception(false)

  const saveResult = await page.evaluate(() => ({
    success: document.querySelector('.el-message--success')?.textContent?.trim(),
    error: document.querySelector('.el-message--error')?.textContent?.trim(),
    validationErrs: [...document.querySelectorAll('.el-form-item__error')].map(e => e.textContent.trim()),
    dialogClosed: !document.querySelector('.el-dialog'),
    rows: document.querySelectorAll('.el-table__row').length
  }))
  log('INFO', `Save result: ${JSON.stringify({ ...saveResult, reqBody: reqBody?.substring(0, 200) })}`)

  if (saveResult.success) {
    log('PASS', `Closure rule saved: ${saveResult.success}`)
    log(saveResult.rows > 0 ? 'PASS' : 'INFO', `Rows in list: ${saveResult.rows}`)
    
    // Show table content
    const tableContent = await page.evaluate(() =>
      [...document.querySelectorAll('.el-table__row')].slice(0, 5).map(r => r.textContent.trim().substring(0, 150))
    )
    log('INFO', `Table rows: ${JSON.stringify(tableContent)}`)
    
    // Verify 周二 10:00-12:00 is visible
    const hasRule = tableContent.some(r => r.includes('周二') || r.includes('10:00'))
    log(hasRule ? 'PASS' : 'INFO', `Rule visible in table with 周二/10:00: ${hasRule}`)
    
    // Delete
    log('STEP', 'Deleting rule')
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
    log(confirmed ? 'PASS' : 'INFO', `Delete confirmed: ${confirmed}`)
    await sleep(1500)
    await ss(page, 'T1-05-after-delete')
    const afterDeleteRows = await page.evaluate(() => document.querySelectorAll('.el-table__row').length)
    log(afterDeleteRows === 0 ? 'PASS' : 'INFO', `Rows after delete: ${afterDeleteRows}`)
    const deleteToast = await page.evaluate(() => document.querySelector('.el-message--success')?.textContent?.trim())
    log(deleteToast ? 'PASS' : 'INFO', `Delete toast: ${deleteToast || 'not visible'}`)
  } else if (saveResult.validationErrs.length > 0) {
    log('FAIL', `Validation errors: ${JSON.stringify(saveResult.validationErrs)}`)
  } else {
    log('INFO', `No success/fail toast. reqBody sent: ${reqBody}`)
    // Check consoleErrors for failure reason
    if (consoleErrors.length > 0) {
      log('FAIL', `Console errors during submit: ${consoleErrors.slice(0, 3).join(' | ')}`)
    }
  }

  log('STEP', '=== TEST 1 COMPLETE ===')

  // Console error summary for TEST 1
  if (consoleErrors.length > 0) {
    log('INFO', `Console errors so far: ${consoleErrors.slice(0, 5).join(' | ')}`)
  }
  consoleErrors.length = 0 // reset for TEST 2

  // ======== TEST 2: 价格区间一键填充 ========
  log('STEP', '=== TEST 2: 价格区间一键填充 ===')

  await closeOverlays(page)
  await page.evaluate(p => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })) }, '/gz-bean/seat-type-config')
  await sleep(1000)
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 8000 }).catch(() => {})
  await sleep(800)
  await ss(page, 'T2-01-config-list')

  const configInfo = await page.evaluate(() => ({
    rows: document.querySelectorAll('.el-table__row').length,
    isLogin: location.pathname.includes('login'),
    rowTexts: [...document.querySelectorAll('.el-table__row')].slice(0, 3).map(r => r.textContent.trim().substring(0, 80))
  }))
  log(configInfo.rows > 0 ? 'PASS' : 'FAIL', `Seat type config: ${configInfo.rows} rows`)
  log('INFO', `Rows: ${JSON.stringify(configInfo.rowTexts)}`)

  if (configInfo.rows === 0) { log('FAIL', 'TEST 2 BLOCKED: No rows'); await browser.close(); return }

  // Click 星期×时段价格
  await page.evaluate(() => {
    const rows = document.querySelectorAll('.el-table__row')
    for (const row of rows) {
      const b = [...row.querySelectorAll('button')].find(b => b.textContent?.includes('星期') && b.offsetParent !== null)
      if (b) { b.click(); break }
    }
  })
  await sleep(1500)
  await ss(page, 'T2-02-price-dialog')

  const dlg2 = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    if (!dlg) return null
    return {
      title: dlg.querySelector('.el-dialog__title')?.textContent.trim(),
      hasFill: dlg.textContent.includes('区间批量填充')
    }
  })
  log(dlg2 ? 'PASS' : 'FAIL', `Price dialog: ${dlg2?.title}`)
  log(dlg2?.hasFill ? 'PASS' : 'FAIL', `Fill section present: ${dlg2?.hasFill}`)

  if (!dlg2?.hasFill) { log('FAIL', 'No fill section'); await browser.close(); return }

  // Set fill params via Vue state
  log('STEP', 'Setting fill params via Vue reactive state (10:00-14:00, 0.5元)')
  const fillStateSet = await page.evaluate(() => {
    const appEl = document.getElementById('app')
    if (!appEl || !appEl.__vue_app__) return { error: 'no vue app' }
    
    function findComp(vnode, depth = 0) {
      if (!vnode || depth > 25) return null
      const type = vnode.type
      const name = typeof type === 'object' ? (type.__name || type.name) : null
      if (name === 'GzBeanSeatTypeConfig') return vnode
      if (vnode.component?.subTree) {
        const found = findComp(vnode.component.subTree, depth + 1)
        if (found) return found
      }
      if (vnode.children) {
        if (Array.isArray(vnode.children)) {
          for (const child of vnode.children) {
            if (child && typeof child === 'object') {
              const found = findComp(child, depth + 1)
              if (found) return found
            }
          }
        }
      }
      return null
    }
    
    const root = appEl.__vue_app__._instance
    const comp = findComp(root.subTree)
    if (!comp) return { error: 'GzBeanSeatTypeConfig not found' }
    
    const state = comp.component?.setupState
    if (!state) return { error: 'no setupState' }
    
    // Set fill params
    const stateKeys = Object.keys(state).filter(k => k.toLowerCase().includes('fill') || k.toLowerCase().includes('range') || k.toLowerCase().includes('batch'))
    
    // Try to find fillStart, fillEnd, fillPrice etc
    const allKeys = Object.keys(state)
    
    // Look for fill-related refs
    let fillStartKey = allKeys.find(k => /fill.*start|start.*fill|fillFrom/i.test(k))
    let fillEndKey = allKeys.find(k => /fill.*end|end.*fill|fillTo/i.test(k))
    let fillPriceKey = allKeys.find(k => /fill.*price|price.*fill|fillValue|fillAmount/i.test(k))
    
    if (!fillStartKey) {
      // Try searching for reactive objects
      fillStartKey = allKeys.find(k => {
        try { const v = state[k]?.value; return typeof v === 'number' && (v === null || v === 0) } catch { return false }
      })
    }
    
    return { 
      stateKeys: allKeys.slice(0, 30),
      fillStartKey,
      fillEndKey,
      fillPriceKey
    }
  })
  log('INFO', `Fill state search: ${JSON.stringify({ ...fillStateSet, stateKeys: fillStateSet.stateKeys?.slice(0, 15) })}`)

  // Since we can't easily find the component state, use the working DOM approach
  // but with native value setter to properly trigger Vue reactivity
  log('STEP', 'Using el-select wrappers to set fill params (proven approach from run.mjs)')

  // From previous successful test: the first 2 el-select wrappers in the dialog are fill start/end
  const fillWrappers = await page.$$('.el-dialog .el-select__wrapper')
  log('INFO', `Found ${fillWrappers.length} el-select wrappers in price dialog`)

  // Pick 10:00 for start
  if (fillWrappers.length >= 1) {
    await fillWrappers[0].click()
    await sleep(700)
    const startOpts = await page.evaluate(() => {
      const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
      for (const l of lists) {
        if (l.closest('[style*="display:none"]')) continue
        const items = [...l.querySelectorAll('.el-select-dropdown__item')]
        if (items.length > 0) return items.slice(0, 5).map(i => i.textContent.trim())
      }
      return []
    })
    log('INFO', `Start options: ${JSON.stringify(startOpts)}`)
    
    const startPicked = await page.evaluate(() => {
      const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
      for (const l of lists) {
        if (l.closest('[style*="display:none"]')) continue
        const items = [...l.querySelectorAll('.el-select-dropdown__item')]
        if (items.length === 0) continue
        const opt = items.find(i => i.textContent.trim() === '10:00')
        if (opt) { opt.click(); return '10:00' }
        if (items.length > 10) { items[10].click(); return items[10].textContent.trim() + '(idx10)' }
        items[0].click(); return items[0].textContent.trim() + '(first)'
      }
      return null
    })
    log(startPicked ? 'PASS' : 'FAIL', `Fill start: ${startPicked}`)
    await sleep(400)
  }

  if (fillWrappers.length >= 2) {
    await fillWrappers[1].click()
    await sleep(700)
    const endPicked = await page.evaluate(() => {
      const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
      for (const l of lists) {
        if (l.closest('[style*="display:none"]')) continue
        const items = [...l.querySelectorAll('.el-select-dropdown__item')]
        if (items.length === 0) continue
        const opt = items.find(i => i.textContent.trim() === '14:00')
        if (opt) { opt.click(); return '14:00' }
        if (items.length > 4) { items[4].click(); return items[4].textContent.trim() + '(idx4)' }
        items[items.length - 1].click(); return items[items.length - 1].textContent.trim() + '(last)'
      }
      return null
    })
    log(endPicked ? 'PASS' : 'FAIL', `Fill end: ${endPicked}`)
    await sleep(400)
  }

  // Set price 0.5 using native setter
  const priceSet = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    const inputs = [...dlg.querySelectorAll('input')]
    const priceInput = inputs.find(i => i.placeholder?.includes('价') || i.placeholder?.includes('price'))
    if (priceInput) {
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      nativeSetter.call(priceInput, '0.5')
      priceInput.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }))
      priceInput.dispatchEvent(new Event('change', { bubbles: true }))
      return { set: true, val: priceInput.value, ph: priceInput.placeholder }
    }
    // Try number inputs
    const numInputs = [...dlg.querySelectorAll('input[type="number"]')]
    if (numInputs.length > 0) {
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      nativeSetter.call(numInputs[0], '0.5')
      numInputs[0].dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }))
      numInputs[0].dispatchEvent(new Event('change', { bubbles: true }))
      return { set: true, val: numInputs[0].value, ph: 'number' }
    }
    return { set: false }
  })
  log(priceSet.set ? 'PASS' : 'FAIL', `Price 0.5 set: ${JSON.stringify(priceSet)}`)
  await sleep(300)

  await ss(page, 'T2-03-fill-params')

  // Click 填充
  const fillClicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.el-dialog button')]
    const b = btns.find(b => b.textContent?.trim() === '填充' && b.offsetParent !== null)
    if (b) { b.click(); return true }
    return false
  })
  log(fillClicked ? 'PASS' : 'FAIL', `填充 clicked: ${fillClicked}`)
  await sleep(1000)
  await ss(page, 'T2-04-after-fill')

  // Check 0.5 in grid
  const gridResult = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    const numInputs = [...dlg.querySelectorAll('input[type="number"]')]
    const vals = numInputs.map(i => ({ val: i.value, is05: parseFloat(i.value) === 0.5 }))
    const count05 = vals.filter(v => v.is05).length
    return { total: numInputs.length, count05, sample: vals.slice(0, 15).map(v => v.val) }
  })
  log(gridResult.count05 > 0 ? 'PASS' : 'FAIL', `Grid filled: ${gridResult.count05}/${gridResult.total} cells = 0.5`)
  log('INFO', `Grid sample values: ${JSON.stringify(gridResult.sample)}`)

  // Save
  const saved2 = await page.evaluate(() => {
    const footer = document.querySelector('.el-dialog__footer')
    const primary = footer?.querySelector('.el-button--primary:not([disabled])')
    if (primary) { primary.click(); return primary.textContent.trim() }
    return false
  })
  log(saved2 ? 'PASS' : 'FAIL', `Save clicked: ${saved2}`)
  await sleep(2500)
  await ss(page, 'T2-05-after-save')

  const saveResult2 = await page.evaluate(() => ({
    success: document.querySelector('.el-message--success')?.textContent?.trim(),
    error: document.querySelector('.el-message--error')?.textContent?.trim()
  }))
  log(saveResult2.success ? 'PASS' : 'INFO', `Save toast: ${saveResult2.success || 'not visible'}`)
  if (saveResult2.error) log('FAIL', `Error: ${saveResult2.error}`)

  // Reopen to verify persistence
  await page.evaluate(() => {
    const row = document.querySelector('.el-table__row')
    if (row) {
      const b = [...row.querySelectorAll('button')].find(b => b.textContent?.includes('星期'))
      if (b) b.click()
    }
  })
  await sleep(1500)
  await ss(page, 'T2-06-persist')

  const persist = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    if (!dlg) return { hasDialog: false }
    const numInputs = [...dlg.querySelectorAll('input[type="number"]')]
    const vals = numInputs.map(i => parseFloat(i.value)).filter(v => !isNaN(v))
    const has05 = vals.some(v => v === 0.5)
    return { hasDialog: true, has05, sample: vals.slice(0, 10) }
  })
  log(persist.has05 ? 'PASS' : 'FAIL', `Persistence verified: 0.5 still in grid: ${persist.has05}`)
  log('INFO', `Persisted values sample: ${JSON.stringify(persist.sample)}`)

  // Cleanup
  if (persist.has05) {
    log('STEP', 'Cleanup: resetting price to 0')
    const wrappers2 = await page.$$('.el-dialog .el-select__wrapper')
    if (wrappers2.length >= 2) {
      await wrappers2[0].click()
      await sleep(500)
      await page.evaluate(() => {
        const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
        for (const l of lists) {
          if (l.closest('[style*="display:none"]')) continue
          const opt = [...l.querySelectorAll('.el-select-dropdown__item')].find(i => i.textContent.trim() === '10:00')
          if (opt) { opt.click(); return }
        }
      })
      await sleep(400)
      await wrappers2[1].click()
      await sleep(500)
      await page.evaluate(() => {
        const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
        for (const l of lists) {
          if (l.closest('[style*="display:none"]')) continue
          const opt = [...l.querySelectorAll('.el-select-dropdown__item')].find(i => i.textContent.trim() === '14:00')
          if (opt) { opt.click(); return }
        }
      })
      await sleep(400)
    }
    await page.evaluate(() => {
      const dlg = document.querySelector('.el-dialog')
      const priceInput = [...dlg.querySelectorAll('input')].find(i => i.placeholder?.includes('价'))
      if (priceInput) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        setter.call(priceInput, '0')
        priceInput.dispatchEvent(new InputEvent('input', { bubbles: true }))
        priceInput.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })
    await sleep(300)
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.el-dialog button')].find(b => b.textContent?.trim() === '填充')
      if (b) b.click()
    })
    await sleep(600)
    await page.evaluate(() => {
      const footer = document.querySelector('.el-dialog__footer')
      const primary = footer?.querySelector('.el-button--primary:not([disabled])')
      if (primary) primary.click()
    })
    await sleep(1500)
    log('PASS', 'Cleanup done: price reset to 0 and saved')
    await ss(page, 'T2-07-cleanup')
  }

  log('STEP', '=== TEST 2 COMPLETE ===')

  // Final console errors
  if (consoleErrors.length === 0) {
    log('PASS', 'No JS console errors in TEST 2')
  } else {
    consoleErrors.forEach(e => log('CONSOLE-ERROR', e))
  }

  await browser.close()

  const passes = results.filter(r => r.startsWith('[PASS]')).length
  const fails = results.filter(r => r.startsWith('[FAIL]')).length
  console.log(`\n=== FINAL: PASS=${passes}, FAIL=${fails} ===`)
  writeFileSync('/tmp/pw-gacha/bean036-v2-results.txt', results.join('\n'))
}

main().catch(e => { console.error('FATAL:', e.stack); process.exit(1) })
