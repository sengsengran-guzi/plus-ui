/**
 * GZ-GACHA-112 扭蛋产品库 admin CRUD API（admin 端，ADR-0013）
 *
 * 后端路径：/system/gz/gacha/product/*
 * 权限：gz:gacha:product:list / query / add / edit / remove（/options 走 list 权）
 *
 * 字段权威：doc/11 §7.1 gz_gacha_product / ADR-0013 §1
 * 产品库 = 跨机器复用的固有属性（名 / 图 / 参考价 / IP 标签 / 启用）；
 * 投放线（gz_gacha_prize）改为「选产品 + 配 稀有度/权重/库存/启用」（见 prize.ts）。
 *
 * 跨层契约 #1：所有 id 字段为 string（避免 JS long 精度丢失）。
 * 金额 referenceValueCent 分单位（前端 /100 显示元，提交时 Math.round(yuan*100)）。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 产品库 admin VO（与 GzGachaProductVo.java 对齐） */
export interface GzGachaProductVO {
  /** 产品主键（string） */
  id: string;
  /** 业务码 GPRD-yyyyMMdd-6位序号（只读） */
  productNo: string;
  /** 产品名 */
  name: string;
  /** 产品图 file_id（string；前端换签名 URL） */
  imageId?: string | null;
  /** 公示参考价（分，null = 不显示） */
  referenceValueCent?: number | null;
  /** IP 标签 */
  ipTag?: string | null;
  /** 1 可投放 / 0 停用 */
  enabled: number;
  /** 乐观锁版本 */
  version?: number;
  /** 创建时间 */
  createTime?: string;
  /** 更新时间 */
  updateTime?: string;
  /** 备注 */
  remark?: string | null;
}

/** 产品库增改表单（与 GzGachaProductBo.java 对齐） */
export interface GzGachaProductForm {
  /** 主键（编辑必传） */
  id?: string | null;
  name?: string;
  imageId?: string | null;
  /** 公示参考价（分，可空） */
  referenceValueCent?: number | null;
  ipTag?: string | null;
  /** 1 可投放 / 0 停用（空默认 1） */
  enabled?: number;
  remark?: string | null;
}

/** 查询参数（与 GzGachaProductQueryBo.java 对齐） */
export interface GzGachaProductQuery {
  /** 产品名模糊筛选 */
  name?: string;
  /** IP 标签精确筛选 */
  ipTag?: string;
  /** 是否可投放精确筛选（0/1） */
  enabled?: number;
  pageNum?: number;
  pageSize?: number;
}

/** GET /list — 分页查询产品（name/ipTag/enabled 筛选） */
export function listGzGachaProduct(query: GzGachaProductQuery): AxiosPromise<{ total: number; rows: GzGachaProductVO[] }> {
  return request({
    url: '/system/gz/gacha/product/list',
    method: 'get',
    params: query
  });
}

/** GET /options — 奖品池「选产品」下拉（仅 enabled=1；可按 ipTag 过滤） */
export function optionsGzGachaProduct(ipTag?: string): AxiosPromise<GzGachaProductVO[]> {
  return request({
    url: '/system/gz/gacha/product/options',
    method: 'get',
    params: ipTag ? { ipTag } : {}
  });
}

/** GET /{id} — 产品详情 */
export function getGzGachaProduct(id: string | number): AxiosPromise<GzGachaProductVO> {
  return request({
    url: `/system/gz/gacha/product/${id}`,
    method: 'get'
  });
}

/** POST / — 新建产品（product_no 系统生成 GPRD-yyyyMMdd-6位序号） */
export function addGzGachaProduct(data: GzGachaProductForm) {
  return request({
    url: '/system/gz/gacha/product',
    method: 'post',
    data
  });
}

/** PUT / — 编辑产品（product_no 不可改） */
export function updateGzGachaProduct(data: GzGachaProductForm) {
  return request({
    url: '/system/gz/gacha/product',
    method: 'put',
    data
  });
}

/** DELETE /{ids} — 软删（del_flag=2；被投放线引用拒删） */
export function delGzGachaProduct(ids: Array<string | number> | string | number) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({
    url: `/system/gz/gacha/product/${idStr}`,
    method: 'delete'
  });
}
