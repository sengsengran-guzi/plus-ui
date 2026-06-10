/**
 * GZ-PAY-105 反向打款单 API（admin 端，商家转账到零钱 V3，ADR-0006）
 *
 * 后端路径：
 *   - GET /system/gz/pay/payout/list   反向打款单列表（gz:pay:payout:list，仅 owner）
 *   - GET /system/gz/pay/payout/{id}   反向打款单详情（gz:pay:payout:query，仅 owner）
 *
 * 字段权威：doc/11 §4.8。id 类全部 string（防 JS Number 精度丢失，跨层契约 #1）。
 * 本卡仅查看（建单/触发在 D14 GZ-RECYCLE-003 店员核对端）。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 反向打款单 VO（doc/11 §4.8） */
export interface GzPayPayoutVO {
  id: string;
  outPayoutNo: string;
  businessType: string;
  businessOrderNo: string;
  userId: string;
  receiverOpenid: string;
  /** 金额（分）；展示除以 100 */
  amountCent: number;
  /** created / processing / success / failed / cancelled（gz_payout_status 字典） */
  status: string;
  payoutId?: string | null;
  batchId?: string | null;
  transferredTime?: string | null;
  failReason?: string | null;
  createTime?: string;
  remark?: string;
}

/** 反向打款单查询条件 */
export interface GzPayPayoutQuery {
  pageNum?: number;
  pageSize?: number;
  status?: string;
  outPayoutNo?: string;
  businessOrderNo?: string;
  payoutId?: string;
}

/** 反向打款单分页列表 */
export function listPayout(query: GzPayPayoutQuery): AxiosPromise<GzPayPayoutVO[]> {
  return request({ url: '/system/gz/pay/payout/list', method: 'get', params: query });
}

/** 反向打款单详情 */
export function getPayout(id: string): AxiosPromise<GzPayPayoutVO> {
  return request({ url: `/system/gz/pay/payout/${id}`, method: 'get' });
}
