/**
 * GZ-BEAN-025 拼豆前 N 名免费促销配置 API（admin 端，ADR-0015 §4）。
 *
 * 后端路径：/system/gz/bean/free-promo/*
 * 权限：gz:bean:promo:list / query / add / edit / remove
 *
 * 模型背景：每门店一行配置，周期（day/week/days）+ 名额 N + 促销起止 + 总开关。
 * 字段权威：doc/11 §3.11 gz_bean_free_promo。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 促销配置 VO（与 GzBeanFreePromoVO.java 对齐） */
export interface GzBeanFreePromoVO {
  /** 主键 */
  id: number | string;
  /** FK → gz_bean_store.id */
  storeId: number | string;
  /** 门店名（service enrich） */
  storeName?: string;
  /** 周期类型 day / week / days */
  periodType: string;
  /** days 滚动周期天数 N */
  periodDays?: number | null;
  /** days 滚动周期锚点起算日 yyyy-MM-dd */
  anchorDate?: string | null;
  /** 每周期免费名额 N */
  freeCount: number;
  /** 促销窗口起 yyyy-MM-dd */
  startDate?: string | null;
  /** 促销窗口止 yyyy-MM-dd */
  endDate?: string | null;
  /** 总开关 0=关 / 1=开 */
  enabled: number;
  /** 创建时间 */
  createTime?: string;
  /** 备注 */
  remark?: string | null;
}

/** 新增 / 编辑 BO（与 GzBeanFreePromoBo.java 对齐；编辑禁改 storeId，service 忽略） */
export interface GzBeanFreePromoForm {
  id?: number | string | null;
  storeId?: number | string | null;
  periodType?: string;
  periodDays?: number | null;
  anchorDate?: string | null;
  freeCount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  enabled?: number;
  remark?: string | null;
}

/** GET /system/gz/bean/free-promo/list — 分页查询促销配置 */
export function listGzBeanFreePromo(query: { pageNum?: number; pageSize?: number }): AxiosPromise<{ total: number; rows: GzBeanFreePromoVO[] }> {
  return request({
    url: '/system/gz/bean/free-promo/list',
    method: 'get',
    params: query
  });
}

/** GET /system/gz/bean/free-promo/{id} — 促销配置详情 */
export function getGzBeanFreePromo(id: number | string): AxiosPromise<GzBeanFreePromoVO> {
  return request({
    url: `/system/gz/bean/free-promo/${id}`,
    method: 'get'
  });
}

/** GET /system/gz/bean/free-promo/by-store/{storeId} — 按门店查（每门店一行，无配置返回 null data） */
export function getGzBeanFreePromoByStore(storeId: number | string): AxiosPromise<GzBeanFreePromoVO> {
  return request({
    url: `/system/gz/bean/free-promo/by-store/${storeId}`,
    method: 'get'
  });
}

/** POST /system/gz/bean/free-promo — 新增促销配置（每门店一行，store_id 已存在则后端拒绝） */
export function addGzBeanFreePromo(data: GzBeanFreePromoForm) {
  return request({
    url: '/system/gz/bean/free-promo',
    method: 'post',
    data
  });
}

/** PUT /system/gz/bean/free-promo — 编辑促销配置（storeId 不可改，service 忽略） */
export function updateGzBeanFreePromo(data: GzBeanFreePromoForm) {
  return request({
    url: '/system/gz/bean/free-promo',
    method: 'put',
    data
  });
}

/** DELETE /system/gz/bean/free-promo/{ids} — 软删（id 集合） */
export function delGzBeanFreePromo(ids: Array<number | string> | number | string) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({
    url: `/system/gz/bean/free-promo/${idStr}`,
    method: 'delete'
  });
}
