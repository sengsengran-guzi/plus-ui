import { defineConfig } from '@playwright/test';

/**
 * plus-ui admin E2E（Playwright）。
 *
 * 与 `test/e2e/*.mjs`（puppeteer-core 截图走查脚本）分工不同：那边是「跑一遍全站截图人看」，
 * 这边是**断言式验收**，由 ticket 的 accept 逐字调用：
 *   `cd code/main/plus-ui && npx playwright test e2e/gz-jp/fulfill-board.spec.ts --reporter=line`
 *
 * 三条硬约定（踩过才知道）：
 *   1. `testIdAttribute: 'data-test'` —— 本项目页面统一用 `data-test`，不是 Playwright 默认的 `data-testid`。
 *   2. `channel: 'chrome'` 直接驱系统 Google Chrome，**不下载 Playwright 自带 chromium**
 *      （与 test/e2e/lib.mjs 的 chromePath() 同一策略：省 150MB 下载，也不受墙影响）。
 *   3. dev server 端口固定 8090：`.env.development` 里 VITE_APP_PORT=80（要 sudo，不能用），
 *      `BROWSER=none` 压掉 vite 的 `open: true`（否则每跑一次弹一个浏览器窗口）。
 *      `reuseExistingServer` 让本地已开着 `pnpm dev --port 8090` 时直接复用，不重复起。
 *
 * ⚠️ 后端 8080 必须自己跑着（dev profile）：E2E 打的是真接口真库，不 mock。
 */
const PORT = Number(process.env.ADMIN_E2E_PORT || 8090);

export default defineConfig({
  testDir: './e2e',
  // 业务 E2E 会改真库数据（推进状态 / 发货），并发跑会互相踩 —— 全局单 worker 串行
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.ADMIN_E2E_BASE || `http://localhost:${PORT}`,
    testIdAttribute: 'data-test',
    channel: 'chrome',
    headless: process.env.HEADFUL !== '1',
    viewport: { width: 1680, height: 1000 },
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: `pnpm dev --port ${PORT} --host 127.0.0.1`,
    url: `http://localhost:${PORT}/index`,
    reuseExistingServer: true,
    // 首次冷启动要预构建依赖（element-plus / echarts），90s 打不住
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { BROWSER: 'none' }
  }
});
