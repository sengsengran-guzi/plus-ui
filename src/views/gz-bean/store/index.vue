<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzBeanStore.title') }}</span>
          <span class="ticket-tag">GZ-BEAN-001</span>
        </div>
      </template>

      <el-alert
        :title="t('gzBeanStore.alertTitle')"
        type="info"
        :description="t('gzBeanStore.alertDesc')"
        show-icon
        :closable="false"
        class="mb-3"
      />

      <!-- 查询表单 -->
      <el-form :model="query" inline @submit.prevent="handleQuery">
        <el-form-item :label="t('gzBeanStore.storeNo')">
          <el-input
            v-model="query.storeNo"
            :placeholder="t('gzBeanStore.storeNoPlaceholder')"
            clearable
            style="width: 180px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item :label="t('gzBeanStore.name')">
          <el-input
            v-model="query.name"
            :placeholder="t('gzBeanStore.namePlaceholder')"
            clearable
            style="width: 200px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item :label="t('gzBeanStore.type')">
          <el-select
            v-model="query.type"
            :placeholder="t('gzBeanStore.typePlaceholder')"
            clearable
            style="width: 160px"
          >
            <el-option :label="t('gzBeanStore.typePindou')" value="pindou" />
            <el-option :label="t('gzBeanStore.typeGuzi')" value="guzi" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanStore.status')">
          <el-select
            v-model="query.status"
            :placeholder="t('gzBeanStore.statusPlaceholder')"
            clearable
            style="width: 160px"
          >
            <el-option :label="t('gzBeanStore.statusOpen')" value="open" />
            <el-option :label="t('gzBeanStore.statusClosed')" value="closed" />
            <el-option :label="t('gzBeanStore.statusMaintenance')" value="maintenance" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button v-hasPermi="['gz:bean:store:list']" type="primary" :icon="Search" @click="handleQuery">
            {{ t('gzBeanStore.search') }}
          </el-button>
          <el-button :icon="Refresh" @click="handleReset">{{ t('gzBeanStore.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 工具栏 -->
      <el-row :gutter="10" class="mb-2">
        <el-col :span="1.5">
          <el-button v-hasPermi="['gz:bean:store:add']" type="primary" plain :icon="Plus" @click="handleAdd">
            {{ t('gzBeanStore.add') }}
          </el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button
            v-hasPermi="['gz:bean:store:remove']"
            type="danger"
            plain
            :icon="Delete"
            :disabled="!selectedIds.length"
            @click="handleBatchDel"
          >
            {{ t('gzBeanStore.del') }}
          </el-button>
        </el-col>
      </el-row>

      <!-- 数据表格 -->
      <el-table
        v-loading="loading"
        :data="rows"
        border
        stripe
        size="small"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column :label="t('gzBeanStore.colId')" prop="id" width="80" align="center" />
        <el-table-column :label="t('gzBeanStore.colStoreNo')" prop="storeNo" width="130" />
        <el-table-column :label="t('gzBeanStore.colName')" prop="name" min-width="160" show-overflow-tooltip />
        <el-table-column :label="t('gzBeanStore.colType')" prop="type" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.type === 'pindou' ? 'success' : 'info'" size="small">
              {{ row.type === 'pindou' ? t('gzBeanStore.typePindou') : t('gzBeanStore.typeGuzi') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanStore.colAddress')" prop="address" min-width="220" show-overflow-tooltip />
        <el-table-column :label="t('gzBeanStore.colPhone')" prop="phone" width="140" />
        <el-table-column :label="t('gzBeanStore.colBusinessHours')" prop="businessHours" width="140" />
        <el-table-column :label="t('gzBeanStore.colStatus')" prop="status" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanStore.colMaxAdvanceDays')" prop="maxAdvanceDays" width="120" align="center" />
        <el-table-column :label="t('gzBeanStore.colCreateTime')" prop="createTime" width="170" />
        <el-table-column :label="t('gzBeanStore.colAction')" fixed="right" width="180" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:bean:store:query']" type="primary" link size="small" @click="handleDetail(row)">
              {{ t('gzBeanStore.detail') }}
            </el-button>
            <el-button v-hasPermi="['gz:bean:store:edit']" type="success" link size="small" @click="handleEdit(row)">
              {{ t('gzBeanStore.edit') }}
            </el-button>
            <el-button v-hasPermi="['gz:bean:store:remove']" type="danger" link size="small" @click="handleDel(row)">
              {{ t('gzBeanStore.del') }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="t('gzBeanStore.empty')" />
        </template>
      </el-table>

      <!-- 分页 -->
      <pagination
        v-show="total > 0"
        v-model:limit="query.pageSize"
        v-model:page="query.pageNum"
        :total="total"
        @pagination="loadList"
      />
    </el-card>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="formTitle" width="640px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('gzBeanStore.storeNo')" prop="storeNo">
              <el-input v-model="form.storeNo" :disabled="formMode === 'edit'" maxlength="32" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzBeanStore.type')" prop="type">
              <el-select v-model="form.type" style="width: 100%">
                <el-option :label="t('gzBeanStore.typePindou')" value="pindou" />
                <el-option :label="t('gzBeanStore.typeGuzi')" value="guzi" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item :label="t('gzBeanStore.name')" prop="name">
          <el-input v-model="form.name" maxlength="64" />
        </el-form-item>
        <el-form-item :label="t('gzBeanStore.address')" prop="address">
          <el-input v-model="form.address" type="textarea" :rows="2" maxlength="255" show-word-limit />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('gzBeanStore.phone')">
              <el-input v-model="form.phone" maxlength="20" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzBeanStore.businessHours')">
              <el-input v-model="form.businessHours" maxlength="255" :placeholder="t('gzBeanStore.businessHoursPlaceholder')" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('gzBeanStore.status')" prop="status">
              <el-select v-model="form.status" style="width: 100%">
                <el-option :label="t('gzBeanStore.statusOpen')" value="open" />
                <el-option :label="t('gzBeanStore.statusClosed')" value="closed" />
                <el-option :label="t('gzBeanStore.statusMaintenance')" value="maintenance" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzBeanStore.maxAdvanceDays')">
              <el-input-number v-model="form.maxAdvanceDays" :min="1" :max="60" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('gzBeanStore.longitude')">
              <el-input v-model="longitudeStr" :placeholder="t('gzBeanStore.longitudePlaceholder')" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzBeanStore.latitude')">
              <el-input v-model="latitudeStr" :placeholder="t('gzBeanStore.latitudePlaceholder')" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item :label="t('gzBeanStore.remark')">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('gzBeanStore.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('gzBeanStore.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" :title="t('gzBeanStore.detailTitle')" size="50%" direction="rtl">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item :label="t('gzBeanStore.colId')">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanStore.colStoreNo')">{{ detail.storeNo }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanStore.colName')" :span="2">{{ detail.name }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanStore.colType')">
          <el-tag :type="detail.type === 'pindou' ? 'success' : 'info'" size="small">
            {{ detail.type === 'pindou' ? t('gzBeanStore.typePindou') : t('gzBeanStore.typeGuzi') }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanStore.colStatus')">
          <el-tag :type="statusTagType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanStore.colAddress')" :span="2">{{ detail.address }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanStore.colPhone')">{{ detail.phone || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanStore.colBusinessHours')">{{ detail.businessHours || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanStore.colMaxAdvanceDays')">{{ detail.maxAdvanceDays }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanStore.colCreateTime')">{{ detail.createTime }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanStore.longitude')">{{ detail.longitude ?? '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanStore.latitude')">{{ detail.latitude ?? '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanStore.remark')" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>

<script setup lang="ts" name="GzBeanStore">
import { ref, reactive, computed, watch } from 'vue';
import { Search, Refresh, Plus, Delete } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { useI18n } from 'vue-i18n';
import {
  listGzBeanStore,
  getGzBeanStore,
  addGzBeanStore,
  updateGzBeanStore,
  delGzBeanStore,
  type GzBeanStoreVO,
  type GzBeanStoreForm,
  type GzBeanStoreQuery
} from '@/api/gz-bean/store';

const { t } = useI18n();

const loading = ref<boolean>(false);
const submitting = ref<boolean>(false);
const rows = ref<GzBeanStoreVO[]>([]);
const total = ref<number>(0);
const selectedIds = ref<Array<number | string>>([]);

const query = reactive<GzBeanStoreQuery>({
  pageNum: 1,
  pageSize: 10
});

const detailVisible = ref<boolean>(false);
const detail = ref<GzBeanStoreVO | null>(null);

const formVisible = ref<boolean>(false);
const formMode = ref<'add' | 'edit'>('add');
const formRef = ref<FormInstance>();
const form = reactive<GzBeanStoreForm>({
  type: 'pindou',
  status: 'open',
  maxAdvanceDays: 14
});

/** 经纬度用字符串中转避免 el-input-number 强制数值导致提交时 "" → null 处理麻烦 */
const longitudeStr = ref<string>('');
const latitudeStr = ref<string>('');

const formTitle = computed(() =>
  formMode.value === 'add' ? t('gzBeanStore.addDialogTitle') : t('gzBeanStore.editDialogTitle')
);

const rules = {
  storeNo: [{ required: true, message: t('gzBeanStore.ruleStoreNoRequired'), trigger: 'blur' }],
  name: [{ required: true, message: t('gzBeanStore.ruleNameRequired'), trigger: 'blur' }],
  address: [{ required: true, message: t('gzBeanStore.ruleAddressRequired'), trigger: 'blur' }],
  type: [{ required: true, message: t('gzBeanStore.ruleTypeRequired'), trigger: 'change' }],
  status: [{ required: true, message: t('gzBeanStore.ruleStatusRequired'), trigger: 'change' }]
};

async function loadList() {
  loading.value = true;
  try {
    // ruoyi request.ts interceptor 已对 AjaxResult/TableDataInfo 做了一层解包：
    // res.data.code===200 时 return Promise.resolve(res.data)。调用方直接拿到 { code, msg, rows, total, data }
    // —— 不需要再 .data。AxiosPromise<{ total; rows }> 的 TS 声明此处是误导；用 as any 短期 cast。
    const resp = await listGzBeanStore(query);
    rows.value = (resp as any).rows || [];
    total.value = (resp as any).total || 0;
  } catch (e) {
    console.error('[gz-bean-store] load failed', e);
    ElMessage.error(t('gzBeanStore.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  query.pageNum = 1;
  loadList();
}

function handleReset() {
  query.storeNo = undefined;
  query.name = undefined;
  query.type = undefined;
  query.status = undefined;
  query.pageNum = 1;
  loadList();
}

function handleSelectionChange(selected: GzBeanStoreVO[]) {
  selectedIds.value = selected.map((s) => s.id);
}

async function handleDetail(row: GzBeanStoreVO) {
  try {
    const resp = await getGzBeanStore(row.id);
    // 同 loadList：ruoyi request.ts 已解包，无需 .data
    detail.value = resp as any;
    detailVisible.value = true;
  } catch (e) {
    console.error('[gz-bean-store] detail failed', e);
    ElMessage.error(t('gzBeanStore.detailFailed'));
  }
}

function resetForm() {
  Object.assign(form, {
    id: null,
    storeNo: '',
    name: '',
    type: 'pindou',
    address: '',
    longitude: null,
    latitude: null,
    phone: '',
    businessHours: '',
    status: 'open',
    maxAdvanceDays: 14,
    remark: ''
  });
  longitudeStr.value = '';
  latitudeStr.value = '';
  formRef.value?.resetFields();
}

function handleAdd() {
  resetForm();
  formMode.value = 'add';
  formVisible.value = true;
}

async function handleEdit(row: GzBeanStoreVO) {
  resetForm();
  formMode.value = 'edit';
  try {
    const resp = await getGzBeanStore(row.id);
    // 同 loadList：ruoyi request.ts 已解包，无需 .data
    const d = resp as any;
    Object.assign(form, {
      id: d.id,
      storeNo: d.storeNo,
      name: d.name,
      type: d.type,
      address: d.address,
      phone: d.phone,
      businessHours: d.businessHours,
      status: d.status,
      maxAdvanceDays: d.maxAdvanceDays,
      remark: d.remark
    });
    longitudeStr.value = d.longitude !== null && d.longitude !== undefined ? String(d.longitude) : '';
    latitudeStr.value = d.latitude !== null && d.latitude !== undefined ? String(d.latitude) : '';
    formVisible.value = true;
  } catch (e) {
    console.error('[gz-bean-store] load detail for edit failed', e);
    ElMessage.error(t('gzBeanStore.detailFailed'));
  }
}

async function handleSubmit() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  // 经纬度字符串 → number | null（空串/非数 → null）
  const lng = longitudeStr.value.trim();
  const lat = latitudeStr.value.trim();
  form.longitude = lng && !isNaN(Number(lng)) ? Number(lng) : null;
  form.latitude = lat && !isNaN(Number(lat)) ? Number(lat) : null;

  submitting.value = true;
  try {
    if (formMode.value === 'add') {
      await addGzBeanStore(form);
      ElMessage.success(t('gzBeanStore.addSuccess'));
    } else {
      await updateGzBeanStore(form);
      ElMessage.success(t('gzBeanStore.editSuccess'));
    }
    formVisible.value = false;
    loadList();
  } catch (e) {
    console.error('[gz-bean-store] submit failed', e);
    // 后端 ServiceException（如 storeNo 重复）会走 ruoyi 全局拦截 → request 抛错时已 toast，
    // 这里只在控制台标记，不重复 toast
  } finally {
    submitting.value = false;
  }
}

async function handleDel(row: GzBeanStoreVO) {
  const ok = await ElMessageBox.confirm(
    t('gzBeanStore.delConfirm', { name: row.name }),
    t('gzBeanStore.delConfirmTitle'),
    { confirmButtonText: t('gzBeanStore.confirm'), cancelButtonText: t('gzBeanStore.cancel'), type: 'warning' }
  ).catch(() => false);
  if (!ok) return;
  try {
    await delGzBeanStore(row.id);
    ElMessage.success(t('gzBeanStore.delSuccess'));
    loadList();
  } catch (e) {
    console.error('[gz-bean-store] del failed', e);
  }
}

async function handleBatchDel() {
  if (!selectedIds.value.length) return;
  const ok = await ElMessageBox.confirm(
    t('gzBeanStore.delBatchConfirm', { n: selectedIds.value.length }),
    t('gzBeanStore.delConfirmTitle'),
    { confirmButtonText: t('gzBeanStore.confirm'), cancelButtonText: t('gzBeanStore.cancel'), type: 'warning' }
  ).catch(() => false);
  if (!ok) return;
  try {
    await delGzBeanStore(selectedIds.value);
    ElMessage.success(t('gzBeanStore.delSuccess'));
    selectedIds.value = [];
    loadList();
  } catch (e) {
    console.error('[gz-bean-store] batch del failed', e);
  }
}

function statusTagType(status: string): 'primary' | 'success' | 'info' | 'warning' | 'danger' {
  switch (status) {
    case 'open':
      return 'success';
    case 'closed':
      return 'danger';
    case 'maintenance':
      return 'warning';
    default:
      return 'info';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'open':
      return t('gzBeanStore.statusOpen');
    case 'closed':
      return t('gzBeanStore.statusClosed');
    case 'maintenance':
      return t('gzBeanStore.statusMaintenance');
    default:
      return status;
  }
}

// 弹窗关闭时主动 reset，避免下次新增残留编辑数据
watch(formVisible, (v) => {
  if (!v) {
    resetForm();
  }
});

loadList();
</script>

<style lang="scss" scoped>
.ticket-tag {
  padding: 2px 8px;
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
  border-radius: 4px;
  font-size: 12px;
}
</style>
