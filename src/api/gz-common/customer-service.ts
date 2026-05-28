/**
 * GZ-SYS-004 客服配置 API（admin 端）
 *
 * 后端契约：复用 ruoyi 自带 sys_config 表，不新增业务接口。
 *   - GET  /system/config/configKey/{key}   按 key 读单值
 *   - PUT  /system/config/updateByKey       按 key 写单值
 *
 * 三 key 在 V202605281200__GZ-SYS-004-customer-service-config.sql 已建好占位。
 */
import { getConfigKey, updateConfigByKey } from '@/api/system/config';
import { AxiosPromise } from 'axios';

/** sys_config key 常量（与 mp 端 + DDL 保持一致） */
export const CS_CONFIG_KEYS = {
  /** 企业微信客服账号（有值 → mp 端渲染 <button open-type="contact">） */
  WX_KF_ID: 'gz.customer_service.wx_kf_id',
  /** 降级客服电话（wx_kf_id 空时弹窗展示） */
  PHONE: 'gz.customer_service.phone',
  /** 降级客服微信号（wx_kf_id 空时弹窗展示） */
  WX_ID: 'gz.customer_service.wx_id'
} as const;

export type CsConfigKey = (typeof CS_CONFIG_KEYS)[keyof typeof CS_CONFIG_KEYS];

export interface CustomerServiceConfig {
  wxKfId: string;
  phone: string;
  wxId: string;
}

/** 查 3 个 key 的当前值（并发 fetch） */
export function getCustomerServiceConfig(): Promise<CustomerServiceConfig> {
  return Promise.all([
    getConfigKey(CS_CONFIG_KEYS.WX_KF_ID),
    getConfigKey(CS_CONFIG_KEYS.PHONE),
    getConfigKey(CS_CONFIG_KEYS.WX_ID)
  ]).then(([wxKfIdRes, phoneRes, wxIdRes]) => ({
    wxKfId: (wxKfIdRes.data as unknown as string) || '',
    phone: (phoneRes.data as unknown as string) || '',
    wxId: (wxIdRes.data as unknown as string) || ''
  }));
}

/** 单 key 更新（保存时按字段调用，串行可控） */
export function updateCsConfig(key: CsConfigKey, value: string): AxiosPromise {
  return updateConfigByKey(key, value);
}

/** 批量保存（admin 配置页"保存"按钮调用，串行确保失败时定位到哪个 key） */
export async function saveCustomerServiceConfig(cfg: CustomerServiceConfig): Promise<void> {
  await updateCsConfig(CS_CONFIG_KEYS.WX_KF_ID, cfg.wxKfId);
  await updateCsConfig(CS_CONFIG_KEYS.PHONE, cfg.phone);
  await updateCsConfig(CS_CONFIG_KEYS.WX_ID, cfg.wxId);
}
