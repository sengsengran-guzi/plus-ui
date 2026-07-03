/**
 * 拼豆实时余量表格 + 按桌型配额关闭 API（admin 端，客户 0702 反馈 #4a）。
 *
 * 后端路径：
 *   - GET  /system/gz/bean/booking/availability/detail — 明细数字表格（perm gz:bean:booking:list）
 *   - GET  /system/gz/bean/slotQuotaClose/list           — 配额关闭配置列表（perm gz:bean:slotQuota:list）
 *   - POST /system/gz/bean/slotQuotaClose                — upsert 单格关闭数（perm gz:bean:slotQuota:edit）
 *
 * 口径：remaining = max(0, opened − booked − closedSeat − quotaClose)。表格改「关闭数」即回写 quotaClose。
 * id 一律 string（跨层契约 #1，防 JS long 精度丢失）。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 实时余量表格明细行 VO（与 GzBeanSlotAvailabilityDetailVO.java 对齐） */
export interface GzBeanSlotAvailabilityDetailVO {
  /** 桌型档 id（string；upsert 关闭数回传） */
  seatTypeConfigId: string;
  /** 桌型 code（调试用） */
  seatType?: string | null;
  /** 桌型显示名 */
  name: string;
  /** 订法 whole=整桌 / seat=按座 */
  bookMode?: string | null;
  /** 1h 格起 HH:mm */
  slotStart: string;
  /** 1h 格止 HH:mm */
  slotEnd: string;
  /** 开放总配额 */
  opened: number;
  /** 已约 */
  booked: number;
  /** 老 seat_id 关闭折算数（周复发） */
  closedSeat: number;
  /** 新配额关闭数（本表格 stepper 改写目标） */
  quotaClose: number;
  /** 剩余 = max(0, opened − booked − closedSeat − quotaClose) */
  remaining: number;
}

/** 配额关闭配置行 VO（与 GzBeanSlotQuotaCloseVO.java 对齐） */
export interface GzBeanSlotQuotaCloseVO {
  id: string;
  storeId: string;
  seatTypeConfigId: string;
  sessDate: string;
  slotStart: string;
  closeCount: number;
  createTime?: string | null;
  remark?: string | null;
}

/** upsert 关闭数入参（与 GzBeanSlotQuotaCloseBo.java 对齐） */
export interface GzBeanSlotQuotaCloseUpsert {
  storeId: number | string;
  seatTypeConfigId: number | string;
  sessDate: string;
  slotStart: string;
  closeCount: number;
  remark?: string | null;
}

/** GET /system/gz/bean/booking/availability/detail — 实时余量明细 */
export function getGzBeanAvailabilityDetail(query: {
  storeId: number | string;
  sessDate: string;
}): AxiosPromise<GzBeanSlotAvailabilityDetailVO[]> {
  return request({
    url: '/system/gz/bean/booking/availability/detail',
    method: 'get',
    params: query
  });
}

/** GET /system/gz/bean/slotQuotaClose/list — 配额关闭配置列表 */
export function listGzBeanSlotQuotaClose(query: {
  storeId?: number | string | null;
  seatTypeConfigId?: number | string | null;
  sessDate?: string | null;
  pageNum?: number;
  pageSize?: number;
}): AxiosPromise<{ total: number; rows: GzBeanSlotQuotaCloseVO[] }> {
  return request({
    url: '/system/gz/bean/slotQuotaClose/list',
    method: 'get',
    params: query
  });
}

/** POST /system/gz/bean/slotQuotaClose — upsert 单格关闭数（覆盖，不累加） */
export function upsertGzBeanSlotQuotaClose(data: GzBeanSlotQuotaCloseUpsert): AxiosPromise<void> {
  return request({
    url: '/system/gz/bean/slotQuotaClose',
    method: 'post',
    data
  });
}
