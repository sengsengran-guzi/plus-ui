/**
 * gz-user 模块 API stub
 *
 * D01 GZ-SYS-001 脚手架阶段占位，后续：
 * - C 端用户分页列表（GZ-SYS-003）
 * - 管理员账号 CRUD（GZ-USER-ADMIN-*）
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

export interface GzUserHelloResult {
  msg: string;
}

export function helloGzUser(): AxiosPromise<GzUserHelloResult> {
  return request({
    url: '/gz/user/hello',
    method: 'get'
  });
}
