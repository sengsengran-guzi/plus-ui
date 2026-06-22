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
    <el-dialog v-model="formVisible" :title="formTitle" width="600px" @close="resetForm">
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
            <el-option :label="t('gzCouponTemplate.applicablePindou')" value="pindou" />
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
          <el-select v-model="form.issueStrategy" style="width: 100%" @change="onStrategyChange">
            <!-- manual 手动指定 / filtered 条件筛选 可选；event 预留 disabled（ADR-0010） -->
            <el-option v-for="d in gz_coupon_issue_strategy" :key="d.value" :label="d.label" :value="d.value" :disabled="d.value === 'event'" />
          </el-select>
          <span class="form-hint">{{ t('gzCouponTemplate.strategyHint') }}</span>
        </el-form-item>

        <!-- 条件筛选构建器（filtered，ADR-0010）：admin 自配 audience 条件，AND 组合 -->
        <el-form-item v-if="form.issueStrategy === 'filtered'" :label="t('gzCouponTemplate.fieldConditions')">
          <div class="cond-builder">
            <div v-for="(c, idx) in form.conditions" :key="idx" class="cond-row">
              <el-select v-model="c.type" style="width: 130px" @change="onConditionTypeChange(c)">
                <el-option :label="t('gzCouponTemplate.condRegisterTime')" value="register_time" />
                <el-option :label="t('gzCouponTemplate.condDidPindou')" value="did_pindou" />
                <el-option :label="t('gzCouponTemplate.condPhoneBound')" value="phone_bound" />
              </el-select>
              <el-date-picker
                v-if="c.type === 'register_time'"
                v-model="c.range"
                type="daterange"
                value-format="YYYY-MM-DD"
                :start-placeholder="t('gzCouponTemplate.condStart')"
                :end-placeholder="t('gzCouponTemplate.condEnd')"
                unlink-panels
                style="width: 250px; margin-left: 8px"
                @change="previewCount = null"
              />
              <el-checkbox v-else-if="c.type === 'did_pindou'" v-model="c.completedOnly" style="margin-left: 12px" @change="previewCount = null">
                {{ t('gzCouponTemplate.condCompletedOnly') }}
              </el-checkbox>
              <span v-else class="form-hint" style="margin-left: 12px">{{ t('gzCouponTemplate.condNoParam') }}</span>
              <el-button type="danger" link :icon="Delete" style="margin-left: 8px" @click="removeCondition(idx)" />
            </div>
            <div class="cond-actions">
              <el-button type="primary" plain size="small" :icon="Plus" @click="addCondition">{{ t('gzCouponTemplate.condAdd') }}</el-button>
              <el-button size="small" :icon="Search" :loading="previewing" :disabled="form.conditions.length === 0" @click="handlePreview">
                {{ t('gzCouponTemplate.condPreview') }}
              </el-button>
              <span v-if="previewCount !== null" class="cond-preview-result">{{ t('gzCouponTemplate.condPreviewResult', { count: previewCount }) }}</span>
            </div>
            <div class="form-hint">{{ t('gzCouponTemplate.condHint') }}</div>
          </div>
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
        <el-descriptions-item :label="t('gzCouponTemplate.colStrategy')">
          <dict-tag :options="gz_coupon_issue_strategy" :value="issueTemplate?.issueStrategy" />
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzCouponTemplate.colQuota')">
          {{ issueQuotaText }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- filtered：按模板条件圈人，预览后直接发（不选名单） -->
      <template v-if="isFilteredIssue">
        <el-alert type="info" :closable="false" :title="t('gzCouponTemplate.issueFilteredHint')" class="mb-2" />
        <div class="cond-summary">{{ issueConditionsText }}</div>
        <div class="cond-actions">
          <el-button size="small" :icon="Search" :loading="issuePreviewing" @click="handleIssuePreview">{{ t('gzCouponTemplate.condPreview') }}</el-button>
          <span v-if="issuePreviewCount !== null" class="cond-preview-result">{{ t('gzCouponTemplate.condPreviewResult', { count: issuePreviewCount }) }}</span>
        </div>
      </template>

      <!-- manual：检索 + 多选名单，或按关键词发 -->
      <template v-else>
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
      </template>

      <template #footer>
        <el-button @click="issueVisible = false">{{ t('gzCouponTemplate.cancel') }}</el-button>
        <el-button type="primary" :loading="issuing" @click="handleIssue">{{ t('gzCouponTemplate.issueConfirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzCouponTemplate">
import { ref, reactive, computed, getCurrentInstance, type ComponentInternalInstance, toRefs, onMounted } from 'vue';
import { Delete, Plus, Refresh, Search } from '@element-plus/icons-vue';
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
  previewGzCouponAudience,
  type CouponAudienceCondition,
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

/** 构建器内的条件行（register_time 用 range 数组承接 daterange，提交时拆成 start/end）。 */
interface ConditionRow {
  type: string;
  range?: [string, string] | null;
  completedOnly?: boolean;
}

/** 条件行 → 提交 DTO。 */
function toConditionDto(c: ConditionRow): CouponAudienceCondition {
  if (c.type === 'register_time') {
    return { type: 'register_time', start: c.range?.[0], end: c.range?.[1] };
  }
  if (c.type === 'did_pindou') {
    return { type: 'did_pindou', completedOnly: !!c.completedOnly };
  }
  return { type: 'phone_bound' };
}

/** issue_config_json → 条件行（编辑回填）。 */
function parseConditionRows(json?: string | null): ConditionRow[] {
  if (!json) return [];
  try {
    const cfg = JSON.parse(json);
    const conds: CouponAudienceCondition[] = cfg?.conditions || [];
    return conds.map((d) => {
      if (d.type === 'register_time') {
        return { type: 'register_time', range: d.start || d.end ? [d.start || '', d.end || ''] : null };
      }
      if (d.type === 'did_pindou') {
        return { type: 'did_pindou', completedOnly: !!d.completedOnly };
      }
      return { type: 'phone_bound' };
    });
  } catch {
    return [];
  }
}

/** 条件人话摘要（发放弹窗 + 概览用）。 */
function conditionsToText(conds: CouponAudienceCondition[]): string {
  if (!conds.length) return t('gzCouponTemplate.condEmpty');
  return conds
    .map((c) => {
      if (c.type === 'register_time') {
        return t('gzCouponTemplate.condRegisterTime') + `（${c.start || '*'} ~ ${c.end || '*'}）`;
      }
      if (c.type === 'did_pindou') {
        return t('gzCouponTemplate.condDidPindou') + (c.completedOnly ? `（${t('gzCouponTemplate.condCompletedOnly')}）` : '');
      }
      return t('gzCouponTemplate.condPhoneBound');
    })
    .join('  且  ');
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
  conditions: ConditionRow[];
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
  conditions: [],
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

// 条件预览（表单构建器内）
const previewing = ref(false);
const previewCount = ref<number | null>(null);

function onStrategyChange() {
  previewCount.value = null;
  if (form.issueStrategy === 'filtered' && form.conditions.length === 0) {
    addCondition();
  }
}
function addCondition() {
  form.conditions.push({ type: 'register_time', range: null });
  previewCount.value = null;
}
function removeCondition(idx: number) {
  form.conditions.splice(idx, 1);
  previewCount.value = null;
}
function onConditionTypeChange(c: ConditionRow) {
  c.range = null;
  c.completedOnly = false;
  previewCount.value = null;
}

/** 表单内条件校验（filtered：≥1 + register_time 至少一侧日期）。 */
function validateConditions(): boolean {
  if (form.conditions.length === 0) {
    ElMessage.warning(t('gzCouponTemplate.condRequired'));
    return false;
  }
  for (const c of form.conditions) {
    if (c.type === 'register_time' && !c.range?.[0] && !c.range?.[1]) {
      ElMessage.warning(t('gzCouponTemplate.condRegisterTimeRequired'));
      return false;
    }
  }
  return true;
}

async function handlePreview() {
  if (form.issueStrategy !== 'filtered' || !validateConditions()) return;
  previewing.value = true;
  try {
    const resp = await previewGzCouponAudience({ conditions: form.conditions.map(toConditionDto) });
    const r = resp as any;
    previewCount.value = (r.data ?? r) as number;
  } catch (e) {
    console.error('[gz-coupon-template] preview failed', e);
  } finally {
    previewing.value = false;
  }
}

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
    conditions: [],
    remark: ''
  });
  previewCount.value = null;
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
    conditions: parseConditionRows(row.issueConfigJson),
    remark: row.remark || ''
  });
  previewCount.value = null;
  formVisible.value = true;
}

function resetForm() {
  formRef.value?.resetFields();
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate();
  // filtered：构建器条件校验 + 序列化 issue_config_json；其余策略 config 置空
  let issueConfigJson: string | null = null;
  if (form.issueStrategy === 'filtered') {
    if (!validateConditions()) return;
    issueConfigJson = JSON.stringify({ conditions: form.conditions.map(toConditionDto) });
  }
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
      issueConfigJson,
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
// filtered 发放预览
const issuePreviewing = ref(false);
const issuePreviewCount = ref<number | null>(null);

const isFilteredIssue = computed(() => issueTemplate.value?.issueStrategy === 'filtered');
const issueConditionsText = computed(() => conditionsToText(parseConditionRows(issueTemplate.value?.issueConfigJson).map(toConditionDto)));

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
  issuePreviewCount.value = null;
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

async function handleIssuePreview() {
  if (!issueTemplate.value) return;
  const conds = parseConditionRows(issueTemplate.value.issueConfigJson).map(toConditionDto);
  issuePreviewing.value = true;
  try {
    const resp = await previewGzCouponAudience({ conditions: conds });
    const r = resp as any;
    issuePreviewCount.value = (r.data ?? r) as number;
  } catch (e) {
    console.error('[gz-coupon-template] issue preview failed', e);
  } finally {
    issuePreviewing.value = false;
  }
}

async function handleIssue() {
  if (!issueTemplate.value) return;

  if (isFilteredIssue.value) {
    // 条件筛选：服务端按模板 issue_config_json 解析 audience，仅传 templateId
    issuing.value = true;
    try {
      const resp = await issueGzCoupon({ templateId: issueTemplate.value.id });
      const r = resp as any;
      const issued = (r.data?.issuedCount ?? r.issuedCount) || 0;
      ElMessage.success(t('gzCouponTemplate.issueSuccess', { count: issued }));
      issueVisible.value = false;
      await loadList();
    } catch (e) {
      console.error('[gz-coupon-template] filtered issue failed', e);
    } finally {
      issuing.value = false;
    }
    return;
  }

  // manual：名单 / 关键词二选一
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
.cond-builder {
  width: 100%;
}
.cond-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
.cond-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.cond-preview-result {
  color: #409eff;
  font-size: 13px;
  font-weight: 600;
}
.cond-summary {
  margin: 8px 0;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  color: #303133;
  font-size: 13px;
}
</style>
