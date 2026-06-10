<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzPayPayout.title') }}</span>
          <span class="ticket-tag">GZ-PAY-105</span>
        </div>
      </template>

      <el-form :model="query" inline @submit.prevent="handleQuery">
        <el-form-item :label="t('gzPayPayout.status')">
          <el-select v-model="query.status" :placeholder="t('gzPayPayout.statusPlaceholder')" clearable style="width: 150px">
            <el-option v-for="s in STATUS_OPTIONS" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzPayPayout.outPayoutNo')">
          <el-input v-model="query.outPayoutNo" :placeholder="t('gzPayPayout.outPayoutNoPlaceholder')" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item :label="t('gzPayPayout.businessOrderNo')">
          <el-input v-model="query.businessOrderNo" :placeholder="t('gzPayPayout.businessOrderNoPlaceholder')" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery">{{ t('gzPayPayout.search') }}</el-button>
          <el-button @click="resetQuery">{{ t('gzPayPayout.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="list" border>
        <el-table-column :label="t('gzPayPayout.colOutPayoutNo')" prop="outPayoutNo" min-width="200" show-overflow-tooltip />
        <el-table-column :label="t('gzPayPayout.colBusinessOrderNo')" prop="businessOrderNo" min-width="180" show-overflow-tooltip />
        <el-table-column :label="t('gzPayPayout.colAmount')" width="110" align="right">
          <template #default="{ row }">¥{{ (row.amountCent / 100).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzPayPayout.colStatus')" width="110">
          <template #default="{ row }">
            <dict-tag :options="gz_payout_status" :value="row.status" />
          </template>
        </el-table-column>
        <el-table-column :label="t('gzPayPayout.colTransferredTime')" prop="transferredTime" width="170" />
        <el-table-column :label="t('gzPayPayout.colCreateTime')" prop="createTime" width="170" />
        <el-table-column :label="t('gzPayPayout.colAction')" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">{{ t('gzPayPayout.detail') }}</el-button>
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

    <!-- 详情 dialog -->
    <el-dialog v-model="detailVisible" :title="t('gzPayPayout.detailTitle')" width="680px">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item :label="t('gzPayPayout.colOutPayoutNo')" :span="2">{{ detail.outPayoutNo }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzPayPayout.colBusinessOrderNo')" :span="2">{{ detail.businessOrderNo }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzPayPayout.colAmount')">¥{{ (detail.amountCent / 100).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzPayPayout.colStatus')">
          <dict-tag :options="gz_payout_status" :value="detail.status" />
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzPayPayout.colReceiverOpenid')" :span="2">{{ detail.receiverOpenid }}</el-descriptions-item>
        <el-descriptions-item label="payout_id">{{ detail.payoutId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="batch_id">{{ detail.batchId || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzPayPayout.colTransferredTime')">{{ detail.transferredTime || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzPayPayout.colCreateTime')">{{ detail.createTime || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzPayPayout.colFailReason')" :span="2">{{ detail.failReason || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzPayPayout">
import { ref, reactive, toRefs, getCurrentInstance, type ComponentInternalInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import { listPayout, type GzPayPayoutVO, type GzPayPayoutQuery } from '@/api/gz-pay/payout';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const { gz_payout_status } = toRefs<any>((proxy as any)?.useDict('gz_payout_status'));

const STATUS_OPTIONS = ['created', 'processing', 'success', 'failed', 'cancelled'];

const loading = ref(false);
const list = ref<GzPayPayoutVO[]>([]);
const total = ref(0);
const query = reactive<GzPayPayoutQuery>({
  pageNum: 1,
  pageSize: 10,
  status: undefined,
  outPayoutNo: undefined,
  businessOrderNo: undefined
});

const detailVisible = ref(false);
const detail = ref<GzPayPayoutVO | null>(null);

async function loadList() {
  loading.value = true;
  try {
    const res = await listPayout(query);
    list.value = res.data ?? [];
    total.value = (res as any).total || 0;
  } catch (e) {
    (proxy as any)?.$modal?.msgError?.(t('gzPayPayout.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  query.pageNum = 1;
  loadList();
}

function resetQuery() {
  query.status = undefined;
  query.outPayoutNo = undefined;
  query.businessOrderNo = undefined;
  handleQuery();
}

function openDetail(row: GzPayPayoutVO) {
  detail.value = row;
  detailVisible.value = true;
}

loadList();
</script>

<style scoped>
.ticket-tag {
  font-size: 12px;
  color: #909399;
}
</style>
