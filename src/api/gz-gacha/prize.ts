/**
 * GZ-GACHA-101 / GZ-GACHA-112 奖品池（投放线）admin CRUD API（admin 端）
 *
 * 后端路径：/system/gz/gacha/prize/*
 * 权限：gz:gacha:prize:list / query / add / edit / remove
 *
 * 字段权威：doc/11 §7.2 gz_gacha_prize · ADR-0013 §2（改造为「机器×产品投放线」）
 * 投放线承载（每台独立）：rarity / weight / stock / enabled；产品固有属性（名/图/参考价）
 * 来自产品库 gz_gacha_product（join 取值，见 product.ts）。新增/编辑改为「选产品（productId）」。
 * 稀有度：SSR / SR / R / N 四档（字典 gz_gacha_rarity，按机器可调，仅展示不影响抽奖事务）。
 *
 * 跨层契约 #1：所有 id 字段为 string。金额 referenceValueCent 分单位（前端 /100 显示元）。
 * 权重 weight 原始整数，仅后台驱动抽奖归一化，不对 C 端展示（ADR-0013）。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 奖品投放线 admin VO（与 GzGachaPrizeVo.java 对齐；name/imageId/referenceValueCent 来自 join 产品库） */
export interface GzGachaPrizeVO {
  /** 投放线主键（string） */
  id: string;
  /** 归属机器 id（string） */
  machineId: string;
  /** 产品 id（string；join 产品库） */
  productId: string;
  /** 业务码 PRZ-yyyyMMdd-6位序号（只读） */
  prizeNo: string;
  /** 产品名（join 产品库，展示用） */
  productName?: string | null;
  /** 产品图 file_id（string；join 产品库，展示用） */
  imageId?: string | null;
  /** 稀有度 SSR/SR/R/N（投放线本身，按机器可调） */
  rarity: string;
  /** 概率权重整数（投放线本身） */
  weight: number;
  /** 初始库存（投放线本身） */
  stockInitial: number;
  /** 剩余库存（投放线本身） */
  stockRemain: number;
  /** 公示参考价（分，null = 不显示；join 产品库） */
  referenceValueCent?: number | null;
  /** 0临时下架/1参与抽奖（投放线本身） */
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

/** 奖品投放线增改表单（与 GzGachaPrizeBo.java 对齐） */
export interface GzGachaPrizeForm {
  id?: string | null;
  /** 归属机器 id（新增必传，编辑不可改） */
  machineId?: string | null;
  /** 产品 id（新增必传，编辑不可改；从产品库选） */
  productId?: string | null;
  rarity?: string;
  weight?: number;
  stockInitial?: number;
  /** 剩余库存（新增可空→默认=stockInitial） */
  stockRemain?: number | null;
  enabled?: number;
  remark?: string | null;
}

/** 查询参数（与 GzGachaPrizeQueryBo.java 对齐） */
export interface GzGachaPrizeQuery {
  /** 归属机器 id（查某机器奖品池） */
  machineId?: string | number;
  /** 产品名模糊（后端先匹配产品名→productId 再过滤线） */
  name?: string;
  rarity?: string;
  enabled?: number;
  pageNum?: number;
  pageSize?: number;
}

/** GET /list — 分页查询投放线（machineId 过滤 + rarity/enabled/name 筛选） */
export function listGzGachaPrize(query: GzGachaPrizeQuery): AxiosPromise<{ total: number; rows: GzGachaPrizeVO[] }> {
  return request({
    url: '/system/gz/gacha/prize/list',
    method: 'get',
    params: query
  });
}

/** GET /{id} — 投放线详情 */
export function getGzGachaPrize(id: string | number): AxiosPromise<GzGachaPrizeVO> {
  return request({
    url: `/system/gz/gacha/prize/${id}`,
    method: 'get'
  });
}

/** POST / — 新建投放线（选产品；prize_no 系统生成；stockRemain 空默认=stockInitial） */
export function addGzGachaPrize(data: GzGachaPrizeForm) {
  return request({
    url: '/system/gz/gacha/prize',
    method: 'post',
    data
  });
}

/** PUT / — 编辑投放线（prize_no/machineId/productId 不可改） */
export function updateGzGachaPrize(data: GzGachaPrizeForm) {
  return request({
    url: '/system/gz/gacha/prize',
    method: 'put',
    data
  });
}

/** DELETE /{ids} — 软删（del_flag=2） */
export function delGzGachaPrize(ids: Array<string | number> | string | number) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({
    url: `/system/gz/gacha/prize/${idStr}`,
    method: 'delete'
  });
}
