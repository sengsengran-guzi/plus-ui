/**
 * GZ-BEAN-002 拼豆座位管理 API（admin 端）
 *
 * 后端路径：/system/gz/bean/seat/*
 * 权限：gz:bean:seat:list / add / edit / remove / batchGenerate
 *
 * 字段权威：doc/11 §3.3 gz_bean_seat
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 座位 VO（与 GzBeanSeatVO.java 对齐） */
export interface GzBeanSeatVO {
  id: number;
  storeId: number;
  seatNo: string;
  rowLabel?: string | null;
  colIndex?: number | null;
  /** 0=停用 / 1=启用 */
  enabled: number;
  sortNo: number;
  createTime?: string;
  remark?: string | null;
}

/** 新增 / 编辑 BO */
export interface GzBeanSeatForm {
  id?: number | null;
  storeId?: number | null;
  seatNo?: string;
  rowLabel?: string | null;
  colIndex?: number | null;
  enabled?: number;
  sortNo?: number;
  remark?: string | null;
}

/** 查询参数 */
export interface GzBeanSeatQuery {
  storeId?: number | null;
  seatNo?: string;
  enabled?: number;
  pageNum?: number;
  pageSize?: number;
}

/** 批量生成 BO */
export interface GzBeanSeatBatchGenerateForm {
  storeId: number;
  prefix?: string | null;
  startIndex: number;
  count: number;
  rowLabel?: string | null;
  startColIndex?: number | null;
}

/** 分页查询 */
export function listGzBeanSeat(query: GzBeanSeatQuery): AxiosPromise<{ total: number; rows: GzBeanSeatVO[] }> {
  return request({ url: '/system/gz/bean/seat/list', method: 'get', params: query });
}

/** 按门店全量列表 */
export function listGzBeanSeatByStore(storeId: number | string): AxiosPromise<GzBeanSeatVO[]> {
  return request({ url: `/system/gz/bean/seat/listByStore/${storeId}`, method: 'get' });
}

/** 详情 */
export function getGzBeanSeat(id: number | string): AxiosPromise<GzBeanSeatVO> {
  return request({ url: `/system/gz/bean/seat/${id}`, method: 'get' });
}

/** 新增 */
export function addGzBeanSeat(data: GzBeanSeatForm) {
  return request({ url: '/system/gz/bean/seat', method: 'post', data });
}

/** 编辑 */
export function updateGzBeanSeat(data: GzBeanSeatForm) {
  return request({ url: '/system/gz/bean/seat', method: 'put', data });
}

/** 软删 */
export function delGzBeanSeat(ids: Array<number | string> | number | string) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({ url: `/system/gz/bean/seat/${idStr}`, method: 'delete' });
}

/** 批量生成 N 个座位 */
export function batchGenerateGzBeanSeat(data: GzBeanSeatBatchGenerateForm) {
  return request({ url: '/system/gz/bean/seat/batchGenerate', method: 'post', data });
}
