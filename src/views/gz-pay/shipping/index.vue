<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzPayShipping.title') }}</span>
          <el-button type="primary" :loading="retrying" @click="handleRetryAll">
            {{ t('gzPayShipping.retryAll') }}
          </el-button>
        </div>
      </template>

      <el-alert :title="t('gzPayShipping.tip')" type="info" :closable="false" show-icon class="mb-3" />

      <el-form :model="query" inline @submit.prevent="handleQuery">
        <el-form-item :label="t('gzPayShipping.status')">
          <el-select v-model="query.uploadStatus" :placeholder="t('gzPayShipping.statusPlaceholder')" clearable style="width: 140px">
            <el-option v-for="s in STATUS_OPTIONS" :key="s" :label="t(`gzPayShipping.st_${s}`)" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzPayShipping.businessType')">
          <el-select v-model="query.businessType" :placeholder="t('gzPayShipping.businessTypePlaceholder')" clearable style="width: 150px">
            <el-option label="pindou" value="pindou" />
            <el-option label="preorder" value="preorder" />
            <el-option label="gacha" value="gacha" />
            <el-option label="test" value="test" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzPayShipping.outTradeNo')">
          <el-input v-model="query.outTradeNo" :placeholder="t('gzPayShipping.outTradeNoPlaceholder')" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery">{{ t('gzPayShipping.search') }}</el-button>
          <el-button @click="resetQuery">{{ t('gzPayShipping.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="list" border>
        <el-table-column :label="t('gzPayShipping.colOutTradeNo')" prop="outTradeNo" min-width="200" show-overflow-tooltip />
        <el-table-column :label="t('gzPayShipping.colBizType')" prop="businessType" width="100" />
        <el-table-column :label="t('gzPayShipping.colStatus')" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.uploadStatus)">{{ t(`gzPayShipping.st_${row.uploadStatus}`) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzPayShipping.colAttempt')" prop="attemptCount" width="90" align="center" />
        <el-table-column :label="t('gzPayShipping.colTransactionId')" prop="transactionId" min-width="180" show-overflow-tooltip />
        <el-table-column :label="t('gzPayShipping.colLastError')" prop="lastError" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="last-error">{{ row.lastError || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzPayShipping.colPaidTime')" prop="paidTime" width="170" />
        <el-table-column :label="t('gzPayShipping.colUploadedTime')" prop="uploadedTime" width="170">
          <template #default="{ row }">{{ row.uploadedTime || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzPayShipping.colAction')" width="100" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.uploadStatus !== 'success'" link type="primary" @click="handleRetryOne(row)">
              {{ t('gzPayShipping.retryOne') }}
            </el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:limit="query.pageSize" v-model:page="query.pageNum" :total="total" @pagination="loadList" />
    </el-card>
  </div>
</template>

<script setup lang="ts" name="GzPayShipping">
import { ref, reactive, getCurrentInstance, type ComponentInternalInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import { listShippingOrders, retryAllShipping, retryOneShipping, type GzPayShippingOrderVO, type GzPayShippingQuery } from '@/api/gz-pay/shipping';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const STATUS_OPTIONS = ['pending', 'failed', 'success'];

const loading = ref(false);
const retrying = ref(false);
const list = ref<GzPayShippingOrderVO[]>([]);
const total = ref(0);
const query = reactive<GzPayShippingQuery>({
  pageNum: 1,
  pageSize: 10,
  uploadStatus: undefined,
  businessType: undefined,
  outTradeNo: undefined
});

type TagType = 'warning' | 'primary' | 'success' | 'info' | 'danger';

function statusTagType(status: string): TagType {
  switch (status) {
    case 'success':
      return 'success';
    case 'failed':
      return 'danger';
    case 'pending':
      return 'warning';
    default:
      return 'info';
  }
}

async function loadList() {
  loading.value = true;
  try {
    const res = await listShippingOrders(query);
    list.value = res.rows ?? [];
    total.value = (res as any).total || 0;
  } catch (e) {
    (proxy as any)?.$modal?.msgError?.(t('gzPayShipping.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  query.pageNum = 1;
  loadList();
}

function resetQuery() {
  query.uploadStatus = undefined;
  query.businessType = undefined;
  query.outTradeNo = undefined;
  handleQuery();
}

async function handleRetryAll() {
  try {
    await (proxy as any)?.$modal?.confirm?.(t('gzPayShipping.retryAllConfirm'));
  } catch {
    return; // 取消
  }
  retrying.value = true;
  try {
    const res = await retryAllShipping();
    const stats = res.data;
    (proxy as any)?.$modal?.msgSuccess?.(t('gzPayShipping.retryAllResult', { scanned: stats.scanned, success: stats.success, failed: stats.failed }));
    loadList();
  } catch (e) {
    (proxy as any)?.$modal?.msgError?.(t('gzPayShipping.opFailed'));
  } finally {
    retrying.value = false;
  }
}

async function handleRetryOne(row: GzPayShippingOrderVO) {
  loading.value = true;
  try {
    await retryOneShipping(row.id);
    (proxy as any)?.$modal?.msgSuccess?.(t('gzPayShipping.retryOneOk'));
    loadList();
  } catch (e) {
    (proxy as any)?.$modal?.msgError?.(t('gzPayShipping.opFailed'));
  } finally {
    loading.value = false;
  }
}

loadList();
</script>

<style scoped>
.last-error {
  font-family: monospace;
  font-size: 12px;
  color: #f56c6c;
  word-break: break-all;
}
</style>
