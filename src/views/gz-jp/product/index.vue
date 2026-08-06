<template>
  <div class="p-2">
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzJpProduct.title') }}</span>
          <span class="ticket-tag">GZ-JP-102</span>
        </div>
      </template>

      <el-alert type="info" :description="t('gzJpProduct.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 查询条 -->
      <el-form inline class="mb-2">
        <el-form-item :label="t('gzJpProduct.colEvent')">
          <el-select v-model="query.eventId" :placeholder="t('gzJpProduct.eventPlaceholder')" clearable filterable style="width: 240px">
            <el-option v-for="e in eventOptions" :key="e.id" :label="eventOptionLabel(e)" :value="e.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzJpProduct.colProductNo')">
          <el-input
            v-model="query.productNo"
            :placeholder="t('gzJpProduct.productNoPlaceholder')"
            clearable
            style="width: 190px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item :label="t('gzJpProduct.colName')">
          <el-input v-model="query.name" :placeholder="t('gzJpProduct.namePlaceholder')" clearable style="width: 180px" @keyup.enter="handleSearch" />
        </el-form-item>
        <el-form-item :label="t('gzJpProduct.colStatus')">
          <el-select v-model="query.status" :placeholder="t('gzJpProduct.statusPlaceholder')" clearable style="width: 130px">
            <el-option v-for="d in gz_jp_product_status" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">{{ t('gzJpProduct.search') }}</el-button>
          <el-button :icon="Refresh" @click="resetQuery">{{ t('gzJpProduct.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 批量操作条 -->
      <div class="mb-2">
        <el-button v-hasPermi="['gz:jp:product:add']" type="success" plain :icon="Plus" @click="handleAdd">
          {{ t('gzJpProduct.add') }}
        </el-button>
        <el-button
          v-hasPermi="['gz:jp:product:edit']"
          type="primary"
          plain
          :disabled="selectedIds.length === 0"
          @click="handleBatchStatus('on_shelf')"
        >
          {{ t('gzJpProduct.batchOnShelf') }}
        </el-button>
        <el-button
          v-hasPermi="['gz:jp:product:edit']"
          type="warning"
          plain
          :disabled="selectedIds.length === 0"
          @click="handleBatchStatus('off_shelf')"
        >
          {{ t('gzJpProduct.batchOffShelf') }}
        </el-button>
        <span v-if="selectedIds.length > 0" class="selected-hint">{{ t('gzJpProduct.selectedHint', { n: selectedIds.length }) }}</span>
      </div>

      <el-table v-loading="listLoading" :data="list" border stripe size="small" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="46" align="center" />
        <el-table-column :label="t('gzJpProduct.colProductNo')" prop="productNo" width="175" show-overflow-tooltip />
        <el-table-column :label="t('gzJpProduct.colMainImage')" width="80" align="center">
          <template #default="{ row }">
            <GzImageThumb :file-id="row.mainImageId" :size="48" />
          </template>
        </el-table-column>
        <el-table-column :label="t('gzJpProduct.colName')" prop="name" min-width="170" show-overflow-tooltip />
        <el-table-column :label="t('gzJpProduct.colEvent')" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.eventName">{{ row.eventName }}</span>
            <el-text v-else type="danger" size="small">{{ t('gzJpProduct.eventMissing') }}</el-text>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzJpProduct.colPrice')" width="110" align="right">
          <template #default="{ row }">¥{{ centToYuanText(row.priceCent) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzJpProduct.colDeliveryDate')" prop="deliveryDateText" width="120" show-overflow-tooltip />
        <el-table-column :label="t('gzJpProduct.colStatus')" width="132" align="center">
          <template #default="{ row }">
            <dict-tag :options="gz_jp_product_status" :value="row.status" />
            <el-tooltip v-if="row.status === 'on_shelf' && !row.visibleToCustomer" :content="t('gzJpProduct.notVisibleHint')">
              <el-icon class="warn-icon"><WarningFilled /></el-icon>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzJpProduct.colSortNo')" prop="sortNo" width="70" align="center" />
        <el-table-column :label="t('gzJpProduct.colAction')" fixed="right" width="180" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:jp:product:list']" type="info" link size="small" @click="handleDetail(row)">
              {{ t('gzJpProduct.detail') }}
            </el-button>
            <el-button v-hasPermi="['gz:jp:product:edit']" type="success" link size="small" @click="handleEdit(row)">
              {{ t('gzJpProduct.edit') }}
            </el-button>
            <el-button v-hasPermi="['gz:jp:product:remove']" type="danger" link size="small" @click="handleDel(row)">
              {{ t('gzJpProduct.del') }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('gzJpProduct.empty')" /></template>
      </el-table>

      <pagination v-show="total > 0" v-model:page="query.pageNum" v-model:limit="query.pageSize" :total="total" @pagination="loadList" />
    </el-card>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="formTitle" width="680px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item :label="t('gzJpProduct.fieldEvent')" prop="eventId">
          <el-select v-model="form.eventId" :placeholder="t('gzJpProduct.eventPlaceholder')" filterable style="width: 100%">
            <el-option v-for="e in eventOptions" :key="e.id" :label="eventOptionLabel(e)" :value="e.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzJpProduct.fieldName')" prop="name">
          <el-input v-model="form.name" maxlength="128" show-word-limit :placeholder="t('gzJpProduct.namePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('gzJpProduct.fieldMainImage')" prop="mainImageId">
          <GzImageUpload v-model="form.mainImageId" :usage-type="GZ_FILE_USAGE_TYPE.JP_PRODUCT_IMAGE" />
        </el-form-item>
        <el-form-item :label="t('gzJpProduct.fieldGallery')">
          <div class="gallery-box">
            <div v-for="fid in form.galleryImageIds" :key="fid" class="gallery-item">
              <GzImageThumb :file-id="fid" :size="72" />
              <el-icon class="gallery-item__del" @click="removeGalleryImage(fid)"><Delete /></el-icon>
            </div>
            <GzImageUpload
              v-if="form.galleryImageIds.length < GALLERY_MAX"
              v-model="galleryPending"
              :usage-type="GZ_FILE_USAGE_TYPE.JP_PRODUCT_IMAGE"
            />
          </div>
          <div class="form-hint">{{ t('gzJpProduct.galleryHint', { n: GALLERY_MAX }) }}</div>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('gzJpProduct.fieldPrice')" prop="priceYuan" label-width="110px">
              <el-input-number v-model="form.priceYuan" :min="0.01" :max="999999.99" :precision="2" :step="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzJpProduct.fieldDeliveryDate')" label-width="110px">
              <el-input v-model="form.deliveryDateText" maxlength="64" :placeholder="t('gzJpProduct.deliveryDatePlaceholder')" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item :label="t('gzJpProduct.fieldNotice')">
          <el-input
            v-model="form.noticeText"
            type="textarea"
            :rows="3"
            maxlength="1024"
            show-word-limit
            :placeholder="t('gzJpProduct.noticePlaceholder')"
          />
          <div class="form-hint">{{ t('gzJpProduct.noticeHint') }}</div>
        </el-form-item>
        <el-form-item :label="t('gzJpProduct.fieldSortNo')">
          <el-input-number v-model="form.sortNo" :min="0" :max="9999" />
          <span class="form-hint">{{ t('gzJpProduct.sortNoHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzJpProduct.fieldRemark')">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="2"
            maxlength="500"
            show-word-limit
            :placeholder="t('gzJpProduct.remarkPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('gzJpProduct.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('gzJpProduct.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉（客人视角预览：主图 + 图集 + 价 + 到货 + 注意事项） -->
    <el-drawer v-model="detailVisible" :title="t('gzJpProduct.detailTitle')" size="520px">
      <el-descriptions v-if="detailRow" :column="1" border size="small">
        <el-descriptions-item :label="t('gzJpProduct.colProductNo')">{{ detailRow.productNo }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzJpProduct.colName')">{{ detailRow.name }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzJpProduct.colEvent')">{{ detailRow.eventName || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzJpProduct.colPrice')">¥{{ centToYuanText(detailRow.priceCent) }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzJpProduct.colDeliveryDate')">{{ detailRow.deliveryDateText || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzJpProduct.colStatus')">
          <dict-tag :options="gz_jp_product_status" :value="detailRow.status" />
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzJpProduct.colVisible')">
          <el-tag :type="detailRow.visibleToCustomer ? 'success' : 'info'" size="small">
            {{ detailRow.visibleToCustomer ? t('gzJpProduct.visibleYes') : t('gzJpProduct.visibleNo') }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzJpProduct.fieldMainImage')">
          <GzImageThumb :file-id="detailRow.mainImageId" :size="96" />
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzJpProduct.fieldGallery')">
          <div v-if="detailRow.galleryImageIds.length > 0" class="gallery-box">
            <GzImageThumb v-for="fid in detailRow.galleryImageIds" :key="fid" :file-id="fid" :size="72" />
          </div>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzJpProduct.fieldNotice')">
          <span class="notice-text">{{ detailRow.noticeText || '-' }}</span>
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzJpProduct.fieldRemark')">{{ detailRow.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>

<script setup lang="ts" name="GzJpProduct">
import { ref, reactive, watch, onMounted, getCurrentInstance, toRefs, type ComponentInternalInstance } from 'vue';
import { Delete, Plus, Refresh, Search, WarningFilled } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { useI18n } from 'vue-i18n';
import GzImageUpload from '@/components/GzImageUpload/index.vue';
import GzImageThumb from '@/components/GzImageThumb/index.vue';
import { GZ_FILE_USAGE_TYPE } from '@/api/gz-common/file';
import {
  listGzJpProduct,
  listGzJpEventOptions,
  getGzJpProduct,
  addGzJpProduct,
  updateGzJpProduct,
  changeGzJpProductStatus,
  delGzJpProduct,
  type GzJpProductVO,
  type GzJpProductQuery,
  type GzJpProductStatus,
  type GzJpEventOptionVO
} from '@/api/gz-jp/product';

/** 图集张数上限，与后端 GzJpProductServiceImpl.GALLERY_MAX 一致 */
const GALLERY_MAX = 9;

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { gz_jp_product_status } = toRefs<any>(proxy?.useDict('gz_jp_product_status'));

const listLoading = ref(false);
const submitting = ref(false);

const list = ref<GzJpProductVO[]>([]);
const total = ref(0);
const selectedIds = ref<string[]>([]);
const eventOptions = ref<GzJpEventOptionVO[]>([]);
const query = reactive<GzJpProductQuery>({ eventId: '', productNo: '', name: '', status: '', pageNum: 1, pageSize: 10 });

/** 场下拉标签：带生效状态后缀，避免店员把商品挂到已结束的场上 */
function eventOptionLabel(e: GzJpEventOptionVO): string {
  return `${e.name}（${t(`gzJpProduct.eventStatus.${e.status}`)}）`;
}

function centToYuanText(cent: number): string {
  return ((cent ?? 0) / 100).toFixed(2);
}

interface ProductFormState {
  id: string | null;
  eventId: string | null;
  name: string;
  mainImageId: string | null;
  galleryImageIds: string[];
  /** 表单用「元」，提交时换算成「分」（Math.round 避免浮点误差） */
  priceYuan: number | null;
  deliveryDateText: string | null;
  noticeText: string | null;
  sortNo: number | null;
  remark: string | null;
}

const formRef = ref<FormInstance>();
const formVisible = ref(false);
const formTitle = ref('');
const form = reactive<ProductFormState>(emptyForm());

/** GzImageUpload 单图 emit → 累加进图集数组（去重、限 GALLERY_MAX），随后清空待传槽复位上传按钮 */
const galleryPending = ref<string | null>(null);
watch(galleryPending, (v) => {
  if (v && !form.galleryImageIds.includes(v) && form.galleryImageIds.length < GALLERY_MAX) {
    form.galleryImageIds.push(v);
  }
  if (v) galleryPending.value = null;
});

function emptyForm(): ProductFormState {
  return {
    id: null,
    eventId: null,
    name: '',
    mainImageId: null,
    galleryImageIds: [],
    priceYuan: null,
    deliveryDateText: null,
    noticeText: null,
    sortNo: 0,
    remark: null
  };
}

const rules: FormRules = {
  eventId: [{ required: true, message: t('gzJpProduct.ruleEvent'), trigger: 'change' }],
  name: [{ required: true, message: t('gzJpProduct.ruleName'), trigger: 'blur' }],
  mainImageId: [{ required: true, message: t('gzJpProduct.ruleMainImage'), trigger: 'change' }],
  priceYuan: [{ required: true, message: t('gzJpProduct.rulePrice'), trigger: 'change' }]
};

async function loadEventOptions() {
  const res = await listGzJpEventOptions();
  eventOptions.value = res.data;
}

async function loadList() {
  listLoading.value = true;
  try {
    const res = await listGzJpProduct(query);
    list.value = res.rows;
    total.value = res.total;
  } finally {
    listLoading.value = false;
  }
}

function handleSelectionChange(rows: GzJpProductVO[]) {
  selectedIds.value = rows.map((r) => r.id);
}

function handleSearch() {
  query.pageNum = 1;
  loadList();
}

function resetQuery() {
  query.eventId = '';
  query.productNo = '';
  query.name = '';
  query.status = '';
  query.pageNum = 1;
  loadList();
}

function handleAdd() {
  Object.assign(form, emptyForm());
  // 当前正按某个场筛选时，新建默认落在该场（店员通常是「进场逐个上架」）
  form.eventId = query.eventId || null;
  formTitle.value = t('gzJpProduct.addTitle');
  formVisible.value = true;
}

async function handleEdit(row: GzJpProductVO) {
  const { data } = await getGzJpProduct(row.id);
  Object.assign(form, {
    id: data.id,
    eventId: data.eventId,
    name: data.name,
    mainImageId: data.mainImageId ? String(data.mainImageId) : null,
    galleryImageIds: [...(data.galleryImageIds ?? [])],
    priceYuan: data.priceCent / 100,
    deliveryDateText: data.deliveryDateText ?? null,
    noticeText: data.noticeText ?? null,
    sortNo: data.sortNo,
    remark: data.remark ?? null
  });
  formTitle.value = t('gzJpProduct.editTitle');
  formVisible.value = true;
}

function removeGalleryImage(id: string) {
  form.galleryImageIds = form.galleryImageIds.filter((x) => x !== id);
}

function resetForm() {
  formRef.value?.resetFields();
  galleryPending.value = null;
  Object.assign(form, emptyForm());
}

async function handleSubmit() {
  await formRef.value?.validate();
  submitting.value = true;
  try {
    const payload = {
      id: form.id,
      eventId: form.eventId,
      name: form.name,
      mainImageId: form.mainImageId,
      galleryImageIds: form.galleryImageIds,
      // 元 → 分（四舍五入避免浮点误差；后端只认整数分）
      priceCent: Math.round((form.priceYuan ?? 0) * 100),
      deliveryDateText: form.deliveryDateText,
      noticeText: form.noticeText,
      sortNo: form.sortNo,
      remark: form.remark
    };
    if (form.id) {
      await updateGzJpProduct(payload);
      ElMessage.success(t('gzJpProduct.editOk'));
    } else {
      await addGzJpProduct(payload);
      ElMessage.success(t('gzJpProduct.addOk'));
    }
    formVisible.value = false;
    loadList();
  } finally {
    submitting.value = false;
  }
}

async function handleBatchStatus(status: GzJpProductStatus) {
  const key = status === 'on_shelf' ? 'batchOnShelfConfirm' : 'batchOffShelfConfirm';
  await ElMessageBox.confirm(t(`gzJpProduct.${key}`, { n: selectedIds.value.length }), t('gzJpProduct.tip'), { type: 'warning' });
  const res = await changeGzJpProductStatus(selectedIds.value, status);
  ElMessage.success(t('gzJpProduct.batchOk', { n: res.data }));
  loadList();
}

const detailVisible = ref(false);
const detailRow = ref<GzJpProductVO | null>(null);

async function handleDetail(row: GzJpProductVO) {
  const { data } = await getGzJpProduct(row.id);
  detailRow.value = data;
  detailVisible.value = true;
}

async function handleDel(row: GzJpProductVO) {
  await ElMessageBox.confirm(t('gzJpProduct.delConfirm', { name: row.name }), t('gzJpProduct.tip'), { type: 'warning' });
  await delGzJpProduct(row.id);
  ElMessage.success(t('gzJpProduct.delOk'));
  loadList();
}

onMounted(() => {
  loadEventOptions();
  loadList();
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
  line-height: 1.6;
}
.selected-hint {
  margin-left: 10px;
  font-size: 12px;
  color: #909399;
}
.warn-icon {
  margin-left: 4px;
  color: var(--el-color-warning);
  vertical-align: middle;
}
.gallery-box {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-start;
}
.gallery-item {
  position: relative;
  line-height: 0;
}
.gallery-item__del {
  position: absolute;
  right: -6px;
  top: -6px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--el-color-danger);
  color: #fff;
  font-size: 11px;
  cursor: pointer;
}
.notice-text {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
