/**
 * 整点营业窗口工具（拼豆 + 回收共享，GZ-RECYCLE-012 / ADR-0022 / ADR-0011）。
 *
 * <p>两个业务域的营业窗口都是「整点起止 + 系统按 1 小时切格 + <b>残格不生成</b>」。
 * 非整点会静默丢掉不足一小时的残格（配 10:00-13:30 只会切出 10/11/12），
 * admin 以为开了、顾客约不到、店员对不上账 —— 所以两端都要在保存前拦住。</p>
 *
 * <p>抽到这里是因为回收（GZ-RECYCLE-012）复用了拼豆已跑熟的这套规则：
 * 各写一份的话，改一处忘另一处就会让两个域的口径慢慢漂开。</p>
 */

/** `el-time-picker` 的 `disabled-minutes` / `disabled-seconds`：1..59 全禁，只放 0 → 只能选整点 */
export function disabledNonZero(): number[] {
  return Array.from({ length: 59 }, (_, i) => i + 1);
}

/** "HH:mm:ss" 是否整点（mm == 00 && ss == 00） */
export function isWholeHour(time?: string | null): boolean {
  if (!time) return false;
  const parts = time.split(':');
  if (parts.length < 2) return false;
  const mm = parts[1];
  const ss = parts[2] ?? '00';
  return mm === '00' && ss === '00';
}

/** "HH:mm:ss" → "HH:mm"（展示用） */
export function hhmm(time?: string | null): string {
  return (time || '').slice(0, 5);
}

/**
 * 把营业窗口 `[start, end)` 切成 1 小时格起点（与后端 `sliceWindowsToHourCells` 同口径）。
 * 残格不生成；非整点 / 非法区间返回空数组。用于 admin 的「本窗口将切出 N 格」预览。
 */
export function sliceWindowToHourCells(startTime?: string | null, endTime?: string | null): string[] {
  if (!isWholeHour(startTime) || !isWholeHour(endTime)) return [];
  const sh = Number((startTime as string).slice(0, 2));
  const eh = Number((endTime as string).slice(0, 2));
  if (!(sh < eh)) return [];
  const cells: string[] = [];
  for (let h = sh; h < eh; h++) {
    cells.push(`${String(h).padStart(2, '0')}:00`);
  }
  return cells;
}

/**
 * 窗口合法性：start < end 且两端都整点。
 *
 * @param messages 由调用方注入 i18n 文案（本工具不依赖 vue-i18n 实例）
 * @returns 不合法时返回错误文案；合法返回 null
 */
export function validateWindow(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  messages: { notWholeHour: string; startBeforeEnd: string }
): string | null {
  if (!isWholeHour(startTime) || !isWholeHour(endTime)) {
    return messages.notWholeHour;
  }
  if ((startTime as string) >= (endTime as string)) {
    return messages.startBeforeEnd;
  }
  return null;
}
