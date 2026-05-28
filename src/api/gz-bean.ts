/**
 * gz-bean 模块 API stub
 *
 * D01 GZ-SYS-001 脚手架阶段占位，V1.0 GZ-BEAN-* 系列 ticket 会扩展：
 * - 门店 CRUD（GZ-BEAN-001）
 * - 时段模板 CRUD（GZ-BEAN-002）
 * - 座位排版（GZ-BEAN-003）
 * - 预约列表 + 核销（GZ-BEAN-004 / GZ-BEAN-005）
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

export interface GzBeanHelloResult {
  msg: string;
}

export function helloGzBean(): AxiosPromise<GzBeanHelloResult> {
  return request({
    url: '/gz/bean/hello',
    method: 'get'
  });
}
