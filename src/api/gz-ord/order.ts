/**
 * GZ-ORD-105 预购订单 admin 只读查询 API（admin 端）
 *
 * 后端路径：/system/gz/ord/order/*（GzOrdOrderController）
 * 权限：gz:ord:order:list（列表）/ gz:ord:order:query（详情）
 *
 * 字段权威：doc/11 §6.3 gz_ord_order + 附录 A.5（business_status）+ A.7（logistics_status）
 * 状态机：created/paid/cancelled/in_logistics/delivered/refunded（delivered = 终态无 closed）
 *
 * 本卡 admin 仅查询（只读）：物流推进 / 录单号 = GZ-ADMIN-104（下沉 mp），退款 = GZ-PAY-103。
 * 跨层契约 #1：所有 id 字段为 string。金额 totalAmountCent 分单位（前端 /100 显示元）。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** admin 订单列表查询参数 */
export interface GzOrdOrderQuery {
  /** 业务态精确（created/paid/cancelled/in_logistics/delivered/refunded） */
  businessStatus?: string;
  /** 用户手机号模糊 */
  userPhone?: string;
  /** 订单号模糊 */
  orderNo?: string;
  pageNum?: number;
  pageSize?: number;
}

/** admin 订单 VO（与 GzOrdOrderAdminVO.java 对齐） */
export interface GzOrdOrderVO {
  /** 订单主键（string） */
  id: string;
  /** 订单业务码 PREORD-yyyyMMdd-6位序号 */
  orderNo: string;
  /** 下单用户 id（string） */
  userId: string;
  /** 下单用户手机号（关联 gz_user；未绑定为 null） */
  userPhone?: string | null;
  /** 下单用户昵称 */
  userNickname?: string | null;
  /** 商品名（snapshot） */
  productName: string;
  /** 规格名（snapshot） */
  specName: string;
  /** 购买数量 */
  qty: number;
  /** 订单总额（分；前端 /100 显示元） */
  totalAmountCent: number;
  /** 业务态 */
  businessStatus: string;
  /** 业务态中文 label */
  businessStatusLabel: string;
  /** 物流态 in_japan/in_china_dispatching/delivered */
  logisticsStatus: string;
  /** 物流态中文 label */
  logisticsStatusLabel: string;
  /** 国内快递公司编码 */
  cnCarrierCode?: string | null;
  /** 国内快递公司中文名 */
  cnCarrierName?: string | null;
  /** 国内快递单号 */
  cnTrackingNo?: string | null;
  /** 收件人姓名（详情） */
  recipient?: string | null;
  /** 收件人手机号（详情） */
  recipientMobile?: string | null;
  /** 完整收货地址（详情） */
  fullAddress?: string | null;
  /** 用户下单备注 */
  userNote?: string | null;
  /** 支付时间 */
  paidTime?: string | null;
  /** 签收时间 */
  deliveredTime?: string | null;
  /** 取消时间 */
  cancelledTime?: string | null;
  /** 下单时间 */
  createTime: string;
}

/** GET /list — 分页查询预购订单（只读；businessStatus 精确 + userPhone 模糊 + orderNo 模糊） */
export function listGzOrdOrder(query: GzOrdOrderQuery): AxiosPromise<{ total: number; rows: GzOrdOrderVO[] }> {
  return request({
    url: '/system/gz/ord/order/list',
    method: 'get',
    params: query
  });
}

/** GET /{id} — 订单详情（只读；含 snapshot 解析 + 物流字段 + 用户手机号） */
export function getGzOrdOrder(id: string | number): AxiosPromise<GzOrdOrderVO> {
  return request({
    url: `/system/gz/ord/order/${id}`,
    method: 'get'
  });
}
