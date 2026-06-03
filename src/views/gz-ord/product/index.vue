<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzOrdProduct.title') }}</span>
          <span class="ticket-tag">GZ-ORD-101</span>
        </div>
      </template>

      <el-alert :title="t('gzOrdProduct.alertTitle')" type="info" :description="t('gzOrdProduct.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 查询表单 -->
      <el-form :model="query" inline @submit.prevent="handleQuery">
        <el-form-item :label="t('gzOrdProduct.colName')">
          <el-input v-model="query.name" :placeholder="t('gzOrdProduct.namePlaceholder')" clearable style="width: 200px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item :label="t('gzOrdProduct.ipTag')">
          <el-input v-model="query.ipTag" :placeholder="t('gzOrdProduct.ipTagPlaceholder')" clearable style="width: 160px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item :label="t('gzOrdProduct.status')">
          <el-select v-model="query.status" :placeholder="t('gzOrdProduct.statusPlaceholder')" clearable style="width: 160px">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleQuery">{{ t('gzOrdProduct.search') }}</el-button>
          <el-button :icon="Refresh" @click="handleReset">{{ t('gzOrdProduct.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 工具栏 -->
      <div class="mb-3">
        <el-button v-hasPermi="['gz:ord:product:add']" type="primary" :icon="Plus" @click="handleAdd">{{ t('gzOrdProduct.add') }}</el-button>
      </div>

      <!-- 列表 -->
      <el-table :data="rows" border>
        <el-table-column :label="t('gzOrdProduct.colName')" prop="name" min-width="180" show-overflow-tooltip />
        <el-table-column :label="t('gzOrdProduct.ipTag')" prop="ipTag" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.ipTag" size="small">{{ row.ipTag }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzOrdProduct.status')" prop="status" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzOrdProduct.colDeadline')" prop="deadlineTime" width="170" align="center" />
        <el-table-column :label="t('gzOrdProduct.colDelivery')" width="130" align="center">
          <template #default="{ row }">{{ row.deliveryDateText || row.deliveryDateExact || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzOrdProduct.colSales')" prop="salesCount" width="90" align="center" />
        <el-table-column :label="t('gzOrdProduct.colAction')" fixed="right" width="280" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:ord:product:edit']" type="primary" link size="small" @click="handleEdit(row)">{{ t('gzOrdProduct.edit') }}</el-button>
            <el-button
              v-if="row.status === 'off_shelf' || row.status === 'auto_off'"
              v-hasPermi="['gz:ord:product:changeStatus']"
              type="success"
              link
              size="small"
              @click="handleChangeStatus(row, 'on_shelf')"
            >
              {{ t('gzOrdProduct.onShelf') }}
            </el-button>
            <el-button v-if="row.status === 'on_shelf'" v-hasPermi="['gz:ord:product:changeStatus']" type="warning" link size="small" @click="handleChangeStatus(row, 'off_shelf')">
              {{ t('gzOrdProduct.offShelf') }}
            </el-button>
            <el-button v-hasPermi="['gz:ord:product:remove']" type="danger" link size="small" @click="handleDel(row)">{{ t('gzOrdProduct.del') }}</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('gzOrdProduct.empty')" /></template>
      </el-table>

      <pagination v-show="total > 0" v-model:limit="query.pageSize" v-model:page="query.pageNum" :total="total" @pagination="loadList" />
    </el-card>

    <!-- 新建 / 编辑弹窗（商品 + SKU 子表 + 富文本） -->
    <el-dialog v-model="formVisible" :title="formTitle" width="960px" top="4vh" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-row :gutter="16">
          <el-col :span="16">
            <el-form-item :label="t('gzOrdProduct.colName')" prop="name">
              <el-input v-model="form.name" maxlength="128" show-word-limit />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="t('gzOrdProduct.ipTag')">
              <el-input v-model="form.ipTag" maxlength="64" :placeholder="t('gzOrdProduct.ipTagPlaceholder')" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('gzOrdProduct.colDeadline')" prop="deadlineTime">
              <el-date-picker
                v-model="form.deadlineTime"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                :placeholder="t('gzOrdProduct.deadlinePlaceholder')"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzOrdProduct.colSort')">
              <el-input-number v-model="form.sortNo" :min="0" :max="9999" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 到货日二选一（F6.1）：切换模糊文案 / 精确日期 -->
        <el-form-item :label="t('gzOrdProduct.deliveryMode')">
          <el-radio-group v-model="deliveryMode" @change="onDeliveryModeChange">
            <el-radio value="text">{{ t('gzOrdProduct.deliveryText') }}</el-radio>
            <el-radio value="exact">{{ t('gzOrdProduct.deliveryExact') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="deliveryMode === 'text'" :label="t('gzOrdProduct.deliveryText')">
          <el-input v-model="form.deliveryDateText" maxlength="64" :placeholder="t('gzOrdProduct.deliveryTextPlaceholder')" />
        </el-form-item>
        <el-form-item v-else :label="t('gzOrdProduct.deliveryExact')">
          <el-date-picker v-model="form.deliveryDateExact" type="date" value-format="YYYY-MM-DD" :placeholder="t('gzOrdProduct.deliveryExactPlaceholder')" style="width: 220px" />
        </el-form-item>

        <el-form-item :label="t('gzOrdProduct.mainImage')">
          <el-input v-model="mainImageIdStr" :placeholder="t('gzOrdProduct.mainImagePlaceholder')" />
        </el-form-item>

        <!-- SKU 子表（可编辑行；price 元↔分） -->
        <el-form-item :label="t('gzOrdProduct.skuList')" prop="skuList">
          <div class="sku-block">
            <el-table :data="form.skuList" border size="small">
              <el-table-column :label="t('gzOrdProduct.skuSpec')" min-width="140">
                <template #default="{ row }"><el-input v-model="row.specName" maxlength="64" :placeholder="t('gzOrdProduct.skuSpecPlaceholder')" /></template>
              </el-table-column>
              <el-table-column :label="t('gzOrdProduct.skuPrice')" width="150">
                <template #default="{ row }">
                  <el-input-number v-model="row.priceYuan" :min="0" :precision="2" :step="1" controls-position="right" style="width: 130px" />
                </template>
              </el-table-column>
              <el-table-column :label="t('gzOrdProduct.skuStock')" width="150">
                <template #default="{ row }">
                  <el-input-number v-model="row.stockTotal" :min="0" :placeholder="t('gzOrdProduct.skuStockInfinite')" controls-position="right" style="width: 130px" />
                </template>
              </el-table-column>
              <el-table-column :label="t('gzOrdProduct.skuEnabled')" width="90" align="center">
                <template #default="{ row }"><el-switch :model-value="row.enabled === 1" @update:model-value="(v: boolean) => (row.enabled = v ? 1 : 0)" /></template>
              </el-table-column>
              <el-table-column :label="t('gzOrdProduct.skuSort')" width="110">
                <template #default="{ row }"><el-input-number v-model="row.sortNo" :min="0" :max="9999" controls-position="right" style="width: 90px" /></template>
              </el-table-column>
              <el-table-column :label="t('gzOrdProduct.colAction')" width="80" align="center">
                <template #default="{ $index }">
                  <el-button type="danger" link size="small" :disabled="form.skuList.length <= 1" @click="removeSku($index)">{{ t('gzOrdProduct.skuRemove') }}</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-button class="mt-2" type="primary" plain size="small" :icon="Plus" @click="addSku">{{ t('gzOrdProduct.skuAdd') }}</el-button>
            <div class="sku-hint">{{ t('gzOrdProduct.skuStockHint') }}</div>
          </div>
        </el-form-item>

        <el-form-item :label="t('gzOrdProduct.description')">
          <NewsEditor v-model="form.descriptionHtml" :height="360" usage-type="preorder_product_image" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('gzOrdProduct.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('gzOrdProduct.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzOrdProduct">
import { ref, reactive, computed } from 'vue';
import { Search, Refresh, Plus } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { useI18n } from 'vue-i18n';
import NewsEditor from '@/views/gz-news/article/components/NewsEditor.vue';
import {
  listGzOrdProduct,
  getGzOrdProduct,
  addGzOrdProduct,
  updateGzOrdProduct,
  changeStatusGzOrdProduct,
  delGzOrdProduct,
  type GzOrdProductVO,
  type GzOrdProductQuery
} from '@/api/gz-ord/product';

const { t } = useI18n();

const loading = ref(false);
const submitting = ref(false);
const rows = ref<GzOrdProductVO[]>([]);
const total = ref(0);

const query = reactive<GzOrdProductQuery>({ pageNum: 1, pageSize: 10 });

// 状态选项（doc/11 §6.1；auto_off 仅 cron 写，列表筛选可见但 admin 不可手动设）
const statusOptions = computed(() => [
  { value: 'on_shelf', label: t('gzOrdProduct.stOnShelf') },
  { value: 'off_shelf', label: t('gzOrdProduct.stOffShelf') },
  { value: 'auto_off', label: t('gzOrdProduct.stAutoOff') }
]);
function statusLabel(s: string) {
  return statusOptions.value.find((o) => o.value === s)?.label || s;
}
function statusTagType(s: string): 'success' | 'info' | 'warning' {
  const map: Record<string, 'success' | 'info' | 'warning'> = { on_shelf: 'success', off_shelf: 'info', auto_off: 'warning' };
  return map[s] || 'info';
}

// ---------------- 列表 ----------------
async function loadList() {
  loading.value = true;
  try {
    const resp = await listGzOrdProduct(query);
    rows.value = (resp as any).rows || [];
    total.value = (resp as any).total || 0;
  } catch (e) {
    console.error('[gz-ord-product] load failed', e);
    ElMessage.error(t('gzOrdProduct.loadFailed'));
  } finally {
    loading.value = false;
  }
}
function handleQuery() {
  query.pageNum = 1;
  loadList();
}
function handleReset() {
  query.name = undefined;
  query.ipTag = undefined;
  query.status = undefined;
  query.pageNum = 1;
  loadList();
}

// ---------------- SKU 行 viewmodel（priceYuan 元 ↔ priceCent 分） ----------------
interface SkuRow {
  id?: string | null;
  specName: string;
  /** 显示用：元（双向，提交时 *100 转分） */
  priceYuan: number;
  /** 库存（null/undefined = 无限） */
  stockTotal?: number | null;
  enabled: number;
  sortNo: number;
}

function newSkuRow(): SkuRow {
  return { id: null, specName: '', priceYuan: 0, stockTotal: undefined, enabled: 1, sortNo: 0 };
}

// ---------------- 新建 / 编辑 ----------------
const formVisible = ref(false);
const formMode = ref<'add' | 'edit'>('add');
const formRef = ref<FormInstance>();
const deliveryMode = ref<'text' | 'exact'>('text');

const form = reactive<{
  id?: string | null;
  name: string;
  ipTag?: string | null;
  mainImageId?: string | null;
  deadlineTime?: string;
  deliveryDateText?: string | null;
  deliveryDateExact?: string | null;
  sortNo: number;
  descriptionHtml: string;
  skuList: SkuRow[];
}>({
  name: '',
  sortNo: 0,
  descriptionHtml: '',
  skuList: [newSkuRow()]
});

// mainImageId string 双向（保持跨层 string 契约；空串视为 null）
const mainImageIdStr = computed({
  get: () => form.mainImageId ?? '',
  set: (v: string) => (form.mainImageId = v.trim() === '' ? null : v.trim())
});

const formTitle = computed(() => (formMode.value === 'add' ? t('gzOrdProduct.addDialogTitle') : t('gzOrdProduct.editDialogTitle')));

const rules = {
  name: [{ required: true, message: t('gzOrdProduct.ruleNameRequired'), trigger: 'blur' }],
  deadlineTime: [{ required: true, message: t('gzOrdProduct.ruleDeadlineRequired'), trigger: 'change' }]
};

function onDeliveryModeChange() {
  // 切换时清空另一字段（F6.1 二选一，避免两个都带值）
  if (deliveryMode.value === 'text') {
    form.deliveryDateExact = null;
  } else {
    form.deliveryDateText = null;
  }
}

function addSku() {
  form.skuList.push(newSkuRow());
}
function removeSku(index: number) {
  if (form.skuList.length <= 1) return;
  form.skuList.splice(index, 1);
}

function handleAdd() {
  formMode.value = 'add';
  resetForm();
  formVisible.value = true;
}
async function handleEdit(row: GzOrdProductVO) {
  formMode.value = 'edit';
  try {
    const resp = await getGzOrdProduct(row.id);
    const d = (resp as any).data as GzOrdProductVO;
    form.id = d.id;
    form.name = d.name;
    form.ipTag = d.ipTag;
    form.mainImageId = d.mainImageId ?? null;
    form.deadlineTime = d.deadlineTime;
    form.deliveryDateText = d.deliveryDateText ?? null;
    form.deliveryDateExact = d.deliveryDateExact ?? null;
    deliveryMode.value = d.deliveryDateExact ? 'exact' : 'text';
    form.sortNo = d.sortNo ?? 0;
    form.descriptionHtml = d.descriptionHtml || '';
    form.skuList = (d.skuList || []).map((s) => ({
      id: s.id,
      specName: s.specName,
      priceYuan: (s.priceCent ?? 0) / 100,
      stockTotal: s.stockTotal ?? undefined,
      enabled: s.enabled ?? 1,
      sortNo: s.sortNo ?? 0
    }));
    if (form.skuList.length === 0) form.skuList = [newSkuRow()];
    formVisible.value = true;
  } catch (e) {
    console.error('[gz-ord-product] detail failed', e);
    ElMessage.error(t('gzOrdProduct.detailFailed'));
  }
}
function resetForm() {
  formRef.value?.resetFields();
  form.id = null;
  form.name = '';
  form.ipTag = null;
  form.mainImageId = null;
  form.deadlineTime = undefined;
  form.deliveryDateText = null;
  form.deliveryDateExact = null;
  deliveryMode.value = 'text';
  form.sortNo = 0;
  form.descriptionHtml = '';
  form.skuList = [newSkuRow()];
}

function buildPayload() {
  // SKU 行 viewmodel → BO：priceYuan 元 → priceCent 分（四舍五入避免浮点误差）
  const skuList = form.skuList.map((s) => ({
    id: s.id ?? null,
    specName: s.specName,
    priceCent: Math.round((s.priceYuan ?? 0) * 100),
    // 空 / undefined → null（无限库存）
    stockTotal: s.stockTotal === undefined || s.stockTotal === null ? null : s.stockTotal,
    enabled: s.enabled,
    sortNo: s.sortNo
  }));
  return {
    id: form.id ?? null,
    name: form.name,
    ipTag: form.ipTag,
    mainImageId: form.mainImageId,
    deadlineTime: form.deadlineTime,
    // F6.1 二选一：按 deliveryMode 仅带一个
    deliveryDateText: deliveryMode.value === 'text' ? form.deliveryDateText : null,
    deliveryDateExact: deliveryMode.value === 'exact' ? form.deliveryDateExact : null,
    sortNo: form.sortNo,
    descriptionHtml: form.descriptionHtml,
    skuList
  };
}

function validateBeforeSubmit(): string | null {
  // 到货日二选一前端兜底（后端也校验 F6.1）
  if (deliveryMode.value === 'text' && !form.deliveryDateText) {
    return t('gzOrdProduct.ruleDeliveryTextRequired');
  }
  if (deliveryMode.value === 'exact' && !form.deliveryDateExact) {
    return t('gzOrdProduct.ruleDeliveryExactRequired');
  }
  // SKU 规格名非空
  if (form.skuList.some((s) => !s.specName || s.specName.trim() === '')) {
    return t('gzOrdProduct.ruleSkuSpecRequired');
  }
  return null;
}

async function handleSubmit() {
  await formRef.value?.validate(async (valid) => {
    if (!valid) return;
    const err = validateBeforeSubmit();
    if (err) {
      ElMessage.warning(err);
      return;
    }
    submitting.value = true;
    try {
      const payload = buildPayload();
      if (formMode.value === 'add') {
        await addGzOrdProduct(payload as any);
        ElMessage.success(t('gzOrdProduct.addSuccess'));
      } else {
        await updateGzOrdProduct(payload as any);
        ElMessage.success(t('gzOrdProduct.editSuccess'));
      }
      formVisible.value = false;
      loadList();
    } catch (e) {
      console.error('[gz-ord-product] submit failed', e);
    } finally {
      submitting.value = false;
    }
  });
}

// ---------------- 上下架 / 删除 ----------------
async function handleChangeStatus(row: GzOrdProductVO, target: string) {
  const confirmKey = target === 'on_shelf' ? 'onShelfConfirm' : 'offShelfConfirm';
  await ElMessageBox.confirm(t(`gzOrdProduct.${confirmKey}`, { name: row.name }), t('gzOrdProduct.confirmTitle'), { type: 'warning' });
  await changeStatusGzOrdProduct(row.id, target);
  ElMessage.success(t('gzOrdProduct.changeStatusSuccess'));
  loadList();
}
async function handleDel(row: GzOrdProductVO) {
  await ElMessageBox.confirm(t('gzOrdProduct.delConfirm', { name: row.name }), t('gzOrdProduct.confirmTitle'), { type: 'warning' });
  await delGzOrdProduct(row.id);
  ElMessage.success(t('gzOrdProduct.delSuccess'));
  loadList();
}

loadList();
</script>

<style scoped>
.ticket-tag {
  font-size: 12px;
  color: #909399;
}
.sku-block {
  width: 100%;
}
.sku-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}
</style>
