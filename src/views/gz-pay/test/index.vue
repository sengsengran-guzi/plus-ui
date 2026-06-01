<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzPay.testTitle') }}</span>
          <span class="ticket-tag">GZ-PAY-001</span>
        </div>
      </template>

      <el-alert :title="t('gzPay.testTip')" type="warning" :closable="false" class="mb-3" show-icon />

      <el-form :model="form" label-width="140px" style="max-width: 560px">
        <el-form-item :label="t('gzPay.testAmount')">
          <el-input-number v-model="form.amountCent" :min="1" :max="100" />
        </el-form-item>
        <el-form-item :label="t('gzPay.testOpenid')">
          <el-input v-model="form.openid" placeholder="mock_openid_admin_test" clearable style="width: 320px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleCreate">{{ t('gzPay.testCreate') }}</el-button>
          <el-button type="success" :disabled="!result" :loading="simulating" @click="handleSimulate">
            {{ t('gzPay.testSimulate') }}
          </el-button>
        </el-form-item>
      </el-form>

      <el-divider v-if="result">{{ t('gzPay.testResult') }}</el-divider>
      <el-descriptions v-if="result" :column="1" border style="max-width: 720px">
        <el-descriptions-item label="out_trade_no">{{ result.outTradeNo }}</el-descriptions-item>
        <el-descriptions-item label="timeStamp">{{ result.timeStamp }}</el-descriptions-item>
        <el-descriptions-item label="nonceStr">{{ result.nonceStr }}</el-descriptions-item>
        <el-descriptions-item label="package">{{ result.packageVal }}</el-descriptions-item>
        <el-descriptions-item label="signType">{{ result.signType }}</el-descriptions-item>
        <el-descriptions-item label="paySign">
          <span class="mono">{{ result.paySign }}</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="GzPayTest">
import { ref, reactive, getCurrentInstance, type ComponentInternalInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import { createTestOrder, simulateCallback, type MpPayParamsVO } from '@/api/gz-pay';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const loading = ref(false);
const simulating = ref(false);
const result = ref<MpPayParamsVO | null>(null);
const form = reactive<{ amountCent: number; openid?: string }>({ amountCent: 1, openid: '' });

async function handleCreate() {
  loading.value = true;
  try {
    const res = await createTestOrder({ amountCent: form.amountCent, openid: form.openid || undefined });
    result.value = res.data;
    (proxy as any)?.$modal?.msgSuccess?.(t('gzPay.testCreated', { no: res.data.outTradeNo }));
  } catch (e) {
    (proxy as any)?.$modal?.msgError?.(t('gzPay.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function handleSimulate() {
  if (!result.value) return;
  simulating.value = true;
  try {
    await simulateCallback(result.value.outTradeNo);
    (proxy as any)?.$modal?.msgSuccess?.(t('gzPay.testSimulated'));
  } catch (e) {
    (proxy as any)?.$modal?.msgError?.(t('gzPay.loadFailed'));
  } finally {
    simulating.value = false;
  }
}
</script>

<style scoped>
.ticket-tag {
  font-size: 12px;
  color: #909399;
}
.mono {
  font-family: monospace;
  word-break: break-all;
}
</style>
