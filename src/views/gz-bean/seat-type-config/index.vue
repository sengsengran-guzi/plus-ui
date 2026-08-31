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
        <el-form-item :label="t('gzBeanSeatTypeConfig.colChannel')">
          <el-select v-model="channelFilter" style="width: 160px">
            <el-option :label="t('gzBeanSeatTypeConfig.channelAll')" value="all" />
            <el-option :label="t('gzBeanSeatTypeConfig.channelMp')" value="mp" />
            <el-option :label="t('gzBeanSeatTypeConfig.channelTemp')" value="temp" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button v-hasPermi="['gz:bean:seatTypeConfig:add']" type="primary" plain :icon="Plus" :disabled="!currentStoreId" @click="handleAdd">{{
            t('gzBeanSeatTypeConfig.add')
          }}</el-button>
          <el-button :icon="Refresh" @click="loadList">{{ t('gzBeanSeatTypeConfig.refresh') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="listLoading" :data="filteredList" border stripe size="small">
        <el-table-column :label="t('gzBeanSeatTypeConfig.colId')" prop="id" width="70" align="center" />
        <el-table-column :label="t('gzBeanSeatTypeConfig.colName')" prop="name" min-width="140" show-overflow-tooltip />
        <el-table-column :label="t('gzBeanSeatTypeConfig.colBookMode')" width="130" align="center">
          <template #default="{ row }">
            <el-tag :type="row.bookMode === 'seat' ? 'warning' : 'success'" size="small">
              {{ row.bookMode === 'seat' ? t('gzBeanSeatTypeConfig.bookModeSeat') : t('gzBeanSeatTypeConfig.bookModeWhole') }}
            </el-tag>
          </template>
        </el-table-column>
        <!-- 渠道列：只对临时桌渲 tag，正常行留空 —— 保持表格安静（GZ-BEAN-054） -->
        <el-table-column :label="t('gzBeanSeatTypeConfig.colChannel')" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="isTempType(row)" type="warning" size="small" effect="plain">
              {{ t('gzBeanSeatTypeConfig.tempTag') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeatTypeConfig.colCapacity')" prop="capacity" width="100" align="center" />
        <el-table-column :label="t('gzBeanSeatTypeConfig.colQuantity')" prop="quantity" width="90" align="center" />
        <!--
          看板格数（GZ-BEAN-055）：只读派生值，= 该桌型在店内计时看板上占几个格子。
          保存桌型时座位会自动对齐到这个数，所以正常情况下它恒等于「数量 × 每桌座位数」，
          店员不需要理解也不需要维护它 —— 放这列只是让人一眼确认「我配的桌子在看板上长这样」。
        -->
        <el-table-column :label="t('gzBeanSeatTypeConfig.colCells')" width="110" align="center">
          <template #default="{ row }">
            <el-tooltip :content="cellsTooltip(row)" placement="top">
              <span :class="{ 'cells-stale': isCellsMismatch(row) }">
                {{ row.boardCells ?? '-' }}
                <el-icon v-if="isCellsMismatch(row)"><WarningFilled /></el-icon>
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeatTypeConfig.colPriceYuan')" width="120" align="right">
          <template #default="{ row }">¥{{ formatYuan(row.priceCent) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeatTypeConfig.colDayPassQuota')" width="100" align="center">
          <template #default="{ row }">
            <span v-if="(row.dayPassQuota || 0) > 0">{{ row.dayPassQuota }}</span>
            <el-tag v-else type="info" size="small" effect="plain">{{ t('gzBeanSeatTypeConfig.dayPassOff') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanSeatTypeConfig.colDayPassPrice')" width="110" align="right">
          <template #default="{ row }">
            <span v-if="(row.dayPassQuota || 0) > 0">¥{{ formatYuan(row.dayPassPriceCent) }}</span>
            <span v-else class="form-hint">-</span>
          </template>
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
            <!-- 临时桌不进小程序、金额由店员 walk-in 现场填 → 格价表对它无意义（GZ-BEAN-054） -->
            <el-button
              v-if="!isTempType(row)"
              v-hasPermi="['gz:bean:seatTypeConfig:edit']"
              type="primary"
              link
              size="small"
              @click="handleWeekdayPrice(row)"
            >
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
        <!-- 用途（GZ-BEAN-054）：显式二选一，不做取反开关（取反是 bug 温床） -->
        <el-form-item :label="t('gzBeanSeatTypeConfig.colChannel')">
          <el-radio-group v-model="form.mpVisible">
            <el-radio-button :value="1">{{ t('gzBeanSeatTypeConfig.channelMp') }}</el-radio-button>
            <el-radio-button :value="0">{{ t('gzBeanSeatTypeConfig.channelTemp') }}</el-radio-button>
          </el-radio-group>
          <span class="form-hint">{{ t('gzBeanSeatTypeConfig.channelHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatTypeConfig.colCapacity')" prop="capacity">
          <el-input-number v-model="form.capacity" :min="1" :max="99" />
          <span class="form-hint">{{ t('gzBeanSeatTypeConfig.capacityHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatTypeConfig.colQuantity')" prop="quantity">
          <el-input-number v-model="form.quantity" :min="0" :max="9999" />
          <span class="form-hint">{{ t('gzBeanSeatTypeConfig.quantityHint') }}</span>
          <span class="form-hint">{{ t('gzBeanSeatTypeConfig.quantitySeatHint') }}</span>
          <span class="form-hint">{{ t('gzBeanSeatTypeConfig.nameRevenueHint') }}</span>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatTypeConfig.colPriceYuan')" prop="priceYuan">
          <el-input-number v-model="form.priceYuan" :min="0" :precision="2" :step="1" />
          <span class="form-hint">{{ t('gzBeanSeatTypeConfig.priceHint') }}</span>
        </el-form-item>
        <!-- 包天是纯小程序概念 → 临时桌禁用并归 0（后端 validateMpVisible 兜底，GZ-BEAN-054） -->
        <el-form-item :label="t('gzBeanSeatTypeConfig.colDayPassQuota')">
          <el-input-number v-model="form.dayPassQuota" :min="0" :max="9999" :disabled="form.mpVisible === 0" />
          <span class="form-hint">{{
            form.mpVisible === 0 ? t('gzBeanSeatTypeConfig.dayPassTempHint') : t('gzBeanSeatTypeConfig.dayPassQuotaHint')
          }}</span>
        </el-form-item>
        <el-form-item :label="t('gzBeanSeatTypeConfig.colDayPassPrice')">
          <el-input-number v-model="form.dayPassPriceYuan" :min="0" :precision="2" :step="1" :disabled="form.mpVisible === 0" />
          <span class="form-hint">{{ t('gzBeanSeatTypeConfig.dayPassPriceHint') }}</span>
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
    <el-dialog v-model="wpVisible" :title="t('gzBeanSeatTypeConfig.weekdayPriceTitle', { name: wpName })" width="80%" top="6vh">
      <el-alert type="info" :closable="false" show-icon class="mb-3">
        <template #default>
          <div>{{ t('gzBeanSeatTypeConfig.gridDescBase', { base: formatYuan(wpBaseCent) }) }}</div>
          <div class="grid-rule-hint">{{ t('gzBeanSeatTypeConfig.gridDescRule') }}</div>
          <div v-if="wpDayPassOpen" class="grid-rule-hint">
            {{ t('gzBeanSeatTypeConfig.gridDescDayPass', { base: formatYuan(wpDayPassBaseCent) }) }}
          </div>
        </template>
      </el-alert>

      <div v-loading="wpLoading">
        <el-empty v-if="hourSlots.length === 0" :description="t('gzBeanSeatTypeConfig.gridNoSlot')" />
        <template v-else>
          <!-- 区间批量填充：把所选星期、[起,止) 范围内的小时格一键写成同价（纯前端，保存仍逐格写） -->
          <div class="bulk-fill mb-3">
            <span class="bulk-fill__label">{{ t('gzBeanSeatTypeConfig.bulkFillTitle') }}</span>
            <el-select v-model="bulkFill.startHour" :placeholder="t('gzBeanSeatTypeConfig.bulkStart')" size="small" style="width: 110px">
              <el-option v-for="h in bulkStartOptions" :key="h" :label="hourLabel(h)" :value="h" />
            </el-select>
            <span class="bulk-fill__sep">{{ t('gzBeanSeatTypeConfig.bulkTo') }}</span>
            <el-select v-model="bulkFill.endHour" :placeholder="t('gzBeanSeatTypeConfig.bulkEnd')" size="small" style="width: 110px">
              <el-option v-for="h in bulkEndOptions" :key="h" :label="hourLabel(h)" :value="h" />
            </el-select>
            <el-input-number
              v-model="bulkFill.priceYuan"
              :min="0"
              :precision="2"
              :step="1"
              :controls="false"
              size="small"
              class="bulk-fill__price"
              :placeholder="t('gzBeanSeatTypeConfig.bulkPrice')"
            />
            <span class="bulk-fill__unit">{{ t('gzBeanSeatTypeConfig.bulkPriceUnit') }}</span>
            <el-checkbox v-model="bulkFillAllWeekdays" class="bulk-fill__all">{{ t('gzBeanSeatTypeConfig.bulkAllWeekdays') }}</el-checkbox>
            <el-checkbox-group v-model="bulkFill.weekdays" size="small" class="bulk-fill__weekdays">
              <el-checkbox-button v-for="d in weekdays" :key="d" :value="d">{{ t('gzBeanSeatTypeConfig.week' + d) }}</el-checkbox-button>
            </el-checkbox-group>
            <el-button type="primary" plain size="small" :icon="MagicStick" @click="applyBulkFill">
              {{ t('gzBeanSeatTypeConfig.bulkFillBtn') }}
            </el-button>
          </div>
          <el-table :data="gridRows" border size="small" class="wp-grid">
            <el-table-column :label="t('gzBeanSeatTypeConfig.gridColWeekday')" prop="weekdayLabel" width="84" align="center" fixed="left" />
            <!-- 包天列（GZ-BEAN-053：该星期的包天固定价；仅开放包天的桌型显示） -->
            <el-table-column v-if="wpDayPassOpen" :label="t('gzBeanSeatTypeConfig.gridColDayPass')" width="130" align="center">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.dayPass"
                  :min="0"
                  :precision="2"
                  :step="1"
                  :controls="false"
                  size="small"
                  :placeholder="formatYuan(wpDayPassBaseCent)"
                  class="wp-cell"
                />
              </template>
            </el-table-column>
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
            <el-table-column v-for="h in hourSlots" :key="h" :label="hourLabel(h)" width="106" align="center">
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
        </template>
      </div>

      <template #footer>
        <el-button @click="wpVisible = false">{{ t('gzBeanSeatTypeConfig.cancel') }}</el-button>
        <el-button type="primary" :loading="wpSubmitting" :disabled="hourSlots.length === 0" @click="handleWeekdayPriceSave">{{
          t('gzBeanSeatTypeConfig.confirm')
        }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzBeanSeatTypeConfig">
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { Plus, Refresh, MagicStick, WarningFilled } from '@element-plus/icons-vue';
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
  getGzBeanDayPassPrices,
  saveGzBeanDayPassPrices,
  type GzBeanSeatTypeConfigVO,
  type GzBeanSeatTypeConfigForm,
  type GzBeanSeatTypePriceVO,
  type GzBeanSeatTypePriceForm,
  type GzBeanDayPassPriceVO,
  type GzBeanDayPassPriceForm
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
  /** 包天名额（GZ-BEAN-042 / ADR-0017；0=不开放包天） */
  dayPassQuota: number;
  /** 包天固定价（元；提交时 *100 转分） */
  dayPassPriceYuan: number;
  /** 是否对小程序开放：1=正常桌型 / 0=仅后台临时桌（GZ-BEAN-054 / ADR-0023） */
  mpVisible: number;
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
  dayPassQuota: 0,
  dayPassPriceYuan: 0,
  mpVisible: 1,
  enabled: 1,
  sortNo: 0,
  remark: ''
});

/** 临时桌判定（GZ-BEAN-054）：mpVisible 为 null/undefined 的存量行视作正常桌型，与 DB DEFAULT 1 同口径 */
function isTempType(row: GzBeanSeatTypeConfigVO): boolean {
  return row.mpVisible === 0;
}

/**
 * 历史遗留错位判定（GZ-BEAN-055）：看板实际格数 ≠ 按配置应有的格数。
 *
 * 保存桌型时后端会自动对齐这两个数，所以**新数据不会出现这种情况**。
 * 会命中的只有两类：① 本次改动上线前就存在的历史错位；② 有人直接去「座位单元」页删/停用了座位。
 * 两者都会在下次保存该桌型时自动修好 —— tooltip 就是这么写的，不给按钮、不让店员做额外动作。
 */
function isCellsMismatch(row: GzBeanSeatTypeConfigVO): boolean {
  if (row.boardCells == null || row.expectedCells == null) return false;
  return row.boardCells !== row.expectedCells;
}

/** 看板格数的 tooltip：正常情况只说这数是什么；错位时说清楚怎么自愈，不要求店员理解「配额」 */
function cellsTooltip(row: GzBeanSeatTypeConfigVO): string {
  const board = row.boardCells ?? 0;
  const expected = row.expectedCells ?? 0;
  const disabled = row.disabledCells ?? 0;
  if (!isCellsMismatch(row)) {
    return disabled > 0
      ? `${t('gzBeanSeatTypeConfig.cellsTipOk', { board })} ${t('gzBeanSeatTypeConfig.cellsTipDisabled', { disabled })}`
      : t('gzBeanSeatTypeConfig.cellsTipOk', { board });
  }
  const parts = [t('gzBeanSeatTypeConfig.cellsTipStale', { board, expected })];
  if (disabled > 0) {
    parts.push(t('gzBeanSeatTypeConfig.cellsTipDisabled', { disabled }));
  }
  return parts.join(' ');
}

/** 渠道筛选：该页一次拉全量，纯前端过滤，后端零改动 */
const channelFilter = ref<'all' | 'mp' | 'temp'>('all');
const filteredList = computed(() => {
  if (channelFilter.value === 'mp') return list.value.filter((r) => !isTempType(r));
  if (channelFilter.value === 'temp') return list.value.filter((r) => isTempType(r));
  return list.value;
});

// 切到临时桌时把包天两项归 0 —— 后端 validateMpVisible 会直接拒，先在表单里清干净免得用户提交才报错
watch(
  () => form.mpVisible,
  (v) => {
    if (v === 0) {
      form.dayPassQuota = 0;
      form.dayPassPriceYuan = 0;
    }
  }
);

const formTitle = computed(() => (formMode.value === 'add' ? t('gzBeanSeatTypeConfig.addTitle') : t('gzBeanSeatTypeConfig.editTitle')));
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
/** 该桌型的基础包天价（分）— 包天列未填时的回退值，用作 placeholder */
const wpDayPassBaseCent = ref(0);
/** 该桌型是否开放包天（day_pass_quota > 0）；否则网格不显示「包天」列 */
const wpDayPassOpen = ref(false);

/** 该门店营业 1h 格的起整点小时集合（0-23），从启用时段模板按 1h 切推导 */
const hourSlots = ref<number[]>([]);

/** 网格一行 = 一个星期：allDay = 整天默认价（元，slotStart=null）；hours[h] = 该 1h 格覆盖价（元） */
interface GridRow {
  weekday: number;
  weekdayLabel: string;
  /** 整天默认价（元）；undefined/null = 未配（回退基础价） */
  allDay: number | undefined;
  /** 该星期的包天固定价（元，GZ-BEAN-053）；undefined/null = 未配（回退基础包天价） */
  dayPass: number | undefined;
  /** 小时(0-23) → 该 1h 格覆盖价（元）；undefined/null = 未配（回退整天默认 → 基础价） */
  hours: Record<number, number | undefined>;
}
const gridRows = ref<GridRow[]>([]);

// ============ 区间批量填充（纯前端：把所选星期 [起,止) 范围内的小时格全写成该价） ============
interface BulkFillState {
  /** 起始小时（hourSlots 中的整点） */
  startHour: number | null;
  /** 结束小时（不含；须 > startHour） */
  endHour: number | null;
  /** 填充价（元） */
  priceYuan: number | null;
  /** 应用到哪些星期；空数组语义 = 全部（由 UI「全选」勾选驱动） */
  weekdays: number[];
}
const bulkFill = reactive<BulkFillState>({
  startHour: null,
  endHour: null,
  priceYuan: null,
  weekdays: []
});

/** 「全部星期」勾选（与 weekdays 多选互为镜像） */
const bulkFillAllWeekdays = computed<boolean>({
  get: () => bulkFill.weekdays.length === weekdays.length,
  set: (v: boolean) => {
    bulkFill.weekdays = v ? [...weekdays] : [];
  }
});

/** 起始下拉选项 = 当前营业 1h 格（不含末格外的整点） */
const bulkStartOptions = computed<number[]>(() => hourSlots.value);

/** 结束下拉选项：营业格 + 末格后一个整点，且须 > startHour（保证 [起,止) 含至少 1 格） */
const bulkEndOptions = computed<number[]>(() => {
  if (hourSlots.value.length === 0) return [];
  const last = hourSlots.value[hourSlots.value.length - 1];
  // 结束整点候选 = 每个起整点 + 末格收尾整点(last+1)
  const ends = [...hourSlots.value.slice(1), last + 1];
  const s = bulkFill.startHour;
  return ends.filter((h) => (s == null ? true : h > s));
});

function resetBulkFill() {
  bulkFill.startHour = null;
  bulkFill.endHour = null;
  bulkFill.priceYuan = null;
  bulkFill.weekdays = [...weekdays]; // 默认全部星期
}

/**
 * 执行区间填充：把 bulkFill 选中星期、[startHour, endHour) 内、且属于营业 1h 格的 cell
 * 全部写成 priceYuan。纯改 gridRows，保存仍走原 handleWeekdayPriceSave 逐格写。
 */
function applyBulkFill() {
  if (bulkFill.startHour == null || bulkFill.endHour == null) {
    ElMessage.warning(t('gzBeanSeatTypeConfig.bulkRuleRangeRequired'));
    return;
  }
  if (bulkFill.endHour <= bulkFill.startHour) {
    ElMessage.warning(t('gzBeanSeatTypeConfig.bulkRuleEndAfterStart'));
    return;
  }
  if (bulkFill.priceYuan == null || bulkFill.priceYuan < 0) {
    ElMessage.warning(t('gzBeanSeatTypeConfig.bulkRulePriceRequired'));
    return;
  }
  if (bulkFill.weekdays.length === 0) {
    ElMessage.warning(t('gzBeanSeatTypeConfig.bulkRuleWeekdayRequired'));
    return;
  }
  // 命中的营业小时格 = hourSlots 中落在 [start, end) 的整点
  const targetHours = hourSlots.value.filter((h) => h >= bulkFill.startHour! && h < bulkFill.endHour!);
  if (targetHours.length === 0) {
    ElMessage.warning(t('gzBeanSeatTypeConfig.bulkNoSlotInRange'));
    return;
  }
  const wantWeekdays = new Set(bulkFill.weekdays);
  const price = Number(bulkFill.priceYuan);
  let cellCount = 0;
  gridRows.value.forEach((row) => {
    if (!wantWeekdays.has(row.weekday)) return;
    targetHours.forEach((h) => {
      row.hours[h] = price;
      cellCount += 1;
    });
  });
  ElMessage.success(t('gzBeanSeatTypeConfig.bulkFillSuccess', { count: cellCount }));
}

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
    dayPassQuota: 0,
    dayPassPriceYuan: 0,
    mpVisible: 1,
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
    dayPassQuota: row.dayPassQuota ?? 0,
    dayPassPriceYuan: (row.dayPassPriceCent || 0) / 100,
    mpVisible: row.mpVisible ?? 1,
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
      dayPassQuota: form.dayPassQuota,
      dayPassPriceCent: Math.round((form.dayPassPriceYuan || 0) * 100),
      mpVisible: form.mpVisible,
      enabled: form.enabled,
      sortNo: form.sortNo,
      remark: form.remark
    };
    const isAdd = formMode.value === 'add';
    if (!isAdd && !(await confirmCellReduction())) {
      submitting.value = false;
      return;
    }
    if (isAdd) {
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

/**
 * 会减少看板格子时先确认一次（GZ-BEAN-055）。
 *
 * 保存桌型会自动把座位对齐到新数量 —— 加格子无感，**减格子是破坏性的**（看板上真的会少几个格），
 * 所以只在减的时候拦一下。挂着预约的座位后端会拒绝并整单回滚，这里不用重复判断。
 *
 * @returns true=继续保存
 */
async function confirmCellReduction(): Promise<boolean> {
  const row = list.value.find((r) => r.id === form.id);
  if (!row) return true;
  const current = row.boardCells ?? 0;
  const next = form.bookMode === 'seat' ? (form.quantity || 0) * Math.max(form.capacity || 1, 1) : form.quantity || 0;
  if (next >= current) return true;
  try {
    await ElMessageBox.confirm(
      t('gzBeanSeatTypeConfig.reduceConfirmTip', { n: current - next, current, next }),
      t('gzBeanSeatTypeConfig.reduceConfirmTitle'),
      {
        confirmButtonText: t('gzBeanSeatTypeConfig.confirm'),
        cancelButtonText: t('gzBeanSeatTypeConfig.cancel'),
        type: 'warning'
      }
    );
    return true;
  } catch {
    return false;
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
    await ElMessageBox.confirm(t('gzBeanSeatTypeConfig.delConfirm', { type: row.name }), t('gzBeanSeatTypeConfig.confirmTitle'), { type: 'warning' });
    await delGzBeanSeatTypeConfig(row.id);
    ElMessage.success(t('gzBeanSeatTypeConfig.delSuccess'));
    await loadList();
  } catch (e: any) {
    if (e !== 'cancel') console.error('[gz-bean-seat-type-config] del failed', e);
  }
}

// ============ 星期 × 1h 格价格网格 ============
/** 按当前 hourSlots + 已配覆盖价构建 7 行网格 */
function buildGridRows(priceRows: GzBeanSeatTypePriceVO[], dayPassRows: GzBeanDayPassPriceVO[]): GridRow[] {
  // 包天按星期价（GZ-BEAN-053）：weekday → 元
  const dayPassByWeekday = new Map<number, number>();
  dayPassRows.forEach((p) => dayPassByWeekday.set(p.weekday, (p.priceCent || 0) / 100));
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
      dayPass: dayPassByWeekday.get(d),
      hours
    };
  });
}

async function handleWeekdayPrice(row: GzBeanSeatTypeConfigVO) {
  wpConfigId.value = row.id;
  wpName.value = row.name;
  wpBaseCent.value = row.priceCent || 0;
  wpDayPassBaseCent.value = row.dayPassPriceCent || 0;
  wpDayPassOpen.value = (row.dayPassQuota || 0) > 0;
  hourSlots.value = [];
  gridRows.value = [];
  resetBulkFill();
  wpVisible.value = true;
  wpLoading.value = true;
  try {
    // 并行取门店营业时段（推 1h 格列）+ 已配覆盖价
    const storeId = row.storeId ?? currentStoreId.value;
    const [slotResp, priceResp, dayPassResp] = await Promise.all([
      storeId ? listGzBeanSlotByStore(storeId) : Promise.resolve(null),
      getGzBeanWeekdayPrices(row.id),
      getGzBeanDayPassPrices(row.id)
    ]);
    const slotR = slotResp as any;
    const slots = (slotR?.data || slotR || []) as GzBeanTimeSlotTemplateVO[];
    hourSlots.value = deriveHourSlots(slots);

    const priceR = priceResp as any;
    const priceRows = (priceR.data || priceR || []) as GzBeanSeatTypePriceVO[];
    const dayPassR = dayPassResp as any;
    const dayPassRows = (dayPassR.data || dayPassR || []) as GzBeanDayPassPriceVO[];
    gridRows.value = buildGridRows(priceRows, dayPassRows);
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
    // 包天按星期价（GZ-BEAN-053）：只在该桌型开放包天时保存，否则不动库里的行
    if (wpDayPassOpen.value) {
      const dayPassItems: GzBeanDayPassPriceForm['items'] = [];
      gridRows.value.forEach((row) => {
        if (row.dayPass !== undefined && row.dayPass !== null) {
          dayPassItems.push({ weekday: row.weekday, priceCent: Math.round(row.dayPass * 100) });
        }
      });
      await saveGzBeanDayPassPrices(wpConfigId.value, { items: dayPassItems });
    }
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
/* 计时格与配置对不上（GZ-BEAN-055）—— 用告警色，因为它意味着小程序卖的数量和店里能坐的人数不一致 */
.cells-mismatch {
  color: var(--el-color-warning);
  font-weight: 600;
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
.bulk-fill {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
}
.bulk-fill__label {
  font-weight: 600;
  color: #303133;
  margin-right: 4px;
}
.bulk-fill__sep {
  color: #606266;
}
.bulk-fill__price {
  width: 120px;
}
.bulk-fill__unit {
  color: #606266;
}
.bulk-fill__all {
  margin-left: 4px;
}
.bulk-fill__weekdays {
  display: inline-flex;
}
.wp-cell {
  width: 100%;
}
.wp-cell :deep(.el-input__inner) {
  text-align: right;
}
</style>
