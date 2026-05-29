<template>
  <el-select
    v-model="currentStoreId"
    :placeholder="t('storeSelector.placeholder')"
    :disabled="storeOptions.length <= 1"
    size="default"
    class="store-selector"
  >
    <el-option v-for="opt in storeOptions" :key="opt.id" :label="opt.name" :value="opt.id" />
  </el-select>
</template>

<script setup lang="ts">
/**
 * GZ-ADMIN-004 后台 topbar 门店切换器
 *
 * V1.0 单门店：硬编码占位（i18n 字符串「成都拼豆店」），disabled。
 * V1.1（含 D04 BEAN-001 完工后）：从 /gz/bean/store/list 拉门店选项，切换时
 *   广播到全局 store（pinia gzStoreStore，本 ticket 不建，留给 BEAN-001）。
 *
 * 任务卡 AC 3 + R1：BEAN-001 完工前空数据 → V1.0 接受硬编码占位。
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

interface StoreOption {
  id: number;
  name: string;
}

const { t } = useI18n();

// V1.0 单门店硬编码 — BEAN-001 完工后改为 const { data } = await listStoreOptions() 异步加载。
const storeOptions = computed<StoreOption[]>(() => [{ id: 1, name: t('storeSelector.defaultStore') }]);

// 默认选中第一家（V1.0 单门店）
const currentStoreId = ref<number>(1);
</script>

<style lang="scss" scoped>
.store-selector {
  width: 160px;
  margin-right: 8px;

  :deep(.el-select__wrapper) {
    height: 32px;
  }
}
</style>
