<template>
  <div class="p-2">
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzJpEvent.title') }}</span>
          <span class="ticket-tag">GZ-JP-101</span>
        </div>
      </template>

      <el-alert type="info" :description="t('gzJpEvent.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 查询条 -->
      <el-form inline class="mb-2">
        <el-form-item :label="t('gzJpEvent.colEventNo')">
          <el-input
            v-model="query.eventNo"
            :placeholder="t('gzJpEvent.eventNoPlaceholder')"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item :label="t('gzJpEvent.colName')">
          <el-input v-model="query.name" :placeholder="t('gzJpEvent.namePlaceholder')" clearable style="width: 180px" @keyup.enter="handleSearch" />
        </el-form-item>
        <el-form-item :label="t('gzJpEvent.colStatus')">
          <el-select v-model="query.status" :placeholder="t('gzJpEvent.statusPlaceholder')" clearable style="width: 140px">
            <el-option v-for="d in gz_jp_event_status" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzJpEvent.colStartTime')">
          <el-date-picker
            v-model="startTimeRange"
            type="datetimerange"
            value-format="YYYY-MM-DD HH:mm:ss"
            :start-placeholder="t('gzJpEvent.timeStart')"
            :end-placeholder="t('gzJpEvent.timeEnd')"
            style="width: 340px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">{{ t('gzJpEvent.search') }}</el-button>
          <el-button :icon="Refresh" @click="resetQuery">{{ t('gzJpEvent.reset') }}</el-button>
          <el-button v-hasPermi="['gz:jp:event:add']" type="success" plain :icon="Plus" @click="handleAdd">{{ t('gzJpEvent.add') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="listLoading" :data="list" border stripe size="small">
        <el-table-column :label="t('gzJpEvent.colEventNo')" prop="eventNo" width="180" show-overflow-tooltip />
        <el-table-column :label="t('gzJpEvent.colName')" prop="name" min-width="160" show-overflow-tooltip />
        <el-table-column :label="t('gzJpEvent.colStartTime')" prop="startTime" width="170" align="center" />
        <el-table-column :label="t('gzJpEvent.colEndTime')" prop="endTime" width="170" align="center" />
        <el-table-column :label="t('gzJpEvent.colStatus')" width="130" align="center">
          <template #default="{ row }">
            <dict-tag :options="gz_jp_event_status" :value="row.status" />
            <el-tooltip v-if="row.status === 'closed' && row.rawStatus !== 'closed'" :content="t('gzJpEvent.autoClosedHint')">
              <el-icon class="auto-closed-icon"><Clock /></el-icon>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzJpEvent.colSortNo')" prop="sortNo" width="80" align="center" />
        <el-table-column :label="t('gzJpEvent.colRemark')" prop="remark" min-width="140" show-overflow-tooltip />
        <el-table-column :label="t('gzJpEvent.colAction')" fixed="right" width="230" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:jp:event:edit']" type="success" link size="small" @click="handleEdit(row)">
              {{ t('gzJpEvent.edit') }}
            </el-button>
            <el-button v-if="row.status !== 'open'" v-hasPermi="['gz:jp:event:edit']" type="primary" link size="small" @click="handleOpen(row)">
              {{ t('gzJpEvent.open') }}
            </el-button>
            <el-button v-else v-hasPermi="['gz:jp:event:edit']" type="warning" link size="small" @click="handleClose(row)">
              {{ t('gzJpEvent.close') }}
            </el-button>
            <el-button v-hasPermi="['gz:jp:event:remove']" type="danger" link size="small" @click="handleDel(row)">
              {{ t('gzJpEvent.del') }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('gzJpEvent.empty')" /></template>
      </el-table>

      <pagination v-show="total > 0" v-model:page="query.pageNum" v-model:limit="query.pageSize" :total="total" @pagination="loadList" />
    </el-card>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="formTitle" width="620px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item :label="t('gzJpEvent.fieldName')" prop="name">
          <el-input v-model="form.name" maxlength="128" show-word-limit :placeholder="t('gzJpEvent.namePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('gzJpEvent.fieldCover')">
          <GzImageUpload v-model="form.coverImageId" :usage-type="GZ_FILE_USAGE_TYPE.JP_EVENT_IMAGE" />
        </el-form-item>
        <el-form-item :label="t('gzJpEvent.fieldDescription')">
          <el-input v-model="form.description" type="textarea" :rows="2" maxlength="512" show-word-limit />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('gzJpEvent.fieldStartTime')" prop="startTime" label-width="110px">
              <el-date-picker
                v-model="form.startTime"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                :placeholder="t('gzJpEvent.timeStart')"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzJpEvent.fieldEndTime')" prop="endTime" label-width="110px">
              <el-date-picker
                v-model="form.endTime"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                :placeholder="t('gzJpEvent.timeEnd')"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item :label="t('gzJpEvent.fieldSortNo')">
          <el-input-number v-model="form.sortNo" :min="0" :max="9999" />
          <span class="form-hint">{{ t('gzJpEvent.sortNoHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzJpEvent.fieldRemark')">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('gzJpEvent.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('gzJpEvent.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzJpEvent">
import { ref, reactive, watch, onMounted, getCurrentInstance, toRefs, type ComponentInternalInstance } from 'vue';
import { Clock, Plus, Refresh, Search } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { useI18n } from 'vue-i18n';
import GzImageUpload from '@/components/GzImageUpload/index.vue';
import { GZ_FILE_USAGE_TYPE } from '@/api/gz-common/file';
import {
  listGzJpEvent,
  getGzJpEvent,
  addGzJpEvent,
  updateGzJpEvent,
  openGzJpEvent,
  closeGzJpEvent,
  delGzJpEvent,
  type GzJpEventVO,
  type GzJpEventQuery
} from '@/api/gz-jp/event';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { gz_jp_event_status } = toRefs<any>(proxy?.useDict('gz_jp_event_status'));

const listLoading = ref(false);
const submitting = ref(false);

const list = ref<GzJpEventVO[]>([]);
const total = ref(0);
const query = reactive<GzJpEventQuery>({ eventNo: '', name: '', status: '', pageNum: 1, pageSize: 10 });

/** 开场时间区间（el-date-picker 绑 string 元组，watch 拆进 query） */
const startTimeRange = ref<[string, string] | null>(null);
watch(startTimeRange, (v) => {
  query.beginStartTime = v ? v[0] : undefined;
  query.endStartTime = v ? v[1] : undefined;
});

interface EventFormState {
  id: string | null;
  name: string;
  coverImageId: string | null;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  sortNo: number | null;
  remark: string | null;
}

const formRef = ref<FormInstance>();
const formVisible = ref(false);
const formTitle = ref('');
const form = reactive<EventFormState>(emptyForm());

function emptyForm(): EventFormState {
  return { id: null, name: '', coverImageId: null, description: null, startTime: null, endTime: null, sortNo: 0, remark: null };
}

const rules: FormRules = {
  name: [{ required: true, message: t('gzJpEvent.ruleName'), trigger: 'blur' }],
  startTime: [{ required: true, message: t('gzJpEvent.ruleStartTime'), trigger: 'change' }],
  endTime: [{ required: true, message: t('gzJpEvent.ruleEndTime'), trigger: 'change' }]
};

async function loadList() {
  listLoading.value = true;
  try {
    const res = await listGzJpEvent(query);
    list.value = res.rows;
    total.value = res.total;
  } finally {
    listLoading.value = false;
  }
}

function handleSearch() {
  query.pageNum = 1;
  loadList();
}

function resetQuery() {
  query.eventNo = '';
  query.name = '';
  query.status = '';
  startTimeRange.value = null;
  query.pageNum = 1;
  loadList();
}

function handleAdd() {
  Object.assign(form, emptyForm());
  formTitle.value = t('gzJpEvent.addTitle');
  formVisible.value = true;
}

async function handleEdit(row: GzJpEventVO) {
  const { data } = await getGzJpEvent(row.id);
  Object.assign(form, {
    id: data.id,
    name: data.name,
    coverImageId: data.coverImageId ? String(data.coverImageId) : null,
    description: data.description ?? null,
    startTime: data.startTime,
    endTime: data.endTime,
    sortNo: data.sortNo,
    remark: data.remark ?? null
  });
  formTitle.value = t('gzJpEvent.editTitle');
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
      name: form.name,
      coverImageId: form.coverImageId,
      description: form.description,
      startTime: form.startTime,
      endTime: form.endTime,
      sortNo: form.sortNo,
      remark: form.remark
    };
    if (form.id) {
      await updateGzJpEvent(payload);
      ElMessage.success(t('gzJpEvent.editOk'));
    } else {
      await addGzJpEvent(payload);
      ElMessage.success(t('gzJpEvent.addOk'));
    }
    formVisible.value = false;
    loadList();
  } finally {
    submitting.value = false;
  }
}

async function handleOpen(row: GzJpEventVO) {
  await ElMessageBox.confirm(t('gzJpEvent.openConfirm', { name: row.name }), t('gzJpEvent.tip'), { type: 'warning' });
  await openGzJpEvent(row.id);
  ElMessage.success(t('gzJpEvent.openOk'));
  loadList();
}

async function handleClose(row: GzJpEventVO) {
  await ElMessageBox.confirm(t('gzJpEvent.closeConfirm', { name: row.name }), t('gzJpEvent.tip'), { type: 'warning' });
  await closeGzJpEvent(row.id);
  ElMessage.success(t('gzJpEvent.closeOk'));
  loadList();
}

async function handleDel(row: GzJpEventVO) {
  await ElMessageBox.confirm(t('gzJpEvent.delConfirm', { name: row.name }), t('gzJpEvent.tip'), { type: 'warning' });
  await delGzJpEvent(row.id);
  ElMessage.success(t('gzJpEvent.delOk'));
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
.auto-closed-icon {
  margin-left: 4px;
  color: #909399;
  vertical-align: middle;
}
</style>
