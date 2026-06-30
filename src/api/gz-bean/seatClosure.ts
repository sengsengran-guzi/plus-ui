/**
 * 拼豆座位关闭管理 API（admin 端）。
 *
 * 后端路径：/system/gz/bean/seat-closure/*
 * 权限：gz:bean:seatClosure:list / add / edit / remove
 *
 * 模型背景：按 weekday + [time_start, time_end) 周复发关闭具体座位（自动恢复）。
 * 关闭语义只拦新单、不动已存活预约（沿用 seat enabled 停用「不动已有单」先例）。
 * 允许同座同星期多条关闭叠加（无唯一键）。字段权威：gz_bean_seat_closure。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 座位关闭 VO（与 GzBeanSeatClosureVO.java 对齐；id 类全部 string 防 JS 精度丢失） */
export interface GzBeanSeatClosureVO {
  /** 主键（string） */
  id: string;
  /** 门店 id（string） */
  storeId: string;
  /** 座位单元 id（string） */
  seatId: string;
  /** 星期 1=周一 .. 7=周日（ISO） */
  weekday: number;
  /** 关闭起（含），HH:mm:ss */
  timeStart: string;
  /** 关闭止（不含），HH:mm:ss */
  timeEnd: string;
  /** 0=停用该条关闭 / 1=启用 */
  enabled: number;
  /** 创建时间 */
  createTime?: string;
  /** 备注 */
  remark?: string | null;
  /** 门店名（service enrich） */
  storeName?: string | null;
  /** 座位号（service join seat.seat_no 回填） */
  seatNo?: string | null;
  /** 所属桌型显示名（service join config.name 回填） */
  typeName?: string | null;
}

/** 批量新增 BO（与 GzBeanSeatClosureBo.java 对齐；service 把 seatIds × weekdays 展开成 N 行） */
export interface GzBeanSeatClosureAddForm {
  /** 门店 id */
  storeId: number | string | null;
  /** 多选座位 id */
  seatIds: Array<number | string>;
  /** 多选星期 1..7 */
  weekdays: number[];
  /** 关闭起（含），HH:mm:ss */
  timeStart: string;
  /** 关闭止（不含），HH:mm:ss */
  timeEnd: string;
  /** 备注 */
  remark?: string | null;
}

/** 编辑单条 BO（改启停 / 时段） */
export interface GzBeanSeatClosureEditForm {
  id: number | string;
  timeStart?: string;
  timeEnd?: string;
  enabled?: number;
  remark?: string | null;
}

/** 列表查询参数（与 GzBeanSeatClosureQueryBo.java 对齐） */
export interface GzBeanSeatClosureQuery {
  storeId?: number | string | null;
  seatId?: number | string | null;
  weekday?: number | null;
  enabled?: number | null;
  pageNum?: number;
  pageSize?: number;
}

/** GET /system/gz/bean/seat-closure/list — 分页查询座位关闭 */
export function listGzBeanSeatClosure(query: GzBeanSeatClosureQuery): AxiosPromise<{ total: number; rows: GzBeanSeatClosureVO[] }> {
  return request({
    url: '/system/gz/bean/seat-closure/list',
    method: 'get',
    params: query
  });
}

/** POST /system/gz/bean/seat-closure — 批量新建（seatIds × weekdays 展开成 N 行） */
export function addGzBeanSeatClosure(data: GzBeanSeatClosureAddForm) {
  return request({
    url: '/system/gz/bean/seat-closure',
    method: 'post',
    data
  });
}

/** PUT /system/gz/bean/seat-closure — 编辑单条（启停 / 时段） */
export function updateGzBeanSeatClosure(data: GzBeanSeatClosureEditForm) {
  return request({
    url: '/system/gz/bean/seat-closure',
    method: 'put',
    data
  });
}

/** DELETE /system/gz/bean/seat-closure/{ids} — 软删（id 集合） */
export function delGzBeanSeatClosure(ids: Array<number | string> | number | string) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({
    url: `/system/gz/bean/seat-closure/${idStr}`,
    method: 'delete'
  });
}
