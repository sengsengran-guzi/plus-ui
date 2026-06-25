/**
 * GZ-SYS-004B 客服配置 API（admin 端）
 *
 * 后端契约：gz 专用端点（不再走 ruoyi sys_config）。
 *   - GET /system/gz/customerService          读当前租户客服配置
 *   - PUT /system/gz/customerService          保存（upsert）
 *
 * 权限 gz:config:cs:edit（甲方 owner 角色有）；按当前登录租户单行读写。
 * 取代旧的 /system/config 方案（要 system:config 系统权限、按租户隔离导致 mp 读不到）。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

export interface CustomerServiceConfig {
  /** 企业微信客服账号（有值 → mp 端渲染 <button open-type="contact">） */
  wxKfId: string;
  /** 降级客服电话（wxKfId 空时弹窗展示） */
  phone: string;
  /** 降级客服微信号（wxKfId 空时弹窗展示） */
  wxId: string;
}

/** 读当前租户客服配置（编辑页回填）。 */
export function getCustomerServiceConfig(): Promise<CustomerServiceConfig> {
  return request({
    url: '/system/gz/customerService',
    method: 'get'
  }).then((res) => {
    const d = (res.data as Partial<CustomerServiceConfig>) || {};
    return {
      wxKfId: d.wxKfId || '',
      phone: d.phone || '',
      wxId: d.wxId || ''
    };
  });
}

/** 保存客服配置（admin 配置页「保存」按钮调用，整体 upsert）。 */
export function saveCustomerServiceConfig(cfg: CustomerServiceConfig): AxiosPromise {
  return request({
    url: '/system/gz/customerService',
    method: 'put',
    data: {
      wxKfId: cfg.wxKfId || '',
      phone: cfg.phone || '',
      wxId: cfg.wxId || ''
    }
  });
}
