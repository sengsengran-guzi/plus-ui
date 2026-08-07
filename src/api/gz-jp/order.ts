/**
 * GZ-JP-109 拼团订单 API（admin 端，UI:admin.order）。
 *
 * 后端路径：/system/gz/jp/order/*
 * 权限：gz:jp:order:list（列表 + 详情共用，★ 只读页不拆第二个权限位）
 * 字段权威：doc/jp/authority/field-ssot.yaml 的 gz_jp_order / gz_jp_order_item 段
 *          ←→ GzJpOrderAdminVO.java、GzJpOrderAdminDetailVO.java、GzJpOrderQueryBo.java。
 *
 * 契约要点：
 *   - ★ 本模块【全只读】，没有 add / update / delete —— 订单的写路径在 mp 下单、GZ-PAY 支付回调、
 *     履约看板（/system/gz/jp/fulfill/advance|ship）三处。要改货的状态去履约看板，不在查单页。
 *   - ★ 与履约看板不同，本列表【不过滤付款状态】：created（待支付）/ cancelled（已取消）
 *     的订单必须出现（资金视角查单）。别照抄看板那道 isPaidLike 闸。
 *   - ID 一律 string（Java long ↔ JS number 精度丢失）；金额字段是「分」的整数，
 *     量级远低于 JS 安全整数，保持 number 便于直接做元/分换算。
 *   - 状态中文（businessStatusLabel / fulfillStatusLabel / refundStatusLabel）后端已给，
 *     前端不再维护第二份映射；列表里的状态标签色仍走 dict-tag（字典有 listClass）。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 订单状态（字典 gz_jp_order_status） */
export type GzJpOrderStatus = 'created' | 'paid' | 'cancelled' | 'partial_refunded' | 'refunded';

/** 履约状态（字典 gz_jp_fulfill_status；★ 状态挂商品行不挂订单） */
export type GzJpFulfillStatus = 'purchasing' | 'purchase_failed' | 'await_seller_ship' | 'jp_shipped' | 'customs' | 'cn_sorting' | 'delivered';

/** 行级退款状态（字典 gz_jp_refund_status） */
export type GzJpRefundStatus = 'refunding' | 'refunded' | 'refund_failed';

/** 收货地址快照（下单锁定的那份，不是地址簿当前值） */
export interface GzJpOrderAddress {
  recipient: string | null;
  mobile: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  detail: string | null;
}

/** 列表行 VO（与 GzJpOrderAdminVO.java 对齐） */
export interface GzJpOrderAdminVO {
  id: string;
  /** 订单号 JPO-yyyyMMdd-6位 */
  orderNo: string;
  userId: string;
  /** 客人昵称（为空时前端回落显示用户编号） */
  userNickname: string | null;
  userMobile: string | null;
  userNo: string | null;
  /** 款数 = 商品行数 */
  itemCount: number;
  /** 件数 = Σ qty */
  totalQty: number;
  /** 实付（分）★ 无运费项；未支付/已取消的单同样有金额但钱没到账，看 businessStatus */
  totalAmountCent: number;
  businessStatus: GzJpOrderStatus;
  businessStatusLabel: string;
  createTime: string;
  paidTime: string | null;
  cancelledTime: string | null;
}

/** 详情里的商品行（与 GzJpOrderAdminItemVO.java 对齐；★ 只读，无可操作字段） */
export interface GzJpOrderAdminItemVO {
  id: string;
  productId: string;
  /** 商品编号（下单快照） */
  productNo: string | null;
  /** 商品名（下单快照） */
  name: string | null;
  /** 主图 file id（下单快照）—— 用 <GzImageThumb :file-id> 渲染，后端不下发 URL */
  mainImageId: string | null;
  /** 所属场名（下单快照；★ 一单可跨多场） */
  eventName: string | null;
  deliveryDateText: string | null;
  /** 额外注意事项（下单快照；客人当时接受的条款） */
  noticeText: string | null;
  qty: number;
  unitPriceCent: number;
  amountCent: number;
  /** 来源（字典 gz_jp_item_source）：一期恒 batch */
  source: string | null;
  fulfillStatus: GzJpFulfillStatus;
  fulfillStatusLabel: string;
  carrierCode: string | null;
  /** 快递中文名（字典 gz_express_carrier；查不到为 null） */
  carrierLabel: string | null;
  /** 运单号 ★ 同单号即同包裹（本域不建包裹表） */
  trackingNo: string | null;
  shippedAt: string | null;
  refundStatus: GzJpRefundStatus | null;
  refundStatusLabel: string | null;
  refundAmountCent: number | null;
}

/** 详情 VO（与 GzJpOrderAdminDetailVO.java 对齐） */
export interface GzJpOrderAdminDetailVO {
  id: string;
  orderNo: string;
  totalAmountCent: number;
  businessStatus: GzJpOrderStatus;
  businessStatusLabel: string;
  itemCount: number;
  totalQty: number;
  createTime: string;
  paidTime: string | null;
  cancelledTime: string | null;
  /** 客人下单时填的备注 */
  userNote: string | null;
  /** 内部备注（★ 不下发 mp） */
  remark: string | null;
  userId: string;
  userNickname: string | null;
  userMobile: string | null;
  userNo: string | null;
  /** 支付流水行主键（未支付为 null） */
  payTransactionId: string | null;
  /** 商户订单号（微信商户后台搜这个对账） */
  outTradeNo: string | null;
  /** 微信支付交易号（未支付为 null） */
  wxTransactionId: string | null;
  /** 支付流水状态（与订单 businessStatus 是两套，异常时可对照排查） */
  payStatus: string | null;
  /** 通道手续费（分；未结算为 null） */
  payFeeCent: number | null;
  address: GzJpOrderAddress | null;
  items: GzJpOrderAdminItemVO[];
}

/** 列表查询参数（与 GzJpOrderQueryBo.java 对齐） */
export interface GzJpOrderQuery {
  /** 订单号【模糊】—— 客人电话里只报得出后几位 */
  orderNo?: string;
  /** 客人昵称 / openid 模糊；无匹配返回 total=0（不会退化成全量） */
  keyword?: string;
  /** 订单状态多选；非法值后端直接报错，不静默丢弃 */
  businessStatus?: GzJpOrderStatus[];
  /** 下单时间起（yyyy-MM-dd，含当日 00:00:00） */
  beginDate?: string;
  /** 下单时间止（yyyy-MM-dd，含当日 23:59:59） */
  endDate?: string;
  pageNum?: number;
  pageSize?: number;
}

/**
 * GET 订单列表（分页）。
 *
 * 泛型给<b>行元素数组</b>：src/types/axios.d.ts 把 AxiosResponse 增广成 `{ rows: T; total: number }`，
 * 拦截器又直接返回 ruoyi TableDataInfo body，所以调用方写 `res.rows` / `res.total`（★ 不是 res.data）。
 */
export function listGzJpOrder(query: GzJpOrderQuery): AxiosPromise<GzJpOrderAdminVO[]> {
  return request({ url: '/system/gz/jp/order/list', method: 'get', params: query });
}

/** GET 订单详情（订单头 + 逐行商品及履约状态 + 收货地址，全只读） */
export function getGzJpOrder(id: string): AxiosPromise<GzJpOrderAdminDetailVO> {
  return request({ url: `/system/gz/jp/order/${id}`, method: 'get' });
}
