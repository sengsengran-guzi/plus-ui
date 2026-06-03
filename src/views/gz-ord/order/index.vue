<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzOrdOrder.title') }}</span>
          <span class="ticket-tag">GZ-ORD-105</span>
        </div>
      </template>

      <el-alert :title="t('gzOrdOrder.alertTitle')" type="info" :description="t('gzOrdOrder.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 查询表单 -->
      <el-form :model="query" inline @submit.prevent="handleQuery">
        <el-form-item :label="t('gzOrdOrder.colOrderNo')">
          <el-input v-model="query.orderNo" :placeholder="t('gzOrdOrder.orderNoPlaceholder')" clearable style="width: 220px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item :label="t('gzOrdOrder.colPhone')">
          <el-input v-model="query.userPhone" :placeholder="t('gzOrdOrder.phonePlaceholder')" clearable style="width: 180px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item :label="t('gzOrdOrder.colStatus')">
          <el-select v-model="query.businessStatus" :placeholder="t('gzOrdOrder.statusPlaceholder')" clearable style="width: 160px">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleQuery">{{ t('gzOrdOrder.search') }}</el-button>
          <el-button :icon="Refresh" @click="handleReset">{{ t('gzOrdOrder.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 列表 -->
      <el-table :data="rows" border>
        <el-table-column :label="t('gzOrdOrder.colOrderNo')" prop="orderNo" min-width="190" show-overflow-tooltip />
        <el-table-column :label="t('gzOrdOrder.colProduct')" prop="productName" min-width="160" show-overflow-tooltip />
        <el-table-column :label="t('gzOrdOrder.colSpec')" prop="specName" width="120" show-overflow-tooltip />
        <el-table-column :label="t('gzOrdOrder.colQty')" prop="qty" width="70" align="center" />
        <el-table-column :label="t('gzOrdOrder.colAmount')" width="110" align="right">
          <template #default="{ row }">¥{{ (row.totalAmountCent / 100).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzOrdOrder.colStatus')" prop="businessStatus" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.businessStatus)" size="small">{{ row.businessStatusLabel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzOrdOrder.colLogistics')" prop="logisticsStatus" width="110" align="center">
          <template #default="{ row }">
            <el-tag type="info" size="small">{{ row.logisticsStatusLabel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzOrdOrder.colPhone')" prop="userPhone" width="130" align="center">
          <template #default="{ row }">{{ row.userPhone || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzOrdOrder.colCreateTime')" prop="createTime" width="170" align="center" />
        <el-table-column :label="t('gzOrdOrder.colAction')" fixed="right" width="100" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:ord:order:query']" type="primary" link size="small" @click="handleView(row)">{{ t('gzOrdOrder.view') }}</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('gzOrdOrder.empty')" /></template>
      </el-table>

      <pagination v-show="total > 0" v-model:limit="query.pageSize" v-model:page="query.pageNum" :total="total" @pagination="loadList" />
    </el-card>

    <!-- 只读详情抽屉 -->
    <el-drawer v-model="detailVisible" :title="t('gzOrdOrder.detailTitle')" size="560px">
      <OrderDetail v-if="detailId" :order-id="detailId" />
    </el-drawer>
  </div>
</template>

<script setup lang="ts" name="GzOrdOrder">
import { ref, reactive, computed } from 'vue';
import { Search, Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import OrderDetail from './detail.vue';
import { listGzOrdOrder, type GzOrdOrderVO, type GzOrdOrderQuery } from '@/api/gz-ord/order';

const { t } = useI18n();

const loading = ref(false);
const rows = ref<GzOrdOrderVO[]>([]);
const total = ref(0);
const query = reactive<GzOrdOrderQuery>({ pageNum: 1, pageSize: 10 });

const detailVisible = ref(false);
const detailId = ref<string>('');

// 业务态选项（doc/11 附录 A.5；delivered = 终态无 closed）
const statusOptions = computed(() => [
  { value: 'created', label: t('gzOrdOrder.stCreated') },
  { value: 'paid', label: t('gzOrdOrder.stPaid') },
  { value: 'in_logistics', label: t('gzOrdOrder.stInLogistics') },
  { value: 'delivered', label: t('gzOrdOrder.stDelivered') },
  { value: 'cancelled', label: t('gzOrdOrder.stCancelled') },
  { value: 'refunded', label: t('gzOrdOrder.stRefunded') }
]);
function statusTagType(s: string): 'success' | 'info' | 'warning' | 'danger' | 'primary' {
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'primary'> = {
    created: 'warning',
    paid: 'primary',
    in_logistics: 'primary',
    delivered: 'success',
    cancelled: 'info',
    refunded: 'danger'
  };
  return map[s] || 'info';
}

async function loadList() {
  loading.value = true;
  try {
    const resp = await listGzOrdOrder(query);
    rows.value = (resp as any).rows || [];
    total.value = (resp as any).total || 0;
  } catch (e) {
    console.error('[gz-ord-order] load failed', e);
    ElMessage.error(t('gzOrdOrder.loadFailed'));
  } finally {
    loading.value = false;
  }
}
function handleQuery() {
  query.pageNum = 1;
  loadList();
}
function handleReset() {
  query.orderNo = undefined;
  query.userPhone = undefined;
  query.businessStatus = undefined;
  query.pageNum = 1;
  loadList();
}
function handleView(row: GzOrdOrderVO) {
  detailId.value = row.id;
  detailVisible.value = true;
}

loadList();
</script>
