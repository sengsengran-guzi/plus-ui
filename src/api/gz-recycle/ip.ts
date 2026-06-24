/**
 * GZ-RECYCLE-004 回收 IP 主数据 API（admin 端，契约 15a §C.4）。
 *
 * 后端路径：/system/gz/recycle/ip/*
 * 权限：gz:recycle:ip:list / add / edit / remove
 * 字段权威：契约 15a §C.1 gz_recycle_ip / GzRecycleIpVO.java、GzRecycleIpBo.java。
 * ID 跨层契约 #1：所有 id 字段 string。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 回收 IP VO（与 GzRecycleIpVO.java 对齐；id 为 string） */
export interface GzRecycleIpVO {
  id: string;
  /** IP / 系列名称（火影 / 海贼王...） */
  ipName: string;
  /** 0=停用 / 1=启用 */
  enabled: number;
  /** 展示排序（小在前） */
  sortNo: number;
  createTime?: string;
  updateTime?: string;
  remark?: string | null;
}

/** 新增 / 编辑 BO（与 GzRecycleIpBo.java 对齐） */
export interface GzRecycleIpForm {
  id?: string | null;
  ipName?: string;
  enabled?: number | null;
  sortNo?: number | null;
  remark?: string | null;
}

/** 列表查询参数（与 GzRecycleIpQueryBo.java 对齐） */
export interface GzRecycleIpQuery {
  ipName?: string;
  enabled?: number | null;
  pageNum?: number;
  pageSize?: number;
}

/** GET 列表（分页） */
export function listGzRecycleIp(query: GzRecycleIpQuery): AxiosPromise<GzRecycleIpVO[]> {
  return request({ url: '/system/gz/recycle/ip/list', method: 'get', params: query });
}

/** GET 详情 */
export function getGzRecycleIp(id: string): AxiosPromise<GzRecycleIpVO> {
  return request({ url: `/system/gz/recycle/ip/${id}`, method: 'get' });
}

/** POST 新增（ipName 同租户唯一校验） */
export function addGzRecycleIp(data: GzRecycleIpForm) {
  return request({ url: '/system/gz/recycle/ip', method: 'post', data });
}

/** PUT 编辑（ipName 唯一校验排除自身） */
export function updateGzRecycleIp(data: GzRecycleIpForm) {
  return request({ url: '/system/gz/recycle/ip', method: 'put', data });
}

/** DELETE 软删 */
export function delGzRecycleIp(ids: Array<string> | string) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({ url: `/system/gz/recycle/ip/${idStr}`, method: 'delete' });
}

/** POST 启用 / 停用切换 */
export function toggleGzRecycleIp(id: string, enabled: number) {
  return request({ url: `/system/gz/recycle/ip/toggle/${id}`, method: 'post', params: { enabled } });
}
