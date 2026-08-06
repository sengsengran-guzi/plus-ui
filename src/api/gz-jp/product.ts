/**
 * GZ-JP-102 拼团商品 API（admin 端，UI:admin.product / FLOW:F-JP-01.step2）。
 *
 * 后端路径：/system/gz/jp/product/*
 * 权限：gz:jp:product:list / add / edit / remove（批量上下架复用 edit）
 * 字段权威：doc/jp/authority/field-ssot.yaml 的 gz_jp_product 段 / GzJpProductAdminVO.java、GzJpProductBo.java。
 *
 * 契约要点：
 *   - ID 一律 string（Java long ↔ JS number 精度丢失）；**金额 priceCent 例外**，是「分」的整数，
 *     量级远低于 JS 安全整数，保持 number 便于直接做元/分换算。
 *   - ★ 一期没有库存 / SKU 字段（REQ-PROD-007 —— 不同规格各上架一个商品），别自己加。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 商品状态（字典 gz_jp_product_status） */
export type GzJpProductStatus = 'on_shelf' | 'off_shelf';

/** 场生效状态（字典 gz_jp_event_status；读时惰性判定后的值） */
export type GzJpEventEffectiveStatus = 'draft' | 'open' | 'closed';

/** 场轻量选项（「按场筛选」下拉 + 表单所属场选择器） */
export interface GzJpEventOptionVO {
  id: string;
  eventNo: string;
  name: string;
  /** 生效状态（到 end_time 后即便库里还是 open 也返回 closed） */
  status: GzJpEventEffectiveStatus;
}

/** 商品 VO（与 GzJpProductAdminVO.java 对齐） */
export interface GzJpProductVO {
  id: string;
  /** 商品编号 JPP-yyyyMMdd-6位（系统生成，只读） */
  productNo: string;
  eventId: string;
  /** 所属场编号（场被删则 null） */
  eventNo: string | null;
  /** 所属场名称（场被删则 null） */
  eventName: string | null;
  /** 所属场生效状态（场被删则 null） */
  eventStatus: GzJpEventEffectiveStatus | null;
  name: string;
  /** 主图 file id（gz_file_object.id） */
  mainImageId: string;
  /** 图集 file id 列表 */
  galleryImageIds: string[];
  /** 售价（分）★ 全包邮，此价即客人最终支付价 */
  priceCent: number;
  deliveryDateText: string | null;
  /** 额外注意事项（REQ-PROD-005，下单前须显著展示） */
  noticeText: string | null;
  status: GzJpProductStatus;
  /** 客人此刻是否真看得到 = 商品 on_shelf 且场 open（派生，不落库） */
  visibleToCustomer: boolean;
  sortNo: number;
  version: number;
  createTime?: string;
  updateTime?: string;
  remark?: string | null;
}

/** 新增 / 编辑 BO（与 GzJpProductBo.java 对齐；productNo / status 不接受前端传入） */
export interface GzJpProductForm {
  id?: string | null;
  eventId?: string | null;
  name?: string;
  mainImageId?: string | null;
  galleryImageIds?: string[];
  /** 售价（分）—— 前端负责元→分换算 Math.round(yuan * 100)，后端只认整数分 */
  priceCent?: number | null;
  deliveryDateText?: string | null;
  noticeText?: string | null;
  sortNo?: number | null;
  remark?: string | null;
}

/** 列表查询参数（与 GzJpProductQueryBo.java 对齐） */
export interface GzJpProductQuery {
  eventId?: string | '';
  productNo?: string;
  name?: string;
  status?: GzJpProductStatus | '';
  pageNum?: number;
  pageSize?: number;
}

/**
 * GET 列表（分页）。
 *
 * 泛型给<b>行元素数组</b>：src/types/axios.d.ts 把 AxiosResponse 增广成 `{ rows: T; total: number }`，
 * 拦截器又直接返回 ruoyi TableDataInfo body，所以调用方写 `res.rows` / `res.total` 即可。
 */
export function listGzJpProduct(query: GzJpProductQuery): AxiosPromise<GzJpProductVO[]> {
  return request({ url: '/system/gz/jp/product/list', method: 'get', params: query });
}

/** GET 场下拉选项（挂商品权限，不依赖场权限） */
export function listGzJpEventOptions(): AxiosPromise<GzJpEventOptionVO[]> {
  return request({ url: '/system/gz/jp/product/event-options', method: 'get' });
}

/** GET 详情（编辑回填） */
export function getGzJpProduct(id: string): AxiosPromise<GzJpProductVO> {
  return request({ url: `/system/gz/jp/product/${id}`, method: 'get' });
}

/** POST 新建（status 固定 off_shelf，需显式上架） */
export function addGzJpProduct(data: GzJpProductForm) {
  return request({ url: '/system/gz/jp/product', method: 'post', data });
}

/** PUT 编辑（productNo / status 后端忽略） */
export function updateGzJpProduct(data: GzJpProductForm) {
  return request({ url: '/system/gz/jp/product', method: 'put', data });
}

/** POST 批量上下架 —— 返回实际改动条数（已是目标态的项被跳过，不计入） */
export function changeGzJpProductStatus(ids: string[], status: GzJpProductStatus): AxiosPromise<number> {
  return request({ url: '/system/gz/jp/product/status', method: 'post', data: { ids, status } });
}

/** DELETE 软删（已上架的商品需先下架） */
export function delGzJpProduct(ids: Array<string> | string) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({ url: `/system/gz/jp/product/${idStr}`, method: 'delete' });
}
