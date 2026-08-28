<template>
  <el-dialog v-model="visible" :title="t('gzRecycleAppointment.holdDialogTitle')" width="480px" append-to-body @closed="onClosed">
    <div class="hold-selected">
      <div class="hold-selected__label">
        {{ t('gzRecycleAppointment.holdSelectedList') }}（{{ t('gzRecycleAppointment.selectedCountRuns', { n: cells.length, m: runs.length }) }}）
      </div>
      <!-- 显示合并后的**段**：4 个连续格 → 一个 tag「08-30 · 09:00-13:00」，而不是 4 个 tag。
           跨午休 gap 天然不合并（判定 prev.end === cur.start），店员确认成本骤降。 -->
      <div class="hold-selected__list">
        <el-tag v-for="r in runs" :key="`${r.apptDate}|${r.start}`" class="hold-selected__tag" size="small">
          {{ r.apptDate }} · {{ hhmm(r.start) }}-{{ hhmm(r.end) }}
        </el-tag>
      </div>
    </div>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="76px" class="mt-3">
      <el-form-item :label="t('gzRecycleAppointment.holdRemark')" prop="remark">
        <el-input
          v-model="form.remark"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          :placeholder="t('gzRecycleAppointment.holdRemarkPlaceholder')"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">{{ t('gzRecycleAppointment.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleConfirm">{{ t('gzRecycleAppointment.holdConfirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts" name="ManualHoldDialog">
import { ref, reactive } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { manualHoldSlots } from '@/api/gz-recycle/appointment';

const { t } = useI18n();

/** 已选小时格（跨日期，同一门店内；ADR-0021 §1 + ADR-0022 小时格） */
interface SelectedCell {
  apptDate: string;
  /** 格起点 "HH:mm:ss" */
  slotStart: string;
  slotLabel: string;
}

/** 相邻格合并成的连续段（由父组件 WeekBoard 算好传进来） */
interface SelectedRun {
  apptDate: string;
  start: string;
  end: string;
  count: number;
}

const emit = defineEmits<{ (e: 'success'): void; (e: 'fail'): void }>();

const visible = ref(false);
const submitting = ref(false);
const formRef = ref<FormInstance>();
const storeId = ref<string | number>('');
const cells = ref<SelectedCell[]>([]);
const runs = ref<SelectedRun[]>([]);
const form = reactive<{ remark: string }>({ remark: '' });

const rules: FormRules = {
  remark: [
    {
      required: true,
      // 空 / 纯空格必须被前端拦住且不发请求（AC6）
      validator: (_rule, value: string, callback) => {
        if (!value || !value.trim()) {
          callback(new Error(t('gzRecycleAppointment.holdRemarkRequired')));
          return;
        }
        callback();
      },
      trigger: 'blur'
    }
  ]
};

function open(payload: { storeId: string | number; cells: SelectedCell[]; runs: SelectedRun[] }) {
  storeId.value = payload.storeId;
  cells.value = payload.cells;
  runs.value = payload.runs;
  form.remark = '';
  visible.value = true;
}

/** "HH:mm:ss" → "HH:mm" */
function hhmm(t9: string): string {
  return (t9 || '').slice(0, 5);
}

function onClosed() {
  formRef.value?.clearValidate();
}

/**
 * 跨日期按日期分组多次请求（同日多格一次请求带全部 slotStarts），任一失败即停并提示（AC6）。
 *
 * 组件级重入闸（`if (submitting.value) return` + 进函数即置位）：不依赖全局 axios 防重复提交拦截器 /
 * 后端 Redis 锁做唯一防线 —— 校验是异步的，置位若放在 await 之后，按钮 disabled 翻转前的窗口内可连点两次。
 */
async function handleConfirm() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const valid = await formRef.value?.validate().catch(() => false);
    if (!valid) return;
    if (cells.value.length === 0) {
      ElMessage.warning(t('gzRecycleAppointment.holdEmptySelection'));
      return;
    }
    const groups = new Map<string, string[]>();
    for (const c of cells.value) {
      const arr = groups.get(c.apptDate) ?? [];
      arr.push(c.slotStart);
      groups.set(c.apptDate, arr);
    }
    try {
      for (const [apptDate, slotStarts] of groups) {
        await manualHoldSlots({ storeId: storeId.value, apptDate, slotStarts, remark: form.remark.trim() });
      }
      ElMessage.success(t('gzRecycleAppointment.holdOk'));
      visible.value = false;
      emit('success');
    } catch {
      // 任一失败即停：4122/4123/4124 等均为业务预期拒绝，后端 msg 已由全局 request 拦截器 toast。
      // 弹窗保持打开允许重试（不吞错、不关窗）；不打 console.error —— 业务拒绝不是前端异常（AC15 console 0 error）。
      // 通知父组件刷新看板：失败多半意味着格已被他人占走，看板须回到真相态（否则店员对着过期视图继续操作）。
      emit('fail');
    }
  } finally {
    submitting.value = false;
  }
}

defineExpose({ open });
</script>

<style scoped>
.hold-selected__label {
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}
.hold-selected__list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 140px;
  overflow-y: auto;
}
.hold-selected__tag {
  margin: 0;
}
</style>
