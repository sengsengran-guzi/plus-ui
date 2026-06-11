<template>
  <div v-loading="loading" class="v11-summary">
    <div class="v11-header">
      <span class="v11-title">{{ t('dashboard.v11.sectionTitle') }}</span>
      <div class="flex items-center" style="gap: 12px">
        <span class="ticket-tag">GZ-ADMIN-106</span>
        <el-button type="primary" :icon="Refresh" size="small" @click="load">{{ t('dashboard.v11.refresh') }}</el-button>
      </div>
    </div>

    <!-- 今日订单 / GMV + 本月 GMV / 退款 / 实际到账（每卡 A/B 两条并列） -->
    <el-row :gutter="16">
      <el-col :xs="24" :sm="12" :md="8" :lg="6">
        <el-card shadow="hover" class="v11-card">
          <div class="v11-card-title">{{ t('dashboard.v11.todayOrders') }}</div>
          <div class="v11-ab"><span>A {{ s.todayOrderCountPreorder }}</span><span>B {{ s.todayOrderCountGacha }}</span></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="6">
        <el-card shadow="hover" class="v11-card">
          <div class="v11-card-title">{{ t('dashboard.v11.todayGmv') }}</div>
          <div class="v11-ab"><span>A ¥{{ yuan(s.todayGmvCentPreorder) }}</span><span>B ¥{{ yuan(s.todayGmvCentGacha) }}</span></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="6">
        <el-card shadow="hover" class="v11-card">
          <div class="v11-card-title">{{ t('dashboard.v11.monthGmv') }}</div>
          <div class="v11-ab"><span>A ¥{{ yuan(s.monthGmvCentPreorder) }}</span><span>B ¥{{ yuan(s.monthGmvCentGacha) }}</span></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="6">
        <el-card shadow="hover" class="v11-card">
          <div class="v11-card-title">{{ t('dashboard.v11.monthRefund') }}</div>
          <div class="v11-ab"><span>A ¥{{ yuan(s.monthRefundCentPreorder) }}</span><span>B ¥{{ yuan(s.monthRefundCentGacha) }}</span></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="6">
        <el-card shadow="hover" class="v11-card v11-card--settle">
          <div class="v11-card-title">{{ t('dashboard.v11.monthSettle') }}</div>
          <div class="v11-ab"><span>A ¥{{ yuan(s.monthSettleCentPreorder) }}</span><span>B ¥{{ yuan(s.monthSettleCentGacha) }}</span></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="6">
        <el-card shadow="hover" class="v11-card">
          <div class="v11-card-title">{{ t('dashboard.v11.gachaOpenCount') }}</div>
          <div class="v11-value">{{ s.gachaOpenCount }}</div>
          <div class="v11-sub">{{ t('dashboard.v11.gachaAvgValue') }}: ¥{{ yuan(s.gachaAvgValueCent) }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="6">
        <el-card shadow="hover" class="v11-card v11-card--pending" @click="goLogistics">
          <div class="v11-card-title">{{ t('dashboard.v11.pendingShip') }}</div>
          <div class="v11-value v11-value--alert">{{ s.pendingShipCount }}</div>
          <div class="v11-sub">{{ t('dashboard.v11.pendingShipHint') }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 热销预购 Top10 -->
    <el-card shadow="never" class="mt-2">
      <template #header><span class="v11-card-title">{{ t('dashboard.v11.topProducts') }}</span></template>
      <el-table :data="s.topProducts" border size="small">
        <el-table-column :label="t('dashboard.v11.rank')" type="index" width="70" align="center" />
        <el-table-column :label="t('dashboard.v11.productName')" prop="name" min-width="200" show-overflow-tooltip />
        <el-table-column :label="t('dashboard.v11.salesCount')" prop="salesCount" width="120" align="right" />
        <template #empty><el-empty :description="t('dashboard.v11.empty')" /></template>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="V11SummaryRow">
import { ref, reactive } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { getV11Summary, type GzDashboardV11SummaryVO } from '@/api/gz-recon/dashboard';

const { t } = useI18n();
const router = useRouter();

const loading = ref(false);
const s = reactive<GzDashboardV11SummaryVO>({
  todayOrderCountPreorder: 0,
  todayOrderCountGacha: 0,
  todayGmvCentPreorder: 0,
  todayGmvCentGacha: 0,
  monthGmvCentPreorder: 0,
  monthGmvCentGacha: 0,
  monthRefundCentPreorder: 0,
  monthRefundCentGacha: 0,
  monthSettleCentPreorder: 0,
  monthSettleCentGacha: 0,
  gachaOpenCount: 0,
  gachaAvgValueCent: 0,
  pendingShipCount: 0,
  topProducts: []
});

function yuan(cent?: number | null): string {
  return ((cent || 0) / 100).toFixed(2);
}

async function load() {
  loading.value = true;
  try {
    const resp = await getV11Summary();
    Object.assign(s, (resp as any).data);
  } catch (e) {
    console.error('[dashboard-v11] load failed', e);
  } finally {
    loading.value = false;
  }
}

// 待发货卡片点击 → 跳订单管理（owner 在此推进物流，GZ-ADMIN-104）
function goLogistics() {
  router.push('/gz-ord/orders');
}

load();
</script>

<style scoped>
.v11-summary {
  margin-top: 16px;
}
.v11-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.v11-title {
  font-size: 15px;
  font-weight: 600;
}
.v11-card {
  margin-bottom: 16px;
  min-height: 92px;
}
.v11-card-title {
  font-size: 13px;
  color: #606266;
}
.v11-ab {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 16px;
  font-weight: 600;
}
.v11-value {
  font-size: 26px;
  font-weight: 600;
  margin: 8px 0 2px;
}
.v11-value--alert {
  color: var(--el-color-danger);
}
.v11-card--settle :deep(.v11-ab) {
  color: var(--el-color-primary);
}
.v11-card--pending {
  cursor: pointer;
}
.v11-sub {
  font-size: 12px;
  color: #909399;
}
.ticket-tag {
  font-size: 12px;
  color: #c0c4cc;
}
</style>
