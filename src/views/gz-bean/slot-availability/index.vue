<template>
  <div class="p-2">
    <el-card v-loading="pageLoading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzBeanSlotAvailability.title') }}</span>
        </div>
      </template>

      <el-alert
        :title="t('gzBeanSlotAvailability.alertTitle')"
        type="info"
        :description="t('gzBeanSlotAvailability.alertDesc')"
        show-icon
        :closable="false"
        class="mb-3"
      />

      <!-- 筛选 -->
      <el-form inline class="mb-2" @submit.prevent="load">
        <el-form-item :label="t('gzBeanSlotAvailability.store')">
          <el-select
            v-model="storeId"
            filterable
            style="width: 220px"
            :placeholder="t('gzBeanSlotAvailability.storePlaceholder')"
            @change="onStoreChange"
          >
            <el-option v-for="s in storeOptions" :key="s.id" :label="`${s.storeNo} · ${s.name}`" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanSlotAvailability.date')">
          <el-date-picker
            v-model="date"
            type="date"
            value-format="YYYY-MM-DD"
            :clearable="false"
            :placeholder="t('gzBeanSlotAvailability.datePlaceholder')"
            style="width: 160px"
            @change="load"
          />
          <el-button-group class="ml-2">
            <el-button :type="isToday ? 'primary' : 'default'" @click="setToday">{{ t('gzBeanSlotAvailability.today') }}</el-button>
            <el-button :type="isTomorrow ? 'primary' : 'default'" @click="setTomorrow">{{ t('gzBeanSlotAvailability.tomorrow') }}</el-button>
          </el-button-group>
        </el-form-item>
        <el-form-item>
          <el-button v-hasPermi="['gz:bean:slotQuota:list']" type="primary" :icon="Search" @click="load">
            {{ t('gzBeanSlotAvailability.query') }}
          </el-button>
          <el-button :icon="Refresh" @click="load">{{ t('gzBeanSlotAvailability.refresh') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 余量表格：行 = 桌型 × 时段。max-height → 表体内部滚动、表头固定顶部（表长时不丢表头） -->
      <el-table :data="rows" border stripe size="small" :row-class-name="rowClassName" max-height="calc(100vh - 320px)">
        <el-table-column :label="t('gzBeanSlotAvailability.colType')" prop="name" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.name }}</span>
            <el-tag v-if="row.bookMode" size="small" effect="plain" class="ml-1">
              {{ row.bookMode === 'whole' ? t('gzBeanSlotAvailability.bookModeWhole') : t('gzBeanSlotAvailability.bookModeSeat') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSlotAvailability.colSlot')" width="140" align="center">
          <template #default="{ row }">{{ row.slotStart }}~{{ row.slotEnd }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSlotAvailability.colOpened')" prop="opened" width="90" align="center" />
        <el-table-column :label="t('gzBeanSlotAvailability.colBooked')" prop="booked" width="90" align="center" />
        <el-table-column :label="t('gzBeanSlotAvailability.colClosedSeat')" width="100" align="center">
          <template #default="{ row }">
            <span :class="{ 'text-muted': row.closedSeat === 0 }">{{ row.closedSeat }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSlotAvailability.colRemaining')" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.remaining <= 0 ? 'danger' : 'success'" size="small" effect="light">{{ row.remaining }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSlotAvailability.colQuotaClose')" width="170" align="center">
          <template #default="{ row }">
            <el-input-number
              v-model="row.quotaClose"
              :min="0"
              :max="closeMax(row)"
              :step="1"
              size="small"
              controls-position="right"
              style="width: 130px"
              :disabled="saving || !hasEditPerm"
              @change="(val: number | undefined) => onQuotaChange(row, val)"
            />
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="t('gzBeanSlotAvailability.noData')" :image-size="60" />
        </template>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="GzBeanSlotAvailability">
import { ref, computed, onMounted } from 'vue';
import { Search, Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { checkPermi } from '@/utils/permission';
import { getGzBeanStoreOptions, type GzBeanStoreVO } from '@/api/gz-bean/store';
import {
  getGzBeanAvailabilityDetail,
  upsertGzBeanSlotQuotaClose,
  type GzBeanSlotAvailabilityDetailVO
} from '@/api/gz-bean/slotAvailability';

const { t } = useI18n();

const pageLoading = ref(false);
const saving = ref(false);
const hasEditPerm = computed(() => checkPermi(['gz:bean:slotQuota:edit']));

const storeOptions = ref<GzBeanStoreVO[]>([]);
const storeId = ref<number | null>(null);
const date = ref<string>(todayStr());
const rows = ref<GzBeanSlotAvailabilityDetailVO[]>([]);

// ============ 日期快捷 ============
function todayStr(): string {
  return fmtDate(new Date());
}
function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return fmtDate(d);
}
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const isToday = computed(() => date.value === todayStr());
const isTomorrow = computed(() => date.value === tomorrowStr());
function setToday() {
  date.value = todayStr();
  load();
}
function setTomorrow() {
  date.value = tomorrowStr();
  load();
}

// ============ 表格辅助 ============
/**
 * 关闭数上限：不能把配额关到「比已约还少」（否则已约单被反噬）。
 * 关闭上限 = opened − booked − closedSeat（下限 0）+ 当前已生效的 quotaClose（因为 remaining 已扣过它）。
 * 即：可再关 = remaining（当前剩余）+ 当前 quotaClose。
 */
function closeMax(row: GzBeanSlotAvailabilityDetailVO): number {
  return Math.max(0, row.remaining + row.quotaClose);
}
function rowClassName({ row }: { row: GzBeanSlotAvailabilityDetailVO }): string {
  return row.remaining <= 0 ? 'row-full' : '';
}

// ============ 数据加载 ============
async function loadStoreOptions() {
  try {
    const resp = await getGzBeanStoreOptions();
    const r = resp as any;
    storeOptions.value = (r.data || r || []) as GzBeanStoreVO[];
    if (!storeId.value && storeOptions.value.length > 0) {
      storeId.value = Number(storeOptions.value[0].id);
    }
  } catch (e) {
    console.error('[gz-bean-slot-availability] loadStoreOptions failed', e);
  }
}

async function load() {
  if (!storeId.value) {
    rows.value = [];
    return;
  }
  pageLoading.value = true;
  try {
    const resp = await getGzBeanAvailabilityDetail({ storeId: storeId.value, sessDate: date.value });
    const data = (resp as any).data as GzBeanSlotAvailabilityDetailVO[];
    rows.value = (data || []).map((d) => ({ ...d }));
  } catch (e) {
    console.error('[gz-bean-slot-availability] load failed', e);
    rows.value = [];
  } finally {
    pageLoading.value = false;
  }
}

function onStoreChange() {
  load();
}

/** 改关闭数 → upsert 回写；成功后局部重算 remaining（乐观刷新，不全表 reload） */
async function onQuotaChange(row: GzBeanSlotAvailabilityDetailVO, val: number | undefined) {
  const next = val ?? 0;
  if (!storeId.value) return;
  const prevQuota = row.quotaClose;
  const prevRemaining = row.remaining;
  saving.value = true;
  try {
    await upsertGzBeanSlotQuotaClose({
      storeId: storeId.value,
      seatTypeConfigId: row.seatTypeConfigId,
      sessDate: date.value,
      slotStart: row.slotStart,
      closeCount: next
    });
    // 乐观重算：remaining = max(0, opened − booked − closedSeat − quotaClose)
    row.quotaClose = next;
    row.remaining = Math.max(0, row.opened - row.booked - row.closedSeat - next);
    ElMessage.success(t('gzBeanSlotAvailability.saveOk'));
  } catch (e) {
    console.error('[gz-bean-slot-availability] upsert failed', e);
    // 回滚 UI（后端已拦截非法值）
    row.quotaClose = prevQuota;
    row.remaining = prevRemaining;
    ElMessage.error(t('gzBeanSlotAvailability.saveFail'));
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await loadStoreOptions();
  load();
});
</script>

<style scoped>
.text-muted {
  color: var(--el-text-color-placeholder);
}
:deep(.row-full) {
  background: var(--el-color-danger-light-9);
}
</style>
