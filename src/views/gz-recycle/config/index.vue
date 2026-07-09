<template>
  <div class="p-2">
    <el-tabs v-model="activeTab" type="border-card" class="recycle-config-tabs" @tab-change="onTabChange">
      <el-tab-pane :label="t('gzRecycleConfig.tabQtyRange')" name="qtyRange">
        <!-- 懒加载：首次切到该 tab 才挂载；挂载后 keep-alive 保状态（仿拼豆座位管理） -->
        <keep-alive>
          <QtyRange v-if="loaded.qtyRange" />
        </keep-alive>
      </el-tab-pane>

      <el-tab-pane :label="t('gzRecycleConfig.tabTimeSlot')" name="timeSlot">
        <keep-alive>
          <TimeSlot v-if="loaded.timeSlot" />
        </keep-alive>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import QtyRange from '@/views/gz-recycle/qty-range/index.vue';
import TimeSlot from '@/views/gz-recycle/time-slot/index.vue';

const { t } = useI18n();

type TabName = 'qtyRange' | 'timeSlot';

const activeTab = ref<TabName>('qtyRange');

// 懒加载标志：首次进入某 tab 才挂载对应组件；配合 keep-alive 缓存已挂载子页的内部状态。
const loaded = reactive<Record<TabName, boolean>>({
  qtyRange: true,
  timeSlot: false
});

const onTabChange = (name: string | number) => {
  const tab = name as TabName;
  loaded[tab] = true;
};
</script>

<style scoped>
.recycle-config-tabs {
  border: none;
}
</style>
