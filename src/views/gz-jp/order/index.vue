<template>
  <div class="p-2">
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzJpOrder.title') }}</span>
          <span class="ticket-tag">GZ-JP-109</span>
        </div>
      </template>

      <el-alert type="info" :description="t('gzJpOrder.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 查询条 -->
      <el-form inline class="mb-2">
        <el-form-item :label="t('gzJpOrder.colOrderNo')">
          <el-input
            v-model="query.orderNo"
            :placeholder="t('gzJpOrder.orderNoPlaceholder')"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item :label="t('gzJpOrder.colUser')">
          <el-input
            v-model="query.keyword"
            :placeholder="t('gzJpOrder.keywordPlaceholder')"
            clearable
            style="width: 180px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item :label="t('gzJpOrder.colStatus')">
          <el-select
            v-model="query.businessStatus"
            multiple
            collapse-tags
            collapse-tags-tooltip
            :placeholder="t('gzJpOrder.statusPlaceholder')"
            clearable
            style="width: 240px"
          >
            <el-option v-for="d in gz_jp_order_status" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzJpOrder.colCreateTime')">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            :start-placeholder="t('gzJpOrder.dateStart')"
            :end-placeholder="t('gzJpOrder.dateEnd')"
            :range-separator="t('gzJpOrder.dateTo')"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">{{ t('gzJpOrder.search') }}</el-button>
          <el-button :icon="Refresh" @click="resetQuery">{{ t('gzJpOrder.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 列表：订单号 / 客人 / 款数 / 实付 / 订单状态 / 下单时间（UI:admin.order）
           ★ 只读页 —— 唯一的操作是「详情」，没有任何写按钮 -->
      <el-table v-loading="listLoading" :data="list" border stripe size="small">
        <el-table-column :label="t('gzJpOrder.colOrderNo')" prop="orderNo" width="185" show-overflow-tooltip />
        <el-table-column :label="t('gzJpOrder.colUser')" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ userName(row) }}</div>
            <div v-if="row.userMobile" class="sub-text">{{ row.userMobile }}</div>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzJpOrder.colItemCount')" width="110" align="center">
          <template #default="{ row }">
            <span>{{ t('gzJpOrder.itemCountText', { n: row.itemCount, q: row.totalQty }) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzJpOrder.colAmount')" width="115" align="right">
          <template #default="{ row }">¥{{ centToYuanText(row.totalAmountCent) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzJpOrder.colStatus')" width="110" align="center">
          <template #default="{ row }">
            <dict-tag :options="gz_jp_order_status" :value="row.businessStatus" />
          </template>
        </el-table-column>
        <el-table-column :label="t('gzJpOrder.colCreateTime')" prop="createTime" width="165" />
        <el-table-column :label="t('gzJpOrder.colPaidTime')" width="165">
          <template #default="{ row }">{{ row.paidTime || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzJpOrder.colAction')" fixed="right" width="90" align="center">
          <template #default="{ row }">
            <el-button v-hasPermi="['gz:jp:order:list']" type="info" link size="small" @click="handleDetail(row)">
              {{ t('gzJpOrder.detail') }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('gzJpOrder.empty')" /></template>
      </el-table>

      <pagination v-show="total > 0" v-model:page="query.pageNum" v-model:limit="query.pageSize" :total="total" @pagination="loadList" />
    </el-card>

    <!-- 详情抽屉：订单头 + 收货地址 + 逐行商品及履约状态（★ 全只读） -->
    <el-drawer v-model="detailVisible" :title="t('gzJpOrder.detailTitle')" size="860px">
      <div v-if="detail" v-loading="detailLoading">
        <el-descriptions :column="2" border size="small" class="mb-3">
          <el-descriptions-item :label="t('gzJpOrder.colOrderNo')">{{ detail.orderNo }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzJpOrder.colStatus')">
            <dict-tag :options="gz_jp_order_status" :value="detail.businessStatus" />
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzJpOrder.colUser')">
            {{ userName(detail) }}
            <span v-if="detail.userMobile" class="sub-text">（{{ detail.userMobile }}）</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzJpOrder.fieldUserNo')">{{ detail.userNo || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzJpOrder.colAmount')">
            <span class="amount-text">¥{{ centToYuanText(detail.totalAmountCent) }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzJpOrder.colItemCount')">
            {{ t('gzJpOrder.itemCountText', { n: detail.itemCount, q: detail.totalQty }) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzJpOrder.colCreateTime')">{{ detail.createTime || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzJpOrder.colPaidTime')">{{ detail.paidTime || '-' }}</el-descriptions-item>
          <el-descriptions-item v-if="detail.cancelledTime" :label="t('gzJpOrder.fieldCancelledTime')">
            {{ detail.cancelledTime }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzJpOrder.fieldUserNote')" :span="2">{{ detail.userNote || '-' }}</el-descriptions-item>
        </el-descriptions>

        <!-- 支付流水（内部运营信息，对账时拿去微信商户后台核） -->
        <div class="section-title">{{ t('gzJpOrder.sectionPay') }}</div>
        <el-descriptions :column="2" border size="small" class="mb-3">
          <el-descriptions-item :label="t('gzJpOrder.fieldOutTradeNo')">{{ detail.outTradeNo || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzJpOrder.fieldWxTransactionId')">{{ detail.wxTransactionId || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzJpOrder.fieldPayStatus')">{{ detail.payStatus || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzJpOrder.fieldPayFee')">
            {{ detail.payFeeCent === null || detail.payFeeCent === undefined ? '-' : `¥${centToYuanText(detail.payFeeCent)}` }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzJpOrder.fieldRemark')" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <!-- 收货地址（下单锁定的快照，不是地址簿当前值） -->
        <div class="section-title">{{ t('gzJpOrder.sectionAddress') }}</div>
        <el-descriptions v-if="detail.address" :column="2" border size="small" class="mb-3">
          <el-descriptions-item :label="t('gzJpOrder.fieldRecipient')">{{ detail.address.recipient || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzJpOrder.fieldRecipientMobile')">{{ detail.address.mobile || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzJpOrder.fieldAddress')" :span="2">{{ addressText(detail.address) }}</el-descriptions-item>
        </el-descriptions>
        <el-empty v-else :description="t('gzJpOrder.addressMissing')" :image-size="60" />

        <!-- 商品行 + 履约状态（★ 只读；推进操作在履约看板） -->
        <div class="section-title">
          {{ t('gzJpOrder.sectionItems') }}
          <span class="section-hint">{{ t('gzJpOrder.itemsReadonlyHint') }}</span>
        </div>
        <el-table :data="detail.items" border stripe size="small">
          <el-table-column :label="t('gzJpOrder.colImage')" width="70" align="center">
            <template #default="{ row }">
              <GzImageThumb :file-id="row.mainImageId" :size="44" />
            </template>
          </el-table-column>
          <el-table-column :label="t('gzJpOrder.colProduct')" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">
              <div>{{ row.name }}</div>
              <div class="sub-text">{{ row.productNo || '-' }}</div>
            </template>
          </el-table-column>
          <el-table-column :label="t('gzJpOrder.colEvent')" min-width="130" show-overflow-tooltip>
            <template #default="{ row }">{{ row.eventName || '-' }}</template>
          </el-table-column>
          <el-table-column :label="t('gzJpOrder.colQty')" width="60" align="center" prop="qty" />
          <el-table-column :label="t('gzJpOrder.colLineAmount')" width="100" align="right">
            <template #default="{ row }">¥{{ centToYuanText(row.amountCent) }}</template>
          </el-table-column>
          <el-table-column :label="t('gzJpOrder.colFulfill')" width="120" align="center">
            <template #default="{ row }">
              <dict-tag :options="gz_jp_fulfill_status" :value="row.fulfillStatus" />
            </template>
          </el-table-column>
          <el-table-column :label="t('gzJpOrder.colTracking')" min-width="180">
            <template #default="{ row }">
              <span v-if="row.trackingNo">
                {{ row.carrierLabel || row.carrierCode }} {{ row.trackingNo }}
                <div class="sub-text">{{ row.shippedAt || '' }}</div>
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('gzJpOrder.colRefund')" width="120" align="center">
            <template #default="{ row }">
              <span v-if="row.refundStatus">
                <dict-tag :options="gz_jp_refund_status" :value="row.refundStatus" />
                <div class="sub-text">¥{{ centToYuanText(row.refundAmountCent ?? 0) }}</div>
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <template #empty><el-empty :description="t('gzJpOrder.itemsEmpty')" :image-size="60" /></template>
        </el-table>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts" name="GzJpOrder">
import { ref, reactive, watch, onMounted, getCurrentInstance, toRefs, type ComponentInternalInstance } from 'vue';
import { Refresh, Search } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import GzImageThumb from '@/components/GzImageThumb/index.vue';
import {
  listGzJpOrder,
  getGzJpOrder,
  type GzJpOrderAdminVO,
  type GzJpOrderAdminDetailVO,
  type GzJpOrderAddress,
  type GzJpOrderQuery
} from '@/api/gz-jp/order';

/**
 * GZ-JP-109 拼团订单管理（UI:admin.order）—— ★ 只读查单页。
 *
 * 本页刻意没有任何写操作：推进履约状态 / 填运单号 / 标记购买失败全在【履约看板】做
 * （GZ-JP-108，权限 gz:jp:fulfill:advance|ship）。查单页开写口子 = 绕过状态机守卫。
 *
 * ★ 与履约看板的另一处口径差异：本页【不过滤付款状态】，待支付 / 已取消的单必须能查到 ——
 *   客人问「我下的单怎么不见了」，答案往往正是「那单没付成功」。
 */
const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { gz_jp_order_status, gz_jp_fulfill_status, gz_jp_refund_status } = toRefs<any>(
  proxy?.useDict('gz_jp_order_status', 'gz_jp_fulfill_status', 'gz_jp_refund_status')
);

const listLoading = ref(false);
const detailLoading = ref(false);

const list = ref<GzJpOrderAdminVO[]>([]);
const total = ref(0);
const query = reactive<GzJpOrderQuery>({ orderNo: '', keyword: '', businessStatus: [], pageNum: 1, pageSize: 10 });

/** daterange 双向绑定，提交前拆回 beginDate / endDate */
const dateRange = ref<[string, string] | null>(null);
watch(dateRange, (v) => {
  query.beginDate = v?.[0] ?? undefined;
  query.endDate = v?.[1] ?? undefined;
});

/** 分 → 元（展示用；后端一律传整数分，前端不做金额计算） */
function centToYuanText(cent: number | null | undefined): string {
  return ((cent ?? 0) / 100).toFixed(2);
}

/** 客人显示名：昵称优先，没昵称回落用户编号（微信昵称可能为空） */
function userName(row: { userNickname?: string | null; userNo?: string | null }): string {
  return row.userNickname || row.userNo || '-';
}

function addressText(a: GzJpOrderAddress): string {
  return [a.province, a.city, a.district, a.detail].filter(Boolean).join(' ') || '-';
}

async function loadList() {
  listLoading.value = true;
  try {
    const res = await listGzJpOrder(query);
    list.value = res.rows;
    total.value = res.total;
  } finally {
    listLoading.value = false;
  }
}

function handleSearch() {
  query.pageNum = 1;
  loadList();
}

function resetQuery() {
  query.orderNo = '';
  query.keyword = '';
  query.businessStatus = [];
  dateRange.value = null;
  query.beginDate = undefined;
  query.endDate = undefined;
  query.pageNum = 1;
  loadList();
}

const detailVisible = ref(false);
const detail = ref<GzJpOrderAdminDetailVO | null>(null);

async function handleDetail(row: GzJpOrderAdminVO) {
  detail.value = null;
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    const { data } = await getGzJpOrder(row.id);
    detail.value = data;
  } finally {
    detailLoading.value = false;
  }
}

onMounted(() => {
  loadList();
});
</script>

<style scoped>
.ticket-tag {
  font-size: 12px;
  color: #909399;
}
.sub-text {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
.amount-text {
  font-weight: 600;
}
.section-title {
  margin: 4px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.section-hint {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}
</style>
