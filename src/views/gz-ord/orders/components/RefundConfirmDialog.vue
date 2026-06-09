<template>
  <el-dialog v-model="visible" :title="t('gzOrdOrders.refundTitle')" width="440px" append-to-body @closed="onClosed">
    <el-alert :title="t('gzOrdOrders.refundFullOnly')" type="warning" :closable="false" show-icon class="mb-3" />
    <el-descriptions :column="1" border size="small">
      <el-descriptions-item :label="t('gzOrdOrders.colOrderNo')">{{ orderNo }}</el-descriptions-item>
      <el-descriptions-item :label="t('gzOrdOrders.refundAmount')">
        <span style="color: var(--el-color-danger); font-weight: 600">¥{{ amountYuan }}（{{ t('gzOrdOrders.refundFull') }}）</span>
      </el-descriptions-item>
    </el-descriptions>
    <el-form :model="form" class="mt-3">
      <el-form-item :label="t('gzOrdOrders.refundReason')">
        <el-input v-model="form.reason" type="textarea" :rows="3" maxlength="255" show-word-limit :placeholder="t('gzOrdOrders.refundReasonPlaceholder')" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">{{ t('gzOrdOrders.cancel') }}</el-button>
      <el-button type="danger" :loading="submitting" @click="handleConfirm">{{ t('gzOrdOrders.refundConfirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts" name="RefundConfirmDialog">
import { ref, reactive, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { applyRefund } from '@/api/gz-pay/refund';

const { t } = useI18n();

const props = defineProps<{
  /** 支付交易行 id（= gz_pay_transaction.id，退款按此 id 调 PAY-103） */
  transactionId: string;
  /** 订单号（展示） */
  orderNo: string;
  /** 订单金额（分） */
  amountCent: number;
}>();

const emit = defineEmits<{ (e: 'refunded'): void }>();

const visible = ref(false);
const submitting = ref(false);
const form = reactive<{ reason: string }>({ reason: '' });

const amountYuan = computed(() => (props.amountCent / 100).toFixed(2));

function open() {
  form.reason = '';
  visible.value = true;
}
function onClosed() {
  form.reason = '';
}

async function handleConfirm() {
  if (!form.reason.trim()) {
    ElMessage.warning(t('gzOrdOrders.refundReasonRequired'));
    return;
  }
  try {
    await ElMessageBox.confirm(t('gzOrdOrders.refundDoubleConfirm', { amount: amountYuan.value }), t('gzOrdOrders.refundTitle'), {
      type: 'warning',
      confirmButtonText: t('gzOrdOrders.refundConfirm'),
      cancelButtonText: t('gzOrdOrders.cancel')
    });
  } catch {
    return; // 用户取消二次确认
  }
  submitting.value = true;
  try {
    await applyRefund({ transactionId: props.transactionId, reason: form.reason.trim() });
    ElMessage.success(t('gzOrdOrders.refundSuccess'));
    visible.value = false;
    emit('refunded');
  } catch (e) {
    console.error('[gz-ord-orders] refund apply failed', e);
    // 错误提示由 request 拦截器统一弹出，这里不重复
  } finally {
    submitting.value = false;
  }
}

defineExpose({ open });
</script>
