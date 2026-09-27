/**
 * 拼豆「按桌型配额关闭」API（客户 0702 反馈 #4a）。
 *
 * 后端路径：
 *   - POST /system/gz/bean/slotQuotaClose — upsert 单格关闭数（perm gz:bean:slotQuota:edit）
 *
 * 前端唯一调用方 = 看板「今日可售」抽屉的**逐时段**关闭（`views/gz-bean/board/index.vue`）；
 * 抽屉的**全天关闭**走 `@/api/gz-bean/daySellable` 的 `closeGzBeanSlotQuotaDay`。
 * 独立页面「实时余量与关闭」已按甲方 2026-09-26 要求下线（店员直接在看板看），
 * 所以本文件只剩这一个写接口，不再有 `availability/detail` / `list` 两个读接口的封装。
 *
 * 口径：`remaining = max(0, sellableCap − booked − quotaClose)`，
 * `sellableCap = slotCapacity − 长期关闭数`（GZ-BEAN-057）。
 * id 一律 string（跨层契约 #1，防 JS long 精度丢失）。
 */
import request from '@/utils/request';
import { AxiosPromise } from 'axios';

/** upsert 关闭数入参（与 GzBeanSlotQuotaCloseBo.java 对齐） */
export interface GzBeanSlotQuotaCloseUpsert {
  storeId: number | string;
  seatTypeConfigId: number | string;
  sessDate: string;
  slotStart: string;
  closeCount: number;
  remark?: string | null;
}

/** POST /system/gz/bean/slotQuotaClose — upsert 单格关闭数（覆盖，不累加；0 = 该格恢复全开） */
export function upsertGzBeanSlotQuotaClose(data: GzBeanSlotQuotaCloseUpsert): AxiosPromise<void> {
  return request({
    url: '/system/gz/bean/slotQuotaClose',
    method: 'post',
    data
  });
}
