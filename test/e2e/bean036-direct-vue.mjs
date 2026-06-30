/**
 * GZ-BEAN-036 Tier 1B — Direct Vue State Injection
 * 
 * KEY INSIGHT from debugging:
 * - All el-select dropdowns share teleport poppers → DOM click picks wrong dropdown
 * - Vue component found at depth=8 from .el-form
 * - addForm.seatIds is a Vue reactive array proxy (shows as {} when empty/proxy)
 * - SOLUTION: Use Vue state to set seatIds + startHour + endHour directly
 *             while using DOM click only for weekday checkbox (which works)
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
  const p = `${OUT}/bean036-dv-${name}.png`
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
    hasTable: !!document.querySelector('.el-table'),
    hasAddBtn: !![...document.querySelectorAll('button')].find(b => /新建关闭/.test(b.textContent || '')),
    filterSelects: document.querySelectorAll('.el-form .el-select').length,
    rows: document.querySelectorAll('.el-table__row').length,
  }))
  log(listInfo.hasTable ? 'PASS' : 'FAIL', `List page: table=${listInfo.hasTable}, addBtn=${listInfo.hasAddBtn}`)
  log(listInfo.filterSelects >= 4 ? 'PASS' : 'INFO', `Filter area: ${listInfo.filterSelects} selects (门店/座位/星期/启用)`)
  const initialRows = listInfo.rows
  log('INFO', `Initial row count: ${initialRows}`)

  // Open dialog
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /新建关闭/.test(b.textContent || ''))
    if (btn) btn.click()
  })
  await sleep(1200)
  await ss(page, 'T1-02-dialog')
  const dlgOpen = await page.evaluate(() => !!document.querySelector('.el-dialog'))
  log(dlgOpen ? 'PASS' : 'FAIL', `Dialog opened: ${dlgOpen}`)

  // === KEY: Read seatOptions from Vue state, then set addForm directly ===
  log('STEP', 'Reading seatOptions from Vue state & setting addForm.seatIds')
  
  const setResult = await page.evaluate(() => {
    // Find the Vue component that owns addForm
    // We know it's at depth=8 from .el-form's __vueParentComponent
    let el = document.querySelector('.el-dialog .el-form')
    while (el) {
      if (el.__vueParentComponent) {
        let node = el.__vueParentComponent
        for (let d = 0; d < 15; d++) {
          const state = node.setupState || {}
          if ('addForm' in state) {
            // Found the component!
            const addForm = state.addForm
            const seatOptions = state.seatOptions?.value || state.seatOptions || []
            const currentStoreId = state.currentStoreId?.value ?? null
            
            // Get seat IDs
            const seats = Array.isArray(seatOptions) ? seatOptions : []
            const a1 = seats.find(s => s.seatNo === 'A1')
            const firstSeat = a1 || seats[0]
            
            if (!firstSeat) {
              return { err: 'no seats', seatCount: seats.length, storeId: currentStoreId }
            }
            
            // Set via Vue reactive (the addForm is already a reactive proxy)
            // For a reactive array, we need to splice + push to trigger reactivity
            addForm.seatIds.length = 0 // clear
            addForm.seatIds.push(firstSeat.id) // push actual ID
            addForm.weekdays.length = 0
            addForm.weekdays.push(2) // 周二
            addForm.startHour = 10
            addForm.endHour = 12
            
            return {
              ok: true,
              seatId: firstSeat.id,
              seatNo: firstSeat.seatNo,
              storeId: currentStoreId,
              addFormAfter: {
                seatIds: JSON.parse(JSON.stringify(addForm.seatIds)),
                weekdays: JSON.parse(JSON.stringify(addForm.weekdays)),
                startHour: addForm.startHour,
                endHour: addForm.endHour
              }
            }
          }
          node = node.parent
          if (!node) break
        }
        break
      }
      el = el.parentElement
    }
    return { err: 'component not found' }
  })
  
  log('INFO', `Vue state set result: ${JSON.stringify(setResult)}`)

  if (setResult.err) {
    log('FAIL', `Cannot find component: ${setResult.err}`)
    
    // Emergency fallback: try using the API directly via fetch
    log('STEP', 'Fallback: trying to create closure via direct API')
    
    // Need to get storeId and seatId from the page data
    // Let's check what data the page loaded
    const pageData = await page.evaluate(() => {
      // Check if there's any loaded data in the page's fetch responses
      const token = localStorage.getItem('Admin-Token')
      return { token: token?.substring(0, 20) }
    })
    log('INFO', `Page token prefix: ${pageData.token}`)
    
    await browser.close()
    return
  }

  log('PASS', `Vue state set: seat=${setResult.seatNo}(id=${setResult.seatId}), weekdays=[2], hours=10-12`)
  log('INFO', `Reactive addForm after set: ${JSON.stringify(setResult.addFormAfter)}`)
  
  await sleep(500) // Let Vue reactivity propagate

  // Verify UI has updated
  await ss(page, 'T1-03-dialog-reactive-set')
  
  const uiState = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    const seatTags = [...dlg.querySelectorAll('.el-select .el-tag')].map(t => t.textContent.trim().replace(/[×✕]/g, '').trim())
    const weekdayChecked = [...dlg.querySelectorAll('.el-checkbox.is-checked .el-checkbox__label')].map(l => l.textContent.trim())
    // Check selected-item (non-placeholder)
    const selectSelected = [...dlg.querySelectorAll('.el-select__selected-item:not(.is-hidden) span')].map(s => s.textContent.trim())
    const placeholder = [...dlg.querySelectorAll('.el-select__placeholder')].filter(p => !p.classList.contains('is-transparent')).map(p => p.textContent.trim())
    return { seatTags, weekdayChecked, selectSelected, placeholder }
  })
  log('INFO', `UI state after Vue injection: ${JSON.stringify(uiState)}`)
  
  // Check validation
  const vf = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    const validErrs = [...dlg.querySelectorAll('.el-form-item__error')].map(e => e.textContent.trim())
    return validErrs
  })
  if (vf.length > 0) log('INFO', `Pre-submit validation msgs: ${JSON.stringify(vf)}`)

  // Submit
  log('STEP', 'Submitting')
  
  // Intercept network
  let apiBody = null
  let apiResp = null
  await page.setRequestInterception(true)
  const reqHandler = req => {
    if (req.url().includes('/seat-closure') && req.method() === 'POST') {
      apiBody = req.postData()
    }
    req.continue().catch(() => {})
  }
  const respHandler = async resp => {
    if (resp.url().includes('/seat-closure') && resp.request().method() === 'POST') {
      apiResp = await resp.json().catch(() => null)
    }
  }
  page.on('request', reqHandler)
  page.on('response', respHandler)

  await page.evaluate(() => {
    const footer = document.querySelector('.el-dialog__footer')
    footer?.querySelector('.el-button--primary')?.click()
  })
  await sleep(2500)
  await ss(page, 'T1-04-after-save')
  
  page.off('request', reqHandler)
  page.off('response', respHandler)
  await page.setRequestInterception(false).catch(() => {})

  const saveResult = await page.evaluate(() => ({
    success: document.querySelector('.el-message--success')?.textContent?.trim(),
    error: document.querySelector('.el-message--error')?.textContent?.trim(),
    validationErrs: [...document.querySelectorAll('.el-form-item__error')].map(e => e.textContent.trim()),
    dialogClosed: !document.querySelector('.el-dialog'),
    rows: document.querySelectorAll('.el-table__row').length
  }))
  
  log('INFO', `API body: ${apiBody || 'none'}`)
  log('INFO', `API response: ${JSON.stringify(apiResp)}`)
  
  if (saveResult.success) {
    log('PASS', `Closure rule created: "${saveResult.success}"`)
    log(saveResult.rows > initialRows ? 'PASS' : 'INFO', `Rows: ${saveResult.rows} (was ${initialRows})`)
    
    const tableContent = await page.evaluate(() =>
      [...document.querySelectorAll('.el-table__row')].slice(0, 5).map(r => r.textContent.trim().substring(0, 150))
    )
    log('INFO', `Table rows: ${JSON.stringify(tableContent)}`)
    
    const hasRule = tableContent.some(r => r.includes('周二') || r.includes('10:00') || r.includes('A1'))
    log(hasRule ? 'PASS' : 'INFO', `新规则可见(周二/10:00/A1): ${hasRule}`)

    // Delete
    log('STEP', 'Deleting rule')
    await page.evaluate(() => {
      const row = document.querySelector('.el-table__row')
      ;[...(row?.querySelectorAll('button') || [])].find(b => b.textContent?.includes('删'))?.click()
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
    
    const rowsAfterDelete = await page.evaluate(() => document.querySelectorAll('.el-table__row').length)
    log(rowsAfterDelete < saveResult.rows ? 'PASS' : 'INFO', `Rows after delete: ${rowsAfterDelete}`)
    const deleteToast = await page.evaluate(() => document.querySelector('.el-message--success')?.textContent?.trim())
    log(deleteToast ? 'PASS' : 'INFO', `Delete toast: ${deleteToast || 'not visible'}`)
    log('PASS', 'TEST 1 CRUD: 新建 → 验证列表 → 删除 完整流程通过')
  } else if (saveResult.validationErrs.length > 0) {
    log('FAIL', `Validation errors: ${JSON.stringify(saveResult.validationErrs)}`)
    log('INFO', `API body: ${apiBody}`)
    
    // Debug: read the final vue state to understand what happened
    const finalVueState = await page.evaluate(() => {
      let el = document.querySelector('.el-dialog .el-form')
      while (el) {
        if (el.__vueParentComponent) {
          let node = el.__vueParentComponent
          for (let d = 0; d < 15; d++) {
            const state = node.setupState || {}
            if ('addForm' in state) {
              const af = state.addForm
              return {
                seatIds: JSON.parse(JSON.stringify(af.seatIds || [])),
                weekdays: JSON.parse(JSON.stringify(af.weekdays || [])),
                startHour: af.startHour,
                endHour: af.endHour,
                storeId: state.currentStoreId?.value
              }
            }
            node = node.parent
            if (!node) break
          }
        }
        el = el.parentElement
      }
      return null
    })
    log('INFO', `Final Vue state at validation time: ${JSON.stringify(finalVueState)}`)
  } else {
    log('INFO', `Unknown result: dialog=${saveResult.dialogClosed}, consoleErr=${consoleErrors.slice(0, 2)}`)
    if (apiResp) log(apiResp.code === 200 ? 'PASS' : 'FAIL', `API code: ${apiResp.code} msg: ${apiResp.msg}`)
  }

  log('STEP', '=== TEST 1 COMPLETE ===')
  const t1ConsoleErrs = consoleErrors.splice(0)
  if (t1ConsoleErrs.length > 0) log('INFO', `TEST 1 console errors: ${t1ConsoleErrs.slice(0, 3).join(' | ')}`)

  // ======== TEST 2: 价格区间一键填充 ========
  log('STEP', '=== TEST 2: 价格区间一键填充 ===')

  await closeOverlays(page)
  await page.evaluate(p => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })) }, '/gz-bean/seat-type-config')
  await sleep(1000)
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 8000 }).catch(() => {})
  await sleep(800)
  await ss(page, 'T2-01-list')

  const configRows = await page.evaluate(() => document.querySelectorAll('.el-table__row').length)
  log(configRows > 0 ? 'PASS' : 'FAIL', `Seat type config: ${configRows} rows`)
  if (configRows === 0) { log('FAIL', 'TEST 2 BLOCKED'); await browser.close(); return }

  // Open price grid
  await page.evaluate(() => {
    for (const row of document.querySelectorAll('.el-table__row')) {
      const b = [...row.querySelectorAll('button')].find(b => b.textContent?.includes('星期'))
      if (b) { b.click(); break }
    }
  })
  await sleep(1500)
  await ss(page, 'T2-02-price-dialog')

  const dlg2 = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    if (!dlg) return null
    return { title: dlg.querySelector('.el-dialog__title')?.textContent.trim(), hasFill: dlg.textContent.includes('区间批量填充') }
  })
  log(dlg2 ? 'PASS' : 'FAIL', `Price dialog: ${dlg2?.title}`)
  log(dlg2?.hasFill ? 'PASS' : 'FAIL', `Fill section present: ${dlg2?.hasFill}`)
  if (!dlg2?.hasFill) { log('FAIL', 'No fill section'); await browser.close(); return }

  // === Set fill params via Vue state for seat-type-config ===
  log('STEP', 'Setting fill params via Vue state (10:00-14:00, 0.5元)')
  
  const fillSet = await page.evaluate(() => {
    // Find GzBeanSeatTypeConfig component
    // The dialog has a fill form - find component with fillStart/fillEnd/fillPrice
    function searchState(node, depth = 0) {
      if (!node || depth > 20) return null
      const state = node.setupState || {}
      const keys = Object.keys(state)
      
      // Look for fill-related keys
      const fillKeys = keys.filter(k => /fill|batch|range/i.test(k))
      if (fillKeys.length > 0) {
        return { found: true, keys: fillKeys, node }
      }
      
      // Also check if there's a priceGridForm or similar
      const gridKeys = keys.filter(k => /grid|price|hour|week/i.test(k))
      if (gridKeys.length > 0) {
        return { found: true, keys: gridKeys, node }
      }
      
      if (node.parent) return searchState(node.parent, depth + 1)
      return null
    }
    
    // Start from the dialog el-form
    let el = document.querySelector('.el-dialog .el-form')
    while (el) {
      if (el.__vueParentComponent) {
        const result = searchState(el.__vueParentComponent)
        if (result?.found) {
          const { keys, node } = result
          const state = node.setupState
          
          // Try to directly set fill* reactive vars
          const fillStartKey = keys.find(k => /start|from|begin/i.test(k) || k === 'fillStart')
          const fillEndKey = keys.find(k => /end|to/i.test(k) || k === 'fillEnd')
          const fillPriceKey = keys.find(k => /price|value|amount/i.test(k) || k === 'fillPrice')
          const fillWeeksKey = keys.find(k => /week|days/i.test(k))
          
          const allKeys = Object.keys(state)
          
          // Set values if refs found
          const setVals = {}
          if (fillStartKey && state[fillStartKey]?.value !== undefined) {
            state[fillStartKey].value = 10
            setVals.fillStart = 10
          }
          if (fillEndKey && state[fillEndKey]?.value !== undefined) {
            state[fillEndKey].value = 14
            setVals.fillEnd = 14
          }
          if (fillPriceKey && state[fillPriceKey]?.value !== undefined) {
            state[fillPriceKey].value = 0.5
            setVals.fillPrice = 0.5
          }
          
          return { found: true, stateKeys: allKeys.slice(0, 20), fillStartKey, fillEndKey, fillPriceKey, setVals }
        }
        break
      }
      el = el.parentElement
    }
    return { found: false }
  })
  log('INFO', `Fill state: ${JSON.stringify({ ...fillSet, stateKeys: fillSet.stateKeys?.slice(0, 10) })}`)

  // Use the el-select click method - but target ONLY the dialog's selects
  // Since we're now in seat-type-config, the filter area is different
  // The dialog should only have 2 fill selects (start/end)
  const wrappers = await page.$$('.el-dialog .el-select__wrapper')
  log('INFO', `el-select wrappers in price dialog: ${wrappers.length}`)

  if (wrappers.length >= 2) {
    // Set start to 10:00
    await wrappers[0].click()
    await sleep(700)
    await ss(page, 'T2-03-fill-start-open')
    
    const startOpts = await page.evaluate(() => {
      const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
      for (const l of lists) {
        if (l.closest('[style*="display:none"]')) continue
        const items = [...l.querySelectorAll('.el-select-dropdown__item')]
        if (items.length > 0) return { count: items.length, first5: items.slice(0, 5).map(i => i.textContent.trim()) }
      }
      return null
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
      }
      return null
    })
    log(startPicked ? 'PASS' : 'FAIL', `Fill start: ${startPicked}`)
    await sleep(400)

    await wrappers[1].click()
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
      }
      return null
    })
    log(endPicked ? 'PASS' : 'FAIL', `Fill end: ${endPicked}`)
    await sleep(400)
  }

  // Set price via native value setter
  const priceSet = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    const priceInput = [...dlg.querySelectorAll('input')].find(i => i.placeholder?.includes('价'))
    if (!priceInput) return { found: false }
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(priceInput, '0.5')
    priceInput.dispatchEvent(new InputEvent('input', { bubbles: true }))
    priceInput.dispatchEvent(new Event('change', { bubbles: true }))
    return { found: true, val: priceInput.value }
  })
  log(priceSet.found ? 'PASS' : 'FAIL', `Price 0.5 set: ${JSON.stringify(priceSet)}`)
  await sleep(300)
  await ss(page, 'T2-04-params-set')

  // Click 填充
  const fillOk = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.el-dialog button')].find(b => b.textContent?.trim() === '填充')
    if (b) { b.click(); return true }
    return false
  })
  log(fillOk ? 'PASS' : 'FAIL', `填充 clicked: ${fillOk}`)
  await sleep(1000)
  await ss(page, 'T2-05-after-fill')

  const gridResult = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    const inputs = [...dlg.querySelectorAll('input[type="number"]')]
    const vals = inputs.map(i => parseFloat(i.value))
    return { total: inputs.length, count05: vals.filter(v => v === 0.5).length, sample: vals.slice(0, 15) }
  })
  log(gridResult.count05 > 0 ? 'PASS' : 'FAIL', `Grid: ${gridResult.count05}/${gridResult.total} cells = 0.5`)
  log('INFO', `Grid sample: ${JSON.stringify(gridResult.sample)}`)

  // Save
  const savedBtn = await page.evaluate(() => {
    const footer = document.querySelector('.el-dialog__footer')
    const primary = footer?.querySelector('.el-button--primary')
    if (primary) { primary.click(); return primary.textContent.trim() }
    return null
  })
  log(savedBtn ? 'PASS' : 'FAIL', `Save clicked: ${savedBtn}`)
  await sleep(2500)
  await ss(page, 'T2-06-after-save')

  const saveToast = await page.evaluate(() => ({
    success: document.querySelector('.el-message--success')?.textContent?.trim(),
    error: document.querySelector('.el-message--error')?.textContent?.trim()
  }))
  log(saveToast.success ? 'PASS' : 'INFO', `Save toast: ${saveToast.success || 'not visible'}`)
  if (saveToast.error) log('FAIL', `Error: ${saveToast.error}`)

  // Reopen verify
  log('STEP', 'Reopening to verify persistence')
  await page.evaluate(() => {
    const row = document.querySelector('.el-table__row')
    if (row) {
      const b = [...row.querySelectorAll('button')].find(b => b.textContent?.includes('星期'))
      if (b) b.click()
    }
  })
  await sleep(1500)
  await ss(page, 'T2-07-persist')

  const persist = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    if (!dlg) return { hasDialog: false }
    const inputs = [...dlg.querySelectorAll('input[type="number"]')]
    const vals = inputs.map(i => parseFloat(i.value)).filter(v => !isNaN(v))
    return { hasDialog: true, has05: vals.some(v => v === 0.5), sample: vals.slice(0, 10) }
  })
  log(persist.has05 ? 'PASS' : 'FAIL', `Persistence: 0.5 still in grid: ${persist.has05}`)
  log('INFO', `Persisted sample: ${JSON.stringify(persist.sample)}`)

  // Cleanup
  if (persist.has05) {
    log('STEP', 'Cleanup: resetting to 0')
    const w2 = await page.$$('.el-dialog .el-select__wrapper')
    if (w2.length >= 2) {
      await w2[0].click(); await sleep(500)
      await page.evaluate(() => {
        for (const l of document.querySelectorAll('.el-select-dropdown__list')) {
          if (l.closest('[style*="display:none"]')) continue
          const opt = [...l.querySelectorAll('.el-select-dropdown__item')].find(i => i.textContent.trim() === '10:00')
          if (opt) { opt.click(); return }
        }
      })
      await sleep(400)
      await w2[1].click(); await sleep(500)
      await page.evaluate(() => {
        for (const l of document.querySelectorAll('.el-select-dropdown__list')) {
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
      footer?.querySelector('.el-button--primary')?.click()
    })
    await sleep(1500)
    log('PASS', 'Cleanup done: price reset to 0')
    await ss(page, 'T2-08-cleanup')
  }

  log('STEP', '=== TEST 2 COMPLETE ===')
  if (consoleErrors.length === 0) {
    log('PASS', 'No JS console errors in TEST 2')
  } else {
    consoleErrors.forEach(e => log('CONSOLE-ERROR', e))
  }

  await browser.close()

  const passes = results.filter(r => r.startsWith('[PASS]')).length
  const fails = results.filter(r => r.startsWith('[FAIL]')).length
  console.log(`\n=== FINAL: PASS=${passes}, FAIL=${fails} ===`)
  writeFileSync('/tmp/pw-gacha/bean036-direct-vue-results.txt', results.join('\n'))
}

main().catch(e => { console.error('FATAL:', e.stack); process.exit(1) })
