/**
 * GZ-ADMIN-003 基础数据看板 API（admin 端）
 *
 * 后端路径：/system/gz/dashboard/*（与 ruoyi /system 域名隔离）
 * 权限：gz:dashboard:view（查看）/ gz:dashboard:refresh（手动刷新，owner only）
 *
 * 契约权威：GzDashboardController.java + GzDashboardLatestVO.java / GzDashboardTrendVO.java
 * 数据口径：doc/11 §2.1 / §3.5 / §5.1（V1.0 仅 5 个非交易指标，合同 §2.1）
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 单个指标项（与 GzDashboardLatestVO.MetricItem 对齐） */
export interface DashboardMetricItem {
  /** 指标 key（total_users / today_new_users / total_bookings / today_bookings / total_news_reads） */
  metricKey: string;
  /** 卡片标题（后端中文默认；前端按 metricKey 走 i18n 覆盖） */
  title: string;
  /** 指标数值（counts，前端千分位格式化） */
  value: number;
}

/** 看板最新快照 VO（与 GzDashboardLatestVO 对齐） */
export interface DashboardLatestVO {
  /** 本批快照时间；空表示 cron 尚未跑过（首次部署），前端显示「-」 */
  snapshotTime?: string | null;
  /** 5 个指标最新值 */
  metrics: DashboardMetricItem[];
}

/** 趋势点 VO（与 GzDashboardTrendVO 对齐；V1.0 留接口前端不展示） */
export interface DashboardTrendVO {
  snapshotTime: string;
  metricValue: number;
}

/** 看板最新快照（5 个 metric 最新值 + 快照时间） */
export function getDashboardLatest(): AxiosPromise<DashboardLatestVO> {
  return request({ url: '/system/gz/dashboard/latest', method: 'get' });
}

/** 某 metric 最近 N 天趋势（V1.0 前端不展示，留 V1.1 图表用） */
export function getDashboardTrend(metricKey: string, days = 7): AxiosPromise<DashboardTrendVO[]> {
  return request({ url: '/system/gz/dashboard/trend', method: 'get', params: { metricKey, days } });
}

/** 立即刷新：同步触发一次快照计算（owner 权限 + 后端 IP 限流 5s） */
export function refreshDashboard(): AxiosPromise<void> {
  return request({ url: '/system/gz/dashboard/refresh', method: 'post' });
}
