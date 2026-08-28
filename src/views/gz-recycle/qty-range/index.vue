<template>
  <div class="p-2">
    <el-card v-loading="pageLoading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzRecycleQtyRange.title') }}</span>
          <span class="ticket-tag">GZ-RECYCLE-004</span>
        </div>
      </template>

      <el-alert type="info" :description="t('gzRecycleQtyRange.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 查询条 -->
      <el-form inline class="mb-2">
        <el-form-item :label="t('gzRecycleQtyRange.colCode')">
          <el-input
            v-model="query.code"
            :placeholder="t('gzRecycleQtyRange.codePlaceholder')"
            clearable
            style="width: 160px"
            @keyup.enter="loadList"
          />
        </el-form-item>
        <el-form-item :label="t('gzRecycleQtyRange.colEnabled')">
          <el-select v-model="query.enabled" :placeholder="t('gzRecycleQtyRange.enabledPlaceholder')" clearable style="width: 120px">
            <el-option :label="t('gzRecycleQtyRange.enabledOn')" :value="1" />
            <el-option :label="t('gzRecycleQtyRange.enabledOff')" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadList">{{ t('gzRecycleQtyRange.search') }}</el-button>
          <el-button :icon="Refresh" @click="resetQuery">{{ t('gzRecycleQtyRange.reset') }}</el-button>
          <el-button v-hasPermi="['gz:recycle:qtyRange:add']" type="success" plain :icon="Plus" @click="handleAdd">{{
            t('gzRecycleQtyRange.add')
          }}</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="listLoading" :data="list" border stripe size="small">
        <el-table-column :label="t('gzRecycleQtyRange.colCode')" prop="code" width="140" show-overflow-tooltip />
        <el-table-column :label="t('gzRecycleQtyRange.colLabel')" prop="label" min-width="140" show-overflow-tooltip />
        <el-table-column :label="t('gzRecycleQtyRange.colDuration')" width="150" align="center">
          <template #default="{ row }">
            <span>{{ t('gzRecycleQtyRange.hoursN', { n: toHours(row.durationMinutes) }) }}</span>
            <span class="form-hint">（{{ row.durationMinutes }} {{ t('gzRecycleQtyRange.minutes') }}）</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzRecycleQtyRange.colEnabled')" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled === 1 ? 'success' : 'info'">
              {{ row.enabled === 1 ? t('gzRecycleQtyRange.enabledOn') : t('gzRecycleQtyRange.enabledOff') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzRecycleQtyRange.colSortNo')" prop="sortNo" width="80" align="center" />
        <el-table-column :label="t('gzRecycleQtyRange.colRemark')" prop="remark" min-width="140" show-overflow-tooltip />
        <el-table-column :label="t('gzRecycleQtyRange.colAction')" fixed="right" width="200" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:recycle:qtyRange:edit']" type="success" link size="small" @click="handleEdit(row)">{{
              t('gzRecycleQtyRange.edit')
            }}</el-button>
            <el-button
              v-hasPermi="['gz:recycle:qtyRange:edit']"
              :type="row.enabled === 1 ? 'warning' : 'primary'"
              link
              size="small"
              @click="handleToggle(row)"
            >
              {{ row.enabled === 1 ? t('gzRecycleQtyRange.disable') : t('gzRecycleQtyRange.enable') }}
            </el-button>
            <el-button v-hasPermi="['gz:recycle:qtyRange:remove']" type="danger" link size="small" @click="handleDel(row)">{{
              t('gzRecycleQtyRange.del')
            }}</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('gzRecycleQtyRange.empty')" /></template>
      </el-table>

      <pagination v-show="total > 0" v-model:page="query.pageNum" v-model:limit="query.pageSize" :total="total" @pagination="loadList" />
    </el-card>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="formTitle" width="480px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item :label="t('gzRecycleQtyRange.fieldCode')" prop="code">
          <el-input v-model="form.code" :disabled="!!form.id" maxlength="32" show-word-limit :placeholder="t('gzRecycleQtyRange.codePlaceholder')" />
          <span class="form-hint">{{ t('gzRecycleQtyRange.codeHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzRecycleQtyRange.fieldLabel')" prop="label">
          <el-input v-model="form.label" maxlength="64" show-word-limit :placeholder="t('gzRecycleQtyRange.labelPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('gzRecycleQtyRange.fieldDuration')" prop="durationHours">
          <el-input-number v-model="form.durationHours" :min="1" :max="12" :step="1" />
          <span class="form-hint">{{ t('gzRecycleQtyRange.durationHint', { m: (form.durationHours || 1) * 60, n: form.durationHours || 1 }) }}</span>
          <!-- 旧数据非 60 倍数：诚实提示会按向上取整算，不静默改数 -->
          <el-tag v-if="legacyMinutes !== null" type="warning" size="small" effect="plain">
            {{ t('gzRecycleQtyRange.legacyMinutesWarn', { n: legacyMinutes, m: toHours(legacyMinutes) }) }}
          </el-tag>
        </el-form-item>
        <el-form-item :label="t('gzRecycleQtyRange.fieldSortNo')">
          <el-input-number v-model="form.sortNo" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item :label="t('gzRecycleQtyRange.fieldEnabled')">
          <el-switch v-model="form.enabled" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item :label="t('gzRecycleQtyRange.fieldRemark')">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('gzRecycleQtyRange.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('gzRecycleQtyRange.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzRecycleQtyRange">
import { ref, reactive, onMounted } from 'vue';
import { Plus, Refresh, Search } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { useI18n } from 'vue-i18n';
import {
  listGzRecycleQtyRange,
  getGzRecycleQtyRange,
  addGzRecycleQtyRange,
  updateGzRecycleQtyRange,
  delGzRecycleQtyRange,
  toggleGzRecycleQtyRange,
  type GzRecycleQtyRangeVO,
  type GzRecycleQtyRangeQuery
} from '@/api/gz-recycle/qtyRange';

const { t } = useI18n();

const pageLoading = ref(false);
const listLoading = ref(false);
const submitting = ref(false);

const list = ref<GzRecycleQtyRangeVO[]>([]);
const total = ref(0);
const query = reactive<GzRecycleQtyRangeQuery>({ code: '', enabled: null, pageNum: 1, pageSize: 10 });

interface QtyRangeFormState {
  id: string | null;
  code: string;
  label: string;
  /** UI 层用「占用小时数」；提交时 ×60 转分钟（DB 列不变，历史单快照口径不变） */
  durationHours: number;
  sortNo: number | null;
  enabled: number;
  remark: string | null;
}
const formRef = ref<FormInstance>();
const formVisible = ref(false);
const formTitle = ref('');
const form = reactive<QtyRangeFormState>(emptyForm());

/** 分钟 → 占用小时数（向上取整，与后端 spanHoursOf 同口径） */
function toHours(minutes?: number | null): number {
  if (!minutes || minutes <= 0) return 1;
  return Math.max(1, Math.ceil(minutes / 60));
}

/**
 * 编辑打开时若该档时长不是 60 的整数倍 → 记下原值，表单里挂 warning。
 * 不静默改数：让店主自己看到「旧数据 90 分钟，保存后按 2 小时计」再决定。
 */
const legacyMinutes = ref<number | null>(null);

function emptyForm(): QtyRangeFormState {
  return { id: null, code: '', label: '', durationHours: 1, sortNo: 0, enabled: 1, remark: null };
}

const rules: FormRules = {
  code: [{ required: true, message: t('gzRecycleQtyRange.ruleCode'), trigger: 'blur' }],
  label: [{ required: true, message: t('gzRecycleQtyRange.ruleLabel'), trigger: 'blur' }],
  durationHours: [{ required: true, message: t('gzRecycleQtyRange.ruleDuration'), trigger: 'blur' }]
};

async function loadList() {
  listLoading.value = true;
  try {
    const res = await listGzRecycleQtyRange(query);
    list.value = res.rows;
    total.value = res.total;
  } finally {
    listLoading.value = false;
  }
}

function resetQuery() {
  query.code = '';
  query.enabled = null;
  query.pageNum = 1;
  loadList();
}

function handleAdd() {
  legacyMinutes.value = null;
  Object.assign(form, emptyForm());
  formTitle.value = t('gzRecycleQtyRange.addTitle');
  formVisible.value = true;
}

async function handleEdit(row: GzRecycleQtyRangeVO) {
  const { data } = await getGzRecycleQtyRange(row.id);
  // 非 60 倍数的旧数据：挂 warning 而不是静默改数（GZ-RECYCLE-012 归一迁移只跑一次，之后仍可能被手改）
  legacyMinutes.value = data.durationMinutes && data.durationMinutes % 60 !== 0 ? data.durationMinutes : null;
  Object.assign(form, {
    id: data.id,
    code: data.code,
    label: data.label,
    durationHours: toHours(data.durationMinutes),
    sortNo: data.sortNo,
    enabled: data.enabled,
    remark: data.remark ?? null
  });
  formTitle.value = t('gzRecycleQtyRange.editTitle');
  formVisible.value = true;
}

function resetForm() {
  formRef.value?.resetFields();
  Object.assign(form, emptyForm());
}

async function handleSubmit() {
  await formRef.value?.validate();
  submitting.value = true;
  try {
    const payload = {
      id: form.id,
      code: form.code,
      label: form.label,
      durationMinutes: (form.durationHours || 1) * 60,
      // occupy_next_slot 已随 GZ-RECYCLE-012 退休（占几格由 duration_minutes 决定）；
      // 后端 BO 若仍非空则恒传 0，绝不再让它影响占用面
      occupyNextSlot: 0,
      sortNo: form.sortNo,
      enabled: form.enabled,
      remark: form.remark
    };
    if (form.id) {
      await updateGzRecycleQtyRange(payload);
      ElMessage.success(t('gzRecycleQtyRange.editOk'));
    } else {
      await addGzRecycleQtyRange(payload);
      ElMessage.success(t('gzRecycleQtyRange.addOk'));
    }
    formVisible.value = false;
    loadList();
  } finally {
    submitting.value = false;
  }
}

async function handleToggle(row: GzRecycleQtyRangeVO) {
  const next = row.enabled === 1 ? 0 : 1;
  await toggleGzRecycleQtyRange(row.id, next);
  ElMessage.success(t('gzRecycleQtyRange.toggleOk'));
  loadList();
}

async function handleDel(row: GzRecycleQtyRangeVO) {
  await ElMessageBox.confirm(t('gzRecycleQtyRange.delConfirm', { code: row.code }), t('gzRecycleQtyRange.tip'), { type: 'warning' });
  await delGzRecycleQtyRange(row.id);
  ElMessage.success(t('gzRecycleQtyRange.delOk'));
  loadList();
}

onMounted(loadList);
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
</style>
