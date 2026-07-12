/**
 * GZ-SYS-005 业务文件上传 / 对象存储 API（admin 端）
 *
 * 契约：见 doc/11 §5.3 + ruoyi-gz-common.GzFileController
 *   - POST  /system/gz/file/upload  multipart/form-data: { file, usageType }
 *   - GET   /system/gz/file/url     ?fileId=
 *
 * 使用场景枚举与后端 GzFileUsageType.java 严格对齐：
 *   - news_cover / news_inline / user_avatar / gacha_prize_image / preorder_product_image / store_image
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** doc/11 §5.3 — gz_file_object 视图字段 */
export interface GzFileObjectVO {
  /** 文件 id（业务表关联用，BIGINT 序列化为 number — TODO 后续 SDK 全 string 化时改 string） */
  fileId: number;
  /** 对象存储 key（仅 admin 端列表查看；mp 端置 null） */
  objectKey?: string;
  /** 原文件名 */
  fileName: string;
  /** 字节数 */
  fileSize: number;
  /** MIME */
  mimeType: string;
  /** 使用场景 */
  usageType: string;
  /** 预签名 URL（1h 过期；调 /url 接口时填充） */
  url?: string;
  /** 上传时间（后端返回 ISO 字符串） */
  createTime?: string;
}

/** 使用场景枚举（与后端 GzFileUsageType 严格对齐） */
export const GZ_FILE_USAGE_TYPE = {
  NEWS_COVER: 'news_cover',
  NEWS_INLINE: 'news_inline',
  USER_AVATAR: 'user_avatar',
  GACHA_PRIZE_IMAGE: 'gacha_prize_image',
  PREORDER_PRODUCT_IMAGE: 'preorder_product_image',
  STORE_IMAGE: 'store_image',
  RECYCLE_VERIFY_IMAGE: 'recycle_verify_image'
} as const;

export type GzFileUsageType = (typeof GZ_FILE_USAGE_TYPE)[keyof typeof GZ_FILE_USAGE_TYPE];

/**
 * 上传文件（multipart/form-data）
 * 注意：FormData 由调用方组装，需含 `file` + `usageType` 字段。
 */
export function uploadGzFile(data: FormData): AxiosPromise<GzFileObjectVO> {
  return request({
    url: '/system/gz/file/upload',
    method: 'post',
    data,
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000
  });
}

/**
 * 拿带 1h 过期签名的临时 URL
 */
export function getGzFileUrl(fileId: number): AxiosPromise<GzFileObjectVO> {
  return request({
    url: '/system/gz/file/url',
    method: 'get',
    params: { fileId }
  });
}
