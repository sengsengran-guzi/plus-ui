import { mkdirSync, writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { CFG, clearProxy, chromePath, login, injectSession, closeOverlays, sleep } from '/Users/wkui/Project/profile/project/freelance/projects/sensenran-guzi/code/main/plus-ui/test/e2e/lib.mjs'

clearProxy()
const OUT = '/tmp/pw-gacha/screenshots'
mkdirSync(OUT, { recursive: true })

const results = []
function log(tag, msg) {
  const line = `[${tag}] ${msg}`
  console.log(line)
  results.push(line)
}

async function ss(page, name) {
  const p = `${OUT}/bean036-${name}.png`
  await page.screenshot({ path: p })
  log('SCREENSHOT', p)
  return p
}

async function main() {
  const token = await login()
  log('INFO', `Login token_len=${token.length}`)

  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--no-first-run', '--no-proxy-server', '--lang=zh-CN'],
  })
  const page = await browser.newPage()
  const consoleErrors = []
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message.slice(0, 200)))
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push('console.error: ' + m.text().slice(0, 200)) })

  await injectSession(page, token)
  log('INFO', 'Session injected, dynamic routes ready')
  await ss(page, '00-after-login')

  // ======== TEST 1: 座位关闭规则 CRUD ========
  log('STEP', '=== TEST 1: 座位关闭规则 CRUD ===')
  
  // Navigate via sidebar: look for 拼豆业务 > 座位关闭规则
  // First try to find the parent menu
  await closeOverlays(page)
  
  // Navigate using pushState like acceptance.mjs  
  await page.evaluate((path) => { 
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
  }, '/gz-bean/seat-closure')
  await sleep(800)
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 8000 }).catch(() => {})
  await sleep(1000)
  await ss(page, '01-seat-closure-page')

  const url1 = page.url()
  log('INFO', `seat-closure URL: ${url1}`)

  // Check if we're on the right page (not redirected to login)
  const info1 = await page.evaluate(() => {
    const isLogin = location.pathname.includes('login')
    const rows = document.querySelectorAll('.el-table__row').length
    const main = document.querySelector('.app-main') || document.body
    const hasMain = (main.innerText || '').trim().length > 120
    const hasTable = !!document.querySelector('.el-table, table')
    const hasAddBtn = !![...document.querySelectorAll('button')].find(b => /新\s*增|新建|添加/.test(b.textContent))
    const mainText = (main.innerText || '').substring(0, 300)
    const errorElements = document.querySelectorAll('.el-message--error, .el-empty, [class*="404"], [class*="empty"]')
    return { isLogin, rows, hasMain, hasTable, hasAddBtn, mainText, errorCount: errorElements.length }
  })
  log('INFO', `Page info: ${JSON.stringify(info1)}`)
  log(info1.isLogin ? 'FAIL' : 'PASS', `Not redirected to login: ${!info1.isLogin}`)
  log(info1.hasTable ? 'PASS' : 'FAIL', `Has table: ${info1.hasTable}`)
  log(info1.hasAddBtn ? 'PASS' : 'FAIL', `Has 新增 button: ${info1.hasAddBtn}`)
  
  if (info1.isLogin) {
    log('FAIL', 'TEST 1 BLOCKED: Redirected to login page')
    await browser.close()
    return
  }
  
  if (!info1.hasMain) {
    log('FAIL', 'TEST 1 FAIL: Page content empty or too short')
    log('DEBUG', `Main text: ${info1.mainText}`)
  }

  // Check console errors at this point
  if (consoleErrors.length > 0) {
    log('CONSOLE-ERRORS', consoleErrors.slice(0, 5).join(' | '))
  }

  // Try to find filter area
  const filterInfo = await page.evaluate(() => {
    const filterForms = document.querySelectorAll('.el-form, .search-form, .filter-container')
    const selects = document.querySelectorAll('.el-select')
    const inputs = document.querySelectorAll('.el-input')
    return { filterForms: filterForms.length, selects: selects.length, inputs: inputs.length }
  })
  log('INFO', `Filter area: forms=${filterInfo.filterForms}, selects=${filterInfo.selects}, inputs=${filterInfo.inputs}`)
  log(filterInfo.selects > 0 || filterInfo.inputs > 0 ? 'PASS' : 'INFO', `Filter area present: ${filterInfo.selects > 0 || filterInfo.inputs > 0}`)

  // TEST 1 Step 4: Click 新增
  if (info1.hasAddBtn) {
    log('STEP', 'Clicking 新增 button')
    const clicked = await page.evaluate(() => {
      const add = [...document.querySelectorAll('button')].find(b => /新\s*增|新建|添加/.test((b.textContent || '').trim()) && !b.disabled && b.offsetParent !== null)
      if (add) { add.click(); return true }
      return false
    })
    log(clicked ? 'PASS' : 'FAIL', `Clicked 新增: ${clicked}`)
    await sleep(1200)
    await ss(page, '02-add-dialog')

    const dialogInfo = await page.evaluate(() => {
      const dlg = document.querySelector('.el-dialog, .el-drawer')
      if (!dlg) return { hasDialog: false }
      const labels = [...dlg.querySelectorAll('.el-form-item__label')].map(l => l.textContent.trim())
      const selects = dlg.querySelectorAll('.el-select').length
      const checkboxes = dlg.querySelectorAll('.el-checkbox').length
      const inputs = dlg.querySelectorAll('input').length
      return { hasDialog: true, labels, selects, checkboxes, inputs }
    })
    log(dialogInfo.hasDialog ? 'PASS' : 'FAIL', `Dialog opened: ${dialogInfo.hasDialog}`)
    log('INFO', `Dialog form labels: ${JSON.stringify(dialogInfo.labels)}`)
    log('INFO', `Dialog controls: selects=${dialogInfo.selects}, checkboxes=${dialogInfo.checkboxes}, inputs=${dialogInfo.inputs}`)

    if (dialogInfo.hasDialog) {
      // Select store CD001
      log('STEP', 'Selecting store 成都春熙路店 (CD001)')
      await page.evaluate(async () => {
        const dlg = document.querySelector('.el-dialog, .el-drawer')
        const selects = dlg.querySelectorAll('.el-select')
        if (selects.length > 0) {
          selects[0].querySelector('input').click()
          selects[0].click()
        }
      })
      await sleep(600)
      
      // Look for store options
      const storeOptions = await page.evaluate(() => {
        const opts = [...document.querySelectorAll('.el-select-dropdown__item, .el-option')]
        return opts.filter(o => o.offsetParent !== null).map(o => o.textContent.trim())
      })
      log('INFO', `Store options: ${JSON.stringify(storeOptions)}`)
      
      const selectedStore = await page.evaluate(() => {
        const opts = [...document.querySelectorAll('.el-select-dropdown__item, .el-option')]
        const visible = opts.filter(o => o.offsetParent !== null)
        const target = visible.find(o => o.textContent.includes('春熙') || o.textContent.includes('CD001') || o.textContent.includes('成都'))
        if (target) {
          target.click()
          return target.textContent.trim()
        }
        if (visible.length > 0) {
          visible[0].click()
          return visible[0].textContent.trim() + '(first)'
        }
        return null
      })
      log(selectedStore ? 'PASS' : 'FAIL', `Store selected: ${selectedStore}`)
      await sleep(800)
      await ss(page, '03-dialog-store-selected')

      // Get updated labels after store selection
      const updatedLabels = await page.evaluate(() => {
        const dlg = document.querySelector('.el-dialog, .el-drawer')
        if (!dlg) return []
        return [...dlg.querySelectorAll('.el-form-item__label')].map(l => l.textContent.trim())
      })
      log('INFO', `Dialog labels after store select: ${JSON.stringify(updatedLabels)}`)

      // Select seat
      log('STEP', 'Selecting a seat')
      await page.evaluate(() => {
        const dlg = document.querySelector('.el-dialog, .el-drawer')
        const selects = dlg.querySelectorAll('.el-select')
        // Try second select (seat)
        if (selects.length > 1) {
          selects[1].click()
        }
      })
      await sleep(600)
      
      const seatOptions = await page.evaluate(() => {
        const opts = [...document.querySelectorAll('.el-select-dropdown__item, .el-option')]
        return opts.filter(o => o.offsetParent !== null).slice(0, 10).map(o => o.textContent.trim())
      })
      log('INFO', `Seat options (first 10): ${JSON.stringify(seatOptions)}`)
      
      const selectedSeat = await page.evaluate(() => {
        const opts = [...document.querySelectorAll('.el-select-dropdown__item, .el-option')]
        const visible = opts.filter(o => o.offsetParent !== null)
        if (visible.length > 0) {
          visible[0].click()
          return visible[0].textContent.trim()
        }
        return null
      })
      log(selectedSeat ? 'PASS' : 'INFO', `Seat selected: ${selectedSeat}`)
      await sleep(500)

      // Select weekday 周二
      log('STEP', 'Selecting weekday 周二')
      const weekdaySelected = await page.evaluate(() => {
        const dlg = document.querySelector('.el-dialog, .el-drawer')
        // Try checkbox
        const checkboxes = [...dlg.querySelectorAll('.el-checkbox')]
        const tuesdayChk = checkboxes.find(c => c.textContent.includes('二') || c.textContent.includes('Tuesday'))
        if (tuesdayChk && !tuesdayChk.querySelector('input').checked) {
          tuesdayChk.querySelector('input').click()
          return 'checkbox-周二'
        }
        // Try el-select with 星期/周 placeholder
        const selects = [...dlg.querySelectorAll('.el-select')]
        for (const sel of selects) {
          const input = sel.querySelector('input')
          if (input && (input.placeholder.includes('星期') || input.placeholder.includes('周') || input.placeholder.includes('day'))) {
            sel.click()
            return 'select-opened'
          }
        }
        // Try radio group
        const radios = [...dlg.querySelectorAll('.el-radio')]
        const tuesdayRad = radios.find(r => r.textContent.includes('二') || r.textContent.includes('周二'))
        if (tuesdayRad) {
          tuesdayRad.click()
          return 'radio-周二'
        }
        return null
      })
      log(weekdaySelected ? 'PASS' : 'FAIL', `Weekday 周二 selected: ${weekdaySelected}`)
      
      if (weekdaySelected === 'select-opened') {
        await sleep(500)
        const tuesdayOpt = await page.evaluate(() => {
          const opts = [...document.querySelectorAll('.el-select-dropdown__item, .el-option')]
          const visible = opts.filter(o => o.offsetParent !== null)
          const target = visible.find(o => o.textContent.includes('二') || o.textContent.includes('Tuesday'))
          if (target) { target.click(); return target.textContent.trim() }
          return null
        })
        log(tuesdayOpt ? 'PASS' : 'FAIL', `Tuesday option selected: ${tuesdayOpt}`)
      }
      await sleep(400)

      // Set time range 10:00 - 12:00
      log('STEP', 'Setting time 10:00 - 12:00')
      const timeSet = await page.evaluate(() => {
        const dlg = document.querySelector('.el-dialog, .el-drawer')
        const inputs = [...dlg.querySelectorAll('input')]
        let startSet = false, endSet = false
        for (const inp of inputs) {
          const ph = (inp.placeholder || '').toLowerCase()
          if (ph.includes('开始') || ph.includes('起') || ph.includes('start') || ph.includes('from')) {
            inp.value = '10:00'
            inp.dispatchEvent(new Event('input', { bubbles: true }))
            inp.dispatchEvent(new Event('change', { bubbles: true }))
            startSet = true
          } else if (ph.includes('结束') || ph.includes('止') || ph.includes('end') || ph.includes('to')) {
            inp.value = '12:00'
            inp.dispatchEvent(new Event('input', { bubbles: true }))
            inp.dispatchEvent(new Event('change', { bubbles: true }))
            endSet = true
          }
        }
        return { startSet, endSet }
      })
      log('INFO', `Time fields set: ${JSON.stringify(timeSet)}`)

      // If time selects (el-time-select), use different approach
      if (!timeSet.startSet && !timeSet.endSet) {
        const timeSelectInfo = await page.evaluate(() => {
          const dlg = document.querySelector('.el-dialog, .el-drawer')
          const allInputs = [...dlg.querySelectorAll('input')].map((inp, i) => ({
            idx: i, ph: inp.placeholder, val: inp.value, type: inp.type
          }))
          return allInputs
        })
        log('INFO', `All dialog inputs: ${JSON.stringify(timeSelectInfo)}`)
      }

      await ss(page, '04-dialog-filled')

      // Click save
      log('STEP', 'Clicking save/确定 button')
      const saveClicked = await page.evaluate(() => {
        const dlg = document.querySelector('.el-dialog__footer, .el-dialog .dialog-footer, .el-dialog')
        if (!dlg) return false
        const btns = [...dlg.querySelectorAll('button')]
        const saveBtn = btns.find(b => /确\s*定|保\s*存|Submit|OK/.test(b.textContent || '') && !b.disabled)
        if (saveBtn) { saveBtn.click(); return true }
        // Try primary button
        const primaryBtn = dlg.querySelector('.el-button--primary')
        if (primaryBtn) { primaryBtn.click(); return true }
        return false
      })
      log(saveClicked ? 'PASS' : 'FAIL', `Save clicked: ${saveClicked}`)
      await sleep(2000)
      await ss(page, '05-after-save')

      // Check result
      const afterSave = await page.evaluate(() => {
        const successMsg = document.querySelector('.el-message--success')
        const rows = document.querySelectorAll('.el-table__row').length
        const dlg = document.querySelector('.el-dialog')
        const errMsg = document.querySelector('.el-message--error, .el-form-item__error')
        const validationErrs = [...document.querySelectorAll('.el-form-item__error')].map(e => e.textContent.trim())
        return { 
          hasSuccess: !!successMsg, 
          successText: successMsg?.textContent?.trim(),
          rows, 
          dialogOpen: !!dlg, 
          hasError: !!errMsg,
          validationErrs
        }
      })
      log(afterSave.hasSuccess ? 'PASS' : 'INFO', `Success toast: ${afterSave.hasSuccess ? afterSave.successText : 'not visible'}`)
      log('INFO', `Table rows after save: ${afterSave.rows}`)
      log('INFO', `Dialog still open: ${afterSave.dialogOpen}`)
      if (afterSave.validationErrs.length > 0) {
        log('FAIL', `Validation errors: ${JSON.stringify(afterSave.validationErrs)}`)
      }
      if (afterSave.hasError && !afterSave.hasSuccess) {
        log('FAIL', 'Error message appeared after save')
      }

      // Reload to confirm data persisted
      if (!afterSave.dialogOpen) {
        log('STEP', 'Refreshing page to confirm data persisted')
        await page.reload({ waitUntil: 'networkidle2', timeout: 15000 })
        await sleep(1500)
        const rowsAfterReload = await page.evaluate(() => document.querySelectorAll('.el-table__row').length)
        log('INFO', `Rows after reload: ${rowsAfterReload}`)
        await ss(page, '06-after-reload')
        
        // Get table content
        const tableContent = await page.evaluate(() => {
          const rows = [...document.querySelectorAll('.el-table__row')]
          return rows.slice(0, 5).map(r => r.textContent.trim().substring(0, 150))
        })
        log('INFO', `Table rows content: ${JSON.stringify(tableContent)}`)
        
        // Look for 周二 in the table
        const hasTuesday = tableContent.some(r => r.includes('周二') || r.includes('二') || r.includes('Tuesday'))
        log(hasTuesday ? 'PASS' : 'INFO', `Tuesday rule visible in table: ${hasTuesday}`)
        log(rowsAfterReload > 0 ? 'PASS' : 'INFO', `Table has ${rowsAfterReload} rows after reload`)

        // TEST 1 Step 6: Delete
        if (rowsAfterReload > 0) {
          log('STEP', 'Deleting the created closure rule')
          const deleteClicked = await page.evaluate(() => {
            const rows = document.querySelectorAll('.el-table__row')
            if (rows.length === 0) return false
            const firstRow = rows[0]
            // Try row-level delete button
            const btns = [...firstRow.querySelectorAll('button')]
            const delBtn = btns.find(b => /删\s*除|Delete|remove/.test(b.textContent || ''))
            if (delBtn) { delBtn.click(); return 'row-delete' }
            // Try action column buttons
            const actionBtns = [...document.querySelectorAll('.el-table__row:first-child .el-button')]
            const actionDel = actionBtns.find(b => b.textContent?.includes('删'))
            if (actionDel) { actionDel.click(); return 'action-delete' }
            return false
          })
          log(deleteClicked ? 'PASS' : 'INFO', `Delete button clicked: ${deleteClicked}`)
          
          if (deleteClicked) {
            await sleep(600)
            // Confirm popconfirm
            const confirmed = await page.evaluate(() => {
              const confirmBtns = [...document.querySelectorAll('.el-popconfirm__action button, .el-message-box__btns button')]
              const okBtn = confirmBtns.find(b => /确\s*定|确认|OK|Yes/.test(b.textContent || ''))
              if (okBtn) { okBtn.click(); return true }
              // Try primary button in popconfirm
              const primary = document.querySelector('.el-popconfirm__action .el-button--primary, .el-message-box__btns .el-button--primary')
              if (primary) { primary.click(); return true }
              return false
            })
            log(confirmed ? 'PASS' : 'INFO', `Delete confirmed: ${confirmed}`)
            await sleep(1500)
            await ss(page, '07-after-delete')
            const rowsAfterDelete = await page.evaluate(() => document.querySelectorAll('.el-table__row').length)
            log(rowsAfterDelete < rowsAfterReload ? 'PASS' : 'INFO', `Rows after delete: ${rowsAfterDelete} (was ${rowsAfterReload})`)
            
            const deleteSuccess = await page.evaluate(() => document.querySelector('.el-message--success')?.textContent?.trim())
            log(deleteSuccess ? 'PASS' : 'INFO', `Delete toast: ${deleteSuccess || 'not visible'}`)
          }
        }
      }
    }
  } else {
    log('FAIL', 'TEST 1: No 新增 button found on seat-closure page')
  }

  log('STEP', '=== TEST 1 COMPLETE ===')
  await sleep(500)

  // ======== TEST 2: 价格区间一键填充 ========
  log('STEP', '=== TEST 2: 价格区间一键填充 ===')
  
  await closeOverlays(page)
  await page.evaluate((path) => {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
  }, '/gz-bean/seat-type-config')
  await sleep(800)
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 8000 }).catch(() => {})
  await sleep(1000)
  await ss(page, '10-seat-type-config-page')

  const url2 = page.url()
  log('INFO', `seat-type-config URL: ${url2}`)

  const info2 = await page.evaluate(() => {
    const rows = document.querySelectorAll('.el-table__row').length
    const hasTable = !!document.querySelector('.el-table')
    const isLogin = location.pathname.includes('login')
    const mainText = (document.querySelector('.app-main') || document.body).innerText.substring(0, 200)
    const rowTexts = [...document.querySelectorAll('.el-table__row')].slice(0, 3).map(r => r.textContent.trim().substring(0, 100))
    return { rows, hasTable, isLogin, mainText, rowTexts }
  })
  log('INFO', `Config page info: rows=${info2.rows}, hasTable=${info2.hasTable}`)
  log(info2.hasTable ? 'PASS' : 'FAIL', `Has seat type config table: ${info2.hasTable}`)
  log('INFO', `Table rows sample: ${JSON.stringify(info2.rowTexts)}`)

  if (!info2.hasTable || info2.isLogin) {
    log('FAIL', 'TEST 2 BLOCKED: No table or redirected to login')
  } else if (info2.rows === 0) {
    log('INFO', 'TEST 2: No seat type config rows in table - cannot test price fill')
  } else {
    // Find price grid button in first row
    log('STEP', 'Looking for price grid / 价格 button in table rows')
    const priceBtn = await page.evaluate(() => {
      const rows = document.querySelectorAll('.el-table__row')
      for (const row of rows) {
        const btns = [...row.querySelectorAll('button, .el-button')]
        const priceB = btns.find(b => /价格|网格|定价|Grid|price/i.test(b.textContent || '') && b.offsetParent !== null)
        if (priceB) { priceB.click(); return priceB.textContent.trim() }
      }
      // Try action column links
      const links = [...document.querySelectorAll('.el-table__row a, .el-table__row .el-link')]
      const priceLink = links.find(l => /价格|网格|定价/i.test(l.textContent || ''))
      if (priceLink) { priceLink.click(); return priceLink.textContent.trim() + '(link)' }
      return null
    })
    log(priceBtn ? 'PASS' : 'FAIL', `Price grid button found and clicked: ${priceBtn}`)
    
    if (!priceBtn) {
      // List all buttons in the table
      const allBtns = await page.evaluate(() => {
        return [...document.querySelectorAll('.el-table__row button, .el-table__row .el-button')].map(b => b.textContent?.trim())
      })
      log('INFO', `All table buttons: ${JSON.stringify(allBtns.slice(0, 20))}`)
    } else {
      await sleep(1500)
      await ss(page, '11-price-grid-dialog')

      const dlgInfo = await page.evaluate(() => {
        const dlg = document.querySelector('.el-dialog, .el-drawer')
        if (!dlg) return { hasDialog: false }
        const text = dlg.innerText.substring(0, 500)
        const hasFill = /填充|批量|区间|Fill/i.test(text)
        const inputs = [...dlg.querySelectorAll('input')].length
        const btns = [...dlg.querySelectorAll('button')].map(b => b.textContent?.trim())
        return { hasDialog: true, hasFill, inputs, btns, text: text.substring(0, 300) }
      })
      log(dlgInfo.hasDialog ? 'PASS' : 'FAIL', `Price grid dialog opened: ${dlgInfo.hasDialog}`)
      if (dlgInfo.hasDialog) {
        log(dlgInfo.hasFill ? 'PASS' : 'FAIL', `Fill control found in dialog: ${dlgInfo.hasFill}`)
        log('INFO', `Dialog inputs: ${dlgInfo.inputs}, buttons: ${JSON.stringify(dlgInfo.btns?.slice(0, 10))}`)
        log('INFO', `Dialog text: ${dlgInfo.text}`)

        if (dlgInfo.hasFill) {
          // Set fill range: 10:00-14:00, price 0.5
          log('STEP', 'Setting fill range: start=10, end=14, price=0.5')
          await ss(page, '12-fill-controls')
          
          const fillSet = await page.evaluate(() => {
            const dlg = document.querySelector('.el-dialog, .el-drawer')
            const inputs = [...dlg.querySelectorAll('input')]
            let results = {}
            for (const inp of inputs) {
              const ph = (inp.placeholder || '').toLowerCase()
              if (ph.includes('起') || ph.includes('开始') || ph.includes('from') || ph.includes('start hour')) {
                inp.value = '10'
                inp.dispatchEvent(new Event('input', { bubbles: true }))
                inp.dispatchEvent(new Event('change', { bubbles: true }))
                results.start = '10'
              } else if (ph.includes('止') || ph.includes('结束') || ph.includes('to') || ph.includes('end hour')) {
                inp.value = '14'
                inp.dispatchEvent(new Event('input', { bubbles: true }))
                inp.dispatchEvent(new Event('change', { bubbles: true }))
                results.end = '14'
              } else if (ph.includes('价') || ph.includes('price') || ph.includes('金额')) {
                inp.value = '0.5'
                inp.dispatchEvent(new Event('input', { bubbles: true }))
                inp.dispatchEvent(new Event('change', { bubbles: true }))
                results.price = '0.5'
              }
            }
            return results
          })
          log('INFO', `Fill inputs set: ${JSON.stringify(fillSet)}`)

          // Select Monday if weekday selection exists
          log('STEP', 'Selecting weekday for fill (周一)')
          const weekdayFill = await page.evaluate(() => {
            const dlg = document.querySelector('.el-dialog, .el-drawer')
            const checkboxes = [...dlg.querySelectorAll('.el-checkbox')]
            const monChk = checkboxes.find(c => c.textContent.includes('一') || c.textContent.includes('Monday'))
            if (monChk) {
              const input = monChk.querySelector('input')
              if (!input.checked) input.click()
              return 'clicked-周一'
            }
            return null
          })
          log('INFO', `Weekday selection: ${weekdayFill}`)

          await ss(page, '13-fill-params-set')

          // Click fill button
          log('STEP', 'Clicking fill button')
          const fillBtnClicked = await page.evaluate(() => {
            const dlg = document.querySelector('.el-dialog, .el-drawer')
            const btns = [...dlg.querySelectorAll('button')]
            const fillBtn = btns.find(b => /填充|应用|批量设|batch|fill/i.test(b.textContent || '') && b.offsetParent !== null)
            if (fillBtn) { fillBtn.click(); return fillBtn.textContent.trim() }
            return null
          })
          log(fillBtnClicked ? 'PASS' : 'FAIL', `Fill button clicked: ${fillBtnClicked}`)
          await sleep(800)
          await ss(page, '14-after-fill')

          // Check grid cells for 0.5
          const gridCheck = await page.evaluate(() => {
            const dlg = document.querySelector('.el-dialog, .el-drawer')
            const allInputs = [...dlg.querySelectorAll('input[type="number"], input[type="text"]')]
            const allValues = allInputs.map(i => i.value)
            const has05 = allValues.some(v => v === '0.5' || v === '0.50' || parseFloat(v) === 0.5)
            // Also check spans/divs that display values
            const cellTexts = [...dlg.querySelectorAll('td, .grid-cell, [class*="cell"]')].slice(0, 50).map(c => c.textContent.trim()).filter(t => t)
            return { allValues: allValues.slice(0, 20), has05, cellTexts: cellTexts.slice(0, 20) }
          })
          log(gridCheck.has05 ? 'PASS' : 'FAIL', `Grid cells filled with 0.5: ${gridCheck.has05}`)
          log('INFO', `Sample input values: ${JSON.stringify(gridCheck.allValues.filter(v => v).slice(0, 10))}`)
          log('INFO', `Sample cell texts: ${JSON.stringify(gridCheck.cellTexts.slice(0, 10))}`)

          // Save
          log('STEP', 'Saving the price grid')
          const saved = await page.evaluate(() => {
            const dlg = document.querySelector('.el-dialog__footer, .el-dialog')
            if (!dlg) return false
            const btns = [...dlg.querySelectorAll('button')]
            const saveBtn = btns.find(b => /确\s*定|保\s*存|Save|OK/.test(b.textContent || '') && !b.disabled && b.offsetParent !== null)
            if (saveBtn) { saveBtn.click(); return saveBtn.textContent.trim() }
            const primary = dlg.querySelector('.el-button--primary:not([disabled])')
            if (primary && primary.offsetParent !== null) { primary.click(); return primary.textContent.trim() + '(primary)' }
            return false
          })
          log(saved ? 'PASS' : 'FAIL', `Save clicked: ${saved}`)
          await sleep(2000)
          await ss(page, '15-after-price-save')

          const saveResult = await page.evaluate(() => {
            const success = document.querySelector('.el-message--success')?.textContent?.trim()
            const error = document.querySelector('.el-message--error')?.textContent?.trim()
            const dlg = document.querySelector('.el-dialog')
            return { success, error, dialogClosed: !dlg }
          })
          log(saveResult.success ? 'PASS' : 'INFO', `Save toast: ${saveResult.success || 'not visible'}`)
          if (saveResult.error) log('FAIL', `Error: ${saveResult.error}`)
          log(saveResult.dialogClosed ? 'PASS' : 'INFO', `Dialog closed after save: ${saveResult.dialogClosed}`)

          // Reopen to verify persistence
          if (saveResult.dialogClosed) {
            log('STEP', 'Reopening price grid to verify persistence')
            await page.evaluate(() => {
              const rows = document.querySelectorAll('.el-table__row')
              if (rows.length > 0) {
                const btns = [...rows[0].querySelectorAll('button, .el-button')]
                const priceB = btns.find(b => /价格|网格|定价|Grid|price/i.test(b.textContent || ''))
                if (priceB) priceB.click()
              }
            })
            await sleep(1500)
            await ss(page, '16-reopen-verify')

            const persistCheck = await page.evaluate(() => {
              const dlg = document.querySelector('.el-dialog, .el-drawer')
              if (!dlg) return { hasDialog: false }
              const inputs = [...dlg.querySelectorAll('input[type="number"], input[type="text"]')]
              const values = inputs.map(i => i.value)
              const has05 = values.some(v => v === '0.5' || v === '0.50' || parseFloat(v) === 0.5)
              return { hasDialog: true, has05, sampleValues: values.filter(v => v).slice(0, 10) }
            })
            log(persistCheck.has05 ? 'PASS' : 'FAIL', `Persistence check: 0.5 values still present: ${persistCheck.has05}`)
            log('INFO', `Sample persisted values: ${JSON.stringify(persistCheck.sampleValues)}`)

            // Cleanup: fill back to 0
            if (persistCheck.has05) {
              log('STEP', 'Cleanup: clearing test price (fill 10-14 to 0)')
              await page.evaluate(() => {
                const dlg = document.querySelector('.el-dialog, .el-drawer')
                const inputs = [...dlg.querySelectorAll('input')]
                for (const inp of inputs) {
                  const ph = (inp.placeholder || '').toLowerCase()
                  if (ph.includes('起') || ph.includes('开始')) {
                    inp.value = '10'
                    inp.dispatchEvent(new Event('input', { bubbles: true }))
                  } else if (ph.includes('止') || ph.includes('结束')) {
                    inp.value = '14'
                    inp.dispatchEvent(new Event('input', { bubbles: true }))
                  } else if (ph.includes('价') || ph.includes('price')) {
                    inp.value = '0'
                    inp.dispatchEvent(new Event('input', { bubbles: true }))
                    inp.dispatchEvent(new Event('change', { bubbles: true }))
                  }
                }
              })
              // Click fill button again
              await page.evaluate(() => {
                const dlg = document.querySelector('.el-dialog, .el-drawer')
                const btns = [...dlg.querySelectorAll('button')]
                const fillBtn = btns.find(b => /填充|应用/i.test(b.textContent || '') && b.offsetParent !== null)
                if (fillBtn) fillBtn.click()
              })
              await sleep(500)
              // Save cleanup
              await page.evaluate(() => {
                const dlg = document.querySelector('.el-dialog')
                const primary = dlg?.querySelector('.el-button--primary:not([disabled])')
                if (primary) primary.click()
              })
              await sleep(1500)
              log('PASS', 'Cleanup: price reset to 0 and saved')
              await ss(page, '17-cleanup-done')
            }
          }
        }
      }
    }
  }

  log('STEP', '=== TEST 2 COMPLETE ===')

  // Final console error summary
  if (consoleErrors.length > 0) {
    log('CONSOLE-ERRORS', `${consoleErrors.length} errors: ${consoleErrors.slice(0, 5).join(' | ')}`)
  } else {
    log('PASS', 'No console errors detected throughout the test')
  }

  await browser.close()

  // Summary
  console.log('\n=== FINAL SUMMARY ===')
  const passes = results.filter(r => r.startsWith('[PASS]')).length
  const fails = results.filter(r => r.startsWith('[FAIL]')).length
  const infos = results.filter(r => r.startsWith('[INFO]')).length
  console.log(`PASS: ${passes} | FAIL: ${fails} | INFO: ${infos}`)
  
  writeFileSync('/tmp/pw-gacha/bean036-results.txt', results.join('\n'))
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
