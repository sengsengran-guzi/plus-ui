<template>
  <div class="p-2">
    <el-card v-loading="pageLoading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzRecyclePriceRule.title') }}</span>
          <span class="ticket-tag">GZ-RECYCLE-001</span>
        </div>
      </template>

      <el-alert type="info" :description="t('gzRecyclePriceRule.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 查询条 -->
      <el-form inline class="mb-2">
        <el-form-item :label="t('gzRecyclePriceRule.colCategory')">
          <el-select v-model="query.category" :placeholder="t('gzRecyclePriceRule.categoryPlaceholder')" clearable style="width: 160px">
            <el-option v-for="d in gz_recycle_category" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzRecyclePriceRule.colEnabled')">
          <el-select v-model="query.enabled" :placeholder="t('gzRecyclePriceRule.enabledPlaceholder')" clearable style="width: 120px">
            <el-option :label="t('gzRecyclePriceRule.enabledOn')" :value="1" />
            <el-option :label="t('gzRecyclePriceRule.enabledOff')" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadList">{{ t('gzRecyclePriceRule.search') }}</el-button>
          <el-button :icon="Refresh" @click="resetQuery">{{ t('gzRecyclePriceRule.reset') }}</el-button>
          <el-button v-hasPermi="['gz:recycle:priceRule:add']" type="success" plain :icon="Plus" @click="handleAdd">{{ t('gzRecyclePriceRule.add') }}</el-button>
          <el-button v-hasPermi="['gz:recycle:priceRule:estimate']" type="warning" plain :icon="Coin" @click="openEstimate">{{ t('gzRecyclePriceRule.estimateTry') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="listLoading" :data="list" border stripe size="small">
        <el-table-column :label="t('gzRecyclePriceRule.colCategory')" width="120">
          <template #default="{ row }"><dict-tag :options="gz_recycle_category" :value="row.category" /></template>
        </el-table-column>
        <el-table-column :label="t('gzRecyclePriceRule.colRange')" min-width="140">
          <template #default="{ row }">{{ rangeText(row) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzRecyclePriceRule.colUnitPrice')" width="130" align="right">
          <template #default="{ row }">¥{{ formatYuan(row.unitPriceCent) }}{{ t('gzRecyclePriceRule.perItem') }}</template>
        </el-table-column>
        <el-table-column :label="t('gzRecyclePriceRule.colDuration')" width="100" align="center">
          <template #default="{ row }">{{ row.durationMinutes }} {{ t('gzRecyclePriceRule.minutes') }}</template>
        </el-table-column>
        <el-table-column :label="t('gzRecyclePriceRule.colEnabled')" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled === 1 ? 'success' : 'info'">
              {{ row.enabled === 1 ? t('gzRecyclePriceRule.enabledOn') : t('gzRecyclePriceRule.enabledOff') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzRecyclePriceRule.colSortNo')" prop="sortNo" width="70" align="center" />
        <el-table-column :label="t('gzRecyclePriceRule.colAction')" fixed="right" width="220" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:recycle:priceRule:edit']" type="success" link size="small" @click="handleEdit(row)">{{ t('gzRecyclePriceRule.edit') }}</el-button>
            <el-button v-hasPermi="['gz:recycle:priceRule:edit']" :type="row.enabled === 1 ? 'warning' : 'primary'" link size="small" @click="handleToggle(row)">
              {{ row.enabled === 1 ? t('gzRecyclePriceRule.disable') : t('gzRecyclePriceRule.enable') }}
            </el-button>
            <el-button v-hasPermi="['gz:recycle:priceRule:remove']" type="danger" link size="small" @click="handleDel(row)">{{ t('gzRecyclePriceRule.del') }}</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('gzRecyclePriceRule.empty')" /></template>
      </el-table>

      <pagination v-show="total > 0" v-model:page="query.pageNum" v-model:limit="query.pageSize" :total="total" @pagination="loadList" />
    </el-card>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="formTitle" width="520px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item :label="t('gzRecyclePriceRule.fieldCategory')" prop="category">
          <el-select v-model="form.category" :disabled="!!form.id" style="width: 100%">
            <el-option v-for="d in gz_recycle_category" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzRecyclePriceRule.fieldQtyMin')" prop="qtyMin">
          <el-input-number v-model="form.qtyMin" :min="1" :max="999999" />
        </el-form-item>
        <el-form-item :label="t('gzRecyclePriceRule.fieldQtyMax')">
          <el-input-number v-model="form.qtyMax" :min="1" :max="999999" />
          <span class="form-hint">{{ t('gzRecyclePriceRule.qtyMaxHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzRecyclePriceRule.fieldUnitPrice')" prop="unitPriceYuan">
          <el-input-number v-model="form.unitPriceYuan" :min="0" :precision="2" :step="1" />
          <span class="form-hint">{{ t('gzRecyclePriceRule.unitPriceUnit') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzRecyclePriceRule.fieldDuration')" prop="durationMinutes">
          <el-input-number v-model="form.durationMinutes" :min="0" :max="999999" />
          <span class="form-hint">{{ t('gzRecyclePriceRule.minutes') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzRecyclePriceRule.fieldSortNo')">
          <el-input-number v-model="form.sortNo" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item :label="t('gzRecyclePriceRule.fieldEnabled')">
          <el-switch v-model="form.enabled" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item :label="t('gzRecyclePriceRule.fieldRemark')">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('gzRecyclePriceRule.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('gzRecyclePriceRule.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 估价试算弹窗（admin 调试 + 验证区间命中） -->
    <el-dialog v-model="estimateVisible" :title="t('gzRecyclePriceRule.estimateTitle')" width="460px" @close="resetEstimate">
      <el-form label-width="110px">
        <el-form-item :label="t('gzRecyclePriceRule.fieldCategory')">
          <el-select v-model="estimateForm.category" style="width: 100%">
            <el-option v-for="d in gz_recycle_category" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzRecyclePriceRule.estimateQty')">
          <el-input-number v-model="estimateForm.qty" :min="1" :max="999999" />
        </el-form-item>
      </el-form>
      <el-descriptions v-if="estimateResult" :column="1" border size="small" class="mt-2">
        <el-descriptions-item :label="t('gzRecyclePriceRule.colUnitPrice')">¥{{ formatYuan(estimateResult.unitPriceCent) }}{{ t('gzRecyclePriceRule.perItem') }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzRecyclePriceRule.estimateAmount')">¥{{ formatYuan(estimateResult.estimatedAmountCent) }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzRecyclePriceRule.colDuration')">{{ estimateResult.matchedDurationMinutes }} {{ t('gzRecyclePriceRule.minutes') }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="estimateVisible = false">{{ t('gzRecyclePriceRule.cancel') }}</el-button>
        <el-button type="primary" :loading="estimating" @click="doEstimate">{{ t('gzRecyclePriceRule.estimateRun') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzRecyclePriceRule">
import { ref, reactive, getCurrentInstance, type ComponentInternalInstance, toRefs, onMounted } from 'vue';
import { Plus, Refresh, Search, Coin } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { useI18n } from 'vue-i18n';
import {
  listGzRecyclePriceRule,
  getGzRecyclePriceRule,
  addGzRecyclePriceRule,
  updateGzRecyclePriceRule,
  delGzRecyclePriceRule,
  toggleGzRecyclePriceRule,
  estimateGzRecyclePriceRule,
  type GzRecyclePriceRuleVO,
  type GzRecyclePriceRuleQuery,
  type GzRecycleEstimateVO
} from '@/api/gz-recycle/priceRule';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;
// 回收品类字典（GZ-RECYCLE-001 seed gz_recycle_category）
const { gz_recycle_category } = toRefs<any>(proxy?.useDict('gz_recycle_category'));

const pageLoading = ref(false);
const listLoading = ref(false);
const submitting = ref(false);

const list = ref<GzRecyclePriceRuleVO[]>([]);
const total = ref(0);
const query = reactive<GzRecyclePriceRuleQuery>({ category: '', enabled: null, pageNum: 1, pageSize: 10 });

// 表单 state（unitPriceYuan 元↔分换算；qtyMax 留空 = 无上界）
interface PriceRuleFormState {
  id: string | null;
  category: string;
  qtyMin: number | null;
  qtyMax: number | null;
  unitPriceYuan: number | null;
  durationMinutes: number | null;
  sortNo: number | null;
  enabled: number;
  remark: string | null;
}
const formRef = ref<FormInstance>();
const formVisible = ref(false);
const formTitle = ref('');
const form = reactive<PriceRuleFormState>(emptyForm());

function emptyForm(): PriceRuleFormState {
  return { id: null, category: '', qtyMin: 1, qtyMax: null, unitPriceYuan: 0, durationMinutes: 0, sortNo: 0, enabled: 1, remark: null };
}

const rules: FormRules = {
  category: [{ required: true, message: t('gzRecyclePriceRule.ruleCategory'), trigger: 'change' }],
  qtyMin: [{ required: true, message: t('gzRecyclePriceRule.ruleQtyMin'), trigger: 'blur' }],
  unitPriceYuan: [{ required: true, message: t('gzRecyclePriceRule.ruleUnitPrice'), trigger: 'blur' }],
  durationMinutes: [{ required: true, message: t('gzRecyclePriceRule.ruleDuration'), trigger: 'blur' }]
};

// 估价试算
const estimateVisible = ref(false);
const estimating = ref(false);
const estimateForm = reactive<{ category: string; qty: number }>({ category: '', qty: 1 });
const estimateResult = ref<GzRecycleEstimateVO | null>(null);

const formatYuan = (cent: number) => (cent / 100).toFixed(2);
const rangeText = (row: GzRecyclePriceRuleVO) =>
  row.qtyMax === null ? `${row.qtyMin} ${t('gzRecyclePriceRule.andAbove')}` : `${row.qtyMin} ~ ${row.qtyMax}`;

async function loadList() {
  listLoading.value = true;
  try {
    const res = await listGzRecyclePriceRule(query);
    list.value = res.rows;
    total.value = res.total;
  } finally {
    listLoading.value = false;
  }
}

function resetQuery() {
  query.category = '';
  query.enabled = null;
  query.pageNum = 1;
  loadList();
}

function handleAdd() {
  Object.assign(form, emptyForm());
  formTitle.value = t('gzRecyclePriceRule.addTitle');
  formVisible.value = true;
}

async function handleEdit(row: GzRecyclePriceRuleVO) {
  const { data } = await getGzRecyclePriceRule(row.id);
  Object.assign(form, {
    id: data.id,
    category: data.category,
    qtyMin: data.qtyMin,
    qtyMax: data.qtyMax,
    unitPriceYuan: data.unitPriceCent / 100,
    durationMinutes: data.durationMinutes,
    sortNo: data.sortNo,
    enabled: data.enabled,
    remark: data.remark ?? null
  });
  formTitle.value = t('gzRecyclePriceRule.editTitle');
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
      category: form.category,
      qtyMin: form.qtyMin,
      qtyMax: form.qtyMax,
      unitPriceCent: Math.round((form.unitPriceYuan || 0) * 100),
      durationMinutes: form.durationMinutes,
      sortNo: form.sortNo,
      enabled: form.enabled,
      remark: form.remark
    };
    if (form.id) {
      await updateGzRecyclePriceRule(payload);
      ElMessage.success(t('gzRecyclePriceRule.editOk'));
    } else {
      await addGzRecyclePriceRule(payload);
      ElMessage.success(t('gzRecyclePriceRule.addOk'));
    }
    formVisible.value = false;
    loadList();
  } finally {
    submitting.value = false;
  }
}

async function handleToggle(row: GzRecyclePriceRuleVO) {
  const next = row.enabled === 1 ? 0 : 1;
  await toggleGzRecyclePriceRule(row.id, next);
  ElMessage.success(t('gzRecyclePriceRule.toggleOk'));
  loadList();
}

async function handleDel(row: GzRecyclePriceRuleVO) {
  await ElMessageBox.confirm(t('gzRecyclePriceRule.delConfirm'), t('gzRecyclePriceRule.tip'), { type: 'warning' });
  await delGzRecyclePriceRule(row.id);
  ElMessage.success(t('gzRecyclePriceRule.delOk'));
  loadList();
}

function openEstimate() {
  estimateResult.value = null;
  estimateForm.category = '';
  estimateForm.qty = 1;
  estimateVisible.value = true;
}

function resetEstimate() {
  estimateResult.value = null;
}

async function doEstimate() {
  if (!estimateForm.category) {
    ElMessage.warning(t('gzRecyclePriceRule.ruleCategory'));
    return;
  }
  estimating.value = true;
  // 命中 0 / 多区间时后端返 R.fail，request 拦截器统一弹错；此处仅清空结果（非吞异常）
  estimateResult.value = null;
  try {
    const { data } = await estimateGzRecyclePriceRule(estimateForm.category, estimateForm.qty);
    estimateResult.value = data;
  } finally {
    estimating.value = false;
  }
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
</style>
