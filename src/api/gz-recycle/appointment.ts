/**
 * GZ-RECYCLE-003 回收预约单 API（admin 端）
 *
 * 后端路径：/system/gz/recycle/appointment/*
 * 权限：gz:recycle:appointment:list（列表/详情）/ gz:recycle:appointment:payout（失败重试）
 * 字段权威：doc/11 §12.2 gz_recycle_appointment。
 * ID 跨层契约 #1：所有 id 字段 string；金额 _cent（展示 / 100）。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 回收物品行项（product_snapshot_json 反序列化） */
export interface RecycleProductLineVO {
  category: string;
  qty: number;
  remark?: string | null;
}

/** 回收预约单 admin 完整 VO（两套照片 + 核对留痕 + 快照，doc/11 §12.2） */
export interface GzRecycleAppointmentVO {
  id: string;
  appointmentNo: string;
  userId: string;
  storeId: string;
  products: RecycleProductLineVO[];
  totalQty: number;
  matchedDurationMinutes: number;
  /** 自动估价金额（分） */
  estimatedAmountCent: number;
  apptDate: string;
  slotStart: string;
  slotEnd: string;
  /** 用户提交实物照 file id 列表（string） */
  submitImageIds: string[];
  /** 店员核对存证照 file id 列表（submitted 时空） */
  verifyImageIds: string[];
  /** 店员核对最终金额（分）；submitted 时 null */
  finalAmountCent?: number | null;
  /** 核对店员 admin 用户名（留痕） */
  verifiedBy?: string | null;
  /** 核对时间（留痕） */
  verifyTime?: string | null;
  mobileSnapshot?: string | null;
  wechatIdSnapshot?: string | null;
  /** 关联反向打款单号 */
  outPayoutNo?: string | null;
  /** submitted / confirmed_onsite / paying / paid / cancelled / no_show / payout_failed（gz_recycle_status 字典） */
  status: string;
  createTime?: string;
  remark?: string | null;
}

/** 回收预约单查询条件 */
export interface GzRecycleAppointmentQuery {
  pageNum?: number;
  pageSize?: number;
  storeId?: string | number;
  status?: string;
  appointmentNo?: string;
  apptDateStart?: string;
  apptDateEnd?: string;
}

/** 分页列表 */
export function listAppointment(query: GzRecycleAppointmentQuery): AxiosPromise<GzRecycleAppointmentVO[]> {
  return request({ url: '/system/gz/recycle/appointment/list', method: 'get', params: query });
}

/** 详情 */
export function getAppointment(id: string): AxiosPromise<GzRecycleAppointmentVO> {
  return request({ url: `/system/gz/recycle/appointment/${id}`, method: 'get' });
}

/** 打款失败重试（owner，仅 payout_failed 单） */
export function retryAppointmentPayout(id: string): AxiosPromise<GzRecycleAppointmentVO> {
  return request({ url: `/system/gz/recycle/appointment/${id}/retry-payout`, method: 'post' });
}
