/**
 * 回收周看板 E2E 的夹具与登录辅助（D21 对抗性测试第二轮 F4/F5/F6 回归）。
 *
 * 造局原则同 gz-jp/fulfill-fixtures：每次 beforeAll 先清后建，跑完硬删 —— 看板会真的写库
 * （手动占用 / 释放），用现成数据跑第二遍必挂。
 *
 * ⚠️ `docker exec` 灌 SQL 必须带 `-i`，否则 stdin 不进容器、SQL 静默不执行还不报错。
 */
import { execFileSync } from 'node:child_process';

const MYSQL = ['exec', '-i', 'sensenran-dev-mysql', 'mysql', '-uroot', '-proot', 'ry-vue'];
const BACKEND = process.env.ADMIN_BACKEND || 'http://localhost:8080';
const CLIENT_ID = process.env.ADMIN_CLIENT_ID || 'e5cd7e4891bf95d1d19206ce24a7b32e';

/** 夹具口径：门店 2（成都建设路店，档 2/4/9）+ 本周三个互不相干的空格 */
export const FX = {
  storeId: 2,
  storeName: '成都建设路店',
  /** 备注前缀 —— 清理靠它精确定位，绝不误删业务数据 */
  remarkPrefix: 'D21-E2E-',
  /** F5 陈旧态：释放确认弹窗开着时被并发释放 */
  releaseCell: { date: '2026-08-12', slotId: '2' },
  /** F4 业务拒绝：提交手动占用时该格已被他人占走（4122） */
  conflictCell: { date: '2026-08-13', slotId: '4' },
  /** F6 重入：连点两次确认 */
  reentryCell: { date: '2026-08-11', slotId: '9' },
  /** 回归：手动占用改期 happy path（本周多为过去日期，验「手动占用不受禁选过去日期约束」） */
  moveFrom: { date: '2026-08-11', slotId: '2' },
  moveTo: { date: '2026-08-11', slotId: '4', slotLabel: '下午' }
} as const;

export function mysql(sql: string): string {
  return execFileSync('docker', MYSQL, { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

/** 取 admin token（clientId 是 body 字段不是 header；先清代理 env，本机代理会吞 127.0.0.1）。 */
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
  const json = (await res.json()) as { data?: { access_token?: string } };
  const token = json?.data?.access_token;
  if (!token) throw new Error(`admin 登录失败: ${JSON.stringify(json).slice(0, 300)}`);
  return token;
}

/** 后端手动占用（造格用，走真端点而不是 SQL —— 保证与 UI 建的行完全同构）。 */
export async function apiManualHold(token: string, apptDate: string, timeSlotIds: string[], remark: string): Promise<string[]> {
  const res = await fetch(`${BACKEND}/system/gz/recycle/appointment/manual-hold`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', clientid: CLIENT_ID, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ storeId: FX.storeId, apptDate, timeSlotIds, remark })
  });
  const json = (await res.json()) as { code: number; msg: string; data?: Array<{ id: string }> };
  if (json.code !== 200) throw new Error(`manual-hold 失败: ${json.code} ${json.msg}`);
  return (json.data ?? []).map((r) => r.id);
}

/** 后端释放（模拟「另一个店员在另一个标签页把它释放了」）。 */
export async function apiReleaseHold(token: string, id: string): Promise<number> {
  const res = await fetch(`${BACKEND}/system/gz/recycle/appointment/${id}/release-hold`, {
    method: 'POST',
    headers: { clientid: CLIENT_ID, Authorization: `Bearer ${token}` }
  });
  const json = (await res.json()) as { code: number };
  return json.code;
}

/**
 * 某条夹具备注对应的行数（按 remark 精确匹配 —— 用例之间不互相污染计数，
 * 验「失败的那笔不落库」/「连点只落一行」都靠它）。
 */
export function countRowsByRemark(remarkSuffix: string, status?: string): number {
  const cond = status ? ` AND status = '${status}'` : '';
  const out = mysql(`SELECT COUNT(*) FROM gz_recycle_appointment WHERE remark = '${FX.remarkPrefix}${remarkSuffix}'${cond};`);
  return Number(out.trim().split('\n').pop() ?? '0');
}

/** 清场：硬删本夹具建的所有行（remark 前缀命中；绝不软删——软删行仍占 appointment_no 唯一键）。 */
export function cleanupBoardFixtures(): void {
  mysql(`DELETE FROM gz_recycle_appointment WHERE remark LIKE '${FX.remarkPrefix}%';`);
}
