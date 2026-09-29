/**
 * 拼豆营业额 API（admin 端；周/月/季度/日整合 + 桌型×计费方式拆分，只统计拼豆）。
 *
 * 后端路径：/system/gz/bean/revenue/{aggregate,detail}
 * 权限：gz:bean:revenue:list（owner + staff）。
 *
 * 数据源 = gz_bean_booking（非 gz_pay_transaction）：现金代客单不落支付流水，只查流水会漏现金。
 * 口径 pay_status='paid' AND is_free=0，按 sess_date 汇总（与对账中心 paid_time 分成口径有意分开）。
 * 金额一律「分」（cent），前端 /100 显示元。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 时间粒度 */
export type RevenueGranularity = 'day' | 'week' | 'month' | 'quarter';

/** 区间总汇总（现金/线上拆分） */
export interface GzBeanRevenueSummary {
  totalCent: number;
  orderCount: number;
  cashCent: number;
  cashCount: number;
  onlineCent: number;
  onlineCount: number;
}

/** 类目维度（桌型 × 计费方式）字典行 */
export interface GzBeanRevenueCategoryDim {
  /** 类目 key = `${seatType}|${isDayPass}`（cell 对齐用） */
  key: string;
  /** 座位类型 code（single/double/quad/自定义 st<id>/unknown） */
  seatType: string;
  /** 计费方式：0=计时 / 1=包天 */
  isDayPass: number;
  /** 桌型中文名快照（自定义桌型标签兜底；single/double/quad 前端 i18n 覆盖） */
  typeName?: string | null;
}

/** 某时间桶内某类目的金额/单数（矩形单元格） */
export interface GzBeanRevenueCategoryCell {
  catKey: string;
  amountCent: number;
  orderCount: number;
}

/** 一个时间桶（趋势图 X 轴一格） */
export interface GzBeanRevenuePeriodBucket {
  /** 桶键：2026-06 / 2026-W23 / 2026-Q2 / 2026-06-15 */
  key: string;
  /** 展示标签 */
  label: string;
  totalCent: number;
  orderCount: number;
  /** 各类目单元格（与 categories 同序、同长，零填充） */
  cells: GzBeanRevenueCategoryCell[];
}

/** 区间级某类目合计行（6 类拆分表一格） */
export interface GzBeanRevenueCategoryTotal {
  key: string;
  seatType: string;
  isDayPass: number;
  typeName?: string | null;
  totalCent: number;
  orderCount: number;
}

/** 营业额聚合 VO（与 GzBeanRevenueAggregateVO.java 对齐） */
export interface GzBeanRevenueAggregateVO {
  /** 门店 id（string；null = 全部门店） */
  storeId?: string | null;
  /** 门店名（storeId 为空时为「全部门店」） */
  storeName?: string | null;
  granularity: RevenueGranularity;
  startDate: string;
  endDate: string;
  summary: GzBeanRevenueSummary;
  categories: GzBeanRevenueCategoryDim[];
  periods: GzBeanRevenuePeriodBucket[];
  byCategory: GzBeanRevenueCategoryTotal[];
}

/** 明细行 VO（与 GzBeanRevenueDetailVO.java 对齐；id 全 string） */
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

/** 聚合查询参数 */
export interface GzBeanRevenueAggregateQuery {
  granularity: RevenueGranularity;
  /** 区间起 yyyy-MM-dd（必填） */
  startDate: string;
  /** 区间止 yyyy-MM-dd（必填） */
  endDate: string;
  /** 门店 id（可选；空 = 全部门店） */
  storeId?: number | string | null;
}

/** 明细查询参数（区间下钻） */
export interface GzBeanRevenueDetailQuery {
  /** 门店 id（可选） */
  storeId?: number | string | null;
  /** 区间起 yyyy-MM-dd（与 date 二选一，优先区间） */
  startDate?: string | null;
  /** 区间止 yyyy-MM-dd */
  endDate?: string | null;
  /** 单日 yyyy-MM-dd（区间未给时回退） */
  date?: string | null;
  /** 支付方式筛选 cash / online / 空=全部 */
  payMethod?: 'cash' | 'online' | '' | null;
  /** 桌型筛选 seat_type code（single/double/quad/st<id>/unknown）；空=全部桌型 */
  seatType?: string | null;
  pageNum?: number;
  pageSize?: number;
}

/** GET /system/gz/bean/revenue/aggregate — 营业额区间聚合（汇总 + 类目 + 趋势 + 每类合计） */
export function getGzBeanRevenueAggregate(query: GzBeanRevenueAggregateQuery): AxiosPromise<GzBeanRevenueAggregateVO> {
  return request({
    url: '/system/gz/bean/revenue/aggregate',
    method: 'get',
    params: query
  });
}

/**
 * 「桌型使用时长 · 上桌率」月度报表行（与 GzBeanSeatUsageVO.java 对齐，GZ-BEAN-059）。
 *
 * 甲方要的是「每个月每种桌型坐了多少小时」（用于店内调整）：**不看金额**（店员没填现金，金额不可靠），
 * 时长完全由已成交单的时段推出。量纲统一为「单位·小时」（整桌=桌 / 按座=座）。
 */
export interface GzBeanSeatUsageVO {
  storeId: string;
  storeName?: string | null;
  /** yyyy-MM */
  month: string;
  seatTypeConfigId: string;
  seatType?: string | null;
  name: string;
  /** whole=整桌 / seat=按座（决定单位显示「桌」还是「座」） */
  bookMode?: string | null;
  /** 每格容量（= 单位数） */
  capacityPerSlot: number;
  /** 【主指标】已上桌时长（单位·小时）= 已上桌单覆盖的营业格数 */
  usedHours: number;
  /** 其中**小程序**来的时长（source='mp'） */
  mpHours: number;
  /** 其中**线下**来的时长（看板现金入座 walk_in + 后台代客 admin） */
  offlineHours: number;
  /** 其中线下的**单数**（现金入座常常没录金额，靠单数对账） */
  offlineBookings: number;
  /** 可售时长（单位·小时）= Σ 营业格有效容量（扣长期关闭 + 当日关闭）—— 上桌率分母 */
  sellableHours: number;
  /** 营业时长（单位·小时）= 营业格数 × 容量（不扣关闭）—— 营业占用率分母 */
  openHours: number;
  /** 【甲方要的第二个数】平均每个座位（整桌桌型 = 每张桌）时长 = usedHours / capacityPerSlot；容量 0 → null */
  avgHoursPerUnit: number | null;
  /** usedHours / sellableHours；分母 0 → null（显示「—」） */
  occupancyRate: number | null;
  /** usedHours / openHours；分母 0 → null */
  openOccupancyRate: number | null;
  bookings: number;
  seatedBookings: number;
  noShowBookings: number;
  cancelledBookings: number;
  dayPassBookings: number;
}

/** GET /system/gz/bean/revenue/seat-usage — 桌型使用时长 · 上桌率（按月 × 桌型） */
export function getGzBeanSeatUsage(query: {
  startDate: string;
  endDate: string;
  storeId?: number | string | null;
}): AxiosPromise<GzBeanSeatUsageVO[]> {
  return request({
    url: '/system/gz/bean/revenue/seat-usage',
    method: 'get',
    params: query
  });
}

/** GET /system/gz/bean/revenue/detail — 营业额明细分页（区间下钻） */
export function listGzBeanRevenueDetail(query: GzBeanRevenueDetailQuery): AxiosPromise<{ total: number; rows: GzBeanRevenueDetailVO[] }> {
  return request({
    url: '/system/gz/bean/revenue/detail',
    method: 'get',
    params: query
  });
}
