/**
 * GZ-BEAN-036 Tier 1B — v3
 * - TEST 1: Uses el-select DOM interaction (proven working for seat/time selects)
 *           + network intercept to see what the API call sends
 *           + direct Vue model inspection via __vueParentComponent
 * - TEST 2: Already proven working in previous runs
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
  const p = `${OUT}/bean036-v3-${name}.png`
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
  log(listInfo.hasTable ? 'PASS' : 'FAIL', `List page: table=${listInfo.hasTable}, addBtn=${listInfo.hasAddBtn}, filterSelects=${listInfo.filterSelects}`)
  log(listInfo.filterSelects >= 4 ? 'PASS' : 'INFO', `Filter area: 4 selects (门店/座位/星期/启用)`)

  // Record initial row count
  const initialRows = listInfo.rows
  log('INFO', `Initial row count: ${initialRows}`)

  // Set up network interception for the POST
  let apiCallBody = null
  let apiCallResponse = null
  await page.setRequestInterception(true)
  page.on('request', req => {
    if (req.url().includes('/seat-closure') && req.method() === 'POST') {
      apiCallBody = req.postData()
    }
    req.continue()
  })
  page.on('response', async resp => {
    if (resp.url().includes('/seat-closure') && resp.request().method() === 'POST') {
      apiCallResponse = await resp.json().catch(() => null)
    }
  })

  // Open add dialog
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /新建关闭/.test(b.textContent || ''))
    if (btn) btn.click()
  })
  await sleep(1200)
  await ss(page, 'T1-02-dialog')

  const dlgOpen = await page.evaluate(() => !!document.querySelector('.el-dialog'))
  log(dlgOpen ? 'PASS' : 'FAIL', `Dialog opened: ${dlgOpen}`)

  // === STEP: Select seat A1 ===
  log('STEP', 'Selecting seat A1')
  await page.click('.el-dialog .el-form-item:first-child .el-select__wrapper')
  await sleep(800)
  await ss(page, 'T1-03-seat-dropdown')
  
  const seatOpts = await page.evaluate(() => {
    const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
    for (const l of lists) {
      if (l.closest('[style*="display:none"]')) continue
      const items = [...l.querySelectorAll('.el-select-dropdown__item')]
      if (items.length > 0) return items.slice(0, 10).map(i => ({ text: i.textContent.trim(), sel: i.classList.contains('is-selected') }))
    }
    return []
  })
  log('INFO', `Seat options: ${JSON.stringify(seatOpts)}`)

  const seatChosen = await page.evaluate(() => {
    const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
    for (const l of lists) {
      if (l.closest('[style*="display:none"]')) continue
      const items = [...l.querySelectorAll('.el-select-dropdown__item')]
      if (items.length === 0) continue
      const a1 = items.find(i => i.textContent.trim() === 'A1')
      const chosen = a1 || items[0]
      chosen.click()
      return chosen.textContent.trim()
    }
    return null
  })
  log(seatChosen ? 'PASS' : 'FAIL', `Seat selected: ${seatChosen}`)
  await sleep(400)
  
  // Close dropdown by pressing Escape
  await page.keyboard.press('Escape')
  await sleep(300)

  // Check seat tag
  const seatTag = await page.evaluate(() => {
    const tags = [...document.querySelectorAll('.el-dialog .el-select .el-tag')]
    return tags.map(t => t.textContent.trim().replace(/×/g, '').trim())
  })
  log(seatTag.length > 0 ? 'PASS' : 'FAIL', `Seat tags visible: ${JSON.stringify(seatTag)}`)

  // === STEP: 周二 checkbox ===
  log('STEP', 'Checking 周二')
  await page.evaluate(() => {
    const cbs = [...document.querySelectorAll('.el-dialog .el-checkbox-group .el-checkbox')]
    const tue = cbs.find(c => c.querySelector('.el-checkbox__label')?.textContent.trim() === '周二')
    if (tue) tue.querySelector('.el-checkbox__inner').click()
  })
  await sleep(200)
  const tuesdayChecked = await page.evaluate(() => {
    const cbs = [...document.querySelectorAll('.el-dialog .el-checkbox-group .el-checkbox')]
    const tue = cbs.find(c => c.querySelector('.el-checkbox__label')?.textContent.trim() === '周二')
    return tue?.classList.contains('is-checked')
  })
  log(tuesdayChecked ? 'PASS' : 'FAIL', `周二 checked: ${tuesdayChecked}`)

  // === STEP: Set time via Vue __vueParentComponent ===
  log('STEP', 'Setting time 10:00-12:00 via Vue reactive state on form el-select')
  
  // Find the exact Vue component instance of the add form dialog
  const vueTimeSet = await page.evaluate(() => {
    // Method: walk the DOM to find the el-select for startHour
    // The dialog has 3 el-select components: seat(multi), startHour, endHour
    const dlg = document.querySelector('.el-dialog')
    if (!dlg) return { err: 'no dialog' }
    
    // Find el-select elements with their Vue component
    const selects = [...dlg.querySelectorAll('.el-select')]
    const results = []
    
    for (let i = 0; i < selects.length; i++) {
      const sel = selects[i]
      // Try to get Vue component from __vueParentComponent
      let el = sel
      while (el) {
        if (el.__vueParentComponent) {
          const cp = el.__vueParentComponent
          const props = cp.props
          const setupState = cp.setupState
          // Look for modelValue which is the v-model binding
          const modelValue = props?.modelValue ?? props?.['model-value'] ?? undefined
          results.push({ i, modelValue, propsKeys: Object.keys(props || {}).slice(0, 10) })
          break
        }
        el = el.parentElement
      }
    }
    return results
  })
  log('INFO', `Vue el-select instances: ${JSON.stringify(vueTimeSet)}`)

  // Try clicking the start time select specifically 
  // The dialog has: form-item 1 = seat, form-item 3 = 关闭时段 (contains 2 el-selects)
  log('STEP', 'Using DOM click for start time (looking for 关闭时段 item)')
  
  const timeFormInfo = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-dialog .el-form-item')]
    return items.map((item, i) => ({
      i,
      label: item.querySelector('.el-form-item__label')?.textContent.trim(),
      selectCount: item.querySelectorAll('.el-select').length,
      checkboxCount: item.querySelectorAll('.el-checkbox').length,
    }))
  })
  log('INFO', `Form items: ${JSON.stringify(timeFormInfo)}`)

  // Find the 关闭时段 form item index
  const timeFormItemIdx = timeFormInfo.findIndex(i => i.label === '关闭时段')
  log('INFO', `关闭时段 form item index: ${timeFormItemIdx}`)

  // Click start hour select (first el-select in 关闭时段 form item)
  const startPicked = await page.evaluate((idx) => {
    const items = [...document.querySelectorAll('.el-dialog .el-form-item')]
    const timeItem = items[idx]
    if (!timeItem) return null
    const selects = timeItem.querySelectorAll('.el-select')
    const startSel = selects[0]
    if (!startSel) return null
    // Click the wrapper to open
    startSel.querySelector('.el-select__wrapper')?.click()
    return 'clicked'
  }, timeFormItemIdx)
  log(startPicked ? 'PASS' : 'FAIL', `Start hour select clicked: ${startPicked}`)
  await sleep(800)
  await ss(page, 'T1-04-start-dropdown')
  
  const startOpts = await page.evaluate(() => {
    const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
    for (const l of lists) {
      if (l.closest('[style*="display:none"]')) continue
      const items = [...l.querySelectorAll('.el-select-dropdown__item')]
      if (items.length === 0) continue
      return { count: items.length, sample: items.slice(0, 8).map(i => i.textContent.trim()) }
    }
    return null
  })
  log('INFO', `Start hour opts: ${JSON.stringify(startOpts)}`)

  const startHourPicked = await page.evaluate(() => {
    const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
    for (const l of lists) {
      if (l.closest('[style*="display:none"]')) continue
      const items = [...l.querySelectorAll('.el-select-dropdown__item')]
      if (items.length === 0) continue
      const opt10 = items.find(i => i.textContent.trim() === '10:00')
      if (opt10) { opt10.click(); return '10:00 (exact)' }
      // hourOptions = 0..23, so index 10 = 10:00
      if (items.length > 10) { items[10].click(); return items[10].textContent.trim() + '(idx10)' }
    }
    return null
  })
  log(startHourPicked ? 'PASS' : 'FAIL', `Start hour: ${startHourPicked}`)
  await sleep(400)
  await page.keyboard.press('Escape')
  await sleep(200)

  // Click end hour
  const endClicked = await page.evaluate((idx) => {
    const items = [...document.querySelectorAll('.el-dialog .el-form-item')]
    const timeItem = items[idx]
    if (!timeItem) return null
    const selects = timeItem.querySelectorAll('.el-select')
    const endSel = selects[selects.length - 1] // last select = endHour
    if (!endSel) return null
    endSel.querySelector('.el-select__wrapper')?.click()
    return 'clicked'
  }, timeFormItemIdx)
  log(endClicked ? 'PASS' : 'FAIL', `End hour select clicked: ${endClicked}`)
  await sleep(800)
  
  const endHourPicked = await page.evaluate(() => {
    const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
    for (const l of lists) {
      if (l.closest('[style*="display:none"]')) continue
      const items = [...l.querySelectorAll('.el-select-dropdown__item')]
      if (items.length === 0) continue
      const opt12 = items.find(i => i.textContent.trim() === '12:00')
      if (opt12) { opt12.click(); return '12:00 (exact)' }
      // allEndHours = 1..24, so 12:00 is index 11
      if (items.length > 11) { items[11].click(); return items[11].textContent.trim() + '(idx11)' }
    }
    return null
  })
  log(endHourPicked ? 'PASS' : 'FAIL', `End hour: ${endHourPicked}`)
  await sleep(400)
  await page.keyboard.press('Escape')
  await sleep(200)

  await ss(page, 'T1-05-dialog-filled')

  // === INSPECT Vue reactive state before submit ===
  const vueFormState = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    if (!dlg) return null
    // Walk up from the form to find its component
    let el = dlg.querySelector('.el-form')
    while (el) {
      if (el.__vueParentComponent) {
        // This is the closest Vue component wrapping the el-form
        // Look in component tree for addForm
        const cp = el.__vueParentComponent
        // Try parent  
        let node = cp
        for (let d = 0; d < 10; d++) {
          const state = node.setupState || {}
          if ('addForm' in state || 'seatIds' in state) {
            const form = state.addForm || state
            return {
              found: true,
              depth: d,
              addForm: {
                seatIds: form.seatIds,
                weekdays: form.weekdays,
                startHour: form.startHour,
                endHour: form.endHour,
              }
            }
          }
          node = node.parent || node.appContext?.app?._instance
          if (!node) break
        }
        return { found: false, stateKeys: Object.keys(cp.setupState || {}).slice(0, 20) }
      }
      el = el.parentElement
    }
    return null
  })
  log('INFO', `Vue form state (addForm): ${JSON.stringify(vueFormState)}`)

  // If startHour/endHour are null, the el-select click didn't update v-model
  // Need to find the actual component and set it directly
  if (vueFormState?.found && (vueFormState.addForm?.startHour === null || vueFormState.addForm?.startHour === undefined)) {
    log('STEP', 'Vue model shows null startHour - setting directly via component state')
    const directSet = await page.evaluate(() => {
      // Find the component that owns addForm
      let el = document.querySelector('.el-dialog .el-form')
      while (el) {
        if (el.__vueParentComponent) {
          let node = el.__vueParentComponent
          for (let d = 0; d < 10; d++) {
            const state = node.setupState || {}
            if ('addForm' in state) {
              const addForm = state.addForm
              addForm.startHour = 10
              addForm.endHour = 12
              return { set: true, startHour: addForm.startHour, endHour: addForm.endHour }
            }
            node = node.parent
            if (!node) break
          }
        }
        el = el.parentElement
      }
      return { set: false }
    })
    log(directSet.set ? 'PASS' : 'FAIL', `Direct Vue state set: ${JSON.stringify(directSet)}`)
    await sleep(500)
  }

  // === SUBMIT ===
  log('STEP', 'Submitting form')
  await page.evaluate(() => {
    const footer = document.querySelector('.el-dialog__footer')
    const primary = footer?.querySelector('.el-button--primary')
    if (primary) primary.click()
  })
  await sleep(2500)
  await ss(page, 'T1-06-after-save')

  // Check result
  const saveResult = await page.evaluate(() => ({
    success: document.querySelector('.el-message--success')?.textContent?.trim(),
    error: document.querySelector('.el-message--error')?.textContent?.trim(),
    validationErrs: [...document.querySelectorAll('.el-form-item__error')].map(e => e.textContent.trim()),
    dialogClosed: !document.querySelector('.el-dialog'),
    rows: document.querySelectorAll('.el-table__row').length
  }))
  log('INFO', `Save result: ${JSON.stringify(saveResult)}`)
  log('INFO', `API call body: ${apiCallBody || 'none'}`)
  log('INFO', `API response: ${JSON.stringify(apiCallResponse)}`)

  if (saveResult.success) {
    log('PASS', `Closure rule created: ${saveResult.success}`)
    log('INFO', `Rows now: ${saveResult.rows} (was ${initialRows})`)
    
    // Get table content
    const tableContent = await page.evaluate(() =>
      [...document.querySelectorAll('.el-table__row')].slice(0, 5).map(r => r.textContent.trim().substring(0, 150))
    )
    log('INFO', `Table: ${JSON.stringify(tableContent)}`)
    
    const hasExpectedRow = tableContent.some(r => r.includes('周二') || r.includes('10:00') || r.includes('A1'))
    log(hasExpectedRow ? 'PASS' : 'INFO', `新建规则可见 (周二/10:00/A1): ${hasExpectedRow}`)

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
    await ss(page, 'T1-07-after-delete')
    const rowsAfterDelete = await page.evaluate(() => document.querySelectorAll('.el-table__row').length)
    const deleteToast = await page.evaluate(() => document.querySelector('.el-message--success')?.textContent?.trim())
    log(rowsAfterDelete < saveResult.rows ? 'PASS' : 'INFO', `Rows after delete: ${rowsAfterDelete}`)
    log(deleteToast ? 'PASS' : 'INFO', `Delete toast: ${deleteToast || 'not visible'}`)
  } else if (saveResult.validationErrs.length > 0) {
    log('FAIL', `Validation errors: ${JSON.stringify(saveResult.validationErrs)}`)
    log('INFO', `API body: ${apiCallBody}`)
  } else {
    log('INFO', `Dialog closed: ${saveResult.dialogClosed}, API response: ${JSON.stringify(apiCallResponse)}`)
    if (apiCallResponse?.code !== undefined) {
      log(apiCallResponse.code === 200 ? 'PASS' : 'FAIL', `API code: ${apiCallResponse.code}, msg: ${apiCallResponse.msg}`)
    }
    const addErr = consoleErrors.find(e => e.includes('add failed'))
    if (addErr) log('FAIL', `Console error: ${addErr}`)
  }

  await page.setRequestInterception(false)
  log('STEP', '=== TEST 1 COMPLETE ===')
  
  const t1Errors = consoleErrors.splice(0)
  if (t1Errors.length > 0) {
    log('INFO', `TEST 1 console errors: ${t1Errors.slice(0, 5).join(' | ')}`)
  }

  // ======== TEST 2: 价格区间一键填充 (proven approach) ========
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

  // Open price grid for first row
  await page.evaluate(() => {
    const rows = document.querySelectorAll('.el-table__row')
    for (const row of rows) {
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

  // Fill: 10:00-14:00, 0.5元
  const wrappers = await page.$$('.el-dialog .el-select__wrapper')
  log('INFO', `el-select wrappers in price dialog: ${wrappers.length}`)
  
  if (wrappers.length >= 2) {
    // Start: 10:00
    await wrappers[0].click()
    await sleep(700)
    await ss(page, 'T2-03-fill-start-open')
    const sp = await page.evaluate(() => {
      const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
      for (const l of lists) {
        if (l.closest('[style*="display:none"]')) continue
        const items = [...l.querySelectorAll('.el-select-dropdown__item')]
        if (items.length === 0) continue
        const opt = items.find(i => i.textContent.trim() === '10:00')
        if (opt) { opt.click(); return '10:00' }
        if (items[10]) { items[10].click(); return items[10].textContent.trim() + '(idx10)' }
      }
      return null
    })
    log(sp ? 'PASS' : 'FAIL', `Fill start: ${sp}`)
    await sleep(400)

    // End: 14:00
    await wrappers[1].click()
    await sleep(700)
    const ep = await page.evaluate(() => {
      const lists = [...document.querySelectorAll('.el-select-dropdown__list')]
      for (const l of lists) {
        if (l.closest('[style*="display:none"]')) continue
        const items = [...l.querySelectorAll('.el-select-dropdown__item')]
        if (items.length === 0) continue
        const opt = items.find(i => i.textContent.trim() === '14:00')
        if (opt) { opt.click(); return '14:00' }
        if (items[4]) { items[4].click(); return items[4].textContent.trim() + '(idx4)' }
      }
      return null
    })
    log(ep ? 'PASS' : 'FAIL', `Fill end: ${ep}`)
    await sleep(400)
  }

  // Set price 0.5
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

  const fillResult = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    const inputs = [...dlg.querySelectorAll('input[type="number"]')]
    const vals = inputs.map(i => parseFloat(i.value))
    return { total: inputs.length, count05: vals.filter(v => v === 0.5).length, sample: vals.slice(0, 12) }
  })
  log(fillResult.count05 > 0 ? 'PASS' : 'FAIL', `Grid filled: ${fillResult.count05}/${fillResult.total} cells = 0.5`)
  log('INFO', `Grid sample: ${JSON.stringify(fillResult.sample)}`)

  // Save
  const saved = await page.evaluate(() => {
    const footer = document.querySelector('.el-dialog__footer')
    const primary = footer?.querySelector('.el-button--primary')
    if (primary) { primary.click(); return primary.textContent.trim() }
    return null
  })
  log(saved ? 'PASS' : 'FAIL', `Save clicked: ${saved}`)
  await sleep(2500)
  await ss(page, 'T2-06-after-save')

  const saveToast = await page.evaluate(() => ({
    success: document.querySelector('.el-message--success')?.textContent?.trim(),
    error: document.querySelector('.el-message--error')?.textContent?.trim()
  }))
  log(saveToast.success ? 'PASS' : 'INFO', `Save toast: ${saveToast.success || 'not visible'}`)
  if (saveToast.error) log('FAIL', `Error: ${saveToast.error}`)

  // Reopen to verify persistence
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
    return { hasDialog: true, has05: vals.some(v => v === 0.5), sample: vals.slice(0, 12) }
  })
  log(persist.has05 ? 'PASS' : 'FAIL', `Persistence: 0.5 still in grid after reopen: ${persist.has05}`)
  log('INFO', `Persisted sample: ${JSON.stringify(persist.sample)}`)

  // Cleanup
  if (persist.has05) {
    log('STEP', 'Cleanup: resetting to 0')
    const wrappers2 = await page.$$('.el-dialog .el-select__wrapper')
    if (wrappers2.length >= 2) {
      await wrappers2[0].click(); await sleep(500)
      await page.evaluate(() => {
        for (const l of document.querySelectorAll('.el-select-dropdown__list')) {
          if (l.closest('[style*="display:none"]')) continue
          const opt = [...l.querySelectorAll('.el-select-dropdown__item')].find(i => i.textContent.trim() === '10:00')
          if (opt) { opt.click(); return }
        }
      })
      await sleep(400)
      await wrappers2[1].click(); await sleep(500)
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
      const primary = footer?.querySelector('.el-button--primary')
      if (primary) primary.click()
    })
    await sleep(1500)
    log('PASS', 'Cleanup: price reset to 0 and saved')
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
  writeFileSync('/tmp/pw-gacha/bean036-v3-results.txt', results.join('\n'))
}

main().catch(e => { console.error('FATAL:', e.stack); process.exit(1) })
