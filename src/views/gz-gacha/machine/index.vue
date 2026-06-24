<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzGachaMachine.title') }}</span>
          <span class="ticket-tag">GZ-GACHA-101</span>
        </div>
      </template>

      <el-alert
        :title="t('gzGachaMachine.alertTitle')"
        type="info"
        :description="t('gzGachaMachine.alertDesc')"
        show-icon
        :closable="false"
        class="mb-3"
      />

      <!-- 查询表单 -->
      <el-form :model="query" inline @submit.prevent="handleQuery">
        <el-form-item :label="t('gzGachaMachine.colName')">
          <el-input
            v-model="query.name"
            :placeholder="t('gzGachaMachine.namePlaceholder')"
            clearable
            style="width: 200px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item :label="t('gzGachaMachine.ipTag')">
          <el-input
            v-model="query.ipTag"
            :placeholder="t('gzGachaMachine.ipTagPlaceholder')"
            clearable
            style="width: 160px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item :label="t('gzGachaMachine.status')">
          <el-select v-model="query.status" :placeholder="t('gzGachaMachine.statusPlaceholder')" clearable style="width: 160px">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleQuery">{{ t('gzGachaMachine.search') }}</el-button>
          <el-button :icon="Refresh" @click="handleReset">{{ t('gzGachaMachine.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 工具栏 -->
      <div class="mb-3">
        <el-button v-hasPermi="['gz:gacha:machine:add']" type="primary" :icon="Plus" @click="handleAdd">{{ t('gzGachaMachine.add') }}</el-button>
      </div>

      <!-- 列表 -->
      <el-table :data="rows" border>
        <el-table-column :label="t('gzGachaMachine.colMachineNo')" prop="machineNo" width="160" show-overflow-tooltip />
        <el-table-column :label="t('gzGachaMachine.colName')" prop="name" min-width="160" show-overflow-tooltip />
        <el-table-column :label="t('gzGachaMachine.ipTag')" prop="ipTag" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.ipTag" size="small">{{ row.ipTag }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzGachaMachine.colSinglePrice')" width="110" align="center">
          <template #default="{ row }">{{ centToYuan(row.singlePriceCent) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzGachaMachine.colTenPackPrice')" width="110" align="center">
          <template #default="{ row }">{{ row.tenPackPriceCent != null ? centToYuan(row.tenPackPriceCent) : '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzGachaMachine.colPrizeCount')" prop="prizeCount" width="90" align="center" />
        <el-table-column :label="t('gzGachaMachine.colSales')" prop="salesCount" width="90" align="center" />
        <el-table-column :label="t('gzGachaMachine.status')" prop="status" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzGachaMachine.colAction')" fixed="right" width="320" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:gacha:machine:edit']" type="primary" link size="small" @click="handleEdit(row)">{{
              t('gzGachaMachine.edit')
            }}</el-button>
            <el-button
              v-if="row.status === 'off_shelf' || row.status === 'auto_off'"
              v-hasPermi="['gz:gacha:machine:edit']"
              type="success"
              link
              size="small"
              @click="handleChangeStatus(row, 'on_shelf')"
            >
              {{ t('gzGachaMachine.onShelf') }}
            </el-button>
            <el-button
              v-if="row.status === 'on_shelf'"
              v-hasPermi="['gz:gacha:machine:edit']"
              type="warning"
              link
              size="small"
              @click="handleChangeStatus(row, 'off_shelf')"
            >
              {{ t('gzGachaMachine.offShelf') }}
            </el-button>
            <el-button v-hasPermi="['gz:gacha:prize:list']" type="info" link size="small" @click="handleManagePrize(row)">{{
              t('gzGachaMachine.managePrize')
            }}</el-button>
            <el-button v-hasPermi="['gz:gacha:machine:remove']" type="danger" link size="small" @click="handleDel(row)">{{
              t('gzGachaMachine.del')
            }}</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('gzGachaMachine.empty')" /></template>
      </el-table>

      <pagination v-show="total > 0" v-model:limit="query.pageSize" v-model:page="query.pageNum" :total="total" @pagination="loadList" />
    </el-card>

    <!-- 新建 / 编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="formTitle" width="720px" top="6vh" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item :label="t('gzGachaMachine.colName')" prop="name">
          <el-input v-model="form.name" maxlength="128" show-word-limit />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('gzGachaMachine.colSinglePrice')" prop="singlePriceYuan">
              <el-input-number v-model="form.singlePriceYuan" :min="0" :precision="2" :step="1" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzGachaMachine.colTenPackPrice')">
              <el-input-number
                v-model="form.tenPackPriceYuan"
                :min="0"
                :precision="2"
                :step="1"
                controls-position="right"
                style="width: 100%"
                :placeholder="t('gzGachaMachine.tenPackPlaceholder')"
              />
              <div class="hint">{{ t('gzGachaMachine.tenPackHint') }}</div>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('gzGachaMachine.ipTag')">
              <el-input v-model="form.ipTag" maxlength="64" :placeholder="t('gzGachaMachine.ipTagPlaceholder')" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzGachaMachine.coverImage')">
              <GzImageUpload v-model="form.coverImageId" :usage-type="GZ_FILE_USAGE_TYPE.GACHA_PRIZE_IMAGE" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('gzGachaMachine.onlineTime')">
              <el-date-picker
                v-model="form.onlineTime"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                :placeholder="t('gzGachaMachine.onlineTimePlaceholder')"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzGachaMachine.offlineTime')">
              <el-date-picker
                v-model="form.offlineTime"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                :placeholder="t('gzGachaMachine.offlineTimePlaceholder')"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item :label="t('gzGachaMachine.remark')">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('gzGachaMachine.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('gzGachaMachine.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzGachaMachine">
import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Search, Refresh, Plus } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { useI18n } from 'vue-i18n';
import {
  listGzGachaMachine,
  getGzGachaMachine,
  addGzGachaMachine,
  updateGzGachaMachine,
  changeStatusGzGachaMachine,
  delGzGachaMachine,
  type GzGachaMachineVO,
  type GzGachaMachineQuery
} from '@/api/gz-gacha/machine';
import { GZ_FILE_USAGE_TYPE } from '@/api/gz-common/file';
import GzImageUpload from '@/components/GzImageUpload/index.vue';

const { t } = useI18n();
const router = useRouter();

const loading = ref(false);
const submitting = ref(false);
const rows = ref<GzGachaMachineVO[]>([]);
const total = ref(0);

const query = reactive<GzGachaMachineQuery>({ pageNum: 1, pageSize: 10 });

// 状态选项（doc/11 §7.1；auto_off 仅 cron 写，列表筛选可见但 admin 不可手动设）
const statusOptions = computed(() => [
  { value: 'on_shelf', label: t('gzGachaMachine.stOnShelf') },
  { value: 'off_shelf', label: t('gzGachaMachine.stOffShelf') },
  { value: 'auto_off', label: t('gzGachaMachine.stAutoOff') }
]);
function statusLabel(s: string) {
  return statusOptions.value.find((o) => o.value === s)?.label || s;
}
function statusTagType(s: string): 'success' | 'info' | 'warning' {
  const map: Record<string, 'success' | 'info' | 'warning'> = { on_shelf: 'success', off_shelf: 'info', auto_off: 'warning' };
  return map[s] || 'info';
}
function centToYuan(cent?: number | null) {
  if (cent == null) return '-';
  return '¥' + (cent / 100).toFixed(2);
}

// ---------------- 列表 ----------------
async function loadList() {
  loading.value = true;
  try {
    const resp = await listGzGachaMachine(query);
    rows.value = (resp as any).rows || [];
    total.value = (resp as any).total || 0;
  } catch (e) {
    console.error('[gz-gacha-machine] load failed', e);
    ElMessage.error(t('gzGachaMachine.loadFailed'));
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

// ---------------- 新建 / 编辑 ----------------
const formVisible = ref(false);
const formMode = ref<'add' | 'edit'>('add');
const formRef = ref<FormInstance>();

const form = reactive<{
  id?: string | null;
  name: string;
  coverImageId?: string | null;
  /** 显示用：元（提交时 *100 转分） */
  singlePriceYuan: number;
  /** 显示用：元（null = 不支持十连） */
  tenPackPriceYuan?: number | null;
  ipTag?: string | null;
  onlineTime?: string | null;
  offlineTime?: string | null;
  remark?: string | null;
}>({
  name: '',
  singlePriceYuan: 0,
  tenPackPriceYuan: undefined,
  remark: ''
});

const formTitle = computed(() => (formMode.value === 'add' ? t('gzGachaMachine.addDialogTitle') : t('gzGachaMachine.editDialogTitle')));

const rules = {
  name: [{ required: true, message: t('gzGachaMachine.ruleNameRequired'), trigger: 'blur' }],
  singlePriceYuan: [{ required: true, message: t('gzGachaMachine.ruleSinglePriceRequired'), trigger: 'change' }]
};

function handleAdd() {
  formMode.value = 'add';
  resetForm();
  formVisible.value = true;
}
async function handleEdit(row: GzGachaMachineVO) {
  formMode.value = 'edit';
  try {
    const resp = await getGzGachaMachine(row.id);
    const d = (resp as any).data as GzGachaMachineVO;
    form.id = d.id;
    form.name = d.name;
    form.coverImageId = d.coverImageId ?? null;
    form.singlePriceYuan = (d.singlePriceCent ?? 0) / 100;
    form.tenPackPriceYuan = d.tenPackPriceCent != null ? d.tenPackPriceCent / 100 : undefined;
    form.ipTag = d.ipTag ?? null;
    form.onlineTime = d.onlineTime ?? null;
    form.offlineTime = d.offlineTime ?? null;
    form.remark = d.remark ?? '';
    formVisible.value = true;
  } catch (e) {
    console.error('[gz-gacha-machine] detail failed', e);
    ElMessage.error(t('gzGachaMachine.detailFailed'));
  }
}
function resetForm() {
  formRef.value?.resetFields();
  form.id = null;
  form.name = '';
  form.coverImageId = null;
  form.singlePriceYuan = 0;
  form.tenPackPriceYuan = undefined;
  form.ipTag = null;
  form.onlineTime = null;
  form.offlineTime = null;
  form.remark = '';
}

function buildPayload() {
  return {
    id: form.id ?? null,
    name: form.name,
    coverImageId: form.coverImageId,
    // 元 → 分（四舍五入避免浮点误差）
    singlePriceCent: Math.round((form.singlePriceYuan ?? 0) * 100),
    // 空 / undefined → null（不支持十连）
    tenPackPriceCent: form.tenPackPriceYuan === undefined || form.tenPackPriceYuan === null ? null : Math.round(form.tenPackPriceYuan * 100),
    ipTag: form.ipTag,
    onlineTime: form.onlineTime,
    offlineTime: form.offlineTime,
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
        await addGzGachaMachine(payload as any);
        ElMessage.success(t('gzGachaMachine.addSuccess'));
      } else {
        await updateGzGachaMachine(payload as any);
        ElMessage.success(t('gzGachaMachine.editSuccess'));
      }
      formVisible.value = false;
      loadList();
    } catch (e) {
      console.error('[gz-gacha-machine] submit failed', e);
    } finally {
      submitting.value = false;
    }
  });
}

// ---------------- 上下架 / 删除 / 管理奖品池 ----------------
async function handleChangeStatus(row: GzGachaMachineVO, target: string) {
  const confirmKey = target === 'on_shelf' ? 'onShelfConfirm' : 'offShelfConfirm';
  await ElMessageBox.confirm(t(`gzGachaMachine.${confirmKey}`, { name: row.name }), t('gzGachaMachine.confirmTitle'), { type: 'warning' });
  await changeStatusGzGachaMachine(row.id, target);
  ElMessage.success(t('gzGachaMachine.changeStatusSuccess'));
  loadList();
}
async function handleDel(row: GzGachaMachineVO) {
  await ElMessageBox.confirm(t('gzGachaMachine.delConfirm', { name: row.name }), t('gzGachaMachine.confirmTitle'), { type: 'warning' });
  await delGzGachaMachine(row.id);
  ElMessage.success(t('gzGachaMachine.delSuccess'));
  loadList();
}
// 跳奖品池页（带 machineId + machineName query，AC 6）
function handleManagePrize(row: GzGachaMachineVO) {
  router.push({ path: '/gz/gz-gacha/prize', query: { machineId: row.id, machineName: row.name } });
}

loadList();
</script>

<style scoped>
.ticket-tag {
  font-size: 12px;
  color: #909399;
}
.hint {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}
</style>
