/**
 * GZ-ADMIN-103 三类聚合订单管理 API（admin 端）
 *
 * 后端路径：/system/gz/ord/orders/*（GzOrdOrdersController）
 * 权限：gz:ord:orders:list（列表）/ gz:ord:orders:query（详情）
 *
 * 聚合口径（doc/11 §8.1）：以 gz_pay_transaction 为分页主表（含 test 单），按 business_type
 * 回查 gz_ord_order（preorder）/ gz_gacha_order（gacha）补明细，映射统一 GzUnifiedOrderVo。
 *
 * 跨层契约 #1：所有 id 字段为 string（transactionId / userId）。金额 amountCent 分单位（前端 /100 元）。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** admin 三类聚合订单查询参数（AC2） */
export interface GzUnifiedOrderQuery {
  /** 业务类型 preorder/gacha/test（空 = 全部） */
  businessType?: string;
  /** 业务状态统一 chip（to_pay/to_ship/shipping/done/cancelled/refunded） */
  businessStatus?: string;
  /** 物流状态 in_japan/in_china_dispatching/delivered */
  logisticsStatus?: string;
  /** 用户关键词（昵称 / openid 模糊） */
  userKeyword?: string;
  /** 订单号（business_order_no 前缀 / 精确） */
  orderNo?: string;
  /** 时间范围起（按 paid_time / create_time） */
  startTime?: string;
  /** 时间范围止 */
  endTime?: string;
  pageNum?: number;
  pageSize?: number;
}

/** 统一订单 VO（与后端 GzUnifiedOrderVo.java 对齐 doc/11 §8.1） */
export interface GzUnifiedOrderVO {
  /** 支付交易行主键（= gz_pay_transaction.id；退款按此 id 调 PAY-103，string） */
  transactionId: string;
  /** 支付订单号 out_trade_no */
  outTradeNo: string;
  /** 业务订单号 business_order_no（test 单为 null） */
  businessOrderNo?: string | null;
  /** 业务类型 preorder/gacha/test */
  businessType: string;
  /** 业务类型中文 label */
  businessTypeLabel: string;
  /** 支付金额（分；前端 /100 元） */
  amountCent: number;
  /** 支付状态 created/pending/paid/timeout/closed/failed/refunding/refunded */
  payStatus: string;
  /** 支付时间 */
  paidTime?: string | null;
  /** 下单用户 id（test 单可空，string） */
  userId?: string | null;
  /** 用户昵称（test 单可空） */
  userNickname?: string | null;
  /** 用户 openid（test 单可空） */
  openid?: string | null;
  /** 业务态落库值 */
  businessStatus?: string | null;
  /** 统一 chip code */
  chipStatus?: string | null;
  /** 统一 chip 中文 label */
  chipLabel?: string | null;
  /** 物流态 in_japan/in_china_dispatching/delivered */
  logisticsStatus?: string | null;
  /** 物流态中文 label */
  logisticsStatusLabel?: string | null;
  /** 国内快递公司编码 */
  cnCarrierCode?: string | null;
  /** 国内快递公司中文名 */
  cnCarrierName?: string | null;
  /** 国内快递单号 */
  cnTrackingNo?: string | null;
  /** 签收时间 */
  deliveredTime?: string | null;
  /** 取消时间（preorder 专有） */
  cancelledTime?: string | null;
  /** 收件人姓名 */
  recipient?: string | null;
  /** 收件人手机号 */
  recipientMobile?: string | null;
  /** 完整收货地址 */
  fullAddress?: string | null;
  // ---- preorder 差异块 ----
  /** 商品名 */
  productName?: string | null;
  /** 商品主图签名 URL */
  productImageUrl?: string | null;
  /** SKU 规格名 */
  specName?: string | null;
  /** IP 标签 */
  ipTag?: string | null;
  /** 到货日文案 */
  deliveryDateText?: string | null;
  /** 精确到货日 */
  deliveryDateExact?: string | null;
  /** 购买数量 */
  qty?: number | null;
  // ---- gacha 差异块（盲盒语义：获得物 / 出现概率） ----
  /** 获得物名 */
  prizeName?: string | null;
  /** 获得物图签名 URL */
  prizeImageUrl?: string | null;
  /** 稀有度 SSR/SR/R/N */
  rarity?: string | null;
  /** 来源扭蛋机名 */
  machineName?: string | null;
  /** 创建时间（列表倒序锚点） */
  createdAt: string;
}

/** GET /list — 三类聚合订单分页列表 */
export function listUnifiedOrder(query: GzUnifiedOrderQuery): AxiosPromise<{ total: number; rows: GzUnifiedOrderVO[] }> {
  return request({
    url: '/system/gz/ord/orders/list',
    method: 'get',
    params: query
  });
}

/** GET /{transactionId} — 订单详情（含 snapshot 差异块 + 地址 + 物流） */
export function getUnifiedOrder(transactionId: string): AxiosPromise<GzUnifiedOrderVO> {
  return request({
    url: `/system/gz/ord/orders/${transactionId}`,
    method: 'get'
  });
}
