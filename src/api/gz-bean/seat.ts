/**
 * GZ-BEAN-023 拼豆座位单元管理 API（admin 端，ADR-0015）。
 *
 * 后端路径：/system/gz/bean/seat/*
 * 权限：gz:bean:seat:list / add / edit / remove / batchGenerate
 *
 * 模型背景：ADR-0015 复活具体座位单元（挂桌型 config 之下），影院选座以具体座位为准；
 * admin 单独 CRUD / 启停 + 「按桌型批量生成」（不逐个手画）。
 * 字段权威：doc/11 §3.3 gz_bean_seat。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 座位单元 VO（与 GzBeanSeatVO.java 对齐；id 类全部 string 防 JS 精度丢失） */
export interface GzBeanSeatVO {
  /** 主键（string） */
  id: string;
  /** 门店 id（string） */
  storeId: string;
  /** 所属桌型 config id（string）；NULL = legacy 停用座 */
  seatTypeConfigId: string | null;
  /** 座位/桌编号（显示标签） */
  seatNo: string;
  /** 同桌聚合标识（seat 模式同桌多座聚成一组）；whole 可空 */
  tableNo?: string | null;
  /** 分区标签（影院图分区渲染） */
  zone?: string | null;
  /** 行标（影院图行列定位辅助） */
  rowLabel?: string | null;
  /** 列序号（影院图行列定位辅助） */
  colIndex?: number | null;
  /** 0=停用 / 1=启用 */
  enabled: number;
  /** 排序值 */
  sortNo: number;
  /** 创建时间 */
  createTime?: string;
  /** 备注 */
  remark?: string | null;
  /** 桌型显示名（Service join config.name 回填；legacy 座为空） */
  typeName?: string | null;
  /** 订法 whole=整桌 / seat=按座（Service 由 config.book_mode 回填；legacy 座为空） */
  bookMode?: string | null;
}

/** 新增 / 编辑 BO（与 GzBeanSeatBo.java 对齐；编辑禁改 storeId / seatNo，service 内部忽略） */
export interface GzBeanSeatForm {
  id?: number | string | null;
  storeId?: number | string | null;
  seatTypeConfigId?: number | string | null;
  seatNo?: string;
  tableNo?: string | null;
  zone?: string | null;
  rowLabel?: string | null;
  colIndex?: number | null;
  enabled?: number;
  sortNo?: number;
  remark?: string | null;
}

/** 列表查询参数（与 GzBeanSeatQueryBo.java 对齐） */
export interface GzBeanSeatQuery {
  storeId?: number | string | null;
  seatTypeConfigId?: number | string | null;
  seatNo?: string;
  tableNo?: string;
  enabled?: number;
  pageNum?: number;
  pageSize?: number;
}

/** 按桌型批量生成 BO（与 GzBeanSeatBatchGenerateBo.java 对齐；二选一：传 seatTypeConfigId 仅该桌型 / 仅传 storeId 全量） */
export interface GzBeanSeatBatchGenerateForm {
  storeId?: number | string | null;
  seatTypeConfigId?: number | string | null;
  prefix?: string | null;
}

/** GET /system/gz/bean/seat/list — 分页查询座位单元 */
export function listGzBeanSeat(query: GzBeanSeatQuery): AxiosPromise<{ total: number; rows: GzBeanSeatVO[] }> {
  return request({
    url: '/system/gz/bean/seat/list',
    method: 'get',
    params: query
  });
}

/** GET /system/gz/bean/seat/listByStore/{storeId} — 按门店全量（不分页） */
export function listGzBeanSeatByStore(storeId: number | string): AxiosPromise<GzBeanSeatVO[]> {
  return request({
    url: `/system/gz/bean/seat/listByStore/${storeId}`,
    method: 'get'
  });
}

/** GET /system/gz/bean/seat/{id} — 座位单元详情 */
export function getGzBeanSeat(id: number | string): AxiosPromise<GzBeanSeatVO> {
  return request({
    url: `/system/gz/bean/seat/${id}`,
    method: 'get'
  });
}

/** POST /system/gz/bean/seat — 新增座位单元 */
export function addGzBeanSeat(data: GzBeanSeatForm) {
  return request({
    url: '/system/gz/bean/seat',
    method: 'post',
    data
  });
}

/** PUT /system/gz/bean/seat — 编辑座位单元（storeId / seatNo 不可改，service 忽略） */
export function updateGzBeanSeat(data: GzBeanSeatForm) {
  return request({
    url: '/system/gz/bean/seat',
    method: 'put',
    data
  });
}

/** PUT /system/gz/bean/seat/{id}/enabled?enabled= — 启停（属编辑权限） */
export function toggleGzBeanSeatEnabled(id: number | string, enabled: number) {
  return request({
    url: `/system/gz/bean/seat/${id}/enabled`,
    method: 'put',
    params: { enabled }
  });
}

/** DELETE /system/gz/bean/seat/{ids} — 软删（id 集合） */
export function delGzBeanSeat(ids: Array<number | string> | number | string) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({
    url: `/system/gz/bean/seat/${idStr}`,
    method: 'delete'
  });
}

/** POST /system/gz/bean/seat/batchGenerate — 按桌型批量生成座位单元（幂等复活/跳过） */
export function batchGenerateGzBeanSeat(data: GzBeanSeatBatchGenerateForm): AxiosPromise<number> {
  return request({
    url: '/system/gz/bean/seat/batchGenerate',
    method: 'post',
    data
  });
}
