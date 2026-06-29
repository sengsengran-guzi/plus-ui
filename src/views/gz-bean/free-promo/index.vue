<template>
  <div class="p-2">
    <el-card v-loading="listLoading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzBeanFreePromo.title') }}</span>
          <span class="ticket-tag">GZ-BEAN-027</span>
        </div>
      </template>

      <el-alert
        :title="t('gzBeanFreePromo.alertTitle')"
        type="info"
        :description="t('gzBeanFreePromo.alertDesc')"
        show-icon
        :closable="false"
        class="mb-3"
      />

      <el-row :gutter="10" class="mb-2">
        <el-col :span="1.5">
          <el-button v-hasPermi="['gz:bean:promo:add']" type="primary" plain :icon="Plus" @click="handleAdd">
            {{ t('gzBeanFreePromo.add') }}
          </el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button :icon="Refresh" @click="loadList">{{ t('gzBeanFreePromo.refresh') }}</el-button>
        </el-col>
      </el-row>

      <el-table v-loading="listLoading" :data="rows" border stripe size="small">
        <el-table-column :label="t('gzBeanFreePromo.colStore')" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.storeName || row.storeId }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanFreePromo.colPeriod')" width="150" align="center">
          <template #default="{ row }">
            <el-tag size="small">{{ periodLabel(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanFreePromo.colFreeCount')" prop="freeCount" width="110" align="center" />
        <el-table-column :label="t('gzBeanFreePromo.colWindow')" min-width="200" align="center">
          <template #default="{ row }">{{ windowLabel(row) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanFreePromo.colEnabled')" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled === 1 ? 'success' : 'info'" size="small">
              {{ row.enabled === 1 ? t('gzBeanFreePromo.enabledYes') : t('gzBeanFreePromo.enabledNo') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanFreePromo.colCreateTime')" prop="createTime" width="170" />
        <el-table-column :label="t('gzBeanFreePromo.colAction')" fixed="right" width="150" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:bean:promo:edit']" type="success" link size="small" @click="handleEdit(row)">
              {{ t('gzBeanFreePromo.edit') }}
            </el-button>
            <el-button v-hasPermi="['gz:bean:promo:remove']" type="danger" link size="small" @click="handleDel(row)">
              {{ t('gzBeanFreePromo.del') }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="t('gzBeanFreePromo.empty')" />
        </template>
      </el-table>

      <pagination v-show="total > 0" v-model:limit="query.pageSize" v-model:page="query.pageNum" :total="total" @pagination="loadList" />
    </el-card>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="formTitle" width="560px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="130px">
        <el-form-item :label="t('gzBeanFreePromo.colStore')" prop="storeId">
          <el-select
            v-model="form.storeId"
            filterable
            :disabled="formMode === 'edit'"
            :placeholder="t('gzBeanFreePromo.storePlaceholder')"
            style="width: 100%"
          >
            <el-option v-for="s in storeOptions" :key="s.id" :label="`${s.storeNo} · ${s.name}`" :value="s.id" />
          </el-select>
          <span v-if="formMode === 'edit'" class="form-hint">{{ t('gzBeanFreePromo.storeEditHint') }}</span>
        </el-form-item>

        <el-form-item :label="t('gzBeanFreePromo.colPeriodType')" prop="periodType">
          <el-select v-model="form.periodType" style="width: 220px">
            <el-option :label="t('gzBeanFreePromo.periodDay')" value="day" />
            <el-option :label="t('gzBeanFreePromo.periodWeek')" value="week" />
            <el-option :label="t('gzBeanFreePromo.periodDays')" value="days" />
          </el-select>
        </el-form-item>

        <template v-if="form.periodType === 'days'">
          <el-form-item :label="t('gzBeanFreePromo.colPeriodDays')" prop="periodDays">
            <el-input-number v-model="form.periodDays" :min="1" :max="365" />
            <span class="form-hint">{{ t('gzBeanFreePromo.periodDaysHint') }}</span>
          </el-form-item>
          <el-form-item :label="t('gzBeanFreePromo.colAnchorDate')" prop="anchorDate">
            <el-date-picker
              v-model="form.anchorDate"
              type="date"
              value-format="YYYY-MM-DD"
              :placeholder="t('gzBeanFreePromo.anchorDatePlaceholder')"
              style="width: 220px"
            />
            <span class="form-hint">{{ t('gzBeanFreePromo.anchorDateHint') }}</span>
          </el-form-item>
        </template>

        <el-form-item :label="t('gzBeanFreePromo.colFreeCount')" prop="freeCount">
          <el-input-number v-model="form.freeCount" :min="0" :max="99999" />
          <span class="form-hint">{{ t('gzBeanFreePromo.freeCountHint') }}</span>
        </el-form-item>

        <el-form-item :label="t('gzBeanFreePromo.colWindow')">
          <el-date-picker
            v-model="windowRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            :start-placeholder="t('gzBeanFreePromo.windowStart')"
            :end-placeholder="t('gzBeanFreePromo.windowEnd')"
            :range-separator="t('gzBeanFreePromo.windowTo')"
            style="width: 280px"
          />
          <span class="form-hint">{{ t('gzBeanFreePromo.windowHint') }}</span>
        </el-form-item>

        <el-form-item :label="t('gzBeanFreePromo.colEnabled')">
          <el-switch
            :model-value="form.enabled === 1"
            :active-value="true"
            :inactive-value="false"
            @update:model-value="(v: boolean) => (form.enabled = v ? 1 : 0)"
          />
        </el-form-item>

        <el-form-item :label="t('gzBeanFreePromo.colRemark')">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('gzBeanFreePromo.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('gzBeanFreePromo.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzBeanFreePromo">
import { ref, reactive, computed, onMounted } from 'vue';
import { Plus, Refresh } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { getGzBeanStoreOptions, type GzBeanStoreVO } from '@/api/gz-bean/store';
import {
  listGzBeanFreePromo,
  addGzBeanFreePromo,
  updateGzBeanFreePromo,
  delGzBeanFreePromo,
  type GzBeanFreePromoVO,
  type GzBeanFreePromoForm
} from '@/api/gz-bean/freePromo';

const { t } = useI18n();

const listLoading = ref(false);
const submitting = ref(false);

const storeOptions = ref<GzBeanStoreVO[]>([]);
const rows = ref<GzBeanFreePromoVO[]>([]);
const total = ref(0);

const query = reactive<{ pageNum: number; pageSize: number }>({ pageNum: 1, pageSize: 10 });

// ============ 表单 ============
interface FormState {
  id: number | string | null;
  storeId: number | null;
  periodType: string;
  periodDays: number;
  anchorDate: string | null;
  freeCount: number;
  enabled: number;
  remark: string;
}
const formVisible = ref(false);
const formMode = ref<'add' | 'edit'>('add');
const formRef = ref<FormInstance>();
const form = reactive<FormState>({
  id: null,
  storeId: null,
  periodType: 'day',
  periodDays: 1,
  anchorDate: null,
  freeCount: 0,
  enabled: 0,
  remark: ''
});
// 窗口起止用 daterange 双向绑定（拆回 startDate/endDate 提交）
const windowRange = ref<[string, string] | null>(null);

const formTitle = computed(() => (formMode.value === 'add' ? t('gzBeanFreePromo.addTitle') : t('gzBeanFreePromo.editTitle')));

const rules = {
  storeId: [{ required: true, message: t('gzBeanFreePromo.ruleStoreRequired'), trigger: 'change' }],
  periodType: [{ required: true, message: t('gzBeanFreePromo.rulePeriodTypeRequired'), trigger: 'change' }],
  freeCount: [{ required: true, message: t('gzBeanFreePromo.ruleFreeCountRequired'), trigger: 'change' }],
  periodDays: [
    {
      validator: (_r: unknown, _v: number, cb: (e?: Error) => void) => {
        if (form.periodType === 'days' && (!form.periodDays || form.periodDays < 1)) {
          cb(new Error(t('gzBeanFreePromo.rulePeriodDaysRequired')));
        } else {
          cb();
        }
      },
      trigger: 'change'
    }
  ],
  anchorDate: [
    {
      validator: (_r: unknown, _v: string, cb: (e?: Error) => void) => {
        if (form.periodType === 'days' && !form.anchorDate) {
          cb(new Error(t('gzBeanFreePromo.ruleAnchorDateRequired')));
        } else {
          cb();
        }
      },
      trigger: 'change'
    }
  ]
};

// ============ helpers ============
function periodLabel(row: GzBeanFreePromoVO): string {
  if (row.periodType === 'day') return t('gzBeanFreePromo.periodDay');
  if (row.periodType === 'week') return t('gzBeanFreePromo.periodWeek');
  return t('gzBeanFreePromo.periodDaysN', { n: row.periodDays || 0 });
}

function windowLabel(row: GzBeanFreePromoVO): string {
  if (!row.startDate && !row.endDate) return t('gzBeanFreePromo.windowUnlimited');
  return `${row.startDate || '—'} ~ ${row.endDate || '—'}`;
}

// ============ 列表 ============
async function loadStoreOptions() {
  try {
    const resp = await getGzBeanStoreOptions();
    const r = resp as any;
    storeOptions.value = (r.data || r || []) as GzBeanStoreVO[];
  } catch (e) {
    console.error('[gz-bean-free-promo] loadStoreOptions failed', e);
  }
}

async function loadList() {
  listLoading.value = true;
  try {
    const resp = await listGzBeanFreePromo(query);
    rows.value = (resp as any).rows || [];
    total.value = (resp as any).total || 0;
  } catch (e) {
    console.error('[gz-bean-free-promo] loadList failed', e);
    ElMessage.error(t('gzBeanFreePromo.loadFailed'));
  } finally {
    listLoading.value = false;
  }
}

// ============ 增改 ============
function handleAdd() {
  formMode.value = 'add';
  Object.assign(form, {
    id: null,
    storeId: null,
    periodType: 'day',
    periodDays: 1,
    anchorDate: null,
    freeCount: 0,
    enabled: 0,
    remark: ''
  });
  windowRange.value = null;
  formVisible.value = true;
}

function handleEdit(row: GzBeanFreePromoVO) {
  formMode.value = 'edit';
  Object.assign(form, {
    id: row.id,
    storeId: Number(row.storeId),
    periodType: row.periodType,
    periodDays: row.periodDays || 1,
    anchorDate: row.anchorDate || null,
    freeCount: row.freeCount,
    enabled: row.enabled,
    remark: row.remark || ''
  });
  windowRange.value = row.startDate && row.endDate ? [row.startDate, row.endDate] : null;
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
    const payload: GzBeanFreePromoForm = {
      id: form.id,
      storeId: form.storeId,
      periodType: form.periodType,
      periodDays: form.periodType === 'days' ? form.periodDays : null,
      anchorDate: form.periodType === 'days' ? form.anchorDate : null,
      freeCount: form.freeCount,
      startDate: windowRange.value?.[0] || null,
      endDate: windowRange.value?.[1] || null,
      enabled: form.enabled,
      remark: form.remark || null
    };
    if (formMode.value === 'add') {
      await addGzBeanFreePromo(payload);
      ElMessage.success(t('gzBeanFreePromo.addSuccess'));
    } else {
      await updateGzBeanFreePromo(payload);
      ElMessage.success(t('gzBeanFreePromo.editSuccess'));
    }
    formVisible.value = false;
    await loadList();
  } catch (e) {
    console.error('[gz-bean-free-promo] submit failed', e);
  } finally {
    submitting.value = false;
  }
}

async function handleDel(row: GzBeanFreePromoVO) {
  try {
    await ElMessageBox.confirm(t('gzBeanFreePromo.delConfirm', { store: row.storeName || row.storeId }), t('gzBeanFreePromo.confirmTitle'), {
      type: 'warning'
    });
    await delGzBeanFreePromo(row.id);
    ElMessage.success(t('gzBeanFreePromo.delSuccess'));
    await loadList();
  } catch (e: any) {
    if (e !== 'cancel') console.error('[gz-bean-free-promo] del failed', e);
  }
}

onMounted(() => {
  loadStoreOptions();
  loadList();
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
