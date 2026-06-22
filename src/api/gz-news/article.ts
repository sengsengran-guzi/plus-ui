/**
 * GZ-NEWS-003 后台资讯 CMS API（admin 端）
 *
 * 后端路径：/system/gz/news/article/*
 * 权限：gz:news:article:list / add / edit / delete / publish / offline
 *
 * 字段权威：doc/11 §5.1 gz_news_article；状态机：doc/10 §5（draft/scheduled/published/offline）
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 文章 admin VO（与 GzNewsArticleAdminVO.java 对齐；id 跨层契约 #1 为 string） */
export interface GzNewsArticleVO {
  /** 主键（string，避免 JS 精度丢失） */
  id: string;
  /** 业务码 ART-yyyyMMdd-6位序号（系统生成，只读） */
  articleNo: string;
  /** 标题 */
  title: string;
  /** 摘要 */
  summary?: string | null;
  /** 分类 code（new_product/activity/guide/announcement） */
  categoryCode: string;
  /** 封面可渲染 URL */
  coverUrl?: string | null;
  /** 封面 file_id（string） */
  coverFileId?: string | null;
  /** 富文本正文 HTML（详情才返回；列表不投影） */
  contentHtml?: string | null;
  /** 视频 URL 逗号分隔 */
  videoUrls?: string | null;
  /** 状态 draft/scheduled/published/offline */
  status: string;
  /** 实际发布时间 */
  publishTime?: string | null;
  /** 定时发布 due 时间 */
  schedulePublishTime?: string | null;
  /** 阅读量 */
  readCount: number;
  /** 分享量 */
  shareCount: number;
  /** 置顶 0否/1是 */
  isPinned: number;
  /** 同分类内排序 */
  sortNo: number;
  /** 创建时间 */
  createTime?: string;
  /** 更新时间 */
  updateTime?: string;
  /** 备注 */
  remark?: string | null;
}

/** 新增 / 编辑表单（与 GzNewsArticleBo.java 对齐） */
export interface GzNewsArticleForm {
  id?: string | null;
  title?: string;
  summary?: string | null;
  categoryCode?: string;
  coverUrl?: string | null;
  coverFileId?: string | null;
  contentHtml?: string;
  videoUrls?: string | null;
  /** 置顶 '0' / '1'（后端 BO 用 String 校验 ^[01]$） */
  isPinned?: string;
  sortNo?: number | null;
  remark?: string | null;
}

/** 查询参数（与 GzNewsArticleQueryBo.java 对齐） */
export interface GzNewsArticleQuery {
  title?: string;
  categoryCode?: string;
  status?: string;
  beginCreateTime?: string;
  endCreateTime?: string;
  pageNum?: number;
  pageSize?: number;
}

/** GET /list — 分页查询文章（全状态 + 筛选） */
export function listGzNewsArticle(query: GzNewsArticleQuery): AxiosPromise<{ total: number; rows: GzNewsArticleVO[] }> {
  return request({
    url: '/system/gz/news/article/list',
    method: 'get',
    params: query
  });
}

/** GET /{id} — 文章详情（全字段回填，编辑页用） */
export function getGzNewsArticle(id: string | number): AxiosPromise<GzNewsArticleVO> {
  return request({
    url: `/system/gz/news/article/${id}`,
    method: 'get'
  });
}

/** POST / — 新建文章（status=draft） */
export function addGzNewsArticle(data: GzNewsArticleForm) {
  return request({
    url: '/system/gz/news/article',
    method: 'post',
    data
  });
}

/** PUT / — 编辑文章 */
export function updateGzNewsArticle(data: GzNewsArticleForm) {
  return request({
    url: '/system/gz/news/article',
    method: 'put',
    data
  });
}

/** DELETE /{ids} — 逻辑删（软删，id 集合） */
export function delGzNewsArticle(ids: Array<string | number> | string | number) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  return request({
    url: `/system/gz/news/article/${idStr}`,
    method: 'delete'
  });
}

/** POST /publish/{id} — 立即发布（draft/offline/scheduled → published） */
export function publishGzNewsArticle(id: string | number) {
  return request({
    url: `/system/gz/news/article/publish/${id}`,
    method: 'post'
  });
}

/** POST /schedule/{id} — 定时发布（draft → scheduled，schedulePublishTime > now） */
export function scheduleGzNewsArticle(id: string | number, schedulePublishTime: string) {
  return request({
    url: `/system/gz/news/article/schedule/${id}`,
    method: 'post',
    params: { schedulePublishTime }
  });
}

/** POST /offline/{id} — 下架（published → offline） */
export function offlineGzNewsArticle(id: string | number) {
  return request({
    url: `/system/gz/news/article/offline/${id}`,
    method: 'post'
  });
}

/** POST /cancel-schedule/{id} — 取消定时（scheduled → draft，回草稿可重新改期，不必删重建） */
export function cancelScheduleGzNewsArticle(id: string | number) {
  return request({
    url: `/system/gz/news/article/cancel-schedule/${id}`,
    method: 'post'
  });
}
