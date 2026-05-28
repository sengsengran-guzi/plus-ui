/**
 * gz-common 模块 API stub
 *
 * D01 GZ-SYS-001 脚手架阶段占位，后续 ticket 在此添加：
 * - 客服配置 / 字典初始化（GZ-SYS-004 / GZ-COMMON-DICT）
 * - 支付通道配置（GZ-PAY-001）
 * - OSS bizType 枚举（GZ-COMMON-OSS）
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

export interface GzCommonHelloResult {
  msg: string;
}

export function helloGzCommon(): AxiosPromise<GzCommonHelloResult> {
  return request({
    url: '/gz/common/hello',
    method: 'get'
  });
}
