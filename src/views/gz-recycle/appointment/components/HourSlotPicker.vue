<template>
  <div v-loading="loading" class="hour-picker">
    <div v-if="slots.length === 0" class="hour-picker__empty">{{ t('gzRecycleAppointment.hourPickerEmpty') }}</div>
    <div v-else class="hour-picker__grid">
      <el-tooltip v-for="s in slots" :key="s.startTime" :content="reasonOf(s)" :disabled="s.selectable" placement="top">
        <div
          class="hour-picker__cell"
          :class="{ 'is-on': modelValue === s.startTime, 'is-disabled': !s.selectable }"
          :data-slot-start="s.startTime"
          @click="s.selectable && emit('update:modelValue', s.startTime)"
        >
          {{ s.label }}
        </div>
      </el-tooltip>
    </div>
    <div v-if="modelValue && spanHours > 0" class="hour-picker__hint">
      {{ t('gzRecycleAppointment.rescheduleCoverHint', { range: coverRange }) }}
    </div>
  </div>
</template>

<script setup lang="ts" name="HourSlotPicker">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { getHourSlots, type RecycleHourSlotVO } from '@/api/gz-recycle/appointment';

const { t } = useI18n();

const props = defineProps<{
  modelValue: string;
  storeId: string | number | undefined;
  /** 目标日期 yyyy-MM-dd */
  date: string;
  /** 本单占用小时数（顾客单 ceil(matched/60)，手动占用 = 原区间宽度） */
  spanHours: number;
  /**
   * 排除的单 id（改期场景传自身）—— **必传**，否则被改期的单会跟自己的原区间冲突，
   * 相邻起点永远选不了。
   */
  excludeAppointmentId?: string;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const loading = ref(false);
const slots = ref<RecycleHourSlotVO[]>([]);

/** 选中起点后覆盖到的区间文案 "11:00 - 15:00" */
const coverRange = computed(() => {
  if (!props.modelValue) return '';
  const h = Number(props.modelValue.slice(0, 2));
  const end = String(h + props.spanHours).padStart(2, '0');
  return `${props.modelValue.slice(0, 5)} - ${end}:00`;
});

/** 不可选原因：三种情况对店员的含义完全不同，不区分会让人困惑「为什么这个点不能选」 */
function reasonOf(s: RecycleHourSlotVO): string {
  if (s.taken) return t('gzRecycleAppointment.hourPickerTaken');
  if (s.past) return t('gzRecycleAppointment.hourPickerPast');
  return t('gzRecycleAppointment.hourPickerSpanBlocked', { n: props.spanHours });
}

async function load() {
  if (!props.storeId || !props.date) {
    slots.value = [];
    return;
  }
  loading.value = true;
  try {
    const res = await getHourSlots(props.storeId, props.date, props.spanHours, props.excludeAppointmentId);
    slots.value = res.data?.slots ?? [];
    // 拉回后自愈：原选中格若已不可选（他人抢占 / 换了日期）→ 清空，避免提交必然失败的起点
    if (props.modelValue && !slots.value.some((s) => s.startTime === props.modelValue && s.selectable)) {
      emit('update:modelValue', '');
    }
  } catch {
    slots.value = [];
  } finally {
    loading.value = false;
  }
}

watch(() => [props.storeId, props.date, props.spanHours, props.excludeAppointmentId], load, { immediate: true });

defineExpose({ reload: load });
</script>

<style scoped>
.hour-picker__grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}
.hour-picker__cell {
  padding: 6px 0;
  text-align: center;
  font-size: 13px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
}
.hour-picker__cell:hover:not(.is-disabled) {
  border-color: #409eff;
}
.hour-picker__cell.is-on {
  border-color: #409eff;
  background: #ecf5ff;
  color: #409eff;
  font-weight: 600;
}
.hour-picker__cell.is-disabled {
  color: #c0c4cc;
  background: #f5f7fa;
  cursor: not-allowed;
}
.hour-picker__empty,
.hour-picker__hint {
  color: #909399;
  font-size: 12px;
}
.hour-picker__hint {
  margin-top: 8px;
  color: #67c23a;
}
</style>
