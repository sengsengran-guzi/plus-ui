/**
 * GZ-COUPON-001 优惠券模板 + 批量发放 API（admin 端）
 *
 * 后端路径：/system/gz/coupon/template/*
 * 权限：gz:coupon:template:list / add / edit / remove + gz:coupon:issue
 * 字段权威：doc/11 §11.1 gz_coupon_template；发放策略 SPI §11.1.a
 * ID 跨层契约 #1：所有 id 字段 string。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 券模板 VO（与 GzCouponTemplateVO.java 对齐；id 为 string） */
export interface GzCouponTemplateVO {
  id: string;
  /** 业务码 CPN-yyyyMMdd-6位序号 */
  templateNo: string;
  name: string;
  /** cash / full_reduce / percent（字典 gz_coupon_discount_type，V1.2 仅 cash） */
  discountType: string;
  /** 面额（分） */
  amountCent: number;
  /** pindou（字典 gz_business_type，V1.2 仅 pindou） */
  applicableBusiness: string;
  validDays: number;
  /** 总配额（null=不限） */
  totalQuota: number | null;
  issuedCount: number;
  /** manual / filtered / event（字典 gz_coupon_issue_strategy） */
  issueStrategy: string;
  /** filtered 策略的条件配置 JSON：{"conditions":[...]}（ADR-0010） */
  issueConfigJson?: string | null;
  /** active / paused / archived（字典 gz_coupon_template_status） */
  status: string;
  version: number;
  createTime?: string;
  updateTime?: string;
  remark?: string | null;
}

/** 新增 / 编辑 BO（与 GzCouponTemplateBo.java 对齐；amountCent 为分，UI 元↔分换算） */
export interface GzCouponTemplateForm {
  id?: string | null;
  name?: string;
  discountType?: string;
  amountCent?: number | null;
  applicableBusiness?: string;
  validDays?: number | null;
  totalQuota?: number | null;
  issueStrategy?: string;
  issueConfigJson?: string | null;
  remark?: string | null;
}

/** 列表查询参数 */
export interface GzCouponTemplateQuery {
  name?: string;
  status?: string;
  issueStrategy?: string;
  discountType?: string;
  pageNum?: number;
  pageSize?: number;
}

/** 批量发放请求（manual 传名单；filtered 仅传 templateId，audience 由后端按 issue_config_json 解析） */
export interface GzCouponIssueForm {
  templateId: string;
  userIds?: Array<string>;
  userKeyword?: string;
}

/** 条件筛选单条件（ADR-0010；type=register_time/did_pindou/phone_bound） */
export interface CouponAudienceCondition {
  type: string;
  /** register_time：注册时间下界 yyyy-MM-dd */
  start?: string;
  /** register_time：注册时间上界 yyyy-MM-dd */
  end?: string;
  /** did_pindou：true=仅已核销 */
  completedOnly?: boolean;
}

/** 条件筛选配置 / 预览请求体（issue_config_json 结构 + preview-audience 请求） */
export interface CouponAudienceConfig {
  conditions: CouponAudienceCondition[];
}

/** 发放结果 VO */
export interface GzCouponIssueResultVO {
  issuedCount: number;
  requestedUserCount: number;
  templateIssuedCount: number;
  totalQuota: number | null;
  remainingQuota: number | null;
}

/** GET 列表（分页） */
export function listGzCouponTemplate(
  query: GzCouponTemplateQuery
): AxiosPromise<{ total: number; rows: GzCouponTemplateVO[] }> {
  return request({ url: '/system/gz/coupon/template/list', method: 'get', params: query });
}

/** GET 详情 */
export function getGzCouponTemplate(id: string): AxiosPromise<GzCouponTemplateVO> {
  return request({ url: `/system/gz/coupon/template/${id}`, method: 'get' });
}

/** POST 新增 */
export function addGzCouponTemplate(data: GzCouponTemplateForm) {
  return request({ url: '/system/gz/coupon/template', method: 'post', data });
}

/** PUT 编辑 */
export function updateGzCouponTemplate(data: GzCouponTemplateForm) {
  return request({ url: '/system/gz/coupon/template', method: 'put', data });
}

/** DELETE 软删 */
export function delGzCouponTemplate(ids: Array<string> | string) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({ url: `/system/gz/coupon/template/${idStr}`, method: 'delete' });
}

/** POST 暂停（active → paused） */
export function pauseGzCouponTemplate(id: string) {
  return request({ url: `/system/gz/coupon/template/pause/${id}`, method: 'post' });
}

/** POST 启用（paused → active） */
export function activateGzCouponTemplate(id: string) {
  return request({ url: `/system/gz/coupon/template/activate/${id}`, method: 'post' });
}

/** POST 归档（active/paused → archived） */
export function archiveGzCouponTemplate(id: string) {
  return request({ url: `/system/gz/coupon/template/archive/${id}`, method: 'post' });
}

/** POST 批量发放（manual 选名单 / filtered 条件筛选，乐观锁防超发） */
export function issueGzCoupon(data: GzCouponIssueForm): AxiosPromise<GzCouponIssueResultVO> {
  return request({ url: '/system/gz/coupon/template/issue', method: 'post', data });
}

/** POST 条件筛选「预览命中人数」（ADR-0010；配置/发放前校验，预览口径=实发口径） */
export function previewGzCouponAudience(data: CouponAudienceConfig): AxiosPromise<number> {
  return request({ url: '/system/gz/coupon/template/preview-audience', method: 'post', data });
}
