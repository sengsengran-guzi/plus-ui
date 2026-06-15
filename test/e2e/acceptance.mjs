/**
 * admin E2E 验收走查 —— 登录 gz_owner → 逐路由客户端跳转截图 + 关键页开"新增"弹窗截图。
 *
 * 用法：
 *   node acceptance.mjs                  # headless 全量走查，截图 → ./screenshots
 *   node acceptance.mjs --headful        # 带界面（调试用）
 *   node acceptance.mjs --only 10,70     # 只跑路由名前缀匹配的页（逗号分隔）
 *   ADMIN_SHOT_DIR=/tmp/x node acceptance.mjs
 *
 * 前置：后端 :8080 + admin dev :80 已起（见 README）。退出码：0 全部渲染OK / 1 有页被弹回登录或出错。
 * 客户端 pushState+popstate 跳转（不整页 reload）避免触发 ruoyi 限流"访问过于频繁"。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { ROUTES } from './routes.mjs'
import { CFG, clearProxy, chromePath, login, injectSession, closeOverlays, sleep } from './lib.mjs'

const args = process.argv.slice(2)
const headful = args.includes('--headful')
const onlyArg = (() => { const i = args.indexOf('--only'); return i >= 0 ? (args[i + 1] || '') : '' })()
const OUT = process.env.ADMIN_SHOT_DIR || new URL('./screenshots', import.meta.url).pathname
const routes = onlyArg ? ROUTES.filter((r) => onlyArg.split(',').some((k) => r.n.startsWith(k) || r.n.includes(k))) : ROUTES

async function main() {
  clearProxy()
  mkdirSync(OUT, { recursive: true })
  console.log(`[admin-e2e] base=${CFG.base} backend=${CFG.backend} 走查 ${routes.length} 页 → ${OUT}`)
  const token = await login()
  console.log(`[admin-e2e] ✓ 登录 ${CFG.username}@${CFG.tenantId} token len=${token.length}`)

  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: !headful,
    defaultViewport: { width: 1600, height: 950 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--no-first-run', '--no-proxy-server', '--disable-gpu', '--lang=zh-CN'],
  })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 120)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 120)) })

  await injectSession(page, token)
  console.log('[admin-e2e] ✓ 会话注入，动态路由就绪')

  const results = []
  for (const r of routes) {
    const rec = { ...r, ok: false, url: '', isLogin: false, rows: 0, shot: '', dialogShot: '', err: '' }
    errors.length = 0
    try {
      await closeOverlays(page)
      await page.evaluate((path) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })) }, r.p)
      await sleep(700)
      await page.waitForNetworkIdle({ idleTime: 600, timeout: 7000 }).catch(() => {})
      const pathname = await page.evaluate(() => location.pathname)
      if (!pathname.startsWith(r.p.split('/').slice(0, 3).join('/'))) {
        await page.goto(CFG.base + r.p, { waitUntil: 'networkidle2', timeout: 18000 }).catch(() => {})
        await page.waitForNetworkIdle({ idleTime: 600, timeout: 7000 }).catch(() => {})
      }
      await sleep(900)
      rec.url = page.url()
      const info = await page.evaluate(() => {
        const isLogin = location.pathname.includes('login')
        const rows = document.querySelectorAll('.el-table__row').length
        const main = document.querySelector('.app-main') || document.body
        const hasMain = (main.innerText || '').trim().length > 120
        return { isLogin, rows, hasMain }
      })
      rec.isLogin = info.isLogin
      rec.rows = info.rows
      await page.screenshot({ path: `${OUT}/${r.n}.png` })
      rec.shot = `${r.n}.png`
      rec.ok = !info.isLogin && info.hasMain
      if (r.dialog && rec.ok) {
        const clicked = await page.evaluate(() => {
          const add = [...document.querySelectorAll('button, .el-button')].find((b) => /新\s*增|新建|添加/.test((b.textContent || '').trim()) && !b.disabled && b.offsetParent !== null)
          if (add) { add.click(); return true }
          return false
        })
        if (clicked) {
          await sleep(1100)
          if (await page.evaluate(() => !!document.querySelector('.el-dialog, .el-drawer'))) {
            await page.screenshot({ path: `${OUT}/${r.n}-dialog.png` })
            rec.dialogShot = `${r.n}-dialog.png`
            await closeOverlays(page)
          }
        }
      }
      if (errors.length) rec.err = errors.slice(0, 2).join(' | ')
    } catch (e) { rec.err = String(e.message || e).slice(0, 160) }
    const flag = rec.ok ? '✅' : (rec.isLogin ? '🔒LOGIN' : '⚠️')
    console.log(`${flag} ${r.n.padEnd(22)} rows=${String(rec.rows).padStart(3)} ${rec.dialogShot ? '+dlg' : '    '} ${r.t}${rec.err ? '  ERR:' + rec.err.slice(0, 70) : ''}`)
    results.push(rec)
    await sleep(400)
  }

  writeFileSync(`${OUT}/_manifest.json`, JSON.stringify(results, null, 2))
  await browser.close()
  const okN = results.filter((x) => x.ok).length
  const dlgN = results.filter((x) => x.dialogShot).length
  const bad = results.filter((x) => !x.ok)
  console.log(`\n=== admin 走查: ${okN}/${results.length} 页渲染OK, ${dlgN} 弹窗, 截图→${OUT} ===`)
  if (bad.length) console.log(`未OK: ${bad.map((b) => b.n).join(', ')}`)
  process.exit(bad.some((b) => b.isLogin || b.err) ? 1 : 0)
}

main().catch((e) => { console.error('[admin-e2e] FATAL', e); process.exit(2) })
