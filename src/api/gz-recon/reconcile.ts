/**
 * GZ-ADMIN-105 ⭐ 对账中心 API（admin 端 / 合同 §4.1 4% 分成兑现核心）
 *
 * 后端路径：/system/gz/recon/*（GzReconReconcileAdminController）
 * 权限：gz:recon:reconcile:list（查询）/ gz:recon:reconcile:export（导出）/ gz:recon:settle:list（季度结算）
 *
 * 口径（doc/11 §9 / §4.6）：跑批已落表（gz_recon_daily/monthly/settle），本 API 只读聚合。
 * 业务线统一 business_type（preorder=A / gacha=B），A/B 不交叉冲抵。金额全 cent（前端 / 100 显示元）。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 对账月度汇总（四栏 + 分成，SUM gz_recon_monthly） */
export interface ReconSummaryVO {
  /** 业务线 preorder（A）/ gacha（B） */
  businessType: string;
  /** GMV（分） */
  gmvCent: number;
  /** 退款（分） */
  refundCent: number;
  /** 通道费（分） */
  channelFeeCent: number;
  /** 实际到账流水（分）= MAX(0, gmv − refund − fee) */
  settleCent: number;
  /** 分成比例（千分之，400=4%） */
  commissionRateBp: number;
  /** 应得分成（分）= settle × rateBp / 10000（向下取整） */
  commissionCent: number;
}

/** 月度对账单明细（gz_recon_monthly） */
export interface GzReconMonthlyVO {
  id: string;
  businessMonth: string;
  businessType: string;
  gmvCent: number;
  refundCent: number;
  channelFeeCent: number;
  settleCent: number;
  commissionRateBp: number;
  commissionCent: number;
  status: string;
  confirmedBy?: string | null;
  confirmedTime?: string | null;
  settledTime?: string | null;
}

/** 每日对账明细（gz_recon_daily） */
export interface GzReconDailyVO {
  id: string;
  businessDay: string;
  businessType: string;
  systemGmvCent: number;
  systemRefundCent: number;
  systemFeeCent: number;
  systemSettleCent: number;
  channelGmvCent?: number | null;
  channelFeeCent?: number | null;
  diffGmvCent?: number | null;
  diffFeeCent?: number | null;
  status: string;
  createTime?: string | null;
}

/** 季度结算记录（gz_recon_settle） */
export interface GzReconSettleVO {
  id: string;
  quarter: string;
  commissionTotalCent: number;
  maintenanceTotalCent: number;
  payableTotalCent: number;
  paidAmountCent?: number | null;
  paidTime?: string | null;
  invoiceNo?: string | null;
  invoiceAmountCent?: number | null;
  status: string;
}

/** GET /reconcile/summary — 四栏汇总 + 分成（某业务线 + 月份区间） */
export function getReconSummary(businessType: string, startMonth: string, endMonth: string): AxiosPromise<ReconSummaryVO> {
  return request({
    url: '/system/gz/recon/reconcile/summary',
    method: 'get',
    params: { businessType, startMonth, endMonth }
  });
}

/** GET /reconcile/monthly — 月度对账单明细列表（按业务月倒序） */
export function listReconMonthly(businessType?: string, startMonth?: string, endMonth?: string): AxiosPromise<GzReconMonthlyVO[]> {
  return request({
    url: '/system/gz/recon/reconcile/monthly',
    method: 'get',
    params: { businessType, startMonth, endMonth }
  });
}

/** GET /reconcile/daily — 每日对账明细分页 */
export function listReconDaily(params: {
  businessType?: string;
  startDate?: string;
  endDate?: string;
  pageNum?: number;
  pageSize?: number;
}): AxiosPromise<{ total: number; rows: GzReconDailyVO[] }> {
  return request({
    url: '/system/gz/recon/reconcile/daily',
    method: 'get',
    params
  });
}

/** 拼豆记账台账单月行（纯展示，不计 4% 分成） */
export interface PindouBoardMonthRow {
  month: string;
  gmvCent: number;
  refundCent: number;
  channelFeeCent: number;
  netCent: number;
  paidCount: number;
  refundCount: number;
}

/** 拼豆记账台账（收款/退款/通道费/净额 + 逐月，不计分成） */
export interface PindouBoardVO {
  gmvCent: number;
  refundCent: number;
  channelFeeCent: number;
  netCent: number;
  paidCount: number;
  refundCount: number;
  months: PindouBoardMonthRow[];
}

/** 回收反向打款台账单月行（按 transferred_time 归月） */
export interface RecycleBoardMonthRow {
  month: string;
  payoutCent: number;
  payoutCount: number;
}

/** 回收反向打款台账（成功打款金额/笔数 + 处理中/失败 + 逐月，独立核算不计分成） */
export interface RecycleBoardVO {
  payoutSuccessCent: number;
  payoutSuccessCount: number;
  processingCount: number;
  failedCount: number;
  months: RecycleBoardMonthRow[];
}

/** GET /reconcile/pindou-board — 拼豆记账台账（不计 4% 分成） */
export function getPindouBoard(startMonth: string, endMonth: string): AxiosPromise<PindouBoardVO> {
  return request({
    url: '/system/gz/recon/reconcile/pindou-board',
    method: 'get',
    params: { startMonth, endMonth }
  });
}

/** GET /reconcile/recycle-board — 回收反向打款台账（独立核算不计分成） */
export function getRecycleBoard(startMonth: string, endMonth: string): AxiosPromise<RecycleBoardVO> {
  return request({
    url: '/system/gz/recon/reconcile/recycle-board',
    method: 'get',
    params: { startMonth, endMonth }
  });
}

/** GET /settle/list — 季度结算列表（按季度倒序） */
export function listReconSettle(): AxiosPromise<GzReconSettleVO[]> {
  return request({
    url: '/system/gz/recon/settle/list',
    method: 'get'
  });
}

/**
 * POST /reconcile/rebuild — 立即重算对账（D16 #1，方案 A）。
 * 不传则重算前一日 + 其月度；跑批幂等 UPSERT 重跑安全。消除「忘注册 cron → 首月分成 ¥0」风险。
 */
export function rebuildRecon(businessDay?: string, month?: string): AxiosPromise<void> {
  return request({
    url: '/system/gz/recon/reconcile/rebuild',
    method: 'post',
    params: { businessDay, month }
  });
}
