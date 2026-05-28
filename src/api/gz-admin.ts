/**
 * gz-admin 模块 API stub（V1.1 admin 扩展）
 *
 * 注意：本模块不对应后端独立的 ruoyi-gz-admin 模块（后端这些功能拆在 gz-ord / gz-user / gz-common），
 * 这里仅是前端 admin 扩展页（物流推进 / 对账中心 / 数据看板 / 操作日志）的 API 客户端聚合层。
 * D01 GZ-SYS-001 脚手架阶段仅占位 hello，调用任一后端 hello 端点验证联通即可。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

export interface GzAdminHelloResult {
  msg: string;
}

/** 占位：本端点借用 gz-common 的 hello 端点，避免后端造一个对应不上的模块 */
export function helloGzAdmin(): AxiosPromise<GzAdminHelloResult> {
  return request({
    url: '/gz/common/hello',
    method: 'get'
  });
}
