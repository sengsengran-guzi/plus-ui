/**
 * GZ-BEAN-013 拼豆座位类型配额配置 API（admin 端）
 *
 * 后端路径：/system/gz/bean/seatTypeConfig/*
 * 权限：gz:bean:seatTypeConfig:list / add / edit / remove
 * 模型背景：ADR-0008（座位由具体座位 A1-A10 改为「座位类型配额」，admin 配每类型数量 + 单价）
 * 字段权威：doc/11 §3.4 gz_bean_seat_type_config
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 座位类型配额 VO（与 GzBeanSeatTypeConfigVO.java 对齐；ADR-0014 去字典 + 双模式） */
export interface GzBeanSeatTypeConfigVO {
  /** 主键 */
  id: number;
  /** 门店 id */
  storeId: number;
  /** 门店内稳定 code（去字典后仅展示；admin 不编辑，新行后端自动生成 st<id>） */
  seatType: string;
  /** 自定义显示名（取代字典 label） */
  name: string;
  /** 订法 whole=整桌 / seat=按座 */
  bookMode: string;
  /** 每桌座位数 */
  capacity: number;
  /** 数量（每格物理单位数 = 桌/单位数） */
  quantity: number;
  /** 单价（分） */
  priceCent: number;
  /** 单价（元，后端 priceCent/100 算） */
  priceYuan: number | string;
  /** 包天名额（GZ-BEAN-042 / ADR-0017；0=不开放包天，上限为该桌型总座位数） */
  dayPassQuota: number;
  /** 包天固定价（分） */
  dayPassPriceCent: number;
  /** 包天固定价（元，后端 dayPassPriceCent/100 算） */
  dayPassPriceYuan: number;
  /** 是否对小程序开放：1=正常桌型可订 / 0=仅后台看板可见的临时桌（GZ-BEAN-054 / ADR-0023） */
  mpVisible: number;
  /** 0=停用 / 1=启用 */
  enabled: number;
  /** 排序值 */
  sortNo: number;
  /** 创建时间 */
  createTime?: string;
  /** 备注 */
  remark?: string | null;
}

/** 新增 / 编辑 BO（与 GzBeanSeatTypeConfigBo.java 对齐；seatType code 由后端生成不传） */
export interface GzBeanSeatTypeConfigForm {
  id?: number | null;
  storeId?: number | null;
  name?: string;
  bookMode?: string;
  capacity?: number | null;
  quantity?: number | null;
  priceCent?: number | null;
  /** 包天名额（GZ-BEAN-042 / ADR-0017；可空=0，后端校 0 ≤ dayPassQuota ≤ 桌型总座位数） */
  dayPassQuota?: number;
  /** 包天固定价（分；可空=0，后端校 ≥0） */
  dayPassPriceCent?: number;
  /** 1=小程序可订 / 0=仅后台临时桌（GZ-BEAN-054）；可空 → 后端视作 1 */
  mpVisible?: number;
  enabled?: number;
  sortNo?: number;
  remark?: string | null;
}

/**
 * 按星期 × 1h 格价格覆盖 VO（与 GzBeanSeatTypePriceVO.java 对齐；ADR-0015 §3.1）。
 * slotStart=null → 该星期整天默认价；slotStart="HH:00:00" → 该星期该 1h 格覆盖价。
 */
export interface GzBeanSeatTypePriceVO {
  /** ISO 8601 星期 1=Mon..7=Sun */
  weekday: number;
  /** 该 1h 格起整点 "HH:mm:ss"；null = 该星期整天默认价 */
  slotStart: string | null;
  /** 覆盖单价（分） */
  priceCent: number;
  /** 覆盖单价（元） */
  priceYuan: number | string;
}

/**
 * 按星期 × 1h 格价格覆盖保存 BO（与 GzBeanSeatTypePriceBo.java 对齐；ADR-0015 §3.1）。
 * 覆盖式：未传的「星期 × 格」删除回退默认 / 基础价。
 * slotStart=null → 整天默认价行；slotStart="HH:00:00" → 该 1h 格覆盖价行。
 */
export interface GzBeanSeatTypePriceForm {
  items: Array<{ weekday: number; slotStart: string | null; priceCent: number }>;
}

/**
 * 包天按星期价 VO（与 GzBeanDayPassPriceVO.java 对齐；GZ-BEAN-053）。
 * 未覆盖的星期不返回（下单回退 config.dayPassPriceCent 基础包天价）。
 */
export interface GzBeanDayPassPriceVO {
  /** ISO 8601 星期 1=Mon..7=Sun */
  weekday: number;
  /** 该星期的包天固定价（分） */
  priceCent: number;
  /** 该星期的包天固定价（元） */
  priceYuan: number | string;
}

/**
 * 包天按星期价保存 BO（与 GzBeanDayPassPriceBo.java 对齐；GZ-BEAN-053）。
 * 覆盖式：未传的星期删除回退基础包天价。
 */
export interface GzBeanDayPassPriceForm {
  items: Array<{ weekday: number; priceCent: number }>;
}

/** 查询参数（与 GzBeanSeatTypeConfigQueryBo.java 对齐） */
export interface GzBeanSeatTypeConfigQuery {
  storeId?: number | null;
  seatType?: string;
  enabled?: number;
  pageNum?: number;
  pageSize?: number;
}

/** GET /system/gz/bean/seatTypeConfig/list — 分页查询 */
export function listGzBeanSeatTypeConfig(query: GzBeanSeatTypeConfigQuery): AxiosPromise<{ total: number; rows: GzBeanSeatTypeConfigVO[] }> {
  return request({
    url: '/system/gz/bean/seatTypeConfig/list',
    method: 'get',
    params: query
  });
}

/** GET /system/gz/bean/seatTypeConfig/listByStore/{storeId} — 按门店全量（admin 配置页主用，不分页） */
export function listGzBeanSeatTypeConfigByStore(storeId: number): AxiosPromise<GzBeanSeatTypeConfigVO[]> {
  return request({
    url: `/system/gz/bean/seatTypeConfig/listByStore/${storeId}`,
    method: 'get'
  });
}

/** GET /system/gz/bean/seatTypeConfig/{id} — 详情 */
export function getGzBeanSeatTypeConfig(id: number | string): AxiosPromise<GzBeanSeatTypeConfigVO> {
  return request({
    url: `/system/gz/bean/seatTypeConfig/${id}`,
    method: 'get'
  });
}

/** POST /system/gz/bean/seatTypeConfig — 新增类型配额 */
export function addGzBeanSeatTypeConfig(data: GzBeanSeatTypeConfigForm) {
  return request({
    url: '/system/gz/bean/seatTypeConfig',
    method: 'post',
    data
  });
}

/** PUT /system/gz/bean/seatTypeConfig — 编辑类型配额 */
export function updateGzBeanSeatTypeConfig(data: GzBeanSeatTypeConfigForm) {
  return request({
    url: '/system/gz/bean/seatTypeConfig',
    method: 'put',
    data
  });
}

/** PUT /system/gz/bean/seatTypeConfig/{id}/enabled/{enabled} — 切换启用状态（属编辑权限） */
export function toggleGzBeanSeatTypeConfigEnabled(id: number, enabled: number) {
  return request({
    url: `/system/gz/bean/seatTypeConfig/${id}/enabled/${enabled}`,
    method: 'put'
  });
}

/** DELETE /system/gz/bean/seatTypeConfig/{ids} — 软删（id 集合） */
export function delGzBeanSeatTypeConfig(ids: Array<number | string> | number | string) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({
    url: `/system/gz/bean/seatTypeConfig/${idStr}`,
    method: 'delete'
  });
}

/**
 * GET /system/gz/bean/seatTypeConfig/{id}/weekday-prices — 读某桌型「星期 × 1h 格」覆盖价。
 * 返回行 {weekday, slotStart, priceCent, priceYuan}：slotStart=null 表整天默认价，"HH:00:00" 表该 1h 格覆盖价。
 * 未覆盖的「星期 × 格」不返回（下单 3 级回退：格价 → 整天默认 → 基础价）。
 */
export function getGzBeanWeekdayPrices(id: number | string): AxiosPromise<GzBeanSeatTypePriceVO[]> {
  return request({
    url: `/system/gz/bean/seatTypeConfig/${id}/weekday-prices`,
    method: 'get'
  });
}

/** PUT /system/gz/bean/seatTypeConfig/{id}/weekday-prices — 覆盖式保存「星期 × 1h 格」价格（未传的删除回退默认 / 基础价） */
export function saveGzBeanWeekdayPrices(id: number | string, data: GzBeanSeatTypePriceForm) {
  return request({
    url: `/system/gz/bean/seatTypeConfig/${id}/weekday-prices`,
    method: 'put',
    data
  });
}

/**
 * GET /system/gz/bean/seatTypeConfig/{id}/day-pass-prices — 读某桌型「包天按星期价」覆盖（GZ-BEAN-053）。
 * 返回行 {weekday, priceCent, priceYuan}；未覆盖的星期不返回（下单回退基础包天价）。
 */
export function getGzBeanDayPassPrices(id: number | string): AxiosPromise<GzBeanDayPassPriceVO[]> {
  return request({
    url: `/system/gz/bean/seatTypeConfig/${id}/day-pass-prices`,
    method: 'get'
  });
}

/** PUT /system/gz/bean/seatTypeConfig/{id}/day-pass-prices — 覆盖式保存「包天按星期价」（未传的星期删除回退基础包天价） */
export function saveGzBeanDayPassPrices(id: number | string, data: GzBeanDayPassPriceForm) {
  return request({
    url: `/system/gz/bean/seatTypeConfig/${id}/day-pass-prices`,
    method: 'put',
    data
  });
}
