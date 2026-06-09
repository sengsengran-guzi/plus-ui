<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzOrdOrders.title') }}</span>
          <span class="ticket-tag">GZ-ADMIN-103</span>
        </div>
      </template>

      <el-alert :title="t('gzOrdOrders.alertTitle')" type="info" :description="t('gzOrdOrders.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 业务类型 tab（全部 / 扭蛋 / 测试单）
           GZ-ORD-110 预购下线：隐藏 preorder 业务类型筛选项（仅去入口，不删能力/数据）；
           preorder 历史订单仍可经「全部」聚合查询（数据保留原则）。
           恢复 = 反向加回 <el-radio-button label="preorder"> 一行。 -->
      <el-radio-group v-model="query.businessType" class="mb-3" @change="handleQuery">
        <el-radio-button label="">{{ t('gzOrdOrders.tabAll') }}</el-radio-button>
        <el-radio-button label="gacha">{{ t('gzOrdOrders.tabGacha') }}</el-radio-button>
        <el-radio-button label="test">{{ t('gzOrdOrders.tabTest') }}</el-radio-button>
      </el-radio-group>

      <!-- 查询表单 -->
      <el-form :model="query" inline @submit.prevent="handleQuery">
        <el-form-item :label="t('gzOrdOrders.colOrderNo')">
          <el-input v-model="query.orderNo" :placeholder="t('gzOrdOrders.orderNoPlaceholder')" clearable style="width: 200px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item :label="t('gzOrdOrders.colUser')">
          <el-input v-model="query.userKeyword" :placeholder="t('gzOrdOrders.userKeywordPlaceholder')" clearable style="width: 180px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item :label="t('gzOrdOrders.colStatus')">
          <el-select v-model="query.businessStatus" :placeholder="t('gzOrdOrders.statusPlaceholder')" clearable style="width: 130px">
            <el-option v-for="s in chipOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzOrdOrders.colLogistics')">
          <el-select v-model="query.logisticsStatus" :placeholder="t('gzOrdOrders.logisticsPlaceholder')" clearable style="width: 130px">
            <el-option v-for="s in logisticsOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzOrdOrders.colCreateTime')">
          <el-date-picker
            v-model="timeRange"
            type="datetimerange"
            value-format="YYYY-MM-DD HH:mm:ss"
            :start-placeholder="t('gzOrdOrders.timeStart')"
            :end-placeholder="t('gzOrdOrders.timeEnd')"
            style="width: 340px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleQuery">{{ t('gzOrdOrders.search') }}</el-button>
          <el-button :icon="Refresh" @click="handleReset">{{ t('gzOrdOrders.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 列表 -->
      <el-table :data="rows" border>
        <el-table-column :label="t('gzOrdOrders.colOrderNo')" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.businessOrderNo || row.outTradeNo }}</template>
        </el-table-column>
        <el-table-column :label="t('gzOrdOrders.colBizType')" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="bizTagType(row.businessType)" size="small">{{ row.businessTypeLabel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzOrdOrders.colUser')" width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.userId">{{ row.userNickname || '-' }}<br /><span class="openid-sub">{{ shortOpenid(row.openid) }}</span></span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzOrdOrders.colGoods')" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="goods-cell">
              <el-image v-if="goodsImage(row)" :src="goodsImage(row)" fit="cover" class="goods-thumb" />
              <div class="goods-meta">
                <div>{{ goodsName(row) || '-' }}</div>
                <div class="goods-spec">{{ goodsSpec(row) }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzOrdOrders.colAmount')" width="100" align="right">
          <template #default="{ row }">¥{{ (row.amountCent / 100).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzOrdOrders.colStatus')" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.chipLabel" :type="chipTagType(row.chipStatus)" size="small">{{ row.chipLabel }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzOrdOrders.colLogistics')" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.logisticsStatusLabel" type="info" size="small">{{ row.logisticsStatusLabel }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzOrdOrders.colCreateTime')" prop="createdAt" width="160" align="center" />
        <el-table-column :label="t('gzOrdOrders.colAction')" fixed="right" width="90" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:ord:orders:query']" type="primary" link size="small" @click="handleView(row)">{{ t('gzOrdOrders.view') }}</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('gzOrdOrders.empty')" /></template>
      </el-table>

      <pagination v-show="total > 0" v-model:limit="query.pageSize" v-model:page="query.pageNum" :total="total" @pagination="loadList" />
    </el-card>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" :title="t('gzOrdOrders.detailTitle')" size="600px">
      <OrderDetailDrawer v-if="detailTxnId" :transaction-id="detailTxnId" @refunded="loadList" />
    </el-drawer>
  </div>
</template>

<script setup lang="ts" name="GzOrdOrders">
import { ref, reactive, computed, watch } from 'vue';
import { Search, Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import OrderDetailDrawer from './components/OrderDetailDrawer.vue';
import { listUnifiedOrder, type GzUnifiedOrderVO, type GzUnifiedOrderQuery } from '@/api/gz-ord/orders';

const { t } = useI18n();

const loading = ref(false);
const rows = ref<GzUnifiedOrderVO[]>([]);
const total = ref(0);
const query = reactive<GzUnifiedOrderQuery>({ pageNum: 1, pageSize: 10, businessType: '' });
const timeRange = ref<[string, string] | null>(null);

const detailVisible = ref(false);
const detailTxnId = ref<string>('');

// 业务状态统一 chip 选项（doc/11 §8.2）
const chipOptions = computed(() => [
  { value: 'to_pay', label: t('gzOrdOrders.chipToPay') },
  { value: 'to_ship', label: t('gzOrdOrders.chipToShip') },
  { value: 'shipping', label: t('gzOrdOrders.chipShipping') },
  { value: 'done', label: t('gzOrdOrders.chipDone') },
  { value: 'cancelled', label: t('gzOrdOrders.chipCancelled') },
  { value: 'refunded', label: t('gzOrdOrders.chipRefunded') }
]);
// 物流三态（附录 A.7）
const logisticsOptions = computed(() => [
  { value: 'in_japan', label: t('gzOrdOrders.logiInJapan') },
  { value: 'in_china_dispatching', label: t('gzOrdOrders.logiInChina') },
  { value: 'delivered', label: t('gzOrdOrders.logiDelivered') }
]);

watch(timeRange, (v) => {
  query.startTime = v ? v[0] : undefined;
  query.endTime = v ? v[1] : undefined;
});

function bizTagType(b: string): 'primary' | 'success' | 'info' {
  return b === 'preorder' ? 'primary' : b === 'gacha' ? 'success' : 'info';
}
function chipTagType(c?: string | null): 'success' | 'info' | 'warning' | 'danger' | 'primary' {
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'primary'> = {
    to_pay: 'warning',
    to_ship: 'primary',
    shipping: 'primary',
    done: 'success',
    cancelled: 'info',
    refunded: 'danger'
  };
  return (c && map[c]) || 'info';
}
function shortOpenid(o?: string | null): string {
  if (!o) return '';
  return o.length > 12 ? `${o.slice(0, 6)}…${o.slice(-4)}` : o;
}
// 商品 snapshot：preorder 取 product，gacha 取 prize（差异块统一渲染）
function goodsName(row: GzUnifiedOrderVO): string | null | undefined {
  return row.businessType === 'gacha' ? row.prizeName : row.productName;
}
function goodsImage(row: GzUnifiedOrderVO): string | null | undefined {
  return row.businessType === 'gacha' ? row.prizeImageUrl : row.productImageUrl;
}
function goodsSpec(row: GzUnifiedOrderVO): string {
  if (row.businessType === 'gacha') return row.rarity || '';
  return row.specName || '';
}

async function loadList() {
  loading.value = true;
  try {
    const resp = await listUnifiedOrder(query);
    rows.value = (resp as any).rows || [];
    total.value = (resp as any).total || 0;
  } catch (e) {
    console.error('[gz-ord-orders] load failed', e);
    ElMessage.error(t('gzOrdOrders.loadFailed'));
  } finally {
    loading.value = false;
  }
}
function handleQuery() {
  query.pageNum = 1;
  loadList();
}
function handleReset() {
  query.businessType = '';
  query.businessStatus = undefined;
  query.logisticsStatus = undefined;
  query.userKeyword = undefined;
  query.orderNo = undefined;
  query.startTime = undefined;
  query.endTime = undefined;
  timeRange.value = null;
  query.pageNum = 1;
  loadList();
}
function handleView(row: GzUnifiedOrderVO) {
  detailTxnId.value = row.transactionId;
  detailVisible.value = true;
}

loadList();
</script>

<style scoped>
.openid-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.goods-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.goods-thumb {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  flex-shrink: 0;
}
.goods-meta {
  min-width: 0;
}
.goods-spec {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
