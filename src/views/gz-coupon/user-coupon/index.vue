<template>
  <div class="p-2">
    <el-card v-loading="listLoading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzCouponUserCoupon.title') }}</span>
          <span class="ticket-tag">GZ-COUPON-001</span>
        </div>
      </template>

      <el-form inline class="mb-2">
        <el-form-item :label="t('gzCouponUserCoupon.colCouponNo')">
          <el-input v-model="query.couponNo" :placeholder="t('gzCouponUserCoupon.couponNoPlaceholder')" clearable style="width: 200px" @keyup.enter="loadList" />
        </el-form-item>
        <el-form-item :label="t('gzCouponUserCoupon.colStatus')">
          <el-select v-model="query.status" :placeholder="t('gzCouponUserCoupon.statusPlaceholder')" clearable style="width: 150px">
            <el-option v-for="d in gz_coupon_status" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadList">{{ t('gzCouponUserCoupon.search') }}</el-button>
          <el-button :icon="Refresh" @click="resetQuery">{{ t('gzCouponUserCoupon.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="list" border stripe size="small">
        <el-table-column :label="t('gzCouponUserCoupon.colCouponNo')" prop="couponNo" width="170" />
        <el-table-column :label="t('gzCouponUserCoupon.colTemplateName')" prop="templateName" min-width="150" show-overflow-tooltip />
        <el-table-column :label="t('gzCouponUserCoupon.colNickname')" prop="userNickname" width="130" show-overflow-tooltip />
        <el-table-column :label="t('gzCouponUserCoupon.colMobile')" prop="userMobile" width="130" />
        <el-table-column :label="t('gzCouponUserCoupon.colAmount')" width="100" align="right">
          <template #default="{ row }">¥{{ formatYuan(row.amountSnapshotCent) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzCouponUserCoupon.colStatus')" width="100">
          <template #default="{ row }"><dict-tag :options="gz_coupon_status" :value="row.status" /></template>
        </el-table-column>
        <el-table-column :label="t('gzCouponUserCoupon.colGainedTime')" prop="gainedTime" width="170" />
        <el-table-column :label="t('gzCouponUserCoupon.colExpireTime')" prop="expireTime" width="170" />
        <el-table-column :label="t('gzCouponUserCoupon.colUsedTime')" prop="usedTime" width="170">
          <template #default="{ row }">{{ row.usedTime || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzCouponUserCoupon.colRelatedPay')" prop="relatedPayOutTradeNo" width="180">
          <template #default="{ row }">{{ row.relatedPayOutTradeNo || '-' }}</template>
        </el-table-column>
        <template #empty><el-empty :description="t('gzCouponUserCoupon.empty')" /></template>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:page="query.pageNum"
        v-model:limit="query.pageSize"
        :total="total"
        @pagination="loadList"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts" name="GzCouponUserCoupon">
import { ref, reactive, getCurrentInstance, type ComponentInternalInstance, toRefs, onMounted } from 'vue';
import { Refresh, Search } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { listGzUserCoupon, type GzUserCouponVO, type GzUserCouponQuery } from '@/api/gz-coupon/userCoupon';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { gz_coupon_status } = toRefs<any>(proxy?.useDict('gz_coupon_status'));

const listLoading = ref(false);
const list = ref<GzUserCouponVO[]>([]);
const total = ref(0);
const query = reactive<GzUserCouponQuery>({ couponNo: '', status: '', pageNum: 1, pageSize: 10 });

function formatYuan(cent: number): string {
  return ((cent || 0) / 100).toFixed(2);
}

async function loadList() {
  listLoading.value = true;
  try {
    const resp = await listGzUserCoupon(query);
    const r = resp as any;
    list.value = (r.rows || []) as GzUserCouponVO[];
    total.value = r.total || 0;
  } catch (e) {
    console.error('[gz-coupon-user-coupon] loadList failed', e);
    ElMessage.error(t('gzCouponUserCoupon.loadFailed'));
  } finally {
    listLoading.value = false;
  }
}

function resetQuery() {
  query.couponNo = '';
  query.status = '';
  query.pageNum = 1;
  loadList();
}

onMounted(loadList);
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
