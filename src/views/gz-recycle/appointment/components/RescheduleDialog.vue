<template>
  <el-dialog v-model="visible" :title="t('gzRecycleAppointment.rescheduleDialogTitle')" width="460px" append-to-body @closed="onClosed">
    <el-descriptions :column="1" border size="small" class="mb-3">
      <el-descriptions-item :label="t('gzRecycleAppointment.rescheduleCurrentNo')">{{ current.appointmentNo }}</el-descriptions-item>
      <el-descriptions-item v-if="current.storeName" :label="t('gzRecycleAppointment.rescheduleCurrentStore')">
        {{ current.storeName }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('gzRecycleAppointment.rescheduleCurrentDate')">{{ current.apptDate }}</el-descriptions-item>
      <el-descriptions-item :label="t('gzRecycleAppointment.rescheduleCurrentSlot')">{{ current.slotLabel }}</el-descriptions-item>
    </el-descriptions>

    <el-form label-width="92px">
      <el-form-item :label="t('gzRecycleAppointment.rescheduleNewDate')" required>
        <!-- 顾客单不可改到过去（后端 4130 兜底）：过去日期会被 no_show 扫描判过期，顾客的有效预约静默作废。
             手动占用是店员台账，允许挪到过去（后端同样放行）。 -->
        <el-date-picker v-model="form.apptDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" :disabled-date="disabledDate" />
      </el-form-item>
      <el-form-item :label="t('gzRecycleAppointment.rescheduleNewSlot')" required>
        <el-select v-model="form.timeSlotId" :placeholder="t('gzRecycleAppointment.rescheduleNewSlotPlaceholder')" style="width: 100%">
          <el-option v-for="s in slotOptions" :key="s.id" :label="s.label" :value="s.id" />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">{{ t('gzRecycleAppointment.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleConfirm">{{ t('gzRecycleAppointment.rescheduleConfirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts" name="RescheduleDialog">
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { rescheduleAppointment, type RecycleBoardSlotVO } from '@/api/gz-recycle/appointment';

const { t } = useI18n();

const emit = defineEmits<{ (e: 'success'): void; (e: 'fail'): void }>();

const visible = ref(false);
const submitting = ref(false);
const appointmentId = ref('');
const slotOptions = ref<RecycleBoardSlotVO[]>([]);
/** 是否允许选过去日期（手动占用 = true 店员台账；顾客单 = false，后端 4130 兜底） */
const allowPastDate = ref(false);

const current = reactive<{ appointmentNo: string; storeName?: string; apptDate: string; slotLabel: string }>({
  appointmentNo: '',
  storeName: '',
  apptDate: '',
  slotLabel: ''
});

const form = reactive<{ apptDate: string | undefined; timeSlotId: string | undefined }>({
  apptDate: undefined,
  timeSlotId: undefined
});

function open(payload: {
  id: string;
  appointmentNo: string;
  storeName?: string;
  apptDate: string;
  slotLabel: string;
  slotOptions: RecycleBoardSlotVO[];
  allowPastDate?: boolean;
}) {
  appointmentId.value = payload.id;
  allowPastDate.value = payload.allowPastDate === true;
  current.appointmentNo = payload.appointmentNo;
  current.storeName = payload.storeName;
  current.apptDate = payload.apptDate;
  current.slotLabel = payload.slotLabel;
  slotOptions.value = payload.slotOptions;
  form.apptDate = undefined;
  form.timeSlotId = undefined;
  visible.value = true;
}

function onClosed() {
  form.apptDate = undefined;
  form.timeSlotId = undefined;
}

/** 顾客单禁选今天之前的日期（手动占用不限） */
function disabledDate(date: Date): boolean {
  if (allowPastDate.value) return false;
  const today = new Date();
  return date.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
}

async function handleConfirm() {
  // 组件级重入闸：不把防重复提交全押在全局拦截器 + 后端锁上
  if (submitting.value) return;
  if (!form.apptDate) {
    ElMessage.warning(t('gzRecycleAppointment.rescheduleNeedDate'));
    return;
  }
  if (!form.timeSlotId) {
    ElMessage.warning(t('gzRecycleAppointment.rescheduleNeedSlot'));
    return;
  }
  submitting.value = true;
  try {
    await rescheduleAppointment(appointmentId.value, { apptDate: form.apptDate, timeSlotId: form.timeSlotId });
    ElMessage.success(t('gzRecycleAppointment.rescheduleOk'));
    visible.value = false;
    emit('success');
  } catch {
    // 目标格已被占（4122/4123）/ 时段无效（4124）/ 状态不可改期（4128/4129）/ 改到过去（4130）：后端 msg 已由
    // 全局拦截器 toast，弹窗保持打开允许改选（不吞错、不关窗、不刷成功态，AC10）。
    // 通知父组件刷新看板 —— 失败常见根因就是「格 / 单已被并发改动」，看板必须回真相态。
    emit('fail');
  } finally {
    submitting.value = false;
  }
}

defineExpose({ open });
</script>
