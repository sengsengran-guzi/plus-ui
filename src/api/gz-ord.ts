/**
 * gz-ord 模块 API stub（V1.1）
 *
 * D01 GZ-SYS-001 脚手架阶段占位，V1.1 GZ-ORD-* 系列：
 * - 商品 / SKU CRUD
 * - 三类订单聚合（预定 / 散货 / 扭蛋）
 * - 物流推进 7→2 节点
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

export interface GzOrdHelloResult {
  msg: string;
}

export function helloGzOrd(): AxiosPromise<GzOrdHelloResult> {
  return request({
    url: '/gz/ord/hello',
    method: 'get'
  });
}
