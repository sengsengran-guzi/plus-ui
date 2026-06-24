<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzGachaProduct.title') }}</span>
          <span class="ticket-tag">GZ-GACHA-112</span>
        </div>
      </template>

      <el-alert :title="t('gzGachaProduct.alertTitle')" type="info" :description="t('gzGachaProduct.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 查询表单 -->
      <el-form :model="query" inline @submit.prevent="handleQuery">
        <el-form-item :label="t('gzGachaProduct.colName')">
          <el-input v-model="query.name" :placeholder="t('gzGachaProduct.namePlaceholder')" clearable style="width: 200px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item :label="t('gzGachaProduct.ipTag')">
          <el-input v-model="query.ipTag" :placeholder="t('gzGachaProduct.ipTagPlaceholder')" clearable style="width: 160px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item :label="t('gzGachaProduct.enabled')">
          <el-select v-model="query.enabled" :placeholder="t('gzGachaProduct.enabledPlaceholder')" clearable style="width: 130px">
            <el-option :label="t('gzGachaProduct.enabledYes')" :value="1" />
            <el-option :label="t('gzGachaProduct.enabledNo')" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleQuery">{{ t('gzGachaProduct.search') }}</el-button>
          <el-button :icon="Refresh" @click="handleReset">{{ t('gzGachaProduct.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 工具栏 -->
      <div class="mb-3">
        <el-button v-hasPermi="['gz:gacha:product:add']" type="primary" :icon="Plus" @click="handleAdd">{{ t('gzGachaProduct.add') }}</el-button>
      </div>

      <!-- 列表 -->
      <el-table :data="rows" border>
        <el-table-column :label="t('gzGachaProduct.colProductNo')" prop="productNo" width="180" show-overflow-tooltip />
        <el-table-column :label="t('gzGachaProduct.colImage')" width="90" align="center">
          <template #default="{ row }">
            <GzImageThumb :file-id="row.imageId" :size="48" />
          </template>
        </el-table-column>
        <el-table-column :label="t('gzGachaProduct.colName')" prop="name" min-width="160" show-overflow-tooltip />
        <el-table-column :label="t('gzGachaProduct.ipTag')" prop="ipTag" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.ipTag" size="small">{{ row.ipTag }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzGachaProduct.colRefValue')" width="110" align="center">
          <template #default="{ row }">{{ row.referenceValueCent != null ? centToYuan(row.referenceValueCent) : '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzGachaProduct.enabled')" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled === 1 ? 'success' : 'info'" size="small">{{
              row.enabled === 1 ? t('gzGachaProduct.enabledYes') : t('gzGachaProduct.enabledNo')
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzGachaProduct.colAction')" fixed="right" width="160" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:gacha:product:edit']" type="primary" link size="small" @click="handleEdit(row)">{{
              t('gzGachaProduct.edit')
            }}</el-button>
            <el-button v-hasPermi="['gz:gacha:product:remove']" type="danger" link size="small" @click="handleDel(row)">{{
              t('gzGachaProduct.del')
            }}</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('gzGachaProduct.empty')" /></template>
      </el-table>

      <pagination v-show="total > 0" v-model:limit="query.pageSize" v-model:page="query.pageNum" :total="total" @pagination="loadList" />
    </el-card>

    <!-- 新建 / 编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="formTitle" width="640px" top="6vh" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item :label="t('gzGachaProduct.colName')" prop="name">
          <el-input v-model="form.name" maxlength="128" show-word-limit />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('gzGachaProduct.ipTag')">
              <el-input v-model="form.ipTag" maxlength="64" :placeholder="t('gzGachaProduct.ipTagPlaceholder')" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzGachaProduct.refValueYuan')">
              <el-input-number
                v-model="form.refValueYuan"
                :min="0"
                :precision="2"
                :step="1"
                controls-position="right"
                style="width: 100%"
                :placeholder="t('gzGachaProduct.refValuePlaceholder')"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item :label="t('gzGachaProduct.image')">
          <GzImageUpload v-model="form.imageId" :usage-type="GZ_FILE_USAGE_TYPE.GACHA_PRIZE_IMAGE" />
        </el-form-item>
        <el-form-item :label="t('gzGachaProduct.enabled')">
          <el-switch :model-value="form.enabled === 1" @update:model-value="(v: boolean) => (form.enabled = v ? 1 : 0)" />
          <span class="hint ml-2">{{ t('gzGachaProduct.enabledSwitchHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzGachaProduct.remark')">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('gzGachaProduct.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('gzGachaProduct.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzGachaProduct">
import { ref, reactive, computed } from 'vue';
import { Search, Refresh, Plus } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { useI18n } from 'vue-i18n';
import {
  listGzGachaProduct,
  getGzGachaProduct,
  addGzGachaProduct,
  updateGzGachaProduct,
  delGzGachaProduct,
  type GzGachaProductVO,
  type GzGachaProductQuery
} from '@/api/gz-gacha/product';
import { GZ_FILE_USAGE_TYPE } from '@/api/gz-common/file';
import GzImageUpload from '@/components/GzImageUpload/index.vue';
import GzImageThumb from '@/components/GzImageThumb/index.vue';

const { t } = useI18n();

const loading = ref(false);
const submitting = ref(false);
const rows = ref<GzGachaProductVO[]>([]);
const total = ref(0);

const query = reactive<GzGachaProductQuery>({ pageNum: 1, pageSize: 10 });

function centToYuan(cent?: number | null) {
  if (cent == null) return '-';
  return '¥' + (cent / 100).toFixed(2);
}

// ---------------- 列表 ----------------
async function loadList() {
  loading.value = true;
  try {
    const resp = await listGzGachaProduct(query);
    rows.value = (resp as any).rows || [];
    total.value = (resp as any).total || 0;
  } catch (e) {
    console.error('[gz-gacha-product] load failed', e);
    ElMessage.error(t('gzGachaProduct.loadFailed'));
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
  query.enabled = undefined;
  query.pageNum = 1;
  loadList();
}

// ---------------- 新建 / 编辑 ----------------
const formVisible = ref(false);
const formMode = ref<'add' | 'edit'>('add');
const formRef = ref<FormInstance>();

const form = reactive<{
  id?: string | null;
  name: string;
  imageId?: string | null;
  /** 显示用：元（提交时 *100 转分，null = 不显示参考价） */
  refValueYuan?: number | null;
  ipTag?: string | null;
  enabled: number;
  remark?: string | null;
}>({
  name: '',
  imageId: null,
  refValueYuan: undefined,
  ipTag: null,
  enabled: 1,
  remark: ''
});

const formTitle = computed(() => (formMode.value === 'add' ? t('gzGachaProduct.addDialogTitle') : t('gzGachaProduct.editDialogTitle')));

const rules = {
  name: [{ required: true, message: t('gzGachaProduct.ruleNameRequired'), trigger: 'blur' }]
};

function handleAdd() {
  formMode.value = 'add';
  resetForm();
  formVisible.value = true;
}
async function handleEdit(row: GzGachaProductVO) {
  formMode.value = 'edit';
  try {
    const resp = await getGzGachaProduct(row.id);
    const d = resp.data as GzGachaProductVO;
    form.id = d.id;
    form.name = d.name;
    form.imageId = d.imageId ?? null;
    form.refValueYuan = d.referenceValueCent != null ? d.referenceValueCent / 100 : undefined;
    form.ipTag = d.ipTag ?? null;
    form.enabled = d.enabled ?? 1;
    form.remark = d.remark ?? '';
    formVisible.value = true;
  } catch (e) {
    console.error('[gz-gacha-product] detail failed', e);
    ElMessage.error(t('gzGachaProduct.detailFailed'));
  }
}
function resetForm() {
  formRef.value?.resetFields();
  form.id = null;
  form.name = '';
  form.imageId = null;
  form.refValueYuan = undefined;
  form.ipTag = null;
  form.enabled = 1;
  form.remark = '';
}

function buildPayload() {
  return {
    id: form.id ?? null,
    name: form.name,
    imageId: form.imageId,
    // 元 → 分（四舍五入避免浮点误差）；空 → null（不显示参考价）
    referenceValueCent: form.refValueYuan === undefined || form.refValueYuan === null ? null : Math.round(form.refValueYuan * 100),
    ipTag: form.ipTag,
    enabled: form.enabled,
    remark: form.remark
  };
}

async function handleSubmit() {
  await formRef.value?.validate(async (valid) => {
    if (!valid) return;
    submitting.value = true;
    try {
      const payload = buildPayload();
      if (formMode.value === 'add') {
        await addGzGachaProduct(payload);
        ElMessage.success(t('gzGachaProduct.addSuccess'));
      } else {
        await updateGzGachaProduct(payload);
        ElMessage.success(t('gzGachaProduct.editSuccess'));
      }
      formVisible.value = false;
      loadList();
    } catch (e) {
      console.error('[gz-gacha-product] submit failed', e);
    } finally {
      submitting.value = false;
    }
  });
}

// ---------------- 删除 ----------------
async function handleDel(row: GzGachaProductVO) {
  await ElMessageBox.confirm(t('gzGachaProduct.delConfirm', { name: row.name }), t('gzGachaProduct.confirmTitle'), { type: 'warning' });
  await delGzGachaProduct(row.id);
  ElMessage.success(t('gzGachaProduct.delSuccess'));
  loadList();
}

loadList();
</script>

<style scoped>
.ticket-tag {
  font-size: 12px;
  color: #909399;
}
.hint {
  font-size: 12px;
  color: #909399;
}
</style>
