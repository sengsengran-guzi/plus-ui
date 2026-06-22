<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzNewsArticle.title') }}</span>
          <span class="ticket-tag">GZ-NEWS-003</span>
        </div>
      </template>

      <el-alert :title="t('gzNewsArticle.alertTitle')" type="info" :description="t('gzNewsArticle.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 查询表单 -->
      <el-form :model="query" inline @submit.prevent="handleQuery">
        <el-form-item :label="t('gzNewsArticle.colTitle')">
          <el-input v-model="query.title" :placeholder="t('gzNewsArticle.titlePlaceholder')" clearable style="width: 200px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item :label="t('gzNewsArticle.category')">
          <el-select v-model="query.categoryCode" :placeholder="t('gzNewsArticle.categoryPlaceholder')" clearable style="width: 160px">
            <el-option v-for="c in categoryOptions" :key="c.value" :label="c.label" :value="c.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzNewsArticle.status')">
          <el-select v-model="query.status" :placeholder="t('gzNewsArticle.statusPlaceholder')" clearable style="width: 160px">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleQuery">{{ t('gzNewsArticle.search') }}</el-button>
          <el-button :icon="Refresh" @click="handleReset">{{ t('gzNewsArticle.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 工具栏 -->
      <div class="mb-3">
        <el-button v-hasPermi="['gz:news:article:add']" type="primary" :icon="Plus" @click="handleAdd">{{ t('gzNewsArticle.add') }}</el-button>
      </div>

      <!-- 列表 -->
      <el-table :data="rows" border :row-class-name="rowClassName">
        <el-table-column :label="t('gzNewsArticle.colTitle')" prop="title" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag v-if="row.isPinned === 1" type="danger" size="small" class="mr-1">{{ t('gzNewsArticle.pinned') }}</el-tag>
            <span>{{ row.title }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzNewsArticle.category')" prop="categoryCode" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="categoryTagType(row.categoryCode)" size="small">{{ categoryLabel(row.categoryCode) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzNewsArticle.status')" prop="status" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzNewsArticle.colPublishTime')" prop="publishTime" width="170" align="center">
          <template #default="{ row }">{{ row.publishTime || (row.status === 'scheduled' ? row.schedulePublishTime + ' (定时)' : '-') }}</template>
        </el-table-column>
        <el-table-column :label="t('gzNewsArticle.colReadCount')" prop="readCount" width="90" align="center" />
        <el-table-column :label="t('gzNewsArticle.colAction')" fixed="right" width="280" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:news:article:edit']" type="primary" link size="small" @click="handleEdit(row)">{{ t('gzNewsArticle.edit') }}</el-button>
            <el-button v-if="row.status === 'draft' || row.status === 'offline' || row.status === 'scheduled'" v-hasPermi="['gz:news:article:publish']" type="success" link size="small" @click="handlePublish(row)">
              {{ t('gzNewsArticle.publish') }}
            </el-button>
            <el-button v-if="row.status === 'draft'" v-hasPermi="['gz:news:article:publish']" type="warning" link size="small" @click="handleSchedule(row)">{{ t('gzNewsArticle.schedule') }}</el-button>
            <el-button v-if="row.status === 'scheduled'" v-hasPermi="['gz:news:article:publish']" type="warning" link size="small" @click="handleCancelSchedule(row)">{{ t('gzNewsArticle.cancelSchedule') }}</el-button>
            <el-button v-if="row.status === 'published'" v-hasPermi="['gz:news:article:offline']" type="info" link size="small" @click="handleOffline(row)">{{ t('gzNewsArticle.offline') }}</el-button>
            <el-button v-hasPermi="['gz:news:article:delete']" type="danger" link size="small" @click="handleDel(row)">{{ t('gzNewsArticle.del') }}</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('gzNewsArticle.empty')" /></template>
      </el-table>

      <pagination v-show="total > 0" v-model:limit="query.pageSize" v-model:page="query.pageNum" :total="total" @pagination="loadList" />
    </el-card>

    <!-- 新建 / 编辑弹窗（富文本） -->
    <el-dialog v-model="formVisible" :title="formTitle" width="900px" top="5vh" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="16">
            <el-form-item :label="t('gzNewsArticle.colTitle')" prop="title">
              <el-input v-model="form.title" maxlength="128" show-word-limit />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="t('gzNewsArticle.category')" prop="categoryCode">
              <el-select v-model="form.categoryCode" style="width: 100%">
                <el-option v-for="c in categoryOptions" :key="c.value" :label="c.label" :value="c.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item :label="t('gzNewsArticle.summary')">
          <el-input v-model="form.summary" type="textarea" :rows="2" maxlength="255" show-word-limit :placeholder="t('gzNewsArticle.summaryPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('gzNewsArticle.cover')">
          <el-input v-model="form.coverUrl" :placeholder="t('gzNewsArticle.coverPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('gzNewsArticle.content')" prop="contentHtml">
          <NewsEditor v-model="form.contentHtml" :height="420" />
          <div class="editor-meta">{{ t('gzNewsArticle.wordCount') }}：{{ wordCount }} · {{ t('gzNewsArticle.readMinutes') }}：{{ readMinutes }} min</div>
        </el-form-item>
        <el-form-item :label="t('gzNewsArticle.videoUrls')">
          <el-input v-model="form.videoUrls" type="textarea" :rows="2" maxlength="1024" :placeholder="t('gzNewsArticle.videoUrlsPlaceholder')" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item :label="t('gzNewsArticle.pinned')">
              <el-switch v-model="pinnedBool" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="t('gzNewsArticle.sortNo')">
              <el-input-number v-model="form.sortNo" :min="0" :max="9999" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('gzNewsArticle.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('gzNewsArticle.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 定时发布弹窗 -->
    <el-dialog v-model="scheduleVisible" :title="t('gzNewsArticle.scheduleTitle')" width="420px">
      <el-form label-width="100px">
        <el-form-item :label="t('gzNewsArticle.scheduleTime')">
          <el-date-picker v-model="scheduleTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" :placeholder="t('gzNewsArticle.scheduleTimePlaceholder')" :disabled-date="disabledPastDate" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scheduleVisible = false">{{ t('gzNewsArticle.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="confirmSchedule">{{ t('gzNewsArticle.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzNewsArticle">
import { ref, reactive, computed, watch } from 'vue';
import { Search, Refresh, Plus } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { useI18n } from 'vue-i18n';
import NewsEditor from './components/NewsEditor.vue';
import {
  listGzNewsArticle,
  getGzNewsArticle,
  addGzNewsArticle,
  updateGzNewsArticle,
  delGzNewsArticle,
  publishGzNewsArticle,
  scheduleGzNewsArticle,
  cancelScheduleGzNewsArticle,
  offlineGzNewsArticle,
  type GzNewsArticleVO,
  type GzNewsArticleForm,
  type GzNewsArticleQuery
} from '@/api/gz-news/article';

const { t } = useI18n();

const loading = ref(false);
const submitting = ref(false);
const rows = ref<GzNewsArticleVO[]>([]);
const total = ref(0);

const query = reactive<GzNewsArticleQuery>({ pageNum: 1, pageSize: 10 });

// 分类 / 状态选项（doc/10 附录 A.11 / A.4；mp 端走前端 i18n，admin 用本地映射）
const categoryOptions = computed(() => [
  { value: 'new_product', label: t('gzNewsArticle.catNewProduct') },
  { value: 'activity', label: t('gzNewsArticle.catActivity') },
  { value: 'guide', label: t('gzNewsArticle.catGuide') },
  { value: 'announcement', label: t('gzNewsArticle.catAnnouncement') }
]);
const statusOptions = computed(() => [
  { value: 'draft', label: t('gzNewsArticle.stDraft') },
  { value: 'scheduled', label: t('gzNewsArticle.stScheduled') },
  { value: 'published', label: t('gzNewsArticle.stPublished') },
  { value: 'offline', label: t('gzNewsArticle.stOffline') }
]);

function categoryLabel(code: string) {
  return categoryOptions.value.find((c) => c.value === code)?.label || code;
}
function categoryTagType(code: string): 'success' | 'warning' | 'primary' | 'info' {
  const map: Record<string, 'success' | 'warning' | 'primary' | 'info'> = { new_product: 'success', activity: 'warning', guide: 'primary', announcement: 'info' };
  return map[code] || 'info';
}
function statusLabel(s: string) {
  return statusOptions.value.find((o) => o.value === s)?.label || s;
}
function statusTagType(s: string): 'info' | 'warning' | 'success' | 'danger' {
  const map: Record<string, 'info' | 'warning' | 'success' | 'danger'> = { draft: 'info', scheduled: 'warning', published: 'success', offline: 'danger' };
  return map[s] || 'info';
}
function rowClassName({ row }: { row: GzNewsArticleVO }) {
  return row.isPinned === 1 ? 'pinned-row' : '';
}

// ---------------- 列表 ----------------
async function loadList() {
  loading.value = true;
  try {
    const resp = await listGzNewsArticle(query);
    rows.value = (resp as any).rows || [];
    total.value = (resp as any).total || 0;
  } catch (e) {
    console.error('[gz-news-article] load failed', e);
    ElMessage.error(t('gzNewsArticle.loadFailed'));
  } finally {
    loading.value = false;
  }
}
function handleQuery() {
  query.pageNum = 1;
  loadList();
}
function handleReset() {
  query.title = undefined;
  query.categoryCode = undefined;
  query.status = undefined;
  query.pageNum = 1;
  loadList();
}

// ---------------- 新建 / 编辑 ----------------
const formVisible = ref(false);
const formMode = ref<'add' | 'edit'>('add');
const formRef = ref<FormInstance>();
const form = reactive<GzNewsArticleForm>({ categoryCode: 'new_product', contentHtml: '', isPinned: '0', sortNo: 0 });

const pinnedBool = computed({
  get: () => form.isPinned === '1',
  set: (v: boolean) => (form.isPinned = v ? '1' : '0')
});

const formTitle = computed(() => (formMode.value === 'add' ? t('gzNewsArticle.addDialogTitle') : t('gzNewsArticle.editDialogTitle')));

const rules = {
  title: [{ required: true, message: t('gzNewsArticle.ruleTitleRequired'), trigger: 'blur' }],
  categoryCode: [{ required: true, message: t('gzNewsArticle.ruleCategoryRequired'), trigger: 'change' }],
  contentHtml: [{ required: true, message: t('gzNewsArticle.ruleContentRequired'), trigger: 'change' }]
};

// 字数 / 阅读时长实时统计（AC3）
const wordCount = computed(() => {
  const text = (form.contentHtml || '').replace(/<[^>]+>/g, '').replace(/\s+/g, '');
  return text.length;
});
const readMinutes = computed(() => Math.max(1, Math.ceil(wordCount.value / 400)));

function handleAdd() {
  formMode.value = 'add';
  resetForm();
  formVisible.value = true;
}
async function handleEdit(row: GzNewsArticleVO) {
  formMode.value = 'edit';
  try {
    const resp = await getGzNewsArticle(row.id);
    const d = (resp as any).data as GzNewsArticleVO;
    Object.assign(form, {
      id: d.id,
      title: d.title,
      summary: d.summary,
      categoryCode: d.categoryCode,
      coverUrl: d.coverUrl,
      coverFileId: d.coverFileId,
      contentHtml: d.contentHtml || '',
      videoUrls: d.videoUrls,
      isPinned: d.isPinned === 1 ? '1' : '0',
      sortNo: d.sortNo ?? 0
    });
    formVisible.value = true;
  } catch (e) {
    console.error('[gz-news-article] detail failed', e);
    ElMessage.error(t('gzNewsArticle.detailFailed'));
  }
}
function resetForm() {
  formRef.value?.resetFields();
  Object.assign(form, { id: null, title: '', summary: '', categoryCode: 'new_product', coverUrl: '', coverFileId: null, contentHtml: '', videoUrls: '', isPinned: '0', sortNo: 0 });
}
async function handleSubmit() {
  await formRef.value?.validate(async (valid) => {
    if (!valid) return;
    submitting.value = true;
    try {
      if (formMode.value === 'add') {
        await addGzNewsArticle(form);
        ElMessage.success(t('gzNewsArticle.addSuccess'));
      } else {
        await updateGzNewsArticle(form);
        ElMessage.success(t('gzNewsArticle.editSuccess'));
      }
      formVisible.value = false;
      loadList();
    } catch (e) {
      console.error('[gz-news-article] submit failed', e);
    } finally {
      submitting.value = false;
    }
  });
}

// ---------------- 状态流转 ----------------
async function handlePublish(row: GzNewsArticleVO) {
  await ElMessageBox.confirm(t('gzNewsArticle.publishConfirm', { title: row.title }), t('gzNewsArticle.confirmTitle'), { type: 'warning' });
  await publishGzNewsArticle(row.id);
  ElMessage.success(t('gzNewsArticle.publishSuccess'));
  loadList();
}
async function handleOffline(row: GzNewsArticleVO) {
  await ElMessageBox.confirm(t('gzNewsArticle.offlineConfirm', { title: row.title }), t('gzNewsArticle.confirmTitle'), { type: 'warning' });
  await offlineGzNewsArticle(row.id);
  ElMessage.success(t('gzNewsArticle.offlineSuccess'));
  loadList();
}
async function handleCancelSchedule(row: GzNewsArticleVO) {
  await ElMessageBox.confirm(t('gzNewsArticle.cancelScheduleConfirm', { title: row.title }), t('gzNewsArticle.confirmTitle'), { type: 'warning' });
  await cancelScheduleGzNewsArticle(row.id);
  ElMessage.success(t('gzNewsArticle.cancelScheduleSuccess'));
  loadList();
}
async function handleDel(row: GzNewsArticleVO) {
  await ElMessageBox.confirm(t('gzNewsArticle.delConfirm', { title: row.title }), t('gzNewsArticle.confirmTitle'), { type: 'warning' });
  await delGzNewsArticle(row.id);
  ElMessage.success(t('gzNewsArticle.delSuccess'));
  loadList();
}

// 定时发布
const scheduleVisible = ref(false);
const scheduleTime = ref<string>('');
const scheduleTargetId = ref<string>('');
function disabledPastDate(date: Date) {
  return date.getTime() < Date.now() - 86400000;
}
function handleSchedule(row: GzNewsArticleVO) {
  scheduleTargetId.value = row.id;
  scheduleTime.value = '';
  scheduleVisible.value = true;
}
async function confirmSchedule() {
  if (!scheduleTime.value) {
    ElMessage.warning(t('gzNewsArticle.scheduleTimePlaceholder'));
    return;
  }
  if (new Date(scheduleTime.value).getTime() <= Date.now()) {
    ElMessage.error(t('gzNewsArticle.scheduleFuture'));
    return;
  }
  submitting.value = true;
  try {
    await scheduleGzNewsArticle(scheduleTargetId.value, scheduleTime.value);
    ElMessage.success(t('gzNewsArticle.scheduleSuccess'));
    scheduleVisible.value = false;
    loadList();
  } catch (e) {
    console.error('[gz-news-article] schedule failed', e);
  } finally {
    submitting.value = false;
  }
}

loadList();
</script>

<style scoped>
.ticket-tag {
  font-size: 12px;
  color: #909399;
}
.editor-meta {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}
:deep(.pinned-row) {
  background-color: var(--el-color-danger-light-9);
}
</style>
