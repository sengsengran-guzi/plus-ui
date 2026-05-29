/**
 * GZ-BEAN-002 拼豆时段模板管理 API（admin 端）
 *
 * 后端路径：/system/gz/bean/slot/*
 * 权限：gz:bean:slot:list / add / edit / remove / batchByWeek
 *
 * 字段权威：doc/11 §3.2 gz_bean_time_slot_template
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 时段模板 VO */
export interface GzBeanTimeSlotTemplateVO {
  id: number;
  storeId: number;
  slotName?: string | null;
  /** "HH:mm:ss" */
  startTime: string;
  endTime: string;
  /** "1,2,3,4,5" */
  weekdays: string;
  effectiveDate?: string | null;
  expireDate?: string | null;
  enabled: number;
  sortNo: number;
  createTime?: string;
  remark?: string | null;
}

/** 新增 / 编辑 BO */
export interface GzBeanTimeSlotTemplateForm {
  id?: number | null;
  storeId?: number | null;
  slotName?: string | null;
  startTime?: string;
  endTime?: string;
  weekdays?: string;
  effectiveDate?: string | null;
  expireDate?: string | null;
  enabled?: number;
  sortNo?: number;
  remark?: string | null;
}

/** 查询参数 */
export interface GzBeanTimeSlotTemplateQuery {
  storeId?: number | null;
  enabled?: number;
  pageNum?: number;
  pageSize?: number;
}

/** 按周批量配置 BO */
export interface GzBeanTimeSlotBatchByWeekForm {
  storeId: number;
  weekdays: string;
  effectiveDate?: string | null;
  expireDate?: string | null;
  slots: Array<{
    slotName?: string | null;
    startTime: string;
    endTime: string;
  }>;
}

export function listGzBeanSlot(query: GzBeanTimeSlotTemplateQuery): AxiosPromise<{ total: number; rows: GzBeanTimeSlotTemplateVO[] }> {
  return request({ url: '/system/gz/bean/slot/list', method: 'get', params: query });
}

export function listGzBeanSlotByStore(storeId: number | string): AxiosPromise<GzBeanTimeSlotTemplateVO[]> {
  return request({ url: `/system/gz/bean/slot/listByStore/${storeId}`, method: 'get' });
}

export function getGzBeanSlot(id: number | string): AxiosPromise<GzBeanTimeSlotTemplateVO> {
  return request({ url: `/system/gz/bean/slot/${id}`, method: 'get' });
}

export function addGzBeanSlot(data: GzBeanTimeSlotTemplateForm) {
  return request({ url: '/system/gz/bean/slot', method: 'post', data });
}

export function updateGzBeanSlot(data: GzBeanTimeSlotTemplateForm) {
  return request({ url: '/system/gz/bean/slot', method: 'put', data });
}

export function delGzBeanSlot(ids: Array<number | string> | number | string) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({ url: `/system/gz/bean/slot/${idStr}`, method: 'delete' });
}

export function batchByWeekGzBeanSlot(data: GzBeanTimeSlotBatchByWeekForm) {
  return request({ url: '/system/gz/bean/slot/batchByWeek', method: 'post', data });
}
