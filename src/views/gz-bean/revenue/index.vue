<template>
  <div class="revenue-page p-2">
    <el-card shadow="never" v-loading="pageLoading">
      <template #header>
        <span class="text-base font-medium">{{ t('gzBeanRevenue.title') }}</span>
      </template>

      <!-- 筛选栏：时间维度 + 区间(内置快捷) + 门店 -->
      <div class="filter-bar">
        <el-form inline class="filter-form" @submit.prevent="load">
          <el-form-item :label="t('gzBeanRevenue.granularity')">
            <el-radio-group v-model="granularity" @change="load">
              <el-radio-button value="day">{{ t('gzBeanRevenue.granDay') }}</el-radio-button>
              <el-radio-button value="week">{{ t('gzBeanRevenue.granWeek') }}</el-radio-button>
              <el-radio-button value="month">{{ t('gzBeanRevenue.granMonth') }}</el-radio-button>
              <el-radio-button value="quarter">{{ t('gzBeanRevenue.granQuarter') }}</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item :label="t('gzBeanRevenue.dateRange')">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              :start-placeholder="t('gzBeanRevenue.rangeStart')"
              :end-placeholder="t('gzBeanRevenue.rangeEnd')"
              :range-separator="t('gzBeanRevenue.rangeSep')"
              :shortcuts="dateShortcuts"
              :clearable="false"
              style="width: 260px"
              @change="load"
            />
          </el-form-item>
          <el-form-item :label="t('gzBeanRevenue.store')">
            <el-select v-model="storeId" filterable clearable style="width: 190px" :placeholder="t('gzBeanRevenue.storeAll')" @change="load">
              <el-option v-for="s in storeOptions" :key="s.id" :label="`${s.storeNo} · ${s.name}`" :value="s.id" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button v-hasPermi="['gz:bean:revenue:list']" type="primary" :icon="Search" @click="load">{{ t('gzBeanRevenue.query') }}</el-button>
            <el-button :icon="Refresh" @click="load">{{ t('gzBeanRevenue.refresh') }}</el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 汇总卡 -->
      <el-row :gutter="16" class="mb-4">
        <el-col :xs="24" :sm="8">
          <div class="stat-card stat-card--total">
            <div class="stat-card__icon">
              <el-icon><Money /></el-icon>
            </div>
            <div class="stat-card__body">
              <div class="stat-card__label">{{ t('gzBeanRevenue.totalRevenue') }}</div>
              <div class="stat-card__value">¥{{ yuan(summary.totalCent) }}</div>
              <div class="stat-card__sub">{{ t('gzBeanRevenue.orderCount', { n: summary.orderCount }) }}</div>
            </div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8">
          <div class="stat-card stat-card--cash">
            <div class="stat-card__icon">
              <el-icon><Wallet /></el-icon>
            </div>
            <div class="stat-card__body">
              <div class="stat-card__label">{{ t('gzBeanRevenue.cash') }}</div>
              <div class="stat-card__value">¥{{ yuan(summary.cashCent) }}</div>
              <div class="stat-card__sub">{{ t('gzBeanRevenue.orderCount', { n: summary.cashCount }) }}</div>
            </div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8">
          <div class="stat-card stat-card--online">
            <div class="stat-card__icon">
              <el-icon><Coin /></el-icon>
            </div>
            <div class="stat-card__body">
              <div class="stat-card__label">{{ t('gzBeanRevenue.online') }}</div>
              <div class="stat-card__value">¥{{ yuan(summary.onlineCent) }}</div>
              <div class="stat-card__sub">{{ t('gzBeanRevenue.orderCount', { n: summary.onlineCount }) }}</div>
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- 桌型 × 计费方式拆分表 -->
      <div class="section">
        <div class="section-title">{{ t('gzBeanRevenue.breakdownTitle') }}</div>
        <el-table :data="breakdownRows" border stripe size="small" show-summary :summary-method="breakdownSummary">
          <el-table-column :label="t('gzBeanRevenue.colTableType')" prop="label" min-width="120" />
          <el-table-column :label="t('gzBeanRevenue.colHourly')" align="right" min-width="150">
            <template #default="{ row }">
              <span class="amt">¥{{ yuan(row.hourlyCent) }}</span>
              <span class="cnt">{{ t('gzBeanRevenue.orderCount', { n: row.hourlyCount }) }}</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('gzBeanRevenue.colDayPass')" align="right" min-width="150">
            <template #default="{ row }">
              <span class="amt">¥{{ yuan(row.dayPassCent) }}</span>
              <span class="cnt">{{ t('gzBeanRevenue.orderCount', { n: row.dayPassCount }) }}</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('gzBeanRevenue.colSubtotal')" align="right" min-width="150">
            <template #default="{ row }">
              <span class="amt amt--strong">¥{{ yuan(row.hourlyCent + row.dayPassCent) }}</span>
              <span class="cnt">{{ t('gzBeanRevenue.orderCount', { n: row.hourlyCount + row.dayPassCount }) }}</span>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty :description="t('gzBeanRevenue.noData')" :image-size="60" />
          </template>
        </el-table>
      </div>

      <!-- 营业明细（区间下钻，桌型 + 支付方式筛选） -->
      <div class="section">
        <div class="detail-header">
          <span class="section-title section-title--inline">{{ t('gzBeanRevenue.detailTitle') }}</span>
          <div class="detail-filters">
            <el-select
              v-model="seatTypeFilter"
              clearable
              size="small"
              :placeholder="t('gzBeanRevenue.allTableTypes')"
              style="width: 130px"
              @change="reloadDetail"
            >
              <el-option v-for="o in seatTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <el-radio-group v-model="payMethodFilter" size="small" @change="reloadDetail">
              <el-radio-button value="">{{ t('gzBeanRevenue.filterAll') }}</el-radio-button>
              <el-radio-button value="cash">{{ t('gzBeanRevenue.cash') }}</el-radio-button>
              <el-radio-button value="online">{{ t('gzBeanRevenue.online') }}</el-radio-button>
            </el-radio-group>
          </div>
        </div>

        <el-table v-loading="detailLoading" :data="detailRows" border stripe size="small">
          <el-table-column :label="t('gzBeanRevenue.colDate')" prop="sessDate" width="110" />
          <el-table-column :label="t('gzBeanRevenue.colTime')" width="140">
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
          <el-table-column :label="t('gzBeanRevenue.colWalkIn')" width="80" align="center">
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

        <pagination v-show="total > 0" v-model:page="pageNum" v-model:limit="pageSize" :total="total" @pagination="loadDetail" />
      </div>

      <!-- 营业额趋势（页面最底部；ECharts 堆叠柱：X=时间桶，series=桌型×计费方式） -->
      <div class="section">
        <div class="section-title">{{ t('gzBeanRevenue.trendTitle') }}</div>
        <div class="trend-wrap">
          <div v-show="hasPeriods" ref="chartRef" class="trend-chart" />
          <el-empty v-if="!hasPeriods" :description="t('gzBeanRevenue.chartEmpty')" :image-size="60" />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="GzBeanRevenue">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import * as echarts from 'echarts';
import { Search, Refresh, Money, Wallet, Coin } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { getGzBeanStoreOptions, type GzBeanStoreVO } from '@/api/gz-bean/store';
import {
  getGzBeanRevenueAggregate,
  listGzBeanRevenueDetail,
  type RevenueGranularity,
  type GzBeanRevenueAggregateVO,
  type GzBeanRevenueCategoryDim,
  type GzBeanRevenueDetailVO
} from '@/api/gz-bean/revenue';

const { t } = useI18n();

const pageLoading = ref(false);
const detailLoading = ref(false);

const storeOptions = ref<GzBeanStoreVO[]>([]);
const storeId = ref<number | null>(null);
const granularity = ref<RevenueGranularity>('month');
/** [startDate, endDate]，YYYY-MM-DD */
const dateRange = ref<[string, string]>(defaultRange());
const payMethodFilter = ref<'' | 'cash' | 'online'>('');
/** 明细桌型筛选（seat_type code；空=全部） */
const seatTypeFilter = ref<string>('');

const aggregate = ref<GzBeanRevenueAggregateVO | null>(null);
const summary = computed(() => aggregate.value?.summary ?? { totalCent: 0, orderCount: 0, cashCent: 0, cashCount: 0, onlineCent: 0, onlineCount: 0 });

const detailRows = ref<GzBeanRevenueDetailVO[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(10);

// ============ 日期工具 ============
function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayDate(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
/** 本周一（周一起，ISO） */
function mondayOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=周日..6=周六
  const diff = day === 0 ? -6 : 1 - day; // 回退到本周一
  const r = new Date(d);
  r.setDate(d.getDate() + diff);
  return new Date(r.getFullYear(), r.getMonth(), r.getDate());
}
function firstOfQuarter(d: Date): Date {
  const qStartMonth = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), qStartMonth, 1);
}
function firstOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
/** 默认区间：近 6 个自然月（配 granularity=month 给多柱趋势） */
function defaultRange(): [string, string] {
  const today = todayDate();
  return [fmt(addMonths(firstOfMonth(today), -5)), fmt(today)];
}

/** 日期选择器内置快捷（客户 7.08：把今天/本周/本月/本季度/本年收进下拉，取代独立预设行；仅设区间，粒度独立） */
const dateShortcuts = computed(() => [
  {
    text: t('gzBeanRevenue.presetToday'),
    value: () => {
      const d = todayDate();
      return [d, d];
    }
  },
  { text: t('gzBeanRevenue.presetThisWeek'), value: () => [mondayOfWeek(todayDate()), todayDate()] },
  { text: t('gzBeanRevenue.presetThisMonth'), value: () => [firstOfMonth(todayDate()), todayDate()] },
  { text: t('gzBeanRevenue.presetThisQuarter'), value: () => [firstOfQuarter(todayDate()), todayDate()] },
  { text: t('gzBeanRevenue.presetThisYear'), value: () => [firstOfYear(todayDate()), todayDate()] }
]);

// ============ 展示格式化 ============
function yuan(cent: number | null | undefined): string {
  const c = cent ?? 0;
  return (c / 100).toFixed(2);
}
function maskMobile(m?: string | null): string {
  if (!m) return '—';
  if (m.length !== 11) return m;
  return `${m.slice(0, 3)}****${m.slice(7)}`;
}

// ============ 类目 / 桌型标签 ============
function seatTypeLabel(seatType: string, typeName?: string | null): string {
  switch (seatType) {
    case 'single':
      return t('gzBeanRevenue.seatTypeSingle');
    case 'double':
      return t('gzBeanRevenue.seatTypeDouble');
    case 'quad':
      return t('gzBeanRevenue.seatTypeQuad');
    case 'unknown':
      return t('gzBeanRevenue.seatTypeUnknown');
    default:
      return typeName || seatType; // 自定义 st<id> 用快照中文名兜底
  }
}
function categoryLabel(cat: GzBeanRevenueCategoryDim): string {
  const billing = cat.isDayPass === 1 ? t('gzBeanRevenue.billingDayPass') : t('gzBeanRevenue.billingHourly');
  return `${seatTypeLabel(cat.seatType, cat.typeName)} · ${billing}`;
}

/** 明细「桌型」筛选项：取当前聚合结果里出现的桌型（去重，按类目序）。 */
const seatTypeOptions = computed(() => {
  const seen = new Set<string>();
  const opts: { value: string; label: string }[] = [];
  for (const c of aggregate.value?.categories ?? []) {
    if (!seen.has(c.seatType)) {
      seen.add(c.seatType);
      opts.push({ value: c.seatType, label: seatTypeLabel(c.seatType, c.typeName) });
    }
  }
  return opts;
});

// ============ 6 类拆分矩阵（按桌型透视 byCategory） ============
interface BreakdownRow {
  seatType: string;
  label: string;
  hourlyCent: number;
  hourlyCount: number;
  dayPassCent: number;
  dayPassCount: number;
}
const breakdownRows = computed<BreakdownRow[]>(() => {
  const map = new Map<string, BreakdownRow>();
  for (const c of aggregate.value?.byCategory ?? []) {
    let row = map.get(c.seatType);
    if (!row) {
      row = { seatType: c.seatType, label: seatTypeLabel(c.seatType, c.typeName), hourlyCent: 0, hourlyCount: 0, dayPassCent: 0, dayPassCount: 0 };
      map.set(c.seatType, row);
    }
    if (c.isDayPass === 1) {
      row.dayPassCent += c.totalCent;
      row.dayPassCount += c.orderCount;
    } else {
      row.hourlyCent += c.totalCent;
      row.hourlyCount += c.orderCount;
    }
  }
  // byCategory 已按类目序（单/双/四/自定义/unknown），Map 插入序即正确顺序
  return [...map.values()];
});
const totalHourlyCent = computed(() => breakdownRows.value.reduce((s, r) => s + r.hourlyCent, 0));
const totalHourlyCount = computed(() => breakdownRows.value.reduce((s, r) => s + r.hourlyCount, 0));
const totalDayPassCent = computed(() => breakdownRows.value.reduce((s, r) => s + r.dayPassCent, 0));
const totalDayPassCount = computed(() => breakdownRows.value.reduce((s, r) => s + r.dayPassCount, 0));

/** 拆分表原生合计行（列对齐；文本形态 = ¥金额 · N 单）。 */
function breakdownSummary(): string[] {
  const cell = (cent: number, cnt: number) => `¥${yuan(cent)} · ${t('gzBeanRevenue.orderCount', { n: cnt })}`;
  return [
    t('gzBeanRevenue.rowTotal'),
    cell(totalHourlyCent.value, totalHourlyCount.value),
    cell(totalDayPassCent.value, totalDayPassCount.value),
    cell(totalHourlyCent.value + totalDayPassCent.value, totalHourlyCount.value + totalDayPassCount.value)
  ];
}

// ============ 趋势图（ECharts） ============
const chartRef = ref<HTMLDivElement | null>(null);
let chartInstance: ReturnType<typeof echarts.init> | null = null;
const hasPeriods = computed(() => (aggregate.value?.periods?.length ?? 0) > 0);

function renderChart() {
  const agg = aggregate.value;
  if (!agg || !hasPeriods.value) {
    // 无数据：销毁图表实例（DOM 已被 v-show 隐藏 / el-empty 顶上）
    chartInstance?.dispose();
    chartInstance = null;
    return;
  }
  nextTick(() => {
    if (!chartRef.value) return;
    if (!chartInstance) {
      chartInstance = echarts.init(chartRef.value);
    }
    const labels = agg.periods.map((p) => p.label);
    const series = agg.categories.map((cat) => ({
      name: categoryLabel(cat),
      type: 'bar' as const,
      stack: 'total',
      emphasis: { focus: 'series' as const },
      data: agg.periods.map((p) => {
        const cell = p.cells.find((c) => c.catKey === cat.key);
        return (cell?.amountCent ?? 0) / 100;
      })
    }));
    chartInstance.setOption(
      {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          valueFormatter: (v: unknown) => `¥${Number(v ?? 0).toFixed(2)}`
        },
        legend: { type: 'scroll', bottom: 0 },
        grid: { left: 8, right: 16, top: 24, bottom: 48, containLabel: true },
        xAxis: { type: 'category', data: labels },
        yAxis: { type: 'value', axisLabel: { formatter: (v: number) => `¥${v}` } },
        series
      },
      true // notMerge：series 数量随类目变化，全量替换
    );
    chartInstance.resize();
  });
}
function onResize() {
  chartInstance?.resize();
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

async function loadAggregate() {
  pageLoading.value = true;
  try {
    const resp = await getGzBeanRevenueAggregate({
      granularity: granularity.value,
      startDate: dateRange.value[0],
      endDate: dateRange.value[1],
      storeId: storeId.value ?? undefined
    });
    aggregate.value = (resp as any).data as GzBeanRevenueAggregateVO;
    renderChart();
  } catch (e) {
    console.error('[gz-bean-revenue] loadAggregate failed', e);
  } finally {
    pageLoading.value = false;
  }
}

async function loadDetail() {
  detailLoading.value = true;
  try {
    const resp = await listGzBeanRevenueDetail({
      storeId: storeId.value ?? undefined,
      startDate: dateRange.value[0],
      endDate: dateRange.value[1],
      payMethod: payMethodFilter.value || undefined,
      seatType: seatTypeFilter.value || undefined,
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

/** 明细筛选变更 → 回第一页重拉 */
function reloadDetail() {
  pageNum.value = 1;
  loadDetail();
}

/** 聚合 + 明细一起刷（明细回第一页） */
function load() {
  pageNum.value = 1;
  loadAggregate();
  loadDetail();
}

onMounted(async () => {
  window.addEventListener('resize', onResize);
  await loadStoreOptions();
  load();
});
onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  chartInstance?.dispose();
  chartInstance = null;
});
</script>

<style scoped>
.revenue-page {
  --revenue-total: var(--el-color-primary);
  --revenue-cash: var(--el-color-warning);
  --revenue-online: var(--el-color-success);
}

/* ── 筛选栏 ── */
.filter-bar {
  padding: 14px 16px 2px;
  margin-bottom: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
}
.filter-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

/* ── 汇总卡 ── */
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  margin-bottom: 12px;
  border-radius: 10px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  box-shadow: var(--el-box-shadow-lighter);
}
.stat-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 12px;
  font-size: 24px;
  flex-shrink: 0;
}
.stat-card--total {
  border-left: 3px solid var(--revenue-total);
}
.stat-card--total .stat-card__icon {
  color: var(--revenue-total);
  background: var(--el-color-primary-light-9);
}
.stat-card--cash {
  border-left: 3px solid var(--revenue-cash);
}
.stat-card--cash .stat-card__icon {
  color: var(--revenue-cash);
  background: var(--el-color-warning-light-9);
}
.stat-card--online {
  border-left: 3px solid var(--revenue-online);
}
.stat-card--online .stat-card__icon {
  color: var(--revenue-online);
  background: var(--el-color-success-light-9);
}
.stat-card__body {
  min-width: 0;
}
.stat-card__label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.stat-card__value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}
.stat-card__sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* ── 分区 ── */
.section {
  margin-bottom: 20px;
}
.section-title {
  position: relative;
  padding-left: 10px;
  margin-bottom: 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.section-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 2px;
  bottom: 2px;
  width: 3px;
  border-radius: 2px;
  background: var(--el-color-primary);
}
.section-title--inline {
  margin-bottom: 0;
}
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.detail-filters {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ── 金额单元格 ── */
.amt {
  color: var(--el-color-primary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.amt--strong {
  color: var(--el-text-color-primary);
}
.cnt {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-left: 6px;
}

/* ── 趋势图 ── */
.trend-wrap {
  min-height: 340px;
}
.trend-chart {
  width: 100%;
  height: 340px;
}
</style>
