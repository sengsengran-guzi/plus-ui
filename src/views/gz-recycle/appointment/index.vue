<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzRecycleAppointment.title') }}</span>
          <span class="ticket-tag">GZ-RECYCLE-003</span>
        </div>
      </template>

      <el-alert :title="t('gzRecycleAppointment.alertDesc')" type="info" :closable="false" show-icon class="mb-3" />

      <el-form :model="query" inline @submit.prevent="handleQuery">
        <el-form-item :label="t('gzRecycleAppointment.store')">
          <el-select v-model="query.storeId" :placeholder="t('gzRecycleAppointment.storePlaceholder')" clearable style="width: 160px">
            <el-option v-for="s in storeOptions" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzRecycleAppointment.status')">
          <el-select v-model="query.status" :placeholder="t('gzRecycleAppointment.statusPlaceholder')" clearable style="width: 150px">
            <el-option v-for="d in gz_recycle_status" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzRecycleAppointment.appointmentNo')">
          <el-input v-model="query.appointmentNo" :placeholder="t('gzRecycleAppointment.appointmentNoPlaceholder')" clearable style="width: 200px" />
        </el-form-item>
        <el-form-item :label="t('gzRecycleAppointment.apptDate')">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            :start-placeholder="t('gzRecycleAppointment.dateRangeStart')"
            :end-placeholder="t('gzRecycleAppointment.dateRangeEnd')"
            style="width: 240px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery">{{ t('gzRecycleAppointment.search') }}</el-button>
          <el-button @click="resetQuery">{{ t('gzRecycleAppointment.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="list" border :empty-text="t('gzRecycleAppointment.empty')">
        <el-table-column :label="t('gzRecycleAppointment.colAppointmentNo')" prop="appointmentNo" min-width="180" show-overflow-tooltip />
        <el-table-column :label="t('gzRecycleAppointment.colQtyBucket')" min-width="120">
          <template #default="{ row }">{{ row.product?.qtyBucketLabel || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzRecycleAppointment.colFinal')" width="100" align="right">
          <template #default="{ row }">
            <span v-if="row.finalAmountCent != null">¥{{ fmtYuan(row.finalAmountCent) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzRecycleAppointment.colPayoutStatus')" width="110" align="center">
          <template #default="{ row }">
            <dict-tag v-if="row.payoutStatus" :options="gz_payout_status" :value="row.payoutStatus" />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzRecycleAppointment.colStatus')" width="120">
          <template #default="{ row }">
            <dict-tag :options="gz_recycle_status" :value="row.status" />
          </template>
        </el-table-column>
        <el-table-column :label="t('gzRecycleAppointment.colApptDate')" prop="apptDate" width="120" />
        <el-table-column :label="t('gzRecycleAppointment.colCreateTime')" prop="createTime" width="170" />
        <el-table-column :label="t('gzRecycleAppointment.colAction')" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">{{ t('gzRecycleAppointment.detail') }}</el-button>
            <el-button v-if="row.status === 'payout_failed'" link type="warning" @click="onRetry(row)">{{ t('gzRecycleAppointment.retryPayout') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:limit="query.pageSize"
        v-model:page="query.pageNum"
        :total="total"
        @pagination="loadList"
      />
    </el-card>

    <!-- 详情 drawer：两套照片 + 估价/实付 + 核对留痕 -->
    <el-drawer v-model="detailVisible" :title="t('gzRecycleAppointment.detailTitle')" size="640px">
      <div v-if="detail" v-loading="detailLoading">
        <el-divider content-position="left">{{ t('gzRecycleAppointment.secBase') }}</el-divider>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item :label="t('gzRecycleAppointment.colAppointmentNo')" :span="2">{{ detail.appointmentNo }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzRecycleAppointment.colStatus')">
            <dict-tag :options="gz_recycle_status" :value="detail.status" />
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzRecycleAppointment.fieldStore')">{{ detail.storeName || detail.storeId }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzRecycleAppointment.fieldApptDate')">{{ detail.apptDate }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzRecycleAppointment.fieldArrivalSlot')">{{ arrivalSlotText(detail.arrivalSlot) }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzRecycleAppointment.fieldSlot')">{{ shortTime(detail.slotStart) }} - {{ shortTime(detail.slotEnd) }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzRecycleAppointment.fieldDuration')">
            <span v-if="detail.matchedDurationMinutes != null">{{ detail.matchedDurationMinutes }} {{ t('gzRecycleAppointment.minutes') }}</span>
            <span v-else>-</span>
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">{{ t('gzRecycleAppointment.secProduct') }}</el-divider>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item :label="t('gzRecycleAppointment.productCategory')">
            <template v-if="detail.product?.categories?.length">
              <dict-tag v-for="c in detail.product.categories" :key="c" :options="gz_recycle_category" :value="c" class="mr-1" />
            </template>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzRecycleAppointment.productIps')">{{ ipText(detail.product) }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzRecycleAppointment.productQtyBucket')">{{ detail.product?.qtyBucketLabel || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzRecycleAppointment.productRemark')">{{ detail.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">{{ t('gzRecycleAppointment.secVerify') }}</el-divider>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item :label="t('gzRecycleAppointment.fieldFinal')">
            <span v-if="detail.finalAmountCent != null">¥{{ fmtYuan(detail.finalAmountCent) }}</span>
            <span v-else>{{ t('gzRecycleAppointment.notVerified') }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzRecycleAppointment.fieldVerifiedBy')">{{ detail.verifiedBy || t('gzRecycleAppointment.notVerified') }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzRecycleAppointment.fieldVerifyTime')" :span="2">{{ detail.verifyTime || '-' }}</el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">{{ t('gzRecycleAppointment.secTransfer') }}</el-divider>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item :label="t('gzRecycleAppointment.fieldPayoutStatus')">
            <dict-tag v-if="detail.payoutStatus" :options="gz_payout_status" :value="detail.payoutStatus" />
            <span v-else>{{ t('gzRecycleAppointment.noPayout') }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzRecycleAppointment.fieldPayoutAmount')">
            <span v-if="detail.payoutAmountCent != null">¥{{ fmtYuan(detail.payoutAmountCent) }}</span>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzRecycleAppointment.fieldTransferredTime')">{{ detail.transferredTime || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzRecycleAppointment.fieldOutPayoutNo')">{{ detail.outPayoutNo || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzRecycleAppointment.fieldFailReason')" :span="2">{{ detail.failReason || '-' }}</el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">{{ t('gzRecycleAppointment.secContact') }}</el-divider>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item :label="t('gzRecycleAppointment.fieldUserId')">{{ detail.userId }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzRecycleAppointment.fieldMobile')">{{ detail.mobileSnapshot || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzRecycleAppointment.fieldWechatId')" :span="2">{{ detail.wechatIdSnapshot || '-' }}</el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">{{ t('gzRecycleAppointment.secImages') }}</el-divider>
        <div class="img-block">
          <div class="img-label">{{ t('gzRecycleAppointment.submitImages') }}</div>
          <div v-if="submitUrls.length" class="img-row">
            <el-image
              v-for="(u, i) in submitUrls"
              :key="`s-${i}`"
              :src="u"
              :preview-src-list="submitUrls"
              :initial-index="i"
              fit="cover"
              class="thumb"
            />
          </div>
          <span v-else class="img-none">{{ t('gzRecycleAppointment.noImage') }}</span>
        </div>
        <div class="img-block">
          <div class="img-label">{{ t('gzRecycleAppointment.verifyImages') }}</div>
          <div v-if="verifyUrls.length" class="img-row">
            <el-image
              v-for="(u, i) in verifyUrls"
              :key="`v-${i}`"
              :src="u"
              :preview-src-list="verifyUrls"
              :initial-index="i"
              fit="cover"
              class="thumb"
            />
          </div>
          <span v-else class="img-none">{{ t('gzRecycleAppointment.noImage') }}</span>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts" name="GzRecycleAppointment">
import { ref, reactive, toRefs, watch, getCurrentInstance, type ComponentInternalInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { listAppointment, getAppointment, retryAppointmentPayout, type GzRecycleAppointmentVO, type GzRecycleAppointmentQuery, type RecycleProductVO } from '@/api/gz-recycle/appointment';
import { getGzBeanStoreOptions, type GzBeanStoreVO } from '@/api/gz-bean/store';
import { getGzFileUrl } from '@/api/gz-common/file';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { gz_recycle_status, gz_recycle_category, gz_payout_status } = toRefs<any>(
  (proxy as any)?.useDict('gz_recycle_status', 'gz_recycle_category', 'gz_payout_status')
);

const loading = ref(false);
const list = ref<GzRecycleAppointmentVO[]>([]);
const total = ref(0);
const storeOptions = ref<GzBeanStoreVO[]>([]);
const dateRange = ref<[string, string] | null>(null);

const query = reactive<GzRecycleAppointmentQuery>({
  pageNum: 1,
  pageSize: 10,
  storeId: undefined,
  status: undefined,
  appointmentNo: undefined,
  apptDateStart: undefined,
  apptDateEnd: undefined
});

const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<GzRecycleAppointmentVO | null>(null);
const submitUrls = ref<string[]>([]);
const verifyUrls = ref<string[]>([]);

watch(dateRange, (v) => {
  query.apptDateStart = v?.[0] || undefined;
  query.apptDateEnd = v?.[1] || undefined;
});

function shortTime(s?: string): string {
  if (!s) return '';
  return s.length >= 5 ? s.slice(0, 5) : s;
}

/** 金额（分）→ 元字符串 */
function fmtYuan(cent?: number | null): string {
  return ((cent ?? 0) / 100).toFixed(2);
}

/** 到店档 morning / afternoon → 文案（旧单可能 null） */
function arrivalSlotText(slot?: string | null): string {
  if (slot === 'morning') return t('gzRecycleAppointment.slotMorning');
  if (slot === 'afternoon') return t('gzRecycleAppointment.slotAfternoon');
  return '-';
}

/** IP 展示：主数据 IP 名 + 自定义 IP 合并；都为空显 '-'（兼容旧数组投影后的 customIps） */
function ipText(product?: RecycleProductVO | null): string {
  if (!product) return '-';
  const names = [...(product.ipNames ?? []), ...(product.customIps ?? [])].filter((s) => !!s);
  return names.length ? names.join('、') : '-';
}

async function loadStores() {
  try {
    const res = await getGzBeanStoreOptions();
    storeOptions.value = res.data ?? [];
  } catch {
    storeOptions.value = [];
  }
}

async function loadList() {
  loading.value = true;
  try {
    const res = await listAppointment(query);
    list.value = res.rows ?? [];
    total.value = (res as any).total || 0;
  } catch {
    ElMessage.error(t('gzRecycleAppointment.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  query.pageNum = 1;
  loadList();
}

function resetQuery() {
  query.storeId = undefined;
  query.status = undefined;
  query.appointmentNo = undefined;
  dateRange.value = null;
  query.apptDateStart = undefined;
  query.apptDateEnd = undefined;
  handleQuery();
}

/** 解析 file id 列表 → 签名 URL（逐个调 /file/url，1h 过期）。 */
async function resolveUrls(fileIds: string[]): Promise<string[]> {
  if (!fileIds || !fileIds.length) return [];
  const urls: string[] = [];
  for (const fid of fileIds) {
    try {
      const res = await getGzFileUrl(Number(fid));
      if (res.data?.url) urls.push(res.data.url);
    } catch {
      // 单张失败跳过，不阻断其余
    }
  }
  return urls;
}

async function openDetail(row: GzRecycleAppointmentVO) {
  detailVisible.value = true;
  detailLoading.value = true;
  submitUrls.value = [];
  verifyUrls.value = [];
  try {
    const res = await getAppointment(row.id);
    detail.value = res.data;
    submitUrls.value = await resolveUrls(detail.value?.imageIds ?? []);
    verifyUrls.value = await resolveUrls(detail.value?.verifyImageIds ?? []);
  } catch {
    ElMessage.error(t('gzRecycleAppointment.loadFailed'));
  } finally {
    detailLoading.value = false;
  }
}

async function onRetry(row: GzRecycleAppointmentVO) {
  await ElMessageBox.confirm(t('gzRecycleAppointment.retryConfirm'), t('gzRecycleAppointment.tip'), { type: 'warning' });
  try {
    await retryAppointmentPayout(row.id);
    ElMessage.success(t('gzRecycleAppointment.retryOk'));
    loadList();
  } catch {
    ElMessage.error(t('gzRecycleAppointment.opFailed'));
  }
}

loadStores();
loadList();
</script>

<style scoped>
.ticket-tag {
  font-size: 12px;
  color: #909399;
}
.img-block {
  margin-bottom: 12px;
}
.img-label {
  font-size: 13px;
  color: #606266;
  margin-bottom: 6px;
}
.img-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.thumb {
  width: 96px;
  height: 96px;
  border-radius: 4px;
  border: 1px solid #ebeef5;
}
.img-none {
  font-size: 13px;
  color: #c0c4cc;
}
</style>
