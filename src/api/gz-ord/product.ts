/**
 * GZ-ORD-101 预购商品 + SKU admin CRUD API（admin 端）
 *
 * 后端路径：/system/gz/ord/product/*
 * 权限：gz:ord:product:list / add / edit / changeStatus / remove
 *
 * 字段权威：doc/11 §6.1 gz_ord_product + §6.2 gz_ord_sku
 * 状态机：on_shelf / off_shelf / auto_off（auto_off 仅 cron，admin 不可手动设）
 *
 * 跨层契约 #1：所有 id 字段为 string（避免 JS long 精度丢失）。金额 priceCent 分单位（前端 /100 显示元）。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** SKU 展示对象（与 GzOrdSkuVO.java 对齐） */
export interface GzOrdSkuVO {
  /** SKU 主键（string） */
  id: string;
  /** 所属商品 id（string） */
  productId?: string;
  /** 业务码 SKU-yyyyMMdd-6位序号（系统生成，只读） */
  skuNo?: string;
  /** 规格名 */
  specName: string;
  /** 单价（分；前端 /100 显示元） */
  priceCent: number;
  /** 总库存（null = 无限） */
  stockTotal?: number | null;
  /** 当前剩余（null = 无限） */
  stockRemain?: number | null;
  /** 0停用/1启用 */
  enabled: number;
  /** 同商品内排序 */
  sortNo: number;
}

/** 商品 admin VO（与 GzOrdProductAdminVO.java 对齐） */
export interface GzOrdProductVO {
  /** 商品主键（string） */
  id: string;
  /** 业务码 PRD-yyyyMMdd-6位序号（只读） */
  productNo: string;
  /** 商品名 */
  name: string;
  /** 主图 file_id（string） */
  mainImageId?: string | null;
  /** 图集 逗号分隔 file_id */
  galleryImageIds?: string | null;
  /** 商品详情富文本 HTML（详情才返回；列表不投影） */
  descriptionHtml?: string | null;
  /** IP/作品标签 */
  ipTag?: string | null;
  /** 预订截止时间 */
  deadlineTime: string;
  /** 模糊到货日 */
  deliveryDateText?: string | null;
  /** 精确到货日 */
  deliveryDateExact?: string | null;
  /** 状态 on_shelf/off_shelf/auto_off */
  status: string;
  /** 销量 */
  salesCount: number;
  /** 同 IP 内排序 */
  sortNo: number;
  /** 乐观锁版本 */
  version?: number;
  /** 创建时间 */
  createTime?: string;
  /** 更新时间 */
  updateTime?: string;
  /** 备注 */
  remark?: string | null;
  /** SKU 列表（仅详情返回） */
  skuList?: GzOrdSkuVO[];
}

/** SKU 表单（与 GzOrdSkuBo.java 对齐） */
export interface GzOrdSkuForm {
  /** SKU 主键（编辑既有 SKU 传；新增空） */
  id?: string | null;
  specName: string;
  /** 单价（分） */
  priceCent: number;
  /** 总库存（null = 无限） */
  stockTotal?: number | null;
  /** 0停用/1启用 */
  enabled?: number;
  sortNo?: number;
}

/** 商品增改表单（与 GzOrdProductBo.java 对齐，含嵌套 SKU 列表） */
export interface GzOrdProductForm {
  id?: string | null;
  name?: string;
  mainImageId?: string | null;
  galleryImageIds?: string | null;
  descriptionHtml?: string;
  ipTag?: string | null;
  deadlineTime?: string;
  deliveryDateText?: string | null;
  deliveryDateExact?: string | null;
  sortNo?: number | null;
  remark?: string | null;
  skuList: GzOrdSkuForm[];
}

/** 查询参数（与 GzOrdProductQueryBo.java 对齐） */
export interface GzOrdProductQuery {
  name?: string;
  status?: string;
  ipTag?: string;
  pageNum?: number;
  pageSize?: number;
}

/** GET /list — 分页查询商品（status/ipTag/name 筛选；不含 SKU） */
export function listGzOrdProduct(query: GzOrdProductQuery): AxiosPromise<{ total: number; rows: GzOrdProductVO[] }> {
  return request({
    url: '/system/gz/ord/product/list',
    method: 'get',
    params: query
  });
}

/** GET /{id} — 商品详情（含 SKU 列表 + description_html） */
export function getGzOrdProduct(id: string | number): AxiosPromise<GzOrdProductVO> {
  return request({
    url: `/system/gz/ord/product/${id}`,
    method: 'get'
  });
}

/** POST / — 新建商品 + SKU（同事务，status=off_shelf） */
export function addGzOrdProduct(data: GzOrdProductForm) {
  return request({
    url: '/system/gz/ord/product',
    method: 'post',
    data
  });
}

/** PUT / — 编辑商品 + SKU diff */
export function updateGzOrdProduct(data: GzOrdProductForm) {
  return request({
    url: '/system/gz/ord/product',
    method: 'put',
    data
  });
}

/** PUT /changeStatus — 手动上下架（on_shelf ↔ off_shelf；auto_off 不可手动设） */
export function changeStatusGzOrdProduct(id: string | number, targetStatus: string) {
  return request({
    url: '/system/gz/ord/product/changeStatus',
    method: 'put',
    params: { id, targetStatus }
  });
}

/** DELETE /{ids} — 软删（del_flag=2；被订单引用拒删） */
export function delGzOrdProduct(ids: Array<string | number> | string | number) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({
    url: `/system/gz/ord/product/${idStr}`,
    method: 'delete'
  });
}
