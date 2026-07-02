<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzRecon.title') }}</span>
          <span class="ticket-tag">GZ-ADMIN-105</span>
        </div>
      </template>

      <el-alert :title="t('gzRecon.alertTitle')" type="info" :description="t('gzRecon.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 业务线 tab：A 预定 / B 扭蛋（计 4% 分成）；拼豆 / 回收（记账台账，不计分成） -->
      <el-tabs v-model="businessType" @tab-change="onTabChange">
        <el-tab-pane :label="t('gzRecon.tabA')" name="preorder" />
        <el-tab-pane :label="t('gzRecon.tabB')" name="gacha" />
        <el-tab-pane :label="t('gzRecon.tabPindou')" name="pindou" />
        <el-tab-pane :label="t('gzRecon.tabRecycle')" name="recycle" />
      </el-tabs>

      <!-- 周期筛选 + 导出（导出/重算仅分成口径 tab 可用） -->
      <el-form inline class="mb-2" @submit.prevent="onSearch">
        <el-form-item :label="t('gzRecon.period')">
          <el-date-picker
            v-model="monthRange"
            type="monthrange"
            value-format="YYYY-MM"
            :start-placeholder="t('gzRecon.monthStart')"
            :end-placeholder="t('gzRecon.monthEnd')"
            style="width: 300px"
            @change="onMonthChange"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="onSearch">{{ t('gzRecon.search') }}</el-button>
          <el-button v-if="isCommissionTab" v-hasPermi="['gz:recon:reconcile:export']" :icon="Download" :disabled="!canExport" @click="handleExport">
            {{ t('gzRecon.export') }}
          </el-button>
          <el-button v-if="isCommissionTab" v-hasPermi="['gz:recon:reconcile:export']" :icon="Refresh" @click="handleRebuild">
            {{ t('gzRecon.rebuild') }}
          </el-button>
        </el-form-item>
      </el-form>

      <!-- ============ A/B 分成口径（preorder / gacha）============ -->
      <template v-if="isCommissionTab">
        <!-- 四栏 + 分成数字卡片 -->
        <el-row :gutter="12" class="mb-3">
          <el-col :span="5">
            <el-card shadow="hover" class="stat-card">
              <el-statistic :title="t('gzRecon.cardGmv')" :value="yuan(summary.gmvCent)" :precision="2" prefix="¥" />
            </el-card>
          </el-col>
          <el-col :span="5">
            <el-card shadow="hover" class="stat-card">
              <el-statistic :title="t('gzRecon.cardRefund')" :value="yuan(summary.refundCent)" :precision="2" prefix="¥" />
            </el-card>
          </el-col>
          <el-col :span="5">
            <el-card shadow="hover" class="stat-card">
              <el-statistic :title="t('gzRecon.cardFee')" :value="yuan(summary.channelFeeCent)" :precision="2" prefix="¥" />
            </el-card>
          </el-col>
          <el-col :span="5">
            <el-card shadow="hover" class="stat-card stat-card--settle">
              <el-statistic :title="t('gzRecon.cardSettle')" :value="yuan(summary.settleCent)" :precision="2" prefix="¥" />
            </el-card>
          </el-col>
          <el-col :span="4">
            <el-card shadow="hover" class="stat-card stat-card--commission">
              <el-statistic :title="commissionTitle" :value="yuan(summary.commissionCent)" :precision="2" prefix="¥" />
            </el-card>
          </el-col>
        </el-row>

        <!-- 月度对账单明细 -->
        <el-table :data="monthlyRows" border>
          <el-table-column :label="t('gzRecon.colMonth')" prop="businessMonth" width="110" align="center" />
          <el-table-column :label="t('gzRecon.colBizLine')" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.businessType === 'preorder' ? 'primary' : 'success'" size="small">
                {{ row.businessType === 'preorder' ? t('gzRecon.tabA') : t('gzRecon.tabB') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="t('gzRecon.cardGmv')" align="right" width="130">
            <template #default="{ row }">¥{{ yuan(row.gmvCent).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column :label="t('gzRecon.cardRefund')" align="right" width="130">
            <template #default="{ row }">¥{{ yuan(row.refundCent).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column :label="t('gzRecon.cardFee')" align="right" width="130">
            <template #default="{ row }">¥{{ yuan(row.channelFeeCent).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column :label="t('gzRecon.cardSettle')" align="right" width="140">
            <template #default="{ row }">
              <span class="settle-cell">¥{{ yuan(row.settleCent).toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('gzRecon.colCommission')" align="right" width="150">
            <template #default="{ row }">
              <span class="commission-cell">¥{{ yuan(row.commissionCent).toFixed(2) }}</span>
              <span class="rate-sub">{{ (row.commissionRateBp / 100).toFixed(0) }}%</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('gzRecon.colStatus')" width="100" align="center">
            <template #default="{ row }">
              <dict-tag :options="gz_recon_status" :value="row.status" />
            </template>
          </el-table-column>
          <template #empty><el-empty :description="t('gzRecon.empty')" /></template>
        </el-table>
      </template>

      <!-- ============ 拼豆记账台账（不计分成）============ -->
      <PindouBoard v-else-if="businessType === 'pindou'" :month-range="monthRange" :reload-token="boardReloadToken" />

      <!-- ============ 回收反向打款台账（不计分成）============ -->
      <RecycleBoard v-else-if="businessType === 'recycle'" :month-range="monthRange" :reload-token="boardReloadToken" />
    </el-card>
  </div>
</template>

<script setup lang="ts" name="GzReconReconcile">
import { ref, reactive, computed, getCurrentInstance, toRefs } from 'vue';
import { Search, Download, Refresh } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { getReconSummary, listReconMonthly, rebuildRecon, type ReconSummaryVO, type GzReconMonthlyVO } from '@/api/gz-recon/reconcile';
import PindouBoard from './PindouBoard.vue';
import RecycleBoard from './RecycleBoard.vue';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as any;
const { gz_recon_status } = toRefs<any>(proxy?.useDict('gz_recon_status'));

const loading = ref(false);
const businessType = ref<string>('preorder');
const monthRange = ref<[string, string] | null>(defaultMonthRange());
const monthlyRows = ref<GzReconMonthlyVO[]>([]);
/** 拼豆/回收板块强制重取令牌（查询按钮 bump，即便月份未变也刷新子组件） */
const boardReloadToken = ref(0);
const summary = reactive<ReconSummaryVO>({
  businessType: 'preorder',
  gmvCent: 0,
  refundCent: 0,
  channelFeeCent: 0,
  settleCent: 0,
  commissionRateBp: 400,
  commissionCent: 0
});

/** 分成口径 tab（preorder=A / gacha=B），拼豆/回收为记账台账不计分成 */
const isCommissionTab = computed(() => businessType.value === 'preorder' || businessType.value === 'gacha');
const commissionTitle = computed(() => `${t('gzRecon.cardCommission')}（${(summary.commissionRateBp / 100).toFixed(0)}%）`);
const canExport = computed(() => !!monthRange.value && monthRange.value.length === 2);

/** 默认月份区间 = 本月（yyyy-MM ~ yyyy-MM） */
function defaultMonthRange(): [string, string] {
  const now = new Date();
  const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return [m, m];
}

/** 分 → 元（数值，供 el-statistic / toFixed 显示） */
function yuan(cent?: number | null): number {
  return (cent || 0) / 100;
}

/** A/B 分成口径加载（SUM gz_recon_monthly）。 */
async function loadCommission() {
  if (!monthRange.value || monthRange.value.length !== 2) {
    return;
  }
  const [startMonth, endMonth] = monthRange.value;
  loading.value = true;
  try {
    const [sumResp, listResp] = await Promise.all([
      getReconSummary(businessType.value, startMonth, endMonth),
      listReconMonthly(businessType.value, startMonth, endMonth)
    ]);
    Object.assign(summary, (sumResp as any).data);
    monthlyRows.value = ((listResp as any).data as GzReconMonthlyVO[]) || [];
  } catch (e) {
    console.error('[gz-recon] load failed', e);
    ElMessage.error(t('gzRecon.loadFailed'));
  } finally {
    loading.value = false;
  }
}

/** 切 tab：分成口径 tab 直接加载；拼豆/回收板块由子组件挂载时（immediate watch）自取。 */
function onTabChange() {
  if (isCommissionTab.value) {
    loadCommission();
  }
}

/** 月份区间变化：分成口径重载；拼豆/回收子组件 watch monthRange 自取。 */
function onMonthChange() {
  if (isCommissionTab.value) {
    loadCommission();
  }
}

/** 查询按钮：分成口径重载；拼豆/回收即便月份未变也强制重取（bump token）。 */
function onSearch() {
  if (isCommissionTab.value) {
    loadCommission();
  } else {
    boardReloadToken.value++;
  }
}

function handleExport() {
  if (!monthRange.value || monthRange.value.length !== 2) {
    return;
  }
  const [startMonth, endMonth] = monthRange.value;
  const lineTag = businessType.value === 'preorder' ? 'A' : 'B';
  proxy?.download(
    'system/gz/recon/reconcile/export',
    { businessType: businessType.value, startMonth, endMonth },
    `对账明细_业务线${lineTag}_${startMonth}至${endMonth}.xlsx`
  );
}

/** D16 #1：立即重算（消除未配置定时任务时首月分成 ¥0 风险，跑批幂等重跑安全）。 */
async function handleRebuild() {
  try {
    await ElMessageBox.confirm(t('gzRecon.rebuildConfirm'), { type: 'warning' });
  } catch {
    return; // 用户取消
  }
  loading.value = true;
  try {
    await rebuildRecon();
    ElMessage.success(t('gzRecon.rebuildOk'));
    await loadCommission();
  } catch (e) {
    console.error('[gz-recon] rebuild failed', e);
    ElMessage.error(t('gzRecon.loadFailed'));
  } finally {
    loading.value = false;
  }
}

loadCommission();
</script>

<style scoped>
.stat-card {
  text-align: center;
}
.stat-card--settle :deep(.el-statistic__content) {
  color: var(--el-color-primary);
  font-weight: 700;
}
.stat-card--commission :deep(.el-statistic__content) {
  color: var(--el-color-danger);
  font-weight: 700;
}
.settle-cell {
  color: var(--el-color-primary);
  font-weight: 600;
}
.commission-cell {
  color: var(--el-color-danger);
  font-weight: 600;
}
.rate-sub {
  margin-left: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.ticket-tag {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
