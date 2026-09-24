/**
 * 加座座位改号回归：加座座位（整桌 + 仅后台临时桌）可在「座位单元」编辑里改成桌号编号（Q1-5），
 * 看板上并桌显示新号；正式桌座位号仍不可改；数量调整后不会被改过的号带偏。
 *
 * 数据（dev 库，门店 1 = CD001；需有 Q1/Q2 四人桌）：临时桌型「加座改号E2E*」整桌×1 座×3（A/B/C），A、B 同桌标识 Q1
 * 覆盖：
 *   API  A → Q1-5 成功 / B → Q1-1（已被正式座占）拒绝 / 正式座 Q2-1 改号拒绝 /
 *        C 挂代客单时改号拒绝 / 数量 3→4 只补 1 个且不用「Q」前缀、A 仍是 Q1-5
 *   UI   座位单元编辑：加座座位座位号可编辑并改成 Q1-6 保存成功；正式座 Q1-1 座位号置灰
 *   看板 Q1 桌：Q1-1..Q1-4, Q1-5, Q1-6（加座角标）
 * 清理：代客单硬删（软删会残留占号，见 memory pindou-booking-no-soft-delete-collision）；
 *       改成 Q 开头的号先改成一次性编号 X<id> 再删座位（软删行仍占 seat_no，不腾出来下次跑 Q1-5 会被占）
 *
 * 用法：ADMIN_BACKEND=http://localhost:8081 node gz-bean-seat-rename-extra.mjs --cleanup
 *   后端必须是含改号能力的版本；浏览器里 /dev-api 请求被拦截转发到 ADMIN_BACKEND，前端仍用本机 vite。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { CFG, clearProxy, chromePath, login, injectSession, sleep } from './lib.mjs'

const SHOT_DIR = new URL('./screenshots', import.meta.url).pathname
const STORE_ID = 1
const PREFIX = '加座改号E2E'

async function call(token, method, url, body) {
  const res = await fetch(`${CFG.backend}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, clientid: CFG.clientId },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}
async function api(token, method, url, body) {
  const j = await call(token, method, url, body)
  if (j.code !== undefined && j.code !== 200) throw new Error(`${method} ${url} → ${JSON.stringify(j).slice(0, 300)}`)
  return j
}
const listSeats = async (token, q) =>
  (await api(token, 'GET', `/system/gz/bean/seat/list?storeId=${STORE_ID}&pageNum=1&pageSize=100&${q}`)).rows
    .sort((a, b) => a.sortNo - b.sortNo || a.seatNo.localeCompare(b.seatNo))
const seatBody = (s, patch) => ({
  id: s.id, storeId: s.storeId, seatTypeConfigId: s.seatTypeConfigId, seatNo: s.seatNo,
  tableNo: s.tableNo, zone: s.zone, enabled: s.enabled, sortNo: s.sortNo, remark: s.remark, ...patch,
})
const devSql = (sql) => execFileSync('docker', ['exec', 'sensenran-dev-mysql', 'sh', '-c',
  `mysql -uroot -p"$MYSQL_ROOT_PASSWORD" ry-vue -N -e "${sql}" 2>/dev/null`]).toString().trim()

/**
 * 删测试桌型及其座位。改成 Q 开头桌号编号的座位先改成一次性编号 X<id> 再删：
 * 软删行仍占 seat_no，不腾出来下次跑 Q1-5 会被占；也不能改回原号 —— 数量补齐可能已复用了那个号。
 */
async function cleanupConfig(token, cfgId) {
  const seats = await listSeats(token, `seatTypeConfigId=${cfgId}`)
  for (const s of seats) {
    if (/^Q/.test(s.seatNo)) await api(token, 'PUT', '/system/gz/bean/seat', seatBody(s, { seatNo: `X${s.id}` }))
  }
  if (seats.length) await api(token, 'DELETE', `/system/gz/bean/seat/${seats.map((s) => s.id).join(',')}`)
  await api(token, 'DELETE', `/system/gz/bean/seatTypeConfig/${cfgId}`)
  console.log(`[cleanup] 删除桌型 ${cfgId} + ${seats.length} 个座位（桌号编号已先腾出）`)
}

function hhmmss(d) { return d.toTimeString().slice(0, 8) }
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

async function main() {
  clearProxy()
  mkdirSync(SHOT_DIR, { recursive: true })
  const token = await login()
  const checks = []
  const check = (name, got, want) => checks.push([name, String(got), String(want)])

  // ---------- setup ----------
  const name = `${PREFIX}${Date.now() % 100000}`
  await api(token, 'POST', '/system/gz/bean/seatTypeConfig', {
    storeId: STORE_ID, name, bookMode: 'whole', capacity: 1, quantity: 3,
    priceCent: 0, enabled: 1, mpVisible: 0, sortNo: 99, dayPassQuota: 0, dayPassPriceCent: 0,
  })
  const cfg = (await api(token, 'GET', `/system/gz/bean/seatTypeConfig/listByStore/${STORE_ID}`)).data.find((c) => c.name === name)
  const [A, B, C] = await listSeats(token, `seatTypeConfigId=${cfg.id}`)
  await api(token, 'PUT', '/system/gz/bean/seat', seatBody(A, { tableNo: 'Q1' }))
  await api(token, 'PUT', '/system/gz/bean/seat', seatBody(B, { tableNo: 'Q1' }))
  console.log(`[setup] 加座桌型 ${cfg.id}（${name}）座位 A=${A.seatNo} B=${B.seatNo} C=${C.seatNo}`)
  let bookingId = null

  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    defaultViewport: { width: 1440, height: 2200 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server', '--disable-gpu', '--lang=zh-CN'],
  })
  try {
    // ---------- API ----------
    let j = await call(token, 'PUT', '/system/gz/bean/seat', seatBody(A, { tableNo: 'Q1', seatNo: 'Q1-5' }))
    check('API 加座 A 改号 Q1-5 成功', j.code, 200)
    check('API 改号已落库', (await api(token, 'GET', `/system/gz/bean/seat/${A.id}`)).data.seatNo, 'Q1-5')

    j = await call(token, 'PUT', '/system/gz/bean/seat', seatBody(B, { tableNo: 'Q1', seatNo: 'Q1-1' }))
    check('API 改成已被正式座占的 Q1-1 → 拒绝', j.code !== 200 && /已存在/.test(j.msg), true)

    const q21 = (await listSeats(token, 'tableNo=Q2')).find((s) => s.seatNo === 'Q2-1')
    j = await call(token, 'PUT', '/system/gz/bean/seat', seatBody(q21, { seatNo: 'Q2-9' }))
    check('API 正式座 Q2-1 改号 → 拒绝', j.code !== 200 && /加座/.test(j.msg), true)
    check('API 正式座号未变', (await api(token, 'GET', `/system/gz/bean/seat/${q21.id}`)).data.seatNo, 'Q2-1')

    const start = new Date(Date.now() + 3 * 3600 * 1000)
    const end = new Date(start.getTime() + 30 * 60 * 1000)
    if (ymd(end) !== ymd(new Date())) throw new Error('当前时间太晚，代客单会跨天，请白天跑')
    const walk = await api(token, 'POST', '/system/gz/bean/booking/board/walk-in', {
      storeId: STORE_ID, seatId: C.id, sessDate: ymd(start), slotStart: hhmmss(start), slotEnd: hhmmss(end), isFree: true,
    })
    bookingId = walk.data.id
    j = await call(token, 'PUT', '/system/gz/bean/seat', seatBody(C, { seatNo: 'Q2-5' }))
    check('API 挂着代客单的加座改号 → 拒绝', j.code !== 200 && /改座位号/.test(j.msg), true)

    const detail = (await api(token, 'GET', `/system/gz/bean/seatTypeConfig/${cfg.id}`)).data
    await api(token, 'PUT', '/system/gz/bean/seatTypeConfig', { ...detail, quantity: 4 })
    const afterTopUp = await listSeats(token, `seatTypeConfigId=${cfg.id}`)
    const added = afterTopUp.filter((s) => ![A.id, B.id, C.id].includes(s.id))
    check('数量 3→4 只补 1 个', `${afterTopUp.length}/${added.length}`, '4/1')
    check('补出的座不用「Q」前缀（不会造出 Q1 这种像桌号的座）', /^Q/.test(added[0]?.seatNo || 'Q'), false)
    check('改过号的 A 仍是 Q1-5', afterTopUp.find((s) => s.id === A.id)?.seatNo, 'Q1-5')

    // ---------- UI：/dev-api 拦截转发到 ADMIN_BACKEND ----------
    const page = await browser.newPage()
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await page.setRequestInterception(true)
    page.on('request', async (req) => {
      const u = new URL(req.url())
      if (!u.pathname.startsWith('/dev-api/')) return req.continue()
      try {
        const headers = { ...req.headers() }
        for (const h of ['host', 'connection', 'content-length', 'accept-encoding', 'origin', 'referer']) delete headers[h]
        const res = await fetch(`${CFG.backend}${u.pathname.replace('/dev-api', '')}${u.search}`, {
          method: req.method(), headers, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData(),
        })
        const outHeaders = Object.fromEntries([...res.headers].filter(([k]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(k)))
        await req.respond({ status: res.status, headers: outHeaders, body: Buffer.from(await res.arrayBuffer()) })
      } catch (e) {
        await req.abort().catch(() => {})
      }
    })
    await injectSession(page, token)
    const go = async (p) => {
      await page.evaluate((x) => { window.history.pushState({}, '', x); window.dispatchEvent(new PopStateEvent('popstate', {})) }, p)
      await sleep(1200)
      await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
    }

    await go('/gz-bean/seat-management')
    await page.evaluate(() => [...document.querySelectorAll('.el-tabs__item')].find((el) => el.textContent.trim() === '座位单元')?.click())
    await sleep(1200)
    // 同桌标识筛 Q1：列出 Q1-1..Q1-4 + A(Q1-5) + B
    const tableInput = await page.$('input[placeholder="如 T1"]')
    await tableInput.type('Q1')
    await tableInput.press('Enter')
    await sleep(1500)

    const openEdit = async (seatNo) => {
      const ok = await page.evaluate((no) => {
        const row = [...document.querySelectorAll('.el-table__body tr')].find((tr) => tr.querySelector('td:nth-child(2)')?.textContent.trim() === no)
        const btn = row && [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === '编辑')
        btn?.click()
        return !!btn
      }, seatNo)
      await sleep(800)
      return ok
    }
    const dialogState = () => page.evaluate(() => {
      const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
      const input = dlg?.querySelector('input[maxlength="16"]')
      return { disabled: input?.disabled, value: input?.value, hint: dlg?.querySelector('.form-hint')?.textContent.trim() }
    })
    const closeDialog = () => page.evaluate(() => {
      const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
      ;[...dlg.querySelectorAll('button')].find((b) => b.textContent.trim() === '取消')?.click()
    })

    check('UI 找到加座 B 的编辑按钮', await openEdit(B.seatNo), true)
    let st = await dialogState()
    check('UI 加座座位号可编辑', st.disabled, false)
    check('UI 加座提示改号用法', /加座座位可改/.test(st.hint || ''), true)
    await page.evaluate(() => {
      const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
      const input = dlg.querySelector('input[maxlength="16"]')
      input.value = ''
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await page.type('.el-dialog input[maxlength="16"]:not([disabled])', 'Q1-6')
    await page.evaluate(() => {
      const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
      ;[...dlg.querySelectorAll('button')].find((b) => b.textContent.trim() === '确定')?.click()
    })
    await sleep(1500)
    check('UI 保存后座位号为 Q1-6', (await api(token, 'GET', `/system/gz/bean/seat/${B.id}`)).data.seatNo, 'Q1-6')

    check('UI 找到正式座 Q1-1 的编辑按钮', await openEdit('Q1-1'), true)
    st = await dialogState()
    check('UI 正式座座位号置灰', st.disabled, true)
    check('UI 正式座提示不可改', /不可修改/.test(st.hint || ''), true)
    await closeDialog()
    await sleep(500)
    await page.screenshot({ path: path.join(SHOT_DIR, 'seat-rename-list.png'), fullPage: true })

    // ---------- 看板 ----------
    await go('/gz-bean/board')
    await page.waitForSelector('.board-zone', { timeout: 15000 })
    await sleep(1000)
    const q1 = await page.evaluate(() => {
      const zone = [...document.querySelectorAll('.board-zone')].find((z) => z.querySelector('.board-zone__type')?.textContent.trim() === '四人桌')
      return [...zone.querySelectorAll('.board-seat')]
        .map((s) => ({ no: s.querySelector('.board-seat__no')?.firstChild?.textContent.trim(), tag: s.querySelector('.board-seat__extra')?.textContent.trim() || '' }))
        .filter((s) => s.no.startsWith('Q1'))
    })
    check('看板 Q1 桌顺序', q1.map((s) => s.no).join(' '), 'Q1-1 Q1-2 Q1-3 Q1-4 Q1-5 Q1-6')
    check('看板 Q1-5 / Q1-6 带加座角标', q1.filter((s) => s.tag === '加座').map((s) => s.no).join(' '), 'Q1-5 Q1-6')
    check('console 无 error', errors.length, 0)
    await page.screenshot({ path: path.join(SHOT_DIR, 'seat-rename-board.png'), fullPage: true })
    if (errors.length) console.log('[console errors]', errors.slice(0, 5))
  } finally {
    await browser.close()
    if (process.argv.includes('--cleanup')) {
      if (bookingId) {
        devSql(`DELETE FROM gz_bean_booking_log WHERE booking_id=${bookingId}; DELETE FROM gz_bean_booking WHERE id=${bookingId};`)
      }
      await cleanupConfig(token, cfg.id)
      console.log(`[cleanup] 代客单 ${bookingId ?? '-'} 已硬删`)
    }
  }

  let fail = 0
  for (const [n, got, want] of checks) {
    const ok = got === want
    if (!ok) fail++
    console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok ? '' : `\n     got:  ${got}\n     want: ${want}`}`)
  }
  console.log(fail ? `\n${fail} FAIL` : `\nALL PASS (${checks.length})`)
  process.exitCode = fail ? 1 : 0
}

// 显式退出：请求拦截里在途的 fetch 会在浏览器关闭后仍挂住事件循环
main().then(() => process.exit(process.exitCode ?? 0), (err) => { console.error('[FATAL]', err); process.exit(1) })
