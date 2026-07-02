/**
 * 微信发货信息上报管理 API（admin 端）。
 *
 * 后端路径：
 *   - GET  /system/gz/pay/shipping/list           上报任务列表（gz:pay:shipping:list）
 *   - POST /system/gz/pay/shipping/retry-all       手动补报全部待发货（gz:pay:shipping:retry）
 *   - POST /system/gz/pay/shipping/{id}/retry      单条补报（gz:pay:shipping:retry）
 *
 * 存在意义：生产未部署 SnailJob，发货兜底 cron 不触发；owner 用本页排查「待发货」并手动补报，
 * 重报已发货单命中微信幂等码（10060023/268440065）收敛为 success。id 走 string 防 JS 精度丢失。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 发货上报任务 VO */
export interface GzPayShippingOrderVO {
  id: string;
  transactionId: string;
  outTradeNo: string;
  businessType: string;
  openid: string;
  logisticsType: number;
  itemDesc: string;
  paidTime?: string | null;
  /** pending / success / failed */
  uploadStatus: string;
  attemptCount: number;
  lastError?: string | null;
  uploadedTime?: string | null;
  createTime?: string | null;
}

/** 查询条件 */
export interface GzPayShippingQuery {
  pageNum?: number;
  pageSize?: number;
  uploadStatus?: string;
  businessType?: string;
  outTradeNo?: string;
}

/** 批量补报统计（R.data） */
export interface ShippingUploadStats {
  scanned: number;
  success: number;
  failed: number;
}

/** 分页列表 */
export function listShippingOrders(query: GzPayShippingQuery): AxiosPromise<GzPayShippingOrderVO[]> {
  return request({ url: '/system/gz/pay/shipping/list', method: 'get', params: query });
}

/** 手动补报全部待发货（单次最多 50 条，返回统计） */
export function retryAllShipping(): AxiosPromise<ShippingUploadStats> {
  return request({ url: '/system/gz/pay/shipping/retry-all', method: 'post' });
}

/** 单条补报 */
export function retryOneShipping(id: string): AxiosPromise<void> {
  return request({ url: `/system/gz/pay/shipping/${id}/retry`, method: 'post' });
}
