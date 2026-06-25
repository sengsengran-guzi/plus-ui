<template>
  <div class="p-2">
    <el-card v-loading="pageLoading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzBeanSeatTypeConfig.title') }}</span>
          <span class="ticket-tag">GZ-BEAN-020</span>
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
            <el-option v-for="s in storeOptions" :key="s.id" :label="`${s.storeNo} · ${s.name}`" :value="s.id" />
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
        <el-table-column :label="t('gzBeanSeatTypeConfig.colId')" prop="id" width="70" align="center" />
        <el-table-column :label="t('gzBeanSeatTypeConfig.colName')" prop="name" min-width="140" show-overflow-tooltip />
        <el-table-column :label="t('gzBeanSeatTypeConfig.colBookMode')" width="130" align="center">
          <template #default="{ row }">
            <el-tag :type="row.bookMode === 'seat' ? 'warning' : 'success'" size="small">
              {{ row.bookMode === 'seat' ? t('gzBeanSeatTypeConfig.bookModeSeat') : t('gzBeanSeatTypeConfig.bookModeWhole') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeatTypeConfig.colCapacity')" prop="capacity" width="100" align="center" />
        <el-table-column :label="t('gzBeanSeatTypeConfig.colQuantity')" prop="quantity" width="90" align="center" />
        <el-table-column :label="t('gzBeanSeatTypeConfig.colPriceYuan')" width="120" align="right">
          <template #default="{ row }">¥{{ formatYuan(row.priceCent) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeatTypeConfig.colEnabled')" width="80" align="center">
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
        <el-table-column :label="t('gzBeanSeatTypeConfig.colSortNo')" prop="sortNo" width="70" align="center" />
        <el-table-column :label="t('gzBeanSeatTypeConfig.colAction')" fixed="right" width="200" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:bean:seatTypeConfig:edit']" type="primary" link size="small" @click="handleWeekdayPrice(row)">
              {{ t('gzBeanSeatTypeConfig.weekdayPrice') }}
            </el-button>
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
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item :label="t('gzBeanSeatTypeConfig.colName')" prop="name">
          <el-input v-model="form.name" maxlength="32" :placeholder="t('gzBeanSeatTypeConfig.namePlaceholder')" />
          <span class="form-hint">{{ t('gzBeanSeatTypeConfig.nameHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatTypeConfig.colBookMode')" prop="bookMode">
          <el-select v-model="form.bookMode" :placeholder="t('gzBeanSeatTypeConfig.bookModePlaceholder')" style="width: 100%">
            <el-option :label="t('gzBeanSeatTypeConfig.bookModeWhole')" value="whole" />
            <el-option :label="t('gzBeanSeatTypeConfig.bookModeSeat')" value="seat" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatTypeConfig.colCapacity')" prop="capacity">
          <el-input-number v-model="form.capacity" :min="1" :max="99" />
          <span class="form-hint">{{ t('gzBeanSeatTypeConfig.capacityHint') }}</span>
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

    <!-- 按星期价格弹窗 -->
    <el-dialog v-model="wpVisible" :title="t('gzBeanSeatTypeConfig.weekdayPriceTitle', { name: wpName })" width="460px">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="mb-3"
        :description="t('gzBeanSeatTypeConfig.weekdayPriceDesc', { base: formatYuan(wpBaseCent) })"
      />
      <el-form label-width="80px">
        <el-form-item v-for="d in weekdays" :key="d" :label="t('gzBeanSeatTypeConfig.week' + d)">
          <el-input-number
            v-model="wpPrices[d]"
            :min="0"
            :precision="2"
            :step="1"
            :placeholder="t('gzBeanSeatTypeConfig.weekdayBase') + ' ¥' + formatYuan(wpBaseCent)"
            controls-position="right"
            style="width: 180px"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="wpVisible = false">{{ t('gzBeanSeatTypeConfig.cancel') }}</el-button>
        <el-button type="primary" :loading="wpSubmitting" @click="handleWeekdayPriceSave">{{ t('gzBeanSeatTypeConfig.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzBeanSeatTypeConfig">
import { ref, reactive, computed, onMounted } from 'vue';
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
  getGzBeanWeekdayPrices,
  saveGzBeanWeekdayPrices,
  type GzBeanSeatTypeConfigVO,
  type GzBeanSeatTypeConfigForm
} from '@/api/gz-bean/seatTypeConfig';

const { t } = useI18n();

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
  name: string;
  bookMode: string;
  capacity: number;
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
  name: '',
  bookMode: 'whole',
  capacity: 1,
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
  name: [{ required: true, message: t('gzBeanSeatTypeConfig.ruleNameRequired'), trigger: 'blur' }],
  bookMode: [{ required: true, message: t('gzBeanSeatTypeConfig.ruleBookModeRequired'), trigger: 'change' }],
  capacity: [{ required: true, message: t('gzBeanSeatTypeConfig.ruleCapacityRequired'), trigger: 'change' }],
  quantity: [{ required: true, message: t('gzBeanSeatTypeConfig.ruleQuantityRequired'), trigger: 'change' }],
  priceYuan: [{ required: true, message: t('gzBeanSeatTypeConfig.rulePriceRequired'), trigger: 'change' }]
};

// ============ 按星期价格弹窗 ============
const weekdays = [1, 2, 3, 4, 5, 6, 7];
const wpVisible = ref(false);
const wpSubmitting = ref(false);
const wpConfigId = ref<number | null>(null);
const wpName = ref('');
const wpBaseCent = ref(0);
// weekday(1-7) → 元价（undefined = 用基础价）
const wpPrices = reactive<Record<number, number | undefined>>({});

// ============ helpers ============
function formatYuan(priceCent: number): string {
  return ((priceCent || 0) / 100).toFixed(2);
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
    name: '',
    bookMode: 'whole',
    capacity: 1,
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
    name: row.name,
    bookMode: row.bookMode,
    capacity: row.capacity,
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
      name: form.name,
      bookMode: form.bookMode,
      capacity: form.capacity,
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
      t('gzBeanSeatTypeConfig.delConfirm', { type: row.name }),
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

// ============ 按星期价格 ============
async function handleWeekdayPrice(row: GzBeanSeatTypeConfigVO) {
  wpConfigId.value = row.id;
  wpName.value = row.name;
  wpBaseCent.value = row.priceCent || 0;
  weekdays.forEach((d) => (wpPrices[d] = undefined));
  wpVisible.value = true;
  try {
    const resp = await getGzBeanWeekdayPrices(row.id);
    const r = resp as any;
    const rows = (r.data || r || []) as Array<{ weekday: number; priceCent: number }>;
    rows.forEach((p) => (wpPrices[p.weekday] = (p.priceCent || 0) / 100));
  } catch (e) {
    console.error('[gz-bean-seat-type-config] load weekday prices failed', e);
    ElMessage.error(t('gzBeanSeatTypeConfig.loadFailed'));
  }
}

async function handleWeekdayPriceSave() {
  if (!wpConfigId.value) return;
  wpSubmitting.value = true;
  try {
    const items = weekdays
      .filter((d) => wpPrices[d] !== undefined && wpPrices[d] !== null)
      .map((d) => ({ weekday: d, priceCent: Math.round((wpPrices[d] as number) * 100) }));
    await saveGzBeanWeekdayPrices(wpConfigId.value, { items });
    ElMessage.success(t('gzBeanSeatTypeConfig.weekdayPriceSaveSuccess'));
    wpVisible.value = false;
  } catch (e) {
    console.error('[gz-bean-seat-type-config] save weekday prices failed', e);
  } finally {
    wpSubmitting.value = false;
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
