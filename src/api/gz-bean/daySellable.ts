/**
 * 拼豆「今日可售」抽屉 API（admin 端店内计时看板，ADR-0024 §3）。
 *
 * 后端路径：
 *   - GET  /system/gz/bean/booking/day-sellable     — 当日各桌型逐时段可售 + 未被预订座位（perm gz:bean:booking:verify）
 *   - POST /system/gz/bean/slotQuotaClose           — 逐时段：upsert 单格关闭数（perm gz:bean:slotQuota:edit）
 *   - POST /system/gz/bean/slotQuotaClose/close-day — 按天统一：该桌型该日每格关闭数统一覆盖（同上权限）
 *
 * 口径（ADR-0018 §3 客户 7.05 定，2026-09-26 复核维持）：**关闭一律数量制**。
 * mp 顾客只选桌型档不选具体座位（ADR-0016），所以「今天留几个座不给线上」对顾客侧唯一能落地的形式
 * 就是减该桌型该格的档位配额；不做座位级开关，也不按物理座位数折算（whole 模式的配额单位是「桌」）。
 * freeSeats（当天没被预订的座位）是只读信息，供店员判断线下来人能接几桌。
 *
 * 逐时段 upsert 复用 `@/api/gz-bean/slotAvailability` 的 `upsertGzBeanSlotQuotaClose`（同一后端端点，
 * 实时余量页也在用），不在本文件重复声明。
 *
 * id 一律 string（跨层契约 #1，防 JS long 精度丢失）。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 逐 1h 格明细行（与 GzBeanDaySellableVO.SlotRow 对齐） */
export interface GzBeanDaySellableSlotRow {
  /** 该 1h 格起 HH:mm */
  slotStart: string;
  /** 该 1h 格止 HH:mm（当日最后一格 23:00 显示 00:00） */
  slotEnd: string;
  /** 该格已订（覆盖该格的活跃单数，与 mp 余量同一条 SQL） */
  booked: number;
  /**
   * 该格**今日生效**的关闭数 = 当日已记录值 ?? longCloseCount（**覆盖**关系，GZ-BEAN-057）。
   * stepper 预填这个值。
   */
  closeCount: number;
  /** closeCount 是否来自「今天没设 → 沿用长期默认」（true = 沿用；false = 店员今天改过） */
  closeInherited: boolean;
  /** 该格剩余可订 = max(0, capPerSlot − closeCount − booked) */
  remaining: number;
}

/** 当日可售行 VO（与 GzBeanDaySellableVO.java 对齐）；只含「对小程序开放」的桌型 */
export interface GzBeanDaySellableVO {
  /** 桌型档 id（string；两个写动作都回传它） */
  seatTypeConfigId: string;
  /** 桌型显示名 */
  name: string;
  /** 订法 whole=整桌 / seat=按座（决定配额单位显示「桌」还是「座」） */
  bookMode?: string | null;
  /** 该桌型每 1h 格的**总容量**（不含任何关闭；整桌=数量 / 按座=数量×每座数）；也是关闭数上限 */
  capPerSlot: number;
  /** 长期关闭数（GZ-BEAN-057，桌型配置里配）：看板「今天关闭」的**默认值** */
  longCloseCount: number;
  /** 「今天不填」时的默认可订量 = capPerSlot − longCloseCount（逐格实际值看 slots[].remaining） */
  sellableCap: number;
  /** 当日营业小时格数 */
  slotCount: number;
  /** 当日活跃单量（去重；跨多小时的单只算 1 单） */
  activeBookings: number;
  /**
   * 逐小时格明细（长度 = slotCount，按格起整点升序）。抽屉里「不同时段还剩多少 / 今天暂时关闭几个」
   * 表格 + 逐格 stepper 的数据源。
   *
   * 不下发「逐格剩余合计」—— 那是「档位·小时」量纲（跨格单重复计），摆到界面上会被当成「还能接几单」误读。
   */
  slots: GzBeanDaySellableSlotRow[];
  /** 【档位口径】各小时格 remaining 的最小值 = 「今天最难订的那个小时还剩几个」；随关闭立刻变化，关满 = 0 */
  minSlotRemaining: number;
  /** 当天没被预订的座位（只读参考，unbooked 即看板口径下当天无活跃单的座位） */
  freeSeats: Array<{
    seatId: string;
    seatNo: string;
    tableNo?: string | null;
  }>;
}

/** close-day 入参（与 GzBeanSlotQuotaCloseDayBo.java 对齐） */
export interface GzBeanSlotQuotaCloseDayForm {
  storeId: number | string;
  seatTypeConfigId: number | string;
  sessDate: string;
  /** 每格关闭数（0 = 恢复全开）；上限 = 该桌型 capPerSlot */
  closeCount: number;
  remark?: string | null;
}

/** close-day 返回（与 GzBeanSlotQuotaCloseDayVO.java 对齐） */
export interface GzBeanSlotQuotaCloseDayResult {
  /** 覆盖到的小时格数 */
  slotCount: number;
  /** 实际写入的每格关闭数 */
  closeCount: number;
  /** 该桌型每格可订上限 */
  cap: number;
}

/** GET /system/gz/bean/booking/day-sellable — 当日各桌型逐时段可售情况 + 未被预订座位 */
export function getGzBeanDaySellable(query: { storeId: number | string; sessDate: string }): AxiosPromise<GzBeanDaySellableVO[]> {
  return request({
    url: '/system/gz/bean/booking/day-sellable',
    method: 'get',
    params: query
  });
}

/** POST /system/gz/bean/slotQuotaClose/close-day — 把该桌型该日每个小时格的关闭数统一覆盖为 closeCount */
export function closeGzBeanSlotQuotaDay(data: GzBeanSlotQuotaCloseDayForm): AxiosPromise<GzBeanSlotQuotaCloseDayResult> {
  return request({
    url: '/system/gz/bean/slotQuotaClose/close-day',
    method: 'post',
    data
  });
}
