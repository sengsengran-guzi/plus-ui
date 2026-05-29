<template>
  <div class="p-2">
    <el-card v-loading="pageLoading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzBeanConfig.title') }}</span>
          <span class="ticket-tag">GZ-BEAN-002</span>
        </div>
      </template>

      <el-alert
        :title="t('gzBeanConfig.alertTitle')"
        type="info"
        :description="t('gzBeanConfig.alertDesc')"
        show-icon
        :closable="false"
        class="mb-3"
      />

      <!-- 门店选择 -->
      <el-form inline class="mb-2">
        <el-form-item :label="t('gzBeanConfig.store')">
          <el-select v-model="currentStoreId" style="width: 240px" @change="onStoreChange">
            <el-option
              v-for="s in storeOptions"
              :key="s.id"
              :label="`${s.storeNo} · ${s.name}`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <el-tabs v-model="activeTab">
        <!-- ============ Tab 1: 座位管理 ============ -->
        <el-tab-pane :label="t('gzBeanConfig.tabSeat')" name="seat">
          <el-row :gutter="10" class="mb-2">
            <el-col :span="1.5">
              <el-button
                v-hasPermi="['gz:bean:seat:add']"
                type="primary"
                plain
                :icon="Plus"
                :disabled="!currentStoreId"
                @click="handleSeatAdd"
              >{{ t('gzBeanConfig.seatAdd') }}</el-button>
            </el-col>
            <el-col :span="1.5">
              <el-button
                v-hasPermi="['gz:bean:seat:batchGenerate']"
                type="success"
                plain
                :icon="MagicStick"
                :disabled="!currentStoreId"
                @click="handleSeatBatchOpen"
              >{{ t('gzBeanConfig.seatBatchGenerate') }}</el-button>
            </el-col>
            <el-col :span="1.5">
              <el-button :icon="Refresh" @click="loadSeats">{{ t('gzBeanConfig.refresh') }}</el-button>
            </el-col>
          </el-row>

          <el-table v-loading="seatLoading" :data="seats" border stripe size="small">
            <el-table-column :label="t('gzBeanConfig.colId')" prop="id" width="80" align="center" />
            <el-table-column :label="t('gzBeanConfig.colSeatNo')" prop="seatNo" width="120" />
            <el-table-column :label="t('gzBeanConfig.colRowLabel')" prop="rowLabel" width="80" align="center" />
            <el-table-column :label="t('gzBeanConfig.colColIndex')" prop="colIndex" width="80" align="center" />
            <el-table-column :label="t('gzBeanConfig.colSortNo')" prop="sortNo" width="80" align="center" />
            <el-table-column :label="t('gzBeanConfig.colEnabled')" prop="enabled" width="100" align="center">
              <template #default="{ row }">
                <el-switch
                  v-hasPermi="['gz:bean:seat:edit']"
                  :model-value="row.enabled === 1"
                  :active-value="true"
                  :inactive-value="false"
                  @change="(v: boolean) => handleSeatToggleEnabled(row, v ? 1 : 0)"
                />
              </template>
            </el-table-column>
            <el-table-column :label="t('gzBeanConfig.colCreateTime')" prop="createTime" width="170" />
            <el-table-column :label="t('gzBeanConfig.colAction')" fixed="right" width="160" align="center">
              <template #default="{ row }">
                <el-button v-hasPermi="['gz:bean:seat:edit']" type="success" link size="small" @click="handleSeatEdit(row)">
                  {{ t('gzBeanConfig.edit') }}
                </el-button>
                <el-button v-hasPermi="['gz:bean:seat:remove']" type="danger" link size="small" @click="handleSeatDel(row)">
                  {{ t('gzBeanConfig.del') }}
                </el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty :description="t('gzBeanConfig.seatEmpty')" />
            </template>
          </el-table>
        </el-tab-pane>

        <!-- ============ Tab 2: 时段模板 ============ -->
        <el-tab-pane :label="t('gzBeanConfig.tabSlot')" name="slot">
          <el-row :gutter="10" class="mb-2">
            <el-col :span="1.5">
              <el-button
                v-hasPermi="['gz:bean:slot:add']"
                type="primary"
                plain
                :icon="Plus"
                :disabled="!currentStoreId"
                @click="handleSlotAdd"
              >{{ t('gzBeanConfig.slotAdd') }}</el-button>
            </el-col>
            <el-col :span="1.5">
              <el-button
                v-hasPermi="['gz:bean:slot:batchByWeek']"
                type="success"
                plain
                :icon="Calendar"
                :disabled="!currentStoreId"
                @click="handleSlotBatchOpen"
              >{{ t('gzBeanConfig.slotBatchByWeek') }}</el-button>
            </el-col>
            <el-col :span="1.5">
              <el-button :icon="Refresh" @click="loadSlots">{{ t('gzBeanConfig.refresh') }}</el-button>
            </el-col>
          </el-row>

          <el-table v-loading="slotLoading" :data="slots" border stripe size="small">
            <el-table-column :label="t('gzBeanConfig.colId')" prop="id" width="80" align="center" />
            <el-table-column :label="t('gzBeanConfig.colSlotName')" prop="slotName" width="120">
              <template #default="{ row }">{{ row.slotName || '-' }}</template>
            </el-table-column>
            <el-table-column :label="t('gzBeanConfig.colStartTime')" prop="startTime" width="100" align="center" />
            <el-table-column :label="t('gzBeanConfig.colEndTime')" prop="endTime" width="100" align="center" />
            <el-table-column :label="t('gzBeanConfig.colWeekdays')" min-width="180">
              <template #default="{ row }">
                <el-tag v-for="d in weekdayList(row.weekdays)" :key="d" size="small" class="mr-1">
                  {{ weekdayLabel(d) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="t('gzBeanConfig.colEffective')" width="200">
              <template #default="{ row }">
                <span>{{ row.effectiveDate || t('gzBeanConfig.effectiveNow') }} ~ {{ row.expireDate || t('gzBeanConfig.expireForever') }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="t('gzBeanConfig.colEnabled')" prop="enabled" width="100" align="center">
              <template #default="{ row }">
                <el-switch
                  v-hasPermi="['gz:bean:slot:edit']"
                  :model-value="row.enabled === 1"
                  :active-value="true"
                  :inactive-value="false"
                  @change="(v: boolean) => handleSlotToggleEnabled(row, v ? 1 : 0)"
                />
              </template>
            </el-table-column>
            <el-table-column :label="t('gzBeanConfig.colAction')" fixed="right" width="160" align="center">
              <template #default="{ row }">
                <el-button v-hasPermi="['gz:bean:slot:edit']" type="success" link size="small" @click="handleSlotEdit(row)">
                  {{ t('gzBeanConfig.edit') }}
                </el-button>
                <el-button v-hasPermi="['gz:bean:slot:remove']" type="danger" link size="small" @click="handleSlotDel(row)">
                  {{ t('gzBeanConfig.del') }}
                </el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty :description="t('gzBeanConfig.slotEmpty')" />
            </template>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- ================ 座位单建 / 编辑弹窗 ================ -->
    <el-dialog v-model="seatFormVisible" :title="seatFormTitle" width="520px" @close="resetSeatForm">
      <el-form ref="seatFormRef" :model="seatForm" :rules="seatRules" label-width="100px">
        <el-form-item :label="t('gzBeanConfig.colSeatNo')" prop="seatNo">
          <el-input v-model="seatForm.seatNo" :disabled="seatFormMode === 'edit'" maxlength="16" />
        </el-form-item>
        <el-form-item :label="t('gzBeanConfig.colRowLabel')">
          <el-input v-model="seatForm.rowLabel" maxlength="8" />
        </el-form-item>
        <el-form-item :label="t('gzBeanConfig.colColIndex')">
          <el-input-number v-model="seatForm.colIndex" :min="1" :max="99" />
        </el-form-item>
        <el-form-item :label="t('gzBeanConfig.colSortNo')">
          <el-input-number v-model="seatForm.sortNo" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item :label="t('gzBeanConfig.colEnabled')">
          <el-switch
            :model-value="seatForm.enabled === 1"
            :active-value="true"
            :inactive-value="false"
            @update:model-value="(v: boolean) => (seatForm.enabled = v ? 1 : 0)"
          />
        </el-form-item>
        <el-form-item :label="t('gzBeanConfig.colRemark')">
          <el-input v-model="seatForm.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="seatFormVisible = false">{{ t('gzBeanConfig.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSeatSubmit">{{ t('gzBeanConfig.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- ================ 批量生成座位弹窗 ================ -->
    <el-dialog v-model="seatBatchVisible" :title="t('gzBeanConfig.seatBatchTitle')" width="520px">
      <el-form ref="seatBatchRef" :model="seatBatchForm" :rules="seatBatchRules" label-width="120px">
        <el-form-item :label="t('gzBeanConfig.batchPrefix')" prop="prefix">
          <el-input v-model="seatBatchForm.prefix" maxlength="8" :placeholder="t('gzBeanConfig.batchPrefixPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('gzBeanConfig.batchStartIndex')" prop="startIndex">
          <el-input-number v-model="seatBatchForm.startIndex" :min="1" :max="999" />
        </el-form-item>
        <el-form-item :label="t('gzBeanConfig.batchCount')" prop="count">
          <el-input-number v-model="seatBatchForm.count" :min="1" :max="30" />
        </el-form-item>
        <el-form-item :label="t('gzBeanConfig.batchRowLabel')">
          <el-input v-model="seatBatchForm.rowLabel" maxlength="8" />
        </el-form-item>
        <el-form-item :label="t('gzBeanConfig.batchStartCol')">
          <el-input-number v-model="seatBatchForm.startColIndex" :min="1" :max="99" />
        </el-form-item>
        <el-alert :title="t('gzBeanConfig.batchHint')" type="info" :closable="false" />
      </el-form>
      <template #footer>
        <el-button @click="seatBatchVisible = false">{{ t('gzBeanConfig.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSeatBatchSubmit">{{ t('gzBeanConfig.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- ================ 时段单建 / 编辑弹窗 ================ -->
    <el-dialog v-model="slotFormVisible" :title="slotFormTitle" width="600px" @close="resetSlotForm">
      <el-form ref="slotFormRef" :model="slotForm" :rules="slotRules" label-width="120px">
        <el-form-item :label="t('gzBeanConfig.colSlotName')">
          <el-input v-model="slotForm.slotName" maxlength="32" :placeholder="t('gzBeanConfig.slotNamePlaceholder')" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('gzBeanConfig.colStartTime')" prop="startTime">
              <el-time-picker
                v-model="slotForm.startTime"
                value-format="HH:mm:ss"
                format="HH:mm"
                :placeholder="t('gzBeanConfig.startTimePlaceholder')"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzBeanConfig.colEndTime')" prop="endTime">
              <el-time-picker
                v-model="slotForm.endTime"
                value-format="HH:mm:ss"
                format="HH:mm"
                :placeholder="t('gzBeanConfig.endTimePlaceholder')"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item :label="t('gzBeanConfig.colWeekdays')" prop="weekdayArr">
          <el-checkbox-group v-model="slotForm.weekdayArr">
            <el-checkbox v-for="d in [1, 2, 3, 4, 5, 6, 7]" :key="d" :value="d">
              {{ weekdayLabel(String(d)) }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('gzBeanConfig.colEffectiveDate')">
              <el-date-picker
                v-model="slotForm.effectiveDate"
                type="date"
                value-format="YYYY-MM-DD"
                :placeholder="t('gzBeanConfig.effectiveDatePlaceholder')"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzBeanConfig.colExpireDate')">
              <el-date-picker
                v-model="slotForm.expireDate"
                type="date"
                value-format="YYYY-MM-DD"
                :placeholder="t('gzBeanConfig.expireDatePlaceholder')"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item :label="t('gzBeanConfig.colSortNo')">
          <el-input-number v-model="slotForm.sortNo" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item :label="t('gzBeanConfig.colEnabled')">
          <el-switch
            :model-value="slotForm.enabled === 1"
            :active-value="true"
            :inactive-value="false"
            @update:model-value="(v: boolean) => (slotForm.enabled = v ? 1 : 0)"
          />
        </el-form-item>
        <el-form-item :label="t('gzBeanConfig.colRemark')">
          <el-input v-model="slotForm.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="slotFormVisible = false">{{ t('gzBeanConfig.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSlotSubmit">{{ t('gzBeanConfig.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- ================ 按周批量配置弹窗 ================ -->
    <el-dialog v-model="slotBatchVisible" :title="t('gzBeanConfig.slotBatchTitle')" width="720px">
      <el-form ref="slotBatchRef" :model="slotBatchForm" :rules="slotBatchRules" label-width="120px">
        <el-form-item :label="t('gzBeanConfig.colWeekdays')" prop="weekdayArr">
          <el-checkbox-group v-model="slotBatchForm.weekdayArr">
            <el-checkbox v-for="d in [1, 2, 3, 4, 5, 6, 7]" :key="d" :value="d">
              {{ weekdayLabel(String(d)) }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('gzBeanConfig.colEffectiveDate')">
              <el-date-picker v-model="slotBatchForm.effectiveDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzBeanConfig.colExpireDate')">
              <el-date-picker v-model="slotBatchForm.expireDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-divider>{{ t('gzBeanConfig.batchSlotList') }}</el-divider>
        <div v-for="(slot, idx) in slotBatchForm.slots" :key="idx" class="mb-2">
          <el-row :gutter="8">
            <el-col :span="6">
              <el-input v-model="slot.slotName" :placeholder="t('gzBeanConfig.slotNamePlaceholder')" maxlength="32" />
            </el-col>
            <el-col :span="6">
              <el-time-picker v-model="slot.startTime" value-format="HH:mm:ss" format="HH:mm" :placeholder="t('gzBeanConfig.startTimePlaceholder')" style="width: 100%" />
            </el-col>
            <el-col :span="6">
              <el-time-picker v-model="slot.endTime" value-format="HH:mm:ss" format="HH:mm" :placeholder="t('gzBeanConfig.endTimePlaceholder')" style="width: 100%" />
            </el-col>
            <el-col :span="6">
              <el-button type="danger" link :icon="Delete" :disabled="slotBatchForm.slots.length <= 1" @click="removeBatchSlot(idx)">
                {{ t('gzBeanConfig.del') }}
              </el-button>
            </el-col>
          </el-row>
        </div>
        <el-button type="primary" plain :icon="Plus" @click="addBatchSlot">
          {{ t('gzBeanConfig.batchAddSlot') }}
        </el-button>
      </el-form>
      <template #footer>
        <el-button @click="slotBatchVisible = false">{{ t('gzBeanConfig.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSlotBatchSubmit">{{ t('gzBeanConfig.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzBeanConfig">
import { ref, reactive, computed, onMounted } from 'vue';
import { Plus, Refresh, Delete, Calendar, MagicStick } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { getGzBeanStoreOptions, type GzBeanStoreVO } from '@/api/gz-bean/store';
import {
  listGzBeanSeatByStore,
  addGzBeanSeat,
  updateGzBeanSeat,
  delGzBeanSeat,
  batchGenerateGzBeanSeat,
  type GzBeanSeatVO,
  type GzBeanSeatForm,
  type GzBeanSeatBatchGenerateForm
} from '@/api/gz-bean/seat';
import {
  listGzBeanSlotByStore,
  addGzBeanSlot,
  updateGzBeanSlot,
  delGzBeanSlot,
  batchByWeekGzBeanSlot,
  type GzBeanTimeSlotTemplateVO,
  type GzBeanTimeSlotTemplateForm,
  type GzBeanTimeSlotBatchByWeekForm
} from '@/api/gz-bean/slot';

const { t } = useI18n();

const pageLoading = ref(false);
const submitting = ref(false);
const activeTab = ref<'seat' | 'slot'>('seat');

const storeOptions = ref<GzBeanStoreVO[]>([]);
const currentStoreId = ref<number | null>(null);

const seats = ref<GzBeanSeatVO[]>([]);
const slots = ref<GzBeanTimeSlotTemplateVO[]>([]);
const seatLoading = ref(false);
const slotLoading = ref(false);

// ============ 座位单建 / 编辑 ============
const seatFormVisible = ref(false);
const seatFormMode = ref<'add' | 'edit'>('add');
const seatFormRef = ref<FormInstance>();
const seatForm = reactive<GzBeanSeatForm & { enabled: number }>({
  enabled: 1,
  sortNo: 0,
  colIndex: 1
});
const seatFormTitle = computed(() =>
  seatFormMode.value === 'add' ? t('gzBeanConfig.seatAddTitle') : t('gzBeanConfig.seatEditTitle')
);
const seatRules = {
  seatNo: [{ required: true, message: t('gzBeanConfig.ruleSeatNoRequired'), trigger: 'blur' }]
};

// ============ 座位批量生成 ============
const seatBatchVisible = ref(false);
const seatBatchRef = ref<FormInstance>();
const seatBatchForm = reactive<GzBeanSeatBatchGenerateForm>({
  storeId: 0,
  prefix: 'A',
  startIndex: 1,
  count: 6,
  rowLabel: 'A',
  startColIndex: 1
});
const seatBatchRules = {
  startIndex: [{ required: true, message: t('gzBeanConfig.ruleStartIndexRequired'), trigger: 'change' }],
  count: [{ required: true, message: t('gzBeanConfig.ruleCountRequired'), trigger: 'change' }]
};

// ============ 时段单建 / 编辑 ============
type SlotFormState = GzBeanTimeSlotTemplateForm & { enabled: number; weekdayArr: number[] };
const slotFormVisible = ref(false);
const slotFormMode = ref<'add' | 'edit'>('add');
const slotFormRef = ref<FormInstance>();
const slotForm = reactive<SlotFormState>({
  enabled: 1,
  sortNo: 0,
  weekdayArr: [1, 2, 3, 4, 5]
});
const slotFormTitle = computed(() =>
  slotFormMode.value === 'add' ? t('gzBeanConfig.slotAddTitle') : t('gzBeanConfig.slotEditTitle')
);
const slotRules = {
  startTime: [{ required: true, message: t('gzBeanConfig.ruleStartTimeRequired'), trigger: 'change' }],
  endTime: [{ required: true, message: t('gzBeanConfig.ruleEndTimeRequired'), trigger: 'change' }],
  weekdayArr: [
    {
      validator: (_rule: unknown, value: number[], cb: (e?: Error) => void) => {
        if (!value || value.length === 0) cb(new Error(t('gzBeanConfig.ruleWeekdayRequired')));
        else cb();
      },
      trigger: 'change'
    }
  ]
};

// ============ 按周批量配置 ============
type SlotBatchState = GzBeanTimeSlotBatchByWeekForm & { weekdayArr: number[] };
const slotBatchVisible = ref(false);
const slotBatchRef = ref<FormInstance>();
const slotBatchForm = reactive<SlotBatchState>({
  storeId: 0,
  weekdays: '',
  weekdayArr: [1, 2, 3, 4, 5],
  effectiveDate: null,
  expireDate: null,
  slots: [{ slotName: '', startTime: '', endTime: '' }]
});
const slotBatchRules = {
  weekdayArr: [
    {
      validator: (_rule: unknown, value: number[], cb: (e?: Error) => void) => {
        if (!value || value.length === 0) cb(new Error(t('gzBeanConfig.ruleWeekdayRequired')));
        else cb();
      },
      trigger: 'change'
    }
  ]
};

// ============ helpers ============
function weekdayList(weekdays: string): string[] {
  return weekdays ? weekdays.split(',').sort() : [];
}

function weekdayLabel(d: string): string {
  const map: Record<string, string> = {
    '1': t('gzBeanConfig.mon'),
    '2': t('gzBeanConfig.tue'),
    '3': t('gzBeanConfig.wed'),
    '4': t('gzBeanConfig.thu'),
    '5': t('gzBeanConfig.fri'),
    '6': t('gzBeanConfig.sat'),
    '7': t('gzBeanConfig.sun')
  };
  return map[d] || d;
}

function weekdayArrToStr(arr: number[]): string {
  return [...arr].sort((a, b) => a - b).join(',');
}

function weekdayStrToArr(s: string | undefined): number[] {
  if (!s) return [];
  return s.split(',').map((x) => parseInt(x, 10)).filter((x) => x >= 1 && x <= 7);
}

// ============ 加载门店选项 ============
async function loadStoreOptions() {
  try {
    const resp = await getGzBeanStoreOptions();
    // ruoyi request.ts 已解包，直接拿 data 数组（实际返回 { code, msg, data: [...] }）
    const r = resp as any;
    storeOptions.value = (r.data || r || []) as GzBeanStoreVO[];
    if (storeOptions.value.length > 0 && !currentStoreId.value) {
      currentStoreId.value = storeOptions.value[0].id;
      onStoreChange(currentStoreId.value);
    }
  } catch (e) {
    console.error('[gz-bean-config] loadStoreOptions failed', e);
    ElMessage.error(t('gzBeanConfig.loadFailed'));
  }
}

function onStoreChange(id: number) {
  currentStoreId.value = id;
  loadSeats();
  loadSlots();
}

// ============ 座位列表 / 操作 ============
async function loadSeats() {
  if (!currentStoreId.value) return;
  seatLoading.value = true;
  try {
    const resp = await listGzBeanSeatByStore(currentStoreId.value);
    const r = resp as any;
    seats.value = (r.data || r || []) as GzBeanSeatVO[];
  } catch (e) {
    console.error('[gz-bean-config] loadSeats failed', e);
    ElMessage.error(t('gzBeanConfig.loadFailed'));
  } finally {
    seatLoading.value = false;
  }
}

function handleSeatAdd() {
  seatFormMode.value = 'add';
  Object.assign(seatForm, {
    id: null,
    storeId: currentStoreId.value,
    seatNo: '',
    rowLabel: '',
    colIndex: 1,
    enabled: 1,
    sortNo: 0,
    remark: ''
  });
  seatFormVisible.value = true;
}

function handleSeatEdit(row: GzBeanSeatVO) {
  seatFormMode.value = 'edit';
  Object.assign(seatForm, {
    id: row.id,
    storeId: row.storeId,
    seatNo: row.seatNo,
    rowLabel: row.rowLabel || '',
    colIndex: row.colIndex || 1,
    enabled: row.enabled,
    sortNo: row.sortNo,
    remark: row.remark || ''
  });
  seatFormVisible.value = true;
}

function resetSeatForm() {
  seatFormRef.value?.resetFields();
}

async function handleSeatSubmit() {
  if (!seatFormRef.value) return;
  await seatFormRef.value.validate();
  submitting.value = true;
  try {
    if (seatFormMode.value === 'add') {
      await addGzBeanSeat(seatForm);
      ElMessage.success(t('gzBeanConfig.addSuccess'));
    } else {
      await updateGzBeanSeat(seatForm);
      ElMessage.success(t('gzBeanConfig.editSuccess'));
    }
    seatFormVisible.value = false;
    await loadSeats();
  } catch (e) {
    console.error('[gz-bean-config] seat submit failed', e);
  } finally {
    submitting.value = false;
  }
}

async function handleSeatToggleEnabled(row: GzBeanSeatVO, enabled: number) {
  try {
    await updateGzBeanSeat({ id: row.id, enabled });
    ElMessage.success(t('gzBeanConfig.editSuccess'));
    await loadSeats();
  } catch (e) {
    console.error('[gz-bean-config] toggle seat failed', e);
  }
}

async function handleSeatDel(row: GzBeanSeatVO) {
  try {
    await ElMessageBox.confirm(t('gzBeanConfig.seatDelConfirm', { seatNo: row.seatNo }), t('gzBeanConfig.confirmTitle'), {
      type: 'warning'
    });
    await delGzBeanSeat(row.id);
    ElMessage.success(t('gzBeanConfig.delSuccess'));
    await loadSeats();
  } catch (e: any) {
    if (e !== 'cancel') console.error('[gz-bean-config] seat del failed', e);
  }
}

function handleSeatBatchOpen() {
  Object.assign(seatBatchForm, {
    storeId: currentStoreId.value,
    prefix: 'A',
    startIndex: 1,
    count: 6,
    rowLabel: 'A',
    startColIndex: 1
  });
  seatBatchVisible.value = true;
}

async function handleSeatBatchSubmit() {
  if (!seatBatchRef.value) return;
  await seatBatchRef.value.validate();
  submitting.value = true;
  try {
    const resp = await batchGenerateGzBeanSeat({ ...seatBatchForm, storeId: currentStoreId.value! });
    const r = resp as any;
    const generated = r.data ?? 0;
    ElMessage.success(t('gzBeanConfig.batchGeneratedHint', { n: generated }));
    seatBatchVisible.value = false;
    await loadSeats();
  } catch (e) {
    console.error('[gz-bean-config] batch generate failed', e);
  } finally {
    submitting.value = false;
  }
}

// ============ 时段列表 / 操作 ============
async function loadSlots() {
  if (!currentStoreId.value) return;
  slotLoading.value = true;
  try {
    const resp = await listGzBeanSlotByStore(currentStoreId.value);
    const r = resp as any;
    slots.value = (r.data || r || []) as GzBeanTimeSlotTemplateVO[];
  } catch (e) {
    console.error('[gz-bean-config] loadSlots failed', e);
    ElMessage.error(t('gzBeanConfig.loadFailed'));
  } finally {
    slotLoading.value = false;
  }
}

function handleSlotAdd() {
  slotFormMode.value = 'add';
  Object.assign(slotForm, {
    id: null,
    storeId: currentStoreId.value,
    slotName: '',
    startTime: '',
    endTime: '',
    weekdayArr: [1, 2, 3, 4, 5],
    effectiveDate: null,
    expireDate: null,
    enabled: 1,
    sortNo: 0,
    remark: ''
  });
  slotFormVisible.value = true;
}

function handleSlotEdit(row: GzBeanTimeSlotTemplateVO) {
  slotFormMode.value = 'edit';
  Object.assign(slotForm, {
    id: row.id,
    storeId: row.storeId,
    slotName: row.slotName || '',
    startTime: row.startTime,
    endTime: row.endTime,
    weekdayArr: weekdayStrToArr(row.weekdays),
    effectiveDate: row.effectiveDate || null,
    expireDate: row.expireDate || null,
    enabled: row.enabled,
    sortNo: row.sortNo,
    remark: row.remark || ''
  });
  slotFormVisible.value = true;
}

function resetSlotForm() {
  slotFormRef.value?.resetFields();
}

async function handleSlotSubmit() {
  if (!slotFormRef.value) return;
  await slotFormRef.value.validate();
  submitting.value = true;
  try {
    const payload: GzBeanTimeSlotTemplateForm = {
      id: slotForm.id,
      storeId: slotForm.storeId,
      slotName: slotForm.slotName,
      startTime: slotForm.startTime,
      endTime: slotForm.endTime,
      weekdays: weekdayArrToStr(slotForm.weekdayArr),
      effectiveDate: slotForm.effectiveDate || null,
      expireDate: slotForm.expireDate || null,
      enabled: slotForm.enabled,
      sortNo: slotForm.sortNo,
      remark: slotForm.remark
    };
    if (slotFormMode.value === 'add') {
      await addGzBeanSlot(payload);
      ElMessage.success(t('gzBeanConfig.addSuccess'));
    } else {
      await updateGzBeanSlot(payload);
      ElMessage.success(t('gzBeanConfig.editSuccess'));
    }
    slotFormVisible.value = false;
    await loadSlots();
  } catch (e) {
    console.error('[gz-bean-config] slot submit failed', e);
  } finally {
    submitting.value = false;
  }
}

async function handleSlotToggleEnabled(row: GzBeanTimeSlotTemplateVO, enabled: number) {
  try {
    await updateGzBeanSlot({
      id: row.id,
      slotName: row.slotName,
      startTime: row.startTime,
      endTime: row.endTime,
      weekdays: row.weekdays,
      effectiveDate: row.effectiveDate,
      expireDate: row.expireDate,
      sortNo: row.sortNo,
      enabled
    });
    ElMessage.success(t('gzBeanConfig.editSuccess'));
    await loadSlots();
  } catch (e) {
    console.error('[gz-bean-config] toggle slot failed', e);
  }
}

async function handleSlotDel(row: GzBeanTimeSlotTemplateVO) {
  try {
    await ElMessageBox.confirm(t('gzBeanConfig.slotDelConfirm', { time: `${row.startTime}-${row.endTime}` }), t('gzBeanConfig.confirmTitle'), {
      type: 'warning'
    });
    await delGzBeanSlot(row.id);
    ElMessage.success(t('gzBeanConfig.delSuccess'));
    await loadSlots();
  } catch (e: any) {
    if (e !== 'cancel') console.error('[gz-bean-config] slot del failed', e);
  }
}

function handleSlotBatchOpen() {
  Object.assign(slotBatchForm, {
    storeId: currentStoreId.value,
    weekdayArr: [1, 2, 3, 4, 5],
    effectiveDate: null,
    expireDate: null,
    slots: [{ slotName: '', startTime: '', endTime: '' }]
  });
  slotBatchVisible.value = true;
}

function addBatchSlot() {
  slotBatchForm.slots.push({ slotName: '', startTime: '', endTime: '' });
}

function removeBatchSlot(idx: number) {
  if (slotBatchForm.slots.length > 1) {
    slotBatchForm.slots.splice(idx, 1);
  }
}

async function handleSlotBatchSubmit() {
  if (!slotBatchRef.value) return;
  await slotBatchRef.value.validate();
  // 校验每条 slot 都填了 start / end
  for (const s of slotBatchForm.slots) {
    if (!s.startTime || !s.endTime) {
      ElMessage.error(t('gzBeanConfig.ruleBatchSlotIncomplete'));
      return;
    }
  }
  submitting.value = true;
  try {
    const payload: GzBeanTimeSlotBatchByWeekForm = {
      storeId: currentStoreId.value!,
      weekdays: weekdayArrToStr(slotBatchForm.weekdayArr),
      effectiveDate: slotBatchForm.effectiveDate || null,
      expireDate: slotBatchForm.expireDate || null,
      slots: slotBatchForm.slots.map((s) => ({
        slotName: s.slotName || null,
        startTime: s.startTime,
        endTime: s.endTime
      }))
    };
    const resp = await batchByWeekGzBeanSlot(payload);
    const r = resp as any;
    const n = r.data ?? 0;
    ElMessage.success(t('gzBeanConfig.batchInsertedHint', { n }));
    slotBatchVisible.value = false;
    await loadSlots();
  } catch (e) {
    console.error('[gz-bean-config] slot batch failed', e);
  } finally {
    submitting.value = false;
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
</style>
