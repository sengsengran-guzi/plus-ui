<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzUser.title') }}</span>
          <span class="ticket-tag">GZ-SYS-003</span>
        </div>
      </template>

      <el-alert
        :title="t('gzUser.alertTitle')"
        type="info"
        :description="t('gzUser.alertDesc')"
        show-icon
        :closable="false"
        class="mb-3"
      />

      <!-- 查询表单 -->
      <el-form :model="query" inline @submit.prevent="handleQuery">
        <el-form-item :label="t('gzUser.openid')">
          <el-input
            v-model="query.openid"
            :placeholder="t('gzUser.openidPlaceholder')"
            clearable
            style="width: 220px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item :label="t('gzUser.nickname')">
          <el-input
            v-model="query.nickname"
            :placeholder="t('gzUser.nicknamePlaceholder')"
            clearable
            style="width: 180px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item :label="t('gzUser.mobile')">
          <el-input
            v-model="query.mobile"
            :placeholder="t('gzUser.mobilePlaceholder')"
            clearable
            style="width: 180px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item :label="t('gzUser.status')">
          <el-select v-model="query.status" :placeholder="t('gzUser.statusPlaceholder')" clearable style="width: 160px">
            <el-option label="authorized" value="authorized" />
            <el-option label="phone_bound" value="phone_bound" />
            <el-option label="browse_only" value="browse_only" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzUser.isDisabled')">
          <el-select
            v-model="query.isDisabled"
            :placeholder="t('gzUser.isDisabledPlaceholder')"
            clearable
            style="width: 140px"
          >
            <el-option :label="t('gzUser.disabled0')" :value="0" />
            <el-option :label="t('gzUser.disabled1')" :value="1" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzUser.registerTime')">
          <el-date-picker
            v-model="registerTimeRange"
            type="datetimerange"
            range-separator="-"
            :start-placeholder="t('gzUser.timeStart')"
            :end-placeholder="t('gzUser.timeEnd')"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 380px"
          />
        </el-form-item>
        <el-form-item>
          <el-button v-hasPermi="['gz:user:list']" type="primary" :icon="Search" @click="handleQuery">
            {{ t('gzUser.search') }}
          </el-button>
          <el-button :icon="Refresh" @click="handleReset">{{ t('gzUser.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 数据表格 -->
      <el-table v-loading="loading" :data="rows" border stripe size="small">
        <el-table-column :label="t('gzUser.colId')" prop="id" width="100" />
        <el-table-column :label="t('gzUser.colUserNo')" prop="userNo" width="170" />
        <el-table-column :label="t('gzUser.colOpenid')" prop="openid" width="180" show-overflow-tooltip />
        <el-table-column :label="t('gzUser.colNickname')" prop="nickname" min-width="120" show-overflow-tooltip />
        <el-table-column :label="t('gzUser.colAvatar')" prop="avatarUrl" width="80" align="center">
          <template #default="{ row }">
            <el-avatar v-if="row.avatarUrl" :src="row.avatarUrl" :size="32" />
            <span v-else class="text-xs text-gray-400">-</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzUser.colMobile')" prop="mobile" width="120" />
        <el-table-column :label="t('gzUser.colStatus')" prop="status" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzUser.colIsDisabled')" prop="isDisabled" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isDisabled === 1" type="danger" size="small">{{ t('gzUser.disabled1') }}</el-tag>
            <el-tag v-else type="success" size="small">{{ t('gzUser.disabled0') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzUser.colRegisterTime')" prop="registerTime" width="170" />
        <el-table-column :label="t('gzUser.colLastLogin')" prop="lastLoginTime" width="170" />
        <el-table-column :label="t('gzUser.colAction')" fixed="right" width="80" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:user:query']" type="primary" link size="small" @click="handleDetail(row)">
              {{ t('gzUser.detail') }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="t('gzUser.empty')" />
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

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" :title="t('gzUser.detailTitle')" size="50%" direction="rtl">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item :label="t('gzUser.colId')">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzUser.colUserNo')">{{ detail.userNo }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzUser.colOpenid')" :span="2">{{ detail.openid }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzUser.colUnionid')" :span="2">{{ detail.unionid || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzUser.colNickname')">{{ detail.nickname || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzUser.colMobile')">{{ detail.mobile || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzUser.colAvatar')" :span="2">
          <el-image
            v-if="detail.avatarUrl"
            :src="detail.avatarUrl"
            fit="contain"
            style="max-width: 120px; max-height: 120px"
          />
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzUser.colGender')">{{ genderLabel(detail.gender) }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzUser.colRegisterSource')">{{ detail.registerSource }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzUser.colStatus')">
          <el-tag :type="statusTagType(detail.status)" size="small">{{ detail.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzUser.colIsDisabled')">
          <el-tag v-if="detail.isDisabled === 1" type="danger" size="small">{{ t('gzUser.disabled1') }}</el-tag>
          <el-tag v-else type="success" size="small">{{ t('gzUser.disabled0') }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzUser.colRegisterTime')">{{ detail.registerTime }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzUser.colLastLogin')">{{ detail.lastLoginTime || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzUser.colRemark')" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>

<script setup lang="ts" name="GzCUser">
import { ref, reactive, computed } from 'vue';
import { Search, Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { listGzUser, getGzUser, type GzUserVO, type GzUserQuery } from '@/api/gz-common/user';

const { t } = useI18n();

const loading = ref<boolean>(false);
const rows = ref<GzUserVO[]>([]);
const total = ref<number>(0);

const query = reactive<GzUserQuery>({
  pageNum: 1,
  pageSize: 10
});

const registerTimeRange = ref<string[] | null>(null);

const detailVisible = ref<boolean>(false);
const detail = ref<GzUserVO | null>(null);

const buildQuery = computed<GzUserQuery>(() => {
  const q: GzUserQuery = { ...query };
  if (registerTimeRange.value && registerTimeRange.value.length === 2) {
    q.registerTimeStart = registerTimeRange.value[0];
    q.registerTimeEnd = registerTimeRange.value[1];
  } else {
    q.registerTimeStart = undefined;
    q.registerTimeEnd = undefined;
  }
  return q;
});

async function loadList() {
  loading.value = true;
  try {
    const resp = await listGzUser(buildQuery.value);
    rows.value = resp.data.rows || [];
    total.value = resp.data.total || 0;
  } catch (e) {
    console.error('[gz-user] load failed', e);
    ElMessage.error(t('gzUser.loadFailed'));
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
  query.nickname = undefined;
  query.mobile = undefined;
  query.status = undefined;
  query.isDisabled = undefined;
  registerTimeRange.value = null;
  query.pageNum = 1;
  loadList();
}

async function handleDetail(row: GzUserVO) {
  try {
    const resp = await getGzUser(row.id);
    detail.value = resp.data;
    detailVisible.value = true;
  } catch (e) {
    console.error('[gz-user] detail failed', e);
    ElMessage.error(t('gzUser.detailFailed'));
  }
}

function statusTagType(status: string): 'primary' | 'success' | 'info' | 'warning' | 'danger' {
  switch (status) {
    case 'authorized':
      return 'primary';
    case 'phone_bound':
      return 'success';
    case 'browse_only':
      return 'info';
    default:
      return 'warning';
  }
}

function genderLabel(g: number): string {
  if (g === 1) return t('gzUser.genderMale');
  if (g === 2) return t('gzUser.genderFemale');
  return t('gzUser.genderUnknown');
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
