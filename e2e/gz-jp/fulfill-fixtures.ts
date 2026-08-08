/**
 * GZ-JP-108 履约看板 E2E 的固定数据（fixture）与登录辅助。
 *
 * 为什么要自己造数据、而不是用库里现成的单：
 *   1. **可重复**。E2E 会真的推进状态 / 真的发货，跑完数据就变了。用现成单跑第二遍必挂。
 *      这里每次 beforeAll 先删后插，任何时刻从零开始都是同一个局面。
 *   2. **可隔离**。fixture 商品挂在一个专用「场」下，看板按场筛选后视野里
 *      **只有** fixture 行 —— 断言可以写死行数 / 组数，不受 dev 库里历史脏数据影响。
 *   3. **要两位客人**。AC 要求「跨客人勾选时批量按钮置灰」，而 dev 库里付过款的单当时只有一位客人。
 *
 * ⚠️ `docker exec` 灌 SQL 必须带 `-i`，否则 stdin 根本不进容器、SQL 静默不执行还不报错
 *    （GZ-JP-106 报告里记过这一坑）。
 */
import { execFileSync } from 'node:child_process';

/** 专用 id 段：99xxx，与业务自增（当前 9110 左右）拉开距离，肉眼可辨、删起来安全 */
export const FX = {
  eventId: 99101,
  eventName: 'GZ-JP-108 E2E 验收场',
  productId: 99101,
  /** 客人甲：库里已有的 gz_user（跨订单凑包裹用他） */
  userA: '14',
  /** 客人乙：另一位真实 gz_user（只为验证「跨客人置灰」） */
  userB: '13',
  orderA1No: 'JPO-E2E108-A1',
  orderA2No: 'JPO-E2E108-A2',
  orderB1No: 'JPO-E2E108-B1',
  /** 每行商品名唯一 —— E2E 靠它精确定位某一行（行上没有 data-test） */
  itemA1Name: 'E2E-A1-购买中',
  itemA1DoneName: 'E2E-A1-已发货',
  itemA2Name: 'E2E-A2-分拣中',
  itemB1Name: 'E2E-B1-购买中',
  amountA1Cent: 12800,
  amountA2Cent: 20000,
  amountB1Cent: 8000
} as const;

const MYSQL = ['exec', '-i', 'sensenran-dev-mysql', 'mysql', '-uroot', '-proot', 'ry-vue'];

function mysql(sql: string): string {
  return execFileSync('docker', MYSQL, { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

/** 商品快照（看板的商品名 / 编号 / 场名全读它，不回查商品表 —— 见 GzJpFulfillServiceImpl#readSnapshot） */
function snapshot(name: string, priceCent: number): string {
  return JSON.stringify({
    productId: String(FX.productId),
    productNo: 'JPP-E2E108-0001',
    name,
    mainImageId: '1',
    priceCent,
    deliveryDateText: '2026 年 9 月上旬',
    noticeText: 'E2E fixture',
    eventId: String(FX.eventId),
    eventNo: 'JPE-E2E108',
    eventName: FX.eventName
  });
}

const ADDRESS = JSON.stringify({
  recipient: 'E2E 收件人',
  mobile: '13800000000',
  province: '四川省',
  city: '成都市',
  district: '武侯区',
  detail: 'E2E 测试地址 1 号'
});

/**
 * 造局：一个专用场 + 一个商品 + 3 张已付款订单 + 4 个商品行。
 *
 * ```
 * 客人甲(userA) ── JPO-E2E108-A1 ─┬─ E2E-A1-购买中   purchasing   ← 批量推进的对象
 *                                 └─ E2E-A1-已发货   delivered    ← 终态，勾选框必须禁用
 *              └─ JPO-E2E108-A2 ─── E2E-A2-分拣中   cn_sorting   ← 与 A1 行凑同一个包裹（跨订单发货）
 * 客人乙(userB) ── JPO-E2E108-B1 ─── E2E-B1-购买中   purchasing   ← 跨客人勾选 / 标记失败弹窗的对象
 * ```
 */
export function seedFulfillFixtures(): void {
  mysql(`
SET NAMES utf8mb4;
DELETE FROM gz_jp_order_item WHERE id BETWEEN 99101 AND 99199;
DELETE FROM gz_jp_order      WHERE id BETWEEN 99101 AND 99199;
DELETE FROM gz_jp_product    WHERE id BETWEEN 99101 AND 99199;
DELETE FROM gz_jp_event      WHERE id BETWEEN 99101 AND 99199;

INSERT INTO gz_jp_event (id, event_no, name, description, start_time, end_time, status, sort_no, tenant_id, create_time, del_flag)
VALUES (${FX.eventId}, 'JPE-E2E108', '${FX.eventName}', 'GZ-JP-108 Playwright E2E 专用，可随时删',
        NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 'open', 999, '1001', NOW(), '0');

INSERT INTO gz_jp_product (id, product_no, event_id, name, main_image_id, price_cent, status, sort_no, tenant_id, create_time, del_flag)
VALUES (${FX.productId}, 'JPP-E2E108-0001', ${FX.eventId}, 'E2E fixture 商品', 1, ${FX.amountA1Cent}, 'on_shelf', 1, '1001', NOW(), '0');

INSERT INTO gz_jp_order (id, order_no, user_id, total_amount_cent, business_status, address_snapshot_json, paid_time, tenant_id, create_time, del_flag)
VALUES
 (99101, '${FX.orderA1No}', ${FX.userA}, ${FX.amountA1Cent + FX.amountA2Cent}, 'paid', '${ADDRESS}', NOW(), '1001', NOW(), '0'),
 (99102, '${FX.orderA2No}', ${FX.userA}, ${FX.amountA2Cent}, 'paid', '${ADDRESS}', NOW(), '1001', NOW(), '0'),
 (99103, '${FX.orderB1No}', ${FX.userB}, ${FX.amountB1Cent}, 'paid', '${ADDRESS}', NOW(), '1001', NOW(), '0');

INSERT INTO gz_jp_order_item
 (id, order_id, user_id, product_id, product_snapshot_json, qty, unit_price_cent, amount_cent, source,
  fulfill_status, carrier_code, tracking_no, shipped_at, tenant_id, create_time, del_flag)
VALUES
 (99101, 99101, ${FX.userA}, ${FX.productId}, '${snapshot(FX.itemA1Name, FX.amountA1Cent)}', 1, ${FX.amountA1Cent}, ${FX.amountA1Cent}, 'batch',
  'purchasing', NULL, NULL, NULL, '1001', NOW(), '0'),
 (99104, 99101, ${FX.userA}, ${FX.productId}, '${snapshot(FX.itemA1DoneName, FX.amountA1Cent)}', 1, ${FX.amountA1Cent}, ${FX.amountA1Cent}, 'batch',
  'delivered', 'sf', 'E2E108-OLD-PKG', NOW(), '1001', NOW(), '0'),
 (99102, 99102, ${FX.userA}, ${FX.productId}, '${snapshot(FX.itemA2Name, FX.amountA2Cent)}', 1, ${FX.amountA2Cent}, ${FX.amountA2Cent}, 'batch',
  'cn_sorting', NULL, NULL, NULL, '1001', NOW(), '0'),
 (99103, 99103, ${FX.userB}, ${FX.productId}, '${snapshot(FX.itemB1Name, FX.amountB1Cent)}', 1, ${FX.amountB1Cent}, ${FX.amountB1Cent}, 'batch',
  'purchasing', NULL, NULL, NULL, '1001', NOW(), '0');
`);
}

/** 跑完收摊（KEEP_E2E_FIXTURES=1 可保留现场用于排查） */
export function cleanupFulfillFixtures(): void {
  if (process.env.KEEP_E2E_FIXTURES === '1') return;
  mysql(`
DELETE FROM gz_jp_order_item WHERE id BETWEEN 99101 AND 99199;
DELETE FROM gz_jp_order      WHERE id BETWEEN 99101 AND 99199;
DELETE FROM gz_jp_product    WHERE id BETWEEN 99101 AND 99199;
DELETE FROM gz_jp_event      WHERE id BETWEEN 99101 AND 99199;
`);
}

/** 直接查库断言（UI 断言之外再钉一道：页面显示对 ≠ 库里写对） */
export function queryItemStatus(itemId: number): { status: string; tracking: string } {
  const out = mysql(`SELECT CONCAT(fulfill_status, '|', IFNULL(tracking_no, '')) FROM gz_jp_order_item WHERE id = ${itemId};`);
  const line = out.trim().split('\n').pop() ?? '';
  const [status, tracking] = line.split('|');
  return { status: status ?? '', tracking: tracking ?? '' };
}

const BACKEND = process.env.ADMIN_BACKEND || 'http://localhost:8080';
const CLIENT_ID = process.env.ADMIN_CLIENT_ID || 'e5cd7e4891bf95d1d19206ce24a7b32e';

/**
 * 取 admin token。
 * ⚠️ `clientId` 是 **body 字段**（不是 header）—— 放 header 会拿到「客户端 id 与 token 不匹配」。
 * ⚠️ 本机 clash 之类代理会吞 127.0.0.1，先清代理 env 再 fetch。
 */
export async function loginAdminToken(): Promise<string> {
  for (const k of ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy']) delete process.env[k];
  process.env.NO_PROXY = '*';
  process.env.no_proxy = '*';
  const res = await fetch(`${BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', clientid: CLIENT_ID },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      grantType: 'password',
      tenantId: process.env.ADMIN_TENANT || '1001',
      username: process.env.ADMIN_USER || 'admin',
      password: process.env.ADMIN_PASS || 'admin123'
    })
  });
  const json: any = await res.json();
  const token = json?.data?.access_token;
  if (!token) throw new Error(`admin 登录失败: ${JSON.stringify(json).slice(0, 300)}`);
  return token;
}
