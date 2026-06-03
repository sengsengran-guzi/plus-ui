/**
 * GZ-PAY-103 退款服务 API（admin 端）
 *
 * 后端路径：
 *   - POST /system/gz/pay/refund/apply   发起全额退款（gz:pay:refund:apply）body { transactionId, reason }
 *   - GET  /system/gz/pay/refund/list    退款记录分页（gz:pay:refund:list）params { outTradeNo?, status? }
 *
 * 字段权威：doc/11 §4.4。id 类全部 string（防 JS Number 精度丢失，跨层契约铁律 #1）。
 * 仅全额退款（doc/10 §6.E5）：申请无金额入参，退款额由后端取原单 amount_cent。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 退款单 VO（doc/11 §4.4） */
export interface GzPayRefundVO {
  id: string;
  /** 商户退款单号 RF-yyyyMMdd-6位 */
  refundNo: string;
  /** 微信交易号（原支付单） */
  transactionId: string;
  /** 原业务订单号 */
  outTradeNo: string;
  /** 微信退款单号（受理/回调后有值） */
  wechatRefundId?: string | null;
  /** 退款金额（分）；展示除以 100 */
  refundAmountCent: number;
  reason: string;
  /** refunding / refunded / failed */
  status: string;
  /** 触发人 username */
  triggeredBy: string;
  triggeredTime?: string | null;
  refundedTime?: string | null;
  createTime?: string;
  remark?: string;
}

/** 退款申请入参（无金额：仅全额，后端取原单 amount_cent） */
export interface RefundApplyBody {
  /** 原支付交易行主键 id */
  transactionId: string;
  /** 退款原因（必填，≤255） */
  reason: string;
}

/** 退款记录查询条件 */
export interface GzPayRefundQuery {
  pageNum?: number;
  pageSize?: number;
  outTradeNo?: string;
  status?: string;
}

/** 发起全额退款 */
export function applyRefund(data: RefundApplyBody): AxiosPromise<GzPayRefundVO> {
  return request({ url: '/system/gz/pay/refund/apply', method: 'post', data });
}

/** 退款记录分页列表 */
export function listRefund(query: GzPayRefundQuery): AxiosPromise<GzPayRefundVO[]> {
  return request({ url: '/system/gz/pay/refund/list', method: 'get', params: query });
}
