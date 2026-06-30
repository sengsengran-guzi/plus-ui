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

      <div class="mb-2">
        <el-button
          v-hasPermi="['gz:coupon:userCoupon:revoke']"
          type="danger"
          plain
          :icon="Delete"
          :disabled="selectedIds.length === 0"
          @click="handleBatchRevoke"
        >
          {{ t('gzCouponUserCoupon.batchRevoke') }}
        </el-button>
        <span class="revoke-hint">{{ t('gzCouponUserCoupon.revokeHint') }}</span>
      </div>

      <el-table :data="list" border stripe size="small" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="44" :selectable="(row: GzUserCouponVO) => row.status === 'unused'" />
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
        <el-table-column :label="t('gzCouponUserCoupon.colAction')" width="90" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'unused'"
              v-hasPermi="['gz:coupon:userCoupon:revoke']"
              type="danger"
              link
              size="small"
              @click="handleRevoke(row)"
            >
              {{ t('gzCouponUserCoupon.revoke') }}
            </el-button>
            <span v-else>-</span>
          </template>
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
import { Delete, Refresh, Search } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { listGzUserCoupon, revokeGzUserCoupon, type GzUserCouponVO, type GzUserCouponQuery } from '@/api/gz-coupon/userCoupon';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { gz_coupon_status } = toRefs<any>(proxy?.useDict('gz_coupon_status'));

const listLoading = ref(false);
const list = ref<GzUserCouponVO[]>([]);
const total = ref(0);
const query = reactive<GzUserCouponQuery>({ couponNo: '', status: '', pageNum: 1, pageSize: 10 });
/** 勾选的「未使用」券 id（selection 列 :selectable 已限制只能选 unused） */
const selectedIds = ref<string[]>([]);

function formatYuan(cent: number): string {
  return ((cent || 0) / 100).toFixed(2);
}

function onSelectionChange(rows: GzUserCouponVO[]) {
  selectedIds.value = rows.map((r) => r.id);
}

/** 作废确认 + 执行（单条 / 批量共用），成功后提示作废数 / 跳过数并刷新。 */
async function doRevoke(ids: string[], confirmMsg: string) {
  try {
    await ElMessageBox.confirm(confirmMsg, t('gzCouponUserCoupon.revokeConfirmTitle'), { type: 'warning' });
  } catch {
    return; // 取消
  }
  try {
    const resp = await revokeGzUserCoupon(ids);
    const r = (resp as any).data ?? resp;
    ElMessage.success(t('gzCouponUserCoupon.revokeSuccess', { revoked: r.revoked ?? 0, skipped: r.skipped ?? 0 }));
    selectedIds.value = [];
    loadList();
  } catch (e) {
    console.error('[gz-coupon-user-coupon] revoke failed', e);
  }
}

function handleRevoke(row: GzUserCouponVO) {
  doRevoke([row.id], t('gzCouponUserCoupon.revokeConfirmOne', { no: row.couponNo }));
}

function handleBatchRevoke() {
  if (selectedIds.value.length === 0) return;
  doRevoke([...selectedIds.value], t('gzCouponUserCoupon.revokeConfirmBatch', { n: selectedIds.value.length }));
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
.revoke-hint {
  margin-left: 12px;
  color: #909399;
  font-size: 12px;
}
</style>
