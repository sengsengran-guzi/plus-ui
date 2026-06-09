<template>
  <div class="p-2">
    <el-card v-loading="pageLoading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzCouponTemplate.title') }}</span>
          <span class="ticket-tag">GZ-COUPON-001</span>
        </div>
      </template>

      <el-alert type="info" :description="t('gzCouponTemplate.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 查询条 -->
      <el-form inline class="mb-2">
        <el-form-item :label="t('gzCouponTemplate.colName')">
          <el-input v-model="query.name" :placeholder="t('gzCouponTemplate.namePlaceholder')" clearable style="width: 200px" @keyup.enter="loadList" />
        </el-form-item>
        <el-form-item :label="t('gzCouponTemplate.colStatus')">
          <el-select v-model="query.status" :placeholder="t('gzCouponTemplate.statusPlaceholder')" clearable style="width: 150px">
            <el-option v-for="d in gz_coupon_template_status" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzCouponTemplate.colStrategy')">
          <el-select v-model="query.issueStrategy" :placeholder="t('gzCouponTemplate.strategyPlaceholder')" clearable style="width: 150px">
            <el-option v-for="d in gz_coupon_issue_strategy" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadList">{{ t('gzCouponTemplate.search') }}</el-button>
          <el-button :icon="Refresh" @click="resetQuery">{{ t('gzCouponTemplate.reset') }}</el-button>
          <el-button v-hasPermi="['gz:coupon:template:add']" type="success" plain :icon="Plus" @click="handleAdd">{{ t('gzCouponTemplate.add') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="listLoading" :data="list" border stripe size="small">
        <el-table-column :label="t('gzCouponTemplate.colTemplateNo')" prop="templateNo" width="170" />
        <el-table-column :label="t('gzCouponTemplate.colName')" prop="name" min-width="160" show-overflow-tooltip />
        <el-table-column :label="t('gzCouponTemplate.colDiscountType')" width="100">
          <template #default="{ row }"><dict-tag :options="gz_coupon_discount_type" :value="row.discountType" /></template>
        </el-table-column>
        <el-table-column :label="t('gzCouponTemplate.colAmount')" width="100" align="right">
          <template #default="{ row }">¥{{ formatYuan(row.amountCent) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzCouponTemplate.colValidDays')" prop="validDays" width="90" align="center" />
        <el-table-column :label="t('gzCouponTemplate.colQuota')" width="100" align="center">
          <template #default="{ row }">{{ row.totalQuota === null ? t('gzCouponTemplate.quotaUnlimited') : row.totalQuota }}</template>
        </el-table-column>
        <el-table-column :label="t('gzCouponTemplate.colIssued')" prop="issuedCount" width="80" align="center" />
        <el-table-column :label="t('gzCouponTemplate.colStrategy')" width="110">
          <template #default="{ row }"><dict-tag :options="gz_coupon_issue_strategy" :value="row.issueStrategy" /></template>
        </el-table-column>
        <el-table-column :label="t('gzCouponTemplate.colStatus')" width="100">
          <template #default="{ row }"><dict-tag :options="gz_coupon_template_status" :value="row.status" /></template>
        </el-table-column>
        <el-table-column :label="t('gzCouponTemplate.colAction')" fixed="right" width="290" align="center">
          <template #default="{ row }">
            <el-button v-if="row.status === 'active'" v-hasPermi="['gz:coupon:issue']" type="primary" link size="small" @click="openIssue(row)">{{ t('gzCouponTemplate.issue') }}</el-button>
            <el-button v-hasPermi="['gz:coupon:template:edit']" :disabled="row.status === 'archived'" type="success" link size="small" @click="handleEdit(row)">{{ t('gzCouponTemplate.edit') }}</el-button>
            <el-button v-if="row.status === 'active'" v-hasPermi="['gz:coupon:template:edit']" type="warning" link size="small" @click="handlePause(row)">{{ t('gzCouponTemplate.pause') }}</el-button>
            <el-button v-if="row.status === 'paused'" v-hasPermi="['gz:coupon:template:edit']" type="primary" link size="small" @click="handleActivate(row)">{{ t('gzCouponTemplate.activate') }}</el-button>
            <el-button v-if="row.status !== 'archived'" v-hasPermi="['gz:coupon:template:edit']" type="info" link size="small" @click="handleArchive(row)">{{ t('gzCouponTemplate.archive') }}</el-button>
            <el-button v-hasPermi="['gz:coupon:template:remove']" type="danger" link size="small" @click="handleDel(row)">{{ t('gzCouponTemplate.del') }}</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('gzCouponTemplate.empty')" /></template>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:page="query.pageNum"
        v-model:limit="query.pageSize"
        :total="total"
        @pagination="loadList"
      />
    </el-card>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="formTitle" width="560px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item :label="t('gzCouponTemplate.fieldName')" prop="name">
          <el-input v-model="form.name" maxlength="64" show-word-limit :placeholder="t('gzCouponTemplate.namePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('gzCouponTemplate.fieldDiscountType')" prop="discountType">
          <el-select v-model="form.discountType" style="width: 100%">
            <!-- V1.2 仅 cash 可选（其余字典项 disabled 预留） -->
            <el-option v-for="d in gz_coupon_discount_type" :key="d.value" :label="d.label" :value="d.value" :disabled="d.value !== 'cash'" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzCouponTemplate.fieldAmount')" prop="amountYuan">
          <el-input-number v-model="form.amountYuan" :min="0" :precision="2" :step="1" />
          <span class="form-hint">{{ t('gzCouponTemplate.amountUnit') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzCouponTemplate.fieldApplicable')" prop="applicableBusiness">
          <el-select v-model="form.applicableBusiness" style="width: 100%">
            <el-option label="拼豆 / Pindou" value="pindou" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzCouponTemplate.fieldValidDays')" prop="validDays">
          <el-input-number v-model="form.validDays" :min="1" :max="3650" />
          <span class="form-hint">{{ t('gzCouponTemplate.validDaysHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzCouponTemplate.fieldTotalQuota')">
          <el-input-number v-model="form.totalQuota" :min="0" :max="9999999" />
          <span class="form-hint">{{ t('gzCouponTemplate.totalQuotaHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzCouponTemplate.fieldStrategy')" prop="issueStrategy">
          <el-select v-model="form.issueStrategy" style="width: 100%">
            <el-option v-for="d in gz_coupon_issue_strategy" :key="d.value" :label="d.label" :value="d.value" :disabled="d.value !== 'manual'" />
          </el-select>
          <span class="form-hint">{{ t('gzCouponTemplate.onlyManualHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzCouponTemplate.fieldRemark')">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('gzCouponTemplate.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('gzCouponTemplate.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 批量发放弹窗 -->
    <el-dialog v-model="issueVisible" :title="t('gzCouponTemplate.issueTitle')" width="720px" @close="resetIssue">
      <el-descriptions :column="2" border size="small" class="mb-3">
        <el-descriptions-item :label="t('gzCouponTemplate.issueTemplate')">{{ issueTemplate?.name }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzCouponTemplate.colAmount')">¥{{ formatYuan(issueTemplate?.amountCent || 0) }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzCouponTemplate.colStrategy')">manual</el-descriptions-item>
        <el-descriptions-item :label="t('gzCouponTemplate.colQuota')">
          {{ issueQuotaText }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- 用户检索 + 多选 -->
      <el-form inline class="mb-2">
        <el-form-item :label="t('gzCouponTemplate.issueUserSearch')">
          <el-input v-model="userQuery.nickname" :placeholder="t('gzCouponTemplate.issueUserSearchPlaceholder')" clearable style="width: 240px" @keyup.enter="loadUsers" />
        </el-form-item>
        <el-form-item>
          <el-button v-hasPermi="['gz:coupon:user:search']" type="primary" :icon="Search" @click="loadUsers">{{ t('gzCouponTemplate.search') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table
        ref="userTableRef"
        v-loading="userLoading"
        :data="userList"
        border
        stripe
        size="small"
        height="260"
        row-key="id"
        @selection-change="onUserSelectionChange"
      >
        <el-table-column type="selection" width="44" reserve-selection />
        <el-table-column :label="t('gzCouponTemplate.colUserNo')" prop="userNo" width="150" />
        <el-table-column :label="t('gzCouponTemplate.colNickname')" prop="nickname" min-width="140" show-overflow-tooltip />
        <el-table-column :label="t('gzCouponTemplate.colMobile')" prop="mobile" width="140" />
        <template #empty><el-empty :description="t('gzCouponTemplate.empty')" /></template>
      </el-table>
      <pagination
        v-show="userTotal > 0"
        v-model:page="userQuery.pageNum"
        v-model:limit="userQuery.pageSize"
        :total="userTotal"
        @pagination="loadUsers"
      />

      <div class="issue-selected">{{ t('gzCouponTemplate.issueSelectedUsers', { count: selectedUserIds.length }) }}</div>

      <el-divider />
      <el-form label-width="160px">
        <el-form-item :label="t('gzCouponTemplate.issueByKeyword')">
          <el-input v-model="issueKeyword" :placeholder="t('gzCouponTemplate.issueKeywordPlaceholder')" clearable :disabled="selectedUserIds.length > 0" style="width: 320px" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="issueVisible = false">{{ t('gzCouponTemplate.cancel') }}</el-button>
        <el-button type="primary" :loading="issuing" @click="handleIssue">{{ t('gzCouponTemplate.issueConfirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzCouponTemplate">
import { ref, reactive, computed, getCurrentInstance, type ComponentInternalInstance, toRefs, onMounted } from 'vue';
import { Plus, Refresh, Search } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { useI18n } from 'vue-i18n';
import {
  listGzCouponTemplate,
  addGzCouponTemplate,
  updateGzCouponTemplate,
  delGzCouponTemplate,
  pauseGzCouponTemplate,
  activateGzCouponTemplate,
  archiveGzCouponTemplate,
  issueGzCoupon,
  type GzCouponTemplateVO,
  type GzCouponTemplateForm,
  type GzCouponTemplateQuery
} from '@/api/gz-coupon/template';
import { listGzCouponUserOptions, type GzCouponUserOptionVO, type GzCouponUserOptionQuery } from '@/api/gz-coupon/userCoupon';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;
// 优惠券字典（GZ-COUPON-001 seed）
const { gz_coupon_discount_type, gz_coupon_issue_strategy, gz_coupon_template_status } = toRefs<any>(
  proxy?.useDict('gz_coupon_discount_type', 'gz_coupon_issue_strategy', 'gz_coupon_template_status')
);

const pageLoading = ref(false);
const listLoading = ref(false);
const submitting = ref(false);

const list = ref<GzCouponTemplateVO[]>([]);
const total = ref(0);
const query = reactive<GzCouponTemplateQuery>({ name: '', status: '', issueStrategy: '', pageNum: 1, pageSize: 10 });

// ============ helpers ============
function formatYuan(cent: number): string {
  return ((cent || 0) / 100).toFixed(2);
}

// ============ 列表 ============
async function loadList() {
  listLoading.value = true;
  try {
    const resp = await listGzCouponTemplate(query);
    const r = resp as any;
    list.value = (r.rows || []) as GzCouponTemplateVO[];
    total.value = r.total || 0;
  } catch (e) {
    console.error('[gz-coupon-template] loadList failed', e);
    ElMessage.error(t('gzCouponTemplate.loadFailed'));
  } finally {
    listLoading.value = false;
  }
}

function resetQuery() {
  query.name = '';
  query.status = '';
  query.issueStrategy = '';
  query.pageNum = 1;
  loadList();
}

// ============ 表单（amountYuan 元，提交转 amountCent 分） ============
interface FormState {
  id: string | null;
  name: string;
  discountType: string;
  amountYuan: number;
  applicableBusiness: string;
  validDays: number;
  totalQuota: number | null;
  issueStrategy: string;
  remark: string;
}
const formVisible = ref(false);
const formMode = ref<'add' | 'edit'>('add');
const formRef = ref<FormInstance>();
const form = reactive<FormState>({
  id: null,
  name: '',
  discountType: 'cash',
  amountYuan: 10,
  applicableBusiness: 'pindou',
  validDays: 30,
  totalQuota: null,
  issueStrategy: 'manual',
  remark: ''
});
const formTitle = computed(() => (formMode.value === 'add' ? t('gzCouponTemplate.addTitle') : t('gzCouponTemplate.editTitle')));
const rules = {
  name: [{ required: true, message: t('gzCouponTemplate.ruleNameRequired'), trigger: 'blur' }],
  discountType: [{ required: true, message: t('gzCouponTemplate.ruleStrategyRequired'), trigger: 'change' }],
  amountYuan: [{ required: true, message: t('gzCouponTemplate.ruleAmountRequired'), trigger: 'change' }],
  applicableBusiness: [{ required: true, message: t('gzCouponTemplate.ruleStrategyRequired'), trigger: 'change' }],
  validDays: [{ required: true, message: t('gzCouponTemplate.ruleValidDaysRequired'), trigger: 'change' }],
  issueStrategy: [{ required: true, message: t('gzCouponTemplate.ruleStrategyRequired'), trigger: 'change' }]
};

function handleAdd() {
  formMode.value = 'add';
  Object.assign(form, {
    id: null,
    name: '',
    discountType: 'cash',
    amountYuan: 10,
    applicableBusiness: 'pindou',
    validDays: 30,
    totalQuota: null,
    issueStrategy: 'manual',
    remark: ''
  });
  formVisible.value = true;
}

function handleEdit(row: GzCouponTemplateVO) {
  formMode.value = 'edit';
  Object.assign(form, {
    id: row.id,
    name: row.name,
    discountType: row.discountType,
    amountYuan: (row.amountCent || 0) / 100,
    applicableBusiness: row.applicableBusiness,
    validDays: row.validDays,
    totalQuota: row.totalQuota,
    issueStrategy: row.issueStrategy,
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
    const payload: GzCouponTemplateForm = {
      id: form.id,
      name: form.name,
      discountType: form.discountType,
      amountCent: Math.round((form.amountYuan || 0) * 100),
      applicableBusiness: form.applicableBusiness,
      validDays: form.validDays,
      totalQuota: form.totalQuota,
      issueStrategy: form.issueStrategy,
      remark: form.remark
    };
    if (formMode.value === 'add') {
      await addGzCouponTemplate(payload);
      ElMessage.success(t('gzCouponTemplate.addSuccess'));
    } else {
      await updateGzCouponTemplate(payload);
      ElMessage.success(t('gzCouponTemplate.editSuccess'));
    }
    formVisible.value = false;
    await loadList();
  } catch (e) {
    console.error('[gz-coupon-template] submit failed', e);
  } finally {
    submitting.value = false;
  }
}

// ============ 状态流转 ============
async function handlePause(row: GzCouponTemplateVO) {
  await confirmAndRun(() => pauseGzCouponTemplate(row.id), t('gzCouponTemplate.pauseConfirm', { name: row.name }));
}
async function handleActivate(row: GzCouponTemplateVO) {
  await confirmAndRun(() => activateGzCouponTemplate(row.id), t('gzCouponTemplate.activateConfirm', { name: row.name }));
}
async function handleArchive(row: GzCouponTemplateVO) {
  await confirmAndRun(() => archiveGzCouponTemplate(row.id), t('gzCouponTemplate.archiveConfirm', { name: row.name }));
}
async function handleDel(row: GzCouponTemplateVO) {
  await confirmAndRun(() => delGzCouponTemplate(row.id), t('gzCouponTemplate.delConfirm', { name: row.name }), t('gzCouponTemplate.delSuccess'));
}

async function confirmAndRun(fn: () => Promise<any>, confirmMsg: string, successMsg?: string) {
  try {
    await ElMessageBox.confirm(confirmMsg, t('gzCouponTemplate.confirmTitle'), { type: 'warning' });
    await fn();
    ElMessage.success(successMsg || t('gzCouponTemplate.editSuccess'));
    await loadList();
  } catch (e: any) {
    if (e !== 'cancel') console.error('[gz-coupon-template] action failed', e);
  }
}

// ============ 批量发放 ============
const issueVisible = ref(false);
const issuing = ref(false);
const issueTemplate = ref<GzCouponTemplateVO | null>(null);
const issueKeyword = ref('');
const selectedUserIds = ref<string[]>([]);
const userTableRef = ref();
const userList = ref<GzCouponUserOptionVO[]>([]);
const userTotal = ref(0);
const userLoading = ref(false);
const userQuery = reactive<GzCouponUserOptionQuery>({ nickname: '', pageNum: 1, pageSize: 10 });

const issueQuotaText = computed(() => {
  const tpl = issueTemplate.value;
  if (!tpl) return '';
  return t('gzCouponTemplate.issueQuotaInfo', {
    issued: tpl.issuedCount,
    quota: tpl.totalQuota === null ? t('gzCouponTemplate.quotaUnlimited') : tpl.totalQuota
  });
});

function openIssue(row: GzCouponTemplateVO) {
  issueTemplate.value = row;
  issueKeyword.value = '';
  selectedUserIds.value = [];
  userList.value = [];
  userTotal.value = 0;
  userQuery.nickname = '';
  userQuery.pageNum = 1;
  userTableRef.value?.clearSelection?.();
  issueVisible.value = true;
}

function resetIssue() {
  userTableRef.value?.clearSelection?.();
  selectedUserIds.value = [];
}

async function loadUsers() {
  userLoading.value = true;
  try {
    const resp = await listGzCouponUserOptions(userQuery);
    const r = resp as any;
    userList.value = (r.rows || []) as GzCouponUserOptionVO[];
    userTotal.value = r.total || 0;
  } catch (e) {
    console.error('[gz-coupon-template] loadUsers failed', e);
    ElMessage.error(t('gzCouponTemplate.loadFailed'));
  } finally {
    userLoading.value = false;
  }
}

function onUserSelectionChange(rows: GzCouponUserOptionVO[]) {
  selectedUserIds.value = rows.map((r) => r.id);
}

async function handleIssue() {
  if (!issueTemplate.value) return;
  if (selectedUserIds.value.length === 0 && !issueKeyword.value.trim()) {
    ElMessage.warning(t('gzCouponTemplate.issueNoTarget'));
    return;
  }
  issuing.value = true;
  try {
    const resp = await issueGzCoupon({
      templateId: issueTemplate.value.id,
      userIds: selectedUserIds.value.length > 0 ? selectedUserIds.value : undefined,
      userKeyword: selectedUserIds.value.length > 0 ? undefined : issueKeyword.value.trim()
    });
    const r = resp as any;
    const issued = (r.data?.issuedCount ?? r.issuedCount) || 0;
    ElMessage.success(t('gzCouponTemplate.issueSuccess', { count: issued }));
    issueVisible.value = false;
    await loadList();
  } catch (e) {
    console.error('[gz-coupon-template] issue failed', e);
  } finally {
    issuing.value = false;
  }
}

onMounted(() => {
  pageLoading.value = true;
  loadList().finally(() => (pageLoading.value = false));
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
.issue-selected {
  margin-top: 8px;
  color: #409eff;
  font-size: 13px;
}
</style>
