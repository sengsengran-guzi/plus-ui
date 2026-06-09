<template>
  <div v-loading="loading" class="order-detail">
    <template v-if="vo">
      <!-- 统一段 -->
      <el-divider content-position="left">{{ t('gzOrdOrders.secOrder') }}</el-divider>
      <el-descriptions :column="1" border size="small">
        <el-descriptions-item :label="t('gzOrdOrders.colOrderNo')">{{ vo.businessOrderNo || vo.outTradeNo }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrders.colBizType')">
          <el-tag :type="bizTagType(vo.businessType)" size="small">{{ vo.businessTypeLabel }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrders.colAmount')">
          <span style="color: var(--el-color-danger); font-weight: 600">¥{{ (vo.amountCent / 100).toFixed(2) }}</span>
        </el-descriptions-item>
        <el-descriptions-item v-if="vo.chipLabel" :label="t('gzOrdOrders.colStatus')">
          <el-tag :type="chipTagType(vo.chipStatus)" size="small">{{ vo.chipLabel }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrders.colPayStatus')">{{ vo.payStatus }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrders.colPaidTime')">{{ vo.paidTime || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzOrdOrders.colCreateTime')">{{ vo.createdAt || '-' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 下单用户（test 单无用户） -->
      <template v-if="vo.userId">
        <el-divider content-position="left">{{ t('gzOrdOrders.secUser') }}</el-divider>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item :label="t('gzOrdOrders.colNickname')">{{ vo.userNickname || '-' }}</el-descriptions-item>
          <el-descriptions-item label="openid">{{ vo.openid || '-' }}</el-descriptions-item>
        </el-descriptions>
      </template>

      <!-- 预购差异块 -->
      <template v-if="vo.businessType === 'preorder'">
        <el-divider content-position="left">{{ t('gzOrdOrders.secGoods') }}</el-divider>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item :label="t('gzOrdOrders.colProduct')">{{ vo.productName || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzOrdOrders.colSpec')">{{ vo.specName || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzOrdOrders.colQty')">{{ vo.qty ?? '-' }}</el-descriptions-item>
          <el-descriptions-item v-if="vo.ipTag" label="IP">{{ vo.ipTag }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzOrdOrders.colDelivery')">{{ vo.deliveryDateExact || vo.deliveryDateText || '-' }}</el-descriptions-item>
        </el-descriptions>
      </template>

      <!-- 扭蛋差异块（盲盒语义：获得物 / 出现概率，禁抽奖/中奖/开奖） -->
      <template v-else-if="vo.businessType === 'gacha'">
        <el-divider content-position="left">{{ t('gzOrdOrders.secGacha') }}</el-divider>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item :label="t('gzOrdOrders.colPrize')">{{ vo.prizeName || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzOrdOrders.colRarity')">
            <el-tag v-if="vo.rarity" :type="rarityTagType(vo.rarity)" size="small">{{ vo.rarity }}</el-tag>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzOrdOrders.colMachine')">{{ vo.machineName || '-' }}</el-descriptions-item>
        </el-descriptions>
      </template>

      <!-- 收货地址（预购必有；扭蛋可空 → 用户未补地址；test 单无地址块） -->
      <template v-if="vo.businessType !== 'test'">
        <el-divider content-position="left">{{ t('gzOrdOrders.secAddress') }}</el-divider>
        <el-descriptions v-if="vo.recipient || vo.fullAddress" :column="1" border size="small">
          <el-descriptions-item :label="t('gzOrdOrders.colRecipient')">{{ vo.recipient || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzOrdOrders.colRecipientMobile')">{{ vo.recipientMobile || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzOrdOrders.colFullAddress')">{{ vo.fullAddress || '-' }}</el-descriptions-item>
        </el-descriptions>
        <el-empty v-else :description="t('gzOrdOrders.addressNotProvided')" :image-size="60" />
      </template>

      <!-- 物流卡（C1 三态只读，不画 7 节点时间线） -->
      <template v-if="vo.businessType !== 'test'">
        <el-divider content-position="left">{{ t('gzOrdOrders.secLogistics') }}</el-divider>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item :label="t('gzOrdOrders.colLogistics')">
            <el-tag type="info" size="small">{{ vo.logisticsStatusLabel || '-' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="vo.logisticsStatus === 'in_china_dispatching'" :label="t('gzOrdOrders.colCarrier')">
            {{ vo.cnCarrierName || '-' }}
          </el-descriptions-item>
          <el-descriptions-item v-if="vo.logisticsStatus === 'in_china_dispatching'" :label="t('gzOrdOrders.colTracking')">
            {{ vo.cnTrackingNo || '-' }}
          </el-descriptions-item>
          <el-descriptions-item v-if="vo.deliveredTime" :label="t('gzOrdOrders.colDeliveredTime')">{{ vo.deliveredTime }}</el-descriptions-item>
        </el-descriptions>
      </template>

      <!-- 底部操作：申请退款（owner 权限 + 仅 paid 可退）+ 推进物流占位（跳 D11 ADMIN-104） -->
      <div class="detail-actions">
        <el-tooltip :disabled="canRefund" :content="refundDisabledTip" placement="top">
          <span>
            <el-button v-hasPermi="['gz:pay:refund:apply']" type="danger" :disabled="!canRefund" @click="handleRefund">
              {{ t('gzOrdOrders.refundApply') }}
            </el-button>
          </span>
        </el-tooltip>
        <el-button v-if="vo.businessType !== 'test'" @click="handleGotoLogistics">{{ t('gzOrdOrders.gotoLogistics') }}</el-button>
      </div>

      <RefundConfirmDialog
        v-if="vo"
        ref="refundDialogRef"
        :transaction-id="vo.transactionId"
        :order-no="vo.businessOrderNo || vo.outTradeNo"
        :amount-cent="vo.amountCent"
        @refunded="onRefunded"
      />
    </template>
  </div>
</template>

<script setup lang="ts" name="OrderDetailDrawer">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { getUnifiedOrder, type GzUnifiedOrderVO } from '@/api/gz-ord/orders';
import RefundConfirmDialog from './RefundConfirmDialog.vue';

const { t } = useI18n();
const router = useRouter();

const props = defineProps<{ transactionId: string }>();
const emit = defineEmits<{ (e: 'refunded'): void }>();

const loading = ref(false);
const vo = ref<GzUnifiedOrderVO | null>(null);
const refundDialogRef = ref<InstanceType<typeof RefundConfirmDialog>>();

// 仅 paid 态可申请退款（已退款 / 未支付 / test 单不可）
const canRefund = computed(() => vo.value?.payStatus === 'paid');
const refundDisabledTip = computed(() => {
  if (!vo.value) return '';
  if (vo.value.payStatus === 'refunded' || vo.value.payStatus === 'refunding') return t('gzOrdOrders.refundAlready');
  return t('gzOrdOrders.refundOnlyPaid');
});

async function load() {
  if (!props.transactionId) return;
  loading.value = true;
  try {
    const resp = await getUnifiedOrder(props.transactionId);
    vo.value = (resp as any).data ?? (resp as any);
  } catch (e) {
    console.error('[gz-ord-orders] load detail failed', e);
    ElMessage.error(t('gzOrdOrders.loadFailed'));
  } finally {
    loading.value = false;
  }
}

watch(() => props.transactionId, load, { immediate: true });

function handleRefund() {
  refundDialogRef.value?.open();
}
function onRefunded() {
  load();
  emit('refunded');
}
function handleGotoLogistics() {
  // 推进物流占位：跳 D11 GZ-ADMIN-104 物流推进（本 ticket 不实现写入）
  router.push({ path: '/gz-ord-logistics', query: { orderNo: vo.value?.businessOrderNo || '' } }).catch(() => {
    ElMessage.info(t('gzOrdOrders.logisticsComingSoon'));
  });
}

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
function rarityTagType(r: string): 'danger' | 'warning' | 'success' | 'info' {
  const map: Record<string, 'danger' | 'warning' | 'success' | 'info'> = { SSR: 'danger', SR: 'warning', R: 'success', N: 'info' };
  return map[r] || 'info';
}
</script>

<style scoped>
.order-detail {
  padding: 0 4px;
}
.detail-actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
</style>
