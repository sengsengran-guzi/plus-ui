/**
 * 店内计时看板 D4 座位格精准 clip 截图
 * 用于验收分层双栏格（上栏在座/下栏待核销）的细节渲染
 */
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { CFG, clearProxy, chromePath, login, injectSession, sleep } from './lib.mjs'
import path from 'node:path'

const SHOT_DIR = new URL('./screenshots', import.meta.url).pathname

async function main() {
  clearProxy()
  mkdirSync(SHOT_DIR, { recursive: true })

  const token = await login()
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    defaultViewport: { width: 1600, height: 950 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server', '--disable-gpu', '--lang=zh-CN'],
  })
  const page = await browser.newPage()

  await injectSession(page, token)
  await page.evaluate((p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate', {})) }, '/gz-bean/board')
  await sleep(1000)
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 10000 }).catch(() => {})
  await sleep(2000)

  // 截整页保留参考
  await page.screenshot({ path: path.join(SHOT_DIR, 'board-visual-fullpage-ref.png'), fullPage: true })

  // 找 D4 座位格的精确坐标并 clip
  const d4Info = await page.evaluate(() => {
    // 找所有 card 标题
    const allCards = [...document.querySelectorAll('.el-card, [class*="seat-cell"], [class*="board-cell"]')]
    // 找包含 D4 文字的格子
    const d4Card = allCards.find(el => {
      const text = el.textContent || ''
      return text.includes('D4') && (text.includes('在座') || text.includes('超') || text.includes('放座'))
    })
    if (!d4Card) {
      // fallback: 找包含「超」和「放座」的元素的父级
      const overtimeEl = [...document.querySelectorAll('*')].find(el =>
        el.textContent.includes('超') && el.textContent.includes('放座') && el.textContent.includes('核销')
      )
      if (overtimeEl) {
        const r = overtimeEl.getBoundingClientRect()
        return { found: true, note: 'fallback-overtime-el', x: r.x, y: r.y, w: r.width, h: r.height, text: overtimeEl.textContent.slice(0, 200) }
      }
      return { found: false }
    }
    const r = d4Card.getBoundingClientRect()
    return { found: true, note: 'el-card', x: r.x, y: r.y, w: r.width, h: r.height, text: d4Card.textContent.slice(0, 300) }
  })
  console.log('D4 card info:', JSON.stringify(d4Info))

  if (d4Info.found && d4Info.w > 10 && d4Info.h > 10) {
    // 先滚动到 D4 位置
    await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 200)), d4Info.y)
    await sleep(400)

    // 重新获取坐标（scrollTo后需要重算）
    const d4Pos = await page.evaluate(() => {
      const allCards = [...document.querySelectorAll('.el-card, [class*="seat"]')]
      const d4Card = allCards.find(el => {
        const text = el.textContent || ''
        return text.includes('D4') && (text.includes('超') || text.includes('放座'))
      })
      if (!d4Card) return null
      const r = d4Card.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    })

    if (d4Pos && d4Pos.w > 10) {
      const padding = 10
      await page.screenshot({
        path: path.join(SHOT_DIR, 'board-visual-06-d4-cell-clip.png'),
        clip: {
          x: Math.max(0, d4Pos.x - padding),
          y: Math.max(0, d4Pos.y - padding),
          width: Math.min(d4Pos.w + padding * 2, 600),
          height: Math.min(d4Pos.h + padding * 2, 600),
        }
      })
      console.log('screenshot 06: D4 cell clip saved')
    }
  }

  // 截统计条区域（stats bar）
  await page.evaluate(() => window.scrollTo(0, 0))
  await sleep(400)
  const statsBar = await page.evaluate(() => {
    // 找统计数字区（已约未到/使用中/临近结束/已超时/空闲）
    const candidates = [
      ...document.querySelectorAll('[class*="metric"], [class*="stat"], [class*="summary"]')
    ].filter(el => el.textContent.match(/使用中|空闲|超时|在座/))
    if (candidates.length === 0) return null
    // 取最大父级
    const el = candidates[0].closest('.el-card, section, div[class]') || candidates[0]
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  console.log('stats bar:', JSON.stringify(statsBar))

  if (statsBar && statsBar.w > 50) {
    await page.screenshot({
      path: path.join(SHOT_DIR, 'board-visual-07-stats-bar-clip.png'),
      clip: { x: statsBar.x, y: statsBar.y, width: Math.min(statsBar.w, 1400), height: Math.min(statsBar.h + 20, 200) }
    })
    console.log('screenshot 07: stats bar clip saved')
  }

  // 截图例区域
  const legendArea = await page.evaluate(() => {
    const el = [...document.querySelectorAll('[class*="legend"], .legend, *')]
      .find(el => el.textContent.includes('已约未到') && el.textContent.includes('使用中') && el.textContent.includes('空闲'))
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  console.log('legend area:', JSON.stringify(legendArea))

  if (legendArea && legendArea.w > 50) {
    await page.screenshot({
      path: path.join(SHOT_DIR, 'board-visual-08-legend-clip.png'),
      clip: { x: Math.max(0, legendArea.x - 5), y: Math.max(0, legendArea.y - 5), width: Math.min(legendArea.w + 10, 1400), height: Math.min(legendArea.h + 10, 80) }
    })
    console.log('screenshot 08: legend clip saved')
  }

  await browser.close()
  console.log('[done]')
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1) })
