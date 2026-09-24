/**
 * 看板「加座并桌」回归：临时桌座位（mp_visible=0）按「同桌标识」table_no 并到对应正式桌后面显示，
 * 对不上任何正式桌 table_no 的留在临时桌分组；按座分组每张桌另起一行。
 *
 * 数据（dev 库，门店 1 = CD001；需有 Q1/Q2 四人桌、S1-S3 单人、D1-D4 双人）：
 *   ① 加座桌型「加座E2E*」整桌×1 座×6，同桌标识依次 Q1 / Q1 / q2（小写）/ Q2 / D1 / 空
 *      —— D1 是双人桌的**座位号**不是 table_no，必须不并（只认 table_no）
 *   ② 独立临时桌「临时桌E2E*」按座×4 座×1，自动生成（前缀多半是 S → table_no=S1，与单人座号 S1 同名）
 *      —— 必须留在自己的临时分组，不能被并进单人区
 * 期望：
 *   四人桌：Q1-1..Q1-4, 加座(Q1), 加座(Q1), Q2-1..Q2-4, 加座(q2), 加座(Q2)；Q2-1 另起一行
 *   单人 / 双人：原样不变，不强制换行
 *   临时分组：加座E2E 剩 D1 + 空两座；临时桌E2E 4 座原样
 *
 * 用法：node gz-bean-board-extra-seat.mjs            （跑完保留测试数据）
 *       node gz-bean-board-extra-seat.mjs --cleanup  （跑完删掉测试桌型和它们的座位）
 */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { CFG, clearProxy, chromePath, login, injectSession, sleep } from './lib.mjs'

const SHOT_DIR = new URL('./screenshots', import.meta.url).pathname
const STORE_ID = 1
// 桌型名带后缀：uk_gz_bean_stc_name(tenant,store,name) 不含 del_flag，--cleanup 软删后同名再建会 409
const EXTRA_PREFIX = '加座E2E'
const STANDALONE_PREFIX = '临时桌E2E'
const TABLE_NOS = ['Q1', 'Q1', 'q2', 'Q2', 'D1', '']

async function api(token, method, url, body) {
  const res = await fetch(`${CFG.backend}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, clientid: CFG.clientId },
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await res.json()
  if (j.code !== undefined && j.code !== 200) throw new Error(`${method} ${url} → ${JSON.stringify(j).slice(0, 300)}`)
  return j
}

const listConfigs = async (token) => (await api(token, 'GET', `/system/gz/bean/seatTypeConfig/listByStore/${STORE_ID}`)).data
const listSeats = async (token, cfgId) =>
  (await api(token, 'GET', `/system/gz/bean/seat/list?storeId=${STORE_ID}&seatTypeConfigId=${cfgId}&pageNum=1&pageSize=50`)).rows
    .sort((a, b) => a.sortNo - b.sortNo || a.seatNo.localeCompare(b.seatNo))

/** 找已有的测试临时桌型，没有就建（保存即自动生成座位单元） */
async function ensureTempConfig(token, prefix, bookMode, capacity, quantity) {
  let cfg = (await listConfigs(token)).find((c) => c.name.startsWith(prefix))
  if (!cfg) {
    const name = `${prefix}${Date.now() % 100000}`
    await api(token, 'POST', '/system/gz/bean/seatTypeConfig', {
      storeId: STORE_ID, name, bookMode, capacity, quantity,
      priceCent: 0, enabled: 1, mpVisible: 0, sortNo: 99, dayPassQuota: 0, dayPassPriceCent: 0,
    })
    cfg = (await listConfigs(token)).find((c) => c.name === name)
  }
  return cfg
}

async function setup(token) {
  const extraCfg = await ensureTempConfig(token, EXTRA_PREFIX, 'whole', 1, TABLE_NOS.length)
  const extraSeats = await listSeats(token, extraCfg.id)
  if (extraSeats.length !== TABLE_NOS.length) throw new Error(`加座座位数 ${extraSeats.length} ≠ ${TABLE_NOS.length}`)
  for (let i = 0; i < extraSeats.length; i++) {
    const s = extraSeats[i]
    await api(token, 'PUT', '/system/gz/bean/seat', {
      id: s.id, storeId: s.storeId, seatTypeConfigId: s.seatTypeConfigId, seatNo: s.seatNo,
      tableNo: TABLE_NOS[i], zone: s.zone, enabled: 1, sortNo: s.sortNo, remark: s.remark,
    })
  }
  const standaloneCfg = await ensureTempConfig(token, STANDALONE_PREFIX, 'seat', 4, 1)
  const standaloneSeats = await listSeats(token, standaloneCfg.id)
  return {
    configs: [extraCfg, standaloneCfg],
    extraNos: extraSeats.map((s) => s.seatNo),
    standalone: standaloneSeats.map((s) => ({ no: s.seatNo, table: s.tableNo })),
  }
}

async function cleanup(token, configs) {
  for (const cfg of configs) {
    const seats = await listSeats(token, cfg.id)
    if (seats.length) await api(token, 'DELETE', `/system/gz/bean/seat/${seats.map((s) => s.id).join(',')}`)
    await api(token, 'DELETE', `/system/gz/bean/seatTypeConfig/${cfg.id}`)
    console.log(`[cleanup] 已删测试桌型 ${cfg.id}（${cfg.name}）+ ${seats.length} 个座位`)
  }
}

async function main() {
  clearProxy()
  mkdirSync(SHOT_DIR, { recursive: true })
  const token = await login()
  const { configs, extraNos, standalone } = await setup(token)
  console.log(`[setup] 加座 ${extraNos.join(' ')} 同桌标识 ${TABLE_NOS.map((t) => t || '∅').join(' ')}`)
  console.log(`[setup] 独立临时桌 ${standalone.map((s) => `${s.no}(${s.table})`).join(' ')}`)

  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    defaultViewport: { width: 1440, height: 2200 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server', '--disable-gpu', '--lang=zh-CN'],
  })
  const errors = []
  try {
    const page = await browser.newPage()
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await injectSession(page, token)
    await page.evaluate((p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate', {})) }, '/gz-bean/board')
    await page.waitForSelector('.board-zone', { timeout: 15000 })
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 10000 }).catch(() => {})
    await sleep(1000)

    const zones = await page.evaluate(() => [...document.querySelectorAll('.board-zone')].map((z) => ({
      type: z.querySelector('.board-zone__type')?.textContent.trim(),
      temp: z.classList.contains('is-temp'),
      seats: [...z.querySelectorAll('.board-seat')].map((s) => ({
        no: s.querySelector('.board-seat__no')?.firstChild?.textContent.trim(),
        table: s.querySelector('.board-seat__table')?.textContent.trim() || '',
        extra: s.classList.contains('is-extra'),
        tag: s.querySelector('.board-seat__extra')?.textContent.trim() || '',
        dashed: getComputedStyle(s).borderTopStyle,
        x: Math.round(s.getBoundingClientRect().x),
        y: Math.round(s.getBoundingClientRect().y),
      })),
    })))
    for (const z of zones) {
      console.log(`[zone] ${z.type}${z.temp ? ' [临时桌]' : ''}: ${z.seats.map((s) => `${s.no}${s.table ? `(${s.table})` : ''}${s.extra ? '*' : ''}`).join(' ')}`)
    }

    const [x1, x2, x3, x4, x5, x6] = extraNos
    const seq = (pred) => zones.filter(pred).map((z) => z.seats.map((s) => s.no).join(' ')).join('|')
    const allSeats = zones.flatMap((z) => z.seats)
    const at = (no) => allSeats.find((s) => s.no === no)
    const merged = [x1, x2, x3, x4].map(at)
    const untagged = [x5, x6, ...standalone.map((s) => s.no)].map(at)
    const checks = [
      ['四人桌 加座紧跟各自桌', seq((z) => z.type === '四人桌' && !z.temp), `Q1-1 Q1-2 Q1-3 Q1-4 ${x1} ${x2} Q2-1 Q2-2 Q2-3 Q2-4 ${x3} ${x4}`],
      ['双人不变（D1 是座位号不是同桌标识，不并）', seq((z) => z.type === '双人'), 'D1 D2 D3 D4'],
      ['单人不变（独立临时桌 table_no=S1 不并进单人 S1）', seq((z) => z.type === '单人'), 'S1 S2 S3'],
      // 临时分组内顺序沿用后端（table_no 升序，空标识在前），这里只比集合
      ['加座分组只剩对不上的 2 座', seq((z) => z.temp && z.type.startsWith(EXTRA_PREFIX)).split(' ').sort().join(' '), [x5, x6].sort().join(' ')],
      ['独立临时桌原样留在自己分组', seq((z) => z.temp && z.type.startsWith(STANDALONE_PREFIX)), standalone.map((s) => s.no).join(' ')],
      ['临时分组垫底', zones.map((z) => (z.temp ? 'T' : 'N')).join('').replace(/^N+T+$/, 'ok'), 'ok'],
      ['并入座打「加座」角标+虚线', merged.every((s) => s.extra && s.tag === '加座' && s.dashed === 'dashed') ? 'ok' : JSON.stringify(merged), 'ok'],
      ['未并入的临时座不打角标', untagged.every((s) => s && !s.extra && !s.tag) ? 'ok' : JSON.stringify(untagged), 'ok'],
      ['正式座无角标', allSeats.filter((s) => !extraNos.includes(s.no) && !standalone.some((t) => t.no === s.no)).some((s) => s.extra || s.tag) ? 'leak' : 'ok', 'ok'],
      ['按座分组每桌另起一行（Q2-1 在行首、在 Q1 加座下方）', String(at('Q2-1').x === at('Q1-1').x && at('Q2-1').y > at(x2).y), 'true'],
      ['整桌分组不强制换行（S2 与 S1 同行、D2 与 D1 同行）', String(at('S2').y === at('S1').y && at('D2').y === at('D1').y), 'true'],
      ['console 无 error', String(errors.length), '0'],
    ]

    let fail = 0
    for (const [name, got, want] of checks) {
      const ok = got === want
      if (!ok) fail++
      console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `\n     got:  ${got}\n     want: ${want}`}`)
    }
    if (errors.length) console.log('[console errors]', errors.slice(0, 5))

    const shot = path.join(SHOT_DIR, 'board-extra-seat.png')
    await page.screenshot({ path: shot, fullPage: true })
    // 窄屏（每行 4-5 格）：6 座桌会在桌内折行，但下一张桌仍另起一行
    await page.setViewport({ width: 1280, height: 2200 })
    await sleep(800)
    const shotNarrow = path.join(SHOT_DIR, 'board-extra-seat-1280.png')
    await page.screenshot({ path: shotNarrow, fullPage: true })
    console.log(`[shot] ${shot}\n[shot] ${shotNarrow}`)
    console.log(fail ? `\n${fail} FAIL` : '\nALL PASS')
    process.exitCode = fail ? 1 : 0
  } finally {
    await browser.close()
    if (process.argv.includes('--cleanup')) await cleanup(token, configs)
  }
}

main().catch((err) => { console.error('[FATAL]', err); process.exit(1) })
