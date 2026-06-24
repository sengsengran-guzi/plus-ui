<template>
  <div class="p-2">
    <el-card v-loading="pageLoading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzRecycleIp.title') }}</span>
          <span class="ticket-tag">GZ-RECYCLE-004</span>
        </div>
      </template>

      <el-alert type="info" :description="t('gzRecycleIp.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 查询条 -->
      <el-form inline class="mb-2">
        <el-form-item :label="t('gzRecycleIp.colIpName')">
          <el-input v-model="query.ipName" :placeholder="t('gzRecycleIp.ipNamePlaceholder')" clearable style="width: 180px" @keyup.enter="loadList" />
        </el-form-item>
        <el-form-item :label="t('gzRecycleIp.colEnabled')">
          <el-select v-model="query.enabled" :placeholder="t('gzRecycleIp.enabledPlaceholder')" clearable style="width: 120px">
            <el-option :label="t('gzRecycleIp.enabledOn')" :value="1" />
            <el-option :label="t('gzRecycleIp.enabledOff')" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadList">{{ t('gzRecycleIp.search') }}</el-button>
          <el-button :icon="Refresh" @click="resetQuery">{{ t('gzRecycleIp.reset') }}</el-button>
          <el-button v-hasPermi="['gz:recycle:ip:add']" type="success" plain :icon="Plus" @click="handleAdd">{{ t('gzRecycleIp.add') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="listLoading" :data="list" border stripe size="small">
        <el-table-column :label="t('gzRecycleIp.colIpName')" prop="ipName" min-width="160" show-overflow-tooltip />
        <el-table-column :label="t('gzRecycleIp.colEnabled')" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled === 1 ? 'success' : 'info'">
              {{ row.enabled === 1 ? t('gzRecycleIp.enabledOn') : t('gzRecycleIp.enabledOff') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzRecycleIp.colSortNo')" prop="sortNo" width="80" align="center" />
        <el-table-column :label="t('gzRecycleIp.colRemark')" prop="remark" min-width="160" show-overflow-tooltip />
        <el-table-column :label="t('gzRecycleIp.colCreateTime')" prop="createTime" width="170" />
        <el-table-column :label="t('gzRecycleIp.colAction')" fixed="right" width="200" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:recycle:ip:edit']" type="success" link size="small" @click="handleEdit(row)">{{ t('gzRecycleIp.edit') }}</el-button>
            <el-button v-hasPermi="['gz:recycle:ip:edit']" :type="row.enabled === 1 ? 'warning' : 'primary'" link size="small" @click="handleToggle(row)">
              {{ row.enabled === 1 ? t('gzRecycleIp.disable') : t('gzRecycleIp.enable') }}
            </el-button>
            <el-button v-hasPermi="['gz:recycle:ip:remove']" type="danger" link size="small" @click="handleDel(row)">{{ t('gzRecycleIp.del') }}</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('gzRecycleIp.empty')" /></template>
      </el-table>

      <pagination v-show="total > 0" v-model:page="query.pageNum" v-model:limit="query.pageSize" :total="total" @pagination="loadList" />
    </el-card>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="formTitle" width="460px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item :label="t('gzRecycleIp.fieldIpName')" prop="ipName">
          <el-input v-model="form.ipName" maxlength="64" show-word-limit :placeholder="t('gzRecycleIp.ipNamePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('gzRecycleIp.fieldSortNo')">
          <el-input-number v-model="form.sortNo" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item :label="t('gzRecycleIp.fieldEnabled')">
          <el-switch v-model="form.enabled" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item :label="t('gzRecycleIp.fieldRemark')">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('gzRecycleIp.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('gzRecycleIp.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzRecycleIp">
import { ref, reactive, onMounted } from 'vue';
import { Plus, Refresh, Search } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { useI18n } from 'vue-i18n';
import {
  listGzRecycleIp,
  getGzRecycleIp,
  addGzRecycleIp,
  updateGzRecycleIp,
  delGzRecycleIp,
  toggleGzRecycleIp,
  type GzRecycleIpVO,
  type GzRecycleIpQuery
} from '@/api/gz-recycle/ip';

const { t } = useI18n();

const pageLoading = ref(false);
const listLoading = ref(false);
const submitting = ref(false);

const list = ref<GzRecycleIpVO[]>([]);
const total = ref(0);
const query = reactive<GzRecycleIpQuery>({ ipName: '', enabled: null, pageNum: 1, pageSize: 10 });

interface IpFormState {
  id: string | null;
  ipName: string;
  sortNo: number | null;
  enabled: number;
  remark: string | null;
}
const formRef = ref<FormInstance>();
const formVisible = ref(false);
const formTitle = ref('');
const form = reactive<IpFormState>(emptyForm());

function emptyForm(): IpFormState {
  return { id: null, ipName: '', sortNo: 0, enabled: 1, remark: null };
}

const rules: FormRules = {
  ipName: [{ required: true, message: t('gzRecycleIp.ruleIpName'), trigger: 'blur' }]
};

async function loadList() {
  listLoading.value = true;
  try {
    const res = await listGzRecycleIp(query);
    list.value = res.rows;
    total.value = res.total;
  } finally {
    listLoading.value = false;
  }
}

function resetQuery() {
  query.ipName = '';
  query.enabled = null;
  query.pageNum = 1;
  loadList();
}

function handleAdd() {
  Object.assign(form, emptyForm());
  formTitle.value = t('gzRecycleIp.addTitle');
  formVisible.value = true;
}

async function handleEdit(row: GzRecycleIpVO) {
  const { data } = await getGzRecycleIp(row.id);
  Object.assign(form, {
    id: data.id,
    ipName: data.ipName,
    sortNo: data.sortNo,
    enabled: data.enabled,
    remark: data.remark ?? null
  });
  formTitle.value = t('gzRecycleIp.editTitle');
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
      ipName: form.ipName,
      sortNo: form.sortNo,
      enabled: form.enabled,
      remark: form.remark
    };
    if (form.id) {
      await updateGzRecycleIp(payload);
      ElMessage.success(t('gzRecycleIp.editOk'));
    } else {
      await addGzRecycleIp(payload);
      ElMessage.success(t('gzRecycleIp.addOk'));
    }
    formVisible.value = false;
    loadList();
  } finally {
    submitting.value = false;
  }
}

async function handleToggle(row: GzRecycleIpVO) {
  const next = row.enabled === 1 ? 0 : 1;
  await toggleGzRecycleIp(row.id, next);
  ElMessage.success(t('gzRecycleIp.toggleOk'));
  loadList();
}

async function handleDel(row: GzRecycleIpVO) {
  await ElMessageBox.confirm(t('gzRecycleIp.delConfirm', { name: row.ipName }), t('gzRecycleIp.tip'), { type: 'warning' });
  await delGzRecycleIp(row.id);
  ElMessage.success(t('gzRecycleIp.delOk'));
  loadList();
}

onMounted(loadList);
</script>

<style scoped>
.ticket-tag {
  font-size: 12px;
  color: #909399;
}
</style>
