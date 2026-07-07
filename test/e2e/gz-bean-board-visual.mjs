/**
 * 店内计时看板 视觉验收截图脚本
 * GZ-BEAN-048 分层双栏格 新版 UI 视觉验收
 *
 * 用法：
 *   node gz-bean-board-visual.mjs             # headless
 *   node gz-bean-board-visual.mjs --headful   # 带界面
 *
 * 前置：后端 :8080 + admin :80 + dev 库有今日数据
 * 截图 → ./screenshots/board-visual-*.png
 */
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { CFG, clearProxy, chromePath, login, injectSession, sleep } from './lib.mjs'
import path from 'node:path'

const headful = process.argv.includes('--headful')
const SHOT_DIR = new URL('./screenshots', import.meta.url).pathname

async function main() {
  clearProxy()
  mkdirSync(SHOT_DIR, { recursive: true })

  console.log('[board-visual] 登录 gz_owner...')
  const token = await login()
  console.log(`[board-visual] token 取得 len=${token.length}`)

  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: !headful,
    defaultViewport: { width: 1600, height: 950 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--no-proxy-server', '--disable-gpu', '--lang=zh-CN'],
  })
  const page = await browser.newPage()

  const jsErrors = []
  const consoleErrors = []
  page.on('pageerror', (e) => jsErrors.push(e.message.slice(0, 200)))
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200))
  })

  await injectSession(page, token)
  console.log('[board-visual] 会话注入成功，路由就绪')

  // 跳转到看板页
  const boardPath = '/gz-bean/board'
  console.log(`[board-visual] 跳转 ${boardPath}`)
  await page.evaluate((p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate', {})) }, boardPath)
  await sleep(1000)
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 10000 }).catch(() => {})
  await sleep(1500)

  const url = page.url()
  console.log('[board-visual] 当前 URL:', url)

  // 截图 1：整页视口（统计条 + 顶部）
  await page.screenshot({ path: path.join(SHOT_DIR, 'board-visual-01-viewport.png'), fullPage: false })
  console.log('[board-visual] screenshot 01: viewport（统计条 + 顶部格区）')

  // 截图 2：全页（fullPage=true，看所有座位格）
  await page.screenshot({ path: path.join(SHOT_DIR, 'board-visual-02-fullpage.png'), fullPage: true })
  console.log('[board-visual] screenshot 02: fullpage（全部座位格）')

  // 尝试获取各关键元素信息
  const info = await page.evaluate(() => {
    const sel = (...ss) => ss.map(s => document.querySelectorAll(s).length)

    // 统计条（metrics / summary bar）
    const metricsCount = sel(
      '.board-metrics', '.metrics-bar', '[class*="metric"]', '[class*="summary"]',
      '.el-statistic', '[class*="stat"]'
    )

    // 座位格
    const cellCount = sel(
      '.seat-cell', '.board-cell', '.seat-card', '[class*="seat-cell"]',
      '[class*="board-cell"]', '[class*="seat-card"]', '.biz-seat-cell',
      '.el-card'
    )

    // 分层双栏（上栏/下栏）
    const layerCount = sel(
      '.cell-top', '.cell-bottom', '[class*="cell-top"]', '[class*="cell-bottom"]',
      '[class*="upper"]', '[class*="lower"]', '[class*="layer"]',
      '.slot-top', '.slot-bottom'
    )

    // 倒计时
    const countdownCount = sel(
      '[class*="countdown"]', '[class*="timer"]', '[class*="remaining"]',
      '.time-left', '.time-over'
    )

    // 状态胶囊 / 标签
    const statusCount = sel(
      '[class*="status"]', '.el-tag', '[class*="badge"]', '[class*="pill"]'
    )

    // 图例
    const legendCount = sel(
      '[class*="legend"]', '.legend', '[class*="guide"]'
    )

    // 按钮
    const btnCount = sel(
      'button', '.el-button'
    )

    // 门店选择器
    const storeCount = sel(
      '[class*="store"]', '.el-select', '[placeholder*="门店"]', '[placeholder*="CD"]'
    )

    // 取当前页面文字摘要（前 500 字符）
    const bodyText = document.body.innerText.slice(0, 800)

    // 拿所有 class 列表（帮助识别组件）
    const uniqueClasses = [...new Set(
      [...document.querySelectorAll('[class]')].flatMap(el => [...el.classList])
    )].filter(c => c.length > 2 && !c.startsWith('el-icon')).slice(0, 80)

    return {
      url: location.href,
      title: document.title,
      metricsCount,
      cellCount,
      layerCount,
      countdownCount,
      statusCount,
      legendCount,
      btnCount,
      storeCount,
      bodyText,
      uniqueClasses,
    }
  })

  console.log('\n=== 页面结构分析 ===')
  console.log('URL:', info.url)
  console.log('Title:', info.title)
  console.log('统计条元素数:', info.metricsCount)
  console.log('座位格元素数:', info.cellCount)
  console.log('分层双栏元素数:', info.layerCount)
  console.log('倒计时元素数:', info.countdownCount)
  console.log('状态标签元素数:', info.statusCount)
  console.log('图例元素数:', info.legendCount)
  console.log('按钮数:', info.btnCount)
  console.log('门店选择器数:', info.storeCount)
  console.log('\n页面文字摘要:')
  console.log(info.bodyText)
  console.log('\n唯一 CSS 类（前80）:')
  console.log(info.uniqueClasses.join(', '))

  console.log('\n=== JS ERRORS ===')
  if (jsErrors.length === 0) console.log('(无 pageerror)')
  else jsErrors.forEach(e => console.log('pageerror:', e))

  console.log('\n=== CONSOLE ERRORS ===')
  if (consoleErrors.length === 0) console.log('(无 console error)')
  else consoleErrors.forEach(e => console.log('console.error:', e))

  // 截图 3：滚动到中间区域
  await page.evaluate(() => window.scrollTo(0, 400))
  await sleep(400)
  await page.screenshot({ path: path.join(SHOT_DIR, 'board-visual-03-scroll-mid.png'), fullPage: false })
  console.log('[board-visual] screenshot 03: scroll mid')

  // 截图 4：滚动到底部
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await sleep(400)
  await page.screenshot({ path: path.join(SHOT_DIR, 'board-visual-04-scroll-bottom.png'), fullPage: false })
  console.log('[board-visual] screenshot 04: scroll bottom')

  // 尝试查找统计条并截图那部分
  await page.evaluate(() => window.scrollTo(0, 0))
  await sleep(300)

  // 尝试截具体座位格区域（clipping）
  const boardArea = await page.evaluate(() => {
    const candidates = [
      document.querySelector('.board-grid'),
      document.querySelector('.seat-grid'),
      document.querySelector('[class*="seat-grid"]'),
      document.querySelector('[class*="board-grid"]'),
      document.querySelector('.el-row'),
      document.querySelector('main .el-card'),
    ].filter(Boolean)
    if (candidates.length === 0) return null
    const el = candidates[0]
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: Math.min(r.width, 1500), height: Math.min(r.height, 700) }
  })

  if (boardArea && boardArea.width > 50 && boardArea.height > 50) {
    await page.screenshot({
      path: path.join(SHOT_DIR, 'board-visual-05-grid-clip.png'),
      clip: boardArea,
    })
    console.log('[board-visual] screenshot 05: seat-grid clip', boardArea)
  } else {
    console.log('[board-visual] 未找到可 clip 的 grid 元素，跳过截图 05')
  }

  await browser.close()
  console.log('\n[board-visual] 完成，截图在:', SHOT_DIR)
  console.log('[board-visual] JS errors 数:', jsErrors.length, '  console errors 数:', consoleErrors.length)
  console.log('[board-visual] 退出码:', jsErrors.length + consoleErrors.length > 0 ? 1 : 0)
  process.exit(jsErrors.length + consoleErrors.length > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('[board-visual] FATAL:', err)
  process.exit(2)
})
