/**
 * 拼豆营业额 API（admin 端，按天，只统计拼豆）。
 *
 * 后端路径：/system/gz/bean/revenue/{daily,detail}
 * 权限：gz:bean:revenue:list（owner + staff）。
 *
 * 数据源 = gz_bean_booking（非 gz_pay_transaction）：现金代客单不落支付流水，只查流水会漏现金。
 * 口径 pay_status='paid' AND is_free=0，按 sess_date 汇总。金额一律「分」（cent），前端 /100 显示元。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 按桌型分组行（营业额降序） */
export interface GzBeanRevenueTypeGroup {
  /** 桌型名（seat_type_snapshot 快照；空时后端兜底「未知桌型」） */
  typeName: string;
  /** 该桌型营业额（分） */
  totalCent: number;
  /** 该桌型有效单数 */
  orderCount: number;
}

/** 单日营业额汇总 VO（与 GzBeanRevenueVO.java 对齐） */
export interface GzBeanRevenueVO {
  /** 门店 id（string；null = 全部门店） */
  storeId?: string | null;
  /** 门店名（storeId 为空时为「全部门店」） */
  storeName?: string | null;
  /** 查询日期 yyyy-MM-dd */
  date: string;
  /** 营业额总额（分） */
  totalCent: number;
  /** 有效单数 */
  orderCount: number;
  /** 现金（线下代客）营业额（分） */
  cashCent: number;
  /** 现金单数 */
  cashCount: number;
  /** 线上（微信支付）营业额（分） */
  onlineCent: number;
  /** 线上单数 */
  onlineCount: number;
  /** 按桌型分组 */
  byType: GzBeanRevenueTypeGroup[];
}

/** 营业额明细行 VO（与 GzBeanRevenueDetailVO.java 对齐；id 全 string） */
export interface GzBeanRevenueDetailVO {
  /** 预约 id（string） */
  id: string;
  /** 业务码 BK-yyyyMMdd-6 位 */
  bookingNo: string;
  /** 门店 id（string） */
  storeId?: string | null;
  /** 门店名 */
  storeName?: string | null;
  /** 桌型快照名 */
  seatTypeSnapshot?: string | null;
  /** 服务日 yyyy-MM-dd */
  sessDate: string;
  /** 时段起 HH:mm */
  slotStart?: string | null;
  /** 时段止 HH:mm */
  slotEnd?: string | null;
  /** 本笔金额（分） */
  amountCent: number;
  /** 支付方式 cash=现金代客 / online=微信支付 */
  payMethod: 'cash' | 'online';
  /** 下单来源 mp / admin（null 视为 mp） */
  source?: string | null;
  /** 是否代客单 */
  walkIn: boolean;
  /** 手机号快照（前端末 4 位打码展示） */
  mobileSnapshot?: string | null;
  /** 核销时间 yyyy-MM-dd HH:mm:ss */
  verifyTime?: string | null;
  /** 下单时间 yyyy-MM-dd HH:mm:ss */
  createTime?: string | null;
}

/** 汇总查询参数 */
export interface GzBeanRevenueSummaryQuery {
  /** 门店 id（可选；空 = 全部门店） */
  storeId?: number | string | null;
  /** 查询日期 yyyy-MM-dd（必填） */
  date: string;
}

/** 明细查询参数 */
export interface GzBeanRevenueDetailQuery {
  /** 门店 id（可选） */
  storeId?: number | string | null;
  /** 查询日期 yyyy-MM-dd（必填） */
  date: string;
  /** 支付方式筛选 cash / online / 空=全部 */
  payMethod?: 'cash' | 'online' | '' | null;
  pageNum?: number;
  pageSize?: number;
}

/** GET /system/gz/bean/revenue/daily — 单日营业额汇总 */
export function getGzBeanRevenueDaily(query: GzBeanRevenueSummaryQuery): AxiosPromise<GzBeanRevenueVO> {
  return request({
    url: '/system/gz/bean/revenue/daily',
    method: 'get',
    params: query
  });
}

/** GET /system/gz/bean/revenue/detail — 单日营业额明细分页 */
export function listGzBeanRevenueDetail(query: GzBeanRevenueDetailQuery): AxiosPromise<{ total: number; rows: GzBeanRevenueDetailVO[] }> {
  return request({
    url: '/system/gz/bean/revenue/detail',
    method: 'get',
    params: query
  });
}
