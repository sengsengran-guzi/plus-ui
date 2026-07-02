/**
 * GZ-BEAN-028 拼豆店内计时看板 API（admin 端，ADR-0015 §5）。
 *
 * 后端路径：/system/gz/bean/booking/{board,release-seat,extend}（GzBeanBookingController GZ-BEAN-026）
 * 权限：看板查询 / 放座 / 延时三端点均 @SaCheckPermission('gz:bean:booking:verify')。
 *       菜单可见性走独立点 gz:bean:board:view（GZ-BEAN-028 菜单 seed）。
 *
 * 模型背景：到店核销（verify_time）= 计时起点；看板按当前时刻 + booking 状态算每座实时状态行，
 * 店员现场可放座（写 actual_end_time/slot，该座立即空出可再约；超时单放座只空出本时段不外延）或延时（推 slot_end）。
 * 字段权威：doc/11 §3.12 gz_bean_booking 看板派生 / GzBeanBoardRowVO.java。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 看板状态：空闲 / 已约未到 / 使用中 / 临近结束 / 已超时（后端 service 按当前时刻派生） */
export type GzBeanBoardStatus = 'idle' | 'reserved' | 'in_use' | 'near_end' | 'overtime';

/** 看板行 VO（与 GzBeanBoardRowVO.java 对齐；id 类全部 string 防 JS long 精度丢失） */
export interface GzBeanBoardRowVO {
  /** 座位单元 id（string，恒有值） */
  seatId: string;
  /** 座位/桌编号（显示标签，如 S1 / D1 / Q1-1） */
  seatNo: string;
  /** 同桌聚合标识（seat 模式同桌多座聚成一组）；whole 可空 */
  tableNo?: string | null;
  /** 分区标签（影院图分区渲染） */
  zone?: string | null;
  /** 所属桌型 config id（string） */
  seatTypeConfigId?: string | null;
  /** 桌型显示名（config.name；空回退 seat_type code） */
  typeName?: string | null;
  /** 订法 whole=整桌 / seat=按座 */
  bookMode?: string | null;
  /** 看板状态（见 GzBeanBoardStatus） */
  boardStatus: GzBeanBoardStatus;
  /** 当前活跃单 id（string）；idle 时 null */
  currentBookingId?: string | null;
  /** 当前活跃单业务码 BK...；idle 时 null */
  bookingNo?: string | null;
  /** 当前活跃单计划区间起整点 HH:mm:ss；idle 时 null */
  slotStart?: string | null;
  /** 当前活跃单计划区间止整点 HH:mm:ss；idle 时 null */
  slotEnd?: string | null;
  /** 当前活跃单业务状态 pending / used；idle 时 null */
  status?: string | null;
  /** 当前活跃单支付状态 paid；idle 时 null */
  payStatus?: string | null;
  /** 是否免费单（1=免费）；idle 时 null */
  isFree?: number | null;
  /** 预约人手机号快照（店员看全量，前端可脱敏展示）；idle 时 null */
  mobileSnapshot?: string | null;
  /** 核销（入座/计时起点）时刻 yyyy-MM-dd HH:mm:ss；未核销 / idle 时 null */
  verifyTime?: string | null;
  /** 实际离场/放座时刻；未放座 / idle 时 null */
  actualEndTime?: string | null;
  /** 到计划 slot_end 的剩余分钟（仅 in_use / near_end 回填）；其余 null */
  remainingMinutes?: number | null;
  /**
   * 该座当前单是否可延时（ADR-0016 §6 排满收尾信号）：紧邻后续 1h 格未被本座别的活跃单占 → true
   * （admin 提示「可问客人是否延时」）；已占 → false（admin 提示「请客人收尾」）。
   * 仅 in_use / near_end / overtime 回填，其余 null。
   */
  canExtend?: boolean | null;
  /**
   * 续坐止界 HH:mm:ss（GZ-BEAN-037）：当前单同座同用户 back-to-back 续坐链的最末 slot_end，
   * 仅存在续坐（> 当前 slotEnd）时回填 → 看板显「续坐 → HH:mm」角标；无续坐 / idle 时 null。
   */
  continuousUntil?: string | null;
}

/**
 * 看板②待分座区行 VO（ADR-0016 §3/§5）：已付款待核销但尚未分配物理座位（seat_id NULL）的预约。
 * 与后端 GzBeanBookingVO 子集对齐（仅取看板分座所需字段；id 类全部 string 防 JS 精度丢失）。
 */
export interface GzBeanPendingAssignVO {
  /** 预约 id（string） */
  id: string;
  /** 业务码 BK... */
  bookingNo: string;
  /** 桌型 code（single/double/quad；可空） */
  seatType?: string | null;
  /** 桌型中文名快照（与 board 行 typeName 同源，用于过滤匹配桌型的空闲座） */
  seatTypeSnapshot?: string | null;
  /** 桌型 config id（string；分座弹窗按它筛同桌型空闲座） */
  seatTypeConfigId?: string | null;
  /** 预约日期 yyyy-MM-dd */
  sessDate: string;
  /** 计划时段起 HH:mm:ss */
  slotStart: string;
  /** 计划时段止 HH:mm:ss */
  slotEnd: string;
  /** 手机号 snapshot（店员看全量，前端展示尾号） */
  mobileSnapshot?: string | null;
  /** 是否包天单（GZ-BEAN-042 / ADR-0017；1=包天单，后端 selectPendingAssignList 返回完整 GzBeanBookingVO 已携带） */
  isDayPass?: number | null;
  /** GZ-BEAN-037：是否与同用户当前在店单时段相连（true → 高亮 + 一键提前核销，弹窗默认预选建议座） */
  consecutiveWithActive?: boolean | null;
  /** 建议沿用座位 id（string；consecutiveWithActive=true 时有值，分座弹窗默认预选） */
  suggestedSeatId?: string | null;
  /** 建议沿用座位号（展示用，如 D5） */
  suggestedSeatNo?: string | null;
  /** 同用户相连在店单的占用止界 = 本单时段开始 HH:mm:ss（展示「接续 …后」用） */
  activeSlotEnd?: string | null;
}

/**
 * 过期未结单行 VO（GZ-BEAN-041 / kevin-test §6）：时段已过仍未终结的单
 * （待分座过期 pending / cron 扫走的 no_show / 已超时 used 未放座）。看板「过期待处理」区批量结单用。
 */
export interface GzBeanExpiredUnsettledVO {
  id: string;
  bookingNo: string;
  seatTypeSnapshot?: string | null;
  seatNoSnapshot?: string | null;
  sessDate: string;
  slotStart: string;
  slotEnd: string;
  /** 业务状态 pending / no_show / used */
  status: string;
  /** admin 综合状态（dict gz_bean_booking_status） */
  bizStatus?: string | null;
  mobileSnapshot?: string | null;
  /** 时段已过分钟数（展示「已过期 N 分钟/小时」） */
  expiredMinutes?: number | null;
}

/** 批量结单动作：completed=补核销为已完成 / no_show=标爽约 / released=已超时标已结束（放座） */
export type GzBeanSettleAction = 'completed' | 'no_show' | 'released';

/** 批量结单结果 */
export interface GzBeanBatchSettleResult {
  succeeded: number;
  skipped: number;
  failed: number;
}

/**
 * GET /system/gz/bean/booking/board — 某门店某日各启用座位单元实时状态行
 * @param storeId 门店 id（必填）
 * @param sessDate 看板日期 yyyy-MM-dd（必填）
 */
export function getGzBeanBoard(storeId: number | string, sessDate: string): AxiosPromise<GzBeanBoardRowVO[]> {
  return request({
    url: '/system/gz/bean/booking/board',
    method: 'get',
    params: { storeId, sessDate }
  });
}

/**
 * GET /system/gz/bean/booking/board/pending-assign — 看板②待分座区
 * 某门店某日已付款待核销但未分配物理座位（seat_id NULL）的预约列表。
 * 店员从中挑一笔 → 选一个①区空闲座 → POST /{id}/verify?seatId= 完成核销分座。
 * @param storeId 门店 id（必填）
 * @param sessDate 看板日期 yyyy-MM-dd（必填）
 */
export function getGzBeanPendingAssign(storeId: number | string, sessDate: string): AxiosPromise<GzBeanPendingAssignVO[]> {
  return request({
    url: '/system/gz/bean/booking/board/pending-assign',
    method: 'get',
    params: { storeId, sessDate }
  });
}

/**
 * POST /system/gz/bean/booking/{id}/verify?seatId= — 核销 + 现场分座（ADR-0016 §3）
 * 新模型单必传 seatId（店员从该桌型空闲座挑一个）。
 * 错误码：4021 SEAT_REQUIRED（未分座）/ 4022 SEAT_TYPE_MISMATCH（桌型不符）/ 4002 SEAT_TAKEN（座被占）。
 * @param id 预约 id
 * @param seatId 现场分配的物理座位 id
 */
export function verifyGzBeanBookingWithSeat(id: number | string, seatId: number | string): AxiosPromise<GzBeanBoardRowVO> {
  return request({
    url: `/system/gz/bean/booking/${id}/verify`,
    method: 'post',
    params: { seatId }
  });
}

/**
 * POST /system/gz/bean/booking/{id}/release-seat — 放座
 * 对在店使用中（used）单写 actual_end_time/slot，该座剩余格立即可再约（不改 status）。
 * @param id 预约 id
 */
export function releaseGzBeanSeat(id: number | string): AxiosPromise<GzBeanBoardRowVO> {
  return request({
    url: `/system/gz/bean/booking/${id}/release-seat`,
    method: 'post'
  });
}

/**
 * POST /system/gz/bean/booking/{id}/extend?addMinutes= — 延时（kevin-test §3a 改输入分钟）
 * 把 slot_end 往后推 addMinutes 分钟（精确到分，差额线下结算）；占用按整点格回收（溢入下一格即占该格、mp 余量 −1）。
 * 先校验新增格未被占（占了拒绝 EXTEND_CONFLICT）。
 * @param id 预约 id
 * @param addMinutes 延后分钟数（正整数 1-720）
 */
export function extendGzBeanBooking(id: number | string, addMinutes: number): AxiosPromise<GzBeanBoardRowVO> {
  return request({
    url: `/system/gz/bean/booking/${id}/extend`,
    method: 'post',
    params: { addMinutes }
  });
}

/**
 * POST /system/gz/bean/booking/{id}/reassign-seat?seatId= — 改派座位（GZ-BEAN-040 / kevin-test §5）
 * 把已核销（used 未放座）单改派到另一空闲座位（店员分错座的补救）。复用核销分座校验链。
 * 错误码：4017（已放座/非used）/ 4022（桌型不符）/ 4002（座被占）。
 */
export function reassignGzBeanSeat(id: number | string, seatId: number | string): AxiosPromise<GzBeanBoardRowVO> {
  return request({
    url: `/system/gz/bean/booking/${id}/reassign-seat`,
    method: 'post',
    params: { seatId }
  });
}

/**
 * GET /system/gz/bean/booking/board/expired-unsettled — 看板「过期待处理」区（GZ-BEAN-041 / kevin-test §6）
 * 某门店某日时段已过仍未终结的单（pending 过期 / no_show 翻案 / used 已超时未放座）。
 */
export function getGzBeanExpiredUnsettled(storeId: number | string, sessDate: string): AxiosPromise<GzBeanExpiredUnsettledVO[]> {
  return request({
    url: '/system/gz/bean/booking/board/expired-unsettled',
    method: 'get',
    params: { storeId, sessDate }
  });
}

/**
 * POST /system/gz/bean/booking/batch-settle — 批量结单（GZ-BEAN-041 / kevin-test §6）
 * action: completed（补核销为已完成，pending|no_show→used，无座历史结算）/ no_show（标爽约）/ released（已超时标已结束=放座）。
 */
export function batchSettleGzBeanBookings(
  bookingIds: (number | string)[],
  action: GzBeanSettleAction
): AxiosPromise<GzBeanBatchSettleResult> {
  return request({
    url: '/system/gz/bean/booking/batch-settle',
    method: 'post',
    data: { bookingIds, action }
  });
}
