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
        <el-form-item>
          <el-switch v-model="alertEnabled" :active-text="t('gzBeanBoard.alertSwitch')" inline-prompt />
        </el-form-item>
        <el-form-item>
          <el-switch v-model="soundEnabled" :active-text="t('gzBeanBoard.soundSwitch')" inline-prompt />
        </el-form-item>
      </el-form>

      <!-- ②待分座区（ADR-0016 §3/§5）：已付款待核销但未分配物理座位的预约 -->
      <div v-if="currentStoreId" class="pending-assign mb-3">
        <div class="pending-assign__head">
          <el-icon class="pending-assign__icon"><Bell /></el-icon>
          <span class="pending-assign__title">{{ t('gzBeanBoard.pendingTitle') }}</span>
          <el-badge :value="pendingRows.length" :max="99" type="warning" :hidden="pendingRows.length === 0" class="ml-1" />
          <el-button text size="small" :icon="Refresh" :loading="pendingLoading" class="ml-2" @click="loadPending">
            {{ t('gzBeanBoard.refresh') }}
          </el-button>
        </div>
        <el-empty v-if="!pendingLoading && pendingRows.length === 0" :description="t('gzBeanBoard.pendingEmpty')" :image-size="60" />
        <div v-else v-loading="pendingLoading" class="pending-grid">
          <div v-for="p in pendingRows" :key="p.id" class="pending-card">
            <div class="pending-card__main">
              <div class="pending-card__no">{{ p.bookingNo }}</div>
              <div class="pending-card__line">
                <el-tag size="small" type="info" effect="plain">{{ p.seatTypeSnapshot || p.seatType || t('gzBeanBoard.typeUnknown') }}</el-tag>
                <span class="pending-card__slot">{{ hhmm(p.slotStart) }} - {{ hhmm(p.slotEnd) }}</span>
              </div>
              <div v-if="p.mobileSnapshot" class="pending-card__line pending-card__mobile">
                {{ t('gzBeanBoard.mobileTail') }} {{ mobileTail(p.mobileSnapshot) }}
              </div>
            </div>
            <el-button v-hasPermi="['gz:bean:booking:verify']" type="primary" size="small" :icon="Select" @click="openAssign(p)">
              {{ t('gzBeanBoard.assignVerify') }}
            </el-button>
          </div>
        </div>
      </div>

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
            <div v-for="row in group.seats" :key="row.seatId" class="board-seat" :class="[`is-${row.boardStatus}`]" @click="openDetail(row)">
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
              <el-tag v-if="showCanExtend(row)" :type="row.canExtend ? 'success' : 'danger'" size="small" effect="plain" class="board-seat__extend">
                {{ row.canExtend ? t('gzBeanBoard.canExtendYes') : t('gzBeanBoard.canExtendNo') }}
              </el-tag>
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
          <el-descriptions-item v-if="activeRow.actualEndTime" :label="t('gzBeanBoard.colActualEndTime')">{{
            activeRow.actualEndTime
          }}</el-descriptions-item>
          <el-descriptions-item v-if="showCountdown(activeRow)" :label="t('gzBeanBoard.colRemaining')">{{
            countdownLabel(activeRow)
          }}</el-descriptions-item>
          <el-descriptions-item v-if="showCanExtend(activeRow)" :label="t('gzBeanBoard.colCanExtend')">
            <el-tag :type="activeRow.canExtend ? 'success' : 'danger'" effect="plain" size="small">
              {{ activeRow.canExtend ? t('gzBeanBoard.canExtendYes') : t('gzBeanBoard.canExtendNo') }}
            </el-tag>
          </el-descriptions-item>
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

    <!-- 分配座位并核销弹窗（②待分座 → 选空闲座 → verify?seatId=） -->
    <el-dialog v-model="assignVisible" :title="t('gzBeanBoard.assignTitle')" width="480px">
      <template v-if="assignTarget">
        <el-descriptions :column="1" border size="small" class="mb-3">
          <el-descriptions-item :label="t('gzBeanBoard.colBookingNo')">{{ assignTarget.bookingNo }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colTypeName')">
            {{ assignTarget.seatTypeSnapshot || assignTarget.seatType || t('gzBeanBoard.typeUnknown') }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colSlot')"
            >{{ hhmm(assignTarget.slotStart) }} - {{ hhmm(assignTarget.slotEnd) }}</el-descriptions-item
          >
        </el-descriptions>

        <div class="assign-seat-label">{{ t('gzBeanBoard.assignPickSeat') }}</div>
        <el-empty v-if="assignSeatOptions.length === 0" :description="t('gzBeanBoard.assignNoIdle')" :image-size="60" />
        <div v-else class="assign-seat-grid">
          <div
            v-for="seat in assignSeatOptions"
            :key="seat.seatId"
            class="assign-seat"
            :class="{ 'is-selected': selectedSeatId === seat.seatId }"
            @click="selectedSeatId = seat.seatId"
          >
            <div class="assign-seat__no">
              {{ seat.seatNo }}<span v-if="seat.tableNo" class="assign-seat__table">{{ seat.tableNo }}</span>
            </div>
            <div class="assign-seat__type">{{ seat.typeName || '-' }}</div>
          </div>
        </div>
        <el-alert
          v-if="assignSeatOptions.length === 0"
          type="warning"
          :closable="false"
          show-icon
          class="mt-2"
          :description="t('gzBeanBoard.assignNoIdleHint')"
        />
      </template>
      <template #footer>
        <el-button @click="assignVisible = false">{{ t('gzBeanBoard.cancel') }}</el-button>
        <el-button type="primary" :loading="assigning" :disabled="!selectedSeatId" @click="handleAssignVerify">
          {{ t('gzBeanBoard.assignConfirm') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzBeanBoard">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { Search, Refresh, Timer, CircleClose, Bell, Select } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { getGzBeanStoreOptions, type GzBeanStoreVO } from '@/api/gz-bean/store';
import {
  getGzBeanBoard,
  getGzBeanPendingAssign,
  verifyGzBeanBookingWithSeat,
  releaseGzBeanSeat,
  extendGzBeanBooking,
  type GzBeanBoardRowVO,
  type GzBeanBoardStatus,
  type GzBeanPendingAssignVO
} from '@/api/gz-bean/board';

const { t } = useI18n();

const pageLoading = ref(false);
const listLoading = ref(false);
const releasing = ref(false);
const extending = ref(false);

const storeOptions = ref<GzBeanStoreVO[]>([]);
const currentStoreId = ref<number | null>(null);
const sessDate = ref<string>(todayStr());

const rows = ref<GzBeanBoardRowVO[]>([]);

// ②待分座区
const pendingRows = ref<GzBeanPendingAssignVO[]>([]);
const pendingLoading = ref(false);

// 主动弹窗 + 提示音开关（甲方核心诉求 ADR-0016 §6）
const alertEnabled = ref(true);
const soundEnabled = ref(false);
/** 已弹过 near_end 提醒的 bookingId 集合（去重：同一单只弹一次，转出 near_end 后清除以便下轮再约可再弹） */
const notifiedNearEnd = new Set<string>();

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

/** 显示「可延时 / 请收尾」信号：后端仅 near_end / overtime 回填 canExtend（in_use 也可能回填但提前量未到，按 near_end/overtime 展示更聚焦） */
function showCanExtend(row: GzBeanBoardRowVO): boolean {
  return (row.boardStatus === 'near_end' || row.boardStatus === 'overtime') && row.canExtend != null;
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
  // 起算点取 max(now, slot_start)：核销早于时段开始时剩余冻结在「预约时长」上限、不从 slot_end 直接倒推超发
  //   （用户订 1h → 显示 ≤ 60min，修掉「核销 11:37、订 14:00-15:00 → 显 203min」；时段开始后正常按秒倒计）。
  //   与后端 fillCurrentBooking 的 countFrom = max(now, plannedStart) 同口径。
  const startMs = slotStartMs(row);
  const anchor = startMs != null ? Math.max(now.value, startMs) : now.value;
  const diff = endMs - anchor;
  if (diff <= 0) return t('gzBeanBoard.endingSoon');
  const totalSec = Math.floor(diff / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return t('gzBeanBoard.remainCountdown', { m, s: String(s).padStart(2, '0') });
}

/** 由 sessDate + slotStart(HH:mm:ss) 组装该单计划开始的本地时间戳（倒计时起算下限）。 */
function slotStartMs(row: GzBeanBoardRowVO): number | null {
  return hhmmsToMs(row.slotStart);
}

/** 由 sessDate + slotEnd(HH:mm:ss) 组装该单计划结束的本地时间戳 */
function slotEndMs(row: GzBeanBoardRowVO): number | null {
  return hhmmsToMs(row.slotEnd);
}

/** sessDate（当日）+ "HH:mm[:ss]" → 本地时间戳；解析失败返回 null。 */
function hhmmsToMs(time: string | null | undefined): number | null {
  if (!time) return null;
  const parts = time.split(':');
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
  // 换店清空提醒记账 + 待分座区，避免上一店的 near_end / 待分座单串到本店
  notifiedNearEnd.clear();
  pendingRows.value = [];
  await loadBoard();
}

async function loadBoard() {
  if (currentStoreId.value == null) return;
  listLoading.value = true;
  try {
    const resp = await getGzBeanBoard(currentStoreId.value, sessDate.value);
    const next = ((resp as any).data || []) as GzBeanBoardRowVO[];
    detectNearEnd(next);
    rows.value = next;
    lastFetchAt = Date.now();
    // 抽屉打开时同步刷新当前选中座位
    if (detailVisible.value && activeRow.value) {
      const nextRow = rows.value.find((r) => r.seatId === activeRow.value!.seatId);
      activeRow.value = nextRow || null;
      if (!nextRow) detailVisible.value = false;
    }
  } catch (e) {
    console.error('[gz-bean-board] loadBoard failed', e);
    ElMessage.error(t('gzBeanBoard.loadFailed'));
  } finally {
    listLoading.value = false;
  }
  // 看板与待分座区一起刷新（同一动作触发，互不阻塞）
  loadPending();
}

/** ②待分座区加载 */
async function loadPending() {
  if (currentStoreId.value == null) return;
  pendingLoading.value = true;
  try {
    const resp = await getGzBeanPendingAssign(currentStoreId.value, sessDate.value);
    pendingRows.value = ((resp as any).data || []) as GzBeanPendingAssignVO[];
  } catch (e) {
    console.error('[gz-bean-board] loadPending failed', e);
    // 待分座区失败不打断主看板，控制台标记即可
  } finally {
    pendingLoading.value = false;
  }
}

// ============ 主动弹窗：diff 新进入 near_end 的座位 ============
/**
 * 找出本轮「新进入 near_end」的座位（相对 notifiedNearEnd 记账）→ ElNotification + 去重 + 可选声音。
 * 去重：同一 currentBookingId 只弹一次（notifiedNearEnd 记账）；该单离开 near_end（结束 / 放座 / 换单）后清除其记账，
 * 以便该座下一单再次进入 near_end 时可再弹。
 */
function detectNearEnd(next: GzBeanBoardRowVO[]) {
  if (!alertEnabled.value) {
    // 关闭弹窗时仍维护记账集合，避免重开后对存量 near_end 集中补弹
    syncNotifiedSet(next);
    return;
  }
  // 当前仍处 near_end 的 bookingId 集合（用于清理已离场的记账）
  const liveNearEnd = new Set<string>();
  for (const row of next) {
    const bid = row.currentBookingId;
    if (row.boardStatus === 'near_end' && bid) {
      liveNearEnd.add(bid);
      if (!notifiedNearEnd.has(bid)) {
        notifiedNearEnd.add(bid);
        notifyNearEnd(row);
      }
    }
  }
  // 清理：已不在 near_end 的旧记账（结束/放座/被新单替换），以便该座再次进入 near_end 时可再弹
  for (const bid of Array.from(notifiedNearEnd)) {
    if (!liveNearEnd.has(bid)) notifiedNearEnd.delete(bid);
  }
}

/** 关闭弹窗时仅同步记账集合（把当前 near_end 全标记为已弹），不实际弹窗 */
function syncNotifiedSet(next: GzBeanBoardRowVO[]) {
  notifiedNearEnd.clear();
  for (const row of next) {
    if (row.boardStatus === 'near_end' && row.currentBookingId) {
      notifiedNearEnd.add(row.currentBookingId);
    }
  }
}

function notifyNearEnd(row: GzBeanBoardRowVO) {
  const remain = row.remainingMinutes != null && row.remainingMinutes > 0 ? row.remainingMinutes : null;
  const body =
    remain != null
      ? row.canExtend
        ? t('gzBeanBoard.notifyBodyExtend', { n: remain })
        : t('gzBeanBoard.notifyBodyWrapup', { n: remain })
      : row.canExtend
        ? t('gzBeanBoard.notifyBodyExtendNoMin')
        : t('gzBeanBoard.notifyBodyWrapupNoMin');
  ElNotification({
    title: t('gzBeanBoard.notifyTitle', { seat: row.seatNo }),
    message: body,
    type: row.canExtend ? 'warning' : 'error',
    duration: 8000,
    position: 'top-right'
  });
  playBeep();
}

/** HTML5 Audio 提示音（WebAudio 合成短 beep；任何失败静默） */
function playBeep() {
  if (!soundEnabled.value) return;
  try {
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    osc.onended = () => ctx.close().catch(() => undefined);
  } catch {
    // 浏览器策略 / 无 AudioContext → 静默
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

// ============ 分配座位并核销（②待分座 → 选①区空闲座 → verify?seatId=） ============
const assignVisible = ref(false);
const assigning = ref(false);
const assignTarget = ref<GzBeanPendingAssignVO | null>(null);
const selectedSeatId = ref<string | null>(null);

/**
 * 当前待分座单可选的空闲座：①区 boardStatus='idle'，且桌型匹配（typeName === 预约桌型快照名）。
 * 名称匹配是便利过滤（后端 verify 仍以 seat_type_config_id 为准做 SEAT_TYPE_MISMATCH 校验）；
 * 无快照名 / 无匹配时回退展示全部空闲座，交由后端兜底校验，避免「明明有空座却过滤没了」。
 */
const assignSeatOptions = computed<GzBeanBoardRowVO[]>(() => {
  const idle = rows.value.filter((r) => r.boardStatus === 'idle' && r.seatId);
  const wantType = assignTarget.value?.seatTypeSnapshot;
  if (!wantType) return idle;
  const matched = idle.filter((r) => r.typeName === wantType);
  return matched.length > 0 ? matched : idle;
});

function openAssign(p: GzBeanPendingAssignVO) {
  assignTarget.value = p;
  selectedSeatId.value = null;
  assignVisible.value = true;
}

async function handleAssignVerify() {
  if (!assignTarget.value || !selectedSeatId.value) return;
  assigning.value = true;
  try {
    await verifyGzBeanBookingWithSeat(assignTarget.value.id, selectedSeatId.value);
    ElMessage.success(t('gzBeanBoard.assignSuccess'));
    assignVisible.value = false;
    assignTarget.value = null;
    selectedSeatId.value = null;
    await loadBoard();
  } catch (e) {
    // ruoyi request 拦截器对业务错误码（4002 座被占 / 4021 未分座 / 4022 桌型不符 等 code≠200）
    // 已统一弹 ElNotification(后端 msg)，且 reject 值不含数字 code（仅 'error' 字符串）→ 此处不重复 toast。
    // 失败多因看板空闲座列表过时（座位被并桌改派 / 别店员先核销），重拉看板让空闲座列表回正。
    console.error('[gz-bean-board] assign-verify failed', e);
    loadBoard();
  } finally {
    assigning.value = false;
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
.board-seat__extend {
  margin-top: 4px;
}
/* ②待分座区 */
.pending-assign {
  border: 1px solid #fde2cf;
  background: #fffaf5;
  border-radius: 8px;
  padding: 12px;
}
.pending-assign__head {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}
.pending-assign__icon {
  color: #e6a23c;
}
.pending-assign__title {
  font-weight: 600;
  color: #303133;
}
.pending-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}
.pending-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid #f3d19e;
  background: #fff;
  border-radius: 8px;
  padding: 10px 12px;
}
.pending-card__no {
  font-weight: 700;
  color: #303133;
  margin-bottom: 4px;
}
.pending-card__line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #606266;
  line-height: 1.6;
}
.pending-card__slot {
  font-variant-numeric: tabular-nums;
}
.pending-card__mobile {
  color: #909399;
}
/* 分配座位弹窗 */
.assign-seat-label {
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.assign-seat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
}
.assign-seat {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;
  text-align: center;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.assign-seat:hover {
  border-color: #c0c4cc;
}
.assign-seat.is-selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.assign-seat__no {
  font-weight: 700;
  color: #303133;
}
.assign-seat__table {
  margin-left: 4px;
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}
.assign-seat__type {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
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
