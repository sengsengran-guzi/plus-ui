<template>
  <div class="p-2">
    <el-tabs v-model="activeTab" type="border-card" class="seat-management-tabs" @tab-change="onTabChange">
      <el-tab-pane :label="t('gzBeanSeatManagement.tabSeatTypeConfig')" name="seatTypeConfig">
        <!-- 懒加载：首次切到该 tab 才挂载；挂载后 keep-alive 保状态 -->
        <keep-alive>
          <SeatTypeConfig v-if="loaded.seatTypeConfig" />
        </keep-alive>
      </el-tab-pane>

      <el-tab-pane :label="t('gzBeanSeatManagement.tabSeat')" name="seat">
        <keep-alive>
          <Seat v-if="loaded.seat" />
        </keep-alive>
      </el-tab-pane>

      <el-tab-pane :label="t('gzBeanSeatManagement.tabSlotAvailability')" name="slotAvailability">
        <keep-alive>
          <SlotAvailability v-if="loaded.slotAvailability" />
        </keep-alive>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import SeatTypeConfig from '@/views/gz-bean/seat-type-config/index.vue';
import Seat from '@/views/gz-bean/seat/index.vue';
import SlotAvailability from '@/views/gz-bean/slot-availability/index.vue';

const { t } = useI18n();

type TabName = 'seatTypeConfig' | 'seat' | 'slotAvailability';

const activeTab = ref<TabName>('seatTypeConfig');

// 懒加载标志：首次进入某 tab 才挂载对应组件；配合 keep-alive 缓存已挂载子页的内部状态。
const loaded = reactive<Record<TabName, boolean>>({
  seatTypeConfig: true,
  seat: false,
  slotAvailability: false
});

const onTabChange = (name: string | number) => {
  const tab = name as TabName;
  loaded[tab] = true;
};
</script>

<style scoped>
.seat-management-tabs {
  border: none;
}
</style>
