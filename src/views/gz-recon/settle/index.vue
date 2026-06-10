<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzReconSettle.title') }}</span>
          <span class="ticket-tag">GZ-ADMIN-105</span>
        </div>
      </template>

      <el-alert :title="t('gzReconSettle.alertTitle')" type="info" :description="t('gzReconSettle.alertDesc')" show-icon :closable="false" class="mb-3" />

      <el-table :data="rows" border>
        <el-table-column :label="t('gzReconSettle.colQuarter')" prop="quarter" width="120" align="center" />
        <el-table-column :label="t('gzReconSettle.colCommission')" align="right" width="170">
          <template #default="{ row }">¥{{ yuan(row.commissionTotalCent).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzReconSettle.colMaintenance')" align="right" width="170">
          <template #default="{ row }">¥{{ yuan(row.maintenanceTotalCent).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzReconSettle.colPayable')" align="right" width="180">
          <template #default="{ row }">
            <span class="payable-cell">¥{{ yuan(row.payableTotalCent).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzReconSettle.colPaid')" align="right" width="150">
          <template #default="{ row }">{{ row.paidAmountCent != null ? '¥' + yuan(row.paidAmountCent).toFixed(2) : '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzReconSettle.colInvoice')" prop="invoiceNo" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.invoiceNo || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzReconSettle.colStatus')" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('gzReconSettle.empty')" /></template>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="GzReconSettle">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { listReconSettle, type GzReconSettleVO } from '@/api/gz-recon/reconcile';

const { t } = useI18n();

const loading = ref(false);
const rows = ref<GzReconSettleVO[]>([]);

/** 分 → 元 */
function yuan(cent?: number | null): number {
  return (cent || 0) / 100;
}

// 季度结算状态 pending / paid / invoiced / closed（无系统字典，本页内联映射）
function statusLabel(s: string): string {
  return t(`gzReconSettle.status_${s}`) || s;
}
function statusTagType(s: string): 'info' | 'warning' | 'success' | 'primary' {
  const map: Record<string, 'info' | 'warning' | 'success' | 'primary'> = {
    pending: 'warning',
    paid: 'primary',
    invoiced: 'success',
    closed: 'info'
  };
  return map[s] || 'info';
}

async function loadList() {
  loading.value = true;
  try {
    const resp = await listReconSettle();
    rows.value = ((resp as any).data as GzReconSettleVO[]) || [];
  } catch (e) {
    console.error('[gz-recon-settle] load failed', e);
    ElMessage.error(t('gzReconSettle.loadFailed'));
  } finally {
    loading.value = false;
  }
}

loadList();
</script>

<style scoped>
.payable-cell {
  color: var(--el-color-danger);
  font-weight: 700;
}
.ticket-tag {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
