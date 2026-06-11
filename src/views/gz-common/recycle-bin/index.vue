<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('recycleBin.title') }}</span>
          <span class="ticket-tag">GZ-ADMIN-108</span>
        </div>
      </template>

      <el-alert :title="t('recycleBin.alertTitle')" type="info" :description="t('recycleBin.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 筛选 -->
      <el-form :model="query" inline class="mb-2" @submit.prevent="handleQuery">
        <el-form-item :label="t('recycleBin.colEntityType')">
          <el-select v-model="query.entityType" :placeholder="t('recycleBin.allTypes')" clearable style="width: 160px" @change="handleQuery">
            <el-option v-for="d in entityTypes" :key="d.entityType" :label="d.label" :value="d.entityType" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('recycleBin.colEntityName')">
          <el-input v-model="query.entityName" :placeholder="t('recycleBin.namePlaceholder')" clearable style="width: 180px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item :label="t('recycleBin.colDeleteTime')">
          <el-date-picker
            v-model="timeRange"
            type="datetimerange"
            value-format="YYYY-MM-DD HH:mm:ss"
            :start-placeholder="t('recycleBin.timeStart')"
            :end-placeholder="t('recycleBin.timeEnd')"
            style="width: 340px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleQuery">{{ t('recycleBin.search') }}</el-button>
          <el-button :icon="Refresh" @click="handleReset">{{ t('recycleBin.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="rows" border>
        <el-table-column :label="t('recycleBin.colEntityType')" width="120" align="center">
          <template #default="{ row }"><el-tag size="small">{{ row.entityTypeLabel }}</el-tag></template>
        </el-table-column>
        <el-table-column :label="t('recycleBin.colEntityName')" prop="entityName" min-width="180" show-overflow-tooltip />
        <el-table-column :label="t('recycleBin.colOperator')" prop="deleteOperatorName" width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.deleteOperatorName || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('recycleBin.colDeleteTime')" prop="deleteTime" width="170" align="center" />
        <el-table-column :label="t('recycleBin.colDaysAgo')" width="100" align="center">
          <template #default="{ row }">{{ row.daysAgo != null ? t('recycleBin.daysAgo', { n: row.daysAgo }) : '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('recycleBin.colArchived')" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.archived" type="warning" size="small">{{ t('recycleBin.archived') }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('recycleBin.colAction')" fixed="right" width="160" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:recycle:bin:restore']" type="primary" link size="small" @click="handleRestore(row)">
              {{ t('recycleBin.restore') }}
            </el-button>
            <el-button v-hasPermi="['gz:recycle:bin:archive']" :disabled="row.archived" type="warning" link size="small" @click="handleArchive(row)">
              {{ t('recycleBin.archive') }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('recycleBin.empty')" /></template>
      </el-table>

      <pagination v-show="total > 0" v-model:limit="query.pageSize" v-model:page="query.pageNum" :total="total" @pagination="loadList" />
    </el-card>
  </div>
</template>

<script setup lang="ts" name="GzRecycleBin">
import { ref, reactive, watch } from 'vue';
import { Search, Refresh } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import {
  listRecycleBin,
  getRecycleEntityTypes,
  restoreRecycle,
  archiveRecycle,
  type RecycleBinItemVO,
  type RecycleEntityDef,
  type RecycleBinQuery
} from '@/api/gz-common/recycle-bin';

const { t } = useI18n();

const loading = ref(false);
const rows = ref<RecycleBinItemVO[]>([]);
const total = ref(0);
const entityTypes = ref<RecycleEntityDef[]>([]);
const query = reactive<RecycleBinQuery>({ pageNum: 1, pageSize: 10 });
const timeRange = ref<[string, string] | null>(null);

watch(timeRange, (v) => {
  query.startTime = v ? v[0] : undefined;
  query.endTime = v ? v[1] : undefined;
});

async function loadEntityTypes() {
  try {
    const resp = await getRecycleEntityTypes();
    entityTypes.value = ((resp as any).data as RecycleEntityDef[]) || [];
  } catch (e) {
    console.error('[recycle-bin] load entity-types failed', e);
  }
}

async function loadList() {
  loading.value = true;
  try {
    const resp = await listRecycleBin(query);
    rows.value = (resp as any).rows || [];
    total.value = (resp as any).total || 0;
  } catch (e) {
    console.error('[recycle-bin] load failed', e);
    ElMessage.error(t('recycleBin.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  query.pageNum = 1;
  loadList();
}
function handleReset() {
  query.entityType = undefined;
  query.entityName = undefined;
  query.startTime = undefined;
  query.endTime = undefined;
  timeRange.value = null;
  query.pageNum = 1;
  loadList();
}

async function handleRestore(row: RecycleBinItemVO) {
  await ElMessageBox.confirm(t('recycleBin.restoreConfirm', { name: row.entityName }), t('recycleBin.restore'), { type: 'warning' });
  try {
    await restoreRecycle(row.entityType, row.entityId);
    ElMessage.success(t('recycleBin.restoreSuccess'));
    loadList();
  } catch (e) {
    console.error('[recycle-bin] restore failed', e);
  }
}

async function handleArchive(row: RecycleBinItemVO) {
  await ElMessageBox.confirm(t('recycleBin.archiveConfirm', { name: row.entityName }), t('recycleBin.archive'), { type: 'warning' });
  try {
    await archiveRecycle(row.entityType, row.entityId);
    ElMessage.success(t('recycleBin.archiveSuccess'));
    loadList();
  } catch (e) {
    console.error('[recycle-bin] archive failed', e);
  }
}

loadEntityTypes();
loadList();
</script>

<style scoped>
.ticket-tag {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
