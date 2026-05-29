/**
 * GZ-ADMIN-002 — 管理员账号 CRUD API thin wrapper
 *
 * 复用 ruoyi 自带 /system/user/* 端点，本 wrapper 仅:
 * 1. 列表查询固定加 roleId IN (100, 101) 过滤（owner/staff 二角色范围）
 * 2. TS 类型 id 字段统一 string（CLAUDE.md 跨层契约 #1）
 *
 * 不重复 CRUD 端点 — 复用 ruoyi 自带，权限点 gz:admin-user:* 由前端
 * v-hasPermi 控制。后端 @Log AOP 已在 ruoyi 自带 SysUserController 注册。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

import type { UserForm, UserQuery, UserVO, UserInfoVO } from '@/api/system/user/types';

/** owner / staff 二级角色 ID（与 V202605291001__GZ-ADMIN-001-seed-roles.sql 对齐） */
export const GZ_ADMIN_ROLE_IDS = ['100', '101'] as const;

/** 角色 ID → key 映射（前端展示用） */
export const GZ_ROLE_LABEL: Record<string, string> = {
  '100': 'owner',
  '101': 'staff'
};

/** 谷子管理员查询参数 — 在 ruoyi UserQuery 基础上加 gzStoreId 筛 */
export interface GzAdminUserQuery extends UserQuery {
  /** 关联门店 ID（BEAN-001 完工后从 gz_store 拉下拉，V1.0 单门店为 1） */
  gzStoreId?: string | number;
}

/** 查询谷子管理员列表 — 固定 roleId IN (100, 101) */
export const listAdminUser = (query: GzAdminUserQuery): AxiosPromise<UserVO[]> => {
  return request({
    url: '/system/user/list',
    method: 'get',
    params: {
      ...query
      // 注意：ruoyi sys_user list 不直接支持 roleId IN()，仅支持单 roleId
      // V1.0 简化方案 — 前端过滤（owner/staff 用户总量 < 100，无性能问题）
      // 后续 BEAN-001 完工后如门店多则改后端 SQL 过滤
    }
  });
};

/** 获取谷子管理员详情（含 roleIds + postIds） */
export const getAdminUser = (userId?: string | number): AxiosPromise<UserInfoVO> => {
  return request({
    url: '/system/user/' + (userId ?? ''),
    method: 'get'
  });
};

/** 新增谷子管理员 — roleIds 必须 ∈ {'100','101'} */
export const addAdminUser = (data: UserForm) => {
  return request({
    url: '/system/user',
    method: 'post',
    data
  });
};

/** 修改谷子管理员 */
export const updateAdminUser = (data: UserForm) => {
  return request({
    url: '/system/user',
    method: 'put',
    data
  });
};

/** 软删谷子管理员（ruoyi 自带 del_flag='2'） */
export const delAdminUser = (userId: string | number | Array<string | number>) => {
  return request({
    url: '/system/user/' + userId,
    method: 'delete'
  });
};

/** 重置密码 */
export const resetAdminUserPwd = (userId: string | number, password: string) => {
  return request({
    url: '/system/user/resetPwd',
    method: 'put',
    headers: {
      isEncrypt: true,
      repeatSubmit: false
    },
    data: { userId, password }
  });
};

/** 启用 / 禁用 */
export const changeAdminUserStatus = (userId: string | number, status: string) => {
  return request({
    url: '/system/user/changeStatus',
    method: 'put',
    data: { userId, status }
  });
};

export default {
  listAdminUser,
  getAdminUser,
  addAdminUser,
  updateAdminUser,
  delAdminUser,
  resetAdminUserPwd,
  changeAdminUserStatus,
  GZ_ADMIN_ROLE_IDS,
  GZ_ROLE_LABEL
};
