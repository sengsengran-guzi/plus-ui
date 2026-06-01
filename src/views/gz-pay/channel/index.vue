<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzPay.channelTitle') }}</span>
          <span class="ticket-tag">GZ-PAY-001</span>
        </div>
      </template>

      <el-alert :title="t('gzPay.channelReadonly')" type="info" :closable="false" class="mb-3" show-icon />

      <el-table :data="list" border>
        <el-table-column :label="t('gzPay.colChannelCode')" prop="channelCode" width="160" />
        <el-table-column :label="t('gzPay.colDisplayName')" prop="displayName" width="140" />
        <el-table-column :label="t('gzPay.colAppid')" prop="appid" width="180" show-overflow-tooltip />
        <el-table-column :label="t('gzPay.colMchId')" prop="mchId" width="140" />
        <el-table-column :label="t('gzPay.colCertSerial')" prop="mchCertSerial" min-width="180" show-overflow-tooltip />
        <el-table-column :label="t('gzPay.colNotifyUrl')" prop="notifyUrl" min-width="200" show-overflow-tooltip />
        <el-table-column :label="t('gzPay.colEnabled')" prop="enabled" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled === 1 ? 'success' : 'info'">{{ row.enabled === 1 ? 'ON' : 'OFF' }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="GzPayChannel">
import { ref, getCurrentInstance, onMounted, type ComponentInternalInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import { listPayChannel, type GzPayChannelVO } from '@/api/gz-pay';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const loading = ref(false);
const list = ref<GzPayChannelVO[]>([]);

async function loadList() {
  loading.value = true;
  try {
    const res = await listPayChannel();
    list.value = res.data ?? [];
  } catch (e) {
    (proxy as any)?.$modal?.msgError?.(t('gzPay.loadFailed'));
  } finally {
    loading.value = false;
  }
}

onMounted(loadList);
</script>

<style scoped>
.ticket-tag {
  font-size: 12px;
  color: #909399;
}
</style>
