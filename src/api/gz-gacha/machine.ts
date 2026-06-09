/**
 * GZ-GACHA-101 扭蛋机 admin CRUD API（admin 端）
 *
 * 后端路径：/system/gz/gacha/machine/*
 * 权限：gz:gacha:machine:list / query / add / edit / remove
 *
 * 字段权威：doc/11 §7.1 gz_gacha_machine
 * 状态机：on_shelf / off_shelf / auto_off（auto_off 仅 GACHA-104/cron，admin 不可手动设）
 *
 * 跨层契约 #1：所有 id 字段为 string（避免 JS long 精度丢失）。金额 *_cent 分单位（前端 /100 显示元）。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 扭蛋机 admin VO（与 GzGachaMachineVo.java 对齐） */
export interface GzGachaMachineVO {
  /** 机器主键（string） */
  id: string;
  /** 业务码 GM-yyyyMMdd-6位序号（只读） */
  machineNo: string;
  /** 机器名 */
  name: string;
  /** 封面 file_id（string） */
  coverImageId?: string | null;
  /** 单抽价（分；前端 /100 显示元） */
  singlePriceCent: number;
  /** 十连价（分，null = 不支持十连） */
  tenPackPriceCent?: number | null;
  /** IP 标签 */
  ipTag?: string | null;
  /** 状态 on_shelf/off_shelf/auto_off */
  status: string;
  /** 上架时间 */
  onlineTime?: string | null;
  /** 计划下架时间 */
  offlineTime?: string | null;
  /** 累计抽奖次数 */
  salesCount: number;
  /** 奖品池奖品数 */
  prizeCount?: number;
  /** 乐观锁版本 */
  version?: number;
  /** 创建时间 */
  createTime?: string;
  /** 更新时间 */
  updateTime?: string;
  /** 备注 */
  remark?: string | null;
}

/** 扭蛋机增改表单（与 GzGachaMachineBo.java 对齐） */
export interface GzGachaMachineForm {
  id?: string | null;
  name?: string;
  coverImageId?: string | null;
  /** 单抽价（分） */
  singlePriceCent?: number;
  /** 十连价（分，null = 不支持十连） */
  tenPackPriceCent?: number | null;
  ipTag?: string | null;
  onlineTime?: string | null;
  offlineTime?: string | null;
  remark?: string | null;
}

/** 查询参数（与 GzGachaMachineQueryBo.java 对齐） */
export interface GzGachaMachineQuery {
  name?: string;
  status?: string;
  ipTag?: string;
  pageNum?: number;
  pageSize?: number;
}

/** GET /list — 分页查询扭蛋机（status/ipTag/name 筛选；含 prizeCount） */
export function listGzGachaMachine(query: GzGachaMachineQuery): AxiosPromise<{ total: number; rows: GzGachaMachineVO[] }> {
  return request({
    url: '/system/gz/gacha/machine/list',
    method: 'get',
    params: query
  });
}

/** GET /{id} — 扭蛋机详情 */
export function getGzGachaMachine(id: string | number): AxiosPromise<GzGachaMachineVO> {
  return request({
    url: `/system/gz/gacha/machine/${id}`,
    method: 'get'
  });
}

/** POST / — 新建扭蛋机（status=off_shelf） */
export function addGzGachaMachine(data: GzGachaMachineForm) {
  return request({
    url: '/system/gz/gacha/machine',
    method: 'post',
    data
  });
}

/** PUT / — 编辑扭蛋机 */
export function updateGzGachaMachine(data: GzGachaMachineForm) {
  return request({
    url: '/system/gz/gacha/machine',
    method: 'put',
    data
  });
}

/** PUT /changeStatus — 手动上下架（on_shelf ↔ off_shelf；auto_off 不可手动设） */
export function changeStatusGzGachaMachine(id: string | number, targetStatus: string) {
  return request({
    url: '/system/gz/gacha/machine/changeStatus',
    method: 'put',
    params: { id, targetStatus }
  });
}

/** DELETE /{ids} — 软删（del_flag=2；仍有奖品拒删） */
export function delGzGachaMachine(ids: Array<string | number> | string | number) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({
    url: `/system/gz/gacha/machine/${idStr}`,
    method: 'delete'
  });
}
