/**
 * GZ-JP-108 拼团履约看板 API（admin 端，UI:admin.fulfill_board）。
 *
 * 后端路径：/system/gz/jp/fulfill/*（GZ-JP-106 + GZ-JP-107）与 /system/gz/jp/refund/*（GZ-JP-107）
 * 权限：gz:jp:fulfill:{list,advance,ship,markFailed} / gz:jp:refund:{list,retry}
 *      —— 菜单与按钮位由本卡迁移 V202608071157__GZ-JP-108-seed-menu.sql seed（14030 段）。
 * 字段权威：GzJpFulfillBoardItemVO.java / GzJpFulfillBatchResultVO.java /
 *          GzJpMarkFailedResultVO.java / GzJpRefundAdminVO.java。
 *
 * 契约要点（踩过的坑，改这个文件前先看）：
 *   - ★ 列表读 `res.rows`（ruoyi TableDataInfo）不是 `res.data`。D16 逮到过 6 处这类 bug。
 *   - ★ 看板【只出付过款订单】的行，这道闸在后端服务层写死不可关。查不到的单多半是没付成功，
 *     去「订单管理」（GZ-JP-109）查 —— 两页口径不同是设计意图。
 *   - ★ 行 = 订单商品行（gz_jp_order_item.id），不是订单。批量接口传的 itemIds 就是它。
 *   - ID 一律 string（Java long ↔ JS number 精度丢失）；金额是「分」的整数。
 *   - 状态中文（fulfillStatusLabel / refundStatusLabel / carrierLabel）后端已给，前端不维护第二份映射。
 *   - ★ 别用两次完全一样的 body 连发同一个 POST：后端 @RepeatSubmit 会返回 500「不允许重复提交」。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 履约状态（字典 gz_jp_fulfill_status；★ 状态挂商品行不挂订单） */
export type GzJpFulfillStatus = 'purchasing' | 'purchase_failed' | 'await_seller_ship' | 'jp_shipped' | 'customs' | 'cn_sorting' | 'delivered';

/** 行级退款状态（字典 gz_jp_refund_status） */
export type GzJpRefundStatus = 'refunding' | 'refunded' | 'refund_failed';

/**
 * 「批量推进」下拉里【不能出现】的两个状态：
 *   purchasing  —— 链条起点，推它必被后端拒（BACKWARD）
 *   delivered   —— 必须走「批量发货」（要填运单号），用 advance 推会被 4109 拒
 */
export const ADVANCE_EXCLUDED_STATUS: GzJpFulfillStatus[] = ['purchasing', 'delivered'];

/** 终态（后端 `terminal` 字段的口径，前端仅用于文案判断，勾选可用性以 `terminal` 为准） */
export const TERMINAL_STATUS: GzJpFulfillStatus[] = ['delivered', 'purchase_failed'];

/** 看板一行 = 一个订单商品行（与 GzJpFulfillBoardItemVO.java 对齐） */
export interface GzJpFulfillBoardItemVO {
  /** 订单商品行 id —— ★ 批量接口传的就是它 */
  id: string;
  orderId: string;
  /** 所属订单号（一个客人可跨多张订单凑同一个包裹） */
  orderNo: string;
  /** 订单资金状态（paid / partial_refunded / refunded） */
  businessStatus: string;
  /** ★ 前端按它断组（后端已按 user_id → order_id → id 聚簇排序） */
  userId: string;
  userNickname: string | null;
  userMobile: string | null;
  userNo: string | null;
  productId: string;
  /** 商品编号（下单快照） */
  productNo: string | null;
  /** 商品名（下单快照；商品改名/删除不影响看板） */
  name: string | null;
  /** 所属场名（下单快照） */
  eventName: string | null;
  qty: number;
  unitPriceCent: number;
  /** 行金额（分）—— 行级退款按此金额退 */
  amountCent: number;
  fulfillStatus: GzJpFulfillStatus;
  fulfillStatusLabel: string;
  /** 是否终态（delivered / purchase_failed）—— 前端据此禁掉该行勾选 */
  terminal: boolean;
  carrierCode: string | null;
  /** 快递中文名（字典 gz_express_carrier；查不到为 null） */
  carrierLabel: string | null;
  /** 运单号 ★ 同单号即同包裹（本域不建包裹表） */
  trackingNo: string | null;
  shippedAt: string | null;
  refundStatus: GzJpRefundStatus | null;
  refundStatusLabel: string | null;
  refundAmountCent: number | null;
  orderCreateTime: string;
  paidTime: string | null;
}

/** 看板筛选（与 GzJpFulfillQueryBo.java 对齐；全部可选） */
export interface GzJpFulfillQuery {
  /** 精确客人（gz_user.id）；与 keyword 同时给取交集 */
  userId?: string;
  /** 客人模糊（昵称 / 手机号 / 用户编号）；无匹配返回 total=0，不会退化成全量 */
  keyword?: string;
  /** 履约状态多选；★ 非法值后端直接报错不静默丢弃 */
  fulfillStatus?: GzJpFulfillStatus[];
  /** 所属场（按商品反查） */
  eventId?: string;
  /** 订单号【精确】—— 与订单管理页的模糊匹配不同 */
  orderNo?: string;
  /** 运单号【精确】—— 按包裹回看这一票发了哪些行 */
  trackingNo?: string;
  /** 下单时间起（yyyy-MM-dd，含当日 00:00:00） */
  beginDate?: string;
  /** 下单时间止（yyyy-MM-dd，含当日 23:59:59） */
  endDate?: string;
  pageNum?: number;
  pageSize?: number;
}

/** 被拒的一行（advance / ship / mark-failed 共用） */
export interface GzJpFulfillRejectVO {
  itemId: string;
  currentStatus: string;
  currentStatusLabel: string;
  /** NOT_FOUND / ORDER_UNPAID / TERMINAL / BACKWARD / ILLEGAL_TARGET / UNKNOWN_CURRENT / SHIP_REQUIRED */
  reasonCode: string;
  /** 人话原因，直接显示给店员 */
  reason: string;
}

/**
 * 批量推进 / 批量发货的结果（与 GzJpFulfillBatchResultVO.java 对齐）。
 *
 * ★ 部分成功语义：能推的推掉，推不动的逐行给原因。
 *   advanced>0            → 成功（rejects 非空时把那几行的原因显示出来）
 *   advanced=0 && skipped>0 → 全部已是目标态（同事刚推过），不算失败，刷新列表即可
 *   一行都推不动           → 后端抛 4108，走 axios 错误分支，不会进到这里
 */
export interface GzJpFulfillBatchResultVO {
  targetStatus: string;
  targetStatusLabel: string;
  /** 去重后的请求行数 */
  requested: number;
  /** 真正改动的行数 */
  advanced: number;
  /** 已是目标态、无需改动（幂等跳过，不算失败） */
  skipped: number;
  rejected: number;
  /** 仅 /ship */
  carrierCode: string | null;
  carrierLabel: string | null;
  trackingNo: string | null;
  rejects: GzJpFulfillRejectVO[];
}

/** 标记购买失败时逐行的退款明细（与 GzJpRefundLineVO.java 对齐） */
export interface GzJpRefundLineVO {
  itemId: string;
  refundId: string | null;
  refundNo: string | null;
  refundAmountCent: number | null;
  refundStatus: GzJpRefundStatus | null;
  refundStatusLabel: string | null;
  /** 微信是否受理（受理 ≠ 到账，到账以回调为准） */
  accepted: boolean | null;
  /** 受理失败原因 */
  failReason: string | null;
  skipReasonCode: string | null;
  skipReason: string | null;
}

/**
 * 批量标记购买失败的结果（与 GzJpMarkFailedResultVO.java 对齐）。
 *
 * ★ 两组计数【必须分开显示】：履约侧（状态标没标上）与退款侧（钱退没退）是两条独立的轴。
 *   合成一句「成功 N 行」会掩盖最危险的情况 —— 状态标成功了但退款失败了
 *   （客人看到「购买失败」却没收到钱）。
 */
export interface GzJpMarkFailedResultVO {
  // 履约侧
  requested: number;
  markedFailed: number;
  /** 本来就已经是 purchase_failed（状态没动，但仍会检查有没有退过款 → 缺则补建） */
  alreadyFailed: number;
  rejected: number;
  rejects: GzJpFulfillRejectVO[];
  // 退款侧
  refundsCreated: number;
  /** 被微信受理（等异步回调定终态） */
  refundsAccepted: number;
  /** ★ 受理被拒（已落 refund_failed，可在退款单抽屉里重试） */
  refundsFailed: number;
  /** 没有发起新退款（之前已退 / 正在退 / 上次失败待人工重试） */
  refundsSkipped: number;
  refundAmountCentTotal: number;
  refunds: GzJpRefundLineVO[];
}

/** 退款单一行（与 GzJpRefundAdminVO.java 对齐） */
export interface GzJpRefundAdminVO {
  id: string;
  /** 商户退款单号 JPRF-yyyyMMdd-6位（= 微信 out_refund_no） */
  refundNo: string;
  orderId: string;
  orderNo: string;
  businessStatus: string;
  businessStatusLabel: string;
  orderItemId: string;
  userId: string;
  userNickname: string | null;
  userMobile: string | null;
  userNo: string | null;
  outTradeNo: string | null;
  /** ★ 本次退款金额（分）= 该行 amount_cent，不是整单 */
  refundAmountCent: number;
  /** 原支付单总额（分）—— 与退款额不等即说明这是部分退款 */
  totalAmountCent: number;
  wechatRefundId: string | null;
  status: GzJpRefundStatus;
  statusLabel: string;
  reason: string | null;
  /** ★ 失败原因，直接显示在列表里别藏进详情 */
  failReason: string | null;
  attemptCount: number;
  triggeredBy: string | null;
  triggeredTime: string | null;
  refundedTime: string | null;
  /** ★ 后端算好，前端别自己判状态 */
  retryable: boolean;
}

/** 退款单筛选（与 GzJpRefundQueryBo.java 对齐） */
export interface GzJpRefundQuery {
  /** refunding / refunded / refund_failed；★ 非法值后端直接报错 */
  status?: GzJpRefundStatus | '';
  orderNo?: string;
  userId?: string;
  keyword?: string;
  beginDate?: string;
  endDate?: string;
  pageNum?: number;
  pageSize?: number;
}

/**
 * GET 履约看板列表（分页）。
 *
 * 泛型给<b>行元素数组</b>：src/types/axios.d.ts 把 AxiosResponse 增广成 `{ rows: T; total: number }`，
 * 拦截器又直接返回 ruoyi TableDataInfo body，所以调用方写 `res.rows` / `res.total`（★ 不是 res.data）。
 *
 * ★ 分页是按【商品行】计的，分组在前端做。同一客人的行在后端已聚簇相邻，
 *   但仍可能跨页断开 —— 后端对「同客人分两次往同一包裹补行」是放行的，所以断页不会造成坏数据。
 */
export function listGzJpFulfill(query: GzJpFulfillQuery): AxiosPromise<GzJpFulfillBoardItemVO[]> {
  return request({ url: '/system/gz/jp/fulfill/list', method: 'get', params: query });
}

/**
 * POST 批量推进履约状态。
 *
 * ★ 允许跳过中间态（现货可 purchasing → jp_shipped）；不可回退；终态不可再动。
 * ★ targetStatus 不能传 delivered（后端 4109），要发货用 {@link shipGzJpFulfill}。
 */
export function advanceGzJpFulfill(data: { itemIds: string[]; targetStatus: GzJpFulfillStatus }): AxiosPromise<GzJpFulfillBatchResultVO> {
  return request({ url: '/system/gz/jp/fulfill/advance', method: 'post', data });
}

/**
 * POST 批量发货（一批行置「发货完毕」并共用一个运单号）。
 *
 * ★ 勾选行必须属于【同一个客人】（一个包裹只有一个收件人），否则后端 4110。
 *   前端在跨客人勾选时就把按钮置灰，不等后端报错。
 */
export function shipGzJpFulfill(data: { itemIds: string[]; carrierCode: string; trackingNo: string }): AxiosPromise<GzJpFulfillBatchResultVO> {
  return request({ url: '/system/gz/jp/fulfill/ship', method: 'post', data });
}

/**
 * POST 批量标记购买失败 → 按【行金额】发起微信真实退款。
 *
 * ⚠️ 这个接口会花钱且不可逆，调用前必须二次确认并显示将退的金额。
 */
export function markFailedGzJpFulfill(data: { itemIds: string[]; reason?: string }): AxiosPromise<GzJpMarkFailedResultVO> {
  return request({ url: '/system/gz/jp/fulfill/mark-failed', method: 'post', data });
}

/** GET 退款单列表（★ 后端把 refund_failed 排最前，前端不要按时间倒序覆盖） */
export function listGzJpRefund(query: GzJpRefundQuery): AxiosPromise<GzJpRefundAdminVO[]> {
  return request({ url: '/system/gz/jp/refund/list', method: 'get', params: query });
}

/** POST 重新发起一笔退款（复用同一个 refund_no，微信按 out_refund_no 幂等） */
export function retryGzJpRefund(refundId: string): AxiosPromise<GzJpRefundAdminVO> {
  return request({ url: `/system/gz/jp/refund/${refundId}/retry`, method: 'post' });
}
