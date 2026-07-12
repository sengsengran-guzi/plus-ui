/**
 * GZ-RECYCLE-003 回收预约单 API（admin 端）。
 *
 * 后端路径：/system/gz/recycle/appointment/*
 * 权限：gz:recycle:appointment:list（列表/详情）/ gz:recycle:appointment:payout（失败重试）
 * 字段权威：契约 15a §E.2 GzRecycleAppointmentAdminVO（全量 + 转账段）/ §B.2 GzRecycleProductVO（单对象）。
 * ID 跨层契约 #1：所有 id 字段 string；金额 _cent（展示 / 100）。
 *
 * V1.2 去估价：estimatedAmountCent / totalQty 新单为 null（旧单保留历史值）；product 由数组改单对象。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/**
 * 回收物品对象 VO（product_snapshot_json 反序列化，单份多选对象，契约 15a §B.2）。
 * 兼容旧数组数据：后端 parseProducts 已将旧数组投影为本对象（categories/customIps 去重、qtyBucket* 为 null）。
 */
export interface RecycleProductVO {
  /** 品类多选（字典 gz_recycle_category value） */
  categories?: string[] | null;
  /** 主数据 IP id 快照（string） */
  ipIds?: string[] | null;
  /** IP 中文名快照（admin 免再 join） */
  ipNames?: string[] | null;
  /** 用户自定义 IP 文本 */
  customIps?: string[] | null;
  /** 数量桶 code（旧数据无桶时 null） */
  qtyBucketCode?: string | null;
  /** 数量桶展示文案快照（如 25-50 件；旧数据 null） */
  qtyBucketLabel?: string | null;
}

/**
 * 回收预约单 admin 全量 VO（与 GzRecycleAppointmentAdminVO.java 对齐，契约 15a §E.2）。
 * 含提交段 + 复核段 + 转账段（admin 全字段可见）。
 */
export interface GzRecycleAppointmentVO {
  /* 提交段 */
  id: string;
  appointmentNo: string;
  userId: string;
  storeId: string;
  /** 门店名（join gz_bean_store） */
  storeName?: string | null;
  /** 回收物品对象（单对象；兼容旧数组已由后端投影） */
  product?: RecycleProductVO | null;
  /** 总件数（旧单历史值；新单 null——无精确件数） */
  totalQty?: number | null;
  /** 预计回收时长（分钟，来自命中数量桶；旧单 Σ 历史值） */
  matchedDurationMinutes?: number | null;
  /** 自动估价金额（分，旧单历史值；新单 null——去估价） */
  estimatedAmountCent?: number | null;
  /** 到店档 morning / afternoon（旧单可能 null） */
  arrivalSlot?: string | null;
  apptDate: string;
  slotStart: string;
  slotEnd: string;
  /** 用户提交实物照 file id 列表（string；旧 submitImageIds 已统一改名 imageIds） */
  imageIds?: string[] | null;
  /** submitted / confirmed_onsite / paying / paid / cancelled / no_show / payout_failed（gz_recycle_status 字典） */
  status: string;
  createTime?: string;
  remark?: string | null;

  /* 复核段（全量） */
  /** 店员核对存证照 file id 列表（submitted 时空） */
  verifyImageIds?: string[] | null;
  /** 店员核对最终金额（分）；submitted 时 null */
  finalAmountCent?: number | null;
  /** 核对店员 admin 用户名（留痕） */
  verifiedBy?: string | null;
  /** 核对时间（留痕） */
  verifyTime?: string | null;
  /** 核销备注（GZ-RECYCLE-009，店员核对时填） */
  verifyRemark?: string | null;
  mobileSnapshot?: string | null;
  wechatIdSnapshot?: string | null;

  /* 转账段（全量，拉 gz_pay_payout_transaction） */
  /** 关联反向打款单号 */
  outPayoutNo?: string | null;
  /** 反向打款真实状态 created/processing/success/failed/cancelled（无打款单时 null） */
  payoutStatus?: string | null;
  /** 到账时间（success 时有值） */
  transferredTime?: string | null;
  /** 实际打款金额（分，= payout.amount_cent） */
  payoutAmountCent?: number | null;
  /** 打款失败原因（failed 时有值，admin 可见、顾客不露） */
  failReason?: string | null;
}

/** 回收预约单查询条件 */
export interface GzRecycleAppointmentQuery {
  pageNum?: number;
  pageSize?: number;
  storeId?: string | number;
  status?: string;
  appointmentNo?: string;
  apptDateStart?: string;
  apptDateEnd?: string;
  /** 点数档编码（回收看板记录区按点数档筛选，GZ-RECYCLE-008） */
  qtyBucketCode?: string;
  /** 实付金额下限（分，含） */
  finalAmountCentMin?: number;
  /** 实付金额上限（分，含） */
  finalAmountCentMax?: number;
}

/** 分页列表 */
export function listAppointment(query: GzRecycleAppointmentQuery): AxiosPromise<GzRecycleAppointmentVO[]> {
  return request({ url: '/system/gz/recycle/appointment/list', method: 'get', params: query });
}

/** 详情 */
export function getAppointment(id: string): AxiosPromise<GzRecycleAppointmentVO> {
  return request({ url: `/system/gz/recycle/appointment/${id}`, method: 'get' });
}

/** 打款失败重试（owner，仅 payout_failed 单） */
export function retryAppointmentPayout(id: string): AxiosPromise<GzRecycleAppointmentVO> {
  return request({ url: `/system/gz/recycle/appointment/${id}/retry-payout`, method: 'post' });
}

/** admin 核销确认 + 触发反向打款（GZ-RECYCLE-009；复用与 mp 店员同一 verifyAndPayout，仅 submitted 单可核销） */
export function verifyAppointment(
  id: string,
  data: { verifyImageIds: number[]; finalAmountCent: number; remark?: string }
): AxiosPromise<GzRecycleAppointmentVO> {
  return request({ url: `/system/gz/recycle/appointment/${id}/verify`, method: 'post', data });
}
