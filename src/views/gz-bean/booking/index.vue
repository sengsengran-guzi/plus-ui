<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzBeanBooking.title') }}</span>
          <span class="ticket-tag">GZ-BEAN-008</span>
        </div>
      </template>

      <!-- 查询表单 -->
      <el-form :model="query" inline @submit.prevent="handleQuery">
        <el-form-item :label="t('gzBeanBooking.store')">
          <el-select v-model="query.storeId" :placeholder="t('gzBeanBooking.storePlaceholder')" clearable filterable style="width: 200px">
            <el-option v-for="s in storeOptions" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanBooking.date')">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            :start-placeholder="t('gzBeanBooking.dateStart')"
            :end-placeholder="t('gzBeanBooking.dateEnd')"
            :range-separator="t('gzBeanBooking.dateTo')"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item :label="t('gzBeanBooking.status')">
          <el-select
            v-model="query.bizStatusList"
            multiple
            collapse-tags
            collapse-tags-tooltip
            :placeholder="t('gzBeanBooking.statusPlaceholder')"
            clearable
            style="width: 240px"
          >
            <el-option v-for="d in gz_bean_booking_status" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanBooking.mobile')">
          <el-input
            v-model="query.mobile"
            :placeholder="t('gzBeanBooking.mobilePlaceholder')"
            clearable
            style="width: 160px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item>
          <el-button v-hasPermi="['gz:bean:booking:list']" type="primary" :icon="Search" @click="handleQuery">
            {{ t('gzBeanBooking.search') }}
          </el-button>
          <el-button :icon="Refresh" @click="handleReset">{{ t('gzBeanBooking.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 工具栏：代客预定（扫码核销已下线，真机扫码走 mp 店员端） -->
      <el-row :gutter="10" class="mb-2">
        <el-col :span="1.5">
          <el-button v-hasPermi="['gz:bean:booking:verify']" type="primary" plain :icon="Plus" @click="openProxyCreate">
            {{ t('gzBeanBooking.proxyCreate') }}
          </el-button>
        </el-col>
      </el-row>

      <!-- 数据表格 -->
      <el-table v-loading="loading" :data="rows" border stripe size="small">
        <el-table-column :label="t('gzBeanBooking.colBookingNo')" prop="bookingNo" width="170" />
        <el-table-column :label="t('gzBeanBooking.colStore')" prop="storeName" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.storeName || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanBooking.colMobile')" prop="mobileSnapshot" width="140">
          <template #default="{ row }">{{ row.mobileSnapshot || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanBooking.colSession')" min-width="200">
          <template #default="{ row }"> {{ row.sessDate }} {{ shortTime(row.slotStart) }}-{{ shortTime(row.slotEnd) }} </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanBooking.colSeat')" width="150" align="center">
          <template #default="{ row }">
            <span class="seat-no">{{ row.seatNoSnapshot || '-' }}</span>
            <span v-if="row.seatTypeSnapshot" class="seat-type">{{ row.seatTypeSnapshot }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanBooking.colStatus')" prop="bizStatus" width="100" align="center">
          <template #default="{ row }">
            <dict-tag :options="gz_bean_booking_status" :value="row.bizStatus" />
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanBooking.colCreateTime')" prop="createTime" width="170" />
        <el-table-column :label="t('gzBeanBooking.colAction')" fixed="right" width="170" align="center">
          <template #default="{ row }">
            <el-button
              v-hasPermi="['gz:bean:booking:verify']"
              type="success"
              link
              size="small"
              :disabled="row.bizStatus !== 'paid'"
              @click="openVerifyAssign(row)"
            >
              {{ t('gzBeanBooking.verify') }}
            </el-button>
            <el-button v-hasPermi="['gz:bean:booking:query']" type="primary" link size="small" @click="handleDetail(row)">
              {{ t('gzBeanBooking.detail') }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="t('gzBeanBooking.empty')" />
        </template>
      </el-table>

      <!-- 分页 -->
      <pagination v-show="total > 0" v-model:limit="query.pageSize" v-model:page="query.pageNum" :total="total" @pagination="loadList" />
    </el-card>

    <!-- 核销分座 dialog（ADR-0016：列表核销也需现场选座，选本店同桌型座） -->
    <el-dialog v-model="verifyVisible" :title="t('gzBeanBooking.verifyAssignTitle')" width="460px">
      <template v-if="verifyTarget">
        <el-descriptions :column="1" border size="small" class="mb-3">
          <el-descriptions-item :label="t('gzBeanBooking.colBookingNo')">{{ verifyTarget.bookingNo }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBooking.colSeat')">{{ verifyTarget.seatTypeSnapshot || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBooking.colSession')">
            {{ verifyTarget.sessDate }} {{ shortTime(verifyTarget.slotStart) }}-{{ shortTime(verifyTarget.slotEnd) }}
          </el-descriptions-item>
        </el-descriptions>
        <div class="verify-seat-row">
          <span class="verify-seat-label">{{ t('gzBeanBooking.verifyPickSeat') }}</span>
          <el-select
            v-model="verifySeatId"
            :placeholder="verifySeatOptions.length === 0 ? t('gzBeanBooking.verifyNoSeat') : t('gzBeanBooking.verifySeatPlaceholder')"
            filterable
            :loading="verifySeatLoading"
            :disabled="verifySeatOptions.length === 0"
            style="flex: 1"
          >
            <el-option
              v-for="seat in verifySeatOptions"
              :key="seat.id"
              :label="seat.tableNo ? `${seat.seatNo}（${seat.tableNo}）` : seat.seatNo"
              :value="seat.id"
            />
          </el-select>
        </div>
        <el-alert type="info" :closable="false" show-icon class="mt-2" :description="t('gzBeanBooking.verifyAssignHint')" />
      </template>
      <template #footer>
        <el-button @click="verifyVisible = false">{{ t('gzBeanBooking.cancel') }}</el-button>
        <el-button type="success" :loading="verifySubmitting" :disabled="verifySeatId == null" @click="submitVerifyAssign">
          {{ t('gzBeanBooking.confirmVerify') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 代客预定 dialog（GZ-BEAN-039 线下散客：店员代建 pending 待分座单，线下已付；座位留到核销时分） -->
    <el-dialog v-model="proxyVisible" :title="t('gzBeanBooking.proxyCreateTitle')" width="560px" @close="resetProxy">
      <el-form ref="proxyFormRef" :model="proxyForm" label-width="120px">
        <el-form-item :label="t('gzBeanBooking.proxyStore')" required>
          <el-select
            v-model="proxyForm.storeId"
            :placeholder="t('gzBeanBooking.proxyStorePlaceholder')"
            filterable
            style="width: 100%"
            @change="onProxyStoreChange"
          >
            <el-option v-for="s in storeOptions" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanBooking.proxyDate')" required>
          <el-date-picker
            v-model="proxyForm.sessDate"
            type="date"
            value-format="YYYY-MM-DD"
            :placeholder="t('gzBeanBooking.proxyDatePlaceholder')"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item :label="t('gzBeanBooking.proxySlotStart')" required>
          <el-time-select
            v-model="proxySlotStart"
            :placeholder="t('gzBeanBooking.proxySlotPlaceholder')"
            start="08:00"
            step="01:00"
            end="23:00"
            style="width: 48%"
          />
          <span class="proxy-slot-sep">-</span>
          <el-time-select
            v-model="proxySlotEnd"
            :placeholder="t('gzBeanBooking.proxySlotPlaceholder')"
            :start="proxySlotEndStart"
            step="01:00"
            end="24:00"
            :disabled="!proxySlotStart"
            style="width: 48%"
          />
        </el-form-item>
        <el-form-item :label="t('gzBeanBooking.proxySeatType')" required>
          <el-select
            v-model="proxyForm.seatTypeConfigId"
            :placeholder="t('gzBeanBooking.proxySeatTypePlaceholder')"
            filterable
            :loading="proxyTypeLoading"
            :disabled="!proxyForm.storeId"
            style="width: 100%"
          >
            <el-option
              v-for="c in proxySeatTypeOptions"
              :key="c.id"
              :label="`${c.name}（¥${c.priceYuan}）`"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanBooking.proxyMobile')">
          <el-input
            v-model="proxyForm.mobile"
            :placeholder="t('gzBeanBooking.proxyMobilePlaceholder')"
            clearable
            maxlength="11"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item :label="t('gzBeanBooking.customerName')">
          <el-input
            v-model="proxyForm.customerName"
            :placeholder="t('gzBeanBooking.customerNamePlaceholder')"
            clearable
            maxlength="50"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item :label="t('gzBeanBooking.offlineAmount')">
          <el-input-number
            v-model="proxyAmountYuan"
            :min="0"
            :precision="2"
            :step="1"
            :placeholder="t('gzBeanBooking.offlineAmountPlaceholder')"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="proxyVisible = false">{{ t('gzBeanBooking.cancel') }}</el-button>
        <el-button type="primary" :loading="proxySubmitting" @click="submitProxyCreate">
          {{ t('gzBeanBooking.proxySubmit') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" :title="t('gzBeanBooking.detailTitle')" size="50%" direction="rtl">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item :label="t('gzBeanBooking.colBookingNo')" :span="2">{{ detail.bookingNo }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanBooking.colStore')" :span="2">{{ detail.storeName || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanBooking.colMobile')">{{ detail.mobileSnapshot || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanBooking.colSeat')">
          {{ detail.seatNoSnapshot || '-' }}
          <span v-if="detail.seatTypeSnapshot" class="seat-type-inline">（{{ detail.seatTypeSnapshot }}）</span>
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanBooking.colSession')" :span="2">
          {{ detail.sessDate }} {{ shortTime(detail.slotStart) }}-{{ shortTime(detail.slotEnd) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanBooking.colStatus')">
          <dict-tag :options="gz_bean_booking_status" :value="detail.bizStatus" />
        </el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanBooking.verifyTime')">{{ detail.verifyTime || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanBooking.verifiedBy')">{{ detail.verifiedBy || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanBooking.cancelledTime')">{{ detail.cancelledTime || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanBooking.colCreateTime')" :span="2">{{ detail.createTime }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanBooking.remark')" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>

<script setup lang="ts" name="GzBeanBooking">
import { ref, reactive, computed, getCurrentInstance, type ComponentInternalInstance, toRefs } from 'vue';
import { Search, Refresh, Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import {
  listGzBeanBooking,
  getGzBeanBooking,
  verifyGzBeanBookingWithSeat,
  getGzBeanAssignableSeats,
  adminCreateGzBeanBooking,
  type GzBeanBookingVO,
  type GzBeanBookingQuery,
  type GzBeanAdminCreateBody
} from '@/api/gz-bean/booking';
import { getGzBeanStoreOptions, type GzBeanStoreVO } from '@/api/gz-bean/store';
import { listGzBeanSeatTypeConfigByStore, type GzBeanSeatTypeConfigVO } from '@/api/gz-bean/seatTypeConfig';
import type { GzBeanSeatVO } from '@/api/gz-bean/seat';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { gz_bean_booking_status } = toRefs<any>(proxy?.useDict('gz_bean_booking_status'));

const loading = ref<boolean>(false);
const rows = ref<GzBeanBookingVO[]>([]);
const total = ref<number>(0);
const storeOptions = ref<GzBeanStoreVO[]>([]);

/**
 * 日期范围默认空（看全部预约）。
 * 拼豆预约是「未来到店」预约，按 sess_date（到店日）筛 —— 默认 today-today 会把所有非今天的
 * 预约挡在视野外（管理者最关心的恰是未来的待到店）。故默认不筛日期，管理者按需缩小范围。
 */
const dateRange = ref<[string, string] | null>(null);

const query = reactive<GzBeanBookingQuery>({
  pageNum: 1,
  pageSize: 10,
  bizStatusList: []
});

const detailVisible = ref<boolean>(false);
const detail = ref<GzBeanBookingVO | null>(null);

/** HH:mm:ss → HH:mm */
function shortTime(t?: string): string {
  if (!t) return '';
  return t.length >= 5 ? t.slice(0, 5) : t;
}

async function loadStores() {
  try {
    // ruoyi request.ts 已解包 R/TableDataInfo，直接拿到 data 数组
    const resp = await getGzBeanStoreOptions();
    storeOptions.value = ((resp as any).data || resp) as GzBeanStoreVO[];
  } catch (e) {
    console.error('[gz-bean-booking] load store options failed', e);
  }
}

async function loadList() {
  loading.value = true;
  try {
    query.sessDateFrom = dateRange.value?.[0];
    query.sessDateTo = dateRange.value?.[1];
    const resp = await listGzBeanBooking(query);
    rows.value = (resp as any).rows || [];
    total.value = (resp as any).total || 0;
  } catch (e) {
    console.error('[gz-bean-booking] load failed', e);
    ElMessage.error(t('gzBeanBooking.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  query.pageNum = 1;
  loadList();
}

function handleReset() {
  query.storeId = undefined;
  query.bizStatusList = [];
  query.mobile = undefined;
  query.bookingNo = undefined;
  dateRange.value = null;
  query.pageNum = 1;
  loadList();
}

async function handleDetail(row: GzBeanBookingVO) {
  try {
    const resp = await getGzBeanBooking(row.id);
    detail.value = (resp as any).data || (resp as any);
    detailVisible.value = true;
  } catch (e) {
    console.error('[gz-bean-booking] detail failed', e);
  }
}

// ============================================================
//  核销分座（ADR-0016：列表核销也需现场选座，否则后端 SEAT_REQUIRED「先选座」）
// ============================================================

const verifyVisible = ref<boolean>(false);
const verifySubmitting = ref<boolean>(false);
const verifySeatLoading = ref<boolean>(false);
const verifyTarget = ref<GzBeanBookingVO | null>(null);
const verifySeatId = ref<number | string | undefined>(undefined);
/** 核销弹窗可选座：后端已按「该预约桌型 + 日期 + 时段」算好可分配空闲座（排已占/已关闭），前端直接展示。 */
const verifySeatOptions = ref<GzBeanSeatVO[]>([]);

/** 打开核销分座弹窗：拉该预约时段可分配的空闲座（避免店员点到已占座再报错）。 */
async function openVerifyAssign(row: GzBeanBookingVO) {
  verifyTarget.value = row;
  verifySeatId.value = undefined;
  verifySeatOptions.value = [];
  verifyVisible.value = true;
  verifySeatLoading.value = true;
  try {
    const resp = await getGzBeanAssignableSeats(row.id);
    verifySeatOptions.value = ((resp as any).data || resp || []) as GzBeanSeatVO[];
  } catch (e) {
    console.error('[gz-bean-booking] load assignable seats failed', e);
    ElMessage.error(t('gzBeanBooking.loadFailed'));
  } finally {
    verifySeatLoading.value = false;
  }
}

/** 提交核销分座：verify?seatId=（后端校座位存在/本店/桌型匹配/未被占，错误 msg 由拦截器 toast）。 */
async function submitVerifyAssign() {
  if (!verifyTarget.value) return;
  if (verifySeatId.value == null) {
    ElMessage.warning(t('gzBeanBooking.verifyRequireSeat'));
    return;
  }
  verifySubmitting.value = true;
  try {
    await verifyGzBeanBookingWithSeat(verifyTarget.value.id, verifySeatId.value);
    ElMessage.success(t('gzBeanBooking.verifySuccess'));
    verifyVisible.value = false;
    loadList();
  } catch (e) {
    // 座被占（SEAT_TAKEN）/ 桌型不符 / 已非 pending 等业务码 → 拦截器已 toast 中文 msg；
    // 保留弹窗让店员改选座位重试，并刷新列表（可能已被并发核销 / 座位状态变化）。
    console.error('[gz-bean-booking] verify-with-seat failed', e);
    loadList();
  } finally {
    verifySubmitting.value = false;
  }
}

// ============================================================
//  代客预定（GZ-BEAN-039 线下散客：店员代选座 → 一步 used + 线下已付）
// ============================================================

interface ProxyForm {
  storeId?: number | string;
  seatTypeConfigId?: number | string;
  sessDate?: string;
  mobile?: string;
  customerName?: string;
}

const proxyVisible = ref<boolean>(false);
const proxySubmitting = ref<boolean>(false);
const proxyTypeLoading = ref<boolean>(false);
const proxyForm = reactive<ProxyForm>({});
/** 时段（HH:mm，提交时补 :00 → HH:mm:ss） */
const proxySlotStart = ref<string>('');
const proxySlotEnd = ref<string>('');
/** 金额按元输入（el-input-number），提交转分；留空（null）= 后端自动计价 */
const proxyAmountYuan = ref<number | null>(null);
const proxySeatTypeOptions = ref<GzBeanSeatTypeConfigVO[]>([]);

/** 结束时段下拉起点 = 开始时段 + 1h（保证连续整点、止 > 起） */
const proxySlotEndStart = computed<string>(() => {
  if (!proxySlotStart.value) return '09:00';
  const h = Number(proxySlotStart.value.split(':')[0]);
  if (Number.isNaN(h)) return '09:00';
  return `${String(h + 1).padStart(2, '0')}:00`;
});

/** 今天 yyyy-MM-dd（代客预定默认日期）。 */
function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 打开代客预定：默认门店=第一个、日期=今天（店员通常只改时段/桌型），不在此选座（核销时分座）。 */
function openProxyCreate() {
  resetProxy();
  proxyForm.sessDate = todayStr();
  const firstStore = storeOptions.value[0]?.id;
  if (firstStore != null) {
    proxyForm.storeId = firstStore;
    void onProxyStoreChange(firstStore);
  }
  proxyVisible.value = true;
}

function resetProxy() {
  proxyForm.storeId = undefined;
  proxyForm.seatTypeConfigId = undefined;
  proxyForm.sessDate = undefined;
  proxyForm.mobile = undefined;
  proxyForm.customerName = undefined;
  proxySlotStart.value = '';
  proxySlotEnd.value = '';
  proxyAmountYuan.value = null;
  proxySeatTypeOptions.value = [];
}

/** 切门店 → 重拉该店桌型档，清空已选桌型（座位不在此选，核销时分）。 */
async function onProxyStoreChange(storeId: number | string) {
  proxyForm.seatTypeConfigId = undefined;
  proxySeatTypeOptions.value = [];
  if (storeId == null) return;
  proxyTypeLoading.value = true;
  try {
    const typeResp = await listGzBeanSeatTypeConfigByStore(Number(storeId));
    const types = ((typeResp as any).data || typeResp || []) as GzBeanSeatTypeConfigVO[];
    proxySeatTypeOptions.value = types.filter((c) => c.enabled === 1);
  } catch (e) {
    console.error('[gz-bean-booking] proxy load store types failed', e);
    ElMessage.error(t('gzBeanBooking.loadFailed'));
  } finally {
    proxyTypeLoading.value = false;
  }
}

async function submitProxyCreate() {
  if (proxyForm.storeId == null) {
    ElMessage.warning(t('gzBeanBooking.proxyRequireStore'));
    return;
  }
  if (!proxyForm.sessDate) {
    ElMessage.warning(t('gzBeanBooking.proxyRequireDate'));
    return;
  }
  if (!proxySlotStart.value || !proxySlotEnd.value) {
    ElMessage.warning(t('gzBeanBooking.proxyRequireSlot'));
    return;
  }
  if (proxySlotEnd.value <= proxySlotStart.value) {
    ElMessage.warning(t('gzBeanBooking.proxySlotInvalid'));
    return;
  }
  if (proxyForm.seatTypeConfigId == null) {
    ElMessage.warning(t('gzBeanBooking.proxyRequireSeatType'));
    return;
  }
  const body: GzBeanAdminCreateBody = {
    storeId: proxyForm.storeId,
    seatTypeConfigId: proxyForm.seatTypeConfigId,
    sessDate: proxyForm.sessDate,
    slotStart: `${proxySlotStart.value}:00`,
    slotEnd: `${proxySlotEnd.value}:00`
  };
  if (proxyForm.mobile) body.mobile = proxyForm.mobile;
  if (proxyForm.customerName) body.customerName = proxyForm.customerName;
  if (proxyAmountYuan.value != null) body.amountCent = Math.round(proxyAmountYuan.value * 100);

  proxySubmitting.value = true;
  try {
    await adminCreateGzBeanBooking(body);
    ElMessage.success(t('gzBeanBooking.proxyCreateSuccess'));
    proxyVisible.value = false;
    loadList();
  } catch (e) {
    // 后端业务错误码（座被占 / 桌型不符 / 配额不足等）已由 request 拦截器 toast 中文 msg
    console.error('[gz-bean-booking] proxy create failed', e);
  } finally {
    proxySubmitting.value = false;
  }
}

loadStores();
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
.seat-no {
  font-weight: 600;
}
.seat-type {
  display: block;
  margin-top: 2px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.seat-type-inline {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.proxy-slot-sep {
  display: inline-block;
  width: 4%;
  text-align: center;
  color: var(--el-text-color-secondary);
}
.verify-seat-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.verify-seat-label {
  flex-shrink: 0;
  font-weight: 600;
  color: var(--el-text-color-regular);
}
</style>
