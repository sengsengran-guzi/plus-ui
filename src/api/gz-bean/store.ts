/**
 * GZ-BEAN-001 拼豆门店管理 API（admin 端）
 *
 * 后端路径：/system/gz/bean/store/*
 * 权限：gz:bean:store:list / query / add / edit / remove
 *
 * 字段权威：doc/11 §3.1 gz_bean_store
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 门店 VO（与 GzBeanStoreVO.java 对齐） */
export interface GzBeanStoreVO {
  /** 主键 */
  id: number;
  /** 业务码（如 CD001） */
  storeNo: string;
  /** 门店名 */
  name: string;
  /** 类型 pindou / guzi */
  type: string;
  /** 适用业务（逗号分隔集合，GZ-BEAN-053）：pindou=拼豆预约 / recycle=回收预约 */
  bizScope: string;
  /** 完整地址 */
  address: string;
  /** 经度（V1.0 可空） */
  longitude?: number | string | null;
  /** 纬度（V1.0 可空） */
  latitude?: number | string | null;
  /** 门店电话 */
  phone?: string | null;
  /** 营业时间字符串 */
  businessHours?: string | null;
  /** 门店图片 file id（gz_file_object.id，可空；GzImageThumb / 回显用） */
  imageId?: number | string | null;
  /** 状态 open / closed / maintenance */
  status: string;
  /** 可预约最大提前天数 */
  maxAdvanceDays: number;
  /** 计时看板临近结束提前提醒分钟数（ADR-0016 §6 门店级阈值，默认 30；空回退全局/默认） */
  nearEndMinutes?: number | null;
  /** 创建时间 */
  createTime?: string;
  /** 备注 */
  remark?: string | null;
}

/**
 * 业务线（GZ-BEAN-053，客户 2026-09-21「回收和拼豆不是一个门店」）。
 * 一家门店可同时开通两条线（存量成都两店过渡期即如此），故门店上存的是集合，筛选时只传单个。
 */
export type BizScope = 'pindou' | 'recycle';

export const BIZ_SCOPES: readonly BizScope[] = ['pindou', 'recycle'];

/** 新增 / 编辑 BO（与 GzBeanStoreBo.java 对齐） */
export interface GzBeanStoreForm {
  id?: number | null;
  storeNo?: string;
  name?: string;
  type?: string;
  /** 适用业务（逗号分隔，如 'pindou' / 'recycle' / 'pindou,recycle'） */
  bizScope?: string;
  address?: string;
  longitude?: number | string | null;
  latitude?: number | string | null;
  phone?: string | null;
  businessHours?: string | null;
  /** 门店图片 file id（GzImageUpload v-model，字符串；后端 BO Long，Jackson 兼容数字串） */
  imageId?: string | null;
  status?: string;
  maxAdvanceDays?: number | null;
  /** 计时看板临近结束提前提醒分钟数（ADR-0016 §6，默认 30） */
  nearEndMinutes?: number | null;
  remark?: string | null;
}

/** 查询参数（与 GzBeanStoreQueryBo.java 对齐） */
export interface GzBeanStoreQuery {
  storeNo?: string;
  name?: string;
  type?: string;
  status?: string;
  /** 适用业务筛选：传单个业务线，匹配「开通了该业务线」的门店 */
  bizScope?: BizScope;
  pageNum?: number;
  pageSize?: number;
}

/** GET /system/gz/bean/store/list — 分页查询门店 */
export function listGzBeanStore(query: GzBeanStoreQuery): AxiosPromise<{ total: number; rows: GzBeanStoreVO[] }> {
  return request({
    url: '/system/gz/bean/store/list',
    method: 'get',
    params: query
  });
}

/**
 * GET /system/gz/bean/store/options — admin 门店下拉数据源。
 *
 * 业务页必须传自己的 scope：回收页传 'recycle'、拼豆页传 'pindou'，否则下拉里会混进另一条线的门店。
 * 不传 = 全部门店（仅账号管理绑定门店这类跨业务场景用）。
 */
export function getGzBeanStoreOptions(scope?: BizScope): AxiosPromise<GzBeanStoreVO[]> {
  return request({
    url: '/system/gz/bean/store/options',
    method: 'get',
    params: scope ? { scope } : undefined
  });
}

/** GET /system/gz/bean/store/{id} — 门店详情 */
export function getGzBeanStore(id: number | string): AxiosPromise<GzBeanStoreVO> {
  return request({
    url: `/system/gz/bean/store/${id}`,
    method: 'get'
  });
}

/** POST /system/gz/bean/store — 新增门店 */
export function addGzBeanStore(data: GzBeanStoreForm) {
  return request({
    url: '/system/gz/bean/store',
    method: 'post',
    data
  });
}

/** PUT /system/gz/bean/store — 编辑门店 */
export function updateGzBeanStore(data: GzBeanStoreForm) {
  return request({
    url: '/system/gz/bean/store',
    method: 'put',
    data
  });
}

/** DELETE /system/gz/bean/store/{ids} — 删除门店（软删，id 集合） */
export function delGzBeanStore(ids: Array<number | string> | number | string) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({
    url: `/system/gz/bean/store/${idStr}`,
    method: 'delete'
  });
}
