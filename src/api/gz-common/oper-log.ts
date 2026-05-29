/**
 * GZ-SYS-006 谷子操作日志 API（admin 端）
 *
 * 后端路径：/system/gz/oper-log/*（owner/staff 权限差异化 wrapper，底层走 sys_oper_log）
 * 权限：gz:oper-log:list / gz:oper-log:query / gz:oper-log:remove / gz:oper-log:export
 *
 * 与 ruoyi 自带 /monitor/operlog/* 区分：
 *   - ruoyi 原接口：全租户全用户视角，需 monitor:operlog:* perm
 *   - 本接口：owner 看全部 / staff 仅看自己（后端强制 operName=当前用户名）
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 操作日志 VO（与后端 GzOperLogVO 对齐；Long 字段全局序列化为字符串） */
export interface GzOperLogVO {
  operId: string;
  tenantId: string;
  title: string;
  businessType: number;
  method: string;
  requestMethod: string;
  operatorType: number;
  operName: string;
  deptName: string;
  operUrl: string;
  operIp: string;
  operLocation: string;
  operParam: string;
  jsonResult: string;
  status: number;
  errorMsg: string;
  operTime: string;
  costTime: number;
}

export interface GzOperLogQuery {
  pageNum?: number;
  pageSize?: number;
  title?: string;
  operName?: string;
  operIp?: string;
  businessType?: number | string;
  status?: number | string;
  orderByColumn?: string;
  isAsc?: string;
  /** addDateRange 注入：params[beginTime] / params[endTime] */
  params?: Record<string, any>;
}

/** 查询操作日志列表 */
export function listOperLog(query: GzOperLogQuery): AxiosPromise<GzOperLogVO[]> {
  return request({
    url: '/system/gz/oper-log/list',
    method: 'get',
    params: query
  });
}

/** 查询单条详情 */
export function getOperLog(operId: string | number): AxiosPromise<GzOperLogVO> {
  return request({
    url: '/system/gz/oper-log/' + operId,
    method: 'get'
  });
}

/** 批量删除 — 仅 owner / superadmin */
export function delOperLog(operIds: string | number | Array<string | number>) {
  return request({
    url: '/system/gz/oper-log/' + operIds,
    method: 'delete'
  });
}
