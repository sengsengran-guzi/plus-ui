/**
 * gz-news 模块 API stub
 *
 * D01 GZ-SYS-001 脚手架阶段占位，后续 GZ-NEWS-* 系列：
 * - 分类 CRUD
 * - 文章 CMS + 富文本 + 封面 OSS 上传
 * - 定时发布
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

export interface GzNewsHelloResult {
  msg: string;
}

export function helloGzNews(): AxiosPromise<GzNewsHelloResult> {
  return request({
    url: '/gz/news/hello',
    method: 'get'
  });
}
