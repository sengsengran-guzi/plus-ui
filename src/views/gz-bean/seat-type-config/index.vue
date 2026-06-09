<template>
  <div class="p-2">
    <el-card v-loading="pageLoading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzBeanSeatTypeConfig.title') }}</span>
          <span class="ticket-tag">GZ-BEAN-013</span>
        </div>
      </template>

      <el-alert
        :title="t('gzBeanSeatTypeConfig.alertTitle')"
        type="info"
        :description="t('gzBeanSeatTypeConfig.alertDesc')"
        show-icon
        :closable="false"
        class="mb-3"
      />

      <!-- 门店选择 -->
      <el-form inline class="mb-2">
        <el-form-item :label="t('gzBeanSeatTypeConfig.store')">
          <el-select v-model="currentStoreId" style="width: 240px" @change="onStoreChange">
            <el-option
              v-for="s in storeOptions"
              :key="s.id"
              :label="`${s.storeNo} · ${s.name}`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button
            v-hasPermi="['gz:bean:seatTypeConfig:add']"
            type="primary"
            plain
            :icon="Plus"
            :disabled="!currentStoreId"
            @click="handleAdd"
          >{{ t('gzBeanSeatTypeConfig.add') }}</el-button>
          <el-button :icon="Refresh" @click="loadList">{{ t('gzBeanSeatTypeConfig.refresh') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="listLoading" :data="list" border stripe size="small">
        <el-table-column :label="t('gzBeanSeatTypeConfig.colId')" prop="id" width="80" align="center" />
        <el-table-column :label="t('gzBeanSeatTypeConfig.colSeatType')" width="140">
          <template #default="{ row }">
            <dict-tag :options="gz_bean_seat_type" :value="row.seatType" />
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeatTypeConfig.colQuantity')" prop="quantity" width="120" align="center" />
        <el-table-column :label="t('gzBeanSeatTypeConfig.colPriceYuan')" width="120" align="right">
          <template #default="{ row }">¥{{ formatYuan(row.priceCent) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeatTypeConfig.colEnabled')" width="100" align="center">
          <template #default="{ row }">
            <el-switch
              v-hasPermi="['gz:bean:seatTypeConfig:edit']"
              :model-value="row.enabled === 1"
              :active-value="true"
              :inactive-value="false"
              @change="(v: boolean) => handleToggleEnabled(row, v ? 1 : 0)"
            />
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeatTypeConfig.colSortNo')" prop="sortNo" width="80" align="center" />
        <el-table-column :label="t('gzBeanSeatTypeConfig.colCreateTime')" prop="createTime" width="170" />
        <el-table-column :label="t('gzBeanSeatTypeConfig.colAction')" fixed="right" width="150" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:bean:seatTypeConfig:edit']" type="success" link size="small" @click="handleEdit(row)">
              {{ t('gzBeanSeatTypeConfig.edit') }}
            </el-button>
            <el-button v-hasPermi="['gz:bean:seatTypeConfig:remove']" type="danger" link size="small" @click="handleDel(row)">
              {{ t('gzBeanSeatTypeConfig.del') }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="t('gzBeanSeatTypeConfig.empty')" />
        </template>
      </el-table>
    </el-card>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="formTitle" width="520px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item :label="t('gzBeanSeatTypeConfig.colSeatType')" prop="seatType">
          <el-select
            v-model="form.seatType"
            :disabled="formMode === 'edit'"
            :placeholder="t('gzBeanSeatTypeConfig.seatTypePlaceholder')"
            style="width: 100%"
          >
            <el-option v-for="d in gz_bean_seat_type" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatTypeConfig.colQuantity')" prop="quantity">
          <el-input-number v-model="form.quantity" :min="0" :max="9999" />
          <span class="form-hint">{{ t('gzBeanSeatTypeConfig.quantityHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatTypeConfig.colPriceYuan')" prop="priceYuan">
          <el-input-number v-model="form.priceYuan" :min="0" :precision="2" :step="1" />
          <span class="form-hint">{{ t('gzBeanSeatTypeConfig.priceHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatTypeConfig.colEnabled')">
          <el-switch
            :model-value="form.enabled === 1"
            :active-value="true"
            :inactive-value="false"
            @update:model-value="(v: boolean) => (form.enabled = v ? 1 : 0)"
          />
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatTypeConfig.colSortNo')">
          <el-input-number v-model="form.sortNo" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatTypeConfig.colRemark')">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('gzBeanSeatTypeConfig.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('gzBeanSeatTypeConfig.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzBeanSeatTypeConfig">
import { ref, reactive, computed, getCurrentInstance, type ComponentInternalInstance, toRefs, onMounted } from 'vue';
import { Plus, Refresh } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { getGzBeanStoreOptions, type GzBeanStoreVO } from '@/api/gz-bean/store';
import {
  listGzBeanSeatTypeConfigByStore,
  addGzBeanSeatTypeConfig,
  updateGzBeanSeatTypeConfig,
  toggleGzBeanSeatTypeConfigEnabled,
  delGzBeanSeatTypeConfig,
  type GzBeanSeatTypeConfigVO,
  type GzBeanSeatTypeConfigForm
} from '@/api/gz-bean/seatTypeConfig';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;
// 座位类型字典（single/double/quad），GZ-BEAN-013 seed
const { gz_bean_seat_type } = toRefs<any>(proxy?.useDict('gz_bean_seat_type'));

const pageLoading = ref(false);
const listLoading = ref(false);
const submitting = ref(false);

const storeOptions = ref<GzBeanStoreVO[]>([]);
const currentStoreId = ref<number | null>(null);
const list = ref<GzBeanSeatTypeConfigVO[]>([]);

// ============ 表单（priceYuan 元，提交转 priceCent 分） ============
interface FormState {
  id: number | null;
  storeId: number | null;
  seatType: string;
  quantity: number;
  priceYuan: number;
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
  seatType: '',
  quantity: 0,
  priceYuan: 0,
  enabled: 1,
  sortNo: 0,
  remark: ''
});
const formTitle = computed(() =>
  formMode.value === 'add' ? t('gzBeanSeatTypeConfig.addTitle') : t('gzBeanSeatTypeConfig.editTitle')
);
const rules = {
  seatType: [{ required: true, message: t('gzBeanSeatTypeConfig.ruleSeatTypeRequired'), trigger: 'change' }],
  quantity: [{ required: true, message: t('gzBeanSeatTypeConfig.ruleQuantityRequired'), trigger: 'change' }],
  priceYuan: [{ required: true, message: t('gzBeanSeatTypeConfig.rulePriceRequired'), trigger: 'change' }]
};

// ============ helpers ============
function formatYuan(priceCent: number): string {
  return ((priceCent || 0) / 100).toFixed(2);
}

// 座位类型 value → 中文 label（前端字典翻译，后端不回填 seatTypeName）
function seatTypeLabel(value: string): string {
  const opts: any[] = (gz_bean_seat_type.value as any) || [];
  const hit = opts.find((d) => d.value === value);
  return hit ? hit.label : value;
}

// ============ 门店选项 ============
async function loadStoreOptions() {
  pageLoading.value = true;
  try {
    const resp = await getGzBeanStoreOptions();
    const r = resp as any;
    storeOptions.value = (r.data || r || []) as GzBeanStoreVO[];
    if (storeOptions.value.length > 0 && !currentStoreId.value) {
      currentStoreId.value = storeOptions.value[0].id;
      await loadList();
    }
  } catch (e) {
    console.error('[gz-bean-seat-type-config] loadStoreOptions failed', e);
    ElMessage.error(t('gzBeanSeatTypeConfig.loadFailed'));
  } finally {
    pageLoading.value = false;
  }
}

function onStoreChange(id: number) {
  currentStoreId.value = id;
  loadList();
}

// ============ 列表 ============
async function loadList() {
  if (!currentStoreId.value) return;
  listLoading.value = true;
  try {
    const resp = await listGzBeanSeatTypeConfigByStore(currentStoreId.value);
    const r = resp as any;
    list.value = (r.data || r || []) as GzBeanSeatTypeConfigVO[];
  } catch (e) {
    console.error('[gz-bean-seat-type-config] loadList failed', e);
    ElMessage.error(t('gzBeanSeatTypeConfig.loadFailed'));
  } finally {
    listLoading.value = false;
  }
}

// ============ 增改 ============
function handleAdd() {
  formMode.value = 'add';
  Object.assign(form, {
    id: null,
    storeId: currentStoreId.value,
    seatType: '',
    quantity: 0,
    priceYuan: 0,
    enabled: 1,
    sortNo: 0,
    remark: ''
  });
  formVisible.value = true;
}

function handleEdit(row: GzBeanSeatTypeConfigVO) {
  formMode.value = 'edit';
  Object.assign(form, {
    id: row.id,
    storeId: row.storeId,
    seatType: row.seatType,
    quantity: row.quantity,
    priceYuan: (row.priceCent || 0) / 100,
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
    const payload: GzBeanSeatTypeConfigForm = {
      id: form.id,
      storeId: form.storeId,
      seatType: form.seatType,
      quantity: form.quantity,
      priceCent: Math.round((form.priceYuan || 0) * 100),
      enabled: form.enabled,
      sortNo: form.sortNo,
      remark: form.remark
    };
    if (formMode.value === 'add') {
      await addGzBeanSeatTypeConfig(payload);
      ElMessage.success(t('gzBeanSeatTypeConfig.addSuccess'));
    } else {
      await updateGzBeanSeatTypeConfig(payload);
      ElMessage.success(t('gzBeanSeatTypeConfig.editSuccess'));
    }
    formVisible.value = false;
    await loadList();
  } catch (e) {
    console.error('[gz-bean-seat-type-config] submit failed', e);
  } finally {
    submitting.value = false;
  }
}

async function handleToggleEnabled(row: GzBeanSeatTypeConfigVO, enabled: number) {
  try {
    await toggleGzBeanSeatTypeConfigEnabled(row.id, enabled);
    ElMessage.success(t('gzBeanSeatTypeConfig.editSuccess'));
    await loadList();
  } catch (e) {
    console.error('[gz-bean-seat-type-config] toggle failed', e);
    await loadList(); // 失败回滚 switch 视图
  }
}

async function handleDel(row: GzBeanSeatTypeConfigVO) {
  try {
    await ElMessageBox.confirm(
      t('gzBeanSeatTypeConfig.delConfirm', { type: seatTypeLabel(row.seatType) }),
      t('gzBeanSeatTypeConfig.confirmTitle'),
      { type: 'warning' }
    );
    await delGzBeanSeatTypeConfig(row.id);
    ElMessage.success(t('gzBeanSeatTypeConfig.delSuccess'));
    await loadList();
  } catch (e: any) {
    if (e !== 'cancel') console.error('[gz-bean-seat-type-config] del failed', e);
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
