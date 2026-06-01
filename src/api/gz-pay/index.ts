/**
 * GZ-PAY-001 微信支付 V3 通道 API（admin 端）
 *
 * 后端路径：
 *   - GET  /system/gz/pay/channel/list                       通道配置（只读，gz:pay:channel:list）
 *   - GET  /system/gz/pay/transaction/list                   订单列表（gz:pay:transaction:list）
 *   - GET  /system/gz/pay/transaction/{id}                   订单详情（gz:pay:transaction:query）
 *   - GET  /system/gz/pay/transaction/{outTradeNo}/callback-logs  回调日志（gz:pay:transaction:query）
 *   - POST /system/gz/pay/test/create-order                  发起测试单（gz:pay:test）
 *   - POST /system/gz/pay/test/simulate-callback?outTradeNo= 模拟回调（mock profile，gz:pay:test）
 *
 * 字段权威：doc/11 §4.1 / §4.2 / §4.3。id 类全部 string（防 JS Number 精度丢失）。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 支付通道 VO（doc/11 §4.1，mch_id 后端已脱敏） */
export interface GzPayChannelVO {
  id: string;
  channelCode: string;
  displayName: string;
  appid: string;
  /** 商户号（已脱敏 16****88） */
  mchId: string;
  apiV3KeyRef: string;
  mchCertSerial: string;
  notifyUrl: string;
  refundNotifyUrl: string;
  enabled: number;
  remark?: string;
}

/** 支付订单 VO（doc/11 §4.2） */
export interface GzPayTransactionVO {
  id: string;
  outTradeNo: string;
  businessType: string;
  businessOrderNo?: string | null;
  userId?: string | null;
  openid: string;
  channelCode: string;
  /** 金额（分）；展示除以 100 */
  amountCent: number;
  currency: string;
  feeCent?: number | null;
  status: string;
  prepayId?: string | null;
  transactionId?: string | null;
  paidTime?: string | null;
  expireTime?: string | null;
  closedTime?: string | null;
  createTime?: string;
  remark?: string;
}

/** 回调日志 VO（doc/11 §4.3） */
export interface GzPayCallbackLogVO {
  id: string;
  transactionId?: string | null;
  outTradeNo?: string | null;
  callbackType: string;
  rawBody: string;
  processStatus: string;
  processError?: string | null;
  createTime?: string;
}

/** 测试单查询条件 */
export interface GzPayTransactionQuery {
  pageNum?: number;
  pageSize?: number;
  businessType?: string;
  status?: string;
  outTradeNo?: string;
  transactionId?: string;
}

/** mp 端 5 参签名（测试工具页拿来展示 / 二维码） */
export interface MpPayParamsVO {
  timeStamp: string;
  nonceStr: string;
  packageVal: string;
  signType: string;
  paySign: string;
  outTradeNo: string;
}

/** 通道列表（只读） */
export function listPayChannel(): AxiosPromise<GzPayChannelVO[]> {
  return request({ url: '/system/gz/pay/channel/list', method: 'get' });
}

/** 订单分页列表 */
export function listPayTransaction(query: GzPayTransactionQuery): AxiosPromise<GzPayTransactionVO[]> {
  return request({ url: '/system/gz/pay/transaction/list', method: 'get', params: query });
}

/** 订单详情 */
export function getPayTransaction(id: string): AxiosPromise<GzPayTransactionVO> {
  return request({ url: `/system/gz/pay/transaction/${id}`, method: 'get' });
}

/** 订单回调日志 */
export function listCallbackLogs(outTradeNo: string): AxiosPromise<GzPayCallbackLogVO[]> {
  return request({ url: `/system/gz/pay/transaction/${outTradeNo}/callback-logs`, method: 'get' });
}

/** 发起测试支付单 */
export function createTestOrder(data: { amountCent: number; openid?: string }): AxiosPromise<MpPayParamsVO> {
  return request({ url: '/system/gz/pay/test/create-order', method: 'post', data });
}

/** 模拟回调（mock profile 闭环驱动 → status=paid） */
export function simulateCallback(outTradeNo: string): AxiosPromise<void> {
  return request({ url: '/system/gz/pay/test/simulate-callback', method: 'post', params: { outTradeNo } });
}
