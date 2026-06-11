/**
 * GZ-ADMIN-104 跨境物流 2 态推进 API（plus-ui owner 兜底端）
 *
 * 后端路径：/system/gz/ord/logistics/*（GzLogisticsController）
 * 权限：gz:ord:logistics:push（推进/改单号）/ gz:ord:logistics:rollback（owner 回退）
 *
 * C1 2 态 + 终态：in_japan → in_china_dispatching（必录快递+单号）→ delivered。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

export interface LogisticsForwardBody {
  businessType: string;
  businessOrderNo: string;
  cnCarrierCode?: string;
  cnTrackingNo?: string;
}

export interface LogisticsCarrierUpdateBody {
  businessType: string;
  businessOrderNo: string;
  cnCarrierCode: string;
  cnTrackingNo: string;
}

export interface LogisticsRollbackBody {
  businessType: string;
  businessOrderNo: string;
  reason: string;
}

/** POST /forward — 推进到下一态（in_japan→in_china_dispatching 必录快递+单号 / →delivered） */
export function forwardLogistics(body: LogisticsForwardBody): AxiosPromise<void> {
  return request({ url: '/system/gz/ord/logistics/forward', method: 'post', data: body });
}

/** PUT /carrier — 改单号（仅 in_china_dispatching） */
export function updateLogisticsCarrier(body: LogisticsCarrierUpdateBody): AxiosPromise<void> {
  return request({ url: '/system/gz/ord/logistics/carrier', method: 'put', data: body });
}

/** POST /rollback — owner 回退（reason 必填） */
export function rollbackLogistics(body: LogisticsRollbackBody): AxiosPromise<void> {
  return request({ url: '/system/gz/ord/logistics/rollback', method: 'post', data: body });
}
