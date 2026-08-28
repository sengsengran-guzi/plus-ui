<template>
  <div class="p-2">
    <el-card v-loading="pageLoading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzRecycleTimeSlot.title') }}</span>
          <span class="ticket-tag">GZ-RECYCLE-006</span>
        </div>
      </template>

      <!-- 两条 alert 的结构 / 措辞与拼豆「营业时段配置」一致（Kevin 2026-08-26 命名对齐） -->
      <el-alert
        :title="t('gzRecycleTimeSlot.alertTitle')"
        type="info"
        :description="t('gzRecycleTimeSlot.alertDesc')"
        show-icon
        :closable="false"
        class="mb-3"
      />

      <el-alert
        :title="t('gzRecycleTimeSlot.windowAlertTitle')"
        type="warning"
        :description="t('gzRecycleTimeSlot.windowAlertDesc')"
        show-icon
        :closable="false"
        class="mb-3"
      />

      <!-- 查询条（门店必选：先选门店看其时段） -->
      <el-form inline class="mb-2">
        <el-form-item :label="t('gzRecycleTimeSlot.colStore')">
          <el-select v-model="query.storeId" :placeholder="t('gzRecycleTimeSlot.storePlaceholder')" style="width: 200px" @change="onStoreChange">
            <el-option v-for="s in storeOptions" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzRecycleTimeSlot.colEnabled')">
          <el-select v-model="query.enabled" :placeholder="t('gzRecycleTimeSlot.enabledPlaceholder')" clearable style="width: 120px">
            <el-option :label="t('gzRecycleTimeSlot.enabledOn')" :value="1" />
            <el-option :label="t('gzRecycleTimeSlot.enabledOff')" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadList">{{ t('gzRecycleTimeSlot.search') }}</el-button>
          <el-button :icon="Refresh" @click="resetQuery">{{ t('gzRecycleTimeSlot.reset') }}</el-button>
          <el-button v-hasPermi="['gz:recycle:timeSlot:add']" type="success" plain :icon="Plus" :disabled="!query.storeId" @click="handleAdd">
            {{ t('gzRecycleTimeSlot.slotAdd') }}
          </el-button>
          <el-button v-hasPermi="['gz:recycle:timeSlot:add']" type="warning" plain :icon="Calendar" :disabled="!query.storeId" @click="openBatch">
            {{ t('gzRecycleTimeSlot.slotBatchByWeek') }}
          </el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="listLoading" :data="list" border stripe size="small">
        <el-table-column :label="t('gzRecycleTimeSlot.colStore')" prop="storeName" min-width="120" show-overflow-tooltip />
        <!-- 列序 / 命名与拼豆「营业时段配置」对齐（Kevin 2026-08-26）：店员在两个页面间切换时扫读位置一致 -->
        <el-table-column :label="t('gzRecycleTimeSlot.colSlotName')" prop="label" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.label || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzRecycleTimeSlot.colStartTime')" width="100" align="center">
          <template #default="{ row }">{{ hhmm(row.startTime) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzRecycleTimeSlot.colEndTime')" width="100" align="center">
          <template #default="{ row }">{{ hhmm(row.endTime) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzRecycleTimeSlot.colWeekdays')" min-width="170">
          <template #default="{ row }">
            <el-tag v-if="isAllWeek(row.weekdays)" size="small" type="success" effect="plain">
              {{ t('gzRecycleTimeSlot.allWeek') }}
            </el-tag>
            <el-tag v-for="d in weekdayList(row.weekdays)" v-else :key="d" size="small" class="mr-1">
              {{ weekdayLabel(d) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzRecycleTimeSlot.colEffective')" min-width="180" align="center">
          <template #default="{ row }">
            <span class="form-hint">
              {{ row.effectiveDate || t('gzRecycleTimeSlot.effectiveNow') }} ~ {{ row.expireDate || t('gzRecycleTimeSlot.expireForever') }}
            </span>
          </template>
        </el-table-column>
        <!-- 小时格：回收特有（拼豆无），放在生效区间之后不打乱前面的共同列序 -->
        <el-table-column :label="t('gzRecycleTimeSlot.colHourCells')" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info" effect="plain">
              {{ t('gzRecycleTimeSlot.hourCellsN', { n: sliceWindowToHourCells(row.startTime, row.endTime).length }) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzRecycleTimeSlot.colEnabled')" prop="enabled" width="100" align="center">
          <template #default="{ row }">
            <el-switch
              v-hasPermi="['gz:recycle:timeSlot:edit']"
              :model-value="row.enabled === 1"
              :active-value="true"
              :inactive-value="false"
              @change="handleToggle(row)"
            />
          </template>
        </el-table-column>
        <el-table-column :label="t('gzRecycleTimeSlot.colSortNo')" prop="sortNo" width="80" align="center" />
        <el-table-column :label="t('gzRecycleTimeSlot.colRemark')" prop="remark" min-width="140" show-overflow-tooltip />
        <el-table-column :label="t('gzRecycleTimeSlot.colAction')" fixed="right" width="200" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:recycle:timeSlot:edit']" type="success" link size="small" @click="handleEdit(row)">{{
              t('gzRecycleTimeSlot.edit')
            }}</el-button>
            <el-button v-hasPermi="['gz:recycle:timeSlot:remove']" type="danger" link size="small" @click="handleDel(row)">{{
              t('gzRecycleTimeSlot.del')
            }}</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="query.storeId ? t('gzRecycleTimeSlot.empty') : t('gzRecycleTimeSlot.emptyNoStore')" /></template>
      </el-table>

      <pagination v-show="total > 0" v-model:page="query.pageNum" v-model:limit="query.pageSize" :total="total" @pagination="loadList" />
    </el-card>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="formTitle" width="480px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item :label="t('gzRecycleTimeSlot.fieldStore')" prop="storeId">
          <el-select v-model="form.storeId" :disabled="!!form.id" :placeholder="t('gzRecycleTimeSlot.storePlaceholder')" style="width: 100%">
            <el-option v-for="s in storeOptions" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzRecycleTimeSlot.colStartTime')" prop="startTime">
          <el-time-picker
            v-model="form.startTime"
            format="HH:00"
            value-format="HH:mm:ss"
            :clearable="false"
            :disabled-minutes="disabledNonZero"
            :disabled-seconds="disabledNonZero"
            :placeholder="t('gzRecycleTimeSlot.startTimePlaceholder')"
            style="width: 160px"
          />
        </el-form-item>
        <el-form-item :label="t('gzRecycleTimeSlot.colEndTime')" prop="endTime">
          <el-time-picker
            v-model="form.endTime"
            format="HH:00"
            value-format="HH:mm:ss"
            :clearable="false"
            :disabled-minutes="disabledNonZero"
            :disabled-seconds="disabledNonZero"
            :placeholder="t('gzRecycleTimeSlot.endTimePlaceholder')"
            style="width: 160px"
          />
          <!-- 切格预览：让甲方一眼确认配置对不对（残格不生成，配 10:00-13:30 会静默丢半小时） -->
          <span v-if="slicePreview.length > 0" class="form-hint">
            {{ t('gzRecycleTimeSlot.sliceHint', { n: slicePreview.length, cells: slicePreview.join(' / ') }) }}
          </span>
        </el-form-item>
        <!-- 生效星期（GZ-RECYCLE-015 对齐拼豆）：让「周末与平时营业时间不同」可配 -->
        <el-form-item :label="t('gzRecycleTimeSlot.colWeekdays')" prop="weekdayArr">
          <el-checkbox-group v-model="form.weekdayArr">
            <el-checkbox v-for="d in WEEKDAYS" :key="d" :value="d">{{ weekdayLabel(String(d)) }}</el-checkbox>
          </el-checkbox-group>
          <span class="form-hint">{{ t('gzRecycleTimeSlot.weekdaysHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzRecycleTimeSlot.colEffective')">
          <el-date-picker
            v-model="form.effectiveDate"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 150px"
            :placeholder="t('gzRecycleTimeSlot.effectiveNow')"
          />
          <span class="mx-1">~</span>
          <el-date-picker
            v-model="form.expireDate"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 150px"
            :placeholder="t('gzRecycleTimeSlot.expireForever')"
          />
          <span class="form-hint">{{ t('gzRecycleTimeSlot.effectiveRangeHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzRecycleTimeSlot.colSlotName')">
          <el-input v-model="form.label" maxlength="64" show-word-limit :placeholder="t('gzRecycleTimeSlot.slotNamePlaceholder')" />
          <span class="form-hint">{{ t('gzRecycleTimeSlot.labelHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzRecycleTimeSlot.fieldSortNo')">
          <el-input-number v-model="form.sortNo" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item :label="t('gzRecycleTimeSlot.fieldEnabled')">
          <el-switch v-model="form.enabled" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item :label="t('gzRecycleTimeSlot.fieldRemark')">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('gzRecycleTimeSlot.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('gzRecycleTimeSlot.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 按周批量配置弹窗（GZ-RECYCLE-015 对齐拼豆）：一次给多个星期配多段营业窗口 -->
    <el-dialog v-model="batchVisible" :title="t('gzRecycleTimeSlot.slotBatchTitle')" width="620px">
      <el-alert type="info" :closable="false" show-icon class="mb-3" :description="t('gzRecycleTimeSlot.batchHint')" />
      <el-form ref="batchRef" :model="batchForm" :rules="batchRules" label-width="110px">
        <el-form-item :label="t('gzRecycleTimeSlot.colWeekdays')" prop="weekdayArr">
          <el-checkbox-group v-model="batchForm.weekdayArr">
            <el-checkbox v-for="d in WEEKDAYS" :key="d" :value="d">{{ weekdayLabel(String(d)) }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item :label="t('gzRecycleTimeSlot.colEffective')">
          <el-date-picker
            v-model="batchForm.effectiveDate"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 150px"
            :placeholder="t('gzRecycleTimeSlot.effectiveNow')"
          />
          <span class="mx-1">~</span>
          <el-date-picker
            v-model="batchForm.expireDate"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 150px"
            :placeholder="t('gzRecycleTimeSlot.expireForever')"
          />
        </el-form-item>
        <el-form-item :label="t('gzRecycleTimeSlot.batchSlotList')">
          <div v-for="(w, idx) in batchForm.windows" :key="idx" class="batch-row">
            <el-input v-model="w.label" maxlength="32" :placeholder="t('gzRecycleTimeSlot.slotNamePlaceholder')" style="width: 130px" />
            <el-time-picker
              v-model="w.startTime"
              format="HH:00"
              value-format="HH:mm:ss"
              :clearable="false"
              :disabled-minutes="disabledNonZero"
              :disabled-seconds="disabledNonZero"
              style="width: 130px"
            />
            <span class="mx-1">~</span>
            <el-time-picker
              v-model="w.endTime"
              format="HH:00"
              value-format="HH:mm:ss"
              :clearable="false"
              :disabled-minutes="disabledNonZero"
              :disabled-seconds="disabledNonZero"
              style="width: 130px"
            />
            <span class="form-hint mx-1">{{ t('gzRecycleTimeSlot.hourCellsN', { n: sliceWindowToHourCells(w.startTime, w.endTime).length }) }}</span>
            <el-button type="danger" link :icon="Delete" :disabled="batchForm.windows.length <= 1" @click="removeBatchWindow(idx)" />
          </div>
          <el-button type="primary" link :icon="Plus" @click="addBatchWindow">{{ t('gzRecycleTimeSlot.batchAddSlot') }}</el-button>
        </el-form-item>
      </el-form>
      <div class="batch-preview">
        {{ t('gzRecycleTimeSlot.batchPreviewHint', { n: batchPlan.create }) }}
        <span v-if="batchPlan.covered > 0" class="batch-preview__covered">
          {{ t('gzRecycleTimeSlot.batchCoveredHint', { n: batchPlan.covered }) }}
        </span>
      </div>
      <template #footer>
        <el-button @click="batchVisible = false">{{ t('gzRecycleTimeSlot.cancel') }}</el-button>
        <el-button type="primary" :loading="batchSubmitting" @click="handleBatchSubmit">{{ t('gzRecycleTimeSlot.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzRecycleTimeSlot">
import { ref, reactive, computed, onMounted } from 'vue';
import { Calendar, Delete, Plus, Refresh, Search } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { useI18n } from 'vue-i18n';
import {
  listGzRecycleTimeSlot,
  getGzRecycleTimeSlot,
  addGzRecycleTimeSlot,
  updateGzRecycleTimeSlot,
  delGzRecycleTimeSlot,
  toggleGzRecycleTimeSlot,
  type GzRecycleTimeSlotVO,
  type GzRecycleTimeSlotQuery
} from '@/api/gz-recycle/timeSlot';
import { getGzBeanStoreOptions, type GzBeanStoreVO } from '@/api/gz-bean/store';
import { disabledNonZero, validateWindow, sliceWindowToHourCells } from '@/utils/hour-slot';

const { t } = useI18n();

const pageLoading = ref(false);
const listLoading = ref(false);
const submitting = ref(false);

const storeOptions = ref<GzBeanStoreVO[]>([]);
const list = ref<GzRecycleTimeSlotVO[]>([]);
const total = ref(0);
const query = reactive<GzRecycleTimeSlotQuery>({ storeId: null, enabled: null, pageNum: 1, pageSize: 10 });

/** "HH:mm:ss" → "HH:mm"（表格展示去秒）。 */
function hhmm(t1?: string | null): string {
  return t1 ? t1.slice(0, 5) : '';
}

interface TimeSlotFormState {
  id: string | null;
  storeId: number | string | null;
  label: string | null;
  startTime: string | null;
  endTime: string | null;
  /** 生效星期（ISO 1-7）；提交时 join 成 "1,2,3" —— GZ-RECYCLE-015 */
  weekdayArr: number[];
  effectiveDate: string | null;
  expireDate: string | null;
  sortNo: number | null;
  enabled: number;
  remark: string | null;
}

/** ISO 星期 1=周一 .. 7=周日（与后端 weekdays 列同口径） */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const ALL_WEEK = '1,2,3,4,5,6,7';

function weekdayLabel(d: string): string {
  return t(`gzRecycleTimeSlot.weekday${d}`);
}
function weekdayList(weekdays?: string | null): string[] {
  return weekdays ? weekdays.split(',').filter(Boolean).sort() : [];
}
/** 全周 → 列表里显示一个「每天」tag 而不是铺 7 个（默认值占满一行会把表格挤爆） */
function isAllWeek(weekdays?: string | null): boolean {
  return weekdayList(weekdays).join(',') === ALL_WEEK;
}
const formRef = ref<FormInstance>();
const formVisible = ref(false);
const formTitle = ref('');
const form = reactive<TimeSlotFormState>(emptyForm());

/** 「本窗口将切出 N 个小时格」预览（与后端 sliceWindowsToHourCells 同口径） */
const slicePreview = computed(() => sliceWindowToHourCells(form.startTime, form.endTime));

function emptyForm(): TimeSlotFormState {
  return {
    id: null,
    storeId: query.storeId ?? null,
    label: null,
    startTime: '10:00:00',
    endTime: '22:00:00',
    weekdayArr: [...WEEKDAYS],
    effectiveDate: null,
    expireDate: null,
    sortNo: 0,
    enabled: 1,
    remark: null
  };
}

const rules: FormRules = {
  storeId: [{ required: true, message: t('gzRecycleTimeSlot.ruleStore'), trigger: 'change' }],
  startTime: [{ required: true, message: t('gzRecycleTimeSlot.ruleStartTimeRequired'), trigger: 'change' }],
  endTime: [{ required: true, message: t('gzRecycleTimeSlot.ruleEndTimeRequired'), trigger: 'change' }],
  weekdayArr: [
    {
      required: true,
      validator: (_r, v: number[], cb) => (v && v.length ? cb() : cb(new Error(t('gzRecycleTimeSlot.ruleWeekdayRequired')))),
      trigger: 'change'
    }
  ]
};

/* ================ 按周批量配置（GZ-RECYCLE-015 对齐拼豆） ================ */

interface BatchWindow {
  label: string;
  startTime: string;
  endTime: string;
}
const batchVisible = ref(false);
const batchSubmitting = ref(false);
const batchRef = ref<FormInstance>();
const batchForm = reactive<{
  weekdayArr: number[];
  effectiveDate: string | null;
  expireDate: string | null;
  windows: BatchWindow[];
}>({
  weekdayArr: [...WEEKDAYS],
  effectiveDate: null,
  expireDate: null,
  windows: [{ label: '营业时间', startTime: '10:00:00', endTime: '22:00:00' }]
});
const batchRules: FormRules = {
  weekdayArr: [
    {
      required: true,
      validator: (_r, v: number[], cb) => (v && v.length ? cb() : cb(new Error(t('gzRecycleTimeSlot.ruleWeekdayRequired')))),
      trigger: 'change'
    }
  ]
};

/**
 * 该「星期 + 起止」是否已被现有启用行覆盖（kevin-qa 2026-08-26 对抗测试逮到的坑）。
 *
 * 弹窗承诺「已存在的『星期 + 时段』组合会自动跳过」，但后端判重口径是**起止 + 星期字符串完全相同**
 * （ADR-0022 §2 的既定设计）—— `weekdays="1"` 与 `weekdays="1,2,3,4,5,6,7"` 被认为不同。
 * 于是「门店已配好全周 10-22 → 第一次点开弹窗（默认全选 7 天）→ 确定」会凭空造出 7 条冗余行。
 *
 * 冗余本身不算错（切格走 TreeSet 去重，不会算错格），**真正的伤害在下游**：店员之后单独编辑
 * 「周一」那条想临时改营业时间，不会意识到那条全周行仍覆盖着周一 → 改了不生效 → 当成 bug 报上来。
 *
 * 修法是**前端不发这些必然冗余的请求**（后端判重口径不动，ADR 无需改）。想把全周拆成 7 条单天管理的
 * 用户，正确路径是先删掉全周那条再批量 —— 那也正是避开上述陷阱的唯一姿势。
 */
function isCoveredByExisting(day: number, startTime: string, endTime: string): boolean {
  return list.value.some(
    (r) => r.enabled === 1 && r.startTime === startTime && r.endTime === endTime && weekdayList(r.weekdays).includes(String(day))
  );
}

/** 本次批量真正会创建的条数（已被覆盖的不算） */
const batchPlan = computed(() => {
  let create = 0;
  let covered = 0;
  for (const day of batchForm.weekdayArr) {
    for (const w of batchForm.windows) {
      if (isCoveredByExisting(day, w.startTime, w.endTime)) covered++;
      else create++;
    }
  }
  return { create, covered };
});

function openBatch() {
  Object.assign(batchForm, {
    weekdayArr: [...WEEKDAYS],
    effectiveDate: null,
    expireDate: null,
    windows: [{ label: '营业时间', startTime: '10:00:00', endTime: '22:00:00' }]
  });
  batchVisible.value = true;
}
function addBatchWindow() {
  batchForm.windows.push({ label: '', startTime: '10:00:00', endTime: '22:00:00' });
}
function removeBatchWindow(idx: number) {
  batchForm.windows.splice(idx, 1);
}

/**
 * 批量提交：**每个星期 × 每个窗口 建一行**（而不是一行 weekdays="1,2,3"）。
 *
 * 一行多星期更省行数，但店员改「只有周六延后打烊」时得先把那行拆开 —— 拆行是最容易出错的操作。
 * 一星期一行后，改哪天就编辑哪行，符合店员的心智。
 *
 * 逐行提交、单行失败不中断（多半是「该星期该窗口已存在」的判重拒绝，属正常重入），
 * 最后汇总成功 / 跳过数。
 */
async function handleBatchSubmit() {
  if (batchSubmitting.value) return;
  const valid = await batchRef.value?.validate().catch(() => false);
  if (!valid) return;
  for (const w of batchForm.windows) {
    const err = validateWindow(w.startTime, w.endTime, {
      notWholeHour: t('gzRecycleTimeSlot.ruleWindowNotWholeHour'),
      startBeforeEnd: t('gzRecycleTimeSlot.ruleWindowStartBeforeEnd')
    });
    if (err) {
      ElMessage.warning(err);
      return;
    }
  }
  batchSubmitting.value = true;
  let created = 0;
  let skipped = 0;
  try {
    for (const day of [...batchForm.weekdayArr].sort((a, b) => a - b)) {
      for (const w of batchForm.windows) {
        // 已被现有启用行覆盖 → 不发这个必然冗余的请求（见 isCoveredByExisting 的注释）
        if (isCoveredByExisting(day, w.startTime, w.endTime)) {
          skipped++;
          continue;
        }
        try {
          await addGzRecycleTimeSlot({
            storeId: query.storeId,
            label: w.label?.trim() || undefined,
            startTime: w.startTime,
            endTime: w.endTime,
            weekdays: String(day),
            effectiveDate: batchForm.effectiveDate,
            expireDate: batchForm.expireDate,
            enabled: 1,
            sortNo: 0
          });
          created++;
        } catch {
          // 判重拒绝（该星期该窗口已存在）是正常重入，不打断整批；后端 msg 已由全局拦截器 toast
          skipped++;
        }
      }
    }
    ElMessage.success(t('gzRecycleTimeSlot.batchInsertedHint', { created, skipped }));
    batchVisible.value = false;
    await loadList();
  } finally {
    batchSubmitting.value = false;
  }
}

async function loadStores() {
  const res = await getGzBeanStoreOptions();
  storeOptions.value = res.data ?? [];
  if (!query.storeId && storeOptions.value.length) {
    query.storeId = storeOptions.value[0].id;
  }
}

async function loadList() {
  if (!query.storeId) {
    list.value = [];
    total.value = 0;
    return;
  }
  listLoading.value = true;
  try {
    const res = await listGzRecycleTimeSlot(query);
    list.value = res.rows;
    total.value = res.total;
  } finally {
    listLoading.value = false;
  }
}

function onStoreChange() {
  query.pageNum = 1;
  loadList();
}

function resetQuery() {
  query.enabled = null;
  query.pageNum = 1;
  if (storeOptions.value.length) {
    query.storeId = storeOptions.value[0].id;
  }
  loadList();
}

function handleAdd() {
  Object.assign(form, emptyForm());
  formTitle.value = t('gzRecycleTimeSlot.slotAddTitle');
  formVisible.value = true;
}

async function handleEdit(row: GzRecycleTimeSlotVO) {
  const { data } = await getGzRecycleTimeSlot(row.id);
  Object.assign(form, {
    id: data.id,
    storeId: Number(data.storeId),
    label: data.label ?? null,
    startTime: data.startTime,
    endTime: data.endTime,
    weekdayArr: weekdayList(data.weekdays).map(Number),
    effectiveDate: data.effectiveDate ?? null,
    expireDate: data.expireDate ?? null,
    sortNo: data.sortNo,
    enabled: data.enabled,
    remark: data.remark ?? null
  });
  formTitle.value = t('gzRecycleTimeSlot.slotEditTitle');
  formVisible.value = true;
}

function resetForm() {
  formRef.value?.resetFields();
  Object.assign(form, emptyForm());
}

async function handleSubmit() {
  await formRef.value?.validate();
  // 整点兜底（防 value-format 绕过 picker 的 disabled-minutes）——后端 validateTimeRange 是真源
  const windowErr = validateWindow(form.startTime, form.endTime, {
    notWholeHour: t('gzRecycleTimeSlot.ruleWindowNotWholeHour'),
    startBeforeEnd: t('gzRecycleTimeSlot.ruleWindowStartBeforeEnd')
  });
  if (windowErr) {
    ElMessage.warning(windowErr);
    return;
  }
  submitting.value = true;
  try {
    const payload = {
      id: form.id,
      storeId: form.storeId,
      label: form.label,
      startTime: form.startTime,
      endTime: form.endTime,
      weekdays: [...form.weekdayArr].sort((a, b) => a - b).join(','),
      effectiveDate: form.effectiveDate,
      expireDate: form.expireDate,
      sortNo: form.sortNo,
      enabled: form.enabled,
      remark: form.remark
    };
    if (form.id) {
      await updateGzRecycleTimeSlot(payload);
      ElMessage.success(t('gzRecycleTimeSlot.editOk'));
    } else {
      await addGzRecycleTimeSlot(payload);
      ElMessage.success(t('gzRecycleTimeSlot.addOk'));
    }
    formVisible.value = false;
    loadList();
  } finally {
    submitting.value = false;
  }
}

async function handleToggle(row: GzRecycleTimeSlotVO) {
  const next = row.enabled === 1 ? 0 : 1;
  await toggleGzRecycleTimeSlot(row.id, next);
  ElMessage.success(t('gzRecycleTimeSlot.toggleOk'));
  loadList();
}

async function handleDel(row: GzRecycleTimeSlotVO) {
  await ElMessageBox.confirm(
    t('gzRecycleTimeSlot.delConfirm', { range: `${hhmm(row.startTime)}-${hhmm(row.endTime)}` }),
    t('gzRecycleTimeSlot.tip'),
    { type: 'warning' }
  );
  await delGzRecycleTimeSlot(row.id);
  ElMessage.success(t('gzRecycleTimeSlot.delOk'));
  loadList();
}

onMounted(async () => {
  pageLoading.value = true;
  try {
    await loadStores();
    await loadList();
  } finally {
    pageLoading.value = false;
  }
});
</script>

<style scoped>
.ticket-tag {
  font-size: 12px;
  color: #909399;
}
.form-hint {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}
.batch-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
.batch-preview__covered {
  margin-left: 6px;
  color: #e6a23c;
}
.batch-preview {
  margin-top: 8px;
  padding: 8px 12px;
  background: #f4f4f5;
  border-radius: 4px;
  color: #606266;
  font-size: 13px;
}
</style>
