/**
 * admin E2E 公共库 —— 登录取 token / 启动 Chrome / 注入会话 / 辅助。
 */
import { existsSync } from 'node:fs'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const CFG = {
  base: process.env.ADMIN_BASE || 'http://localhost',
  backend: process.env.ADMIN_BACKEND || 'http://localhost:8080',
  clientId: process.env.ADMIN_CLIENT_ID || 'e5cd7e4891bf95d1d19206ce24a7b32e',
  username: process.env.ADMIN_USER || 'gz_owner',
  password: process.env.ADMIN_PASS || 'gz_owner123!',
  tenantId: process.env.ADMIN_TENANT || '1001',
}

// clash 等本地代理会吞 127.0.0.1 → undici fetch 走代理失败。清掉代理 env，强制直连。
export function clearProxy() {
  for (const k of ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy']) delete process.env[k]
  process.env.NO_PROXY = '*'
  process.env.no_proxy = '*'
}

// 系统 Chrome（mac 默认；可用 CHROME_BIN 覆盖）
export function chromePath() {
  const cands = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean)
  const hit = cands.find((p) => existsSync(p))
  if (!hit) throw new Error(`找不到 Chrome；装 Google Chrome 或设 CHROME_BIN 环境变量。候选:\n  ${cands.join('\n  ')}`)
  return hit
}

// 取 gz_owner token（admin dev 无验证码，password grant 直接发 token）
export async function login() {
  const res = await fetch(`${CFG.backend}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', clientid: CFG.clientId },
    body: JSON.stringify({ clientId: CFG.clientId, grantType: 'password', tenantId: CFG.tenantId, username: CFG.username, password: CFG.password }),
  })
  const j = await res.json()
  const token = j?.data?.access_token
  if (!token) throw new Error(`登录失败: ${JSON.stringify(j).slice(0, 200)}`)
  return token
}

/**
 * 注入会话 + 等动态路由就绪。
 * ⚠️ 坑:plus-ui `useStorage('Admin-Token', null)` 默认值 null → VueUse 'any' 序列化器
 * read/write 是恒等/String(不是 JSON)。所以注入要写**原始 token**，别 JSON.stringify(带引号→401)。
 */
export async function injectSession(page, token) {
  await page.goto(`${CFG.base}/index`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
  await page.evaluate((tk) => localStorage.setItem('Admin-Token', tk), token)
  await page.goto(`${CFG.base}/index`, { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {})
  await sleep(2500) // 等 getInfo + generateRoutes 注册动态路由
  if (page.url().includes('login')) throw new Error('token 注入失败仍在 login 页（检查 Admin-Token 序列化或后端会话）')
}

// 关闭任何遗留弹窗/遮罩（带密码框的弹窗会污染后续登录检测）
export async function closeOverlays(page) {
  await page.evaluate(() => { document.querySelectorAll('.el-dialog__headerbtn, .el-drawer__close-btn').forEach((b) => b.click()) }).catch(() => {})
  await page.keyboard.press('Escape').catch(() => {})
  await sleep(300)
}
