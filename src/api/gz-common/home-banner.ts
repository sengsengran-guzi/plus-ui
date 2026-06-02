/**
 * GZ-HOME-001 首页轮播 banner 配置 API（admin 端）。
 *
 * 后端契约：复用 ruoyi 自带 sys_config，不新增业务接口。
 *   - GET  /system/config/configKey/{key}   读 config_value（JSON 数组字符串）
 *   - PUT  /system/config/updateByKey        写 config_value
 *
 * key gz.home.banners 在 V202606051200__GZ-HOME-001-home-banner-config.sql 建好（默认 '[]'）。
 * mp 端走 @SaIgnore 公开端点读同一 key（GzConfigMpController）。
 */
import { getConfigKey, updateConfigByKey } from '@/api/system/config';
import { AxiosPromise } from 'axios';

/** sys_config key（与 mp 端 GZ_CONFIG_KEYS.HOME_BANNERS + DDL 一致） */
export const HOME_BANNER_CONFIG_KEY = 'gz.home.banners';

/** 单条 banner（config_value JSON 数组元素） */
export interface HomeBannerItem {
  /** 图 URL（OSS） */
  imageUrl: string;
  /** 点击跳转站内 mp 路由（如 /pages/bean/index）；空则不可点 */
  link: string;
  /** 是否启用（false 则 mp 端跳过不渲染） */
  enabled: boolean;
}

/** 读首页 banner 列表（解析 JSON 数组；空 / 非法 → []） */
export async function getHomeBanners(): Promise<HomeBannerItem[]> {
  const res = await getConfigKey(HOME_BANNER_CONFIG_KEY);
  const raw = (res.data as unknown as string) || '';
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((it: any) => ({
      imageUrl: it.imageUrl ?? '',
      link: it.link ?? '',
      enabled: it.enabled !== false
    }));
  } catch {
    return [];
  }
}

/** 保存首页 banner 列表（整体序列化为 JSON 数组写回） */
export function saveHomeBanners(list: HomeBannerItem[]): AxiosPromise {
  return updateConfigByKey(HOME_BANNER_CONFIG_KEY, JSON.stringify(list));
}
