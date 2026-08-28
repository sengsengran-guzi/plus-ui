/**
 * GZ-RECYCLE-003 回收预约单 API（admin 端）。
 *
 * 后端路径：/system/gz/recycle/appointment/*
 * 权限：gz:recycle:appointment:list（列表/详情）/ gz:recycle:appointment:payout（失败重试）
 * 字段权威：契约 15a §E.2 GzRecycleAppointmentAdminVO（全量 + 转账段）/ §B.2 GzRecycleProductVO（单对象）。
 * ID 跨层契约 #1：所有 id 字段 string；金额 _cent（展示 / 100）。
 *
 * V1.2 去估价：estimatedAmountCent / totalQty 新单为 null（旧单保留历史值）；product 由数组改单对象。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/**
 * 回收物品对象 VO（product_snapshot_json 反序列化，单份多选对象，契约 15a §B.2）。
 * 兼容旧数组数据：后端 parseProducts 已将旧数组投影为本对象（categories/customIps 去重、qtyBucket* 为 null）。
 */
export interface RecycleProductVO {
  /** 品类多选（字典 gz_recycle_category value） */
  categories?: string[] | null;
  /** 主数据 IP id 快照（string） */
  ipIds?: string[] | null;
  /** IP 中文名快照（admin 免再 join） */
  ipNames?: string[] | null;
  /** 用户自定义 IP 文本 */
  customIps?: string[] | null;
  /** 数量桶 code（旧数据无桶时 null） */
  qtyBucketCode?: string | null;
  /** 数量桶展示文案快照（如 25-50 件；旧数据 null） */
  qtyBucketLabel?: string | null;
}

/**
 * 回收预约单 admin 全量 VO（与 GzRecycleAppointmentAdminVO.java 对齐，契约 15a §E.2）。
 * 含提交段 + 复核段 + 转账段（admin 全字段可见）。
 */
export interface GzRecycleAppointmentVO {
  /* 提交段 */
  id: string;
  appointmentNo: string;
  /** 记录来源 mp（顾客自助）/ manual（店员手动占用，ADR-0021） */
  source?: string | null;
  userId: string;
  storeId: string;
  /** 门店名（join gz_bean_store） */
  storeName?: string | null;
  /** 回收物品对象（单对象；兼容旧数组已由后端投影） */
  product?: RecycleProductVO | null;
  /** 总件数（旧单历史值；新单 null——无精确件数） */
  totalQty?: number | null;
  /** 预计回收时长（分钟，来自命中数量桶；旧单 Σ 历史值） */
  matchedDurationMinutes?: number | null;
  /** 自动估价金额（分，旧单历史值；新单 null——去估价） */
  estimatedAmountCent?: number | null;
  /** 到店档 morning / afternoon（旧单可能 null） */
  arrivalSlot?: string | null;
  apptDate: string;
  slotStart: string;
  slotEnd: string;
  /** 本单占用的到店时段 id（FK gz_recycle_time_slot.id；看板定位格 / 改期弹窗回显，ADR-0021） */
  timeSlotId?: string | null;
  /** 大单额外占用的下一个时段 id（普通单 / 手动占用恒 null，ADR-0021） */
  spillTimeSlotId?: string | null;
  /** 改期次数（ADR-0021 §2） */
  rescheduleCount?: number | null;
  /** 用户提交实物照 file id 列表（string；旧 submitImageIds 已统一改名 imageIds） */
  imageIds?: string[] | null;
  /** submitted / confirmed_onsite / paying / paid / cancelled / no_show / payout_failed（gz_recycle_status 字典） */
  status: string;
  createTime?: string;
  remark?: string | null;

  /* 复核段（全量） */
  /** 店员核对存证照 file id 列表（submitted 时空） */
  verifyImageIds?: string[] | null;
  /** 店员核对最终金额（分）；submitted 时 null */
  finalAmountCent?: number | null;
  /** 核对店员 admin 用户名（留痕） */
  verifiedBy?: string | null;
  /** 核对时间（留痕） */
  verifyTime?: string | null;
  /** 核销备注（GZ-RECYCLE-009，店员核对时填） */
  verifyRemark?: string | null;
  mobileSnapshot?: string | null;
  wechatIdSnapshot?: string | null;

  /* 转账段（全量，拉 gz_pay_payout_transaction） */
  /** 关联反向打款单号 */
  outPayoutNo?: string | null;
  /** 反向打款真实状态 created/processing/success/failed/cancelled（无打款单时 null） */
  payoutStatus?: string | null;
  /** 到账时间（success 时有值） */
  transferredTime?: string | null;
  /** 实际打款金额（分，= payout.amount_cent） */
  payoutAmountCent?: number | null;
  /** 打款失败原因（failed 时有值，admin 可见、顾客不露） */
  failReason?: string | null;
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
  /** 点数档编码（回收看板记录区按点数档筛选，GZ-RECYCLE-008） */
  qtyBucketCode?: string;
  /** 实付金额下限（分，含） */
  finalAmountCentMin?: number;
  /** 实付金额上限（分，含） */
  finalAmountCentMax?: number;
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

/** admin 核销确认 + 触发反向打款（GZ-RECYCLE-009；复用与 mp 店员同一 verifyAndPayout，仅 submitted 单可核销） */
export function verifyAppointment(
  id: string,
  data: { verifyImageIds: number[]; finalAmountCent: number; remark?: string }
): AxiosPromise<GzRecycleAppointmentVO> {
  return request({ url: `/system/gz/recycle/appointment/${id}/verify`, method: 'post', data });
}

/* ===================== GZ-RECYCLE-011 回收看板周视图 + 手动占用 / 改期（ADR-0021） ===================== */

/** 看板行头：一个 1 小时格（GZ-RECYCLE-012 起不再有 id —— 格由起点唯一标识） */
export interface RecycleBoardSlotVO {
  /** 格起点 "HH:mm:ss"，前端用它做行 key */
  startTime: string;
  /** 格止点 = startTime + 1h */
  endTime: string;
  /**
   * 本行是否在当前营业窗口之外（孤儿格）：被存量单 / 改窄窗口留下的占用挡着，但已不可新约。
   * 不显式标出来的话，店员会以为「这行是可用时间但一直约不上」。
   */
  outOfWindow?: boolean | null;
}

/**
 * 看板占用**区间块**（与 GzRecycleWeekBoardVO.CellVO 对齐，GZ-RECYCLE-012 / ADR-0022）。
 *
 * 一单发**一个**块（不是逐格发 N 个），前端按 spanHours 做 rowspan 合并渲染。
 * `kind='spill'` 随 spill_time_slot_id 一起退休：多格占用现在由块自身的 [slotStart, slotEnd) 表达。
 */
export interface RecycleBoardCellVO {
  apptDate: string;
  /** 块起点 "HH:mm:ss" */
  slotStart: string;
  /** 块止点 "HH:mm:ss" */
  slotEnd: string;
  /** 本块跨几个 1 小时格（rowspan） */
  spanHours: number;
  /** customer（顾客单）/ manual（手动占用） */
  kind: 'customer' | 'manual';
  /** 源单 id */
  appointmentId: string;
  appointmentNo?: string | null;
  /** 记录状态 submitted/confirmed_onsite/paying/paid/payout_failed/manual_hold */
  status?: string | null;
  /** 记录来源 mp / manual */
  source?: string | null;
  /** 联系手机号快照（source=mp 时有值） */
  mobileSnapshot?: string | null;
  /** 点数档展示文案（source=mp 时有值） */
  qtyBucketLabel?: string | null;
  /** 备注（顾客下单备注 / 店员手动占用备注） */
  remark?: string | null;
}

/** 回收看板周视图 VO（与 GzRecycleWeekBoardVO.java 对齐，ADR-0021 §3 + ADR-0022 小时格） */
export interface RecycleWeekBoardVO {
  storeId: string;
  /** 周一（weekStart 入参归一到所在周的周一） */
  weekStart: string;
  /** 周日（weekStart + 6 天） */
  weekEnd: string;
  /** 矩阵行 = 营业窗口切出的小时格 ∪ 本周活跃单覆盖到的孤儿格 */
  slots: RecycleBoardSlotVO[];
  /** 占用区间块（空闲格由前端用 slots × 7 天补齐） */
  cells: RecycleBoardCellVO[];
}

/** 一个 1 小时格的可选性（与 RecycleHourSlotVO.java 对齐，GZ-RECYCLE-012） */
export interface RecycleHourSlotVO {
  startTime: string;
  endTime: string;
  /** 展示文案 "HH:mm" */
  label: string;
  /** 本格自身已被占 */
  taken: boolean;
  /** 今天且该时刻已过 */
  past: boolean;
  /** 以本格为起点能否放下整段 N 小时 —— **前端唯一该看的字段** */
  selectable: boolean;
}

/** 小时格可用性容器（与 RecycleSlotAvailabilityVO.java 对齐） */
export interface RecycleHourSlotsVO {
  date: string;
  spanHours: number;
  slots: RecycleHourSlotVO[];
}

/**
 * admin 小时格可用性（改期弹窗选新时间用，GZ-RECYCLE-012）。
 *
 * `excludeAppointmentId` **必传**：不排除的话被改期的单会跟自己的原区间冲突，相邻起点永远选不了。
 */
export function getHourSlots(
  storeId: string | number,
  date: string,
  spanHours: number,
  excludeAppointmentId?: string | number
): AxiosPromise<RecycleHourSlotsVO> {
  return request({
    url: '/system/gz/recycle/appointment/hour-slots',
    method: 'get',
    params: { storeId, date, spanHours, excludeAppointmentId }
  });
}

/** 回收看板周视图（GET /system/gz/recycle/appointment/week-board?storeId=&weekStart=YYYY-MM-DD） */
export function getWeekBoard(storeId: string | number, weekStart: string): AxiosPromise<RecycleWeekBoardVO> {
  return request({ url: '/system/gz/recycle/appointment/week-board', method: 'get', params: { storeId, weekStart } });
}

/** 手动占用时段（同门店同日多格，同一事务 all-or-nothing；ADR-0021 §1） */
export function manualHoldSlots(data: {
  storeId: string | number;
  apptDate: string;
  /** 小时格起点列表 "HH:mm:ss"（一格一行，每行 1 小时；GZ-RECYCLE-012） */
  slotStarts: string[];
  remark: string;
}): AxiosPromise<GzRecycleAppointmentVO[]> {
  return request({ url: '/system/gz/recycle/appointment/manual-hold', method: 'post', data });
}

/** 释放手动占用（仅 source=manual AND status=manual_hold 可释放，否则 4129） */
export function releaseHold(id: string): AxiosPromise<GzRecycleAppointmentVO> {
  return request({ url: `/system/gz/recycle/appointment/${id}/release-hold`, method: 'post' });
}

/** 预约改期（原地 UPDATE，不含 storeId——不允许跨门店改期；ADR-0021 §2） */
export function rescheduleAppointment(id: string, data: { apptDate: string; slotStart: string }): AxiosPromise<GzRecycleAppointmentVO> {
  return request({ url: `/system/gz/recycle/appointment/${id}/reschedule`, method: 'post', data });
}

/**
 * 取消顾客单（GZ-RECYCLE-014）：释放它占住的全部小时格。
 *
 * 仅 submitted / confirmed_onsite 可取消 —— 回收是反向打款，paying/paid/payout_failed 一律 4132。
 * 手动占用走 releaseHold。
 */
export function cancelCustomerAppointment(id: string): AxiosPromise<GzRecycleAppointmentVO> {
  return request({ url: `/system/gz/recycle/appointment/${id}/cancel`, method: 'post' });
}
