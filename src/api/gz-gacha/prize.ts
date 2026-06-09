/**
 * GZ-GACHA-101 奖品池 admin CRUD API（admin 端）
 *
 * 后端路径：/system/gz/gacha/prize/*
 * 权限：gz:gacha:prize:list / query / add / edit / remove
 *
 * 字段权威：doc/11 §7.2 gz_gacha_prize
 * 稀有度：SSR / SR / R / N 四档（字典 gz_gacha_rarity，仅展示不影响抽奖事务）
 *
 * 跨层契约 #1：所有 id 字段为 string。金额 referenceValueCent 分单位（前端 /100 显示元）。
 * 权重 weight 原始整数，「实时归一化概率」由 GACHA-103 mp 端算，admin 仅展示权重。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 奖品 admin VO（与 GzGachaPrizeVo.java 对齐） */
export interface GzGachaPrizeVO {
  /** 奖品主键（string） */
  id: string;
  /** 归属机器 id（string） */
  machineId: string;
  /** 业务码 PRZ-yyyyMMdd-6位序号（只读） */
  prizeNo: string;
  /** 奖品名 */
  name: string;
  /** 奖品图 file_id（string） */
  imageId?: string | null;
  /** 稀有度 SSR/SR/R/N */
  rarity: string;
  /** 概率权重整数 */
  weight: number;
  /** 初始库存 */
  stockInitial: number;
  /** 剩余库存 */
  stockRemain: number;
  /** 公示参考价（分，null = 不显示） */
  referenceValueCent?: number | null;
  /** 0临时下架/1参与抽奖 */
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

/** 奖品增改表单（与 GzGachaPrizeBo.java 对齐） */
export interface GzGachaPrizeForm {
  id?: string | null;
  /** 归属机器 id（新增必传） */
  machineId?: string | null;
  name?: string;
  imageId?: string | null;
  rarity?: string;
  weight?: number;
  stockInitial?: number;
  /** 剩余库存（新增可空→默认=stockInitial） */
  stockRemain?: number | null;
  /** 公示参考价（分，可空） */
  referenceValueCent?: number | null;
  enabled?: number;
  remark?: string | null;
}

/** 查询参数（与 GzGachaPrizeQueryBo.java 对齐） */
export interface GzGachaPrizeQuery {
  /** 归属机器 id（查某机器奖品池） */
  machineId?: string | number;
  name?: string;
  rarity?: string;
  enabled?: number;
  pageNum?: number;
  pageSize?: number;
}

/** GET /list — 分页查询奖品（machineId 过滤 + rarity/enabled/name 筛选） */
export function listGzGachaPrize(query: GzGachaPrizeQuery): AxiosPromise<{ total: number; rows: GzGachaPrizeVO[] }> {
  return request({
    url: '/system/gz/gacha/prize/list',
    method: 'get',
    params: query
  });
}

/** GET /{id} — 奖品详情 */
export function getGzGachaPrize(id: string | number): AxiosPromise<GzGachaPrizeVO> {
  return request({
    url: `/system/gz/gacha/prize/${id}`,
    method: 'get'
  });
}

/** POST / — 新建奖品（prize_no 系统生成；stockRemain 空默认=stockInitial） */
export function addGzGachaPrize(data: GzGachaPrizeForm) {
  return request({
    url: '/system/gz/gacha/prize',
    method: 'post',
    data
  });
}

/** PUT / — 编辑奖品（prize_no/machineId 不可改） */
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
