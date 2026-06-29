<template>
  <div class="p-2">
    <el-card v-loading="pageLoading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzBeanBoard.title') }}</span>
          <span class="ticket-tag">GZ-BEAN-028</span>
        </div>
      </template>

      <el-alert :title="t('gzBeanBoard.alertTitle')" type="info" :description="t('gzBeanBoard.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 筛选 + 操作 -->
      <el-form inline class="mb-2" @submit.prevent="loadBoard">
        <el-form-item :label="t('gzBeanBoard.store')">
          <el-select v-model="currentStoreId" filterable style="width: 220px" @change="onStoreChange">
            <el-option v-for="s in storeOptions" :key="s.id" :label="`${s.storeNo} · ${s.name}`" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanBoard.date')">
          <el-date-picker
            v-model="sessDate"
            type="date"
            value-format="YYYY-MM-DD"
            :clearable="false"
            :placeholder="t('gzBeanBoard.datePlaceholder')"
            style="width: 160px"
            @change="loadBoard"
          />
        </el-form-item>
        <el-form-item>
          <el-button v-hasPermi="['gz:bean:board:view']" type="primary" :icon="Search" :disabled="!currentStoreId" @click="loadBoard">
            {{ t('gzBeanBoard.query') }}
          </el-button>
          <el-button :icon="Refresh" :disabled="!currentStoreId" @click="loadBoard">{{ t('gzBeanBoard.refresh') }}</el-button>
        </el-form-item>
        <el-form-item>
          <el-switch v-model="autoRefresh" :active-text="t('gzBeanBoard.autoRefresh')" inline-prompt />
        </el-form-item>
      </el-form>

      <!-- 状态图例 + 统计 -->
      <div class="board-legend mb-3">
        <el-tag v-for="st in legendStatuses" :key="st" :type="statusTagType(st)" effect="plain" size="small" class="legend-item">
          {{ t(`gzBeanBoard.status.${st}`) }}
          <span class="legend-count">{{ statusCount(st) }}</span>
        </el-tag>
        <span class="board-clock">{{ t('gzBeanBoard.now') }}：{{ nowLabel }}</span>
      </div>

      <!-- 看板：按分区 → 桌型 分组渲染座位单元卡片 -->
      <el-empty v-if="!listLoading && rows.length === 0" :description="t('gzBeanBoard.empty')" />
      <div v-else v-loading="listLoading" class="board-zones">
        <div v-for="group in groupedRows" :key="group.key" class="board-zone">
          <div class="board-zone__head">
            <span class="board-zone__zone">{{ group.zone }}</span>
            <span class="board-zone__type">{{ group.typeName }}</span>
            <el-tag v-if="group.bookMode" :type="group.bookMode === 'seat' ? 'warning' : 'success'" size="small" class="ml-1">
              {{ group.bookMode === 'seat' ? t('gzBeanBoard.bookModeSeat') : t('gzBeanBoard.bookModeWhole') }}
            </el-tag>
          </div>
          <div class="board-seat-grid">
            <div
              v-for="row in group.seats"
              :key="row.seatId"
              class="board-seat"
              :class="[`is-${row.boardStatus}`]"
              @click="openDetail(row)"
            >
              <div class="board-seat__no">
                {{ row.seatNo }}
                <span v-if="row.tableNo" class="board-seat__table">{{ row.tableNo }}</span>
              </div>
              <div class="board-seat__status">{{ t(`gzBeanBoard.status.${row.boardStatus}`) }}</div>
              <div v-if="isOccupied(row)" class="board-seat__meta">
                <div v-if="row.bookingNo" class="board-seat__line">{{ row.bookingNo }}</div>
                <div v-if="row.mobileSnapshot" class="board-seat__line">{{ t('gzBeanBoard.mobileTail') }} {{ mobileTail(row.mobileSnapshot) }}</div>
                <div v-if="row.slotStart && row.slotEnd" class="board-seat__line">{{ hhmm(row.slotStart) }} - {{ hhmm(row.slotEnd) }}</div>
              </div>
              <div v-if="showCountdown(row)" class="board-seat__countdown" :class="{ 'is-near': row.boardStatus === 'near_end' }">
                {{ countdownLabel(row) }}
              </div>
              <el-tag v-if="row.isFree === 1" type="danger" size="small" effect="plain" class="board-seat__free">
                {{ t('gzBeanBoard.freeTag') }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 座位当前单详情 + 操作抽屉 -->
    <el-drawer v-model="detailVisible" :title="t('gzBeanBoard.detailTitle')" size="420px" direction="rtl">
      <template v-if="activeRow">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item :label="t('gzBeanBoard.colSeatNo')">
            {{ activeRow.seatNo }}<span v-if="activeRow.tableNo"> / {{ activeRow.tableNo }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colZone')">{{ activeRow.zone || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colTypeName')">{{ activeRow.typeName || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colBoardStatus')">
            <el-tag :type="statusTagType(activeRow.boardStatus)" effect="plain" size="small">
              {{ t(`gzBeanBoard.status.${activeRow.boardStatus}`) }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <el-descriptions v-if="isOccupied(activeRow)" :column="1" border size="small" class="mt-3" :title="t('gzBeanBoard.bookingSection')">
          <el-descriptions-item :label="t('gzBeanBoard.colBookingNo')">{{ activeRow.bookingNo || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colMobile')">{{ activeRow.mobileSnapshot || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colSlot')">
            <template v-if="activeRow.slotStart && activeRow.slotEnd">{{ hhmm(activeRow.slotStart) }} - {{ hhmm(activeRow.slotEnd) }}</template>
            <template v-else>-</template>
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colVerifyTime')">{{ activeRow.verifyTime || '-' }}</el-descriptions-item>
          <el-descriptions-item v-if="activeRow.actualEndTime" :label="t('gzBeanBoard.colActualEndTime')">{{ activeRow.actualEndTime }}</el-descriptions-item>
          <el-descriptions-item v-if="showCountdown(activeRow)" :label="t('gzBeanBoard.colRemaining')">{{ countdownLabel(activeRow) }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colIsFree')">
            {{ activeRow.isFree === 1 ? t('gzBeanBoard.freeTag') : t('gzBeanBoard.paidTag') }}
          </el-descriptions-item>
        </el-descriptions>

        <div v-else class="board-detail-idle mt-3">{{ t('gzBeanBoard.idleHint') }}</div>

        <!-- 操作：仅 in_use / near_end / overtime（已核销在店）可放座 / 延时 -->
        <div v-if="canOperate(activeRow)" class="board-actions mt-4">
          <el-button
            v-hasPermi="['gz:bean:booking:verify']"
            type="warning"
            :icon="CircleClose"
            :loading="releasing"
            @click="handleRelease(activeRow)"
          >
            {{ t('gzBeanBoard.releaseSeat') }}
          </el-button>
          <el-button v-hasPermi="['gz:bean:booking:verify']" type="primary" :icon="Timer" :loading="extending" @click="openExtend(activeRow)">
            {{ t('gzBeanBoard.extend') }}
          </el-button>
        </div>
        <div v-if="canOperate(activeRow)" class="board-actions-hint mt-2">{{ t('gzBeanBoard.actionsHint') }}</div>
      </template>
    </el-drawer>

    <!-- 延时弹窗 -->
    <el-dialog v-model="extendVisible" :title="t('gzBeanBoard.extendTitle')" width="380px">
      <el-form label-width="100px">
        <el-form-item :label="t('gzBeanBoard.extendHours')">
          <el-input-number v-model="extendHours" :min="1" :max="12" :step="1" />
          <span class="form-hint">{{ t('gzBeanBoard.extendHoursHint') }}</span>
        </el-form-item>
      </el-form>
      <el-alert type="warning" :closable="false" show-icon :description="t('gzBeanBoard.extendNoPayHint')" />
      <template #footer>
        <el-button @click="extendVisible = false">{{ t('gzBeanBoard.cancel') }}</el-button>
        <el-button type="primary" :loading="extending" @click="handleExtend">{{ t('gzBeanBoard.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzBeanBoard">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { Search, Refresh, Timer, CircleClose } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { getGzBeanStoreOptions, type GzBeanStoreVO } from '@/api/gz-bean/store';
import { getGzBeanBoard, releaseGzBeanSeat, extendGzBeanBooking, type GzBeanBoardRowVO, type GzBeanBoardStatus } from '@/api/gz-bean/board';

const { t } = useI18n();

const pageLoading = ref(false);
const listLoading = ref(false);
const releasing = ref(false);
const extending = ref(false);

const storeOptions = ref<GzBeanStoreVO[]>([]);
const currentStoreId = ref<number | null>(null);
const sessDate = ref<string>(todayStr());

const rows = ref<GzBeanBoardRowVO[]>([]);

const legendStatuses: GzBeanBoardStatus[] = ['idle', 'reserved', 'in_use', 'near_end', 'overtime'];

// ============ 本地时钟（驱动倒计时刷新 + 看板自动重拉） ============
const autoRefresh = ref(true);
const now = ref(Date.now());
const nowLabel = computed(() => formatClock(now.value));
let tickTimer: ReturnType<typeof setInterval> | null = null;
let lastFetchAt = 0;

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatClock(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/** HH:mm:ss → HH:mm 显示 */
function hhmm(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function mobileTail(mobile: string): string {
  return mobile.length >= 4 ? mobile.slice(-4) : mobile;
}

// ============ 看板分组（分区 → 桌型 → 座位单元） ============
interface BoardGroup {
  key: string;
  zone: string;
  typeName: string;
  bookMode: string | null;
  seats: GzBeanBoardRowVO[];
}

const groupedRows = computed<BoardGroup[]>(() => {
  const map = new Map<string, BoardGroup>();
  for (const r of rows.value) {
    const zone = r.zone || t('gzBeanBoard.zoneDefault');
    const typeName = r.typeName || t('gzBeanBoard.typeUnknown');
    const key = `${r.zone || ''}__${r.seatTypeConfigId || ''}`;
    let g = map.get(key);
    if (!g) {
      g = { key, zone, typeName, bookMode: r.bookMode || null, seats: [] };
      map.set(key, g);
    }
    g.seats.push(r);
  }
  return Array.from(map.values());
});

// ============ 状态/倒计时辅助 ============
function statusTagType(st: GzBeanBoardStatus): 'info' | 'warning' | 'success' | 'danger' | 'primary' {
  switch (st) {
    case 'idle':
      return 'info';
    case 'reserved':
      return 'primary';
    case 'in_use':
      return 'success';
    case 'near_end':
      return 'warning';
    case 'overtime':
      return 'danger';
    default:
      return 'info';
  }
}

function statusCount(st: GzBeanBoardStatus): number {
  return rows.value.filter((r) => r.boardStatus === st).length;
}

/** 占用态（有当前活跃单）：非 idle */
function isOccupied(row: GzBeanBoardRowVO): boolean {
  return row.boardStatus !== 'idle' && !!row.currentBookingId;
}

/** 已核销在店（in_use / near_end / overtime）→ 可放座 / 延时 */
function canOperate(row: GzBeanBoardRowVO): boolean {
  return row.boardStatus === 'in_use' || row.boardStatus === 'near_end' || row.boardStatus === 'overtime';
}

/** 显示倒计时：in_use / near_end（后端回填 remainingMinutes），本地按秒细化 */
function showCountdown(row: GzBeanBoardRowVO): boolean {
  return (row.boardStatus === 'in_use' || row.boardStatus === 'near_end') && row.slotEnd != null;
}

/**
 * 倒计时文案：以后端计划 slot_end 为准，结合 sessDate + 本地时钟实时刷新到分秒。
 * 已过界（< 0）→ 显「即将结束」兜底（后端会在下次重拉时转 overtime）。
 */
function countdownLabel(row: GzBeanBoardRowVO): string {
  const endMs = slotEndMs(row);
  if (endMs == null) {
    // 无法解析时回退后端粗粒度分钟
    if (row.remainingMinutes != null && row.remainingMinutes > 0) {
      return t('gzBeanBoard.remainMinutes', { n: row.remainingMinutes });
    }
    return t('gzBeanBoard.endingSoon');
  }
  const diff = endMs - now.value;
  if (diff <= 0) return t('gzBeanBoard.endingSoon');
  const totalSec = Math.floor(diff / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return t('gzBeanBoard.remainCountdown', { m, s: String(s).padStart(2, '0') });
}

/** 由 sessDate + slotEnd(HH:mm:ss) 组装该单计划结束的本地时间戳 */
function slotEndMs(row: GzBeanBoardRowVO): number | null {
  if (!row.slotEnd) return null;
  const parts = row.slotEnd.split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const mi = Number(parts[1]);
  const se = parts.length >= 3 ? Number(parts[2]) : 0;
  if (Number.isNaN(h) || Number.isNaN(mi)) return null;
  const [y, mo, d] = sessDate.value.split('-').map((x) => Number(x));
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return null;
  return new Date(y, mo - 1, d, h, mi, se).getTime();
}

// ============ 数据加载 ============
async function loadStoreOptions() {
  pageLoading.value = true;
  try {
    const resp = await getGzBeanStoreOptions();
    const r = resp as any;
    storeOptions.value = (r.data || r || []) as GzBeanStoreVO[];
    if (storeOptions.value.length > 0 && currentStoreId.value == null) {
      currentStoreId.value = storeOptions.value[0].id;
      await loadBoard();
    }
  } catch (e) {
    console.error('[gz-bean-board] loadStoreOptions failed', e);
    ElMessage.error(t('gzBeanBoard.loadFailed'));
  } finally {
    pageLoading.value = false;
  }
}

async function onStoreChange(id: number) {
  currentStoreId.value = id;
  await loadBoard();
}

async function loadBoard() {
  if (currentStoreId.value == null) return;
  listLoading.value = true;
  try {
    const resp = await getGzBeanBoard(currentStoreId.value, sessDate.value);
    rows.value = ((resp as any).data || []) as GzBeanBoardRowVO[];
    lastFetchAt = Date.now();
    // 抽屉打开时同步刷新当前选中座位
    if (detailVisible.value && activeRow.value) {
      const next = rows.value.find((r) => r.seatId === activeRow.value!.seatId);
      activeRow.value = next || null;
      if (!next) detailVisible.value = false;
    }
  } catch (e) {
    console.error('[gz-bean-board] loadBoard failed', e);
    ElMessage.error(t('gzBeanBoard.loadFailed'));
  } finally {
    listLoading.value = false;
  }
}

// ============ 详情抽屉 ============
const detailVisible = ref(false);
const activeRow = ref<GzBeanBoardRowVO | null>(null);

function openDetail(row: GzBeanBoardRowVO) {
  activeRow.value = row;
  detailVisible.value = true;
}

// ============ 提前放座 ============
async function handleRelease(row: GzBeanBoardRowVO) {
  if (!row.currentBookingId) return;
  try {
    await ElMessageBox.confirm(t('gzBeanBoard.releaseConfirm', { no: row.seatNo, booking: row.bookingNo || '' }), t('gzBeanBoard.confirmTitle'), {
      type: 'warning'
    });
  } catch {
    return; // 取消
  }
  releasing.value = true;
  try {
    await releaseGzBeanSeat(row.currentBookingId);
    ElMessage.success(t('gzBeanBoard.releaseSuccess'));
    detailVisible.value = false;
    await loadBoard();
  } catch (e) {
    console.error('[gz-bean-board] release failed', e);
  } finally {
    releasing.value = false;
  }
}

// ============ 延时 ============
const extendVisible = ref(false);
const extendHours = ref(1);
const extendTargetId = ref<string | null>(null);

function openExtend(row: GzBeanBoardRowVO) {
  if (!row.currentBookingId) return;
  extendTargetId.value = row.currentBookingId;
  extendHours.value = 1;
  extendVisible.value = true;
}

async function handleExtend() {
  if (!extendTargetId.value) return;
  extending.value = true;
  try {
    await extendGzBeanBooking(extendTargetId.value, extendHours.value);
    ElMessage.success(t('gzBeanBoard.extendSuccess'));
    extendVisible.value = false;
    detailVisible.value = false;
    await loadBoard();
  } catch (e) {
    console.error('[gz-bean-board] extend failed', e);
  } finally {
    extending.value = false;
  }
}

// ============ 时钟 tick：每秒刷倒计时；每 30s 且开启自动刷新时重拉看板 ============
function startTick() {
  stopTick();
  tickTimer = setInterval(() => {
    now.value = Date.now();
    if (autoRefresh.value && currentStoreId.value != null && !listLoading.value && now.value - lastFetchAt >= 30000) {
      loadBoard();
    }
  }, 1000);
}

function stopTick() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

onMounted(() => {
  loadStoreOptions();
  startTick();
});

onBeforeUnmount(() => {
  stopTick();
});
</script>

<style scoped>
.ticket-tag {
  background: #f0f9ff;
  color: #0369a1;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.form-hint {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}
.board-legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.legend-item .legend-count {
  margin-left: 4px;
  font-weight: 600;
}
.board-clock {
  margin-left: auto;
  color: #606266;
  font-variant-numeric: tabular-nums;
}
.board-zones {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.board-zone__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-weight: 600;
}
.board-zone__zone {
  color: #303133;
}
.board-zone__type {
  color: #909399;
  font-weight: 400;
}
.board-seat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}
.board-seat {
  position: relative;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  transition:
    box-shadow 0.15s,
    transform 0.1s;
  min-height: 84px;
}
.board-seat:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  transform: translateY(-1px);
}
.board-seat__no {
  font-size: 15px;
  font-weight: 700;
  color: #303133;
}
.board-seat__table {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}
.board-seat__status {
  font-size: 12px;
  margin: 2px 0;
}
.board-seat__meta {
  font-size: 12px;
  color: #606266;
}
.board-seat__line {
  line-height: 1.5;
}
.board-seat__countdown {
  margin-top: 4px;
  font-size: 13px;
  font-weight: 600;
  color: #67c23a;
  font-variant-numeric: tabular-nums;
}
.board-seat__countdown.is-near {
  color: #e6a23c;
}
.board-seat__free {
  position: absolute;
  top: 8px;
  right: 8px;
}
/* 状态底色 */
.board-seat.is-idle {
  background: #fafafa;
}
.board-seat.is-reserved {
  background: #ecf5ff;
  border-color: #b3d8ff;
}
.board-seat.is-in_use {
  background: #f0f9eb;
  border-color: #c2e7b0;
}
.board-seat.is-near_end {
  background: #fdf6ec;
  border-color: #f3d19e;
}
.board-seat.is-overtime {
  background: #fef0f0;
  border-color: #fbc4c4;
}
.board-detail-idle {
  color: #909399;
  font-size: 13px;
}
.board-actions {
  display: flex;
  gap: 10px;
}
.board-actions-hint {
  color: #909399;
  font-size: 12px;
}
</style>
