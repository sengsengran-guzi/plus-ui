<template>
  <div v-loading="loading">
    <el-alert :title="t('gzRecon.recycleNote')" type="warning" show-icon :closable="false" class="mb-3" />

    <!-- 汇总卡片：已打款金额 / 成功笔数 / 处理中 / 失败 -->
    <el-row :gutter="12" class="mb-3">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card stat-card--payout">
          <el-statistic :title="t('gzRecon.recyclePayoutAmount')" :value="yuan(board.payoutSuccessCent)" :precision="2" prefix="¥" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic :title="t('gzRecon.recyclePayoutCount')" :value="board.payoutSuccessCount" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic :title="t('gzRecon.recycleProcessing')" :value="board.processingCount" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card stat-card--failed">
          <el-statistic :title="t('gzRecon.recycleFailed')" :value="board.failedCount" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 逐月成功打款台账 -->
    <el-table :data="board.months" border>
      <el-table-column :label="t('gzRecon.colMonth')" prop="month" width="120" align="center" />
      <el-table-column :label="t('gzRecon.recyclePayoutAmount')" align="right" width="180">
        <template #default="{ row }"
          ><span class="payout-cell">¥{{ yuan(row.payoutCent).toFixed(2) }}</span></template
        >
      </el-table-column>
      <el-table-column :label="t('gzRecon.recyclePayoutCount')" prop="payoutCount" align="center" width="120" />
      <template #empty><el-empty :description="t('gzRecon.empty')" /></template>
    </el-table>
  </div>
</template>

<script setup lang="ts" name="GzReconRecycleBoard">
import { ref, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { getRecycleBoard, type RecycleBoardVO } from '@/api/gz-recon/reconcile';

const props = defineProps<{ monthRange: [string, string] | null; reloadToken?: number }>();

const { t } = useI18n();
const loading = ref(false);
const board = reactive<RecycleBoardVO>({
  payoutSuccessCent: 0,
  payoutSuccessCount: 0,
  processingCount: 0,
  failedCount: 0,
  months: []
});

/** 分 → 元（数值，供 el-statistic / toFixed 显示） */
function yuan(cent?: number | null): number {
  return (cent || 0) / 100;
}

async function reload() {
  if (!props.monthRange || props.monthRange.length !== 2) {
    return;
  }
  const [startMonth, endMonth] = props.monthRange;
  loading.value = true;
  try {
    const res = await getRecycleBoard(startMonth, endMonth);
    Object.assign(board, res.data);
  } catch (e) {
    console.error('[gz-recon] recycle board load failed', e);
    ElMessage.error(t('gzRecon.loadFailed'));
  } finally {
    loading.value = false;
  }
}

watch([() => props.monthRange, () => props.reloadToken], reload, { immediate: true, deep: true });
</script>

<style scoped>
.stat-card {
  text-align: center;
}
.stat-card--payout :deep(.el-statistic__content) {
  color: var(--el-color-warning);
  font-weight: 700;
}
.stat-card--failed :deep(.el-statistic__content) {
  color: var(--el-color-danger);
  font-weight: 700;
}
.payout-cell {
  color: var(--el-color-warning);
  font-weight: 600;
}
</style>
