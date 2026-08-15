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
          <span v-if="selectedCount > 0" class="board-selected-count">{{ t('gzRecycleAppointment.selectedCount', { n: selectedCount }) }}</span>
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
            <tr v-for="slot in slots" :key="slot.id">
              <th class="board-matrix__slot-head">{{ slot.label }}</th>
              <td v-for="day in days" :key="`${day.date}-${slot.id}`" class="board-matrix__td">
                <!-- 空闲：可多选 -->
                <div
                  v-if="cellKind(day.date, slot.id) === 'idle'"
                  class="board-cell board-cell--idle"
                  :class="{ 'is-selected': isSelected(day.date, slot.id) }"
                  data-cell-kind="idle"
                  :data-cell-date="day.date"
                  :data-cell-slot="slot.id"
                  @click="toggleSelect(day.date, slot)"
                ></div>

                <!-- 顾客单 -->
                <div
                  v-else-if="cellKind(day.date, slot.id) === 'customer'"
                  class="board-cell board-cell--customer"
                  data-cell-kind="customer"
                  :data-cell-date="day.date"
                  :data-cell-slot="slot.id"
                  @click="onCustomerClick(day.date, slot.id)"
                >
                  <div class="board-cell__mobile">{{ mobileLast4(cellAt(day.date, slot.id)?.mobileSnapshot) }}</div>
                  <div class="board-cell__bucket">{{ cellAt(day.date, slot.id)?.qtyBucketLabel || '-' }}</div>
                  <dict-tag :options="statusDict" :value="cellAt(day.date, slot.id)?.status" class="board-cell__status" />
                  <div v-if="cellAt(day.date, slot.id)?.status === 'submitted'" class="board-cell__act">
                    <el-button
                      v-hasPermi="['gz:recycle:appointment:reschedule']"
                      link
                      type="primary"
                      size="small"
                      @click.stop="onRescheduleClick(day.date, slot.id)"
                    >
                      {{ t('gzRecycleAppointment.reschedule') }}
                    </el-button>
                  </div>
                </div>

                <!-- 手动占用 -->
                <div
                  v-else-if="cellKind(day.date, slot.id) === 'manual'"
                  class="board-cell board-cell--manual"
                  data-cell-kind="manual"
                  :data-cell-date="day.date"
                  :data-cell-slot="slot.id"
                >
                  <div class="board-cell__remark" :title="cellAt(day.date, slot.id)?.remark || ''">
                    {{ t('gzRecycleAppointment.manualLabel', { remark: cellAt(day.date, slot.id)?.remark || '' }) }}
                  </div>
                  <div class="board-cell__act">
                    <el-button
                      v-hasPermi="['gz:recycle:appointment:reschedule']"
                      link
                      type="primary"
                      size="small"
                      @click.stop="onRescheduleClick(day.date, slot.id)"
                    >
                      {{ t('gzRecycleAppointment.reschedule') }}
                    </el-button>
                    <el-button
                      v-hasPermi="['gz:recycle:appointment:hold']"
                      link
                      type="danger"
                      size="small"
                      @click.stop="onReleaseClick(day.date, slot.id)"
                    >
                      {{ t('gzRecycleAppointment.release') }}
                    </el-button>
                  </div>
                </div>

                <!-- 溢出占用：无任何操作，提示请操作源单 -->
                <div
                  v-else
                  class="board-cell board-cell--spill"
                  data-cell-kind="spill"
                  :data-cell-date="day.date"
                  :data-cell-slot="slot.id"
                  :title="t('gzRecycleAppointment.spillHint')"
                >
                  {{ t('gzRecycleAppointment.spillLabel', { no: cellAt(day.date, slot.id)?.appointmentNo || '-' }) }}
                </div>
              </td>
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
import { getWeekBoard, releaseHold, type RecycleWeekBoardVO, type RecycleBoardSlotVO, type RecycleBoardCellVO } from '@/api/gz-recycle/appointment';
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

const selectedCells = ref<Map<string, { apptDate: string; timeSlotId: string; slotLabel: string }>>(new Map());
const selectedCount = computed(() => selectedCells.value.size);

const slots = computed<RecycleBoardSlotVO[]>(() => board.value?.slots ?? []);

/** 被占格 Map（`date|slotId` → CellVO），供 O(1) 查格 */
const cellsMap = computed(() => {
  const m = new Map<string, RecycleBoardCellVO>();
  for (const c of board.value?.cells ?? []) {
    m.set(`${c.apptDate}|${c.timeSlotId}`, c);
  }
  return m;
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

function cellAt(date: string, slotId: string | number): RecycleBoardCellVO | undefined {
  return cellsMap.value.get(`${date}|${slotId}`);
}
function cellKind(date: string, slotId: string | number): 'idle' | 'customer' | 'manual' | 'spill' {
  return cellAt(date, slotId)?.kind ?? 'idle';
}
function mobileLast4(mobile?: string | null): string {
  if (!mobile || mobile.length < 4) return mobile || '-';
  return mobile.slice(-4);
}

function isSelected(date: string, slotId: string | number): boolean {
  return selectedCells.value.has(`${date}|${slotId}`);
}
function toggleSelect(date: string, slot: RecycleBoardSlotVO) {
  const key = `${date}|${slot.id}`;
  const next = new Map(selectedCells.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.set(key, { apptDate: date, timeSlotId: slot.id, slotLabel: slot.label });
  }
  selectedCells.value = next;
}
function clearSelection() {
  selectedCells.value = new Map();
}

function onCustomerClick(date: string, slotId: string | number) {
  const cell = cellAt(date, slotId);
  if (cell?.appointmentId) emit('detail', cell.appointmentId);
}

function onRescheduleClick(date: string, slotId: string | number) {
  const cell = cellAt(date, slotId);
  const slot = slots.value.find((s) => s.id === String(slotId));
  if (!cell || !slot) return;
  const store = props.storeOptions.find((s) => String(s.id) === String(storeId.value));
  rescheduleDialogRef.value?.open({
    id: cell.appointmentId,
    appointmentNo: cell.appointmentNo || '',
    storeName: store?.name,
    apptDate: date,
    slotLabel: slot.label,
    slotOptions: slots.value,
    // 手动占用（店员台账）可挪到过去；顾客单不可（会被 no_show 判过期，后端 4130）
    allowPastDate: cell.kind === 'manual'
  });
}

async function onReleaseClick(date: string, slotId: string | number) {
  const cell = cellAt(date, slotId);
  if (!cell) return;
  try {
    await ElMessageBox.confirm(t('gzRecycleAppointment.releaseConfirm'), t('gzRecycleAppointment.tip'), { type: 'warning' });
  } catch {
    return;
  }
  try {
    await releaseHold(cell.appointmentId);
    ElMessage.success(t('gzRecycleAppointment.releaseOk'));
    emit('release');
    await loadBoard();
  } catch {
    // 4129（该行已被并发释放 / 不是手动占用记录）是业务预期拒绝：后端 msg 已由全局拦截器 toast，
    // 不打 console.error（AC15 console 0 error）。失败即刷看板 —— 本地视图此刻必然与库不一致
    // （典型：另一个店员刚释放了同一格，本页仍渲染成可操作的占用格）。
    await refreshAfterFailure();
  }
}

function openHoldDialog() {
  if (!storeId.value || selectedCount.value === 0) return;
  holdDialogRef.value?.open({ storeId: storeId.value, cells: [...selectedCells.value.values()] });
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
  for (const [key, sel] of selectedCells.value) {
    if (cellKind(sel.apptDate, sel.timeSlotId) !== 'idle') {
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
