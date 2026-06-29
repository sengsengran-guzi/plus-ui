/**
 * GZ-BEAN-028 拼豆店内计时看板 API（admin 端，ADR-0015 §5）。
 *
 * 后端路径：/system/gz/bean/booking/{board,release-seat,extend}（GzBeanBookingController GZ-BEAN-026）
 * 权限：看板查询 / 放座 / 延时三端点均 @SaCheckPermission('gz:bean:booking:verify')。
 *       菜单可见性走独立点 gz:bean:board:view（GZ-BEAN-028 菜单 seed）。
 *
 * 模型背景：到店核销（verify_time）= 计时起点；看板按当前时刻 + booking 状态算每座实时状态行，
 * 店员现场可提前放座（写 actual_end_time/slot，该座剩余格立即可再约）或延时（推 slot_end）。
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
 * POST /system/gz/bean/booking/{id}/release-seat — 提前放座
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
 * POST /system/gz/bean/booking/{id}/extend?addHours= — 延时
 * 把 slot_end 往后推 addHours 个整点格；先校验新增格未被占（占了拒绝 EXTEND_CONFLICT）。
 * @param id 预约 id
 * @param addHours 延后整点格数（正整数）
 */
export function extendGzBeanBooking(id: number | string, addHours: number): AxiosPromise<GzBeanBoardRowVO> {
  return request({
    url: `/system/gz/bean/booking/${id}/extend`,
    method: 'post',
    params: { addHours }
  });
}
