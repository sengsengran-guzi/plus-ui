<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('staffBinding.title') }}</span>
          <span class="ticket-tag">GZ-SYS-007</span>
        </div>
      </template>

      <el-alert
        :title="t('staffBinding.alertTitle')"
        type="info"
        :description="t('staffBinding.alertDesc')"
        show-icon
        :closable="false"
        class="mb-3"
      />

      <!-- 查询表单 -->
      <el-form :model="query" inline @submit.prevent="handleQuery">
        <el-form-item :label="t('staffBinding.openid')">
          <el-input
            v-model="query.openid"
            :placeholder="t('staffBinding.openidPlaceholder')"
            clearable
            style="width: 220px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item :label="t('staffBinding.mobile')">
          <el-input
            v-model="query.mobile"
            :placeholder="t('staffBinding.mobilePlaceholder')"
            clearable
            style="width: 180px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item :label="t('staffBinding.userNo')">
          <el-input
            v-model="query.userNo"
            :placeholder="t('staffBinding.userNoPlaceholder')"
            clearable
            style="width: 180px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item :label="t('staffBinding.boundOnly')">
          <el-switch v-model="query.boundOnly" />
        </el-form-item>
        <el-form-item>
          <el-button v-hasPermi="['gz:staff:binding:list']" type="primary" :icon="Search" @click="handleQuery">
            {{ t('staffBinding.search') }}
          </el-button>
          <el-button :icon="Refresh" @click="handleReset">{{ t('staffBinding.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 数据表格 -->
      <el-table v-loading="loading" :data="rows" border stripe size="small">
        <el-table-column :label="t('staffBinding.colId')" prop="id" width="90" />
        <el-table-column :label="t('staffBinding.colUserNo')" prop="userNo" width="160" />
        <el-table-column :label="t('staffBinding.colOpenid')" prop="openid" width="170" show-overflow-tooltip />
        <el-table-column :label="t('staffBinding.colNickname')" prop="nickname" min-width="110" show-overflow-tooltip />
        <el-table-column :label="t('staffBinding.colMobile')" prop="mobile" width="120" />
        <el-table-column :label="t('staffBinding.colBinding')" min-width="180">
          <template #default="{ row }">
            <template v-if="row.staffUserId">
              <el-tag v-if="row.staffActive" type="success" size="small">
                {{ row.staffNickName || row.staffUserName }}
              </el-tag>
              <el-tag v-else type="warning" size="small">
                {{ row.staffNickName || row.staffUserName }}（{{ t('staffBinding.staffInactive') }}）
              </el-tag>
            </template>
            <el-tag v-else type="info" size="small">{{ t('staffBinding.customer') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('staffBinding.colAction')" fixed="right" width="170" align="center">
          <template #default="{ row }">
            <el-button
              v-hasPermi="['gz:staff:binding:bind']"
              type="primary"
              link
              size="small"
              @click="openBindDialog(row)"
            >
              {{ row.staffUserId ? t('staffBinding.rebind') : t('staffBinding.bind') }}
            </el-button>
            <el-button
              v-if="row.staffUserId"
              v-hasPermi="['gz:staff:binding:unbind']"
              type="danger"
              link
              size="small"
              @click="handleUnbind(row)"
            >
              {{ t('staffBinding.unbind') }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="t('staffBinding.empty')" />
        </template>
      </el-table>

      <!-- 分页 -->
      <pagination
        v-show="total > 0"
        v-model:limit="query.pageSize"
        v-model:page="query.pageNum"
        :total="total"
        @pagination="loadList"
      />
    </el-card>

    <!-- 设为店员弹窗 -->
    <el-dialog v-model="bindDialogVisible" :title="t('staffBinding.bindDialogTitle')" width="480px">
      <el-form label-width="100px">
        <el-form-item :label="t('staffBinding.targetUser')">
          <span class="text-sm">
            {{ bindTarget?.nickname || '-' }}（{{ bindTarget?.userNo }}）
          </span>
        </el-form-item>
        <el-form-item :label="t('staffBinding.selectStaff')">
          <el-select
            v-model="selectedStaffUserId"
            filterable
            remote
            :remote-method="loadCandidates"
            :loading="candidateLoading"
            :placeholder="t('staffBinding.selectStaffPlaceholder')"
            style="width: 100%"
          >
            <el-option
              v-for="c in candidates"
              :key="c.userId"
              :label="`${c.nickName || c.userName}（${c.userName}）`"
              :value="c.userId"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bindDialogVisible = false">{{ t('staffBinding.cancel') }}</el-button>
        <el-button type="primary" :loading="binding" :disabled="!selectedStaffUserId" @click="handleBind">
          {{ t('staffBinding.confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzStaffBinding">
import { ref, reactive } from 'vue';
import { Search, Refresh } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import {
  listStaffBinding,
  listStaffCandidates,
  bindStaff,
  unbindStaff,
  type StaffBindingVO,
  type StaffBindingQuery,
  type StaffCandidateVO
} from '@/api/gz-common/staff-binding';

const { t } = useI18n();

const loading = ref<boolean>(false);
const rows = ref<StaffBindingVO[]>([]);
const total = ref<number>(0);

const query = reactive<StaffBindingQuery>({
  pageNum: 1,
  pageSize: 10,
  boundOnly: false
});

async function loadList() {
  loading.value = true;
  try {
    // ruoyi request.ts interceptor 已对 TableDataInfo 解包，直接拿 { rows, total }
    const resp = await listStaffBinding(query);
    rows.value = (resp as any).rows || [];
    total.value = (resp as any).total || 0;
  } catch (e) {
    console.error('[staff-binding] load failed', e);
    ElMessage.error(t('staffBinding.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  query.pageNum = 1;
  loadList();
}

function handleReset() {
  query.openid = undefined;
  query.mobile = undefined;
  query.userNo = undefined;
  query.boundOnly = false;
  query.pageNum = 1;
  loadList();
}

// ── 设为店员 ──────────────────────────────────────────
const bindDialogVisible = ref<boolean>(false);
const bindTarget = ref<StaffBindingVO | null>(null);
const candidates = ref<StaffCandidateVO[]>([]);
const candidateLoading = ref<boolean>(false);
const selectedStaffUserId = ref<number | undefined>(undefined);
const binding = ref<boolean>(false);

async function openBindDialog(row: StaffBindingVO) {
  bindTarget.value = row;
  selectedStaffUserId.value = row.staffUserId ?? undefined;
  bindDialogVisible.value = true;
  await loadCandidates('');
}

async function loadCandidates(keyword: string) {
  candidateLoading.value = true;
  try {
    const resp = await listStaffCandidates(keyword);
    candidates.value = (resp as any).data || [];
  } catch (e) {
    console.error('[staff-binding] candidates failed', e);
  } finally {
    candidateLoading.value = false;
  }
}

async function handleBind() {
  if (!bindTarget.value || !selectedStaffUserId.value) {
    return;
  }
  binding.value = true;
  try {
    await bindStaff(bindTarget.value.id, selectedStaffUserId.value);
    ElMessage.success(t('staffBinding.bindSuccess'));
    bindDialogVisible.value = false;
    loadList();
  } catch (e) {
    console.error('[staff-binding] bind failed', e);
    // ServiceException 的业务错误信息已由 request.ts 全局拦截器 ElMessage 弹出，这里不重复
  } finally {
    binding.value = false;
  }
}

// ── 解绑 ──────────────────────────────────────────
async function handleUnbind(row: StaffBindingVO) {
  try {
    await ElMessageBox.confirm(
      t('staffBinding.unbindConfirm', { name: row.nickname || row.userNo }),
      t('staffBinding.unbindConfirmTitle'),
      { type: 'warning' }
    );
  } catch {
    return; // 取消
  }
  try {
    await unbindStaff(row.id);
    ElMessage.success(t('staffBinding.unbindSuccess'));
    loadList();
  } catch (e) {
    console.error('[staff-binding] unbind failed', e);
    ElMessage.error(t('staffBinding.unbindFailed'));
  }
}

loadList();
</script>

<style lang="scss" scoped>
.ticket-tag {
  padding: 2px 8px;
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
  border-radius: 4px;
  font-size: 12px;
}
</style>
