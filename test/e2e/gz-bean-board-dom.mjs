/**
 * 分析看板 DOM 结构，找出座位格容器的真实 class/tag，并 clip D4 格
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
    defaultViewport: { width: 1600, height: 1200 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server', '--disable-gpu', '--lang=zh-CN'],
  })
  const page = await browser.newPage()
  await injectSession(page, token)
  await page.evaluate((p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate', {})) }, '/gz-bean/board')
  await sleep(1000)
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 10000 }).catch(() => {})
  await sleep(2000)

  // 分析包含 D4 + 超时的元素
  const analysis = await page.evaluate(() => {
    // 找所有包含「D4」文字的叶级或中层元素
    const allEls = [...document.querySelectorAll('*')]
    const d4candidates = allEls.filter(el => {
      const ownText = [...el.childNodes]
        .filter(n => n.nodeType === 3)
        .map(n => n.textContent.trim())
        .join('')
      return ownText.includes('D4')
    })

    // 找包含 超 + 放座 的容器
    const overtimeContainers = allEls.filter(el => {
      const t = el.textContent
      return t.includes('超') && t.includes('放座') && t.includes('核销') && t.length < 800
    }).map(el => ({
      tag: el.tagName,
      cls: el.className.slice(0, 100),
      rect: (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })(),
      textSnip: el.textContent.slice(0, 150).replace(/\s+/g, ' ')
    }))

    // 统计条/metrics 区分析
    const metricsEls = allEls.filter(el => {
      const t = el.textContent
      return t.includes('使用中') && t.includes('空闲') && t.length < 400
    }).map(el => ({
      tag: el.tagName,
      cls: el.className.slice(0, 100),
      rect: (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })(),
    }))

    // 图例分析
    const legendEls = allEls.filter(el => {
      const t = el.textContent
      return t.includes('已约未到') && t.includes('使用中') && t.includes('空闲') && t.length < 300
    }).map(el => ({
      tag: el.tagName,
      cls: el.className.slice(0, 100),
      rect: (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })(),
    }))

    return {
      d4candidates: d4candidates.map(el => ({ tag: el.tagName, cls: el.className, rect: (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })() })),
      overtimeContainers: overtimeContainers.slice(0, 8),
      metricsEls: metricsEls.slice(0, 5),
      legendEls: legendEls.slice(0, 5),
    }
  })

  console.log('=== D4 text candidates ===')
  analysis.d4candidates.forEach(d => console.log(JSON.stringify(d)))
  console.log('\n=== Overtime containers ===')
  analysis.overtimeContainers.forEach(d => console.log(JSON.stringify(d)))
  console.log('\n=== Metrics els ===')
  analysis.metricsEls.forEach(d => console.log(JSON.stringify(d)))
  console.log('\n=== Legend els ===')
  analysis.legendEls.forEach(d => console.log(JSON.stringify(d)))

  // 用 overtimeContainers 找最小合适的那个 clip D4
  const d4El = analysis.overtimeContainers.find(el => el.rect.w > 100 && el.rect.w < 700 && el.rect.h > 100)
  if (d4El) {
    await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 100)), d4El.rect.y)
    await sleep(400)

    // 重取坐标
    const pos = await page.evaluate((cls) => {
      const allEls = [...document.querySelectorAll('*')]
      const el = allEls.find(el => {
        const t = el.textContent
        return t.includes('超') && t.includes('放座') && t.includes('核销') && el.className.includes(cls.split(' ')[0])
      })
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    }, d4El.cls)

    const clip = pos || { x: d4El.rect.x, y: d4El.rect.y - 100, w: d4El.rect.w, h: d4El.rect.h + 50 }
    await page.screenshot({
      path: path.join(SHOT_DIR, 'board-visual-06-d4-cell.png'),
      clip: { x: Math.max(0, clip.x - 8), y: Math.max(0, clip.y - 8), width: Math.min(clip.w + 16, 500), height: Math.min(clip.h + 16, 500) }
    })
    console.log('\nscreenshot 06 D4 saved')
  }

  // 统计条 clip — 取最小的那个
  const statsEl = analysis.metricsEls.find(el => el.rect.w > 200 && el.rect.w < 1400 && el.rect.h < 120)
  if (statsEl) {
    await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 50)), statsEl.rect.y)
    await sleep(300)
    await page.screenshot({
      path: path.join(SHOT_DIR, 'board-visual-07-stats.png'),
      clip: { x: Math.max(0, statsEl.rect.x - 8), y: Math.max(0, statsEl.rect.y - 8), width: Math.min(statsEl.rect.w + 16, 1400), height: Math.min(statsEl.rect.h + 16, 150) }
    })
    console.log('screenshot 07 stats saved')
  }

  // 图例 clip — 取最小的那个
  const legendEl = analysis.legendEls.find(el => el.rect.w > 100 && el.rect.w < 1200 && el.rect.h < 60)
  if (legendEl) {
    await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 50)), legendEl.rect.y)
    await sleep(300)
    await page.screenshot({
      path: path.join(SHOT_DIR, 'board-visual-08-legend.png'),
      clip: { x: Math.max(0, legendEl.rect.x - 8), y: Math.max(0, legendEl.rect.y - 8), width: Math.min(legendEl.rect.w + 16, 1200), height: Math.min(legendEl.rect.h + 16, 80) }
    })
    console.log('screenshot 08 legend saved')
  }

  await browser.close()
  console.log('[done]')
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1) })
