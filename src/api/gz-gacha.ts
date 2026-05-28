/**
 * gz-gacha 模块 API stub（V1.1）
 *
 * D01 GZ-SYS-001 脚手架阶段占位，V1.1 GZ-GACHA-* 系列：
 * - 扭蛋机 / 奖品池 CRUD
 * - 概率配置
 * - 抽奖事务 / 库存扣减审计
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

export interface GzGachaHelloResult {
  msg: string;
}

export function helloGzGacha(): AxiosPromise<GzGachaHelloResult> {
  return request({
    url: '/gz/gacha/hello',
    method: 'get'
  });
}
