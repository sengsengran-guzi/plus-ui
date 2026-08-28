<template>
  <el-card shadow="never" class="mb-3">
    <template #header>
      <div class="board-header">
        <div class="board-header__left">
          <span class="text-base font-medium">{{ t('gzRecycleAppointment.boardTitle') }}</span>
          <el-select v-model="storeId" :placeholder="t('gzRecycleAppointment.storePlaceholder')" style="width: 160px">
            <el-option v-for="s in storeOptions" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
          <div class="board-week-switch">
            <el-button size="small" @click="shiftWeek(-1)">{{ t('gzRecycleAppointment.prevWeek') }}</el-button>
            <el-button size="small" @click="resetWeek">{{ t('gzRecycleAppointment.thisWeek') }}</el-button>
            <el-button size="small" @click="shiftWeek(1)">{{ t('gzRecycleAppointment.nextWeek') }}</el-button>
            <span class="board-week-range">{{ weekRangeLabel }}</span>
          </div>
        </div>
        <div class="board-header__right">
          <span v-if="selectedCount > 0" class="board-selected-count">{{
            t('gzRecycleAppointment.selectedCountRuns', { n: selectedCount, m: selectedRunCount })
          }}</span>
          <el-button v-hasPermi="['gz:recycle:appointment:hold']" type="primary" size="small" :disabled="selectedCount === 0" @click="openHoldDialog">
            {{ t('gzRecycleAppointment.holdAction') }}
          </el-button>
          <el-button v-if="selectedCount > 0" size="small" @click="clearSelection">{{ t('gzRecycleAppointment.clearSelection') }}</el-button>
          <el-button link type="primary" size="small" @click="loadBoard">{{ t('gzRecycleAppointment.refresh') }}</el-button>
        </div>
      </div>
    </template>

    <div v-loading="loading">
      <div v-if="!storeId" class="board-empty">{{ t('gzRecycleAppointment.boardNoStore') }}</div>
      <div v-else-if="slots.length === 0" class="board-empty">{{ t('gzRecycleAppointment.boardNoSlot') }}</div>
      <div v-else class="board-matrix-wrap">
        <!-- 图例（GZ-RECYCLE-012：行数从 3 变成 ~12，没图例店员扫不动） -->
        <div class="board-legend">
          <span class="board-legend__item"><i class="board-legend__dot is-customer"></i>{{ t('gzRecycleAppointment.legendCustomer') }}</span>
          <span class="board-legend__item"><i class="board-legend__dot is-manual"></i>{{ t('gzRecycleAppointment.legendManual') }}</span>
          <span class="board-legend__item"><i class="board-legend__dot is-idle"></i>{{ t('gzRecycleAppointment.legendIdle') }}</span>
          <span class="board-legend__hint">{{ t('gzRecycleAppointment.shiftSelectHint') }}</span>
        </div>
        <table class="board-matrix">
          <thead>
            <tr>
              <th class="board-matrix__corner"></th>
              <th v-for="day in days" :key="day.date" class="board-matrix__day-head" :class="{ 'is-today': day.isToday }">
                <div class="board-matrix__day-date">{{ day.md }}</div>
                <div class="board-matrix__day-week">{{ day.weekLabel }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(slot, rowIdx) in slots" :key="slot.startTime" :class="{ 'is-window-start': isWindowStart(rowIdx) }">
              <th class="board-matrix__slot-head" :class="{ 'is-out-of-window': slot.outOfWindow }">
                {{ hhmm(slot.startTime) }}
                <el-tooltip v-if="slot.outOfWindow" :content="t('gzRecycleAppointment.outOfWindowHint')">
                  <el-icon class="board-matrix__warn"><Warning /></el-icon>
                </el-tooltip>
              </th>
              <!-- 预计算 matrix：skip 单元格由上方 block 的 rowspan 覆盖，不渲染 -->
              <template v-for="(day, colIdx) in days" :key="`${day.date}-${slot.startTime}`">
                <td
                  v-if="matrix[rowIdx][colIdx].type !== 'skip'"
                  class="board-matrix__td"
                  :rowspan="matrix[rowIdx][colIdx].type === 'block' ? matrix[rowIdx][colIdx].rowspan : 1"
                >
                  <!-- 空闲：可多选（shift+click 同列区间选） -->
                  <div
                    v-if="matrix[rowIdx][colIdx].type === 'idle'"
                    class="board-cell board-cell--idle"
                    :class="{ 'is-selected': isSelected(day.date, slot.startTime) }"
                    data-cell-kind="idle"
                    :data-cell-date="day.date"
                    :data-cell-slot="slot.startTime"
                    @click="onIdleClick($event, day.date, rowIdx, colIdx)"
                  ></div>

                  <!-- 占用区间块：一单一块，rowspan 合并；点块开 popover 承载全部动作 -->
                  <el-popover v-else placement="right" trigger="click" :width="230">
                    <template #reference>
                      <div
                        class="board-cell"
                        :class="matrix[rowIdx][colIdx].block!.kind === 'manual' ? 'board-cell--manual' : 'board-cell--customer'"
                        :data-cell-kind="matrix[rowIdx][colIdx].block!.kind"
                        :data-cell-date="day.date"
                        :data-cell-slot="slot.startTime"
                      >
                        <template v-if="matrix[rowIdx][colIdx].block!.kind === 'manual'">
                          <div class="board-cell__remark" :title="matrix[rowIdx][colIdx].block!.remark || ''">
                            {{ t('gzRecycleAppointment.manualLabel', { remark: matrix[rowIdx][colIdx].block!.remark || '' }) }}
                          </div>
                        </template>
                        <template v-else>
                          <div class="board-cell__line1">
                            {{ mobileLast4(matrix[rowIdx][colIdx].block!.mobileSnapshot) }} ·
                            {{ matrix[rowIdx][colIdx].block!.qtyBucketLabel || '-' }}
                          </div>
                          <div class="board-cell__line2">
                            <dict-tag :options="statusDict" :value="matrix[rowIdx][colIdx].block!.status" />
                            <span class="board-cell__range">{{ blockRange(matrix[rowIdx][colIdx].block!) }}</span>
                          </div>
                        </template>
                      </div>
                    </template>

                    <div class="board-pop">
                      <div class="board-pop__title">{{ matrix[rowIdx][colIdx].block!.appointmentNo || '-' }}</div>
                      <div class="board-pop__meta">{{ blockRange(matrix[rowIdx][colIdx].block!) }}</div>
                      <div class="board-pop__acts">
                        <el-button
                          v-if="matrix[rowIdx][colIdx].block!.kind === 'customer'"
                          link
                          type="primary"
                          size="small"
                          @click="emit('detail', matrix[rowIdx][colIdx].block!.appointmentId)"
                        >
                          {{ t('gzRecycleAppointment.detail') }}
                        </el-button>
                        <el-button
                          v-if="canReschedule(matrix[rowIdx][colIdx].block!)"
                          v-hasPermi="['gz:recycle:appointment:reschedule']"
                          link
                          type="primary"
                          size="small"
                          @click="onRescheduleClick(day.date, matrix[rowIdx][colIdx].block!)"
                        >
                          {{ t('gzRecycleAppointment.reschedule') }}
                        </el-button>
                        <el-button
                          v-if="matrix[rowIdx][colIdx].block!.kind === 'manual'"
                          v-hasPermi="['gz:recycle:appointment:hold']"
                          link
                          type="danger"
                          size="small"
                          @click="onReleaseClick(matrix[rowIdx][colIdx].block!)"
                        >
                          {{ t('gzRecycleAppointment.release') }}
                        </el-button>
                        <!-- GZ-RECYCLE-014：顾客爽约单手动释放（prod SnailJob 没部署，no_show cron 从来没跑过） -->
                        <el-button
                          v-if="canCancel(matrix[rowIdx][colIdx].block!)"
                          v-hasPermi="['gz:recycle:appointment:hold']"
                          link
                          type="danger"
                          size="small"
                          @click="onCancelClick(matrix[rowIdx][colIdx].block!)"
                        >
                          {{ t('gzRecycleAppointment.cancelCustomer') }}
                        </el-button>
                      </div>
                    </div>
                  </el-popover>
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </el-card>

  <ManualHoldDialog ref="holdDialogRef" @success="onHoldSuccess" @fail="refreshAfterFailure" />
  <RescheduleDialog ref="rescheduleDialogRef" @success="onRescheduleSuccess" @fail="refreshAfterFailure" />
</template>

<script setup lang="ts" name="WeekBoard">
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  getWeekBoard,
  releaseHold,
  cancelCustomerAppointment,
  type RecycleWeekBoardVO,
  type RecycleBoardSlotVO,
  type RecycleBoardCellVO
} from '@/api/gz-recycle/appointment';
import { Warning } from '@element-plus/icons-vue';
import type { GzBeanStoreVO } from '@/api/gz-bean/store';
import ManualHoldDialog from './ManualHoldDialog.vue';
import RescheduleDialog from './RescheduleDialog.vue';

const { t } = useI18n();

const props = defineProps<{
  storeOptions: GzBeanStoreVO[];
  /** gz_recycle_status 字典（复用页面已 useDict 的实例，避免重复请求字典） */
  statusDict: Array<{ label: string; value: string }>;
}>();

const emit = defineEmits<{
  (e: 'detail', id: string): void;
  (e: 'hold'): void;
  (e: 'reschedule'): void;
  (e: 'release'): void;
}>();

const loading = ref(false);
const storeId = ref<number | string | undefined>(undefined);
const weekStart = ref<Date>(mondayOfWeek(todayDate()));
const board = ref<RecycleWeekBoardVO | null>(null);

const holdDialogRef = ref<InstanceType<typeof ManualHoldDialog>>();
const rescheduleDialogRef = ref<InstanceType<typeof RescheduleDialog>>();

const selectedCells = ref<Map<string, { apptDate: string; slotStart: string; slotLabel: string }>>(new Map());
const selectedCount = computed(() => selectedCells.value.size);
/** 已选格合并成的连续段数（店员看「已选 4 格（2 段）」比「已选 4 格」有用得多） */
const selectedRunCount = computed(() => mergeRuns([...selectedCells.value.values()]).length);

const slots = computed<RecycleBoardSlotVO[]>(() => board.value?.slots ?? []);

/** 占用区间块按「date|块起点」索引 */
const blocksByStart = computed(() => {
  const m = new Map<string, RecycleBoardCellVO>();
  for (const c of board.value?.cells ?? []) {
    m.set(`${c.apptDate}|${c.slotStart}`, c);
  }
  return m;
});

/**
 * 预计算二维矩阵（GZ-RECYCLE-012 / ADR-0022）。
 *
 * 一单发一个块 + rowspan 合并渲染 —— 逐格渲会把一笔 4 小时单画成 4 个格，等于把旧模型的 spill
 * 噪音放大 4 倍。`skip` 单元格被上方 block 的 rowspan 覆盖，模板里 `v-if` 跳过不渲染
 * （`<td>` 没法用 v-if 优雅跳格，所以在 script 里先算好）。
 */
type MatrixCell = { type: 'idle' } | { type: 'skip' } | { type: 'block'; block: RecycleBoardCellVO; rowspan: number };

const matrix = computed<MatrixCell[][]>(() => {
  const rows = slots.value;
  const cols = days.value;
  const grid: MatrixCell[][] = rows.map(() => cols.map(() => ({ type: 'idle' }) as MatrixCell));
  const idxOf = new Map(rows.map((r, i) => [r.startTime, i]));

  for (let c = 0; c < cols.length; c++) {
    for (let r = 0; r < rows.length; r++) {
      if (grid[r][c].type === 'skip') continue;
      const block = blocksByStart.value.get(`${cols[c].date}|${rows[r].startTime}`);
      if (!block) continue;
      // 止点找不到行（块越出当前窗口）→ 铺到表尾，宁可多占一行也不能让块凭空消失
      const endIdx = idxOf.has(block.slotEnd) ? (idxOf.get(block.slotEnd) as number) : rows.length;
      const rowspan = Math.max(1, endIdx - r);
      grid[r][c] = { type: 'block', block, rowspan };
      for (let k = r + 1; k < r + rowspan && k < rows.length; k++) {
        grid[k][c] = { type: 'skip' };
      }
    }
  }
  return grid;
});

const WEEKDAY_KEYS = ['weekdaySun', 'weekdayMon', 'weekdayTue', 'weekdayWed', 'weekdayThu', 'weekdayFri', 'weekdaySat'];

interface DayCol {
  date: string;
  md: string;
  weekLabel: string;
  isToday: boolean;
}

const days = computed<DayCol[]>(() => {
  const todayStr = fmt(todayDate());
  const out: DayCol[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.value);
    d.setDate(d.getDate() + i);
    const dateStr = fmt(d);
    out.push({
      date: dateStr,
      md: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      weekLabel: t(`gzRecycleAppointment.${WEEKDAY_KEYS[d.getDay()]}`),
      isToday: dateStr === todayStr
    });
  }
  return out;
});

const weekRangeLabel = computed(() => {
  const end = new Date(weekStart.value);
  end.setDate(end.getDate() + 6);
  const md = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${md(weekStart.value)} ~ ${md(end)}`;
});

function todayDate(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** 本周一（周一起，ISO） */
function mondayOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=周日..6=周六
  const diff = day === 0 ? -6 : 1 - day;
  const r = new Date(d);
  r.setDate(d.getDate() + diff);
  return new Date(r.getFullYear(), r.getMonth(), r.getDate());
}

function shiftWeek(n: number) {
  const d = new Date(weekStart.value);
  d.setDate(d.getDate() + 7 * n);
  weekStart.value = d;
}
function resetWeek() {
  weekStart.value = mondayOfWeek(todayDate());
}

/** "HH:mm:ss" → "HH:mm" */
function hhmm(t9: string): string {
  return (t9 || '').slice(0, 5);
}
function blockRange(b: RecycleBoardCellVO): string {
  return `${hhmm(b.slotStart)}-${hhmm(b.slotEnd)}`;
}
/** 窗口边界行（与上一行不连续）→ 加粗分隔线，把午休断档在视觉上说清楚 */
function isWindowStart(rowIdx: number): boolean {
  if (rowIdx === 0) return true;
  return slots.value[rowIdx - 1]?.endTime !== slots.value[rowIdx]?.startTime;
}
function mobileLast4(mobile?: string | null): string {
  if (!mobile || mobile.length < 4) return mobile || '-';
  return mobile.slice(-4);
}
/** 仅 submitted（顾客单）/ manual_hold（手动占用）可改期，其余前端先挡一道（后端 4128 兜底） */
function canReschedule(b: RecycleBoardCellVO): boolean {
  return b.kind === 'manual' || b.status === 'submitted';
}
/**
 * 仅 submitted / confirmed_onsite 的顾客单可取消（GZ-RECYCLE-014）。
 * 回收是反向打款：paying / paid / payout_failed 有钱在途或已出账，后端 4132 兜底。
 */
function canCancel(b: RecycleBoardCellVO): boolean {
  return b.kind === 'customer' && (b.status === 'submitted' || b.status === 'confirmed_onsite');
}

function isSelected(date: string, slotStart: string): boolean {
  return selectedCells.value.has(`${date}|${slotStart}`);
}

/** shift+click：同列从上次锚点到本格区间全选（占「周六下午全天」时点 5 次很烦） */
const lastAnchor = ref<{ col: number; row: number } | null>(null);

function onIdleClick(evt: MouseEvent, date: string, rowIdx: number, colIdx: number) {
  if (evt.shiftKey && lastAnchor.value && lastAnchor.value.col === colIdx) {
    const from = Math.min(lastAnchor.value.row, rowIdx);
    const to = Math.max(lastAnchor.value.row, rowIdx);
    const next = new Map(selectedCells.value);
    for (let r = from; r <= to; r++) {
      if (matrix.value[r][colIdx].type !== 'idle') continue;
      const st = slots.value[r].startTime;
      next.set(`${date}|${st}`, { apptDate: date, slotStart: st, slotLabel: hhmm(st) });
    }
    selectedCells.value = next;
    return;
  }
  lastAnchor.value = { col: colIdx, row: rowIdx };
  toggleSelect(date, slots.value[rowIdx]);
}

function toggleSelect(date: string, slot: RecycleBoardSlotVO) {
  const key = `${date}|${slot.startTime}`;
  const next = new Map(selectedCells.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.set(key, { apptDate: date, slotStart: slot.startTime, slotLabel: hhmm(slot.startTime) });
  }
  selectedCells.value = next;
}
function clearSelection() {
  selectedCells.value = new Map();
  lastAnchor.value = null;
}

/** 相邻格合并成段（跨午休 gap 天然不合并 —— 判定用 prev.end === cur.start） */
function mergeRuns(cells: Array<{ apptDate: string; slotStart: string }>) {
  const byDay = new Map<string, string[]>();
  for (const c of cells) {
    if (!byDay.has(c.apptDate)) byDay.set(c.apptDate, []);
    (byDay.get(c.apptDate) as string[]).push(c.slotStart);
  }
  const runs: Array<{ apptDate: string; start: string; end: string; count: number }> = [];
  for (const [date, starts] of byDay) {
    const sorted = [...starts].sort();
    let runStart = sorted[0];
    let prev = sorted[0];
    let count = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (addOneHour(prev) === sorted[i]) {
        prev = sorted[i];
        count++;
      } else {
        runs.push({ apptDate: date, start: runStart, end: addOneHour(prev), count });
        runStart = sorted[i];
        prev = sorted[i];
        count = 1;
      }
    }
    runs.push({ apptDate: date, start: runStart, end: addOneHour(prev), count });
  }
  return runs;
}
function addOneHour(t9: string): string {
  const h = Number((t9 || '00:00:00').slice(0, 2));
  return `${String(h + 1).padStart(2, '0')}:00:00`;
}

function onRescheduleClick(date: string, block: RecycleBoardCellVO) {
  const store = props.storeOptions.find((s) => String(s.id) === String(storeId.value));
  rescheduleDialogRef.value?.open({
    id: block.appointmentId,
    appointmentNo: block.appointmentNo || '',
    storeId: storeId.value as string | number,
    storeName: store?.name,
    apptDate: date,
    slotLabel: blockRange(block),
    spanHours: block.spanHours || 1,
    // 手动占用（店员台账）可挪到过去；顾客单不可（会被 no_show 判过期，后端 4130）
    allowPastDate: block.kind === 'manual'
  });
}

async function onReleaseClick(block: RecycleBoardCellVO) {
  try {
    await ElMessageBox.confirm(t('gzRecycleAppointment.releaseConfirm'), t('gzRecycleAppointment.tip'), { type: 'warning' });
  } catch {
    return;
  }
  try {
    await releaseHold(block.appointmentId);
    ElMessage.success(t('gzRecycleAppointment.releaseOk'));
    emit('release');
    await loadBoard();
  } catch {
    // 4129（该行已被并发释放 / 不是手动占用记录）是业务预期拒绝：后端 msg 已由全局拦截器 toast，
    // 不打 console.error。失败即刷看板 —— 本地视图此刻必然与库不一致。
    await refreshAfterFailure();
  }
}

/** 取消顾客单（GZ-RECYCLE-014）：文案必须点明「该时段立即释放，可被他人预约」 */
async function onCancelClick(block: RecycleBoardCellVO) {
  try {
    await ElMessageBox.confirm(t('gzRecycleAppointment.cancelCustomerConfirm', { range: blockRange(block) }), t('gzRecycleAppointment.tip'), {
      type: 'warning'
    });
  } catch {
    return;
  }
  try {
    await cancelCustomerAppointment(block.appointmentId);
    ElMessage.success(t('gzRecycleAppointment.cancelCustomerOk'));
    emit('release');
    await loadBoard();
  } catch {
    await refreshAfterFailure();
  }
}

function openHoldDialog() {
  if (!storeId.value || selectedCount.value === 0) return;
  holdDialogRef.value?.open({
    storeId: storeId.value,
    cells: [...selectedCells.value.values()],
    runs: mergeRuns([...selectedCells.value.values()])
  });
}
async function onHoldSuccess() {
  clearSelection();
  emit('hold');
  await loadBoard();
}
async function onRescheduleSuccess() {
  emit('reschedule');
  await loadBoard();
}

/**
 * 任一操作被后端拒绝后拉回真相态：重载看板 + 清掉已不再空闲的选中格。
 *
 * 失败路径不刷新 = 店员对着一份已过期的视图继续操作（并发释放/改期后本地仍显示可点的占用格），
 * 且残留的选中格会在下一次「手动占用」里再次提交必然失败的格。
 */
async function refreshAfterFailure() {
  await loadBoard();
  pruneSelection();
}

/** 清掉已被他人占走（不再 idle）的选中格 */
function pruneSelection() {
  if (selectedCells.value.size === 0) return;
  const next = new Map(selectedCells.value);
  const rowIdx = new Map(slots.value.map((r, i) => [r.startTime, i]));
  const colIdx = new Map(days.value.map((d, i) => [d.date, i]));
  for (const [key, sel] of selectedCells.value) {
    const r = rowIdx.get(sel.slotStart);
    const c = colIdx.get(sel.apptDate);
    if (r === undefined || c === undefined || matrix.value[r][c].type !== 'idle') {
      next.delete(key);
    }
  }
  selectedCells.value = next;
}

async function loadBoard() {
  if (!storeId.value) {
    board.value = null;
    return;
  }
  loading.value = true;
  try {
    const res = await getWeekBoard(storeId.value, fmt(weekStart.value));
    board.value = res.data ?? null;
  } catch {
    board.value = null;
  } finally {
    loading.value = false;
  }
}

// 切门店 / 切周各触发一次 week-board 请求（AC1）：选中态跟着清空，避免残留不可见格的选择
watch(storeId, () => {
  clearSelection();
  loadBoard();
});
watch(weekStart, () => {
  clearSelection();
  loadBoard();
});

// storeOptions 异步加载到位后，默认选第一个门店（仅当尚未选择时）
watch(
  () => props.storeOptions,
  (opts) => {
    if (!storeId.value && opts && opts.length > 0) {
      storeId.value = opts[0].id;
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (storeId.value) loadBoard();
});

defineExpose({ reload: loadBoard });
</script>

<style scoped>
.board-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.board-header__left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.board-header__right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.board-week-switch {
  display: flex;
  align-items: center;
  gap: 4px;
}
.board-week-range {
  margin-left: 6px;
  font-size: 13px;
  color: #606266;
}
.board-selected-count {
  font-size: 13px;
  color: var(--el-color-primary);
}
.board-empty {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: #909399;
}
.board-matrix-wrap {
  overflow-x: auto;
}
.board-matrix {
  width: 100%;
  min-width: 780px;
  border-collapse: collapse;
  table-layout: fixed;
}
.board-matrix th,
.board-matrix td {
  border: 1px solid #ebeef5;
  padding: 0;
}
.board-matrix__corner {
  width: 92px;
}
.board-matrix__slot-head {
  width: 92px;
  padding: 8px 6px;
  background: #f5f7fa;
  font-size: 12px;
  color: #303133;
  white-space: nowrap;
}
.board-matrix__day-head {
  padding: 6px 4px;
  background: #f5f7fa;
  text-align: center;
}
.board-matrix__day-head.is-today {
  background: var(--el-color-primary-light-8);
}
.board-matrix__day-date {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.board-matrix__day-week {
  font-size: 11px;
  color: #909399;
}
.board-matrix__td {
  height: 74px;
  vertical-align: top;
}
.board-cell {
  height: 100%;
  min-height: 74px;
  padding: 4px 6px;
  box-sizing: border-box;
  font-size: 12px;
}
.board-cell--idle {
  cursor: pointer;
  transition: background-color 0.12s ease;
}
.board-cell--idle:hover {
  background: var(--el-color-primary-light-9);
}
.board-cell--idle.is-selected {
  background: var(--el-color-primary-light-7);
  box-shadow: inset 0 0 0 2px var(--el-color-primary);
}
.board-cell--customer {
  cursor: pointer;
  background: var(--el-color-success-light-9);
}
.board-cell--manual {
  background: #f4f4f5;
}
.board-cell--spill {
  background: repeating-linear-gradient(45deg, #f5f5f5, #f5f5f5 6px, #ececec 6px, #ececec 12px);
  color: #909399;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  cursor: not-allowed;
}
.board-cell__mobile {
  font-weight: 600;
  color: #303133;
}
.board-cell__bucket {
  color: #606266;
}
.board-cell__status {
  margin-top: 2px;
}
.board-cell__remark {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #606266;
}
.board-cell__act {
  margin-top: 2px;
  display: flex;
  gap: 4px;
}
</style>
