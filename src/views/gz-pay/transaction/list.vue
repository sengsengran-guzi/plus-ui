<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzPay.transactionTitle') }}</span>
          <span class="ticket-tag">GZ-PAY-001</span>
        </div>
      </template>

      <el-form :model="query" inline @submit.prevent="handleQuery">
        <el-form-item :label="t('gzPay.businessType')">
          <el-select v-model="query.businessType" :placeholder="t('gzPay.businessTypePlaceholder')" clearable style="width: 160px">
            <el-option label="test" value="test" />
            <el-option label="preorder" value="preorder" />
            <el-option label="gacha" value="gacha" />
            <el-option label="pindou" value="pindou" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzPay.status')">
          <el-select v-model="query.status" :placeholder="t('gzPay.statusPlaceholder')" clearable style="width: 140px">
            <el-option v-for="s in STATUS_OPTIONS" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzPay.outTradeNo')">
          <el-input v-model="query.outTradeNo" :placeholder="t('gzPay.outTradeNoPlaceholder')" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery">{{ t('gzPay.search') }}</el-button>
          <el-button @click="resetQuery">{{ t('gzPay.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="list" border>
        <el-table-column :label="t('gzPay.colOutTradeNo')" prop="outTradeNo" min-width="200" show-overflow-tooltip />
        <el-table-column :label="t('gzPay.colBizType')" prop="businessType" width="110" />
        <el-table-column :label="t('gzPay.colAmount')" width="110" align="right">
          <template #default="{ row }">¥{{ (row.amountCent / 100).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzPay.colStatus')" prop="status" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzPay.colTransactionId')" prop="transactionId" min-width="180" show-overflow-tooltip />
        <el-table-column :label="t('gzPay.colPaidTime')" prop="paidTime" width="170" />
        <el-table-column :label="t('gzPay.colCreateTime')" prop="createTime" width="170" />
        <el-table-column :label="t('gzPay.colAction')" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">{{ t('gzPay.detail') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:limit="query.pageSize"
        v-model:page="query.pageNum"
        :total="total"
        @pagination="loadList"
      />
    </el-card>

    <!-- 详情 dialog（含回调日志） -->
    <el-dialog v-model="detailVisible" :title="t('gzPay.detailTitle')" width="720px">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item :label="t('gzPay.colOutTradeNo')" :span="2">{{ detail.outTradeNo }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzPay.colBizType')">{{ detail.businessType }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzPay.colAmount')">¥{{ (detail.amountCent / 100).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzPay.colStatus')">
          <el-tag :type="statusTagType(detail.status)">{{ detail.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="prepay_id">{{ detail.prepayId || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzPay.colTransactionId')" :span="2">{{ detail.transactionId || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzPay.colPaidTime')">{{ detail.paidTime || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzPay.colCreateTime')">{{ detail.createTime || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-divider>{{ t('gzPay.callbackLogs') }}</el-divider>
      <el-table :data="callbackLogs" border size="small" max-height="240">
        <el-table-column :label="t('gzPay.cbType')" prop="callbackType" width="90" />
        <el-table-column :label="t('gzPay.cbStatus')" prop="processStatus" width="110">
          <template #default="{ row }">
            <el-tag :type="cbStatusTagType(row.processStatus)" size="small">{{ row.processStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzPay.cbError')" prop="processError" min-width="160" show-overflow-tooltip />
        <el-table-column :label="t('gzPay.cbTime')" prop="createTime" width="170" />
        <el-table-column :label="t('gzPay.cbBody')" min-width="200">
          <template #default="{ row }">
            <span class="cb-body">{{ row.rawBody }}</span>
          </template>
        </el-table-column>
        <template #empty>{{ t('gzPay.cbEmpty') }}</template>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzPayTransaction">
import { ref, reactive, getCurrentInstance, type ComponentInternalInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  listPayTransaction,
  listCallbackLogs,
  type GzPayTransactionVO,
  type GzPayCallbackLogVO,
  type GzPayTransactionQuery
} from '@/api/gz-pay';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const STATUS_OPTIONS = ['created', 'pending', 'paid', 'timeout', 'closed', 'failed'];

const loading = ref(false);
const list = ref<GzPayTransactionVO[]>([]);
const total = ref(0);
const query = reactive<GzPayTransactionQuery>({
  pageNum: 1,
  pageSize: 10,
  businessType: undefined,
  status: undefined,
  outTradeNo: undefined
});

const detailVisible = ref(false);
const detail = ref<GzPayTransactionVO | null>(null);
const callbackLogs = ref<GzPayCallbackLogVO[]>([]);

type TagType = 'warning' | 'primary' | 'success' | 'info' | 'danger';

function statusTagType(status: string): TagType {
  switch (status) {
    case 'paid':
      return 'success';
    case 'pending':
    case 'created':
      return 'warning';
    case 'timeout':
    case 'failed':
    case 'closed':
      return 'info';
    default:
      return 'primary';
  }
}

function cbStatusTagType(status: string): TagType {
  switch (status) {
    case 'processed':
      return 'success';
    case 'received':
    case 'duplicated':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'primary';
  }
}

async function loadList() {
  loading.value = true;
  try {
    const res = await listPayTransaction(query);
    list.value = res.data ?? [];
    total.value = (res as any).total || 0;
  } catch (e) {
    (proxy as any)?.$modal?.msgError?.(t('gzPay.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  query.pageNum = 1;
  loadList();
}

function resetQuery() {
  query.businessType = undefined;
  query.status = undefined;
  query.outTradeNo = undefined;
  handleQuery();
}

async function openDetail(row: GzPayTransactionVO) {
  detail.value = row;
  detailVisible.value = true;
  callbackLogs.value = [];
  try {
    const res = await listCallbackLogs(row.outTradeNo);
    callbackLogs.value = res.data ?? [];
  } catch (e) {
    // 回调日志加载失败不阻断详情展示
  }
}

loadList();
</script>

<style scoped>
.ticket-tag {
  font-size: 12px;
  color: #909399;
}
.cb-body {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}
</style>
