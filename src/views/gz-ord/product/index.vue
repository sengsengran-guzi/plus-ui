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
        <el-form-item :label="t('gzOrdProduct.colDeadline')">
          <el-date-picker
            v-model="deadlineRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            :start-placeholder="t('gzOrdProduct.deadlineStart')"
            :end-placeholder="t('gzOrdProduct.deadlineEnd')"
            style="width: 250px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleQuery">{{ t('gzOrdProduct.search') }}</el-button>
          <el-button :icon="Refresh" @click="handleReset">{{ t('gzOrdProduct.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 工具栏 -->
      <div class="mb-3 toolbar">
        <el-button v-hasPermi="['gz:ord:product:add']" type="primary" :icon="Plus" @click="handleAdd">{{ t('gzOrdProduct.add') }}</el-button>
        <el-dropdown v-hasPermi="['gz:ord:product:status']" :disabled="selectedIds.length === 0" @command="handleBatchStatus">
          <el-button :disabled="selectedIds.length === 0">
            {{ t('gzOrdProduct.batchOps') }}<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="on_shelf">{{ t('gzOrdProduct.batchOnShelf') }}</el-dropdown-item>
              <el-dropdown-item command="off_shelf">{{ t('gzOrdProduct.batchOffShelf') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button v-hasPermi="['gz:ord:product:import']" :icon="Top" @click="handleImport">{{ t('gzOrdProduct.import') }}</el-button>
        <el-button v-hasPermi="['gz:ord:product:export']" :icon="Download" @click="handleExport">{{ t('gzOrdProduct.export') }}</el-button>
      </div>

      <!-- 列表 -->
      <el-table :data="rows" border @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="48" align="center" />
        <el-table-column :label="t('gzOrdProduct.colImage')" width="80" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.mainImageUrl"
              :src="row.mainImageUrl"
              :preview-src-list="[row.mainImageUrl]"
              fit="cover"
              preview-teleported
              style="width: 48px; height: 48px; border-radius: 4px"
            />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzOrdProduct.colName')" prop="name" min-width="180" show-overflow-tooltip />
        <el-table-column :label="t('gzOrdProduct.ipTag')" prop="ipTag" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.ipTag" size="small">{{ row.ipTag }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzOrdProduct.colSku')" width="80" align="center">
          <template #default="{ row }">{{ row.skuCount ?? '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzOrdProduct.status')" prop="status" width="130" align="center">
          <template #default="{ row }">
            <!-- auto_off 态展示为禁用 switch + tag（AC 3，admin 不可手动切，决策 D5） -->
            <el-tag v-if="row.status === 'auto_off'" type="warning" size="small">{{ statusLabel(row.status) }}</el-tag>
            <el-switch
              v-else
              v-hasPermi="['gz:ord:product:changeStatus']"
              :model-value="row.status === 'on_shelf'"
              :active-text="t('gzOrdProduct.stOnShelf')"
              :inactive-text="t('gzOrdProduct.stOffShelf')"
              inline-prompt
              @change="(v: boolean) => handleSwitchStatus(row, v)"
            />
          </template>
        </el-table-column>
        <el-table-column :label="t('gzOrdProduct.colDeadline')" prop="deadlineTime" width="170" align="center" />
        <el-table-column :label="t('gzOrdProduct.colDelivery')" width="130" align="center">
          <template #default="{ row }">{{ row.deliveryDateText || row.deliveryDateExact || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzOrdProduct.colSales')" prop="salesCount" width="90" align="center" />
        <el-table-column :label="t('gzOrdProduct.colAction')" fixed="right" width="160" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:ord:product:edit']" type="primary" link size="small" @click="handleEdit(row)">{{ t('gzOrdProduct.edit') }}</el-button>
            <el-button v-if="row.status === 'auto_off'" v-hasPermi="['gz:ord:product:changeStatus']" type="success" link size="small" @click="handleChangeStatus(row, 'on_shelf')">
              {{ t('gzOrdProduct.onShelf') }}
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

        <el-form-item :label="t('gzOrdProduct.galleryImages')">
          <el-input v-model="galleryImageIdsStr" :placeholder="t('gzOrdProduct.galleryPlaceholder')" />
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

    <!-- Excel 导入弹窗（AC 8；行级校验全失败回滚，msg 含逐行错误） -->
    <el-dialog v-model="upload.open" :title="t('gzOrdProduct.importTitle')" width="420px" append-to-body>
      <el-upload
        ref="uploadRef"
        :limit="1"
        accept=".xlsx, .xls"
        :headers="upload.headers"
        :action="upload.url"
        :disabled="upload.isUploading"
        :on-progress="handleFileUploadProgress"
        :on-success="handleFileSuccess"
        :auto-upload="false"
        drag
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">{{ t('gzOrdProduct.uploadDrag') }}</div>
        <template #tip>
          <div class="text-center el-upload__tip">
            <span>{{ t('gzOrdProduct.uploadTip') }}</span>
            <el-link type="primary" :underline="false" style="font-size: 12px; vertical-align: baseline" @click="importTemplate">{{ t('gzOrdProduct.downloadTemplate') }}</el-link>
          </div>
        </template>
      </el-upload>
      <template #footer>
        <el-button @click="upload.open = false">{{ t('gzOrdProduct.cancel') }}</el-button>
        <el-button type="primary" @click="submitFileForm">{{ t('gzOrdProduct.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzOrdProduct">
import { ref, reactive, computed, getCurrentInstance, type ComponentInternalInstance } from 'vue';
import { Search, Refresh, Plus, ArrowDown, Top, Download, UploadFilled } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance, type UploadInstance, type UploadFile } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { globalHeaders } from '@/utils/request';
import NewsEditor from '@/views/gz-news/article/components/NewsEditor.vue';
import {
  listGzOrdProduct,
  getGzOrdProduct,
  addGzOrdProduct,
  updateGzOrdProduct,
  changeStatusGzOrdProduct,
  batchStatusGzOrdProduct,
  delGzOrdProduct,
  type GzOrdProductVO,
  type GzOrdProductQuery
} from '@/api/gz-ord/product';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const loading = ref(false);
const submitting = ref(false);
const rows = ref<GzOrdProductVO[]>([]);
const total = ref(0);

const query = reactive<GzOrdProductQuery>({ pageNum: 1, pageSize: 10 });

// 截止日范围 picker（[start, end] → query.deadlineStart/End）
const deadlineRange = ref<[string, string] | null>(null);

// 批量选中行 id
const selectedIds = ref<string[]>([]);
function handleSelectionChange(selection: GzOrdProductVO[]) {
  selectedIds.value = selection.map((r) => r.id);
}

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
  query.deadlineStart = deadlineRange.value?.[0] || undefined;
  query.deadlineEnd = deadlineRange.value?.[1] || undefined;
  query.pageNum = 1;
  loadList();
}
function handleReset() {
  query.name = undefined;
  query.ipTag = undefined;
  query.status = undefined;
  query.deadlineStart = undefined;
  query.deadlineEnd = undefined;
  deadlineRange.value = null;
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
  galleryImageIds?: string | null;
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

// galleryImageIds 逗号分隔 file_id 双向（空串视为 null）
const galleryImageIdsStr = computed({
  get: () => form.galleryImageIds ?? '',
  set: (v: string) => (form.galleryImageIds = v.trim() === '' ? null : v.trim())
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
    form.galleryImageIds = d.galleryImageIds ?? null;
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
  form.galleryImageIds = null;
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
    galleryImageIds: form.galleryImageIds,
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

// el-switch 切换状态（on_shelf ⇄ off_shelf；auto_off 态不渲染 switch）
async function handleSwitchStatus(row: GzOrdProductVO, on: boolean) {
  const target = on ? 'on_shelf' : 'off_shelf';
  try {
    await changeStatusGzOrdProduct(row.id, target);
    ElMessage.success(t('gzOrdProduct.changeStatusSuccess'));
  } catch (e) {
    console.error('[gz-ord-product] switch status failed', e);
  } finally {
    loadList();
  }
}

// ---------------- 批量上下架（AC 7；返回 success/skipped 汇总提示） ----------------
async function handleBatchStatus(target: string) {
  if (selectedIds.value.length === 0) return;
  const confirmKey = target === 'on_shelf' ? 'batchOnShelfConfirm' : 'batchOffShelfConfirm';
  await ElMessageBox.confirm(t(`gzOrdProduct.${confirmKey}`, { n: selectedIds.value.length }), t('gzOrdProduct.confirmTitle'), { type: 'warning' });
  const resp = await batchStatusGzOrdProduct(selectedIds.value, target);
  const result = (resp as any).data as { success: string[]; skipped: Array<{ id: string; reason: string }> };
  if (result.skipped.length === 0) {
    ElMessage.success(t('gzOrdProduct.batchAllOk', { n: result.success.length }));
  } else {
    const reasons = result.skipped.map((s) => `#${s.id}：${s.reason}`).join('；');
    ElMessageBox.alert(
      `<div style='max-height:60vh;overflow:auto'>${t('gzOrdProduct.batchPartial', { ok: result.success.length, skip: result.skipped.length })}<br/>${reasons}</div>`,
      t('gzOrdProduct.batchResultTitle'),
      { dangerouslyUseHTMLString: true }
    );
  }
  loadList();
}

// ---------------- Excel 导入 / 导出（AC 8） ----------------
const uploadRef = ref<UploadInstance>();
const upload = reactive({
  open: false,
  isUploading: false,
  headers: globalHeaders(),
  url: import.meta.env.VITE_APP_BASE_API + '/system/gz/ord/product/importData'
});
function handleImport() {
  upload.open = true;
}
function handleExport() {
  proxy?.download(
    'system/gz/ord/product/export',
    { ...query },
    `gz_ord_product_${new Date().getTime()}.xlsx`
  );
}
function importTemplate() {
  proxy?.download('system/gz/ord/product/importTemplate', {}, `gz_ord_product_template_${new Date().getTime()}.xlsx`);
}
function handleFileUploadProgress() {
  upload.isUploading = true;
}
function handleFileSuccess(response: any, file: UploadFile) {
  upload.open = false;
  upload.isUploading = false;
  uploadRef.value?.handleRemove(file);
  ElMessageBox.alert(
    `<div style='overflow:auto;max-height:70vh;padding:10px 20px 0'>${response.msg}</div>`,
    t('gzOrdProduct.importResultTitle'),
    { dangerouslyUseHTMLString: true }
  );
  loadList();
}
function submitFileForm() {
  uploadRef.value?.submit();
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
