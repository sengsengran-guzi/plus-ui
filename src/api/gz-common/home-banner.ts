/**
 * GZ-HOME-001 / GZ-JP-201 首页轮播 banner 配置 API（admin 端）。
 *
 * 后端契约：复用 ruoyi 自带 sys_config，不新增业务接口。
 *   - GET  /system/config/configKey/{key}   读 config_value（JSON 数组字符串）
 *   - PUT  /system/config/updateByKey        写 config_value
 *
 * ⚠️ 两个小程序（谷子宇宙 / 拼团）共用同一后端 + 同一张 sys_config 表，首页 banner 必须各配一套，
 * 否则配一次两边首页串味。故每个小程序一个 config_key：
 *   - 谷子宇宙 gz.home.banners     （V202606051200__GZ-HOME-001-home-banner-config.sql）
 *   - 拼团     gz.jp.home.banners  （V202608101050__GZ-JP-201-jp-home-banner-config.sql）
 * mp 端走 @SaIgnore 公开端点读各自的 key，后端 MpPublicConfigKeyResolver 按 clientid 归一。
 */
import { getConfigKey, updateConfigByKey } from '@/api/system/config';
import { AxiosPromise } from 'axios';

/** 可配置 banner 的小程序（值 = 后端 sys_config 的 config_key） */
export const HOME_BANNER_APPS = [
  { app: 'guzi', configKey: 'gz.home.banners' },
  { app: 'jp', configKey: 'gz.jp.home.banners' }
] as const;

/** 小程序标识（i18n 文案 key 用它拼：gzHomeBanner.app.guzi / gzHomeBanner.app.jp） */
export type HomeBannerApp = (typeof HOME_BANNER_APPS)[number]['app'];

/** 谷子宇宙（拼豆）小程序的 sys_config key —— 线上既有，不可改 */
export const HOME_BANNER_CONFIG_KEY = 'gz.home.banners';

/** 取某个小程序的 config_key（未知值一律落谷子宇宙那份，等同改造前行为） */
export function homeBannerConfigKey(app: HomeBannerApp): string {
  return HOME_BANNER_APPS.find((it) => it.app === app)?.configKey ?? HOME_BANNER_CONFIG_KEY;
}

/** 单条 banner（config_value JSON 数组元素） */
export interface HomeBannerItem {
  /** 图 URL（OSS） */
  imageUrl: string;
  /** 点击跳转站内 mp 路由（如 /pages/bean/index）；空则不可点 */
  link: string;
  /** 是否启用（false 则 mp 端跳过不渲染） */
  enabled: boolean;
}

/** 读某个小程序的首页 banner 列表（解析 JSON 数组；空 / 非法 → []） */
export async function getHomeBanners(app: HomeBannerApp): Promise<HomeBannerItem[]> {
  const res = await getConfigKey(homeBannerConfigKey(app));
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

/** 保存某个小程序的首页 banner 列表（整体序列化为 JSON 数组写回） */
export function saveHomeBanners(app: HomeBannerApp, list: HomeBannerItem[]): AxiosPromise {
  return updateConfigByKey(homeBannerConfigKey(app), JSON.stringify(list));
}
