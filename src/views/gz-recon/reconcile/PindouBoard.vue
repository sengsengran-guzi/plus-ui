<template>
  <div v-loading="loading">
    <el-alert :title="t('gzRecon.notCommission')" type="warning" show-icon :closable="false" class="mb-3" />

    <!-- 汇总卡片：收款 / 退款 / 通道费 / 净收款 / 笔数 -->
    <el-row :gutter="12" class="mb-3">
      <el-col :span="5">
        <el-card shadow="hover" class="stat-card">
          <el-statistic :title="t('gzRecon.cardGmv')" :value="yuan(board.gmvCent)" :precision="2" prefix="¥" />
        </el-card>
      </el-col>
      <el-col :span="5">
        <el-card shadow="hover" class="stat-card">
          <el-statistic :title="t('gzRecon.cardRefund')" :value="yuan(board.refundCent)" :precision="2" prefix="¥" />
        </el-card>
      </el-col>
      <el-col :span="5">
        <el-card shadow="hover" class="stat-card">
          <el-statistic :title="t('gzRecon.cardFee')" :value="yuan(board.channelFeeCent)" :precision="2" prefix="¥" />
        </el-card>
      </el-col>
      <el-col :span="5">
        <el-card shadow="hover" class="stat-card stat-card--net">
          <el-statistic :title="t('gzRecon.cardNet')" :value="yuan(board.netCent)" :precision="2" prefix="¥" />
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover" class="stat-card">
          <el-statistic :title="t('gzRecon.cardPaidCount')" :value="board.paidCount" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 逐月台账 -->
    <el-table :data="board.months" border>
      <el-table-column :label="t('gzRecon.colMonth')" prop="month" width="110" align="center" />
      <el-table-column :label="t('gzRecon.cardGmv')" align="right" width="130">
        <template #default="{ row }">¥{{ yuan(row.gmvCent).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column :label="t('gzRecon.cardRefund')" align="right" width="130">
        <template #default="{ row }">¥{{ yuan(row.refundCent).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column :label="t('gzRecon.cardFee')" align="right" width="130">
        <template #default="{ row }">¥{{ yuan(row.channelFeeCent).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column :label="t('gzRecon.cardNet')" align="right" width="140">
        <template #default="{ row }"
          ><span class="net-cell">¥{{ yuan(row.netCent).toFixed(2) }}</span></template
        >
      </el-table-column>
      <el-table-column :label="t('gzRecon.cardPaidCount')" prop="paidCount" align="center" width="100" />
      <el-table-column :label="t('gzRecon.cardRefundCount')" prop="refundCount" align="center" width="100" />
      <template #empty><el-empty :description="t('gzRecon.empty')" /></template>
    </el-table>
  </div>
</template>

<script setup lang="ts" name="GzReconPindouBoard">
import { ref, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { getPindouBoard, type PindouBoardVO } from '@/api/gz-recon/reconcile';

const props = defineProps<{ monthRange: [string, string] | null; reloadToken?: number }>();

const { t } = useI18n();
const loading = ref(false);
const board = reactive<PindouBoardVO>({
  gmvCent: 0,
  refundCent: 0,
  channelFeeCent: 0,
  netCent: 0,
  paidCount: 0,
  refundCount: 0,
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
    const res = await getPindouBoard(startMonth, endMonth);
    Object.assign(board, res.data);
  } catch (e) {
    console.error('[gz-recon] pindou board load failed', e);
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
.stat-card--net :deep(.el-statistic__content) {
  color: var(--el-color-primary);
  font-weight: 700;
}
.net-cell {
  color: var(--el-color-primary);
  font-weight: 600;
}
</style>
