# Admin E2E 验收走查 harness

plus-ui (admin) 的自动化截图走查 / 验收脚本。puppeteer-core 驱**系统 Chrome**，注入 `gz_owner` token 逐路由截图 + 关键页开"新增"弹窗。

> 与 mp 端 `miniapp/test/e2e/`（uni-automator 驱微信模拟器）对称。独立 `node_modules`，**不进 plus-ui app 依赖树**（不触发 CLAUDE.md 铁律 #8）。

## 用途

- V1 上线前 / 演示前对 admin 全量页面做可达 + 渲染 + 截图回归
- 抓"列表/下拉拿不到数据"这类**前后端响应形状契约 bug**（单测/编译照不出，必须真跑 UI + 真数据）—— 见 `doc/daily/D16/acceptance/验收报告.md` §4

## 前置

| 依赖 | 起法 |
|---|---|
| 基础设施 | `docker compose -f code/main/RuoYi-Vue-Plus/script/docker/dev-compose.yml up -d`（MySQL:3307 / Redis:6380） |
| 后端 :8080 | `cd code/main/RuoYi-Vue-Plus && mvn spring-boot:run -pl ruoyi-admin` |
| admin dev :80 | `cd code/main/plus-ui && pnpm dev` |
| 系统 Chrome | mac 默认 `/Applications/Google Chrome.app`；其它路径设 `CHROME_BIN` |

## 安装 + 运行

```bash
cd code/main/plus-ui/test/e2e
npm install                 # 装 puppeteer-core（首次，隔离于 plus-ui）
npm run acceptance          # headless 全量走查，截图 → ./screenshots
npm run acceptance:headful  # 带界面（调试）
node acceptance.mjs --only 10,31,70   # 只跑路由名前缀匹配的页
```

退出码：`0` 全部渲染 OK / `1` 有页被弹回登录或出错 / `2` 致命错误（Chrome/登录起不来）。
产物：`./screenshots/<route>.png`、`<route>-dialog.png`、`_manifest.json`（逐页机读结果）。

## 环境变量（可覆盖）

`ADMIN_BASE`(默认 http://localhost) · `ADMIN_BACKEND`(http://localhost:8080) · `ADMIN_USER`/`ADMIN_PASS`/`ADMIN_TENANT`(gz_owner / gz_owner123! / 1001) · `ADMIN_CLIENT_ID` · `CHROME_BIN` · `ADMIN_SHOT_DIR`

## 关键坑（踩过，写死在代码里）

1. **token 注入用原始字符串**：plus-ui `useStorage('Admin-Token', null)` 默认值 null → VueUse 用 'any' 序列化器（read/write 恒等/String，非 JSON）。注入要 `localStorage.setItem('Admin-Token', token)` 原始值，`JSON.stringify` 多包引号 → token 带引号 → 401 弹回登录。
2. **客户端跳转不整页 reload**：快速连续整页 reload 会重复打 getInfo/getRouters 触发 ruoyi 限流"访问过于频繁"。脚本用 `pushState + popstate` 客户端跳转规避。
3. **清代理**：clash 等本地代理吞 127.0.0.1，脚本启动 `clearProxy()` 清 HTTP(S)_PROXY + Chrome `--no-proxy-server`。
4. **关弹窗**：admin-user 等弹窗带密码框，不关会污染后续页检测；每页前 `closeOverlays()`。

## 加新页

只改 `routes.mjs` 补一行（路径取自后端 `GET /system/menu/getRouters` 拼接）。`dialog:true` 会额外尝试开"新增"弹窗截图。

## admin 登录账号说明

测 admin 用 `gz_owner`（租户 1001，谷子业务全在此租户），**别用 ruoyi 超管 admin/000000**（看不到 1001 数据）。dev 环境登录无验证码，password grant 直接发 token。
