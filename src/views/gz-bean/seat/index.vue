<template>
  <div class="p-2">
    <el-card v-loading="pageLoading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzBeanSeat.title') }}</span>
          <span class="ticket-tag">GZ-BEAN-027</span>
        </div>
      </template>

      <el-alert :title="t('gzBeanSeat.alertTitle')" type="info" :description="t('gzBeanSeat.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 筛选 + 操作 -->
      <el-form inline class="mb-2" @submit.prevent="handleQuery">
        <el-form-item :label="t('gzBeanSeat.store')">
          <el-select v-model="currentStoreId" filterable style="width: 220px" @change="onStoreChange">
            <el-option v-for="s in storeOptions" :key="s.id" :label="`${s.storeNo} · ${s.name}`" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeat.seatTypeConfig')">
          <el-select
            v-model="query.seatTypeConfigId"
            clearable
            filterable
            :placeholder="t('gzBeanSeat.seatTypeConfigPlaceholder')"
            style="width: 200px"
            @change="handleQuery"
          >
            <el-option
              v-for="c in configOptions"
              :key="c.id"
              :label="`${c.name}（${c.bookMode === 'seat' ? t('gzBeanSeat.bookModeSeat') : t('gzBeanSeat.bookModeWhole')}）`"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeat.tableNo')">
          <el-input
            v-model="query.tableNo"
            clearable
            :placeholder="t('gzBeanSeat.tableNoPlaceholder')"
            style="width: 140px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item :label="t('gzBeanSeat.enabled')">
          <el-select v-model="query.enabled" clearable :placeholder="t('gzBeanSeat.enabledAll')" style="width: 120px" @change="handleQuery">
            <el-option :label="t('gzBeanSeat.enabledYes')" :value="1" />
            <el-option :label="t('gzBeanSeat.enabledNo')" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button v-hasPermi="['gz:bean:seat:list']" type="primary" :icon="Search" @click="handleQuery">
            {{ t('gzBeanSeat.search') }}
          </el-button>
          <el-button :icon="Refresh" @click="handleReset">{{ t('gzBeanSeat.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 工具栏 -->
      <el-row :gutter="10" class="mb-2">
        <el-col :span="1.5">
          <el-button
            v-hasPermi="['gz:bean:seat:batchGenerate']"
            type="warning"
            plain
            :icon="MagicStick"
            :disabled="!currentStoreId"
            @click="openBatchGenerate"
            >{{ t('gzBeanSeat.batchGenerate') }}</el-button
          >
        </el-col>
        <el-col :span="1.5">
          <el-button v-hasPermi="['gz:bean:seat:add']" type="primary" plain :icon="Plus" :disabled="!currentStoreId" @click="handleAdd">{{
            t('gzBeanSeat.add')
          }}</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button
            v-hasPermi="['gz:bean:seat:remove']"
            type="danger"
            plain
            :icon="Delete"
            :disabled="selectedIds.length === 0"
            @click="handleBatchDel"
            >{{ t('gzBeanSeat.batchDel') }}</el-button
          >
        </el-col>
      </el-row>

      <!-- 列表 -->
      <el-table v-loading="listLoading" :data="rows" border stripe size="small" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="46" align="center" />
        <el-table-column :label="t('gzBeanSeat.colSeatNo')" prop="seatNo" width="120" align="center" />
        <el-table-column :label="t('gzBeanSeat.colTypeName')" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.typeName || '-' }}</span>
            <el-tag v-if="row.bookMode" :type="row.bookMode === 'seat' ? 'warning' : 'success'" size="small" class="ml-1">
              {{ row.bookMode === 'seat' ? t('gzBeanSeat.bookModeSeat') : t('gzBeanSeat.bookModeWhole') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeat.colTableNo')" prop="tableNo" width="110" align="center">
          <template #default="{ row }">{{ row.tableNo || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeat.colZone')" prop="zone" width="120" align="center">
          <template #default="{ row }">{{ row.zone || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeat.colEnabled')" width="80" align="center">
          <template #default="{ row }">
            <el-switch
              v-hasPermi="['gz:bean:seat:edit']"
              :model-value="row.enabled === 1"
              :active-value="true"
              :inactive-value="false"
              @change="(v: boolean) => handleToggleEnabled(row, v ? 1 : 0)"
            />
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeat.colSortNo')" prop="sortNo" width="70" align="center" />
        <el-table-column :label="t('gzBeanSeat.colAction')" fixed="right" width="150" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:bean:seat:edit']" type="success" link size="small" @click="handleEdit(row)">
              {{ t('gzBeanSeat.edit') }}
            </el-button>
            <el-button v-hasPermi="['gz:bean:seat:remove']" type="danger" link size="small" @click="handleDel(row)">
              {{ t('gzBeanSeat.del') }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="t('gzBeanSeat.empty')" />
        </template>
      </el-table>

      <pagination v-show="total > 0" v-model:limit="query.pageSize" v-model:page="query.pageNum" :total="total" @pagination="loadList" />
    </el-card>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="formTitle" width="520px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item :label="t('gzBeanSeat.colSeatTypeConfig')" prop="seatTypeConfigId">
          <el-select v-model="form.seatTypeConfigId" filterable :placeholder="t('gzBeanSeat.seatTypeConfigPlaceholder')" style="width: 100%">
            <el-option
              v-for="c in configOptions"
              :key="c.id"
              :label="`${c.name}（${c.bookMode === 'seat' ? t('gzBeanSeat.bookModeSeat') : t('gzBeanSeat.bookModeWhole')}）`"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeat.colSeatNo')" prop="seatNo">
          <el-input v-model="form.seatNo" maxlength="16" :disabled="formMode === 'edit'" :placeholder="t('gzBeanSeat.seatNoPlaceholder')" />
          <span class="form-hint">{{ formMode === 'edit' ? t('gzBeanSeat.seatNoEditHint') : t('gzBeanSeat.seatNoHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeat.colTableNo')">
          <el-input v-model="form.tableNo" maxlength="16" :placeholder="t('gzBeanSeat.tableNoFormPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('gzBeanSeat.colZone')">
          <el-input v-model="form.zone" maxlength="16" :placeholder="t('gzBeanSeat.zonePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('gzBeanSeat.colEnabled')">
          <el-switch
            :model-value="form.enabled === 1"
            :active-value="true"
            :inactive-value="false"
            @update:model-value="(v: boolean) => (form.enabled = v ? 1 : 0)"
          />
        </el-form-item>
        <el-form-item :label="t('gzBeanSeat.colSortNo')">
          <el-input-number v-model="form.sortNo" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item :label="t('gzBeanSeat.colRemark')">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('gzBeanSeat.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('gzBeanSeat.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 按桌型批量生成弹窗 -->
    <el-dialog v-model="bgVisible" :title="t('gzBeanSeat.batchGenerateTitle')" width="480px">
      <el-alert type="info" :closable="false" show-icon class="mb-3" :description="t('gzBeanSeat.batchGenerateDesc')" />
      <el-form label-width="120px">
        <el-form-item :label="t('gzBeanSeat.bgScope')">
          <el-radio-group v-model="bgForm.scope">
            <el-radio value="all">{{ t('gzBeanSeat.bgScopeAll') }}</el-radio>
            <el-radio value="one">{{ t('gzBeanSeat.bgScopeOne') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="bgForm.scope === 'one'" :label="t('gzBeanSeat.colSeatTypeConfig')">
          <el-select v-model="bgForm.seatTypeConfigId" filterable :placeholder="t('gzBeanSeat.seatTypeConfigPlaceholder')" style="width: 100%">
            <el-option
              v-for="c in configOptions"
              :key="c.id"
              :label="`${c.name}（${c.bookMode === 'seat' ? t('gzBeanSeat.bookModeSeat') : t('gzBeanSeat.bookModeWhole')}）`"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeat.bgPrefix')">
          <el-input v-model="bgForm.prefix" maxlength="8" :placeholder="t('gzBeanSeat.bgPrefixPlaceholder')" style="width: 200px" />
          <span class="form-hint">{{ t('gzBeanSeat.bgPrefixHint') }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bgVisible = false">{{ t('gzBeanSeat.cancel') }}</el-button>
        <el-button type="warning" :loading="bgSubmitting" @click="handleBatchGenerate">{{ t('gzBeanSeat.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzBeanSeat">
import { ref, reactive, computed, onMounted } from 'vue';
import { Plus, Refresh, Search, Delete, MagicStick } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { getGzBeanStoreOptions, type GzBeanStoreVO } from '@/api/gz-bean/store';
import { listGzBeanSeatTypeConfigByStore, type GzBeanSeatTypeConfigVO } from '@/api/gz-bean/seatTypeConfig';
import {
  listGzBeanSeat,
  addGzBeanSeat,
  updateGzBeanSeat,
  toggleGzBeanSeatEnabled,
  delGzBeanSeat,
  batchGenerateGzBeanSeat,
  type GzBeanSeatVO,
  type GzBeanSeatForm,
  type GzBeanSeatQuery
} from '@/api/gz-bean/seat';

const { t } = useI18n();

const pageLoading = ref(false);
const listLoading = ref(false);
const submitting = ref(false);

const storeOptions = ref<GzBeanStoreVO[]>([]);
const currentStoreId = ref<number | null>(null);
const configOptions = ref<GzBeanSeatTypeConfigVO[]>([]);

const rows = ref<GzBeanSeatVO[]>([]);
const total = ref(0);
const selectedIds = ref<string[]>([]);

const query = reactive<GzBeanSeatQuery>({
  pageNum: 1,
  pageSize: 10,
  storeId: null,
  seatTypeConfigId: null,
  tableNo: undefined,
  enabled: undefined
});

// ============ 表单 ============
interface FormState {
  id: string | null;
  storeId: number | null;
  seatTypeConfigId: number | null;
  seatNo: string;
  tableNo: string;
  zone: string;
  enabled: number;
  sortNo: number;
  remark: string;
}
const formVisible = ref(false);
const formMode = ref<'add' | 'edit'>('add');
const formRef = ref<FormInstance>();
const form = reactive<FormState>({
  id: null,
  storeId: null,
  seatTypeConfigId: null,
  seatNo: '',
  tableNo: '',
  zone: '',
  enabled: 1,
  sortNo: 0,
  remark: ''
});
const formTitle = computed(() => (formMode.value === 'add' ? t('gzBeanSeat.addTitle') : t('gzBeanSeat.editTitle')));
const rules = {
  seatTypeConfigId: [{ required: true, message: t('gzBeanSeat.ruleConfigRequired'), trigger: 'change' }],
  seatNo: [{ required: true, message: t('gzBeanSeat.ruleSeatNoRequired'), trigger: 'blur' }]
};

// ============ 批量生成 ============
const bgVisible = ref(false);
const bgSubmitting = ref(false);
const bgForm = reactive<{ scope: 'all' | 'one'; seatTypeConfigId: number | null; prefix: string }>({
  scope: 'all',
  seatTypeConfigId: null,
  prefix: ''
});

// ============ 门店 / 桌型选项 ============
async function loadStoreOptions() {
  pageLoading.value = true;
  try {
    const resp = await getGzBeanStoreOptions();
    const r = resp as any;
    storeOptions.value = (r.data || r || []) as GzBeanStoreVO[];
    if (storeOptions.value.length > 0 && !currentStoreId.value) {
      currentStoreId.value = storeOptions.value[0].id;
      await onStoreChange(currentStoreId.value);
    }
  } catch (e) {
    console.error('[gz-bean-seat] loadStoreOptions failed', e);
    ElMessage.error(t('gzBeanSeat.loadFailed'));
  } finally {
    pageLoading.value = false;
  }
}

async function loadConfigOptions() {
  if (!currentStoreId.value) {
    configOptions.value = [];
    return;
  }
  try {
    const resp = await listGzBeanSeatTypeConfigByStore(currentStoreId.value);
    const r = resp as any;
    configOptions.value = (r.data || r || []) as GzBeanSeatTypeConfigVO[];
  } catch (e) {
    console.error('[gz-bean-seat] loadConfigOptions failed', e);
  }
}

async function onStoreChange(id: number) {
  currentStoreId.value = id;
  query.seatTypeConfigId = null;
  await loadConfigOptions();
  handleQuery();
}

// ============ 列表 ============
async function loadList() {
  if (!currentStoreId.value) return;
  listLoading.value = true;
  try {
    query.storeId = currentStoreId.value;
    const resp = await listGzBeanSeat(query);
    rows.value = (resp as any).rows || [];
    total.value = (resp as any).total || 0;
  } catch (e) {
    console.error('[gz-bean-seat] loadList failed', e);
    ElMessage.error(t('gzBeanSeat.loadFailed'));
  } finally {
    listLoading.value = false;
  }
}

function handleQuery() {
  query.pageNum = 1;
  loadList();
}

function handleReset() {
  query.seatTypeConfigId = null;
  query.tableNo = undefined;
  query.enabled = undefined;
  query.pageNum = 1;
  loadList();
}

function onSelectionChange(sel: GzBeanSeatVO[]) {
  selectedIds.value = sel.map((r) => r.id);
}

// ============ 增改 ============
function handleAdd() {
  formMode.value = 'add';
  Object.assign(form, {
    id: null,
    storeId: currentStoreId.value,
    seatTypeConfigId: query.seatTypeConfigId ? Number(query.seatTypeConfigId) : null,
    seatNo: '',
    tableNo: '',
    zone: '',
    enabled: 1,
    sortNo: 0,
    remark: ''
  });
  formVisible.value = true;
}

function handleEdit(row: GzBeanSeatVO) {
  formMode.value = 'edit';
  Object.assign(form, {
    id: row.id,
    storeId: currentStoreId.value,
    seatTypeConfigId: row.seatTypeConfigId ? Number(row.seatTypeConfigId) : null,
    seatNo: row.seatNo,
    tableNo: row.tableNo || '',
    zone: row.zone || '',
    enabled: row.enabled,
    sortNo: row.sortNo,
    remark: row.remark || ''
  });
  formVisible.value = true;
}

function resetForm() {
  formRef.value?.resetFields();
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate();
  submitting.value = true;
  try {
    const payload: GzBeanSeatForm = {
      id: form.id,
      storeId: form.storeId,
      seatTypeConfigId: form.seatTypeConfigId,
      seatNo: form.seatNo,
      tableNo: form.tableNo || null,
      zone: form.zone || null,
      enabled: form.enabled,
      sortNo: form.sortNo,
      remark: form.remark || null
    };
    if (formMode.value === 'add') {
      await addGzBeanSeat(payload);
      ElMessage.success(t('gzBeanSeat.addSuccess'));
    } else {
      await updateGzBeanSeat(payload);
      ElMessage.success(t('gzBeanSeat.editSuccess'));
    }
    formVisible.value = false;
    await loadList();
  } catch (e) {
    console.error('[gz-bean-seat] submit failed', e);
  } finally {
    submitting.value = false;
  }
}

async function handleToggleEnabled(row: GzBeanSeatVO, enabled: number) {
  try {
    await toggleGzBeanSeatEnabled(row.id, enabled);
    ElMessage.success(t('gzBeanSeat.editSuccess'));
    await loadList();
  } catch (e) {
    console.error('[gz-bean-seat] toggle failed', e);
    await loadList(); // 失败回滚 switch 视图
  }
}

async function handleDel(row: GzBeanSeatVO) {
  try {
    await ElMessageBox.confirm(t('gzBeanSeat.delConfirm', { no: row.seatNo }), t('gzBeanSeat.confirmTitle'), { type: 'warning' });
    await delGzBeanSeat(row.id);
    ElMessage.success(t('gzBeanSeat.delSuccess'));
    await loadList();
  } catch (e: any) {
    if (e !== 'cancel') console.error('[gz-bean-seat] del failed', e);
  }
}

async function handleBatchDel() {
  if (selectedIds.value.length === 0) return;
  try {
    await ElMessageBox.confirm(t('gzBeanSeat.batchDelConfirm', { count: selectedIds.value.length }), t('gzBeanSeat.confirmTitle'), {
      type: 'warning'
    });
    await delGzBeanSeat(selectedIds.value);
    ElMessage.success(t('gzBeanSeat.delSuccess'));
    selectedIds.value = [];
    await loadList();
  } catch (e: any) {
    if (e !== 'cancel') console.error('[gz-bean-seat] batch del failed', e);
  }
}

// ============ 按桌型批量生成 ============
function openBatchGenerate() {
  bgForm.scope = 'all';
  bgForm.seatTypeConfigId = null;
  bgForm.prefix = '';
  bgVisible.value = true;
}

async function handleBatchGenerate() {
  if (!currentStoreId.value) return;
  if (bgForm.scope === 'one' && !bgForm.seatTypeConfigId) {
    ElMessage.warning(t('gzBeanSeat.ruleConfigRequired'));
    return;
  }
  bgSubmitting.value = true;
  try {
    const resp = await batchGenerateGzBeanSeat({
      storeId: bgForm.scope === 'all' ? currentStoreId.value : null,
      seatTypeConfigId: bgForm.scope === 'one' ? bgForm.seatTypeConfigId : null,
      prefix: bgForm.prefix || null
    });
    const generated = (resp as any).data ?? 0;
    ElMessage.success(t('gzBeanSeat.batchGenerateSuccess', { count: generated }));
    bgVisible.value = false;
    await loadList();
  } catch (e) {
    console.error('[gz-bean-seat] batchGenerate failed', e);
  } finally {
    bgSubmitting.value = false;
  }
}

onMounted(() => {
  loadStoreOptions();
});
</script>

<style scoped>
.ticket-tag {
  background: #f0f9ff;
  color: #0369a1;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.form-hint {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}
</style>
