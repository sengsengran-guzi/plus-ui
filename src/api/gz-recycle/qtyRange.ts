/**
 * GZ-RECYCLE-004 回收数量桶 + 预计回收时长 API（admin 端，契约 15a §C.5）。
 *
 * 后端路径：/system/gz/recycle/qtyRange/*
 * 权限：gz:recycle:qtyRange:list / add / edit / remove
 * 字段权威：契约 15a §C.5 gz_recycle_qty_range（业务表，非 sys_dict）/ GzRecycleQtyRangeVO.java、GzRecycleQtyRangeBo.java。
 * ID 跨层契约 #1：所有 id 字段 string。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 回收数量桶 VO（与 GzRecycleQtyRangeVO.java 对齐；id 为 string） */
export interface GzRecycleQtyRangeVO {
  id: string;
  /** 桶机读码（mp 提交落 qtyBucketCode） */
  code: string;
  /** 桶展示文案（如 1-25 件） */
  label: string;
  /** 该桶预计回收时长（分钟） */
  durationMinutes: number;
  /** 0=停用 / 1=启用 */
  enabled: number;
  /** 展示排序（小在前） */
  sortNo: number;
  createTime?: string;
  updateTime?: string;
  remark?: string | null;
}

/** 新增 / 编辑 BO（与 GzRecycleQtyRangeBo.java 对齐） */
export interface GzRecycleQtyRangeForm {
  id?: string | null;
  code?: string;
  label?: string;
  durationMinutes?: number | null;
  enabled?: number | null;
  sortNo?: number | null;
  remark?: string | null;
}

/** 列表查询参数（与 GzRecycleQtyRangeQueryBo.java 对齐） */
export interface GzRecycleQtyRangeQuery {
  code?: string;
  enabled?: number | null;
  pageNum?: number;
  pageSize?: number;
}

/** GET 列表（分页） */
export function listGzRecycleQtyRange(query: GzRecycleQtyRangeQuery): AxiosPromise<GzRecycleQtyRangeVO[]> {
  return request({ url: '/system/gz/recycle/qtyRange/list', method: 'get', params: query });
}

/** GET 详情 */
export function getGzRecycleQtyRange(id: string): AxiosPromise<GzRecycleQtyRangeVO> {
  return request({ url: `/system/gz/recycle/qtyRange/${id}`, method: 'get' });
}

/** POST 新增（code 同租户唯一校验） */
export function addGzRecycleQtyRange(data: GzRecycleQtyRangeForm) {
  return request({ url: '/system/gz/recycle/qtyRange', method: 'post', data });
}

/** PUT 编辑（code 唯一校验排除自身） */
export function updateGzRecycleQtyRange(data: GzRecycleQtyRangeForm) {
  return request({ url: '/system/gz/recycle/qtyRange', method: 'put', data });
}

/** DELETE 软删 */
export function delGzRecycleQtyRange(ids: Array<string> | string) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({ url: `/system/gz/recycle/qtyRange/${idStr}`, method: 'delete' });
}

/** POST 启用 / 停用切换 */
export function toggleGzRecycleQtyRange(id: string, enabled: number) {
  return request({ url: `/system/gz/recycle/qtyRange/toggle/${id}`, method: 'post', params: { enabled } });
}
