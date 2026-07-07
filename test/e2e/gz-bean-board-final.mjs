/**
 * 最终版：把整个看板页（含座位格分区）设大视口一次截完，避免滚动坐标问题。
 * 另外精确 clip 关键子区域（统计条 / 图例 / D4 超时格）
 */
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { clearProxy, chromePath, login, injectSession, sleep } from './lib.mjs'
import path from 'node:path'

const SHOT_DIR = new URL('./screenshots', import.meta.url).pathname

async function main() {
  clearProxy()
  mkdirSync(SHOT_DIR, { recursive: true })

  const token = await login()
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    defaultViewport: { width: 1600, height: 3000 }, // 超高视口，一次装下全页
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server', '--disable-gpu', '--lang=zh-CN'],
  })
  const page = await browser.newPage()
  await injectSession(page, token)
  await page.evaluate((p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate', {})) }, '/gz-bean/board')
  await sleep(1000)
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 10000 }).catch(() => {})
  await sleep(2500)

  // 全页截图（一次性，不滚动）
  await page.screenshot({ path: path.join(SHOT_DIR, 'board-final-01-fullpage.png'), fullPage: false })
  console.log('01: full-viewport screenshot saved (3000px tall)')

  // 用超高视口获取绝对 rect（不受 scroll 影响）
  const rects = await page.evaluate(() => {
    const g = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    }
    const gAll = (sel) => [...document.querySelectorAll(sel)].map(el => {
      const r = el.getBoundingClientRect()
      return { cls: el.className.slice(0, 80), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    })

    const d4seat = document.querySelector('.board-seat.is-overtime')
    const d4r = d4seat ? d4seat.getBoundingClientRect() : null

    return {
      metrics: g('.board-metrics'),
      legend: g('.board-legend'),
      boardZones: g('.board-zones'),
      d4: d4r ? { x: Math.round(d4r.x), y: Math.round(d4r.y), w: Math.round(d4r.width), h: Math.round(d4r.height) } : null,
      allSeats: gAll('.board-seat').slice(0, 10),
    }
  })

  console.log('rects:', JSON.stringify(rects, null, 2))

  const pad = 12

  // clip 统计条
  if (rects.metrics) {
    const r = rects.metrics
    await page.screenshot({
      path: path.join(SHOT_DIR, 'board-final-02-stats-bar.png'),
      clip: { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: Math.min(r.w + pad * 2, 1400), height: r.h + pad * 2 }
    })
    console.log('02: stats bar clip saved')
  }

  // clip 图例
  if (rects.legend) {
    const r = rects.legend
    await page.screenshot({
      path: path.join(SHOT_DIR, 'board-final-03-legend.png'),
      clip: { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: Math.min(r.w + pad * 2, 1400), height: r.h + pad * 2 }
    })
    console.log('03: legend clip saved')
  }

  // clip D4 超时格
  if (rects.d4) {
    const r = rects.d4
    await page.screenshot({
      path: path.join(SHOT_DIR, 'board-final-04-d4-overtime.png'),
      clip: { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: Math.min(r.w + pad * 2, 500), height: Math.min(r.h + pad * 2, 400) }
    })
    console.log('04: D4 overtime cell clip saved, rect:', JSON.stringify(r))
  }

  // clip 整个座位格区（board-zones）包含统计条 + 图例 + 格子
  if (rects.boardZones && rects.metrics) {
    const topY = rects.metrics.y - pad
    const zoneBottom = rects.boardZones.y + rects.boardZones.h + pad
    await page.screenshot({
      path: path.join(SHOT_DIR, 'board-final-05-full-board-area.png'),
      clip: { x: Math.max(0, rects.boardZones.x - pad), y: Math.max(0, topY), width: Math.min(rects.boardZones.w + pad * 2, 1400), height: Math.min(zoneBottom - topY, 2800) }
    })
    console.log('05: full board area clip saved')
  }

  // 多截一张 1600×1200 的视口截图（更大的视口看到更多内容）
  await page.setViewport({ width: 1600, height: 1200 })
  await sleep(200)
  await page.screenshot({ path: path.join(SHOT_DIR, 'board-final-06-1200h-viewport.png'), fullPage: false })
  console.log('06: 1600x1200 viewport screenshot saved')

  await browser.close()
  console.log('[done]')
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1) })
