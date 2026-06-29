<template>
  <div class="p-2">
    <el-card v-loading="pageLoading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzBeanSeatTypeConfig.title') }}</span>
          <span class="ticket-tag">GZ-BEAN-020</span>
        </div>
      </template>

      <el-alert
        :title="t('gzBeanSeatTypeConfig.alertTitle')"
        type="info"
        :description="t('gzBeanSeatTypeConfig.alertDesc')"
        show-icon
        :closable="false"
        class="mb-3"
      />

      <!-- 门店选择 -->
      <el-form inline class="mb-2">
        <el-form-item :label="t('gzBeanSeatTypeConfig.store')">
          <el-select v-model="currentStoreId" style="width: 240px" @change="onStoreChange">
            <el-option v-for="s in storeOptions" :key="s.id" :label="`${s.storeNo} · ${s.name}`" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button
            v-hasPermi="['gz:bean:seatTypeConfig:add']"
            type="primary"
            plain
            :icon="Plus"
            :disabled="!currentStoreId"
            @click="handleAdd"
          >{{ t('gzBeanSeatTypeConfig.add') }}</el-button>
          <el-button :icon="Refresh" @click="loadList">{{ t('gzBeanSeatTypeConfig.refresh') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="listLoading" :data="list" border stripe size="small">
        <el-table-column :label="t('gzBeanSeatTypeConfig.colId')" prop="id" width="70" align="center" />
        <el-table-column :label="t('gzBeanSeatTypeConfig.colName')" prop="name" min-width="140" show-overflow-tooltip />
        <el-table-column :label="t('gzBeanSeatTypeConfig.colBookMode')" width="130" align="center">
          <template #default="{ row }">
            <el-tag :type="row.bookMode === 'seat' ? 'warning' : 'success'" size="small">
              {{ row.bookMode === 'seat' ? t('gzBeanSeatTypeConfig.bookModeSeat') : t('gzBeanSeatTypeConfig.bookModeWhole') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeatTypeConfig.colCapacity')" prop="capacity" width="100" align="center" />
        <el-table-column :label="t('gzBeanSeatTypeConfig.colQuantity')" prop="quantity" width="90" align="center" />
        <el-table-column :label="t('gzBeanSeatTypeConfig.colPriceYuan')" width="120" align="right">
          <template #default="{ row }">¥{{ formatYuan(row.priceCent) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeatTypeConfig.colEnabled')" width="80" align="center">
          <template #default="{ row }">
            <el-switch
              v-hasPermi="['gz:bean:seatTypeConfig:edit']"
              :model-value="row.enabled === 1"
              :active-value="true"
              :inactive-value="false"
              @change="(v: boolean) => handleToggleEnabled(row, v ? 1 : 0)"
            />
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeatTypeConfig.colSortNo')" prop="sortNo" width="70" align="center" />
        <el-table-column :label="t('gzBeanSeatTypeConfig.colAction')" fixed="right" width="200" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:bean:seatTypeConfig:edit']" type="primary" link size="small" @click="handleWeekdayPrice(row)">
              {{ t('gzBeanSeatTypeConfig.weekdayPrice') }}
            </el-button>
            <el-button v-hasPermi="['gz:bean:seatTypeConfig:edit']" type="success" link size="small" @click="handleEdit(row)">
              {{ t('gzBeanSeatTypeConfig.edit') }}
            </el-button>
            <el-button v-hasPermi="['gz:bean:seatTypeConfig:remove']" type="danger" link size="small" @click="handleDel(row)">
              {{ t('gzBeanSeatTypeConfig.del') }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="t('gzBeanSeatTypeConfig.empty')" />
        </template>
      </el-table>
    </el-card>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="formTitle" width="520px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item :label="t('gzBeanSeatTypeConfig.colName')" prop="name">
          <el-input v-model="form.name" maxlength="32" :placeholder="t('gzBeanSeatTypeConfig.namePlaceholder')" />
          <span class="form-hint">{{ t('gzBeanSeatTypeConfig.nameHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatTypeConfig.colBookMode')" prop="bookMode">
          <el-select v-model="form.bookMode" :placeholder="t('gzBeanSeatTypeConfig.bookModePlaceholder')" style="width: 100%">
            <el-option :label="t('gzBeanSeatTypeConfig.bookModeWhole')" value="whole" />
            <el-option :label="t('gzBeanSeatTypeConfig.bookModeSeat')" value="seat" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatTypeConfig.colCapacity')" prop="capacity">
          <el-input-number v-model="form.capacity" :min="1" :max="99" />
          <span class="form-hint">{{ t('gzBeanSeatTypeConfig.capacityHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatTypeConfig.colQuantity')" prop="quantity">
          <el-input-number v-model="form.quantity" :min="0" :max="9999" />
          <span class="form-hint">{{ t('gzBeanSeatTypeConfig.quantityHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatTypeConfig.colPriceYuan')" prop="priceYuan">
          <el-input-number v-model="form.priceYuan" :min="0" :precision="2" :step="1" />
          <span class="form-hint">{{ t('gzBeanSeatTypeConfig.priceHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatTypeConfig.colEnabled')">
          <el-switch
            :model-value="form.enabled === 1"
            :active-value="true"
            :inactive-value="false"
            @update:model-value="(v: boolean) => (form.enabled = v ? 1 : 0)"
          />
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatTypeConfig.colSortNo')">
          <el-input-number v-model="form.sortNo" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatTypeConfig.colRemark')">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('gzBeanSeatTypeConfig.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('gzBeanSeatTypeConfig.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 星期 × 1h 格价格网格弹窗 -->
    <el-dialog
      v-model="wpVisible"
      :title="t('gzBeanSeatTypeConfig.weekdayPriceTitle', { name: wpName })"
      width="80%"
      top="6vh"
    >
      <el-alert type="info" :closable="false" show-icon class="mb-3">
        <template #default>
          <div>{{ t('gzBeanSeatTypeConfig.gridDescBase', { base: formatYuan(wpBaseCent) }) }}</div>
          <div class="grid-rule-hint">{{ t('gzBeanSeatTypeConfig.gridDescRule') }}</div>
        </template>
      </el-alert>

      <div v-loading="wpLoading">
        <el-empty v-if="hourSlots.length === 0" :description="t('gzBeanSeatTypeConfig.gridNoSlot')" />
        <el-table v-else :data="gridRows" border size="small" class="wp-grid">
          <el-table-column
            :label="t('gzBeanSeatTypeConfig.gridColWeekday')"
            prop="weekdayLabel"
            width="84"
            align="center"
            fixed="left"
          />
          <!-- 整天默认列（slotStart = null） -->
          <el-table-column :label="t('gzBeanSeatTypeConfig.gridColAllDay')" width="130" align="center">
            <template #default="{ row }">
              <el-input-number
                v-model="row.allDay"
                :min="0"
                :precision="2"
                :step="1"
                :controls="false"
                size="small"
                :placeholder="formatYuan(wpBaseCent)"
                class="wp-cell"
              />
            </template>
          </el-table-column>
          <!-- 各 1h 格列（slotStart = HH:00:00） -->
          <el-table-column
            v-for="h in hourSlots"
            :key="h"
            :label="hourLabel(h)"
            width="106"
            align="center"
          >
            <template #default="{ row }">
              <el-input-number
                v-model="row.hours[h]"
                :min="0"
                :precision="2"
                :step="1"
                :controls="false"
                size="small"
                :placeholder="placeholderForCell(row)"
                class="wp-cell"
              />
            </template>
          </el-table-column>
        </el-table>
      </div>

      <template #footer>
        <el-button @click="wpVisible = false">{{ t('gzBeanSeatTypeConfig.cancel') }}</el-button>
        <el-button
          type="primary"
          :loading="wpSubmitting"
          :disabled="hourSlots.length === 0"
          @click="handleWeekdayPriceSave"
        >{{ t('gzBeanSeatTypeConfig.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzBeanSeatTypeConfig">
import { ref, reactive, computed, onMounted } from 'vue';
import { Plus, Refresh } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { getGzBeanStoreOptions, type GzBeanStoreVO } from '@/api/gz-bean/store';
import {
  listGzBeanSeatTypeConfigByStore,
  addGzBeanSeatTypeConfig,
  updateGzBeanSeatTypeConfig,
  toggleGzBeanSeatTypeConfigEnabled,
  delGzBeanSeatTypeConfig,
  getGzBeanWeekdayPrices,
  saveGzBeanWeekdayPrices,
  type GzBeanSeatTypeConfigVO,
  type GzBeanSeatTypeConfigForm,
  type GzBeanSeatTypePriceVO,
  type GzBeanSeatTypePriceForm
} from '@/api/gz-bean/seatTypeConfig';
import { listGzBeanSlotByStore, type GzBeanTimeSlotTemplateVO } from '@/api/gz-bean/slot';

const { t } = useI18n();

const pageLoading = ref(false);
const listLoading = ref(false);
const submitting = ref(false);

const storeOptions = ref<GzBeanStoreVO[]>([]);
const currentStoreId = ref<number | null>(null);
const list = ref<GzBeanSeatTypeConfigVO[]>([]);

// ============ 表单（priceYuan 元，提交转 priceCent 分） ============
interface FormState {
  id: number | null;
  storeId: number | null;
  name: string;
  bookMode: string;
  capacity: number;
  quantity: number;
  priceYuan: number;
  enabled: number;
  sortNo: number;
  remark: string;
}
const formVisible = ref(false);
const formMode = ref<'add' | 'edit'>('add');
const formRef = ref<FormInstance>();
const form = reactive<FormState>({
  id: null,
  storeId: null,
  name: '',
  bookMode: 'whole',
  capacity: 1,
  quantity: 0,
  priceYuan: 0,
  enabled: 1,
  sortNo: 0,
  remark: ''
});
const formTitle = computed(() =>
  formMode.value === 'add' ? t('gzBeanSeatTypeConfig.addTitle') : t('gzBeanSeatTypeConfig.editTitle')
);
const rules = {
  name: [{ required: true, message: t('gzBeanSeatTypeConfig.ruleNameRequired'), trigger: 'blur' }],
  bookMode: [{ required: true, message: t('gzBeanSeatTypeConfig.ruleBookModeRequired'), trigger: 'change' }],
  capacity: [{ required: true, message: t('gzBeanSeatTypeConfig.ruleCapacityRequired'), trigger: 'change' }],
  quantity: [{ required: true, message: t('gzBeanSeatTypeConfig.ruleQuantityRequired'), trigger: 'change' }],
  priceYuan: [{ required: true, message: t('gzBeanSeatTypeConfig.rulePriceRequired'), trigger: 'change' }]
};

// ============ 星期 × 1h 格价格网格弹窗 ============
const weekdays = [1, 2, 3, 4, 5, 6, 7];
const wpVisible = ref(false);
const wpLoading = ref(false);
const wpSubmitting = ref(false);
const wpConfigId = ref<number | null>(null);
const wpName = ref('');
const wpBaseCent = ref(0);

/** 该门店营业 1h 格的起整点小时集合（0-23），从启用时段模板按 1h 切推导 */
const hourSlots = ref<number[]>([]);

/** 网格一行 = 一个星期：allDay = 整天默认价（元，slotStart=null）；hours[h] = 该 1h 格覆盖价（元） */
interface GridRow {
  weekday: number;
  weekdayLabel: string;
  /** 整天默认价（元）；undefined/null = 未配（回退基础价） */
  allDay: number | undefined;
  /** 小时(0-23) → 该 1h 格覆盖价（元）；undefined/null = 未配（回退整天默认 → 基础价） */
  hours: Record<number, number | undefined>;
}
const gridRows = ref<GridRow[]>([]);

// ============ helpers ============
function formatYuan(priceCent: number): string {
  return ((priceCent || 0) / 100).toFixed(2);
}

/** "HH:mm:ss" / "HH:mm" → 小时整数（0-23）；非法返回 null */
function parseHour(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = /^(\d{1,2}):/.exec(time);
  if (!m) return null;
  const h = Number(m[1]);
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : null;
}

/** 列头：小时格标签，如 10 → "10:00" */
function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

/**
 * 从门店启用时段模板推导营业 1h 格起整点小时集合。
 * 对每个启用模板 [startTime, endTime) 按 1h 切：起整点 floor(start) .. 末格起整点 ceil(end)-1。
 * 多模板取并集、去重、升序。无模板时返回空集合（弹窗提示先配时段）。
 */
function deriveHourSlots(slots: GzBeanTimeSlotTemplateVO[]): number[] {
  const set = new Set<number>();
  slots.forEach((s) => {
    if (s.enabled !== 1) return;
    const start = parseHour(s.startTime);
    const endH = parseHour(s.endTime);
    if (start === null || endH === null) return;
    // endTime 含分钟（如 22:30）则末格起点为 22；整点（22:00）则末格起点为 21
    const endMin = /^\d{1,2}:(\d{2})/.exec(s.endTime || '')?.[1] ?? '00';
    const lastSlotStart = Number(endMin) > 0 ? endH : endH - 1;
    for (let h = start; h <= lastSlotStart; h++) {
      if (h >= 0 && h <= 23) set.add(h);
    }
  });
  return Array.from(set).sort((a, b) => a - b);
}

/** 单元格 placeholder：该行已配整天默认 → 显「默认 ¥X」；否则显「基础 ¥X」 */
function placeholderForCell(row: GridRow): string {
  if (row.allDay !== undefined && row.allDay !== null) {
    return t('gzBeanSeatTypeConfig.gridPhDefault', { v: row.allDay.toFixed(2) });
  }
  return t('gzBeanSeatTypeConfig.gridPhBase', { v: formatYuan(wpBaseCent.value) });
}

// ============ 门店选项 ============
async function loadStoreOptions() {
  pageLoading.value = true;
  try {
    const resp = await getGzBeanStoreOptions();
    const r = resp as any;
    storeOptions.value = (r.data || r || []) as GzBeanStoreVO[];
    if (storeOptions.value.length > 0 && !currentStoreId.value) {
      currentStoreId.value = storeOptions.value[0].id;
      await loadList();
    }
  } catch (e) {
    console.error('[gz-bean-seat-type-config] loadStoreOptions failed', e);
    ElMessage.error(t('gzBeanSeatTypeConfig.loadFailed'));
  } finally {
    pageLoading.value = false;
  }
}

function onStoreChange(id: number) {
  currentStoreId.value = id;
  loadList();
}

// ============ 列表 ============
async function loadList() {
  if (!currentStoreId.value) return;
  listLoading.value = true;
  try {
    const resp = await listGzBeanSeatTypeConfigByStore(currentStoreId.value);
    const r = resp as any;
    list.value = (r.data || r || []) as GzBeanSeatTypeConfigVO[];
  } catch (e) {
    console.error('[gz-bean-seat-type-config] loadList failed', e);
    ElMessage.error(t('gzBeanSeatTypeConfig.loadFailed'));
  } finally {
    listLoading.value = false;
  }
}

// ============ 增改 ============
function handleAdd() {
  formMode.value = 'add';
  Object.assign(form, {
    id: null,
    storeId: currentStoreId.value,
    name: '',
    bookMode: 'whole',
    capacity: 1,
    quantity: 0,
    priceYuan: 0,
    enabled: 1,
    sortNo: 0,
    remark: ''
  });
  formVisible.value = true;
}

function handleEdit(row: GzBeanSeatTypeConfigVO) {
  formMode.value = 'edit';
  Object.assign(form, {
    id: row.id,
    storeId: row.storeId,
    name: row.name,
    bookMode: row.bookMode,
    capacity: row.capacity,
    quantity: row.quantity,
    priceYuan: (row.priceCent || 0) / 100,
    enabled: row.enabled,
    sortNo: row.sortNo,
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
    const payload: GzBeanSeatTypeConfigForm = {
      id: form.id,
      storeId: form.storeId,
      name: form.name,
      bookMode: form.bookMode,
      capacity: form.capacity,
      quantity: form.quantity,
      priceCent: Math.round((form.priceYuan || 0) * 100),
      enabled: form.enabled,
      sortNo: form.sortNo,
      remark: form.remark
    };
    if (formMode.value === 'add') {
      await addGzBeanSeatTypeConfig(payload);
      ElMessage.success(t('gzBeanSeatTypeConfig.addSuccess'));
    } else {
      await updateGzBeanSeatTypeConfig(payload);
      ElMessage.success(t('gzBeanSeatTypeConfig.editSuccess'));
    }
    formVisible.value = false;
    await loadList();
  } catch (e) {
    console.error('[gz-bean-seat-type-config] submit failed', e);
  } finally {
    submitting.value = false;
  }
}

async function handleToggleEnabled(row: GzBeanSeatTypeConfigVO, enabled: number) {
  try {
    await toggleGzBeanSeatTypeConfigEnabled(row.id, enabled);
    ElMessage.success(t('gzBeanSeatTypeConfig.editSuccess'));
    await loadList();
  } catch (e) {
    console.error('[gz-bean-seat-type-config] toggle failed', e);
    await loadList(); // 失败回滚 switch 视图
  }
}

async function handleDel(row: GzBeanSeatTypeConfigVO) {
  try {
    await ElMessageBox.confirm(
      t('gzBeanSeatTypeConfig.delConfirm', { type: row.name }),
      t('gzBeanSeatTypeConfig.confirmTitle'),
      { type: 'warning' }
    );
    await delGzBeanSeatTypeConfig(row.id);
    ElMessage.success(t('gzBeanSeatTypeConfig.delSuccess'));
    await loadList();
  } catch (e: any) {
    if (e !== 'cancel') console.error('[gz-bean-seat-type-config] del failed', e);
  }
}

// ============ 星期 × 1h 格价格网格 ============
/** 按当前 hourSlots + 已配覆盖价构建 7 行网格 */
function buildGridRows(priceRows: GzBeanSeatTypePriceVO[]): GridRow[] {
  // 索引：weekday → { allDay, hours }
  const byWeekday = new Map<number, { allDay?: number; hours: Record<number, number | undefined> }>();
  weekdays.forEach((d) => byWeekday.set(d, { allDay: undefined, hours: {} }));
  priceRows.forEach((p) => {
    const bucket = byWeekday.get(p.weekday);
    if (!bucket) return;
    const yuan = (p.priceCent || 0) / 100;
    const h = parseHour(p.slotStart);
    if (h === null) {
      bucket.allDay = yuan; // slotStart=null → 整天默认价
    } else {
      bucket.hours[h] = yuan; // slotStart=HH:00:00 → 该 1h 格覆盖价
    }
  });
  return weekdays.map((d) => {
    const bucket = byWeekday.get(d)!;
    const hours: Record<number, number | undefined> = {};
    hourSlots.value.forEach((h) => (hours[h] = bucket.hours[h]));
    return {
      weekday: d,
      weekdayLabel: t('gzBeanSeatTypeConfig.week' + d),
      allDay: bucket.allDay,
      hours
    };
  });
}

async function handleWeekdayPrice(row: GzBeanSeatTypeConfigVO) {
  wpConfigId.value = row.id;
  wpName.value = row.name;
  wpBaseCent.value = row.priceCent || 0;
  hourSlots.value = [];
  gridRows.value = [];
  wpVisible.value = true;
  wpLoading.value = true;
  try {
    // 并行取门店营业时段（推 1h 格列）+ 已配覆盖价
    const storeId = row.storeId ?? currentStoreId.value;
    const [slotResp, priceResp] = await Promise.all([
      storeId ? listGzBeanSlotByStore(storeId) : Promise.resolve(null),
      getGzBeanWeekdayPrices(row.id)
    ]);
    const slotR = slotResp as any;
    const slots = (slotR?.data || slotR || []) as GzBeanTimeSlotTemplateVO[];
    hourSlots.value = deriveHourSlots(slots);

    const priceR = priceResp as any;
    const priceRows = (priceR.data || priceR || []) as GzBeanSeatTypePriceVO[];
    gridRows.value = buildGridRows(priceRows);
  } catch (e) {
    console.error('[gz-bean-seat-type-config] load weekday/hour prices failed', e);
    ElMessage.error(t('gzBeanSeatTypeConfig.loadFailed'));
  } finally {
    wpLoading.value = false;
  }
}

async function handleWeekdayPriceSave() {
  if (!wpConfigId.value) return;
  wpSubmitting.value = true;
  try {
    const items: GzBeanSeatTypePriceForm['items'] = [];
    gridRows.value.forEach((row) => {
      // 整天默认价行（slotStart=null）
      if (row.allDay !== undefined && row.allDay !== null) {
        items.push({ weekday: row.weekday, slotStart: null, priceCent: Math.round(row.allDay * 100) });
      }
      // 各 1h 格覆盖价行（slotStart=HH:00:00）
      hourSlots.value.forEach((h) => {
        const v = row.hours[h];
        if (v !== undefined && v !== null) {
          items.push({ weekday: row.weekday, slotStart: `${String(h).padStart(2, '0')}:00:00`, priceCent: Math.round(v * 100) });
        }
      });
    });
    await saveGzBeanWeekdayPrices(wpConfigId.value, { items });
    ElMessage.success(t('gzBeanSeatTypeConfig.weekdayPriceSaveSuccess'));
    wpVisible.value = false;
  } catch (e) {
    console.error('[gz-bean-seat-type-config] save weekday/hour prices failed', e);
  } finally {
    wpSubmitting.value = false;
  }
}

onMounted(() => {
  loadStoreOptions();
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
.grid-rule-hint {
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}
.wp-grid {
  width: 100%;
}
.wp-cell {
  width: 100%;
}
.wp-cell :deep(.el-input__inner) {
  text-align: right;
}
</style>
