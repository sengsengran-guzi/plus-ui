/**
 * GZ-BEAN-013 拼豆座位类型配额配置 API（admin 端）
 *
 * 后端路径：/system/gz/bean/seatTypeConfig/*
 * 权限：gz:bean:seatTypeConfig:list / add / edit / remove
 * 模型背景：ADR-0008（座位由具体座位 A1-A10 改为「座位类型配额」，admin 配每类型数量 + 单价）
 * 字段权威：doc/11 §3.4 gz_bean_seat_type_config
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 座位类型配额 VO（与 GzBeanSeatTypeConfigVO.java 对齐） */
export interface GzBeanSeatTypeConfigVO {
  /** 主键 */
  id: number;
  /** 门店 id */
  storeId: number;
  /** 座位类型字典值（single / double / quad；中文名前端 dict-tag(gz_bean_seat_type) 翻译，后端不回填） */
  seatType: string;
  /** 数量（配额上限 = 余量基础） */
  quantity: number;
  /** 单价（分） */
  priceCent: number;
  /** 单价（元，后端 priceCent/100 算） */
  priceYuan: number | string;
  /** 0=停用 / 1=启用 */
  enabled: number;
  /** 排序值 */
  sortNo: number;
  /** 创建时间 */
  createTime?: string;
  /** 备注 */
  remark?: string | null;
}

/** 新增 / 编辑 BO（与 GzBeanSeatTypeConfigBo.java 对齐） */
export interface GzBeanSeatTypeConfigForm {
  id?: number | null;
  storeId?: number | null;
  seatType?: string;
  quantity?: number | null;
  priceCent?: number | null;
  enabled?: number;
  sortNo?: number;
  remark?: string | null;
}

/** 查询参数（与 GzBeanSeatTypeConfigQueryBo.java 对齐） */
export interface GzBeanSeatTypeConfigQuery {
  storeId?: number | null;
  seatType?: string;
  enabled?: number;
  pageNum?: number;
  pageSize?: number;
}

/** GET /system/gz/bean/seatTypeConfig/list — 分页查询 */
export function listGzBeanSeatTypeConfig(
  query: GzBeanSeatTypeConfigQuery
): AxiosPromise<{ total: number; rows: GzBeanSeatTypeConfigVO[] }> {
  return request({
    url: '/system/gz/bean/seatTypeConfig/list',
    method: 'get',
    params: query
  });
}

/** GET /system/gz/bean/seatTypeConfig/listByStore/{storeId} — 按门店全量（admin 配置页主用，不分页） */
export function listGzBeanSeatTypeConfigByStore(storeId: number): AxiosPromise<GzBeanSeatTypeConfigVO[]> {
  return request({
    url: `/system/gz/bean/seatTypeConfig/listByStore/${storeId}`,
    method: 'get'
  });
}

/** GET /system/gz/bean/seatTypeConfig/{id} — 详情 */
export function getGzBeanSeatTypeConfig(id: number | string): AxiosPromise<GzBeanSeatTypeConfigVO> {
  return request({
    url: `/system/gz/bean/seatTypeConfig/${id}`,
    method: 'get'
  });
}

/** POST /system/gz/bean/seatTypeConfig — 新增类型配额 */
export function addGzBeanSeatTypeConfig(data: GzBeanSeatTypeConfigForm) {
  return request({
    url: '/system/gz/bean/seatTypeConfig',
    method: 'post',
    data
  });
}

/** PUT /system/gz/bean/seatTypeConfig — 编辑类型配额 */
export function updateGzBeanSeatTypeConfig(data: GzBeanSeatTypeConfigForm) {
  return request({
    url: '/system/gz/bean/seatTypeConfig',
    method: 'put',
    data
  });
}

/** PUT /system/gz/bean/seatTypeConfig/{id}/enabled/{enabled} — 切换启用状态（属编辑权限） */
export function toggleGzBeanSeatTypeConfigEnabled(id: number, enabled: number) {
  return request({
    url: `/system/gz/bean/seatTypeConfig/${id}/enabled/${enabled}`,
    method: 'put'
  });
}

/** DELETE /system/gz/bean/seatTypeConfig/{ids} — 软删（id 集合） */
export function delGzBeanSeatTypeConfig(ids: Array<number | string> | number | string) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({
    url: `/system/gz/bean/seatTypeConfig/${idStr}`,
    method: 'delete'
  });
}
