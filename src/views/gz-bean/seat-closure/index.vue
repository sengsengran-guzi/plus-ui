<template>
  <div class="p-2">
    <el-card v-loading="pageLoading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzBeanSeatClosure.title') }}</span>
        </div>
      </template>

      <el-alert
        :title="t('gzBeanSeatClosure.alertTitle')"
        type="info"
        :description="t('gzBeanSeatClosure.alertDesc')"
        show-icon
        :closable="false"
        class="mb-3"
      />

      <!-- 筛选 + 操作 -->
      <el-form inline class="mb-2" @submit.prevent="handleQuery">
        <el-form-item :label="t('gzBeanSeatClosure.store')">
          <el-select v-model="currentStoreId" filterable style="width: 220px" @change="onStoreChange">
            <el-option v-for="s in storeOptions" :key="s.id" :label="`${s.storeNo} · ${s.name}`" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatClosure.seat')">
          <el-select
            v-model="query.seatId"
            clearable
            filterable
            :placeholder="t('gzBeanSeatClosure.seatAll')"
            style="width: 200px"
            @change="handleQuery"
          >
            <el-option v-for="s in seatOptions" :key="s.id" :label="seatOptionLabel(s)" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatClosure.weekday')">
          <el-select v-model="query.weekday" clearable :placeholder="t('gzBeanSeatClosure.weekdayAll')" style="width: 120px" @change="handleQuery">
            <el-option v-for="d in weekdays" :key="d" :label="t('gzBeanSeatClosure.week' + d)" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatClosure.enabled')">
          <el-select v-model="query.enabled" clearable :placeholder="t('gzBeanSeatClosure.enabledAll')" style="width: 120px" @change="handleQuery">
            <el-option :label="t('gzBeanSeatClosure.enabledYes')" :value="1" />
            <el-option :label="t('gzBeanSeatClosure.enabledNo')" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button v-hasPermi="['gz:bean:seatClosure:list']" type="primary" :icon="Search" @click="handleQuery">
            {{ t('gzBeanSeatClosure.search') }}
          </el-button>
          <el-button :icon="Refresh" @click="handleReset">{{ t('gzBeanSeatClosure.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 工具栏 -->
      <el-row :gutter="10" class="mb-2">
        <el-col :span="1.5">
          <el-button v-hasPermi="['gz:bean:seatClosure:add']" type="primary" plain :icon="Plus" :disabled="!currentStoreId" @click="openAdd">{{
            t('gzBeanSeatClosure.add')
          }}</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button
            v-hasPermi="['gz:bean:seatClosure:remove']"
            type="danger"
            plain
            :icon="Delete"
            :disabled="selectedIds.length === 0"
            @click="handleBatchDel"
            >{{ t('gzBeanSeatClosure.batchDel') }}</el-button
          >
        </el-col>
      </el-row>

      <!-- 列表 -->
      <el-table v-loading="listLoading" :data="rows" border stripe size="small" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="46" align="center" />
        <el-table-column :label="t('gzBeanSeatClosure.colStore')" width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.storeName || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeatClosure.colSeatNo')" width="130" align="center">
          <template #default="{ row }">
            <span>{{ row.seatNo || row.seatId }}</span>
            <el-tag v-if="row.typeName" type="info" size="small" class="ml-1">{{ row.typeName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeatClosure.colWeekday')" width="90" align="center">
          <template #default="{ row }">{{ t('gzBeanSeatClosure.week' + row.weekday) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeatClosure.colTimeRange')" width="150" align="center">
          <template #default="{ row }">{{ hhmm(row.timeStart) }} - {{ hhmm(row.timeEnd) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeatClosure.colEnabled')" width="80" align="center">
          <template #default="{ row }">
            <el-switch
              v-hasPermi="['gz:bean:seatClosure:edit']"
              :model-value="row.enabled === 1"
              :active-value="true"
              :inactive-value="false"
              @change="(v: boolean) => handleToggleEnabled(row, v ? 1 : 0)"
            />
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeatClosure.colRemark')" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeatClosure.colAction')" fixed="right" width="150" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:bean:seatClosure:edit']" type="success" link size="small" @click="openEdit(row)">
              {{ t('gzBeanSeatClosure.edit') }}
            </el-button>
            <el-button v-hasPermi="['gz:bean:seatClosure:remove']" type="danger" link size="small" @click="handleDel(row)">
              {{ t('gzBeanSeatClosure.del') }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="t('gzBeanSeatClosure.empty')" />
        </template>
      </el-table>

      <pagination v-show="total > 0" v-model:limit="query.pageSize" v-model:page="query.pageNum" :total="total" @pagination="loadList" />
    </el-card>

    <!-- 批量新建弹窗：多选座位 × 多选星期 × 时段 -->
    <el-dialog v-model="addVisible" :title="t('gzBeanSeatClosure.addTitle')" width="560px" @close="resetAddForm">
      <el-alert type="info" :closable="false" show-icon class="mb-3" :description="t('gzBeanSeatClosure.addDesc')" />
      <el-form ref="addFormRef" :model="addForm" :rules="addRules" label-width="100px">
        <el-form-item :label="t('gzBeanSeatClosure.seat')" prop="seatIds">
          <el-select
            v-model="addForm.seatIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            :placeholder="t('gzBeanSeatClosure.seatSelectPlaceholder')"
            style="width: 100%"
          >
            <el-option v-for="s in seatOptions" :key="s.id" :label="seatOptionLabel(s)" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatClosure.weekday')" prop="weekdays">
          <el-checkbox-group v-model="addForm.weekdays">
            <el-checkbox v-for="d in weekdays" :key="d" :value="d">{{ t('gzBeanSeatClosure.week' + d) }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatClosure.timeRange')" prop="startHour">
          <el-select v-model="addForm.startHour" :placeholder="t('gzBeanSeatClosure.startPlaceholder')" style="width: 130px">
            <el-option v-for="h in hourOptions" :key="h" :label="hourLabel(h)" :value="h" />
          </el-select>
          <span class="range-sep">{{ t('gzBeanSeatClosure.rangeTo') }}</span>
          <el-select v-model="addForm.endHour" :placeholder="t('gzBeanSeatClosure.endPlaceholder')" style="width: 130px">
            <el-option v-for="h in endHourOptions" :key="h" :label="hourLabel(h)" :value="h" />
          </el-select>
          <span class="form-hint">{{ t('gzBeanSeatClosure.timeRangeHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatClosure.colRemark')">
          <el-input v-model="addForm.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addVisible = false">{{ t('gzBeanSeatClosure.cancel') }}</el-button>
        <el-button type="primary" :loading="addSubmitting" @click="handleAddSubmit">{{ t('gzBeanSeatClosure.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 编辑单条弹窗：启停 / 时段 -->
    <el-dialog v-model="editVisible" :title="t('gzBeanSeatClosure.editTitle')" width="460px">
      <el-form label-width="100px">
        <el-form-item :label="t('gzBeanSeatClosure.colSeatNo')">
          <span>{{ editForm.seatNo || editForm.seatId }}</span>
          <span class="ml-2 text-gray">{{ t('gzBeanSeatClosure.week' + editForm.weekday) }}</span>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatClosure.timeRange')">
          <el-select v-model="editForm.startHour" :placeholder="t('gzBeanSeatClosure.startPlaceholder')" style="width: 130px">
            <el-option v-for="h in hourOptions" :key="h" :label="hourLabel(h)" :value="h" />
          </el-select>
          <span class="range-sep">{{ t('gzBeanSeatClosure.rangeTo') }}</span>
          <el-select v-model="editForm.endHour" :placeholder="t('gzBeanSeatClosure.endPlaceholder')" style="width: 130px">
            <el-option v-for="h in editEndHourOptions" :key="h" :label="hourLabel(h)" :value="h" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatClosure.colEnabled')">
          <el-switch
            :model-value="editForm.enabled === 1"
            :active-value="true"
            :inactive-value="false"
            @update:model-value="(v: boolean) => (editForm.enabled = v ? 1 : 0)"
          />
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatClosure.colRemark')">
          <el-input v-model="editForm.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">{{ t('gzBeanSeatClosure.cancel') }}</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="handleEditSubmit">{{ t('gzBeanSeatClosure.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzBeanSeatClosure">
import { ref, reactive, computed, onMounted } from 'vue';
import { Plus, Refresh, Search, Delete } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { getGzBeanStoreOptions, type GzBeanStoreVO } from '@/api/gz-bean/store';
import { listGzBeanSeatByStore, type GzBeanSeatVO } from '@/api/gz-bean/seat';
import {
  listGzBeanSeatClosure,
  addGzBeanSeatClosure,
  updateGzBeanSeatClosure,
  delGzBeanSeatClosure,
  type GzBeanSeatClosureVO,
  type GzBeanSeatClosureQuery
} from '@/api/gz-bean/seatClosure';

const { t } = useI18n();

const pageLoading = ref(false);
const listLoading = ref(false);

const weekdays = [1, 2, 3, 4, 5, 6, 7];
/** 整点小时下拉（起：0-23；止：1-24，24 = 次日凌晨/营业末，但本管理按 0-24 整点对齐 1h 格） */
const hourOptions = Array.from({ length: 24 }, (_, i) => i); // 0..23 起整点
const allEndHours = Array.from({ length: 24 }, (_, i) => i + 1); // 1..24 止整点

const storeOptions = ref<GzBeanStoreVO[]>([]);
const currentStoreId = ref<number | null>(null);
/** 当前门店全量座位（多选 / 筛选 / 行展示回填用） */
const seatOptions = ref<GzBeanSeatVO[]>([]);

const rows = ref<GzBeanSeatClosureVO[]>([]);
const total = ref(0);
const selectedIds = ref<string[]>([]);

const query = reactive<GzBeanSeatClosureQuery>({
  pageNum: 1,
  pageSize: 10,
  storeId: null,
  seatId: null,
  weekday: null,
  enabled: null
});

// ============ helpers ============
/** "HH:mm:ss" / "HH:mm" → "HH:mm" 显示 */
function hhmm(time: string | null | undefined): string {
  if (!time) return '-';
  return time.length >= 5 ? time.slice(0, 5) : time;
}

/** 整点小时 → "HH:00" 列头 / 选项标签 */
function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

/** 整点小时 → "HH:00:00" 提交值 */
function hourToTime(h: number): string {
  return `${String(h).padStart(2, '0')}:00:00`;
}

/** "HH:mm:ss" → 整点小时（0-24）；非法返回 null */
function timeToHour(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = /^(\d{1,2}):/.exec(time);
  if (!m) return null;
  const h = Number(m[1]);
  return Number.isInteger(h) && h >= 0 && h <= 24 ? h : null;
}

/** 座位下拉标签：座位号 + 桌型名 */
function seatOptionLabel(s: GzBeanSeatVO): string {
  const type = s.typeName ? `（${s.typeName}）` : '';
  return `${s.seatNo}${type}`;
}

// ============ 门店 / 座位选项 ============
async function loadStoreOptions() {
  pageLoading.value = true;
  try {
    const resp = await getGzBeanStoreOptions();
    const r = resp as any;
    storeOptions.value = (r.data || r || []) as GzBeanStoreVO[];
    if (storeOptions.value.length > 0 && currentStoreId.value == null) {
      currentStoreId.value = storeOptions.value[0].id;
      await onStoreChange(currentStoreId.value);
    }
  } catch (e) {
    console.error('[gz-bean-seat-closure] loadStoreOptions failed', e);
    ElMessage.error(t('gzBeanSeatClosure.loadFailed'));
  } finally {
    pageLoading.value = false;
  }
}

async function loadSeatOptions() {
  if (!currentStoreId.value) {
    seatOptions.value = [];
    return;
  }
  try {
    const resp = await listGzBeanSeatByStore(currentStoreId.value);
    const r = resp as any;
    seatOptions.value = (r.data || r || []) as GzBeanSeatVO[];
  } catch (e) {
    console.error('[gz-bean-seat-closure] loadSeatOptions failed', e);
  }
}

async function onStoreChange(id: number) {
  currentStoreId.value = id;
  query.seatId = null;
  await loadSeatOptions();
  handleQuery();
}

// ============ 列表 ============
async function loadList() {
  if (!currentStoreId.value) return;
  listLoading.value = true;
  try {
    query.storeId = currentStoreId.value;
    const resp = await listGzBeanSeatClosure(query);
    rows.value = (resp as any).rows || [];
    total.value = (resp as any).total || 0;
  } catch (e) {
    console.error('[gz-bean-seat-closure] loadList failed', e);
    ElMessage.error(t('gzBeanSeatClosure.loadFailed'));
  } finally {
    listLoading.value = false;
  }
}

function handleQuery() {
  query.pageNum = 1;
  loadList();
}

function handleReset() {
  query.seatId = null;
  query.weekday = null;
  query.enabled = null;
  query.pageNum = 1;
  loadList();
}

function onSelectionChange(sel: GzBeanSeatClosureVO[]) {
  selectedIds.value = sel.map((r) => r.id);
}

// ============ 批量新建 ============
interface AddFormState {
  seatIds: string[];
  weekdays: number[];
  startHour: number | null;
  endHour: number | null;
  remark: string;
}
const addVisible = ref(false);
const addSubmitting = ref(false);
const addFormRef = ref<FormInstance>();
const addForm = reactive<AddFormState>({
  seatIds: [],
  weekdays: [],
  startHour: null,
  endHour: null,
  remark: ''
});

/** 新建时止整点选项：须 > 起整点（保证 [start,end) 非空） */
const endHourOptions = computed<number[]>(() => {
  const s = addForm.startHour;
  return allEndHours.filter((h) => (s == null ? true : h > s));
});

const addRules: FormRules = {
  seatIds: [{ required: true, type: 'array', min: 1, message: t('gzBeanSeatClosure.ruleSeatRequired'), trigger: 'change' }],
  weekdays: [{ required: true, type: 'array', min: 1, message: t('gzBeanSeatClosure.ruleWeekdayRequired'), trigger: 'change' }],
  startHour: [{ required: true, message: t('gzBeanSeatClosure.ruleTimeRequired'), trigger: 'change' }]
};

function openAdd() {
  Object.assign(addForm, { seatIds: [], weekdays: [], startHour: null, endHour: null, remark: '' });
  addVisible.value = true;
}

function resetAddForm() {
  addFormRef.value?.clearValidate();
}

async function handleAddSubmit() {
  if (!addFormRef.value || !currentStoreId.value) return;
  await addFormRef.value.validate();
  if (addForm.startHour == null || addForm.endHour == null) {
    ElMessage.warning(t('gzBeanSeatClosure.ruleTimeRequired'));
    return;
  }
  if (addForm.endHour <= addForm.startHour) {
    ElMessage.warning(t('gzBeanSeatClosure.ruleEndAfterStart'));
    return;
  }
  addSubmitting.value = true;
  try {
    await addGzBeanSeatClosure({
      storeId: currentStoreId.value,
      seatIds: addForm.seatIds,
      weekdays: [...addForm.weekdays],
      timeStart: hourToTime(addForm.startHour),
      timeEnd: hourToTime(addForm.endHour),
      remark: addForm.remark || null
    });
    ElMessage.success(t('gzBeanSeatClosure.addSuccess'));
    addVisible.value = false;
    await loadList();
  } catch (e) {
    console.error('[gz-bean-seat-closure] add failed', e);
  } finally {
    addSubmitting.value = false;
  }
}

// ============ 编辑单条 ============
interface EditFormState {
  id: string;
  seatId: string;
  seatNo: string | null;
  weekday: number;
  startHour: number | null;
  endHour: number | null;
  enabled: number;
  remark: string;
}
const editVisible = ref(false);
const editSubmitting = ref(false);
const editForm = reactive<EditFormState>({
  id: '',
  seatId: '',
  seatNo: null,
  weekday: 1,
  startHour: null,
  endHour: null,
  enabled: 1,
  remark: ''
});

const editEndHourOptions = computed<number[]>(() => {
  const s = editForm.startHour;
  return allEndHours.filter((h) => (s == null ? true : h > s));
});

function openEdit(row: GzBeanSeatClosureVO) {
  Object.assign(editForm, {
    id: row.id,
    seatId: row.seatId,
    seatNo: row.seatNo ?? null,
    weekday: row.weekday,
    startHour: timeToHour(row.timeStart),
    endHour: timeToHour(row.timeEnd),
    enabled: row.enabled,
    remark: row.remark || ''
  });
  editVisible.value = true;
}

async function handleEditSubmit() {
  if (!editForm.id) return;
  if (editForm.startHour == null || editForm.endHour == null) {
    ElMessage.warning(t('gzBeanSeatClosure.ruleTimeRequired'));
    return;
  }
  if (editForm.endHour <= editForm.startHour) {
    ElMessage.warning(t('gzBeanSeatClosure.ruleEndAfterStart'));
    return;
  }
  editSubmitting.value = true;
  try {
    await updateGzBeanSeatClosure({
      id: editForm.id,
      timeStart: hourToTime(editForm.startHour),
      timeEnd: hourToTime(editForm.endHour),
      enabled: editForm.enabled,
      remark: editForm.remark || null
    });
    ElMessage.success(t('gzBeanSeatClosure.editSuccess'));
    editVisible.value = false;
    await loadList();
  } catch (e) {
    console.error('[gz-bean-seat-closure] edit failed', e);
  } finally {
    editSubmitting.value = false;
  }
}

async function handleToggleEnabled(row: GzBeanSeatClosureVO, enabled: number) {
  try {
    await updateGzBeanSeatClosure({ id: row.id, enabled });
    ElMessage.success(t('gzBeanSeatClosure.editSuccess'));
    await loadList();
  } catch (e) {
    console.error('[gz-bean-seat-closure] toggle failed', e);
    await loadList(); // 失败回滚 switch 视图
  }
}

// ============ 删除 ============
async function handleDel(row: GzBeanSeatClosureVO) {
  try {
    await ElMessageBox.confirm(t('gzBeanSeatClosure.delConfirm', { seat: row.seatNo || row.seatId }), t('gzBeanSeatClosure.confirmTitle'), {
      type: 'warning'
    });
    await delGzBeanSeatClosure(row.id);
    ElMessage.success(t('gzBeanSeatClosure.delSuccess'));
    await loadList();
  } catch (e: any) {
    if (e !== 'cancel') console.error('[gz-bean-seat-closure] del failed', e);
  }
}

async function handleBatchDel() {
  if (selectedIds.value.length === 0) return;
  try {
    await ElMessageBox.confirm(t('gzBeanSeatClosure.batchDelConfirm', { count: selectedIds.value.length }), t('gzBeanSeatClosure.confirmTitle'), {
      type: 'warning'
    });
    await delGzBeanSeatClosure(selectedIds.value);
    ElMessage.success(t('gzBeanSeatClosure.delSuccess'));
    selectedIds.value = [];
    await loadList();
  } catch (e: any) {
    if (e !== 'cancel') console.error('[gz-bean-seat-closure] batch del failed', e);
  }
}

onMounted(() => {
  loadStoreOptions();
});
</script>

<style scoped>
.form-hint {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}
.range-sep {
  margin: 0 8px;
  color: #606266;
}
.text-gray {
  color: #909399;
}
</style>
