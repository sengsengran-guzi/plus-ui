/**
 * GZ-SYS-003 C 端用户管理 API（admin 端）
 *
 * 后端路径：/system/gz/user/*（与 ruoyi /system/user 管理员表显式区分）
 * 权限：gz:user:list / gz:user:query
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** C 端用户 VO（与 GzUserVO.java 字段对齐） */
export interface GzUserVO {
  /** 主键 */
  id: number;
  /** 业务码 U{yyyyMMdd}{6 位序号} */
  userNo: string;
  /** 微信小程序级 openid */
  openid: string;
  /** 微信 unionid（可能为 null） */
  unionid?: string | null;
  /** 昵称 */
  nickname?: string | null;
  /** 头像 URL */
  avatarUrl?: string | null;
  /** 手机号 */
  mobile?: string | null;
  /** 性别 0=未知 / 1=男 / 2=女 */
  gender: number;
  /** 注册来源（V1 固定 mp_wechat） */
  registerSource: string;
  /** 注册时间 */
  registerTime: string;
  /** 最后登录时间 */
  lastLoginTime?: string | null;
  /** 用户状态 browse_only / authorized / phone_bound */
  status: string;
  /** 是否禁用 0/1 */
  isDisabled: number;
  /** 创建时间（公共字段） */
  createTime?: string;
  /** 备注 */
  remark?: string | null;
}

/** 列表查询参数（与 GzUserQueryBo 对齐） */
export interface GzUserQuery {
  openid?: string;
  nickname?: string;
  mobile?: string;
  status?: string;
  isDisabled?: number;
  registerTimeStart?: string;
  registerTimeEnd?: string;
  lastLoginTimeStart?: string;
  lastLoginTimeEnd?: string;
  pageNum?: number;
  pageSize?: number;
}

/** GET /system/gz/user/list — 分页查询 C 端用户 */
export function listGzUser(query: GzUserQuery): AxiosPromise<{ total: number; rows: GzUserVO[] }> {
  return request({
    url: '/system/gz/user/list',
    method: 'get',
    params: query
  });
}

/** GET /system/gz/user/{id} — 单用户详情 */
export function getGzUser(userId: number | string): AxiosPromise<GzUserVO> {
  return request({
    url: `/system/gz/user/${userId}`,
    method: 'get'
  });
}
