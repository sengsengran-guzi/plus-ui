/**
 * GZ-BEAN-008 拼豆预约管理 API（admin 端）
 *
 * 后端路径：/system/gz/bean/booking/*
 * 权限：gz:bean:booking:list / query / verify
 *
 * 字段权威：doc/11 §3.4 gz_bean_booking
 * 状态字典：gz_bean_booking_status（V202606020030 DDL）— useDict('gz_bean_booking_status')
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 预约 VO（与 GzBeanBookingVO.java 对齐；id 类全部 string 防 JS 精度丢失） */
export interface GzBeanBookingVO {
  /** 主键（string 化） */
  id: string;
  /** 业务码 BK-yyyyMMdd-6位序号 */
  bookingNo: string;
  /** 用户 id（string 化） */
  userId: string;
  /** 门店 id（string 化） */
  storeId: string;
  /** 座位 id（string 化） */
  seatId: string;
  /** 具体座位号 snapshot（ADR-0015 影院选座，下单时锁定的座位编号） */
  seatNoSnapshot: string;
  /** 桌型名 snapshot（config.name；列表/详情与座位号并列展示） */
  seatTypeSnapshot?: string | null;
  /** 桌型档 id（string 化；核销分座弹窗按它筛同桌型空闲座，ADR-0016） */
  seatTypeConfigId?: string | null;
  /** 预约日期 yyyy-MM-dd */
  sessDate: string;
  /** 时段开始 HH:mm:ss */
  slotStart: string;
  /** 时段结束 HH:mm:ss */
  slotEnd: string;
  /** 手机号 snapshot */
  mobileSnapshot?: string;
  /** 业务状态 pending / used / cancelled / no_show（内部，核销/取消逻辑用） */
  status: string;
  /** 支付状态 unpaid / paying / paid / pay_closed / refunded（内部） */
  payStatus?: string;
  /** 单一综合状态（后端派生，dict gz_bean_booking_status 翻译）：paid/used/cancelled/refunded/no_show/unpaid/closed */
  bizStatus?: string;
  /** 核销时间 */
  verifyTime?: string | null;
  /** 核销操作人 */
  verifiedBy?: string | null;
  /** 取消时间 */
  cancelledTime?: string | null;
  /** 过期标记时间 */
  noShowTime?: string | null;
  /** 创建时间 */
  createTime?: string;
  /** 备注 */
  remark?: string | null;
  /** 门店名（service enrich） */
  storeName?: string;
  /** 门店地址（service enrich） */
  storeAddress?: string;
}

/** 查询参数（与 GzBeanBookingQueryBo.java 对齐） */
export interface GzBeanBookingQuery {
  /** 门店 id（owner 可选筛选；staff 后端强制忽略） */
  storeId?: number | string;
  /** 预约日期起 yyyy-MM-dd */
  sessDateFrom?: string;
  /** 预约日期止 yyyy-MM-dd */
  sessDateTo?: string;
  /** 综合状态多选（bizStatus：paid/used/cancelled/refunded/no_show/unpaid/closed；空=默认只看真实订单） */
  bizStatusList?: string[];
  /** 业务码模糊 */
  bookingNo?: string;
  /** 手机号模糊 */
  mobile?: string;
  pageNum?: number;
  pageSize?: number;
}

/** GET /system/gz/bean/booking/list — 分页查询预约（owner 全量 / staff 仅本店） */
export function listGzBeanBooking(query: GzBeanBookingQuery): AxiosPromise<{ total: number; rows: GzBeanBookingVO[] }> {
  return request({
    url: '/system/gz/bean/booking/list',
    method: 'get',
    params: query
  });
}

/** GET /system/gz/bean/booking/{id} — 预约详情 */
export function getGzBeanBooking(id: number | string): AxiosPromise<GzBeanBookingVO> {
  return request({
    url: `/system/gz/bean/booking/${id}`,
    method: 'get'
  });
}

/**
 * POST /system/gz/bean/booking/{id}/verify?seatId= — 核销 + 现场分座（ADR-0016 §3）。
 * ADR-0016 后核销必须带座位（无座 → 后端 SEAT_REQUIRED「先选座」），预约管理页核销走此接口。
 */
export function verifyGzBeanBookingWithSeat(id: number | string, seatId: number | string): AxiosPromise<GzBeanBookingVO> {
  return request({
    url: `/system/gz/bean/booking/${id}/verify`,
    method: 'post',
    params: { seatId }
  });
}

/** POST /system/gz/bean/booking/verify-scan — 扫码核销（解析 payload + 校签 + pending → used） */
export function verifyGzBeanBookingByScan(qrPayload: string): AxiosPromise<GzBeanBookingVO> {
  return request({
    url: '/system/gz/bean/booking/verify-scan',
    method: 'post',
    data: { qrPayload }
  });
}

/** 代客预定参数（GZ-BEAN-039 / kevin-test §4；与 GzBeanAdminCreateBo.java 对齐） */
export interface GzBeanAdminCreateBody {
  storeId: number | string;
  seatTypeConfigId: number | string;
  /** 店员代分配的具体座位 id */
  seatId: number | string;
  sessDate: string;
  /** 区间起 HH:mm:ss */
  slotStart: string;
  /** 区间止 HH:mm:ss */
  slotEnd: string;
  /** 顾客手机号（选填，命中既有用户则关联，否则线下散客占位） */
  mobile?: string;
  /** 顾客姓名/备注（选填） */
  customerName?: string;
  /** 线下收款金额（分，选填；默认按区间逐格求和计价，入参覆盖） */
  amountCent?: number;
}

/**
 * POST /system/gz/bean/booking/admin-create — 代客预定（GZ-BEAN-039 / kevin-test §4）
 * 现场没带手机的用户，店员代为选具体座位锁座，一步 used + 线下已付。仍走逐格配额防超卖 + 座位区间互斥。
 */
export function adminCreateGzBeanBooking(data: GzBeanAdminCreateBody): AxiosPromise<GzBeanBookingVO> {
  return request({
    url: '/system/gz/bean/booking/admin-create',
    method: 'post',
    data
  });
}
