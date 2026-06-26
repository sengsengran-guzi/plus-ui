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
          <el-select
            v-model="query.storeId"
            :placeholder="t('gzBeanBooking.storePlaceholder')"
            clearable
            filterable
            style="width: 200px"
          >
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
            <el-option
              v-for="d in gz_bean_booking_status"
              :key="d.value"
              :label="d.label"
              :value="d.value"
            />
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

      <!-- 工具栏：扫码核销 -->
      <el-row :gutter="10" class="mb-2">
        <el-col :span="1.5">
          <el-button v-hasPermi="['gz:bean:booking:verify']" type="success" plain :icon="Camera" @click="openScanDialog">
            {{ t('gzBeanBooking.scanVerify') }}
          </el-button>
        </el-col>
      </el-row>

      <!-- 数据表格 -->
      <el-table
        v-loading="loading"
        :data="rows"
        border
        stripe
        size="small"
      >
        <el-table-column :label="t('gzBeanBooking.colBookingNo')" prop="bookingNo" width="170" />
        <el-table-column :label="t('gzBeanBooking.colStore')" prop="storeName" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.storeName || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanBooking.colMobile')" prop="mobileSnapshot" width="140">
          <template #default="{ row }">{{ row.mobileSnapshot || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzBeanBooking.colSession')" min-width="200">
          <template #default="{ row }">
            {{ row.sessDate }} {{ shortTime(row.slotStart) }}-{{ shortTime(row.slotEnd) }}
          </template>
        </el-table-column>
        <el-table-column :label="t('gzBeanBooking.colSeat')" prop="seatNoSnapshot" width="90" align="center" />
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
              @click="handleManualVerify(row)"
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
      <pagination
        v-show="total > 0"
        v-model:limit="query.pageSize"
        v-model:page="query.pageNum"
        :total="total"
        @pagination="loadList"
      />
    </el-card>

    <!-- 扫码核销 dialog（PC 端上传 QR 截图，不调摄像头） -->
    <el-dialog v-model="scanVisible" :title="t('gzBeanBooking.scanDialogTitle')" width="460px" @close="resetScan">
      <el-alert
        :title="t('gzBeanBooking.scanTip')"
        type="info"
        show-icon
        :closable="false"
        class="mb-3"
      />
      <div class="scan-upload">
        <el-button type="primary" :icon="Upload" :loading="scanDecoding" @click="triggerFile">
          {{ t('gzBeanBooking.scanUpload') }}
        </el-button>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          style="display: none"
          @change="onFileChange"
        />
        <div v-if="scanFileName" class="scan-filename">{{ scanFileName }}</div>
      </div>
      <div v-if="scanPayloadPreview" class="scan-payload">
        <span class="scan-payload-label">{{ t('gzBeanBooking.scanDecoded') }}</span>
        <code>{{ scanPayloadPreview }}</code>
      </div>
      <template #footer>
        <el-button @click="scanVisible = false">{{ t('gzBeanBooking.cancel') }}</el-button>
        <el-button
          type="success"
          :loading="scanVerifying"
          :disabled="!scanPayload"
          @click="submitScanVerify"
        >
          {{ t('gzBeanBooking.confirmVerify') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" :title="t('gzBeanBooking.detailTitle')" size="50%" direction="rtl">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item :label="t('gzBeanBooking.colBookingNo')" :span="2">{{ detail.bookingNo }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanBooking.colStore')" :span="2">{{ detail.storeName || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanBooking.colMobile')">{{ detail.mobileSnapshot || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="t('gzBeanBooking.colSeat')">{{ detail.seatNoSnapshot }}</el-descriptions-item>
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
import { ref, reactive, getCurrentInstance, type ComponentInternalInstance, toRefs, watch } from 'vue';
import { Search, Refresh, Camera, Upload } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import jsQR from 'jsqr';
import {
  listGzBeanBooking,
  getGzBeanBooking,
  verifyGzBeanBookingManual,
  verifyGzBeanBookingByScan,
  type GzBeanBookingVO,
  type GzBeanBookingQuery
} from '@/api/gz-bean/booking';
import { getGzBeanStoreOptions, type GzBeanStoreVO } from '@/api/gz-bean/store';

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

// ---- 扫码核销状态 ----
const scanVisible = ref<boolean>(false);
const scanDecoding = ref<boolean>(false);
const scanVerifying = ref<boolean>(false);
const scanPayload = ref<string>('');
const scanPayloadPreview = ref<string>('');
const scanFileName = ref<string>('');
const fileInput = ref<HTMLInputElement>();

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

/** 手动核销：二次确认 → 调 /{id}/verify */
async function handleManualVerify(row: GzBeanBookingVO) {
  const ok = await ElMessageBox.confirm(
    t('gzBeanBooking.verifyConfirm', { no: row.bookingNo }),
    t('gzBeanBooking.verifyConfirmTitle'),
    { confirmButtonText: t('gzBeanBooking.confirmVerify'), cancelButtonText: t('gzBeanBooking.cancel'), type: 'warning' }
  ).catch(() => false);
  if (!ok) return;
  try {
    await verifyGzBeanBookingManual(row.id);
    ElMessage.success(t('gzBeanBooking.verifySuccess'));
    loadList();
  } catch (e) {
    // 后端业务错误（INVALID_STATUS / NOT_FOUND）已由 request 拦截器 toast 中文 msg，这里仅记录 + 刷新
    console.error('[gz-bean-booking] manual verify failed', e);
    loadList();
  }
}

// ============================================================
//  扫码核销（PC 端上传 QR 截图 → jsqr canvas 解码 → verify-scan）
// ============================================================

function openScanDialog() {
  resetScan();
  scanVisible.value = true;
}

function triggerFile() {
  fileInput.value?.click();
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  scanFileName.value = file.name;
  scanPayload.value = '';
  scanPayloadPreview.value = '';
  decodeQrFromFile(file);
  // 清掉 input.value 以便同一文件可重复选
  input.value = '';
}

/** 用 canvas 读像素 → jsqr 解码（不调摄像头，强约束 #1） */
function decodeQrFromFile(file: File) {
  scanDecoding.value = true;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          scanDecoding.value = false;
          ElMessage.error(t('gzBeanBooking.scanDecodeFailed'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, imageData.width, imageData.height);
        scanDecoding.value = false;
        if (result && result.data) {
          scanPayload.value = result.data;
          scanPayloadPreview.value = result.data;
        } else {
          ElMessage.error(t('gzBeanBooking.scanNoCode'));
        }
      } catch (err) {
        scanDecoding.value = false;
        console.error('[gz-bean-booking] qr decode error', err);
        ElMessage.error(t('gzBeanBooking.scanDecodeFailed'));
      }
    };
    img.onerror = () => {
      scanDecoding.value = false;
      ElMessage.error(t('gzBeanBooking.scanDecodeFailed'));
    };
    img.src = reader.result as string;
  };
  reader.onerror = () => {
    scanDecoding.value = false;
    ElMessage.error(t('gzBeanBooking.scanDecodeFailed'));
  };
  reader.readAsDataURL(file);
}

/** 提交扫码核销：调 verify-scan（后端校签 + 状态校验，错误 msg 由拦截器 toast） */
async function submitScanVerify() {
  if (!scanPayload.value) return;
  scanVerifying.value = true;
  try {
    await verifyGzBeanBookingByScan(scanPayload.value);
    ElMessage.success(t('gzBeanBooking.verifySuccess'));
    scanVisible.value = false;
    loadList();
  } catch (e) {
    // 后端业务错误（QR_SIGNATURE_INVALID / INVALID_STATUS / NOT_FOUND）已由 request 拦截器
    // ElNotification 中文 msg；保留 dialog 让店员可改用手动核销 fallback（强约束 R3）
    console.error('[gz-bean-booking] scan verify failed', e);
  } finally {
    scanVerifying.value = false;
  }
}

function resetScan() {
  scanPayload.value = '';
  scanPayloadPreview.value = '';
  scanFileName.value = '';
  scanDecoding.value = false;
  scanVerifying.value = false;
}

watch(scanVisible, (v) => {
  if (!v) resetScan();
});

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
.scan-upload {
  display: flex;
  align-items: center;
  gap: 12px;
  .scan-filename {
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
}
.scan-payload {
  margin-top: 14px;
  padding: 10px 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  word-break: break-all;
  .scan-payload-label {
    display: block;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    margin-bottom: 4px;
  }
  code {
    font-size: 13px;
    color: var(--el-color-success);
  }
}
</style>
