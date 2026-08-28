/**
 * GZ-RECYCLE-006 回收到店时段 API（admin 端，按门店可配，取代写死的上午/下午两档）。
 *
 * 后端路径：/system/gz/recycle/timeSlot/*
 * 权限：gz:recycle:timeSlot:list / add / edit / remove
 * 字段权威：GzRecycleTimeSlotVO.java、GzRecycleTimeSlotBo.java（gz_recycle_time_slot 业务表）。
 * ID 跨层契约 #1：所有 id 字段 string。时间 "HH:mm:ss"。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 回收到店时段 VO（与 GzRecycleTimeSlotVO.java 对齐；id/storeId 为 string） */
export interface GzRecycleTimeSlotVO {
  id: string;
  /** 所属门店 id */
  storeId: string;
  /** 门店名（join gz_bean_store） */
  storeName?: string | null;
  /** 时段展示名（可空；空时 mp 用 "HH:mm-HH:mm"） */
  label?: string | null;
  /** 到店时段开始 "HH:mm:ss" */
  startTime: string;
  /** 到店时段结束 "HH:mm:ss" */
  endTime: string;
  /** 生效星期（ISO 1=周一..7=周日，逗号分隔）—— GZ-RECYCLE-015 对齐拼豆 */
  weekdays?: string | null;
  /** 生效起 "yyyy-MM-dd"（空 = 立即生效） */
  effectiveDate?: string | null;
  /** 生效止 "yyyy-MM-dd"（空 = 长期有效） */
  expireDate?: string | null;
  /** 0=停用 / 1=启用 */
  enabled: number;
  /** 展示排序（小在前） */
  sortNo: number;
  createTime?: string;
  updateTime?: string;
  remark?: string | null;
}

/** 新增 / 编辑 BO（与 GzRecycleTimeSlotBo.java 对齐） */
export interface GzRecycleTimeSlotForm {
  id?: string | null;
  storeId?: number | string | null;
  label?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  /** 生效星期（ISO 1-7 逗号分隔）；空 → 后端视作全周 */
  weekdays?: string | null;
  /** 生效起（空 = 立即生效） */
  effectiveDate?: string | null;
  /** 生效止（空 = 长期有效） */
  expireDate?: string | null;
  enabled?: number | null;
  sortNo?: number | null;
  remark?: string | null;
}

/** 列表查询参数（与 GzRecycleTimeSlotQueryBo.java 对齐） */
export interface GzRecycleTimeSlotQuery {
  storeId?: number | string | null;
  enabled?: number | null;
  pageNum?: number;
  pageSize?: number;
}

/** GET 列表（分页，按门店 / 启用筛选） */
export function listGzRecycleTimeSlot(query: GzRecycleTimeSlotQuery): AxiosPromise<GzRecycleTimeSlotVO[]> {
  return request({ url: '/system/gz/recycle/timeSlot/list', method: 'get', params: query });
}

/** GET 详情 */
export function getGzRecycleTimeSlot(id: string): AxiosPromise<GzRecycleTimeSlotVO> {
  return request({ url: `/system/gz/recycle/timeSlot/${id}`, method: 'get' });
}

/** POST 新增（end>start + 同门店唯一校验） */
export function addGzRecycleTimeSlot(data: GzRecycleTimeSlotForm) {
  return request({ url: '/system/gz/recycle/timeSlot', method: 'post', data });
}

/** PUT 编辑（end>start + 同门店唯一校验排除自身） */
export function updateGzRecycleTimeSlot(data: GzRecycleTimeSlotForm) {
  return request({ url: '/system/gz/recycle/timeSlot', method: 'put', data });
}

/** DELETE 软删 */
export function delGzRecycleTimeSlot(ids: Array<string> | string) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({ url: `/system/gz/recycle/timeSlot/${idStr}`, method: 'delete' });
}

/** POST 启用 / 停用切换 */
export function toggleGzRecycleTimeSlot(id: string, enabled: number) {
  return request({ url: `/system/gz/recycle/timeSlot/toggle/${id}`, method: 'post', params: { enabled } });
}
