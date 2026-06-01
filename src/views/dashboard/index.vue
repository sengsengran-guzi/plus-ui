<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzDashboard.title') }}</span>
          <div class="flex items-center" style="gap: 12px">
            <span class="text-xs" style="color: #909399">{{ updatedText }}</span>
            <el-button type="primary" :icon="Refresh" :loading="refreshing" :disabled="refreshDisabled" @click="handleRefresh">
              {{ t('gzDashboard.refresh') }}
            </el-button>
            <span class="ticket-tag">GZ-ADMIN-003</span>
          </div>
        </div>
      </template>

      <el-alert :title="t('gzDashboard.alertTitle')" type="info" :description="t('gzDashboard.alertDesc')" show-icon :closable="false" class="mb-3" />

      <el-row :gutter="16">
        <el-col v-for="m in cards" :key="m.metricKey" :xs="24" :sm="12" :md="8" :lg="4">
          <el-card shadow="hover" class="kpi-card">
            <div class="kpi-title">{{ metricTitle(m.metricKey, m.title) }}</div>
            <div class="kpi-value">{{ formatNumber(m.value) }}</div>
            <div class="kpi-sub">{{ t('gzDashboard.vsYesterday') }}: -</div>
          </el-card>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="GzDashboard">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { getDashboardLatest, refreshDashboard, type DashboardMetricItem } from '@/api/gz-common/dashboard';

const { t } = useI18n();

const loading = ref(false);
const refreshing = ref(false);
const refreshDisabled = ref(false);
const snapshotTime = ref<string | null>(null);
const metrics = ref<DashboardMetricItem[]>([]);

// 固定 5 卡顺序（后端枚举 DashboardMetric 顺序对齐；缺值占位为 0/「-」）
const METRIC_ORDER = ['total_users', 'today_new_users', 'total_bookings', 'today_bookings', 'total_news_reads'];

const I18N_KEY: Record<string, string> = {
  total_users: 'gzDashboard.totalUsers',
  today_new_users: 'gzDashboard.todayNewUsers',
  total_bookings: 'gzDashboard.totalBookings',
  today_bookings: 'gzDashboard.todayBookings',
  total_news_reads: 'gzDashboard.totalNewsReads'
};

const cards = computed<DashboardMetricItem[]>(() =>
  METRIC_ORDER.map((key) => metrics.value.find((m) => m.metricKey === key) ?? { metricKey: key, title: '', value: 0 })
);

const metricTitle = (key: string, fallback: string): string => {
  const k = I18N_KEY[key];
  return k ? t(k) : fallback || key;
};

const formatNumber = (n: number | null | undefined): string => (n == null ? '-' : Number(n).toLocaleString('en-US'));

const updatedText = computed<string>(() =>
  snapshotTime.value ? t('gzDashboard.updatedAt', { time: snapshotTime.value }) : t('gzDashboard.neverUpdated')
);

const load = async (): Promise<void> => {
  loading.value = true;
  try {
    const res = await getDashboardLatest();
    snapshotTime.value = res.data?.snapshotTime ?? null;
    metrics.value = res.data?.metrics ?? [];
  } finally {
    loading.value = false;
  }
};

let timer: ReturnType<typeof setTimeout> | null = null;

// 前端 5s 防抖 disable（对齐后端 @RateLimiter count=1/time=5/IP），避免误点并发触发 cron（强约束 #5）
const handleRefresh = async (): Promise<void> => {
  if (refreshDisabled.value) return;
  refreshing.value = true;
  try {
    await refreshDashboard();
    ElMessage.success(t('gzDashboard.refreshOk'));
    await load();
  } finally {
    refreshing.value = false;
    refreshDisabled.value = true;
    timer = setTimeout(() => {
      refreshDisabled.value = false;
    }, 5000);
  }
};

onMounted(load);
onUnmounted(() => {
  if (timer) clearTimeout(timer);
});
</script>

<style scoped>
.kpi-card {
  margin-bottom: 16px;
}
.kpi-title {
  font-size: 14px;
  color: #606266;
}
.kpi-value {
  font-size: 28px;
  font-weight: 600;
  margin: 8px 0 4px;
}
.kpi-sub {
  font-size: 12px;
  color: #909399;
}
.ticket-tag {
  font-size: 12px;
  color: #c0c4cc;
}
</style>
