/**
 * GZ-ADMIN-108 软删恢复回收站 API（admin 端，owner 限定）
 *
 * 后端路径：/system/gz/recycle-bin/*（GzRecycleBinAdminController）
 * 权限：gz:recycle:bin:list / :restore / :archive
 *
 * 跨业务表治理 del_flag='2' 软删记录：列表 / 恢复（2→0）/ 立即归档（archived_flag=1）。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** 回收站行 */
export interface RecycleBinItemVO {
  entityType: string;
  entityTypeLabel: string;
  entityId: string;
  entityName: string;
  deleteOperatorName?: string | null;
  deleteTime?: string | null;
  daysAgo?: number | null;
  archived: boolean;
}

/** 实体类型定义（筛选下拉） */
export interface RecycleEntityDef {
  entityType: string;
  tableName: string;
  nameColumn: string;
  label: string;
}

export interface RecycleBinQuery {
  entityType?: string;
  entityName?: string;
  startTime?: string;
  endTime?: string;
  pageNum?: number;
  pageSize?: number;
}

/** GET /list — 回收站分页列表 */
export function listRecycleBin(query: RecycleBinQuery): AxiosPromise<{ total: number; rows: RecycleBinItemVO[] }> {
  return request({
    url: '/system/gz/recycle-bin/list',
    method: 'get',
    params: query
  });
}

/** GET /entity-types — 注册实体类型清单（筛选下拉） */
export function getRecycleEntityTypes(): AxiosPromise<RecycleEntityDef[]> {
  return request({
    url: '/system/gz/recycle-bin/entity-types',
    method: 'get'
  });
}

/** POST /restore — 恢复（del_flag 2→0） */
export function restoreRecycle(entityType: string, entityId: string): AxiosPromise<void> {
  return request({
    url: '/system/gz/recycle-bin/restore',
    method: 'post',
    data: { entityType, entityId }
  });
}

/** POST /archive — 立即归档（archived_flag=1） */
export function archiveRecycle(entityType: string, entityId: string): AxiosPromise<void> {
  return request({
    url: '/system/gz/recycle-bin/archive',
    method: 'post',
    data: { entityType, entityId }
  });
}
