<template>
  <div v-loading="loading" class="order-detail">
    <template v-if="detail">
      <el-descriptions :title="t('gzOrdOrder.secOrder')" :column="1" border>
        <el-descriptions-item :label="t('gzOrdOrder.colOrderNo')">{{ detail.orderNo }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrder.colStatus')">
          <el-tag :type="statusTagType(detail.businessStatus)" size="small">{{ detail.businessStatusLabel }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrder.colLogistics')">
          <el-tag type="info" size="small">{{ detail.logisticsStatusLabel }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrder.colCreateTime')">{{ detail.createTime || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrder.colPaidTime')">{{ detail.paidTime || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrder.colDeliveredTime')">{{ detail.deliveredTime || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrder.colCancelledTime')">{{ detail.cancelledTime || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrder.colNote')">{{ detail.userNote || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-descriptions :title="t('gzOrdOrder.secGoods')" :column="1" border class="mt-3">
        <el-descriptions-item :label="t('gzOrdOrder.colProduct')">{{ detail.productName }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrder.colSpec')">{{ detail.specName }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrder.colQty')">× {{ detail.qty }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrder.colAmount')">¥{{ (detail.totalAmountCent / 100).toFixed(2) }}</el-descriptions-item>
      </el-descriptions>

      <el-descriptions :title="t('gzOrdOrder.secUser')" :column="1" border class="mt-3">
        <el-descriptions-item :label="t('gzOrdOrder.colNickname')">{{ detail.userNickname || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrder.colPhone')">{{ detail.userPhone || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-descriptions :title="t('gzOrdOrder.secAddress')" :column="1" border class="mt-3">
        <el-descriptions-item :label="t('gzOrdOrder.colRecipient')">{{ detail.recipient || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrder.colRecipientMobile')">{{ detail.recipientMobile || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrder.colFullAddress')">{{ detail.fullAddress || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-descriptions
        v-if="detail.logisticsStatus === 'in_china_dispatching'"
        :title="t('gzOrdOrder.secLogistics')"
        :column="1"
        border
        class="mt-3"
      >
        <el-descriptions-item :label="t('gzOrdOrder.colCarrier')">{{ detail.cnCarrierName || detail.cnCarrierCode || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrder.colTracking')">{{ detail.cnTrackingNo || '-' }}</el-descriptions-item>
      </el-descriptions>
    </template>
    <el-empty v-else-if="!loading" :description="t('gzOrdOrder.loadFailed')" />
  </div>
</template>

<script setup lang="ts" name="GzOrdOrderDetail">
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { getGzOrdOrder, type GzOrdOrderVO } from '@/api/gz-ord/order';

const props = defineProps<{ orderId: string }>();
const { t } = useI18n();

const loading = ref(false);
const detail = ref<GzOrdOrderVO | null>(null);

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

async function load(id: string) {
  if (!id) return;
  loading.value = true;
  detail.value = null;
  try {
    const resp = await getGzOrdOrder(id);
    detail.value = (resp as any).data || null;
  } catch (e) {
    console.error('[gz-ord-order] detail load failed', e);
    ElMessage.error(t('gzOrdOrder.loadFailed'));
  } finally {
    loading.value = false;
  }
}

watch(() => props.orderId, (id) => load(id), { immediate: true });
</script>
