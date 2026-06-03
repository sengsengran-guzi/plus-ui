<template>
  <el-dialog v-model="visible" :title="t('gzRefund.applyTitle')" width="480px" @closed="onClosed">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
      <el-form-item :label="t('gzRefund.applyOrderNo')">
        <span>{{ outTradeNo || '-' }}</span>
      </el-form-item>
      <!-- 全额退款金额只读：= 原单 amount_cent / 100，无金额 input（仅全额，doc/10 §6.E5） -->
      <el-form-item :label="t('gzRefund.applyAmount')">
        <span class="refund-amount">¥{{ (amountCent / 100).toFixed(2) }}</span>
        <span class="refund-amount-hint">{{ t('gzRefund.applyAmountHint') }}</span>
      </el-form-item>
      <el-form-item :label="t('gzRefund.reason')" prop="reason">
        <el-input
          v-model="form.reason"
          type="textarea"
          :rows="3"
          maxlength="255"
          show-word-limit
          :placeholder="t('gzRefund.reasonPlaceholder')"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">{{ t('gzRefund.cancel') }}</el-button>
      <el-button v-hasPermi="['gz:pay:refund:apply']" type="primary" :loading="submitting" @click="submit">
        {{ t('gzRefund.confirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts" name="RefundApplyDialog">
import { ref, reactive, getCurrentInstance, type ComponentInternalInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import type { FormInstance, FormRules } from 'element-plus';
import { applyRefund } from '@/api/gz-pay/refund';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const emit = defineEmits<{ (e: 'success'): void }>();

const visible = ref(false);
const submitting = ref(false);
const formRef = ref<FormInstance>();

/** 当前退款的原交易行主键 id（string，防精度丢失） */
const transactionId = ref<string>('');
/** 原订单号（只读展示） */
const outTradeNo = ref<string>('');
/** 原单金额（分），全额退款 = 此值 */
const amountCent = ref<number>(0);

const form = reactive<{ reason: string }>({ reason: '' });

const rules: FormRules = {
  reason: [
    { required: true, message: t('gzRefund.reasonRequired'), trigger: 'blur' },
    { max: 255, message: t('gzRefund.reasonMax'), trigger: 'blur' }
  ]
};

/** 外部调用打开弹窗：传原交易行 id + 订单号 + 金额（分） */
function open(txId: string, orderNo: string, amount: number) {
  transactionId.value = txId;
  outTradeNo.value = orderNo;
  amountCent.value = amount;
  form.reason = '';
  visible.value = true;
}

function onClosed() {
  formRef.value?.resetFields();
}

async function submit() {
  if (!formRef.value) {
    return;
  }
  await formRef.value.validate();
  submitting.value = true;
  try {
    await applyRefund({ transactionId: transactionId.value, reason: form.reason });
    (proxy as any)?.$modal?.msgSuccess?.(t('gzRefund.submitOk'));
    visible.value = false;
    emit('success');
  } catch (e) {
    // request 拦截器已弹错；此处兜底不静默吞
  } finally {
    submitting.value = false;
  }
}

defineExpose({ open });
</script>

<style scoped>
.refund-amount {
  font-size: 18px;
  font-weight: 600;
  color: #f56c6c;
}
.refund-amount-hint {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
