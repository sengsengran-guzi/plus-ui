/**
 * GZ-RECYCLE-001 回收价目表 API（admin 端）
 *
 * 后端路径：/system/gz/recycle/price-rule/*
 * 权限：gz:recycle:priceRule:list / add / edit / remove / estimate
 * 字段权威：doc/11 §12.1 gz_recycle_price_rule。
 * ID 跨层契约 #1：所有 id 字段 string。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 价目规则 VO（与 GzRecyclePriceRuleVO.java 对齐；id 为 string） */
export interface GzRecyclePriceRuleVO {
  id: string;
  /** 回收品类（字典 gz_recycle_category） */
  category: string;
  /** 数量区间下界（含） */
  qtyMin: number;
  /** 数量区间上界（含；null = 无上界） */
  qtyMax: number | null;
  /** 单价（分），UI 元↔分换算 */
  unitPriceCent: number;
  /** 匹配时长（分钟） */
  durationMinutes: number;
  /** 0=停用 / 1=启用 */
  enabled: number;
  sortNo: number;
  createTime?: string;
  updateTime?: string;
  remark?: string | null;
}

/** 新增 / 编辑 BO（unitPriceCent 为分，UI 元↔分换算；qtyMax 留空=无上界） */
export interface GzRecyclePriceRuleForm {
  id?: string | null;
  category?: string;
  qtyMin?: number | null;
  qtyMax?: number | null;
  unitPriceCent?: number | null;
  durationMinutes?: number | null;
  sortNo?: number | null;
  enabled?: number | null;
  remark?: string | null;
}

/** 列表查询参数 */
export interface GzRecyclePriceRuleQuery {
  category?: string;
  enabled?: number | null;
  pageNum?: number;
  pageSize?: number;
}

/** 估价结果 VO（与 GzRecycleEstimateVO.java 对齐） */
export interface GzRecycleEstimateVO {
  ruleId: string;
  category: string;
  qty: number;
  unitPriceCent: number;
  estimatedAmountCent: number;
  matchedDurationMinutes: number;
}

/** GET 列表（分页） */
export function listGzRecyclePriceRule(query: GzRecyclePriceRuleQuery): AxiosPromise<GzRecyclePriceRuleVO[]> {
  return request({ url: '/system/gz/recycle/price-rule/list', method: 'get', params: query });
}

/** GET 详情 */
export function getGzRecyclePriceRule(id: string): AxiosPromise<GzRecyclePriceRuleVO> {
  return request({ url: `/system/gz/recycle/price-rule/${id}`, method: 'get' });
}

/** POST 新增（区间不重叠校验） */
export function addGzRecyclePriceRule(data: GzRecyclePriceRuleForm) {
  return request({ url: '/system/gz/recycle/price-rule', method: 'post', data });
}

/** PUT 编辑（区间不重叠校验排除自身） */
export function updateGzRecyclePriceRule(data: GzRecyclePriceRuleForm) {
  return request({ url: '/system/gz/recycle/price-rule', method: 'put', data });
}

/** DELETE 软删 */
export function delGzRecyclePriceRule(ids: Array<string> | string) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({ url: `/system/gz/recycle/price-rule/${idStr}`, method: 'delete' });
}

/** POST 启用 / 停用切换 */
export function toggleGzRecyclePriceRule(id: string, enabled: number) {
  return request({ url: `/system/gz/recycle/price-rule/toggle/${id}`, method: 'post', params: { enabled } });
}

/** GET 估价试算（admin 调试 + D14 mp 复用） */
export function estimateGzRecyclePriceRule(category: string, qty: number): AxiosPromise<GzRecycleEstimateVO> {
  return request({ url: '/system/gz/recycle/price-rule/estimate', method: 'get', params: { category, qty } });
}
