<template>
  <div class="p-2">
    <el-card v-loading="pageLoading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzBeanRevenue.title') }}</span>
        </div>
      </template>

      <el-alert :title="t('gzBeanRevenue.alertTitle')" type="info" :description="t('gzBeanRevenue.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 筛选 -->
      <el-form inline class="mb-2" @submit.prevent="load">
        <el-form-item :label="t('gzBeanRevenue.date')">
          <el-date-picker
            v-model="date"
            type="date"
            value-format="YYYY-MM-DD"
            :clearable="false"
            :placeholder="t('gzBeanRevenue.datePlaceholder')"
            style="width: 160px"
            @change="load"
          />
          <el-button-group class="ml-2">
            <el-button :type="isToday ? 'primary' : 'default'" @click="setToday">{{ t('gzBeanRevenue.today') }}</el-button>
            <el-button :type="isYesterday ? 'primary' : 'default'" @click="setYesterday">{{ t('gzBeanRevenue.yesterday') }}</el-button>
          </el-button-group>
        </el-form-item>
        <el-form-item :label="t('gzBeanRevenue.store')">
          <el-select v-model="storeId" filterable clearable style="width: 220px" :placeholder="t('gzBeanRevenue.storeAll')" @change="load">
            <el-option v-for="s in storeOptions" :key="s.id" :label="`${s.storeNo} · ${s.name}`" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button v-hasPermi="['gz:bean:revenue:list']" type="primary" :icon="Search" @click="load">{{ t('gzBeanRevenue.query') }}</el-button>
          <el-button :icon="Refresh" @click="load">{{ t('gzBeanRevenue.refresh') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 汇总卡 -->
      <el-row :gutter="12" class="mb-3">
        <el-col :xs="12" :sm="6">
          <el-card shadow="hover" class="stat-card stat-card--primary">
            <div class="stat-card__label">{{ t('gzBeanRevenue.totalRevenue') }}</div>
            <div class="stat-card__value">¥{{ yuan(summary.totalCent) }}</div>
            <div class="stat-card__sub">{{ t('gzBeanRevenue.orderCount', { n: summary.orderCount }) }}</div>
          </el-card>
        </el-col>
        <el-col :xs="12" :sm="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-card__label">{{ t('gzBeanRevenue.cash') }}</div>
            <div class="stat-card__value">¥{{ yuan(summary.cashCent) }}</div>
            <div class="stat-card__sub">{{ t('gzBeanRevenue.orderCount', { n: summary.cashCount }) }}</div>
          </el-card>
        </el-col>
        <el-col :xs="12" :sm="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-card__label">{{ t('gzBeanRevenue.online') }}</div>
            <div class="stat-card__value">¥{{ yuan(summary.onlineCent) }}</div>
            <div class="stat-card__sub">{{ t('gzBeanRevenue.orderCount', { n: summary.onlineCount }) }}</div>
          </el-card>
        </el-col>
        <el-col :xs="12" :sm="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-card__label">{{ t('gzBeanRevenue.byTypeTitle') }}</div>
            <div v-if="summary.byType.length === 0" class="stat-card__sub">{{ t('gzBeanRevenue.noData') }}</div>
            <div v-for="g in summary.byType" v-else :key="g.typeName" class="type-row">
              <span class="type-row__name">{{ g.typeName }}</span>
              <span class="type-row__amt">¥{{ yuan(g.totalCent) }}</span>
              <span class="type-row__cnt">×{{ g.orderCount }}</span>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 明细 -->
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium">{{ t('gzBeanRevenue.detailTitle') }}</span>
        <el-radio-group v-model="payMethodFilter" size="small" @change="loadDetail">
          <el-radio-button value="">{{ t('gzBeanRevenue.filterAll') }}</el-radio-button>
          <el-radio-button value="cash">{{ t('gzBeanRevenue.cash') }}</el-radio-button>
          <el-radio-button value="online">{{ t('gzBeanRevenue.online') }}</el-radio-button>
        </el-radio-group>
      </div>

      <el-table v-loading="detailLoading" :data="detailRows" border stripe size="small">
        <el-table-column :label="t('gzBeanRevenue.colTime')" width="150">
          <template #default="{ row }">
            <span>{{ row.slotStart }}~{{ row.slotEnd }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanRevenue.colStore')" prop="storeName" min-width="120" show-overflow-tooltip />
        <el-table-column :label="t('gzBeanRevenue.colType')" prop="seatTypeSnapshot" min-width="110" show-overflow-tooltip />
        <el-table-column :label="t('gzBeanRevenue.colBookingNo')" prop="bookingNo" min-width="160" show-overflow-tooltip />
        <el-table-column :label="t('gzBeanRevenue.colMobile')" width="130">
          <template #default="{ row }">{{ maskMobile(row.mobileSnapshot) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanRevenue.colAmount')" width="110" align="right">
          <template #default="{ row }">¥{{ yuan(row.amountCent) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanRevenue.colPayMethod')" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.payMethod === 'cash' ? 'warning' : 'success'" size="small" effect="light">
              {{ row.payMethod === 'cash' ? t('gzBeanRevenue.cash') : t('gzBeanRevenue.online') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanRevenue.colWalkIn')" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.walkIn" type="info" size="small" effect="plain">{{ t('gzBeanRevenue.walkInYes') }}</el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanRevenue.colVerifyTime')" prop="verifyTime" width="160" />
        <template #empty>
          <el-empty :description="t('gzBeanRevenue.noData')" :image-size="60" />
        </template>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:page="pageNum"
        v-model:limit="pageSize"
        :total="total"
        @pagination="loadDetail"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts" name="GzBeanRevenue">
import { ref, reactive, computed, onMounted } from 'vue';
import { Search, Refresh } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { getGzBeanStoreOptions, type GzBeanStoreVO } from '@/api/gz-bean/store';
import {
  getGzBeanRevenueDaily,
  listGzBeanRevenueDetail,
  type GzBeanRevenueVO,
  type GzBeanRevenueDetailVO
} from '@/api/gz-bean/revenue';

const { t } = useI18n();

const pageLoading = ref(false);
const detailLoading = ref(false);

const storeOptions = ref<GzBeanStoreVO[]>([]);
const storeId = ref<number | null>(null);
const date = ref<string>(todayStr());
const payMethodFilter = ref<'' | 'cash' | 'online'>('');

const summary = reactive<GzBeanRevenueVO>({
  date: date.value,
  totalCent: 0,
  orderCount: 0,
  cashCent: 0,
  cashCount: 0,
  onlineCent: 0,
  onlineCount: 0,
  byType: []
});

const detailRows = ref<GzBeanRevenueDetailVO[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(10);

// ============ 日期快捷 ============
function todayStr(): string {
  return fmtDate(new Date());
}
function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return fmtDate(d);
}
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const isToday = computed(() => date.value === todayStr());
const isYesterday = computed(() => date.value === yesterdayStr());
function setToday() {
  date.value = todayStr();
  load();
}
function setYesterday() {
  date.value = yesterdayStr();
  load();
}

// ============ 展示格式化 ============
/** 分 → 元（保留 2 位） */
function yuan(cent: number | null | undefined): string {
  const c = cent ?? 0;
  return (c / 100).toFixed(2);
}
/** 手机号末 4 位打码：138****8888 → 138****88** 之类，这里显示前 3 后 4 中间打码 */
function maskMobile(m?: string | null): string {
  if (!m) return '—';
  if (m.length !== 11) return m;
  return `${m.slice(0, 3)}****${m.slice(7)}`;
}

// ============ 数据加载 ============
async function loadStoreOptions() {
  try {
    const resp = await getGzBeanStoreOptions();
    const r = resp as any;
    storeOptions.value = (r.data || r || []) as GzBeanStoreVO[];
  } catch (e) {
    console.error('[gz-bean-revenue] loadStoreOptions failed', e);
  }
}

async function loadSummary() {
  pageLoading.value = true;
  try {
    const resp = await getGzBeanRevenueDaily({ storeId: storeId.value ?? undefined, date: date.value });
    const data = (resp as any).data as GzBeanRevenueVO;
    if (data) {
      summary.date = data.date;
      summary.storeName = data.storeName;
      summary.totalCent = data.totalCent ?? 0;
      summary.orderCount = data.orderCount ?? 0;
      summary.cashCent = data.cashCent ?? 0;
      summary.cashCount = data.cashCount ?? 0;
      summary.onlineCent = data.onlineCent ?? 0;
      summary.onlineCount = data.onlineCount ?? 0;
      summary.byType = data.byType ?? [];
    }
  } catch (e) {
    console.error('[gz-bean-revenue] loadSummary failed', e);
  } finally {
    pageLoading.value = false;
  }
}

async function loadDetail() {
  detailLoading.value = true;
  try {
    const resp = await listGzBeanRevenueDetail({
      storeId: storeId.value ?? undefined,
      date: date.value,
      payMethod: payMethodFilter.value || undefined,
      pageNum: pageNum.value,
      pageSize: pageSize.value
    });
    const r = resp as any;
    detailRows.value = (r.rows || []) as GzBeanRevenueDetailVO[];
    total.value = r.total ?? 0;
  } catch (e) {
    console.error('[gz-bean-revenue] loadDetail failed', e);
  } finally {
    detailLoading.value = false;
  }
}

/** 汇总 + 明细一起刷（明细回第一页） */
function load() {
  pageNum.value = 1;
  loadSummary();
  loadDetail();
}

onMounted(async () => {
  await loadStoreOptions();
  load();
});
</script>

<style scoped>
.stat-card {
  margin-bottom: 8px;
}
.stat-card--primary {
  background: var(--el-color-primary-light-9);
}
.stat-card__label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.stat-card__value {
  font-size: 24px;
  font-weight: 600;
  margin-top: 4px;
  color: var(--el-text-color-primary);
}
.stat-card__sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.type-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  margin-top: 4px;
}
.type-row__name {
  color: var(--el-text-color-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.type-row__amt {
  color: var(--el-color-primary);
  font-weight: 600;
  margin: 0 6px;
}
.type-row__cnt {
  color: var(--el-text-color-secondary);
}
</style>
