/**
 * GZ-COUPON-001 用户券（发放记录）+ 发放页用户检索 API（admin 端）
 *
 * 后端路径：/system/gz/coupon/userCoupon/*
 * 权限：gz:coupon:userCoupon:list / gz:coupon:user:search
 * 字段权威：doc/11 §11.2 gz_user_coupon
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 用户券 VO（与 GzUserCouponVO.java 对齐；id 字段全 string） */
export interface GzUserCouponVO {
  id: string;
  couponNo: string;
  templateId: string;
  templateName?: string;
  userId: string;
  userNickname?: string;
  userMobile?: string;
  amountSnapshotCent: number;
  /** unused / locked / used / expired（字典 gz_coupon_status） */
  status: string;
  gainedTime?: string;
  expireTime?: string;
  usedTime?: string | null;
  relatedPayOutTradeNo?: string | null;
  createTime?: string;
}

/** 发放记录查询参数 */
export interface GzUserCouponQuery {
  templateId?: string | null;
  userId?: string | null;
  status?: string;
  couponNo?: string;
  pageNum?: number;
  pageSize?: number;
}

/** 发放页选用户 VO（复用 gz_user admin 列表，仅取展示字段） */
export interface GzCouponUserOptionVO {
  id: string;
  userNo: string;
  nickname?: string;
  mobile?: string;
  openid?: string;
}

/** 发放页选用户查询参数（透传 gz_user admin 列表查询） */
export interface GzCouponUserOptionQuery {
  nickname?: string;
  mobile?: string;
  openid?: string;
  pageNum?: number;
  pageSize?: number;
}

/** GET 发放记录列表（分页） */
export function listGzUserCoupon(
  query: GzUserCouponQuery
): AxiosPromise<{ total: number; rows: GzUserCouponVO[] }> {
  return request({ url: '/system/gz/coupon/userCoupon/list', method: 'get', params: query });
}

/** GET 发放页选用户检索（复用 gz_user 列表分页） */
export function listGzCouponUserOptions(
  query: GzCouponUserOptionQuery
): AxiosPromise<{ total: number; rows: GzCouponUserOptionVO[] }> {
  return request({ url: '/system/gz/coupon/userCoupon/userOptions', method: 'get', params: query });
}

/** 撤回作废结果（unused→revoked） */
export interface GzUserCouponRevokeResult {
  /** 实际作废数 */
  revoked: number;
  /** 跳过数（非 unused 的 locked/used/expired/已作废） */
  skipped: number;
}

/** PUT 发错撤回：批量作废未使用券（unused→revoked，仅 owner 权限 gz:coupon:userCoupon:revoke） */
export function revokeGzUserCoupon(ids: Array<string> | string): AxiosPromise<GzUserCouponRevokeResult> {
  const idStr = Array.isArray(ids) ? ids.join(',') : ids;
  return request({ url: `/system/gz/coupon/userCoupon/revoke/${idStr}`, method: 'put' });
}
