<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">
            {{ t('gzGachaPrize.title') }}
            <el-tag v-if="machineName" type="primary" size="small" class="ml-2">{{ machineName }}</el-tag>
          </span>
          <span class="ticket-tag">GZ-GACHA-101</span>
        </div>
      </template>

      <el-alert :title="t('gzGachaPrize.alertTitle')" type="info" :description="t('gzGachaPrize.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 工具栏：返回机器列表 + 查询 + 新增 -->
      <el-form :model="query" inline @submit.prevent="handleQuery">
        <el-form-item>
          <el-button :icon="Back" @click="backToMachine">{{ t('gzGachaPrize.backToMachine') }}</el-button>
        </el-form-item>
        <el-form-item :label="t('gzGachaPrize.colName')">
          <el-input v-model="query.name" :placeholder="t('gzGachaPrize.namePlaceholder')" clearable style="width: 180px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item :label="t('gzGachaPrize.rarity')">
          <el-select v-model="query.rarity" :placeholder="t('gzGachaPrize.rarityPlaceholder')" clearable style="width: 120px">
            <el-option v-for="r in rarityOptions" :key="r.value" :label="r.label" :value="r.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzGachaPrize.enabled')">
          <el-select v-model="query.enabled" :placeholder="t('gzGachaPrize.enabledPlaceholder')" clearable style="width: 130px">
            <el-option :label="t('gzGachaPrize.enabledYes')" :value="1" />
            <el-option :label="t('gzGachaPrize.enabledNo')" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleQuery">{{ t('gzGachaPrize.search') }}</el-button>
          <el-button :icon="Refresh" @click="handleReset">{{ t('gzGachaPrize.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <div class="mb-3">
        <el-button v-hasPermi="['gz:gacha:prize:add']" type="primary" :icon="Plus" :disabled="!machineId" @click="handleAdd">{{ t('gzGachaPrize.add') }}</el-button>
        <span v-if="!machineId" class="hint ml-2">{{ t('gzGachaPrize.noMachineHint') }}</span>
      </div>

      <!-- 列表 -->
      <el-table :data="rows" border>
        <el-table-column :label="t('gzGachaPrize.colPrizeNo')" prop="prizeNo" width="160" show-overflow-tooltip />
        <el-table-column :label="t('gzGachaPrize.colName')" prop="name" min-width="160" show-overflow-tooltip />
        <el-table-column :label="t('gzGachaPrize.rarity')" prop="rarity" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="rarityTagType(row.rarity)" size="small" effect="dark">{{ row.rarity }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzGachaPrize.colWeight')" prop="weight" width="80" align="center" />
        <el-table-column :label="t('gzGachaPrize.colNormalizedPct')" width="130" align="center">
          <template #header>
            {{ t('gzGachaPrize.colNormalizedPct') }}
            <el-tooltip :content="t('gzGachaPrize.normalizedPctTip')" placement="top">
              <el-icon class="ml-1" style="vertical-align: middle"><QuestionFilled /></el-icon>
            </el-tooltip>
          </template>
          <template #default="{ row }">
            <span v-if="normalizedPercentOf(row) != null" class="normalized-pct">{{ normalizedPercentOf(row)!.toFixed(2) }}%</span>
            <el-tooltip v-else :content="t('gzGachaPrize.normalizedExcludedTip')" placement="top">
              <span class="normalized-dash">—</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzGachaPrize.colStockInitial')" prop="stockInitial" width="90" align="center" />
        <el-table-column :label="t('gzGachaPrize.colStockRemain')" prop="stockRemain" width="90" align="center" />
        <el-table-column :label="t('gzGachaPrize.colRefValue')" width="110" align="center">
          <template #default="{ row }">{{ row.referenceValueCent != null ? centToYuan(row.referenceValueCent) : '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzGachaPrize.enabled')" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled === 1 ? 'success' : 'info'" size="small">{{ row.enabled === 1 ? t('gzGachaPrize.enabledYes') : t('gzGachaPrize.enabledNo') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzGachaPrize.colAction')" fixed="right" width="160" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:gacha:prize:edit']" type="primary" link size="small" @click="handleEdit(row)">{{ t('gzGachaPrize.edit') }}</el-button>
            <el-button v-hasPermi="['gz:gacha:prize:remove']" type="danger" link size="small" @click="handleDel(row)">{{ t('gzGachaPrize.del') }}</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('gzGachaPrize.empty')" /></template>
      </el-table>

      <!-- 归一化基数行（AC 7）：仅统计可参与抽奖奖品（enabled=1 且 有库存） -->
      <div v-if="rows.length > 0" class="normalize-basis">
        {{ t('gzGachaPrize.normalizeBasis', { weightSum: normalizeSummary.weightSum, count: normalizeSummary.participatingCount }) }}
      </div>

      <pagination v-show="total > 0" v-model:limit="query.pageSize" v-model:page="query.pageNum" :total="total" @pagination="loadList" />
    </el-card>

    <!-- 新建 / 编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="formTitle" width="680px" top="6vh" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item :label="t('gzGachaPrize.colName')" prop="name">
          <el-input v-model="form.name" maxlength="128" show-word-limit />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('gzGachaPrize.rarity')" prop="rarity">
              <el-select v-model="form.rarity" :placeholder="t('gzGachaPrize.rarityPlaceholder')" style="width: 100%">
                <el-option v-for="r in rarityOptions" :key="r.value" :label="r.label" :value="r.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzGachaPrize.colWeight')" prop="weight">
              <el-input-number v-model="form.weight" :min="0" :max="999999" controls-position="right" style="width: 100%" />
              <div class="hint">{{ t('gzGachaPrize.weightHint') }}</div>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('gzGachaPrize.colStockInitial')" prop="stockInitial">
              <el-input-number v-model="form.stockInitial" :min="0" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzGachaPrize.colStockRemain')">
              <el-input-number v-model="form.stockRemain" :min="0" controls-position="right" style="width: 100%" :placeholder="t('gzGachaPrize.stockRemainPlaceholder')" />
              <div class="hint">{{ t('gzGachaPrize.stockRemainHint') }}</div>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('gzGachaPrize.refValueYuan')">
              <el-input-number v-model="form.refValueYuan" :min="0" :precision="2" :step="1" controls-position="right" style="width: 100%" :placeholder="t('gzGachaPrize.refValuePlaceholder')" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzGachaPrize.image')">
              <el-input v-model="imageIdStr" :placeholder="t('gzGachaPrize.imagePlaceholder')" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item :label="t('gzGachaPrize.enabled')">
          <el-switch :model-value="form.enabled === 1" @update:model-value="(v: boolean) => (form.enabled = v ? 1 : 0)" />
          <span class="hint ml-2">{{ t('gzGachaPrize.enabledSwitchHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzGachaPrize.remark')">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('gzGachaPrize.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('gzGachaPrize.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzGachaPrize">
import { ref, reactive, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Search, Refresh, Plus, Back, QuestionFilled } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { useI18n } from 'vue-i18n';
import {
  listGzGachaPrize,
  getGzGachaPrize,
  addGzGachaPrize,
  updateGzGachaPrize,
  delGzGachaPrize,
  type GzGachaPrizeVO,
  type GzGachaPrizeQuery
} from '@/api/gz-gacha/prize';
import { useNormalizedProbability } from '@/composables/useNormalizedProbability';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const loading = ref(false);
const submitting = ref(false);
const rows = ref<GzGachaPrizeVO[]>([]);
const total = ref(0);

// 从 query 取归属机器（机器列表「管理奖品池」跳入，AC 6）
const machineId = ref<string>((route.query.machineId as string) || '');
const machineName = ref<string>((route.query.machineName as string) || '');

const query = reactive<GzGachaPrizeQuery>({ pageNum: 1, pageSize: 10, machineId: machineId.value || undefined });

// 归一化预览（AC 6/7）：reactive 计算每行「归一化后概率%」+ 底部基数；
// 基数仅统计 enabled=1 且 stock_remain>0 的奖品（口径锚定 doc/11 §7.2 + doc/10 §8.N3）。
// weight / stock / enabled 改动 → loadList 刷新 rows → 全表归一化%即时重算（无需后端往返）。
const { summary: normalizeSummary, normalizedPercentOf } = useNormalizedProbability(rows);

// 稀有度 SSR/SR/R/N 四档（doc/11 §7.2 + 附录 A.10；与 gz_gacha_rarity 字典一致）
const rarityOptions = [
  { value: 'SSR', label: 'SSR' },
  { value: 'SR', label: 'SR' },
  { value: 'R', label: 'R' },
  { value: 'N', label: 'N' }
];
function rarityTagType(r: string): 'danger' | 'warning' | 'primary' | 'info' {
  const map: Record<string, 'danger' | 'warning' | 'primary' | 'info'> = { SSR: 'danger', SR: 'warning', R: 'primary', N: 'info' };
  return map[r] || 'info';
}
function centToYuan(cent?: number | null) {
  if (cent == null) return '-';
  return '¥' + (cent / 100).toFixed(2);
}

// route query 变化（从机器页带不同 machineId 进来）→ 重载
watch(
  () => route.query.machineId,
  (v) => {
    machineId.value = (v as string) || '';
    machineName.value = (route.query.machineName as string) || '';
    query.machineId = machineId.value || undefined;
    query.pageNum = 1;
    loadList();
  }
);

// ---------------- 列表 ----------------
async function loadList() {
  loading.value = true;
  try {
    const resp = await listGzGachaPrize(query);
    rows.value = (resp as any).rows || [];
    total.value = (resp as any).total || 0;
  } catch (e) {
    console.error('[gz-gacha-prize] load failed', e);
    ElMessage.error(t('gzGachaPrize.loadFailed'));
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
  query.rarity = undefined;
  query.enabled = undefined;
  query.pageNum = 1;
  loadList();
}
function backToMachine() {
  router.push({ path: '/gz/gz-gacha/machine' });
}

// ---------------- 新建 / 编辑 ----------------
const formVisible = ref(false);
const formMode = ref<'add' | 'edit'>('add');
const formRef = ref<FormInstance>();

const form = reactive<{
  id?: string | null;
  name: string;
  imageId?: string | null;
  rarity: string;
  weight: number;
  stockInitial: number;
  stockRemain?: number | null;
  /** 显示用：元（提交时 *100 转分，null = 不显示参考价） */
  refValueYuan?: number | null;
  enabled: number;
  remark?: string | null;
}>({
  name: '',
  rarity: 'N',
  weight: 1,
  stockInitial: 1,
  stockRemain: undefined,
  refValueYuan: undefined,
  enabled: 1,
  remark: ''
});

const imageIdStr = computed({
  get: () => form.imageId ?? '',
  set: (v: string) => (form.imageId = v.trim() === '' ? null : v.trim())
});

const formTitle = computed(() => (formMode.value === 'add' ? t('gzGachaPrize.addDialogTitle') : t('gzGachaPrize.editDialogTitle')));

const rules = {
  name: [{ required: true, message: t('gzGachaPrize.ruleNameRequired'), trigger: 'blur' }],
  rarity: [{ required: true, message: t('gzGachaPrize.ruleRarityRequired'), trigger: 'change' }],
  weight: [{ required: true, message: t('gzGachaPrize.ruleWeightRequired'), trigger: 'change' }],
  stockInitial: [{ required: true, message: t('gzGachaPrize.ruleStockInitialRequired'), trigger: 'change' }]
};

function handleAdd() {
  if (!machineId.value) {
    ElMessage.warning(t('gzGachaPrize.noMachineHint'));
    return;
  }
  formMode.value = 'add';
  resetForm();
  formVisible.value = true;
}
async function handleEdit(row: GzGachaPrizeVO) {
  formMode.value = 'edit';
  try {
    const resp = await getGzGachaPrize(row.id);
    const d = (resp as any).data as GzGachaPrizeVO;
    form.id = d.id;
    form.name = d.name;
    form.imageId = d.imageId ?? null;
    form.rarity = d.rarity;
    form.weight = d.weight ?? 0;
    form.stockInitial = d.stockInitial ?? 0;
    form.stockRemain = d.stockRemain ?? undefined;
    form.refValueYuan = d.referenceValueCent != null ? d.referenceValueCent / 100 : undefined;
    form.enabled = d.enabled ?? 1;
    form.remark = d.remark ?? '';
    formVisible.value = true;
  } catch (e) {
    console.error('[gz-gacha-prize] detail failed', e);
    ElMessage.error(t('gzGachaPrize.detailFailed'));
  }
}
function resetForm() {
  formRef.value?.resetFields();
  form.id = null;
  form.name = '';
  form.imageId = null;
  form.rarity = 'N';
  form.weight = 1;
  form.stockInitial = 1;
  form.stockRemain = undefined;
  form.refValueYuan = undefined;
  form.enabled = 1;
  form.remark = '';
}

function validateBeforeSubmit(): string | null {
  // 剩余库存 ≤ 初始库存前端兜底（后端 R2 也校验）
  if (form.stockRemain != null && form.stockRemain > form.stockInitial) {
    return t('gzGachaPrize.ruleRemainExceedsInitial');
  }
  return null;
}

function buildPayload() {
  return {
    id: form.id ?? null,
    // 新增必传归属机器；编辑后端忽略
    machineId: formMode.value === 'add' ? machineId.value : undefined,
    name: form.name,
    imageId: form.imageId,
    rarity: form.rarity,
    weight: form.weight,
    stockInitial: form.stockInitial,
    // 新增空 → 后端默认 = stockInitial；编辑空 → 不动
    stockRemain: form.stockRemain === undefined || form.stockRemain === null ? null : form.stockRemain,
    // 元 → 分（四舍五入）；空 → null（不显示参考价）
    referenceValueCent: form.refValueYuan === undefined || form.refValueYuan === null ? null : Math.round(form.refValueYuan * 100),
    enabled: form.enabled,
    remark: form.remark
  };
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
        await addGzGachaPrize(payload as any);
        ElMessage.success(t('gzGachaPrize.addSuccess'));
      } else {
        await updateGzGachaPrize(payload as any);
        ElMessage.success(t('gzGachaPrize.editSuccess'));
      }
      formVisible.value = false;
      loadList();
    } catch (e) {
      console.error('[gz-gacha-prize] submit failed', e);
    } finally {
      submitting.value = false;
    }
  });
}

// ---------------- 删除 ----------------
async function handleDel(row: GzGachaPrizeVO) {
  await ElMessageBox.confirm(t('gzGachaPrize.delConfirm', { name: row.name }), t('gzGachaPrize.confirmTitle'), { type: 'warning' });
  await delGzGachaPrize(row.id);
  ElMessage.success(t('gzGachaPrize.delSuccess'));
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
.normalized-pct {
  font-weight: 600;
  color: var(--el-color-primary);
}
.normalized-dash {
  color: #c0c4cc;
}
.normalize-basis {
  margin-top: 10px;
  padding: 8px 12px;
  font-size: 13px;
  color: #606266;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}
</style>
