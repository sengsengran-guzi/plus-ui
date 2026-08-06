/**
 * GZ-JP-101 拼团场 API（admin 端，UI:admin.event / FLOW:F-JP-01）。
 *
 * 后端路径：/system/gz/jp/event/*
 * 权限：gz:jp:event:list / add / edit / remove（开场 / 关场复用 edit）
 * 字段权威：doc/jp/authority/field-ssot.yaml 的 gz_jp_event 段 / GzJpEventAdminVO.java、GzJpEventBo.java。
 * ID 跨层契约：所有 id 字段 string（Java long ↔ JS number 精度丢失）。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 场状态（字典 gz_jp_event_status） */
export type GzJpEventStatus = 'draft' | 'open' | 'closed';

/** 场 VO（与 GzJpEventAdminVO.java 对齐；id 为 string） */
export interface GzJpEventVO {
  id: string;
  /** 场编号 EVT-yyyyMMdd-6位（系统生成，只读） */
  eventNo: string;
  name: string;
  /** 封面图 file id（gz_file_object.id），无图为 null */
  coverImageId: string | null;
  description: string | null;
  /** yyyy-MM-dd HH:mm:ss */
  startTime: string;
  /** yyyy-MM-dd HH:mm:ss */
  endTime: string;
  /** 生效状态：到 end_time 后即便存库仍是 open，这里也返回 closed（读时惰性判定） */
  status: GzJpEventStatus;
  /** 存库原始状态；与 status 不一致 = 到点惰性结束而非店员手动关场 */
  rawStatus: GzJpEventStatus;
  sortNo: number;
  version: number;
  createTime?: string;
  updateTime?: string;
  remark?: string | null;
}

/** 新增 / 编辑 BO（与 GzJpEventBo.java 对齐；eventNo / status 不接受前端传入） */
export interface GzJpEventForm {
  id?: string | null;
  name?: string;
  coverImageId?: string | null;
  description?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  sortNo?: number | null;
  remark?: string | null;
}

/** 列表查询参数（与 GzJpEventQueryBo.java 对齐） */
export interface GzJpEventQuery {
  eventNo?: string;
  name?: string;
  /** 按生效状态筛选（后端翻译成 SQL 条件，分页 total 准确） */
  status?: GzJpEventStatus | '';
  beginStartTime?: string;
  endStartTime?: string;
  pageNum?: number;
  pageSize?: number;
}

/**
 * GET 列表（分页）。
 *
 * 泛型给<b>行元素数组</b>：src/types/axios.d.ts 把 AxiosResponse 增广成 `{ rows: T; total: number }`，
 * 拦截器又直接返回 ruoyi TableDataInfo body，所以调用方写 `res.rows` / `res.total` 即可。
 */
export function listGzJpEvent(query: GzJpEventQuery): AxiosPromise<GzJpEventVO[]> {
  return request({ url: '/system/gz/jp/event/list', method: 'get', params: query });
}

/** GET 详情（编辑回填） */
export function getGzJpEvent(id: string): AxiosPromise<GzJpEventVO> {
  return request({ url: `/system/gz/jp/event/${id}`, method: 'get' });
}

/** POST 新建（status 固定 draft，客人不可见） */
export function addGzJpEvent(data: GzJpEventForm) {
  return request({ url: '/system/gz/jp/event', method: 'post', data });
}

/** PUT 编辑（eventNo / status 后端忽略） */
export function updateGzJpEvent(data: GzJpEventForm) {
  return request({ url: '/system/gz/jp/event', method: 'put', data });
}

/** POST 开场（FLOW:F-JP-01.step3）—— 客人可见可下单 */
export function openGzJpEvent(id: string) {
  return request({ url: `/system/gz/jp/event/open/${id}`, method: 'post' });
}

/** POST 关场（FLOW:F-JP-01.step4）—— 不可再下单 */
export function closeGzJpEvent(id: string) {
  return request({ url: `/system/gz/jp/event/close/${id}`, method: 'post' });
}

/** DELETE 软删（进行中的场需先关场） */
export function delGzJpEvent(ids: Array<string> | string) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({ url: `/system/gz/jp/event/${idStr}`, method: 'delete' });
}
