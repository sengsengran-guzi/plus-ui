<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzRefund.title') }}</span>
          <span class="ticket-tag">GZ-PAY-103</span>
        </div>
      </template>

      <el-alert :title="t('gzRefund.tip')" type="info" :closable="false" show-icon class="mb-3" />

      <el-form :model="query" inline @submit.prevent="handleQuery">
        <el-form-item :label="t('gzRefund.outTradeNo')">
          <el-input v-model="query.outTradeNo" :placeholder="t('gzRefund.outTradeNoPlaceholder')" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item :label="t('gzRefund.status')">
          <el-select v-model="query.status" :placeholder="t('gzRefund.statusPlaceholder')" clearable style="width: 140px">
            <el-option v-for="s in STATUS_OPTIONS" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery">{{ t('gzRefund.search') }}</el-button>
          <el-button @click="resetQuery">{{ t('gzRefund.reset') }}</el-button>
          <!-- 「申请退款」入口：订单详情看板（ADMIN-103）未完工 → disabled 占位（AC5，单向调用不依赖看板） -->
          <el-tooltip :content="t('gzRefund.applyDisabledHint')" placement="top">
            <span>
              <el-button v-hasPermi="['gz:pay:refund:apply']" type="warning" disabled>
                {{ t('gzRefund.applyBtn') }}
              </el-button>
            </span>
          </el-tooltip>
        </el-form-item>
      </el-form>

      <el-table :data="list" border>
        <el-table-column :label="t('gzRefund.colRefundNo')" prop="refundNo" min-width="180" show-overflow-tooltip />
        <el-table-column :label="t('gzRefund.colOutTradeNo')" prop="outTradeNo" min-width="180" show-overflow-tooltip />
        <el-table-column :label="t('gzRefund.colAmount')" width="110" align="right">
          <template #default="{ row }">¥{{ (row.refundAmountCent / 100).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzRefund.colReason')" prop="reason" min-width="160" show-overflow-tooltip />
        <el-table-column :label="t('gzRefund.colTriggeredBy')" prop="triggeredBy" width="120" />
        <el-table-column :label="t('gzRefund.colStatus')" prop="status" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzRefund.colWechatRefundId')" prop="wechatRefundId" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.wechatRefundId || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzRefund.colTriggeredTime')" prop="triggeredTime" width="170" />
        <el-table-column :label="t('gzRefund.colRefundedTime')" width="170">
          <template #default="{ row }">{{ row.refundedTime || '-' }}</template>
        </el-table-column>
        <template #empty>{{ t('gzRefund.empty') }}</template>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:limit="query.pageSize"
        v-model:page="query.pageNum"
        :total="total"
        @pagination="loadList"
      />
    </el-card>

    <!-- 退款申请弹窗（订单看板落地后由其调用 dialogRef.open(...)；本页仅占位引用，保证组件已就绪） -->
    <refund-apply-dialog ref="dialogRef" @success="handleQuery" />
  </div>
</template>

<script setup lang="ts" name="GzPayRefund">
import { ref, reactive, getCurrentInstance, type ComponentInternalInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import RefundApplyDialog from './RefundApplyDialog.vue';
import { listRefund, type GzPayRefundVO, type GzPayRefundQuery } from '@/api/gz-pay/refund';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const STATUS_OPTIONS = ['refunding', 'refunded', 'failed'];

const loading = ref(false);
const list = ref<GzPayRefundVO[]>([]);
const total = ref(0);
const query = reactive<GzPayRefundQuery>({
  pageNum: 1,
  pageSize: 10,
  outTradeNo: undefined,
  status: undefined
});

const dialogRef = ref<InstanceType<typeof RefundApplyDialog>>();

type TagType = 'warning' | 'success' | 'danger' | 'info';

function statusTagType(status: string): TagType {
  switch (status) {
    case 'refunded':
      return 'success';
    case 'refunding':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'info';
  }
}

async function loadList() {
  loading.value = true;
  try {
    const res = await listRefund(query);
    list.value = res.data ?? [];
    total.value = (res as any).total || 0;
  } catch (e) {
    (proxy as any)?.$modal?.msgError?.(t('gzRefund.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  query.pageNum = 1;
  loadList();
}

function resetQuery() {
  query.outTradeNo = undefined;
  query.status = undefined;
  handleQuery();
}

loadList();
</script>

<style scoped>
.ticket-tag {
  font-size: 12px;
  color: #909399;
}
</style>
