/**
 * GZ-SYS-007 AC10 店员绑定管理 API（admin owner 端）
 *
 * 后端路径：/system/gz/staff/binding/*（与 ruoyi /system/user 区分）
 * 权限：gz:staff:binding:list / gz:staff:binding:bind / gz:staff:binding:unbind（仅 owner 角色）
 *
 * 业务：owner 给 C 端微信用户（gz_user）设/改/解店员身份（绑定 ruoyi sys_user），
 *       绑后该用户下次 mp 登录（或现有会话刷新）获得店员 RBAC 权限；解绑/改绑即时踢旧会话。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 店员绑定列表行 VO（与后端 StaffBindingVO 对齐） */
export interface StaffBindingVO {
  /** gz_user 主键 */
  id: number;
  /** 业务码 U{yyyyMMdd}{6 位序号} */
  userNo: string;
  /** 微信 openid */
  openid: string;
  /** 昵称 */
  nickname?: string | null;
  /** 手机号 */
  mobile?: string | null;
  /** 头像 URL */
  avatarUrl?: string | null;
  /** 当前绑定的店员 sys_user.user_id（null=纯顾客） */
  staffUserId?: number | null;
  /** 当前绑定店员的登录账号名 */
  staffUserName?: string | null;
  /** 当前绑定店员的昵称 */
  staffNickName?: string | null;
  /** 绑定店员是否当前有效（false=绑了但已停用/已删/跨租户） */
  staffActive?: boolean | null;
}

/** 候选店员 VO（与后端 StaffCandidateVO 对齐） */
export interface StaffCandidateVO {
  /** sys_user.user_id */
  userId: number;
  /** 登录账号名 */
  userName: string;
  /** 昵称 */
  nickName?: string | null;
}

/** 列表查询参数（与后端 StaffBindingQueryBo 对齐） */
export interface StaffBindingQuery {
  openid?: string;
  mobile?: string;
  userNo?: string;
  /** true=只看已绑定店员的用户 */
  boundOnly?: boolean;
  pageNum?: number;
  pageSize?: number;
}

/** GET /system/gz/staff/binding/list — 分页查询 C 端用户 + 绑定状态 */
export function listStaffBinding(
  query: StaffBindingQuery
): AxiosPromise<{ total: number; rows: StaffBindingVO[] }> {
  return request({
    url: '/system/gz/staff/binding/list',
    method: 'get',
    params: query
  });
}

/** GET /system/gz/staff/binding/candidates — 查可绑定的店员 sys_user 候选 */
export function listStaffCandidates(keyword?: string): AxiosPromise<StaffCandidateVO[]> {
  return request({
    url: '/system/gz/staff/binding/candidates',
    method: 'get',
    params: { keyword }
  });
}

/** POST /system/gz/staff/binding/{gzUserId}/bind — 设/改绑店员身份 */
export function bindStaff(gzUserId: number, staffUserId: number): AxiosPromise<boolean> {
  return request({
    url: `/system/gz/staff/binding/${gzUserId}/bind`,
    method: 'post',
    params: { staffUserId }
  });
}

/** POST /system/gz/staff/{gzUserId}/unbind — 解绑店员身份并即时踢出会话 */
export function unbindStaff(gzUserId: number): AxiosPromise<boolean> {
  return request({
    url: `/system/gz/staff/${gzUserId}/unbind`,
    method: 'post'
  });
}
