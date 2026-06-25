<template>
  <div class="p-2">
    <el-card v-loading="pageLoading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzRecycleTimeSlot.title') }}</span>
          <span class="ticket-tag">GZ-RECYCLE-006</span>
        </div>
      </template>

      <el-alert type="info" :description="t('gzRecycleTimeSlot.alertDesc')" show-icon :closable="false" class="mb-3" />

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
            {{ t('gzRecycleTimeSlot.add') }}
          </el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="listLoading" :data="list" border stripe size="small">
        <el-table-column :label="t('gzRecycleTimeSlot.colStore')" prop="storeName" min-width="140" show-overflow-tooltip />
        <el-table-column :label="t('gzRecycleTimeSlot.colTimeRange')" width="160" align="center">
          <template #default="{ row }">{{ hhmm(row.startTime) }} - {{ hhmm(row.endTime) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzRecycleTimeSlot.colLabel')" prop="label" min-width="120" show-overflow-tooltip />
        <el-table-column :label="t('gzRecycleTimeSlot.colEnabled')" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled === 1 ? 'success' : 'info'">
              {{ row.enabled === 1 ? t('gzRecycleTimeSlot.enabledOn') : t('gzRecycleTimeSlot.enabledOff') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzRecycleTimeSlot.colSortNo')" prop="sortNo" width="80" align="center" />
        <el-table-column :label="t('gzRecycleTimeSlot.colRemark')" prop="remark" min-width="140" show-overflow-tooltip />
        <el-table-column :label="t('gzRecycleTimeSlot.colAction')" fixed="right" width="200" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:recycle:timeSlot:edit']" type="success" link size="small" @click="handleEdit(row)">{{ t('gzRecycleTimeSlot.edit') }}</el-button>
            <el-button v-hasPermi="['gz:recycle:timeSlot:edit']" :type="row.enabled === 1 ? 'warning' : 'primary'" link size="small" @click="handleToggle(row)">
              {{ row.enabled === 1 ? t('gzRecycleTimeSlot.disable') : t('gzRecycleTimeSlot.enable') }}
            </el-button>
            <el-button v-hasPermi="['gz:recycle:timeSlot:remove']" type="danger" link size="small" @click="handleDel(row)">{{ t('gzRecycleTimeSlot.del') }}</el-button>
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
        <el-form-item :label="t('gzRecycleTimeSlot.fieldStart')" prop="startTime">
          <el-time-picker v-model="form.startTime" format="HH:mm" value-format="HH:mm:ss" :clearable="false" :placeholder="t('gzRecycleTimeSlot.startPlaceholder')" style="width: 160px" />
        </el-form-item>
        <el-form-item :label="t('gzRecycleTimeSlot.fieldEnd')" prop="endTime">
          <el-time-picker v-model="form.endTime" format="HH:mm" value-format="HH:mm:ss" :clearable="false" :placeholder="t('gzRecycleTimeSlot.endPlaceholder')" style="width: 160px" />
        </el-form-item>
        <el-form-item :label="t('gzRecycleTimeSlot.fieldLabel')">
          <el-input v-model="form.label" maxlength="64" show-word-limit :placeholder="t('gzRecycleTimeSlot.labelPlaceholder')" />
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
  </div>
</template>

<script setup lang="ts" name="GzRecycleTimeSlot">
import { ref, reactive, onMounted } from 'vue';
import { Plus, Refresh, Search } from '@element-plus/icons-vue';
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
  sortNo: number | null;
  enabled: number;
  remark: string | null;
}
const formRef = ref<FormInstance>();
const formVisible = ref(false);
const formTitle = ref('');
const form = reactive<TimeSlotFormState>(emptyForm());

function emptyForm(): TimeSlotFormState {
  return { id: null, storeId: query.storeId ?? null, label: null, startTime: '10:00:00', endTime: '13:00:00', sortNo: 0, enabled: 1, remark: null };
}

const rules: FormRules = {
  storeId: [{ required: true, message: t('gzRecycleTimeSlot.ruleStore'), trigger: 'change' }],
  startTime: [{ required: true, message: t('gzRecycleTimeSlot.ruleStart'), trigger: 'change' }],
  endTime: [{ required: true, message: t('gzRecycleTimeSlot.ruleEnd'), trigger: 'change' }]
};

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
  formTitle.value = t('gzRecycleTimeSlot.addTitle');
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
    sortNo: data.sortNo,
    enabled: data.enabled,
    remark: data.remark ?? null
  });
  formTitle.value = t('gzRecycleTimeSlot.editTitle');
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
      storeId: form.storeId,
      label: form.label,
      startTime: form.startTime,
      endTime: form.endTime,
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
</style>
