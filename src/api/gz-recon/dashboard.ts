/**
 * GZ-ADMIN-106 数据看板 V1.1 交易盘面 API（单聚合接口）
 *
 * 后端路径：/system/gz/recon/dashboard/v11-summary（GzReconDashboardController）
 * 权限：gz:recon:dashboard:v11（owner-only）
 *
 * 一次性返所有 V1.1 卡片，前端 1 次调用本地分发（不前端多次串行）。金额 cent（前端 /100 元）。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 热销预购商品行 */
export interface TopProductVO {
  productId: string;
  name: string;
  salesCount: number;
}

/** V1.1 交易盘面聚合 */
export interface GzDashboardV11SummaryVO {
  todayOrderCountPreorder: number;
  todayOrderCountGacha: number;
  todayGmvCentPreorder: number;
  todayGmvCentGacha: number;
  monthGmvCentPreorder: number;
  monthGmvCentGacha: number;
  monthRefundCentPreorder: number;
  monthRefundCentGacha: number;
  monthSettleCentPreorder: number;
  monthSettleCentGacha: number;
  gachaOpenCount: number;
  gachaAvgValueCent: number;
  pendingShipCount: number;
  topProducts: TopProductVO[];
}

/** GET /v11-summary — V1.1 交易盘面单聚合 */
export function getV11Summary(): AxiosPromise<GzDashboardV11SummaryVO> {
  return request({
    url: '/system/gz/recon/dashboard/v11-summary',
    method: 'get'
  });
}
