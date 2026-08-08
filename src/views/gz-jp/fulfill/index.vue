<template>
  <div class="p-2">
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzJpFulfill.title') }}</span>
          <div>
            <el-button v-hasPermi="['gz:jp:refund:list']" type="warning" plain size="small" @click="openRefundDrawer">
              {{ t('gzJpFulfill.refundEntry') }}
            </el-button>
            <span class="ticket-tag">GZ-JP-108</span>
          </div>
        </div>
      </template>

      <el-alert type="info" :description="t('gzJpFulfill.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 顶部筛选：客人 / 履约状态 / 场 / 下单时间段（What 明列的四项）+ 订单号 / 运单号 -->
      <el-form inline class="mb-2">
        <el-form-item :label="t('gzJpFulfill.filterUser')">
          <el-input
            v-model="query.keyword"
            data-test="filter-keyword"
            :placeholder="t('gzJpFulfill.filterUserPlaceholder')"
            clearable
            style="width: 180px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item :label="t('gzJpFulfill.filterStatus')">
          <el-select
            v-model="query.fulfillStatus"
            data-test="filter-status"
            multiple
            collapse-tags
            collapse-tags-tooltip
            :placeholder="t('gzJpFulfill.filterStatusPlaceholder')"
            clearable
            style="width: 260px"
          >
            <el-option v-for="d in gz_jp_fulfill_status" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzJpFulfill.filterEvent')">
          <el-select
            v-model="query.eventId"
            data-test="filter-event"
            :placeholder="t('gzJpFulfill.filterEventPlaceholder')"
            clearable
            filterable
            style="width: 200px"
          >
            <el-option v-for="e in eventOptions" :key="e.id" :label="e.name" :value="e.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzJpFulfill.filterCreateTime')">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            :start-placeholder="t('gzJpFulfill.dateStart')"
            :end-placeholder="t('gzJpFulfill.dateEnd')"
            :range-separator="t('gzJpFulfill.dateTo')"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item :label="t('gzJpFulfill.filterOrderNo')">
          <el-input
            v-model="query.orderNo"
            data-test="filter-order-no"
            :placeholder="t('gzJpFulfill.filterOrderNoPlaceholder')"
            clearable
            style="width: 190px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item :label="t('gzJpFulfill.filterTrackingNo')">
          <el-input
            v-model="query.trackingNo"
            data-test="filter-tracking-no"
            :placeholder="t('gzJpFulfill.filterTrackingNoPlaceholder')"
            clearable
            style="width: 190px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" data-test="btn-search" :icon="Search" @click="handleSearch">{{ t('gzJpFulfill.search') }}</el-button>
          <el-button :icon="Refresh" data-test="btn-reset" @click="resetQuery">{{ t('gzJpFulfill.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 全局操作条：显示当前勾选跨了几位客人。★ 跨客人时三个批量按钮一律置灰
           （一个运单号只属一个客人；推进/标失败虽然后端不限客人，但同样收口到「一次只处理一位客人」，
             避免店员在多组之间误勾。分组自己的按钮永远可用，所以不会死路） -->
      <div class="action-bar" data-test="action-bar">
        <div class="action-bar__info">
          <el-tag v-if="selectedCount === 0" type="info" size="small">{{ t('gzJpFulfill.selectNone') }}</el-tag>
          <template v-else>
            <el-tag type="primary" size="small" data-test="selected-count">
              {{ t('gzJpFulfill.selectedCount', { n: selectedCount }) }}
            </el-tag>
            <el-tag v-if="selectedGroups.length === 1" type="success" size="small" class="ml-2" data-test="selected-user">
              {{ groupTitleName(selectedGroups[0]) }}
            </el-tag>
            <el-tag v-else type="danger" size="small" class="ml-2" data-test="cross-user-warning">
              {{ t('gzJpFulfill.crossUserWarning', { n: selectedGroups.length }) }}
            </el-tag>
          </template>
        </div>
        <div class="action-bar__ops">
          <el-button
            v-hasPermi="['gz:jp:fulfill:advance']"
            type="primary"
            size="small"
            data-test="btn-advance"
            :disabled="!batchEnabled"
            @click="openAdvance(selectedIdsFlat, selectedGroups[0])"
          >
            {{ t('gzJpFulfill.opAdvance') }}
          </el-button>
          <el-button
            v-hasPermi="['gz:jp:fulfill:ship']"
            type="success"
            size="small"
            data-test="btn-ship"
            :disabled="!batchEnabled"
            @click="openShip(selectedIdsFlat, selectedGroups[0])"
          >
            {{ t('gzJpFulfill.opShip') }}
          </el-button>
          <el-button
            v-hasPermi="['gz:jp:fulfill:markFailed']"
            type="danger"
            size="small"
            data-test="btn-mark-failed"
            :disabled="!batchEnabled"
            @click="openMarkFailed(selectedIdsFlat, selectedGroups[0])"
          >
            {{ t('gzJpFulfill.opMarkFailed') }}
          </el-button>
          <el-button size="small" :disabled="selectedCount === 0" data-test="btn-clear-selection" @click="clearAllSelection">
            {{ t('gzJpFulfill.clearSelection') }}
          </el-button>
        </div>
      </div>
      <div v-if="selectedGroups.length > 1" class="cross-user-hint" data-test="cross-user-hint">
        {{ t('gzJpFulfill.crossUserHint') }}
      </div>

      <!-- ★ 主视图按客人聚合：外层一行 = 一位客人（可展开），展开后是该客人的商品行
           打包决策的问法就是「这个客人有哪些货到齐了」，且可跨订单凑同一个包裹（REQ-FULFILL-006） -->
      <el-table
        v-loading="listLoading"
        :data="groups"
        row-key="userId"
        border
        size="small"
        data-test="group-table"
        :expand-row-keys="expandedKeys"
        @expand-change="handleExpandChange"
      >
        <el-table-column type="expand">
          <template #default="{ row: group }">
            <div class="group-body">
              <el-table
                :ref="(el: any) => registerInnerTable(group.userId, el)"
                :data="group.rows"
                border
                stripe
                size="small"
                :data-test="`item-table-${group.userId}`"
                @selection-change="(sel: GzJpFulfillBoardItemVO[]) => handleSelectionChange(group.userId, sel)"
              >
                <el-table-column type="selection" width="42" :selectable="rowSelectable" />
                <el-table-column :label="t('gzJpFulfill.colProduct')" min-width="200" show-overflow-tooltip>
                  <template #default="{ row }">
                    <div>{{ row.name || '-' }}</div>
                    <div class="sub-text">{{ row.productNo || '-' }}</div>
                  </template>
                </el-table-column>
                <el-table-column :label="t('gzJpFulfill.colQty')" width="60" align="center" prop="qty" />
                <el-table-column :label="t('gzJpFulfill.colAmount')" width="100" align="right">
                  <template #default="{ row }">¥{{ centToYuanText(row.amountCent) }}</template>
                </el-table-column>
                <el-table-column :label="t('gzJpFulfill.colOrderNo')" width="180" show-overflow-tooltip>
                  <template #default="{ row }">
                    <div>{{ row.orderNo }}</div>
                    <div class="sub-text">{{ row.eventName || '-' }}</div>
                  </template>
                </el-table-column>
                <el-table-column :label="t('gzJpFulfill.colFulfill')" width="130" align="center">
                  <template #default="{ row }">
                    <dict-tag :options="gz_jp_fulfill_status" :value="row.fulfillStatus" />
                    <!-- 106 的 /advance 允许把行标成购买失败却不退款，这类行的钱还没退出去，
                         必须显眼提示，否则永远没人去补退款（107 §对下游提示） -->
                    <div v-if="row.fulfillStatus === 'purchase_failed' && !row.refundStatus" class="warn-text" data-test="unrefunded-flag">
                      {{ t('gzJpFulfill.unrefunded') }}
                    </div>
                  </template>
                </el-table-column>
                <el-table-column :label="t('gzJpFulfill.colTracking')" min-width="170">
                  <template #default="{ row }">
                    <span v-if="row.trackingNo">
                      {{ row.carrierLabel || row.carrierCode }} {{ row.trackingNo }}
                      <div class="sub-text">{{ row.shippedAt || '' }}</div>
                    </span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column :label="t('gzJpFulfill.colRefund')" width="120" align="center">
                  <template #default="{ row }">
                    <span v-if="row.refundStatus">
                      <dict-tag :options="gz_jp_refund_status" :value="row.refundStatus" />
                      <div class="sub-text">¥{{ centToYuanText(row.refundAmountCent ?? 0) }}</div>
                    </span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>

        <!-- 组头：客人名 · 共 N 款 · 待处理 M -->
        <el-table-column :label="t('gzJpFulfill.colUser')" min-width="200" show-overflow-tooltip>
          <template #default="{ row: group }">
            <span class="group-name" :data-test="`group-name-${group.userId}`">{{ groupTitleName(group) }}</span>
            <div v-if="group.userMobile" class="sub-text">{{ group.userMobile }}</div>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzJpFulfill.colGroupTotal')" width="90" align="center">
          <template #default="{ row: group }">{{ t('gzJpFulfill.itemCountText', { n: group.rows.length }) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzJpFulfill.colGroupPending')" width="100" align="center">
          <template #default="{ row: group }">
            <el-tag v-if="group.pending > 0" type="warning" size="small">{{ t('gzJpFulfill.pendingText', { n: group.pending }) }}</el-tag>
            <el-tag v-else type="success" size="small">{{ t('gzJpFulfill.pendingNone') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzJpFulfill.colGroupOrders')" width="90" align="center">
          <template #default="{ row: group }">{{ t('gzJpFulfill.orderCountText', { n: group.orderNos.length }) }}</template>
        </el-table-column>
        <el-table-column :label="t('gzJpFulfill.colGroupSelected')" width="90" align="center">
          <template #default="{ row: group }">
            <span :data-test="`group-selected-${group.userId}`">{{ groupSelectedIds(group.userId).length }}</span>
          </template>
        </el-table-column>
        <!-- 组级批量操作：作用域天然限定在这一位客人内，永远不会跨客人 -->
        <el-table-column :label="t('gzJpFulfill.colGroupOps')" fixed="right" width="290" align="center">
          <template #default="{ row: group }">
            <el-button
              v-hasPermi="['gz:jp:fulfill:advance']"
              type="primary"
              link
              size="small"
              :data-test="`group-advance-${group.userId}`"
              :disabled="groupSelectedIds(group.userId).length === 0"
              @click="openAdvance(groupSelectedIds(group.userId), group)"
            >
              {{ t('gzJpFulfill.opAdvance') }}
            </el-button>
            <el-button
              v-hasPermi="['gz:jp:fulfill:ship']"
              type="success"
              link
              size="small"
              :data-test="`group-ship-${group.userId}`"
              :disabled="groupSelectedIds(group.userId).length === 0"
              @click="openShip(groupSelectedIds(group.userId), group)"
            >
              {{ t('gzJpFulfill.opShip') }}
            </el-button>
            <el-button
              v-hasPermi="['gz:jp:fulfill:markFailed']"
              type="danger"
              link
              size="small"
              :data-test="`group-mark-failed-${group.userId}`"
              :disabled="groupSelectedIds(group.userId).length === 0"
              @click="openMarkFailed(groupSelectedIds(group.userId), group)"
            >
              {{ t('gzJpFulfill.opMarkFailed') }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('gzJpFulfill.empty')" /></template>
      </el-table>

      <pagination v-show="total > 0" v-model:page="query.pageNum" v-model:limit="query.pageSize" :total="total" @pagination="loadList" />
    </el-card>

    <!-- ① 批量推进：目标状态下拉去掉 purchasing（起点）与 delivered（必须走发货） -->
    <el-dialog v-model="advanceVisible" :title="t('gzJpFulfill.advanceTitle')" width="520px" data-test="advance-dialog">
      <el-alert type="warning" :closable="false" show-icon class="mb-3">
        <template #title>{{ t('gzJpFulfill.advanceWarn', { n: opItemIds.length, user: opUserName }) }}</template>
      </el-alert>
      <el-form label-width="96px">
        <el-form-item :label="t('gzJpFulfill.advanceTarget')">
          <el-select v-model="advanceTarget" data-test="advance-target" :placeholder="t('gzJpFulfill.advanceTargetPlaceholder')" style="width: 100%">
            <el-option v-for="d in advanceTargetOptions" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <!-- purchase_failed 走 /advance 只改状态【不退钱】，与「标记购买失败」按钮不是一回事，必须讲清 -->
      <el-alert
        v-if="advanceTarget === 'purchase_failed'"
        type="error"
        :closable="false"
        show-icon
        :title="t('gzJpFulfill.advanceFailedHint')"
        data-test="advance-failed-hint"
      />
      <template #footer>
        <el-button @click="advanceVisible = false">{{ t('gzJpFulfill.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" :disabled="!advanceTarget" data-test="advance-confirm" @click="submitAdvance">
          {{ t('gzJpFulfill.confirm') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- ② 批量发货：选快递公司（字典 gz_express_carrier）+ 填一个运单号 -->
    <el-dialog v-model="shipVisible" :title="t('gzJpFulfill.shipTitle')" width="560px" data-test="ship-dialog">
      <el-alert type="info" :closable="false" show-icon class="mb-3">
        <template #title>{{ t('gzJpFulfill.shipInfo', { n: opItemIds.length, user: opUserName }) }}</template>
      </el-alert>
      <!-- 同一客人跨订单凑一个包裹是常态（REQ-FULFILL-006），但两张订单的收货地址可能不同，
           后端只拦「跨客人」不拦「同客人不同地址」，所以这里提醒店员自己核一眼 -->
      <el-alert
        v-if="opOrderNos.length > 1"
        type="warning"
        :closable="false"
        show-icon
        class="mb-3"
        :title="t('gzJpFulfill.shipCrossOrderHint', { orders: opOrderNos.join('、') })"
        data-test="ship-cross-order-hint"
      />
      <el-form label-width="96px">
        <el-form-item :label="t('gzJpFulfill.shipCarrier')">
          <el-select v-model="shipForm.carrierCode" data-test="ship-carrier" :placeholder="t('gzJpFulfill.shipCarrierPlaceholder')" style="width: 100%">
            <el-option v-for="d in gz_express_carrier" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzJpFulfill.shipTracking')">
          <el-input
            v-model="shipForm.trackingNo"
            data-test="ship-tracking"
            :placeholder="t('gzJpFulfill.shipTrackingPlaceholder')"
            clearable
            maxlength="64"
          />
        </el-form-item>
      </el-form>
      <div class="dialog-hint">{{ t('gzJpFulfill.shipPackageHint') }}</div>
      <template #footer>
        <el-button @click="shipVisible = false">{{ t('gzJpFulfill.cancel') }}</el-button>
        <el-button
          type="success"
          :loading="submitting"
          :disabled="!shipForm.carrierCode || !shipForm.trackingNo.trim()"
          data-test="ship-confirm"
          @click="submitShip"
        >
          {{ t('gzJpFulfill.confirm') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- ③ 批量标记购买失败 —— ★ 二次确认：会触发真实退款，不可逆 -->
    <el-dialog v-model="markFailedVisible" :title="t('gzJpFulfill.markFailedTitle')" width="620px" data-test="mark-failed-dialog">
      <el-alert type="error" :closable="false" show-icon class="mb-3" data-test="mark-failed-warning">
        <template #title>{{ t('gzJpFulfill.markFailedWarnTitle') }}</template>
        <template #default>
          <div>{{ t('gzJpFulfill.markFailedWarnBody', { n: opItemIds.length, user: opUserName, amount: centToYuanText(opRefundTotalCent) }) }}</div>
        </template>
      </el-alert>

      <el-table :data="opRows" border size="small" max-height="220" class="mb-3">
        <el-table-column :label="t('gzJpFulfill.colProduct')" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.name || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzJpFulfill.colOrderNo')" width="180" />
        <el-table-column :label="t('gzJpFulfill.colFulfill')" width="110" align="center" prop="fulfillStatusLabel" />
        <el-table-column :label="t('gzJpFulfill.markFailedRefundAmount')" width="110" align="right">
          <template #default="{ row }">¥{{ centToYuanText(row.amountCent) }}</template>
        </el-table-column>
      </el-table>

      <el-form label-width="96px">
        <el-form-item :label="t('gzJpFulfill.markFailedReason')">
          <el-input
            v-model="markFailedReason"
            data-test="mark-failed-reason"
            type="textarea"
            :rows="2"
            maxlength="200"
            show-word-limit
            :placeholder="t('gzJpFulfill.markFailedReasonPlaceholder')"
          />
        </el-form-item>
      </el-form>

      <!-- 二次确认的第二次：必须显式勾选才放行（这个按钮花的是客人的真钱） -->
      <el-checkbox v-model="markFailedAck" data-test="mark-failed-ack">
        {{ t('gzJpFulfill.markFailedAck', { amount: centToYuanText(opRefundTotalCent) }) }}
      </el-checkbox>

      <template #footer>
        <el-button @click="markFailedVisible = false">{{ t('gzJpFulfill.cancel') }}</el-button>
        <el-button type="danger" :loading="submitting" :disabled="!markFailedAck" data-test="mark-failed-confirm" @click="submitMarkFailed">
          {{ t('gzJpFulfill.markFailedConfirm') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 执行结果：部分成功是常态，被拒的行必须逐行说明；标记失败还要把「钱退没退」单独一栏 -->
    <el-dialog v-model="resultVisible" :title="t('gzJpFulfill.resultTitle')" width="700px" data-test="result-dialog">
      <div v-if="batchResult">
        <el-descriptions :column="4" border size="small" class="mb-3">
          <el-descriptions-item :label="t('gzJpFulfill.resultRequested')">{{ batchResult.requested }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzJpFulfill.resultAdvanced')">
            <span class="ok-text" data-test="result-advanced">{{ batchResult.advanced }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzJpFulfill.resultSkipped')">{{ batchResult.skipped }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzJpFulfill.resultRejected')">
            <span :class="batchResult.rejected > 0 ? 'warn-text' : ''">{{ batchResult.rejected }}</span>
          </el-descriptions-item>
        </el-descriptions>
        <div v-if="batchResult.trackingNo" class="dialog-hint mb-3">
          {{ t('gzJpFulfill.resultTracking', { carrier: batchResult.carrierLabel || batchResult.carrierCode, no: batchResult.trackingNo }) }}
        </div>
      </div>

      <div v-if="markFailedResult">
        <div class="section-title">{{ t('gzJpFulfill.resultFulfillSide') }}</div>
        <el-descriptions :column="4" border size="small" class="mb-3">
          <el-descriptions-item :label="t('gzJpFulfill.resultRequested')">{{ markFailedResult.requested }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzJpFulfill.resultMarked')">
            <span class="ok-text" data-test="result-marked">{{ markFailedResult.markedFailed }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzJpFulfill.resultAlreadyFailed')">{{ markFailedResult.alreadyFailed }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzJpFulfill.resultRejected')">{{ markFailedResult.rejected }}</el-descriptions-item>
        </el-descriptions>

        <!-- ★ 退款侧单列一栏：「状态标上了但钱没退成功」是最危险的一种结果，不能被合并进成功计数 -->
        <div class="section-title">{{ t('gzJpFulfill.resultRefundSide') }}</div>
        <el-descriptions :column="4" border size="small" class="mb-3">
          <el-descriptions-item :label="t('gzJpFulfill.resultRefundsCreated')">{{ markFailedResult.refundsCreated }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzJpFulfill.resultRefundsAccepted')">
            <span class="ok-text">{{ markFailedResult.refundsAccepted }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzJpFulfill.resultRefundsFailed')">
            <span :class="markFailedResult.refundsFailed > 0 ? 'err-text' : ''">{{ markFailedResult.refundsFailed }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzJpFulfill.resultRefundsSkipped')">{{ markFailedResult.refundsSkipped }}</el-descriptions-item>
        </el-descriptions>
        <el-alert
          v-if="markFailedResult.refundsFailed > 0"
          type="error"
          :closable="false"
          show-icon
          class="mb-3"
          :title="t('gzJpFulfill.resultRefundFailedHint')"
        />
        <div class="dialog-hint mb-3">
          {{ t('gzJpFulfill.resultRefundAmount', { amount: centToYuanText(markFailedResult.refundAmountCentTotal) }) }}
        </div>
        <el-table v-if="markFailedResult.refunds.length" :data="markFailedResult.refunds" border size="small" max-height="200" class="mb-3">
          <el-table-column :label="t('gzJpFulfill.colItemId')" prop="itemId" width="80" />
          <el-table-column :label="t('gzJpFulfill.refundColNo')" prop="refundNo" width="180" />
          <el-table-column :label="t('gzJpFulfill.refundColAmount')" width="100" align="right">
            <template #default="{ row }">{{ row.refundAmountCent === null ? '-' : `¥${centToYuanText(row.refundAmountCent)}` }}</template>
          </el-table-column>
          <el-table-column :label="t('gzJpFulfill.refundColStatus')" width="100" align="center">
            <template #default="{ row }">{{ row.refundStatusLabel || '-' }}</template>
          </el-table-column>
          <el-table-column :label="t('gzJpFulfill.refundColReason')" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.failReason || row.skipReason || '-' }}</template>
          </el-table-column>
        </el-table>
      </div>

      <template v-if="resultRejects.length">
        <div class="section-title">{{ t('gzJpFulfill.resultRejectTitle') }}</div>
        <el-table :data="resultRejects" border size="small" max-height="240" data-test="result-rejects">
          <el-table-column :label="t('gzJpFulfill.colItemId')" prop="itemId" width="80" />
          <el-table-column :label="t('gzJpFulfill.resultCurrentStatus')" prop="currentStatusLabel" width="120" align="center" />
          <el-table-column :label="t('gzJpFulfill.resultReason')" prop="reason" min-width="240" show-overflow-tooltip />
        </el-table>
      </template>

      <template #footer>
        <el-button type="primary" data-test="result-close" @click="resultVisible = false">{{ t('gzJpFulfill.close') }}</el-button>
      </template>
    </el-dialog>

    <!-- 退款单抽屉（GZ-JP-107 的两个端点在此落地）：失败单后端已排最前，前端不覆盖排序 -->
    <el-drawer v-model="refundVisible" :title="t('gzJpFulfill.refundTitle')" size="1000px" data-test="refund-drawer">
      <el-alert type="warning" :description="t('gzJpFulfill.refundAlert')" show-icon :closable="false" class="mb-3" />
      <el-form inline class="mb-2">
        <el-form-item :label="t('gzJpFulfill.refundColStatus')">
          <el-select v-model="refundQuery.status" data-test="refund-status" clearable :placeholder="t('gzJpFulfill.refundStatusAll')" style="width: 160px">
            <el-option v-for="d in gz_jp_refund_status" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzJpFulfill.colOrderNo')">
          <el-input v-model="refundQuery.orderNo" clearable style="width: 190px" @keyup.enter="loadRefundList" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" data-test="refund-search" @click="handleRefundSearch">{{ t('gzJpFulfill.search') }}</el-button>
        </el-form-item>
      </el-form>
      <el-table v-loading="refundLoading" :data="refundList" border stripe size="small" data-test="refund-table">
        <el-table-column :label="t('gzJpFulfill.refundColNo')" prop="refundNo" width="180" />
        <el-table-column :label="t('gzJpFulfill.colOrderNo')" prop="orderNo" width="175" />
        <el-table-column :label="t('gzJpFulfill.colUser')" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.userNickname || row.userNo || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzJpFulfill.refundColAmount')" width="130" align="right">
          <template #default="{ row }">
            <div>¥{{ centToYuanText(row.refundAmountCent) }}</div>
            <div class="sub-text">{{ t('gzJpFulfill.refundOfTotal', { total: centToYuanText(row.totalAmountCent) }) }}</div>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzJpFulfill.refundColStatus')" width="100" align="center">
          <template #default="{ row }"><dict-tag :options="gz_jp_refund_status" :value="row.status" /></template>
        </el-table-column>
        <el-table-column :label="t('gzJpFulfill.refundColReason')" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.failReason || '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('gzJpFulfill.refundColAttempt')" prop="attemptCount" width="70" align="center" />
        <el-table-column :label="t('gzJpFulfill.refundColTime')" prop="triggeredTime" width="160" />
        <el-table-column :label="t('gzJpFulfill.colGroupOps')" fixed="right" width="90" align="center">
          <template #default="{ row }">
            <el-button
              v-hasPermi="['gz:jp:refund:retry']"
              type="warning"
              link
              size="small"
              :disabled="!row.retryable"
              :data-test="`refund-retry-${row.id}`"
              @click="handleRetryRefund(row)"
            >
              {{ t('gzJpFulfill.refundRetry') }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('gzJpFulfill.refundEmpty')" :image-size="60" /></template>
      </el-table>
      <pagination
        v-show="refundTotal > 0"
        v-model:page="refundQuery.pageNum"
        v-model:limit="refundQuery.pageSize"
        :total="refundTotal"
        @pagination="loadRefundList"
      />
    </el-drawer>
  </div>
</template>

<script setup lang="ts" name="GzJpFulfill">
import { ref, reactive, computed, watch, onMounted, getCurrentInstance, toRefs, type ComponentInternalInstance } from 'vue';
import { Refresh, Search } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  listGzJpFulfill,
  advanceGzJpFulfill,
  shipGzJpFulfill,
  markFailedGzJpFulfill,
  listGzJpRefund,
  retryGzJpRefund,
  ADVANCE_EXCLUDED_STATUS,
  type GzJpFulfillBoardItemVO,
  type GzJpFulfillQuery,
  type GzJpFulfillBatchResultVO,
  type GzJpFulfillRejectVO,
  type GzJpMarkFailedResultVO,
  type GzJpRefundAdminVO,
  type GzJpRefundQuery,
  type GzJpFulfillStatus
} from '@/api/gz-jp/fulfill';
import { listGzJpEvent, type GzJpEventVO } from '@/api/gz-jp/event';

/**
 * GZ-JP-108 拼团履约看板（UI:admin.fulfill_board / FLOW:F-JP-03.step1）—— 店员侧主战场。
 *
 * ★ 主视图【按客人聚合】而不是平铺商品行：打包决策的问法就是「这个客人有哪些货到齐了」，
 *   且同一客人可跨多张订单凑同一个包裹（REQ-FULFILL-006）。所以外层一行 = 一位客人（可展开），
 *   展开后才是商品行，批量操作以「组」为作用域。
 *
 * ★ 不支持跨客人勾选：一个运单号 = 一个包裹 = 一个收件人，后端对 /ship 硬拦（4110）。
 *   前端在跨组勾选时就把三个批量按钮置灰并提示，不等后端报错 —— 组自己的按钮永远可用，不会死路。
 *
 * ★ 看板只出【付过款】订单的行（后端服务层写死不可关）。客人说「我的单不见了」多半是没付成功，
 *   去「订单管理」（GZ-JP-109）查，两页口径不同是设计意图。
 */
const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { gz_jp_fulfill_status, gz_jp_refund_status, gz_express_carrier } = toRefs<any>(
  proxy?.useDict('gz_jp_fulfill_status', 'gz_jp_refund_status', 'gz_express_carrier')
);

// ============ 列表 + 筛选 ============

const listLoading = ref(false);
const rows = ref<GzJpFulfillBoardItemVO[]>([]);
const total = ref(0);
const query = reactive<GzJpFulfillQuery>({
  keyword: '',
  fulfillStatus: [],
  eventId: undefined,
  orderNo: '',
  trackingNo: '',
  pageNum: 1,
  pageSize: 20
});

const dateRange = ref<[string, string] | null>(null);
watch(dateRange, (v) => {
  query.beginDate = v?.[0] ?? undefined;
  query.endDate = v?.[1] ?? undefined;
});

/** 场下拉（筛选用；一期场数量很少，一次取满即可） */
const eventOptions = ref<GzJpEventVO[]>([]);

/** 分 → 元（展示用；金额计算一律在后端，前端只做除 100 显示） */
function centToYuanText(cent: number | null | undefined): string {
  return ((cent ?? 0) / 100).toFixed(2);
}

/** 一位客人的行组 */
interface BoardGroup {
  userId: string;
  userNickname: string | null;
  userMobile: string | null;
  userNo: string | null;
  rows: GzJpFulfillBoardItemVO[];
  /** 待处理 = 非终态的行数（终态 = 已发货完毕 / 已购买失败） */
  pending: number;
  /** 涉及的订单号（去重）—— 跨订单凑包裹时店员要看得见 */
  orderNos: string[];
}

/**
 * 按 userId 断组。后端已按 user_id → order_id → item id 聚簇排序，
 * 所以顺序扫一遍即可，不需要重排（重排会打乱后端的稳定顺序）。
 */
const groups = computed<BoardGroup[]>(() => {
  const out: BoardGroup[] = [];
  const index = new Map<string, BoardGroup>();
  for (const row of rows.value) {
    let g = index.get(row.userId);
    if (!g) {
      g = {
        userId: row.userId,
        userNickname: row.userNickname,
        userMobile: row.userMobile,
        userNo: row.userNo,
        rows: [],
        pending: 0,
        orderNos: []
      };
      index.set(row.userId, g);
      out.push(g);
    }
    g.rows.push(row);
    if (!row.terminal) g.pending += 1;
    if (!g.orderNos.includes(row.orderNo)) g.orderNos.push(row.orderNo);
  }
  return out;
});

function groupTitleName(group?: { userNickname?: string | null; userNo?: string | null }): string {
  if (!group) return '-';
  return group.userNickname || group.userNo || '-';
}

/** 默认全部展开：店员打开看板就是要看货，逐个点开是无谓的操作成本（仍可手动收起） */
const expandedKeys = ref<string[]>([]);

async function loadList() {
  listLoading.value = true;
  try {
    const res = await listGzJpFulfill(query);
    rows.value = res.rows;
    total.value = res.total;
    selectionMap.value = new Map();
    expandedKeys.value = groups.value.map((g) => g.userId);
  } finally {
    listLoading.value = false;
  }
}

function handleSearch() {
  query.pageNum = 1;
  loadList();
}

function resetQuery() {
  query.keyword = '';
  query.fulfillStatus = [];
  query.eventId = undefined;
  query.orderNo = '';
  query.trackingNo = '';
  dateRange.value = null;
  query.beginDate = undefined;
  query.endDate = undefined;
  query.pageNum = 1;
  loadList();
}

// ============ 勾选（组内多选，全局汇总） ============

/** userId → 该组已勾选的行 id。组收起时直接删掉该组的条目，避免「看不见的勾选」 */
const selectionMap = ref<Map<string, string[]>>(new Map());
const innerTables = new Map<string, any>();

function registerInnerTable(userId: string, el: any) {
  if (el) innerTables.set(userId, el);
  else innerTables.delete(userId);
}

/**
 * 哪些行可勾：
 *  - 非终态：可勾
 *  - 终态里唯一的例外是「已标购买失败但还没退过款」的行 —— 106 的 /advance 能造出这种行，
 *    它们的钱还没退出去，必须允许再次勾选走「标记购买失败」补退款（107 §对下游提示）
 */
function rowSelectable(row: GzJpFulfillBoardItemVO): boolean {
  if (!row.terminal) return true;
  return row.fulfillStatus === 'purchase_failed' && !row.refundStatus;
}

function handleSelectionChange(userId: string, selection: GzJpFulfillBoardItemVO[]) {
  const next = new Map(selectionMap.value);
  if (selection.length === 0) next.delete(userId);
  else next.set(userId, selection.map((r) => r.id));
  selectionMap.value = next;
}

function handleExpandChange(group: BoardGroup, expanded: boolean) {
  if (expanded) {
    if (!expandedKeys.value.includes(group.userId)) expandedKeys.value = [...expandedKeys.value, group.userId];
    return;
  }
  expandedKeys.value = expandedKeys.value.filter((k) => k !== group.userId);
  // 收起即清掉该组勾选：留着会变成「按钮说选了 5 行但页面上看不见」
  const next = new Map(selectionMap.value);
  next.delete(group.userId);
  selectionMap.value = next;
}

function groupSelectedIds(userId: string): string[] {
  return selectionMap.value.get(userId) ?? [];
}

/** 有勾选的组（≥2 即跨客人） */
const selectedGroups = computed<BoardGroup[]>(() => groups.value.filter((g) => groupSelectedIds(g.userId).length > 0));

const selectedIdsFlat = computed<string[]>(() => selectedGroups.value.flatMap((g) => groupSelectedIds(g.userId)));

const selectedCount = computed(() => selectedIdsFlat.value.length);

/** 全局三按钮的可用条件：有勾选 且 只勾了一位客人 */
const batchEnabled = computed(() => selectedCount.value > 0 && selectedGroups.value.length === 1);

function clearAllSelection() {
  for (const [, table] of innerTables) table?.clearSelection?.();
  selectionMap.value = new Map();
}

// ============ 批量操作 ============

const submitting = ref(false);
/** 本次操作的行 id / 所属客人 —— 三个弹窗共用（同一时刻只会开一个） */
const opItemIds = ref<string[]>([]);
const opGroup = ref<BoardGroup | undefined>(undefined);

const opUserName = computed(() => groupTitleName(opGroup.value));
const opRows = computed<GzJpFulfillBoardItemVO[]>(() => {
  const ids = new Set(opItemIds.value);
  return rows.value.filter((r) => ids.has(r.id));
});
const opOrderNos = computed<string[]>(() => [...new Set(opRows.value.map((r) => r.orderNo))]);
const opRefundTotalCent = computed(() => opRows.value.reduce((sum, r) => sum + (r.amountCent ?? 0), 0));

function beginOp(itemIds: string[], group?: BoardGroup): boolean {
  if (itemIds.length === 0) {
    ElMessage.warning(t('gzJpFulfill.selectNoneWarn'));
    return false;
  }
  opItemIds.value = [...itemIds];
  opGroup.value = group;
  return true;
}

// ---- ① 批量推进 ----
const advanceVisible = ref(false);
const advanceTarget = ref<GzJpFulfillStatus | ''>('');

/** ★ 下拉去掉 purchasing（链条起点，推它必被拒）与 delivered（必须走批量发货填运单号） */
const advanceTargetOptions = computed(() =>
  (gz_jp_fulfill_status.value ?? []).filter((d: any) => !ADVANCE_EXCLUDED_STATUS.includes(d.value as GzJpFulfillStatus))
);

function openAdvance(itemIds: string[], group?: BoardGroup) {
  if (!beginOp(itemIds, group)) return;
  advanceTarget.value = '';
  advanceVisible.value = true;
}

async function submitAdvance() {
  if (!advanceTarget.value) return;
  submitting.value = true;
  try {
    const { data } = await advanceGzJpFulfill({ itemIds: opItemIds.value, targetStatus: advanceTarget.value });
    advanceVisible.value = false;
    showBatchResult(data);
  } catch {
    // 4108/4109 等业务码已由 axios 拦截器弹出提示，这里只需把看板刷成最新（同事可能刚推过）
  } finally {
    submitting.value = false;
    await loadList();
  }
}

// ---- ② 批量发货 ----
const shipVisible = ref(false);
const shipForm = reactive({ carrierCode: '', trackingNo: '' });

function openShip(itemIds: string[], group?: BoardGroup) {
  if (!beginOp(itemIds, group)) return;
  shipForm.carrierCode = '';
  shipForm.trackingNo = '';
  shipVisible.value = true;
}

async function submitShip() {
  submitting.value = true;
  try {
    const { data } = await shipGzJpFulfill({
      itemIds: opItemIds.value,
      carrierCode: shipForm.carrierCode,
      trackingNo: shipForm.trackingNo.trim()
    });
    shipVisible.value = false;
    showBatchResult(data);
  } catch {
    // 同上：4109 缺字段 / 4110 跨客人或单号已属他人，提示已弹出
  } finally {
    submitting.value = false;
    await loadList();
  }
}

// ---- ③ 批量标记购买失败（★ 二次确认，会触发真实退款） ----
const markFailedVisible = ref(false);
const markFailedReason = ref('');
const markFailedAck = ref(false);

function openMarkFailed(itemIds: string[], group?: BoardGroup) {
  if (!beginOp(itemIds, group)) return;
  markFailedReason.value = '';
  markFailedAck.value = false;
  markFailedVisible.value = true;
}

async function submitMarkFailed() {
  if (!markFailedAck.value) return;
  submitting.value = true;
  try {
    const reason = markFailedReason.value.trim();
    const { data } = await markFailedGzJpFulfill({ itemIds: opItemIds.value, ...(reason ? { reason } : {}) });
    markFailedVisible.value = false;
    batchResult.value = null;
    markFailedResult.value = data;
    resultRejects.value = data.rejects ?? [];
    resultVisible.value = true;
  } catch {
    // 4111/4112/4113 已弹出
  } finally {
    submitting.value = false;
    await loadList();
  }
}

// ---- 结果 ----
const resultVisible = ref(false);
const batchResult = ref<GzJpFulfillBatchResultVO | null>(null);
const markFailedResult = ref<GzJpMarkFailedResultVO | null>(null);
const resultRejects = ref<GzJpFulfillRejectVO[]>([]);

function showBatchResult(data: GzJpFulfillBatchResultVO) {
  markFailedResult.value = null;
  batchResult.value = data;
  resultRejects.value = data.rejects ?? [];
  if (data.advanced > 0) {
    ElMessage.success(t('gzJpFulfill.msgAdvanced', { n: data.advanced }));
  } else if (data.skipped > 0) {
    // 不是失败：同事刚推过，全部已是目标态
    ElMessage.info(t('gzJpFulfill.msgAllSkipped', { n: data.skipped }));
  }
  // 有被拒的行才值得打断店员；全成功时一个绿条就够了
  if (data.rejected > 0) resultVisible.value = true;
}

// ============ 退款单抽屉（GZ-JP-107） ============

const refundVisible = ref(false);
const refundLoading = ref(false);
const refundList = ref<GzJpRefundAdminVO[]>([]);
const refundTotal = ref(0);
const refundQuery = reactive<GzJpRefundQuery>({ status: '', orderNo: '', pageNum: 1, pageSize: 10 });

function openRefundDrawer() {
  refundVisible.value = true;
  loadRefundList();
}

function handleRefundSearch() {
  refundQuery.pageNum = 1;
  loadRefundList();
}

async function loadRefundList() {
  refundLoading.value = true;
  try {
    const res = await listGzJpRefund(refundQuery);
    refundList.value = res.rows;
    refundTotal.value = res.total;
  } finally {
    refundLoading.value = false;
  }
}

async function handleRetryRefund(row: GzJpRefundAdminVO) {
  await ElMessageBox.confirm(
    t('gzJpFulfill.refundRetryConfirm', { no: row.refundNo, amount: centToYuanText(row.refundAmountCent) }),
    t('gzJpFulfill.refundRetry'),
    { type: 'warning' }
  );
  await retryGzJpRefund(row.id);
  ElMessage.success(t('gzJpFulfill.refundRetryOk'));
  await loadRefundList();
  await loadList();
}

onMounted(async () => {
  await loadList();
  try {
    const res = await listGzJpEvent({ pageNum: 1, pageSize: 200 });
    eventOptions.value = res.rows;
  } catch {
    // 场下拉取不到只影响一个筛选项，不该让整张看板打不开
  }
});
</script>

<style scoped>
.ticket-tag {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}
.sub-text {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
.warn-text {
  font-size: 12px;
  color: var(--el-color-warning);
}
.err-text {
  color: var(--el-color-danger);
  font-weight: 600;
}
.ok-text {
  color: var(--el-color-success);
  font-weight: 600;
}
.group-name {
  font-weight: 600;
}
.group-body {
  padding: 8px 12px 8px 40px;
}
.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  margin-bottom: 8px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}
.cross-user-hint {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--el-color-danger);
}
.dialog-hint {
  font-size: 12px;
  color: #909399;
}
.section-title {
  margin: 4px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.ml-2 {
  margin-left: 8px;
}
</style>
