<template>
  <div class="p-2">
    <el-card v-loading="pageLoading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzBeanBoard.title') }}</span>
          <span class="ticket-tag">GZ-BEAN-028</span>
        </div>
      </template>

      <el-alert :title="t('gzBeanBoard.alertTitle')" type="info" :description="t('gzBeanBoard.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 筛选 + 操作 -->
      <el-form inline class="mb-2" @submit.prevent="loadBoard">
        <el-form-item :label="t('gzBeanBoard.store')">
          <el-select v-model="currentStoreId" filterable style="width: 220px" @change="onStoreChange">
            <el-option v-for="s in storeOptions" :key="s.id" :label="`${s.storeNo} · ${s.name}`" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzBeanBoard.date')">
          <el-date-picker
            v-model="sessDate"
            type="date"
            value-format="YYYY-MM-DD"
            :clearable="false"
            :placeholder="t('gzBeanBoard.datePlaceholder')"
            style="width: 160px"
            @change="loadBoard"
          />
        </el-form-item>
        <el-form-item>
          <el-button v-hasPermi="['gz:bean:board:view']" type="primary" :icon="Search" :disabled="!currentStoreId" @click="loadBoard">
            {{ t('gzBeanBoard.query') }}
          </el-button>
          <el-button :icon="Refresh" :disabled="!currentStoreId" @click="loadBoard">{{ t('gzBeanBoard.refresh') }}</el-button>
        </el-form-item>
        <el-form-item>
          <el-switch v-model="autoRefresh" :active-text="t('gzBeanBoard.autoRefresh')" inline-prompt />
        </el-form-item>
        <el-form-item>
          <el-switch v-model="alertEnabled" :active-text="t('gzBeanBoard.alertSwitch')" inline-prompt />
        </el-form-item>
        <el-form-item>
          <el-switch v-model="soundEnabled" :active-text="t('gzBeanBoard.soundSwitch')" inline-prompt />
        </el-form-item>
      </el-form>

      <!-- ②待分座区（ADR-0016 §3/§5）：已付款待核销但未分配物理座位的预约 -->
      <div v-if="currentStoreId" class="pending-assign mb-3">
        <div class="pending-assign__head">
          <el-icon class="pending-assign__icon"><Bell /></el-icon>
          <span class="pending-assign__title">{{ t('gzBeanBoard.pendingTitle') }}</span>
          <el-badge :value="pendingRows.length" :max="99" type="warning" :hidden="pendingRows.length === 0" class="ml-1" />
          <el-button text size="small" :icon="Refresh" :loading="pendingLoading" class="ml-2" @click="loadPending">
            {{ t('gzBeanBoard.refresh') }}
          </el-button>
        </div>
        <el-empty v-if="!pendingLoading && pendingRows.length === 0" :description="t('gzBeanBoard.pendingEmpty')" :image-size="60" />
        <div v-else v-loading="pendingLoading" class="pending-grid">
          <div v-for="p in pendingRows" :key="p.id" class="pending-card" :class="{ 'is-consecutive': p.consecutiveWithActive === true }">
            <el-tag v-if="p.consecutiveWithActive === true" type="danger" size="small" effect="dark" class="pending-card__badge">
              {{ t('gzBeanBoard.consecutiveTag', { seat: p.suggestedSeatNo || '-' }) }}
            </el-tag>
            <div class="pending-card__main">
              <div class="pending-card__no">
                {{ p.bookingNo }}
                <el-tag v-if="p.isDayPass === 1" type="warning" size="small" effect="dark" class="pending-card__daypass">
                  {{ t('gzBeanBoard.dayPassTag') }}
                </el-tag>
              </div>
              <div class="pending-card__line">
                <el-tag size="small" type="info" effect="plain">{{ p.seatTypeSnapshot || p.seatType || t('gzBeanBoard.typeUnknown') }}</el-tag>
                <el-tag v-if="p.groupId" size="small" type="warning" effect="dark">{{
                  t('gzBeanBoard.groupTag', { n: groupCount(p.groupId) })
                }}</el-tag>
                <span class="pending-card__slot">{{ hhmm(p.slotStart) }} - {{ hhmm(p.slotEnd) }}</span>
              </div>
              <div v-if="p.isDayPass === 1" class="pending-card__line pending-card__daypass-hint">
                {{ t('gzBeanBoard.dayPassAssignHint') }}
              </div>
              <div v-if="p.mobileSnapshot" class="pending-card__line pending-card__mobile">
                {{ t('gzBeanBoard.mobileTail') }} {{ mobileTail(p.mobileSnapshot) }}
              </div>
            </div>
            <div class="pending-card__actions">
              <el-button
                v-if="p.consecutiveWithActive === true"
                v-hasPermi="['gz:bean:booking:verify']"
                type="danger"
                size="small"
                :icon="Select"
                @click="openAssign(p, true)"
              >
                {{ t('gzBeanBoard.earlyVerify') }}
              </el-button>
              <el-button v-else v-hasPermi="['gz:bean:booking:verify']" type="primary" size="small" :icon="Select" @click="openAssign(p)">
                {{ t('gzBeanBoard.assignVerify') }}
              </el-button>
              <!-- 排位（ADR-0018 §2）：客人未到，先把该单排到一个空闲座 → 座位下栏「待核销」，客人到店后在看板下栏点核销落座 -->
              <el-button v-hasPermi="['gz:bean:booking:verify']" size="small" :icon="Switch" @click="openPreAssign(p)">
                {{ t('gzBeanBoard.preAssign') }}
              </el-button>
              <!-- 直接核销已处理（不分座）（0702 反馈 #3）：桌型/座位对不上无法正常分座核销时，标记已处理让单从待分座消失 -->
              <el-button v-hasPermi="['gz:bean:booking:verify']" size="small" :loading="markHandlingId === p.id" @click="handleMarkHandled(p)">
                {{ t('gzBeanBoard.markHandled') }}
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 过期待处理 panel + 批量结单（GZ-BEAN-041） -->
      <el-collapse v-if="currentStoreId" v-model="expiredCollapse" class="expired-panel mb-3">
        <el-collapse-item name="expired">
          <template #title>
            <el-icon class="expired-panel__icon"><WarningFilled /></el-icon>
            <span class="expired-panel__title">{{ t('gzBeanBoard.expiredTitle') }}（{{ expiredRows.length }}）</span>
            <el-button text size="small" :icon="Refresh" :loading="expiredLoading" class="ml-2" @click.stop="loadExpired">
              {{ t('gzBeanBoard.expiredRefresh') }}
            </el-button>
          </template>
          <div class="expired-toolbar mb-2">
            <el-button
              v-hasPermi="['gz:bean:booking:verify']"
              type="success"
              size="small"
              :loading="settling"
              :disabled="selectedExpiredIds.length === 0"
              @click="handleBatchSettle('completed')"
            >
              {{ t('gzBeanBoard.settleCompleted') }}
            </el-button>
            <el-button
              v-hasPermi="['gz:bean:booking:verify']"
              type="warning"
              size="small"
              :loading="settling"
              :disabled="selectedExpiredIds.length === 0"
              @click="handleBatchSettle('no_show')"
            >
              {{ t('gzBeanBoard.markNoShow') }}
            </el-button>
            <el-button
              v-hasPermi="['gz:bean:booking:verify']"
              type="danger"
              size="small"
              :loading="settling"
              :disabled="selectedExpiredIds.length === 0"
              @click="handleBatchSettle('released')"
            >
              {{ t('gzBeanBoard.markEnded') }}
            </el-button>
          </div>
          <el-table
            v-loading="expiredLoading"
            :data="expiredRows"
            border
            stripe
            size="small"
            row-key="id"
            @selection-change="onExpiredSelectionChange"
          >
            <el-table-column type="selection" width="42" />
            <el-table-column :label="t('gzBeanBoard.expiredColBookingNo')" prop="bookingNo" min-width="160" />
            <el-table-column :label="t('gzBeanBoard.expiredColType')" min-width="110">
              <template #default="{ row }">{{ row.seatTypeSnapshot || t('gzBeanBoard.typeUnknown') }}</template>
            </el-table-column>
            <el-table-column :label="t('gzBeanBoard.expiredColSlot')" min-width="150">
              <template #default="{ row }">{{ row.sessDate }} {{ hhmm(row.slotStart) }}-{{ hhmm(row.slotEnd) }}</template>
            </el-table-column>
            <el-table-column :label="t('gzBeanBoard.expiredColStatus')" width="110" align="center">
              <template #default="{ row }">
                <el-tag :type="expiredStatusTagType(row.status)" effect="plain" size="small">
                  {{ expiredStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="t('gzBeanBoard.expiredColExpired')" width="130" align="center">
              <template #default="{ row }">{{ expiredLabel(row.expiredMinutes) }}</template>
            </el-table-column>
            <template #empty>
              <el-empty :description="t('gzBeanBoard.expiredEmpty')" :image-size="60" />
            </template>
          </el-table>
        </el-collapse-item>
      </el-collapse>

      <!-- 统计条（c1 分层双栏格）：已排位待核销 / 在座中 / 临近结束 / 已超时 / 空闲座位 -->
      <div class="board-metrics">
        <div v-for="st in legendStatuses" :key="st" class="board-metric" :class="`is-${st}`">
          <b class="board-metric__num">{{ statusCount(st) }}</b>
          <span class="board-metric__lbl">{{ t(`gzBeanBoard.status.${st}`) }}</span>
        </div>
        <span class="board-clock">{{ t('gzBeanBoard.now') }}：{{ nowLabel }}</span>
      </div>
      <!-- 图例 + 动线说明 -->
      <div class="board-legend mb-3">
        <span v-for="st in legendStatuses" :key="st" class="board-legend__item">
          <i class="board-legend__dot" :class="`is-${st}`"></i>{{ t(`gzBeanBoard.status.${st}`) }}
        </span>
        <span class="board-legend__hint">{{ t('gzBeanBoard.laneHint') }}</span>
      </div>

      <!-- 看板：按分区 → 桌型 分组渲染座位单元卡片 -->
      <el-empty v-if="!listLoading && rows.length === 0" :description="t('gzBeanBoard.empty')" />
      <div v-else v-loading="listLoading" class="board-zones">
        <div v-for="group in groupedRows" :key="group.key" class="board-zone">
          <div class="board-zone__head">
            <span class="board-zone__zone">{{ group.zone }}</span>
            <span class="board-zone__type">{{ group.typeName }}</span>
            <el-tag v-if="group.bookMode" :type="group.bookMode === 'seat' ? 'warning' : 'success'" size="small" class="ml-1">
              {{ group.bookMode === 'seat' ? t('gzBeanBoard.bookModeSeat') : t('gzBeanBoard.bookModeWhole') }}
            </el-tag>
          </div>
          <div class="board-seat-grid">
            <!-- 分层双栏格（ADR-0018 §2 / c1 mockup）：座位号/状态胶囊 + 上栏在座(放座/延时/改派) + 下栏待核销(核销/取消排位) / 空闲代客预约 -->
            <!-- 点座位任意区域 → 开详情抽屉；卡片内快捷按钮均 @click.stop 走各自动作、不误触抽屉 -->
            <div
              v-for="row in group.seats"
              :key="row.seatId"
              class="board-seat"
              :class="[`is-${row.boardStatus}`]"
              @click="openDetail(row)"
            >
              <div class="board-seat__head">
                <span class="board-seat__no">
                  {{ row.seatNo }}<span v-if="row.tableNo" class="board-seat__table">{{ row.tableNo }}</span>
                </span>
                <el-tag :type="statusTagType(row.boardStatus)" size="small" effect="plain" class="board-seat__pill">
                  {{ t(`gzBeanBoard.status.${row.boardStatus}`) }}
                </el-tag>
              </div>
              <!-- 座位备注：店员提醒，米黄便签高亮块 + 「备注」角标（长文 3 行截断，hover 看全文） -->
              <div v-if="row.remark" class="board-seat__remark" :title="row.remark">
                <span class="board-seat__remark-text">{{ row.remark }}</span>
              </div>

              <!-- 上栏：在座（放座 / 延时 / 改派）；空 = 当前无人在座 -->
              <div class="board-lane board-lane--top" :class="hasCurrent(row) ? `is-${countdownKind(row)}` : 'is-empty'">
                <span class="board-lane__label">{{ t('gzBeanBoard.laneTop') }}</span>
                <template v-if="hasCurrent(row)">
                  <div class="board-lane__body">
                    <div class="board-lane__cd-row">
                      <span class="board-lane__start c-num">{{ hhmm(row.slotStart) }}-{{ hhmm(row.slotEnd) }}</span>
                      <span v-if="showCountdown(row)" class="board-lane__cd c-num" :class="`is-${countdownKind(row)}`">{{
                        countdownLabel(row)
                      }}</span>
                    </div>
                    <div class="board-lane__id c-num">
                      {{ row.bookingNo }}<template v-if="row.mobileSnapshot"> · {{ mobileTail(row.mobileSnapshot) }}</template>
                    </div>
                    <div v-if="row.continuousUntil || row.isFree === 1" class="board-lane__chips">
                      <span v-if="row.continuousUntil" class="board-chip is-cont">{{
                        t('gzBeanBoard.continuousTag', { time: hhmm(row.continuousUntil) })
                      }}</span>
                      <span v-if="row.isFree === 1" class="board-chip is-free">{{ t('gzBeanBoard.freeTag') }}</span>
                    </div>
                  </div>
                  <div class="board-lane__acts">
                    <el-button
                      v-hasPermi="['gz:bean:booking:verify']"
                      class="board-lane__cta"
                      :type="countdownKind(row) === 'use' ? 'success' : 'danger'"
                      size="small"
                      :loading="releasing"
                      @click.stop="handleRelease(row)"
                    >
                      {{ t('gzBeanBoard.releaseSeat') }}
                    </el-button>
                    <el-button class="board-lane__act" size="small" @click.stop="openExtend(row)">{{ t('gzBeanBoard.extend') }}</el-button>
                    <el-button class="board-lane__act" size="small" @click.stop="openReassign(row)">{{ t('gzBeanBoard.reassignShort') }}</el-button>
                  </div>
                </template>
                <div v-else class="board-lane__empty">{{ t('gzBeanBoard.laneEmptyCurrent') }}</div>
              </div>

              <!-- 下栏：待核销（核销 / 取消排位）；空闲 = 代客预约；在座无下一位 = 暂无下一位 -->
              <div class="board-lane board-lane--bottom" :class="hasNext(row) ? 'is-res' : 'is-empty'">
                <span class="board-lane__label is-next">
                  {{ t('gzBeanBoard.laneNext')
                  }}<span v-if="hasNext(row) && (row.nextCount || 0) > 1" class="board-lane__more">{{
                    t('gzBeanBoard.nextMore', { n: (row.nextCount || 1) - 1 })
                  }}</span>
                </span>
                <template v-if="hasNext(row)">
                  <div class="board-lane__body">
                    <div class="board-lane__cd-row">
                      <span class="board-lane__start c-num">{{ hhmm(row.nextSlotStart) }}-{{ hhmm(row.nextSlotEnd) }}</span>
                    </div>
                    <div class="board-lane__id c-num">
                      {{ row.nextBookingNo }}<template v-if="row.nextMobileSnapshot"> · {{ mobileTail(row.nextMobileSnapshot) }}</template>
                    </div>
                    <div v-if="row.nextIsFree === 1" class="board-lane__chips">
                      <span class="board-chip is-free">{{ t('gzBeanBoard.freeTag') }}</span>
                    </div>
                  </div>
                  <div class="board-lane__acts">
                    <el-button
                      v-hasPermi="['gz:bean:booking:verify']"
                      class="board-lane__cta"
                      type="primary"
                      size="small"
                      :loading="verifyingNextId === row.nextBookingId"
                      @click.stop="handleVerifyNext(row)"
                    >
                      {{ t('gzBeanBoard.verifyNext') }}
                    </el-button>
                    <el-button v-hasPermi="['gz:bean:booking:verify']" class="board-lane__act" size="small" @click.stop="handleUnassignNext(row)">
                      {{ t('gzBeanBoard.unassignNext') }}
                    </el-button>
                  </div>
                </template>
                <template v-else>
                  <!-- 空闲座不再显示内联代客按钮（客户 7.12）：代客统一进座位详情抽屉，点卡片打开 -->
                  <div v-if="!hasCurrent(row)" class="board-lane__empty">{{ t('gzBeanBoard.laneIdleReserve') }}</div>
                  <div v-else class="board-lane__empty">{{ t('gzBeanBoard.laneEmptyNext') }}</div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 座位当前单详情 + 操作抽屉（close-on-click-modal 显式置 true：main.ts 把 ElDialog 默认改成 false
         经 drawerProps spread dialogProps 泄漏到 el-drawer，这里覆盖回来 → 点蒙层即关闭） -->
    <el-drawer v-model="detailVisible" :title="t('gzBeanBoard.detailTitle')" size="420px" direction="rtl" :close-on-click-modal="true">
      <template v-if="activeRow">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item :label="t('gzBeanBoard.colSeatNo')">
            {{ activeRow.seatNo }}<span v-if="activeRow.tableNo"> / {{ activeRow.tableNo }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colZone')">{{ activeRow.zone || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colTypeName')">{{ activeRow.typeName || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colBoardStatus')">
            <el-tag :type="statusTagType(activeRow.boardStatus)" effect="plain" size="small">
              {{ t(`gzBeanBoard.status.${activeRow.boardStatus}`) }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <el-descriptions v-if="isOccupied(activeRow)" :column="1" border size="small" class="mt-3" :title="t('gzBeanBoard.bookingSection')">
          <el-descriptions-item :label="t('gzBeanBoard.colBookingNo')">{{ activeRow.bookingNo || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colMobile')">{{ activeRow.mobileSnapshot || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colSlot')">
            <template v-if="activeRow.slotStart && activeRow.slotEnd">{{ hhmm(activeRow.slotStart) }} - {{ hhmm(activeRow.slotEnd) }}</template>
            <template v-else>-</template>
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colVerifyTime')">{{ activeRow.verifyTime || '-' }}</el-descriptions-item>
          <el-descriptions-item v-if="activeRow.actualEndTime" :label="t('gzBeanBoard.colActualEndTime')">{{
            activeRow.actualEndTime
          }}</el-descriptions-item>
          <el-descriptions-item v-if="showCountdown(activeRow)" :label="t('gzBeanBoard.colRemaining')">{{
            countdownLabel(activeRow)
          }}</el-descriptions-item>
          <el-descriptions-item v-if="showCanExtend(activeRow)" :label="t('gzBeanBoard.colCanExtend')">
            <el-tag :type="activeRow.canExtend ? 'success' : 'danger'" effect="plain" size="small">
              {{ activeRow.canExtend ? t('gzBeanBoard.canExtendYes') : t('gzBeanBoard.canExtendNo') }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colIsFree')">
            {{ activeRow.isFree === 1 ? t('gzBeanBoard.freeTag') : t('gzBeanBoard.paidTag') }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 当下无人在座（空闲 或 仅有未来排位）→ 可代客插空档（GZ-BEAN-047）。排位在时给出提示，
             代客抽屉默认结束会自动截到排位开始前，超出会被后端拦（与排位重叠）。 -->
        <template v-else-if="!isOccupied(activeRow)">
          <div v-if="hasNext(activeRow)" class="board-detail-reserved mt-3">
            {{ t('gzBeanBoard.walkInBeforeReserve', { start: hhmm(activeRow.nextSlotStart), end: hhmm(activeRow.nextSlotEnd) }) }}
          </div>
          <div v-else class="board-detail-idle mt-3">{{ t('gzBeanBoard.idleHint') }}</div>
          <div class="board-actions mt-4">
            <el-button v-hasPermi="['gz:bean:booking:verify']" type="primary" :icon="Plus" @click="openWalkIn(activeRow)">
              {{ t('gzBeanBoard.walkInCreate') }}
            </el-button>
          </div>
          <div class="board-actions-hint mt-2">{{ t('gzBeanBoard.walkInHint') }}</div>
        </template>

        <!-- 操作：仅 in_use / near_end / overtime（已核销在店）可放座 / 延时 -->
        <div v-if="canOperate(activeRow)" class="board-actions mt-4">
          <el-button
            v-hasPermi="['gz:bean:booking:verify']"
            type="warning"
            :icon="CircleClose"
            :loading="releasing"
            @click="handleRelease(activeRow)"
          >
            {{ t('gzBeanBoard.releaseSeat') }}
          </el-button>
          <el-button v-hasPermi="['gz:bean:booking:verify']" type="primary" :icon="Timer" :loading="extending" @click="openExtend(activeRow)">
            {{ t('gzBeanBoard.extend') }}
          </el-button>
          <el-button
            v-if="canReassign(activeRow)"
            v-hasPermi="['gz:bean:booking:verify']"
            type="info"
            :icon="Switch"
            @click="openReassign(activeRow)"
          >
            {{ t('gzBeanBoard.reassign') }}
          </el-button>
        </div>
        <div v-if="canOperate(activeRow)" class="board-actions-hint mt-2">{{ t('gzBeanBoard.actionsHint') }}</div>

        <!-- 占用座也能代客预约排位（GZ-BEAN-048）：临时来人时，排到当前在座单之后的空档，建一张待核销单，客人到点在下栏核销落座 -->
        <template v-if="isOccupied(activeRow)">
          <div class="board-detail-reserved mt-4">
            {{ t('gzBeanBoard.walkInAfterCurrent', { end: hhmm(activeRow.slotEnd) }) }}
          </div>
          <div class="board-actions mt-2">
            <el-button v-hasPermi="['gz:bean:booking:verify']" type="primary" plain :icon="Plus" @click="openWalkIn(activeRow)">
              {{ t('gzBeanBoard.walkInCreate') }}
            </el-button>
          </div>
        </template>

        <!-- 座位备注：纯挂座位，与是否有人/空闲无关，店员手动填/清；每天自动清理（只当天有效，跨日打开看板自动清空） -->
        <div class="board-remark mt-4">
          <div class="board-remark__label">{{ t('gzBeanBoard.noteSeatLabel') }}</div>
          <el-input
            v-model="seatRemarkInput"
            type="textarea"
            :rows="3"
            :maxlength="500"
            show-word-limit
            :placeholder="t('gzBeanBoard.notePlaceholderSeat')"
          />
          <div class="board-remark__actions mt-2">
            <el-button
              v-if="activeRow.remark"
              v-hasPermi="['gz:bean:booking:verify']"
              type="danger"
              plain
              :icon="Delete"
              :loading="savingRemark"
              @click="handleDeleteRemark(activeRow)"
            >
              {{ t('gzBeanBoard.remarkDelete') }}
            </el-button>
            <el-button
              v-hasPermi="['gz:bean:booking:verify']"
              type="primary"
              :icon="EditPen"
              :loading="savingRemark"
              :disabled="seatRemarkInput === (activeRow.remark || '')"
              @click="handleSaveRemark(activeRow)"
            >
              {{ t('gzBeanBoard.remarkSave') }}
            </el-button>
          </div>
          <div class="board-remark__hint">{{ t('gzBeanBoard.noteSeatHint') }}</div>
        </div>
      </template>
    </el-drawer>

    <!-- 延时弹窗 -->
    <el-dialog v-model="extendVisible" :title="t('gzBeanBoard.extendTitle')" width="380px">
      <el-form label-width="100px">
        <el-form-item :label="t('gzBeanBoard.extendMinutes')">
          <el-input-number v-model="extendMinutes" :min="5" :max="720" :step="5" />
          <span class="form-hint">{{ t('gzBeanBoard.extendMinutesHint') }}</span>
        </el-form-item>
      </el-form>
      <el-alert type="warning" :closable="false" show-icon :description="t('gzBeanBoard.extendNoPayHint')" />
      <template #footer>
        <el-button @click="extendVisible = false">{{ t('gzBeanBoard.cancel') }}</el-button>
        <el-button type="primary" :loading="extending" @click="handleExtend">{{ t('gzBeanBoard.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 看板代客预约抽屉（0702 反馈 #2）：现金到店客一步「建单 + 核销 + 分座」 -->
    <el-drawer
      v-model="walkInVisible"
      :title="t(walkInIsReserve ? 'gzBeanBoard.walkInTitleReserve' : 'gzBeanBoard.walkInTitle')"
      size="440px"
      direction="rtl"
      :close-on-click-modal="false"
    >
      <template v-if="walkInSeat">
        <el-descriptions :column="1" border size="small" class="mb-3">
          <el-descriptions-item :label="t('gzBeanBoard.colSeatNo')">
            {{ walkInSeat.seatNo }}<span v-if="walkInSeat.tableNo"> / {{ walkInSeat.tableNo }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colTypeName')">{{ walkInSeat.typeName || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colSessDate')">{{ sessDate }}</el-descriptions-item>
        </el-descriptions>

        <el-form label-width="92px" @submit.prevent>
          <!-- 核销 = 客人现在就坐（立即落座 used）；排位 = 占座待客（建待核销单 pending）。占用座只能排位 -->
          <el-form-item :label="t('gzBeanBoard.walkInModeLabel')">
            <el-radio-group v-model="walkInForm.mode" @change="onWalkInModeChange">
              <el-radio-button value="verify" :disabled="walkInModeVerifyDisabled">{{ t('gzBeanBoard.walkInModeVerify') }}</el-radio-button>
              <el-radio-button value="reserve">{{ t('gzBeanBoard.walkInModeReserve') }}</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <div v-if="walkInModeVerifyDisabled" class="walkin-mode-hint">{{ walkInModeDisabledHint }}</div>
          <el-form-item :label="t('gzBeanBoard.walkInSlotStart')">
            <template v-if="walkInForm.mode === 'reserve'">
              <el-time-picker v-model="walkInForm.slotStart" format="HH:mm" value-format="HH:mm:ss" :clearable="false" style="width: 130px" />
              <span class="form-hint">{{ t('gzBeanBoard.walkInTimeHint') }}</span>
            </template>
            <span v-else class="walkin-now">{{ t('gzBeanBoard.walkInStartNow') }}</span>
          </el-form-item>
          <el-form-item :label="t('gzBeanBoard.walkInSlotEnd')">
            <el-time-picker v-model="walkInForm.slotEnd" format="HH:mm" value-format="HH:mm:ss" :clearable="false" style="width: 130px" />
            <span class="form-hint">{{ walkInRangeHint }}</span>
          </el-form-item>
          <el-form-item :label="t('gzBeanBoard.walkInMobile')">
            <el-input v-model="walkInForm.mobile" maxlength="11" :placeholder="t('gzBeanBoard.walkInMobilePlaceholder')" style="width: 220px" />
          </el-form-item>
          <el-form-item :label="t('gzBeanBoard.walkInFree')">
            <el-switch v-model="walkInForm.isFree" @change="onWalkInFreeChange" />
            <span class="form-hint">{{ t('gzBeanBoard.walkInFreeHint') }}</span>
          </el-form-item>
          <el-form-item :label="t('gzBeanBoard.walkInAmount')">
            <el-input-number
              v-model="walkInForm.amountYuan"
              :min="0"
              :precision="2"
              :step="1"
              :disabled="walkInForm.isFree"
              :placeholder="t('gzBeanBoard.walkInAmountPlaceholder')"
              controls-position="right"
              style="width: 160px"
            />
            <span class="form-hint">{{ t('gzBeanBoard.walkInAmountHint') }}</span>
          </el-form-item>
        </el-form>
        <el-alert
          :type="walkInIsReserve ? 'warning' : 'info'"
          :closable="false"
          show-icon
          :description="t(walkInIsReserve ? 'gzBeanBoard.walkInAlertReserve' : 'gzBeanBoard.walkInAlert')"
          class="mt-2"
        />
      </template>
      <template #footer>
        <el-button @click="walkInVisible = false">{{ t('gzBeanBoard.cancel') }}</el-button>
        <el-button type="primary" :loading="walkInSubmitting" :disabled="!walkInValid" @click="handleWalkInSubmit">
          {{ t(walkInIsReserve ? 'gzBeanBoard.walkInConfirmReserve' : 'gzBeanBoard.walkInConfirm') }}
        </el-button>
      </template>
    </el-drawer>

    <!-- 分配座位弹窗：核销分座（②待分座/提前核销）/ 改派座位（详情抽屉）两用 -->
    <el-dialog v-model="assignVisible" :title="assignDialogTitle" width="480px">
      <template v-if="assignSummary">
        <el-descriptions :column="1" border size="small" class="mb-3">
          <el-descriptions-item :label="t('gzBeanBoard.colBookingNo')">{{ assignSummary.bookingNo }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colTypeName')">{{ assignSummary.typeName }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzBeanBoard.colSlot')">{{ assignSummary.slot }}</el-descriptions-item>
        </el-descriptions>

        <div class="assign-seat-label">
          {{ assignPickSeatLabel }}
        </div>
        <el-alert
          v-if="suggestedSeatId"
          type="warning"
          :closable="false"
          show-icon
          class="mb-2"
          :description="t('gzBeanBoard.assignSuggestedHint')"
        />
        <el-empty v-if="assignSeatOptions.length === 0" :description="t('gzBeanBoard.assignNoIdle')" :image-size="60" />
        <div v-else class="assign-seat-grid">
          <div
            v-for="seat in assignSeatOptions"
            :key="seat.seatId"
            class="assign-seat"
            :class="{
              'is-selected': selectedSeatId === seat.seatId,
              'is-suggested': seat.seatId === suggestedSeatId,
              'is-disabled': !seat.assignable
            }"
            @click="seat.assignable && (selectedSeatId = seat.seatId)"
          >
            <el-tag v-if="seat.seatId === suggestedSeatId" type="danger" size="small" effect="dark" class="assign-seat__suggest">
              {{ t('gzBeanBoard.assignSuggestedTag') }}
            </el-tag>
            <div class="assign-seat__no">
              {{ seat.seatNo }}<span v-if="seat.tableNo" class="assign-seat__table">{{ seat.tableNo }}</span>
            </div>
            <div class="assign-seat__type">{{ seat.typeName || '-' }}</div>
            <!-- 排位候选：被目标时段占用的座置灰给理由（ADR-0018 §2 客户 7.07），店员不再困惑「D4 去哪了」 -->
            <div v-if="!seat.assignable" class="assign-seat__occupied">
              {{ seat.occupiedUntil ? t('gzBeanBoard.seatOccupiedUntil', { time: seat.occupiedUntil }) : t('gzBeanBoard.seatUnavailable') }}
            </div>
          </div>
        </div>
        <el-alert
          v-if="assignSeatOptions.length === 0"
          type="warning"
          :closable="false"
          show-icon
          class="mt-2"
          :description="t('gzBeanBoard.assignNoIdleHint')"
        />
      </template>
      <template #footer>
        <el-button @click="assignVisible = false">{{ t('gzBeanBoard.cancel') }}</el-button>
        <el-button type="primary" :loading="assigning" :disabled="!selectedSeatId" @click="handleAssignConfirm">
          {{ assignConfirmText }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="GzBeanBoard">
import { ref, computed, onMounted, onActivated, onDeactivated, onBeforeUnmount } from 'vue';
import { Search, Refresh, Timer, CircleClose, Bell, Select, Switch, WarningFilled, EditPen, Delete, Plus } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { getGzBeanStoreOptions, type GzBeanStoreVO } from '@/api/gz-bean/store';
import {
  getGzBeanBoard,
  getGzBeanPendingAssign,
  verifyGzBeanBookingWithSeat,
  preAssignGzBeanSeat,
  unassignGzBeanSeat,
  reassignGzBeanSeat,
  releaseGzBeanSeat,
  extendGzBeanBooking,
  updateGzBeanBoardNote,
  getGzBeanExpiredUnsettled,
  batchSettleGzBeanBookings,
  walkInGzBeanBooking,
  markGzBeanBookingHandled,
  type GzBeanBoardRowVO,
  type GzBeanBoardStatus,
  type GzBeanPendingAssignVO,
  type GzBeanExpiredUnsettledVO,
  type GzBeanSettleAction,
  type GzBeanWalkInBo
} from '@/api/gz-bean/board';
import { getGzBeanPreAssignCandidates } from '@/api/gz-bean/booking';
import type { GzBeanSeatVO } from '@/api/gz-bean/seat';

const { t } = useI18n();

const pageLoading = ref(false);
const listLoading = ref(false);
const releasing = ref(false);
const extending = ref(false);

const storeOptions = ref<GzBeanStoreVO[]>([]);
const currentStoreId = ref<number | null>(null);
const sessDate = ref<string>(todayStr());

const rows = ref<GzBeanBoardRowVO[]>([]);

// ②待分座区
const pendingRows = ref<GzBeanPendingAssignVO[]>([]);
const pendingLoading = ref(false);

// 主动弹窗 + 提示音开关（甲方核心诉求 ADR-0016 §6）
const alertEnabled = ref(true);
const soundEnabled = ref(false);
/** 已弹过 near_end 提醒的 bookingId 集合（去重：同一单只弹一次，转出 near_end 后清除以便下轮再约可再弹） */
const notifiedNearEnd = new Set<string>();

const legendStatuses: GzBeanBoardStatus[] = ['reserved', 'in_use', 'near_end', 'overtime', 'idle'];

// ============ 本地时钟（驱动倒计时刷新 + 看板自动重拉） ============
const autoRefresh = ref(true);
const now = ref(Date.now());
const nowLabel = computed(() => formatClock(now.value));
let tickTimer: ReturnType<typeof setInterval> | null = null;
let lastFetchAt = 0;

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatClock(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/** HH:mm:ss → HH:mm 显示（null/空安全，两层看板 next* 字段可能为空时不抛错） */
function hhmm(t?: string | null): string {
  if (!t) return '';
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function mobileTail(mobile: string): string {
  return mobile.length >= 4 ? mobile.slice(-4) : mobile;
}

// ============ 看板分组（分区 → 桌型 → 座位单元） ============
interface BoardGroup {
  key: string;
  zone: string;
  typeName: string;
  bookMode: string | null;
  seats: GzBeanBoardRowVO[];
}

const groupedRows = computed<BoardGroup[]>(() => {
  const map = new Map<string, BoardGroup>();
  for (const r of rows.value) {
    const zone = r.zone || t('gzBeanBoard.zoneDefault');
    const typeName = r.typeName || t('gzBeanBoard.typeUnknown');
    const key = `${r.zone || ''}__${r.seatTypeConfigId || ''}`;
    let g = map.get(key);
    if (!g) {
      g = { key, zone, typeName, bookMode: r.bookMode || null, seats: [] };
      map.set(key, g);
    }
    g.seats.push(r);
  }
  return Array.from(map.values());
});

// ============ 状态/倒计时辅助 ============
function statusTagType(st: GzBeanBoardStatus): 'info' | 'warning' | 'success' | 'danger' | 'primary' {
  switch (st) {
    case 'idle':
      return 'info';
    case 'reserved':
      return 'primary';
    case 'in_use':
      return 'success';
    case 'near_end':
      return 'warning';
    case 'overtime':
      return 'danger';
    default:
      return 'info';
  }
}

function statusCount(st: GzBeanBoardStatus): number {
  return rows.value.filter((r) => r.boardStatus === st).length;
}

/** 占用态（有当前活跃单）：非 idle */
function isOccupied(row: GzBeanBoardRowVO): boolean {
  return row.boardStatus !== 'idle' && !!row.currentBookingId;
}

/** 上栏在座（ADR-0018 §2）：有在座使用中单（currentBookingId 非空）。 */
function hasCurrent(row: GzBeanBoardRowVO): boolean {
  return !!row.currentBookingId;
}

/** 下栏待核销（ADR-0018 §2）：有已排位待核销单（nextBookingId 非空）。 */
function hasNext(row: GzBeanBoardRowVO): boolean {
  return !!row.nextBookingId;
}

/** 已核销在店（in_use / near_end / overtime）→ 可放座 / 延时 */
function canOperate(row: GzBeanBoardRowVO): boolean {
  return row.boardStatus === 'in_use' || row.boardStatus === 'near_end' || row.boardStatus === 'overtime';
}

/** 可改派：已核销在店（used 未放座 = canOperate）且 actualEndTime 为空（未放座） */
function canReassign(row: GzBeanBoardRowVO): boolean {
  return canOperate(row) && !!row.currentBookingId && !row.actualEndTime;
}

/** 显示倒计时：in_use / near_end 剩 X（绿/黄），overtime 超 X（红，倒计上翻）。均需 slotEnd。 */
function showCountdown(row: GzBeanBoardRowVO): boolean {
  return (row.boardStatus === 'in_use' || row.boardStatus === 'near_end' || row.boardStatus === 'overtime') && row.slotEnd != null;
}

/** 倒计时色彩 kind（驱动 c1 分层双栏格大数字 + 上栏底色）：in_use 绿 / near_end 黄 / overtime 红。 */
function countdownKind(row: GzBeanBoardRowVO): 'use' | 'near' | 'over' {
  if (row.boardStatus === 'overtime') return 'over';
  if (row.boardStatus === 'near_end') return 'near';
  return 'use';
}

/** 显示「可延时 / 请收尾」信号：后端仅 near_end / overtime 回填 canExtend（in_use 也可能回填但提前量未到，按 near_end/overtime 展示更聚焦） */
function showCanExtend(row: GzBeanBoardRowVO): boolean {
  return (row.boardStatus === 'near_end' || row.boardStatus === 'overtime') && row.canExtend != null;
}

/**
 * 倒计时文案：以「续坐完成时刻 continuousUntil（若有）否则计划 slot_end」为准，结合 sessDate + 本地时钟实时刷新到分秒。
 * 已过界（< 0）→ 显「即将结束」兜底（后端会在下次重拉时转 overtime）。
 * 0702 续坐显示重设计：同人已核销 back-to-back 续坐 → 倒计时算到续坐完成时刻，与后端 fillCurrentBooking 的 effectiveEnd 同口径。
 */
function countdownLabel(row: GzBeanBoardRowVO): string {
  const endMs = effectiveEndMs(row);
  if (endMs == null) {
    // 无法解析时回退后端粗粒度分钟（≥ 60 分同样走「剩 X 时 X 分」）
    if (row.remainingMinutes != null && row.remainingMinutes > 0) {
      const n = row.remainingMinutes;
      return n >= 60 ? t('gzBeanBoard.remainCountdownHm', { h: Math.floor(n / 60), m: n % 60 }) : t('gzBeanBoard.remainMinutes', { n });
    }
    return t('gzBeanBoard.endingSoon');
  }
  // 起算点取 max(now, slot_start)：核销早于时段开始时剩余冻结在「预约时长」上限、不从 slot_end 直接倒推超发
  //   （用户订 1h → 显示 ≤ 60min，修掉「核销 11:37、订 14:00-15:00 → 显 203min」；时段开始后正常按秒倒计）。
  //   与后端 fillCurrentBooking 的 countFrom = max(now, plannedStart) 同口径。
  const startMs = slotStartMs(row);
  const anchor = startMs != null ? Math.max(now.value, startMs) : now.value;
  const diff = endMs - anchor;
  if (diff <= 0) {
    // 超时：从有效结束时刻起「超 MM:SS」倒计上翻（红），与后端 overtime 同口径；非超时兜底「即将结束」。
    if (row.boardStatus === 'overtime') {
      const overSec = Math.floor((now.value - endMs) / 1000);
      if (overSec >= 3600) {
        return t('gzBeanBoard.overCountdownHm', { h: Math.floor(overSec / 3600), m: Math.floor((overSec % 3600) / 60) });
      }
      return t('gzBeanBoard.overCountdown', { m: Math.floor(overSec / 60), s: String(overSec % 60).padStart(2, '0') });
    }
    return t('gzBeanBoard.endingSoon');
  }
  const totalSec = Math.floor(diff / 1000);
  // ≥ 60 分 → 「剩 X 时 X 分」（续坐链可长达数小时，秒级跳动无意义、也更好读）；
  // < 60 分 → 「剩 X 分 X 秒」（临近结束保留秒级精确倒计）。
  if (totalSec >= 3600) {
    const h = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    return t('gzBeanBoard.remainCountdownHm', { h, m: mm });
  }
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return t('gzBeanBoard.remainCountdown', { m, s: String(s).padStart(2, '0') });
}

/** 由 sessDate + slotStart(HH:mm:ss) 组装该单计划开始的本地时间戳（倒计时起算下限）。 */
function slotStartMs(row: GzBeanBoardRowVO): number | null {
  return hhmmsToMs(row.slotStart);
}

/** 由 sessDate + slotEnd(HH:mm:ss) 组装该单计划结束的本地时间戳 */
function slotEndMs(row: GzBeanBoardRowVO): number | null {
  return hhmmsToMs(row.slotEnd);
}

/**
 * 倒计时/状态锚定的「有效结束时刻」（0702 续坐显示重设计）：有续坐（continuousUntil）→ 用续坐完成时刻，
 * 否则退回当前子单 slot_end。与后端 fillCurrentBooking 的 effectiveEnd 同口径。
 */
function effectiveEndMs(row: GzBeanBoardRowVO): number | null {
  return hhmmsToMs(row.continuousUntil || row.slotEnd);
}

/** sessDate（当日）+ "HH:mm[:ss]" → 本地时间戳；解析失败返回 null。 */
function hhmmsToMs(time: string | null | undefined): number | null {
  if (!time) return null;
  const parts = time.split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const mi = Number(parts[1]);
  const se = parts.length >= 3 ? Number(parts[2]) : 0;
  if (Number.isNaN(h) || Number.isNaN(mi)) return null;
  const [y, mo, d] = sessDate.value.split('-').map((x) => Number(x));
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return null;
  return new Date(y, mo - 1, d, h, mi, se).getTime();
}

// ============ 数据加载 ============
async function loadStoreOptions() {
  pageLoading.value = true;
  try {
    const resp = await getGzBeanStoreOptions();
    const r = resp as any;
    storeOptions.value = (r.data || r || []) as GzBeanStoreVO[];
    if (storeOptions.value.length > 0 && currentStoreId.value == null) {
      currentStoreId.value = storeOptions.value[0].id;
      await loadBoard();
    }
  } catch (e) {
    console.error('[gz-bean-board] loadStoreOptions failed', e);
    ElMessage.error(t('gzBeanBoard.loadFailed'));
  } finally {
    pageLoading.value = false;
  }
}

async function onStoreChange(id: number) {
  currentStoreId.value = id;
  // 换店清空提醒记账 + 待分座区 + 过期待处理区，避免上一店的 near_end / 待分座 / 过期单串到本店
  notifiedNearEnd.clear();
  pendingRows.value = [];
  expiredRows.value = [];
  selectedExpiredIds.value = [];
  await loadBoard();
}

async function loadBoard() {
  if (currentStoreId.value == null) return;
  listLoading.value = true;
  try {
    const resp = await getGzBeanBoard(currentStoreId.value, sessDate.value);
    const next = ((resp as any).data || []) as GzBeanBoardRowVO[];
    detectNearEnd(next);
    rows.value = next;
    // 抽屉打开时同步刷新当前选中座位
    if (detailVisible.value && activeRow.value) {
      const nextRow = rows.value.find((r) => r.seatId === activeRow.value!.seatId);
      activeRow.value = nextRow || null;
      if (!nextRow) detailVisible.value = false;
    }
  } catch (e) {
    console.error('[gz-bean-board] loadBoard failed', e);
    ElMessage.error(t('gzBeanBoard.loadFailed'));
  } finally {
    // 成功 / 失败都前移 lastFetchAt：接口异常时仍按 30s 退避重试，避免每秒重试刷屏（500 风暴根因）
    lastFetchAt = Date.now();
    listLoading.value = false;
  }
  // 看板与待分座区 / 过期待处理区一起刷新（同一动作触发，互不阻塞）
  loadPending();
  loadExpired();
}

/** ②待分座区加载 */
async function loadPending() {
  if (currentStoreId.value == null) return;
  pendingLoading.value = true;
  try {
    const resp = await getGzBeanPendingAssign(currentStoreId.value, sessDate.value);
    pendingRows.value = ((resp as any).data || []) as GzBeanPendingAssignVO[];
  } catch (e) {
    console.error('[gz-bean-board] loadPending failed', e);
    // 待分座区失败不打断主看板，控制台标记即可
  } finally {
    pendingLoading.value = false;
  }
}

/** 直接核销已处理（不分座）（0702 反馈 #3）：桌型/座位对不上无法正常分座核销的单，二次确认后标记 used、从待分座消失 */
const markHandlingId = ref<string | number | null>(null);
async function handleMarkHandled(p: GzBeanPendingAssignVO) {
  try {
    await ElMessageBox.confirm(t('gzBeanBoard.markHandledConfirm', { no: p.bookingNo }), t('gzBeanBoard.markHandledConfirmTitle'), {
      type: 'warning',
      confirmButtonText: t('gzBeanBoard.markHandled'),
      cancelButtonText: t('gzBeanBoard.cancel')
    });
  } catch {
    return; // 取消
  }
  markHandlingId.value = p.id;
  try {
    await markGzBeanBookingHandled(p.id);
    ElMessage.success(t('gzBeanBoard.markHandledSuccess'));
    await loadBoard(); // 刷新看板 + 待分座区（本单已 used，自动离开待分座）
  } catch (e) {
    console.error('[gz-bean-board] mark-handled failed', e);
  } finally {
    markHandlingId.value = null;
  }
}

// ============ 组·N人 标签（ADR-0018 §1）============
// 「整组排位」一键功能已下线（mp 组单入口紧急下线，不再产生组单；组单遗留单由单排位/单核销逐个处理）。
// 仅保留 groupCount 供 pending 卡片「组·N人」信息标签显示（标记该待排位单属于某组）。
/** 本组在「未排位客人」列表里的待排位子单数（组·N人 标签用）。 */
function groupCount(groupId?: string | null): number {
  if (!groupId) return 0;
  return pendingRows.value.filter((x) => x.groupId === groupId).length;
}

// ============ 主动弹窗：diff 新进入 near_end 的座位 ============
/**
 * 找出本轮「新进入 near_end」的座位（相对 notifiedNearEnd 记账）→ ElNotification + 去重 + 可选声音。
 * 去重：同一 currentBookingId 只弹一次（notifiedNearEnd 记账）；该单离开 near_end（结束 / 放座 / 换单）后清除其记账，
 * 以便该座下一单再次进入 near_end 时可再弹。
 */
function detectNearEnd(next: GzBeanBoardRowVO[]) {
  if (!alertEnabled.value) {
    // 关闭弹窗时仍维护记账集合，避免重开后对存量 near_end 集中补弹
    syncNotifiedSet(next);
    return;
  }
  // 当前仍处 near_end 的 bookingId 集合（用于清理已离场的记账）
  const liveNearEnd = new Set<string>();
  for (const row of next) {
    const bid = row.currentBookingId;
    if (row.boardStatus === 'near_end' && bid) {
      liveNearEnd.add(bid);
      if (!notifiedNearEnd.has(bid)) {
        notifiedNearEnd.add(bid);
        notifyNearEnd(row);
      }
    }
  }
  // 清理：已不在 near_end 的旧记账（结束/放座/被新单替换），以便该座再次进入 near_end 时可再弹
  for (const bid of Array.from(notifiedNearEnd)) {
    if (!liveNearEnd.has(bid)) notifiedNearEnd.delete(bid);
  }
}

/** 关闭弹窗时仅同步记账集合（把当前 near_end 全标记为已弹），不实际弹窗 */
function syncNotifiedSet(next: GzBeanBoardRowVO[]) {
  notifiedNearEnd.clear();
  for (const row of next) {
    if (row.boardStatus === 'near_end' && row.currentBookingId) {
      notifiedNearEnd.add(row.currentBookingId);
    }
  }
}

function notifyNearEnd(row: GzBeanBoardRowVO) {
  const remain = row.remainingMinutes != null && row.remainingMinutes > 0 ? row.remainingMinutes : null;
  const body =
    remain != null
      ? row.canExtend
        ? t('gzBeanBoard.notifyBodyExtend', { n: remain })
        : t('gzBeanBoard.notifyBodyWrapup', { n: remain })
      : row.canExtend
        ? t('gzBeanBoard.notifyBodyExtendNoMin')
        : t('gzBeanBoard.notifyBodyWrapupNoMin');
  ElNotification({
    title: t('gzBeanBoard.notifyTitle', { seat: row.seatNo }),
    message: body,
    type: row.canExtend ? 'warning' : 'error',
    duration: 8000,
    position: 'top-right'
  });
  playBeep();
}

/** HTML5 Audio 提示音（WebAudio 合成短 beep；任何失败静默） */
function playBeep() {
  if (!soundEnabled.value) return;
  try {
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    osc.onended = () => ctx.close().catch(() => undefined);
  } catch {
    // 浏览器策略 / 无 AudioContext → 静默
  }
}

// ============ 详情抽屉 ============
const detailVisible = ref(false);
const activeRow = ref<GzBeanBoardRowVO | null>(null);
/** 备注编辑框（独立于 activeRow，避免 30s 自动重拉时冲掉未保存的输入） */
const seatRemarkInput = ref('');
const savingRemark = ref(false);

function openDetail(row: GzBeanBoardRowVO) {
  activeRow.value = row;
  seatRemarkInput.value = row.remark || '';
  detailVisible.value = true;
}

// ============ 看板代客预约 walk-in（0702 #2；GZ-BEAN-046 松绑：分钟精度 + 座位只判当下空闲）============
const walkInVisible = ref(false);
const walkInSubmitting = ref(false);
const walkInSeat = ref<GzBeanBoardRowVO | null>(null);
// mode: 'verify'=核销立即落座（used）/ 'reserve'=排位占座待客（pending，客人到点核销）——店员显式二选一，驱动开始时间与后端 used/pending 判定一致
// slotStart/slotEnd 存 'HH:mm:ss'（分钟精度，店员自由设）；amountYuan=null（未录金额）→ 营业额 0，填数则为实收金额（议价/抹零）
const walkInForm = ref<{ mode: 'verify' | 'reserve'; slotStart: string; slotEnd: string; mobile: string; isFree: boolean; amountYuan: number | null }>({
  mode: 'verify',
  slotStart: '14:00:00',
  slotEnd: '15:00:00',
  mobile: '',
  isFree: false,
  amountYuan: null
});
/** 核销（立即落座）不可用 = 座位当前有人在坐 或 看板不是今天（非当天无法此刻落座，只能排位/占座待客）。 */
const walkInModeVerifyDisabled = computed(
  () => !!walkInSeat.value && (hasCurrent(walkInSeat.value) || sessDate.value !== todayStr())
);
/** 置灰核销的原因文案：占用座 vs 非当天。 */
const walkInModeDisabledHint = computed(() =>
  walkInSeat.value && hasCurrent(walkInSeat.value)
    ? t('gzBeanBoard.walkInModeVerifyDisabledHint')
    : t('gzBeanBoard.walkInModeVerifyDisabledHintDate')
);

/** 'HH:mm:ss' → 当日分钟数（分钟精度比较 / 时长 / 整点格数）。非法串回退 0。 */
function walkInTimeToMin(s: string): number {
  if (!s) return 0;
  const [h, m] = s.split(':').map((v) => Number(v) || 0);
  return h * 60 + m;
}
const walkInStartMin = computed(() => walkInTimeToMin(walkInForm.value.slotStart));
const walkInEndMin = computed(() => walkInTimeToMin(walkInForm.value.slotEnd));
const walkInValid = computed(
  () =>
    walkInEndMin.value > walkInStartMin.value && (walkInForm.value.isFree || walkInForm.value.amountYuan == null || walkInForm.value.amountYuan >= 0)
);
/**
 * 本次代客走「排位 pending 待核销」还是「立刻 used 核销」——由店员显式选的 mode 决定（取代旧的按开始时间自动猜）。
 * mode 与后端 future 口径保持一致：核销 → 开始=此刻（≤now）→ 后端判 used；排位 → 开始晚于此刻（>now）→ 后端判 pending。
 * 抽屉标题/说明/按钮/成功提示据此切换。
 */
const walkInIsReserve = computed(() => walkInForm.value.mode === 'reserve');
/** 时长提示（店员可见）。 */
const walkInRangeHint = computed(() => {
  const d = walkInEndMin.value - walkInStartMin.value;
  if (d <= 0) return t('gzBeanBoard.walkInSlotInvalid');
  return t('gzBeanBoard.walkInRangeHint', { mins: d });
});

/** 免费开关：打开即金额清空并禁用（免费单不计营业额 GMV）。 */
function onWalkInFreeChange(val: string | number | boolean) {
  if (val === true) {
    walkInForm.value.amountYuan = null;
  }
}

/** 'HH:mm:ss'（分钟精度，秒补 00）。 */
function toHmsMinute(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
}

/** 'HH:mm:ss' → 今天该时刻的 Date（分钟精度）。 */
function hmsToTodayDate(hms: string): Date {
  const [h, m] = hms.split(':').map((v) => Number(v) || 0);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * 代客默认时段：核销=此刻起 1h；排位=占用座接当前单之后 / 其余今天取此刻(不足则 now+1min) / 非今天取 14:00。
 * 有未来排位（GZ-BEAN-047）→ 默认结束自动截到排位开始前，避免与排位重叠（店员仍可手动改，重叠会被后端拦）。
 * 'HH:mm:ss' 零填充可直接字符串比大小 = 时间先后。
 */
function defaultWalkInTimes(row: GzBeanBoardRowVO, mode: 'verify' | 'reserve'): { slotStart: string; slotEnd: string } {
  const isToday = sessDate.value === todayStr();
  let start: Date;
  if (mode === 'reserve' && isToday && hasCurrent(row) && row.slotEnd) {
    // 占用座排位：从当前在座单结束起（排其后空档）；若该结束已过（超时单）退回此刻
    const afterCurrent = hmsToTodayDate(row.slotEnd);
    start = afterCurrent.getTime() > Date.now() ? afterCurrent : new Date();
  } else if (!isToday) {
    start = new Date(new Date().setHours(14, 0, 0, 0));
  } else {
    start = new Date();
  }
  // 今天排位：开始须晚于此刻，否则后端会按 used 处理（与「排位」语义不符）→ 至少 now+1min
  if (mode === 'reserve' && isToday && start.getTime() <= Date.now()) {
    start = new Date(Date.now() + 60 * 1000);
  }
  const startStr = toHmsMinute(start);
  let endStr = toHmsMinute(new Date(start.getTime() + 60 * 60 * 1000));
  const reserveStart = row.nextBookingId ? row.nextSlotStart || null : null;
  if (reserveStart && reserveStart > startStr && reserveStart < endStr) {
    endStr = reserveStart;
  }
  return { slotStart: startStr, slotEnd: endStr };
}

/**
 * 打开代客抽屉。默认 mode：占用座（有人在坐）或非今天 → 排位；空闲/排位座（今天）→ 核销（客人就在眼前，一步落座）。
 * 店员可在抽屉里切 mode（占用座核销置灰）；切 mode 时按 defaultWalkInTimes 重设时段。
 */
function openWalkIn(row: GzBeanBoardRowVO) {
  if (!row.seatTypeConfigId) {
    ElMessage.warning(t('gzBeanBoard.walkInNoConfig'));
    return;
  }
  walkInSeat.value = row;
  const isToday = sessDate.value === todayStr();
  const mode: 'verify' | 'reserve' = hasCurrent(row) || !isToday ? 'reserve' : 'verify';
  const { slotStart, slotEnd } = defaultWalkInTimes(row, mode);
  walkInForm.value = { mode, slotStart, slotEnd, mobile: '', isFree: false, amountYuan: null };
  walkInVisible.value = true;
}

/** 切换核销/排位：按新 mode 重设默认时段（核销回此刻起、排位回未来）。 */
function onWalkInModeChange() {
  const row = walkInSeat.value;
  if (!row) return;
  const { slotStart, slotEnd } = defaultWalkInTimes(row, walkInForm.value.mode);
  walkInForm.value.slotStart = slotStart;
  walkInForm.value.slotEnd = slotEnd;
}

async function handleWalkInSubmit() {
  const seat = walkInSeat.value;
  if (!seat || currentStoreId.value == null) return;
  // 核销=此刻落座：提交时把开始刷成当前时间（抽屉久开也不偏移，避免开始晚于此刻被后端误判成排位）
  if (walkInForm.value.mode === 'verify') {
    walkInForm.value.slotStart = toHmsMinute(new Date());
  }
  if (walkInEndMin.value <= walkInStartMin.value) {
    ElMessage.warning(t('gzBeanBoard.walkInSlotInvalid'));
    return;
  }
  // 排位=占座待客：今天的排位开始须晚于此刻，否则后端会当立即 used 处理（与「排位」不符）
  if (walkInForm.value.mode === 'reserve' && sessDate.value === todayStr()) {
    const nowN = new Date();
    if (walkInStartMin.value <= nowN.getHours() * 60 + nowN.getMinutes()) {
      ElMessage.warning(t('gzBeanBoard.walkInReserveStartPast'));
      return;
    }
  }
  // 手机号选填；若填必须 11 位数字（后端 mobileSnapshot 快照）
  const mobile = walkInForm.value.mobile.trim();
  if (mobile && !/^\d{11}$/.test(mobile)) {
    ElMessage.warning(t('gzBeanBoard.walkInMobileInvalid'));
    return;
  }
  walkInSubmitting.value = true;
  const isReserve = walkInIsReserve.value; // await 前定格（成功提示据此区分「已排位待核销」/「已核销起计时」）
  try {
    const yuan = walkInForm.value.amountYuan;
    const payload: GzBeanWalkInBo = {
      storeId: currentStoreId.value,
      seatId: seat.seatId,
      sessDate: sessDate.value,
      // 分钟精度直接透传（后端不再要求整点）
      slotStart: walkInForm.value.slotStart,
      slotEnd: walkInForm.value.slotEnd,
      mobile: mobile || undefined,
      isFree: walkInForm.value.isFree,
      // 免费 → null（后端置 0）；未录金额留空 → null（后端置 0，营业额 0）；填数 → 实收金额（议价/抹零）
      amountCent: walkInForm.value.isFree || yuan == null ? null : Math.round(yuan * 100)
    };
    await walkInGzBeanBooking(payload);
    ElMessage.success(t(isReserve ? 'gzBeanBoard.walkInSuccessReserve' : 'gzBeanBoard.walkInSuccess', { no: seat.seatNo }));
    walkInVisible.value = false;
    detailVisible.value = false;
    await loadBoard();
  } catch (e) {
    console.error('[gz-bean-board] walk-in create failed', e);
  } finally {
    walkInSubmitting.value = false;
  }
}

/**
 * 备注写入：备注纯挂座位（gz_bean_seat.remark），与是否有人/空闲无关，店员手动填/清；每天自动清理（只当天有效）。
 * 成功后同步 activeRow（== rows 内同座对象引用），保存/删除按钮据此回到 disabled/隐藏，无需整体重拉看板。
 */
async function persistNote(row: GzBeanBoardRowVO, value: string, successMsg: string) {
  savingRemark.value = true;
  try {
    await updateGzBeanBoardNote(row.seatId, value);
    ElMessage.success(successMsg);
    seatRemarkInput.value = value;
    row.remark = value || null;
  } catch (e) {
    console.error('[gz-bean-board] save board note failed', e);
  } finally {
    savingRemark.value = false;
  }
}

function handleSaveRemark(row: GzBeanBoardRowVO) {
  return persistNote(row, seatRemarkInput.value, t('gzBeanBoard.remarkSaveSuccess'));
}

/** 删除备注（清空 + 保存）；店员可随时删 */
function handleDeleteRemark(row: GzBeanBoardRowVO) {
  return persistNote(row, '', t('gzBeanBoard.remarkDeleteSuccess'));
}

// ============ 放座 ============
async function handleRelease(row: GzBeanBoardRowVO) {
  if (!row.currentBookingId) return;
  try {
    await ElMessageBox.confirm(t('gzBeanBoard.releaseConfirm', { no: row.seatNo, booking: row.bookingNo || '' }), t('gzBeanBoard.confirmTitle'), {
      type: 'warning'
    });
  } catch {
    return; // 取消
  }
  releasing.value = true;
  try {
    await releaseGzBeanSeat(row.currentBookingId);
    ElMessage.success(t('gzBeanBoard.releaseSuccess'));
    detailVisible.value = false;
    await loadBoard();
  } catch (e) {
    console.error('[gz-bean-board] release failed', e);
  } finally {
    releasing.value = false;
  }
}

// ============ 下栏待核销：核销（用已排座，不再弹选座）/ 取消排位（ADR-0018 §2）============
const verifyingNextId = ref<string | null>(null);

/** 核销下一位待核销单：该单已排到本座（seat_id = row.seatId）→ 直接核销落座，不弹选座弹窗。 */
async function handleVerifyNext(row: GzBeanBoardRowVO) {
  if (!row.nextBookingId || !row.seatId) return;
  try {
    await ElMessageBox.confirm(t('gzBeanBoard.verifyNextConfirm', { no: row.nextBookingNo || '', seat: row.seatNo }), t('gzBeanBoard.confirmTitle'), {
      type: 'warning'
    });
  } catch {
    return; // 取消
  }
  verifyingNextId.value = row.nextBookingId;
  try {
    await verifyGzBeanBookingWithSeat(row.nextBookingId, row.seatId);
    ElMessage.success(t('gzBeanBoard.assignSuccess'));
    await loadBoard();
  } catch (e) {
    // 业务错误码已由拦截器 toast（如别的店员先占了本座 / 该座被别单核销）→ 重拉看板回正
    console.error('[gz-bean-board] verify-next failed', e);
    loadBoard();
  } finally {
    verifyingNextId.value = null;
  }
}

/** 取消排位：把下一位待核销单的座位清回，单回到「未排位客人」列表。 */
async function handleUnassignNext(row: GzBeanBoardRowVO) {
  if (!row.nextBookingId) return;
  try {
    await ElMessageBox.confirm(t('gzBeanBoard.unassignConfirm'), t('gzBeanBoard.confirmTitle'), { type: 'warning' });
  } catch {
    return; // 取消
  }
  try {
    await unassignGzBeanSeat(row.nextBookingId);
    ElMessage.success(t('gzBeanBoard.unassignSuccess'));
    await loadBoard();
  } catch (e) {
    console.error('[gz-bean-board] unassign-next failed', e);
    loadBoard();
  }
}

// ============ 延时 ============
const extendVisible = ref(false);
const extendMinutes = ref(60);
const extendTargetId = ref<string | null>(null);

function openExtend(row: GzBeanBoardRowVO) {
  if (!row.currentBookingId) return;
  extendTargetId.value = row.currentBookingId;
  extendMinutes.value = 60;
  extendVisible.value = true;
}

async function handleExtend() {
  if (!extendTargetId.value) return;
  extending.value = true;
  try {
    await extendGzBeanBooking(extendTargetId.value, extendMinutes.value);
    ElMessage.success(t('gzBeanBoard.extendSuccess'));
    extendVisible.value = false;
    detailVisible.value = false;
    await loadBoard();
  } catch (e) {
    console.error('[gz-bean-board] extend failed', e);
  } finally {
    extending.value = false;
  }
}

// ============ 分配座位弹窗：核销分座（②待分座/提前核销）/ 改派座位 两用 ============
type AssignMode = 'verify' | 'reassign' | 'preassign';
const assignVisible = ref(false);
const assigning = ref(false);
const assignMode = ref<AssignMode>('verify');
/** 分座弹窗标题 / 选座提示 / 确认按钮文案（三模式：核销分座 / 改派 / 排位） */
const assignDialogTitle = computed(() =>
  assignMode.value === 'reassign'
    ? t('gzBeanBoard.reassignTitle')
    : assignMode.value === 'preassign'
      ? t('gzBeanBoard.preAssignTitle')
      : t('gzBeanBoard.assignTitle')
);
const assignPickSeatLabel = computed(() =>
  assignMode.value === 'reassign'
    ? t('gzBeanBoard.reassignPickSeat')
    : assignMode.value === 'preassign'
      ? t('gzBeanBoard.preAssignPickSeat')
      : t('gzBeanBoard.assignPickSeat')
);
const assignConfirmText = computed(() =>
  assignMode.value === 'reassign'
    ? t('gzBeanBoard.reassignConfirm')
    : assignMode.value === 'preassign'
      ? t('gzBeanBoard.preAssignConfirm')
      : t('gzBeanBoard.assignConfirm')
);
/** 核销分座的目标待分座单（verify 模式） */
const assignTarget = ref<GzBeanPendingAssignVO | null>(null);
/** 改派的目标看板行（reassign 模式） */
const reassignTargetRow = ref<GzBeanBoardRowVO | null>(null);
const selectedSeatId = ref<string | null>(null);

/** 弹窗头部摘要（两模式统一渲染） */
interface AssignSummary {
  bookingNo: string;
  typeName: string;
  slot: string;
}
const assignSummary = computed<AssignSummary | null>(() => {
  if (assignMode.value === 'reassign' && reassignTargetRow.value) {
    const r = reassignTargetRow.value;
    return {
      bookingNo: r.bookingNo || '-',
      typeName: r.typeName || t('gzBeanBoard.typeUnknown'),
      slot: r.slotStart && r.slotEnd ? `${hhmm(r.slotStart)} - ${hhmm(r.slotEnd)}` : '-'
    };
  }
  if (assignTarget.value) {
    const p = assignTarget.value;
    return {
      bookingNo: p.bookingNo,
      typeName: p.seatTypeSnapshot || p.seatType || t('gzBeanBoard.typeUnknown'),
      slot: `${hhmm(p.slotStart)} - ${hhmm(p.slotEnd)}`
    };
  }
  return null;
});

/** 当前 verify 弹窗的续坐建议座 id（reassign 模式无）；驱动续坐座入选项 + 角标 + 默认选中。 */
const suggestedSeatId = computed<string | null>(() => (assignMode.value === 'verify' ? (assignTarget.value?.suggestedSeatId ?? null) : null));

/**
 * 当前弹窗可选座：①区 boardStatus='idle' 空闲座，且桌型匹配（typeName === 目标桌型名）。
 * 名称匹配是便利过滤（后端 verify/reassign 仍以 seat_type_config_id 为准做 SEAT_TYPE_MISMATCH 校验）；
 * 无目标桌型名 / 无匹配时回退展示全部空闲座，交由后端兜底校验。
 * GZ-BEAN-037 续坐：建议座被同用户相邻在店单占用（非 idle，不在空闲列表里）→ 置顶并入选项，
 * 让店员看到并确认默认选中的续坐座（两段不重叠，后端区间互斥放行）。
 */
/** 分座弹窗座位选项统一形态（verify/reassign 用板行；preassign 用区间重叠候选，含不可排的置灰座）。 */
interface AssignSeatOption {
  seatId: string;
  seatNo?: string | null;
  tableNo?: string | null;
  typeName?: string | null;
  /** 是否可选（preassign 区间重叠不冲突 = true；verify/reassign 恒 true） */
  assignable: boolean;
  /** 不可排时的占用止界 HH:mm（拼「占用至 HH:mm」告诉店员为何不可排） */
  occupiedUntil?: string | null;
}
/** 排位候选座（ADR-0018 §2 客户 7.07，openPreAssign 时按目标单 slot 区间重叠拉取，含被占的置灰座）。 */
const preAssignCandidates = ref<GzBeanSeatVO[]>([]);

const assignSeatOptions = computed<AssignSeatOption[]>(() => {
  // 排位模式（ADR-0018 §2 客户 7.07）：区间重叠候选（后端算），全部同桌型座含被占的——被占置灰给理由，不再凭空隐藏。
  if (assignMode.value === 'preassign') {
    return preAssignCandidates.value.map((c) => ({
      seatId: c.id,
      seatNo: c.seatNo,
      tableNo: c.tableNo,
      typeName: c.typeName,
      assignable: c.assignable !== false,
      occupiedUntil: c.occupiedUntil ?? null
    }));
  }
  // verify / reassign 模式：沿用「整天 idle」板行（当下物理占用口径，逐字不动，避免回归核销分座 / 改派）。
  const idle = rows.value.filter((r) => r.boardStatus === 'idle' && r.seatId);
  const wantType = assignMode.value === 'reassign' ? reassignTargetRow.value?.typeName : assignTarget.value?.seatTypeSnapshot;
  let options = idle;
  if (wantType) {
    const matched = idle.filter((r) => r.typeName === wantType);
    options = matched.length > 0 ? matched : idle;
  }
  const sid = suggestedSeatId.value;
  if (sid && !options.some((r) => r.seatId === sid)) {
    const suggestedRow = rows.value.find((r) => r.seatId === sid);
    if (suggestedRow) options = [suggestedRow, ...options];
  }
  return options.map((r) => ({
    seatId: r.seatId as string,
    seatNo: r.seatNo,
    tableNo: r.tableNo,
    typeName: r.typeName,
    assignable: true,
    occupiedUntil: null
  }));
});

/**
 * 打开核销分座弹窗。preselectSuggested=true（GZ-BEAN-037 提前核销）时默认预选建议座位，
 * 店员可确认或改选；最终仍走 verifyGzBeanBookingWithSeat(选定座)。
 */
function openAssign(p: GzBeanPendingAssignVO, preselectSuggested = false) {
  assignMode.value = 'verify';
  assignTarget.value = p;
  reassignTargetRow.value = null;
  selectedSeatId.value = preselectSuggested && p.suggestedSeatId ? p.suggestedSeatId : null;
  assignVisible.value = true;
}

/** 打开排位弹窗（ADR-0018 §2）：客人未到，先把该单排到一个空闲座（走 preAssign，不核销）。复用同一分座弹窗（preassign 模式）。
 *  拉「区间重叠候选座」（客户 7.07）：同桌型全部座，被目标时段占用的显示但置灰标「占用至 HH:mm」，其余可排。 */
async function openPreAssign(p: GzBeanPendingAssignVO) {
  assignMode.value = 'preassign';
  assignTarget.value = p;
  reassignTargetRow.value = null;
  selectedSeatId.value = null;
  preAssignCandidates.value = [];
  assignVisible.value = true;
  try {
    const res = await getGzBeanPreAssignCandidates(p.id);
    preAssignCandidates.value = res.data || [];
  } catch (e) {
    console.error('[gz-bean-board] load preassign candidates failed', e);
  }
}

/** 打开改派弹窗（GZ-BEAN-040）：从详情抽屉对已核销在店单改派到另一空闲座。 */
function openReassign(row: GzBeanBoardRowVO) {
  if (!row.currentBookingId) return;
  assignMode.value = 'reassign';
  reassignTargetRow.value = row;
  assignTarget.value = null;
  selectedSeatId.value = null;
  assignVisible.value = true;
}

async function handleAssignConfirm() {
  if (assignMode.value === 'reassign') {
    await doReassign();
  } else if (assignMode.value === 'preassign') {
    await doPreAssign();
  } else {
    await doAssignVerify();
  }
}

/** 排位（ADR-0018 §2）：把待核销单排到选中空闲座（不核销，状态仍 pending）；成功后单离开「未排位客人」列表、进座位下栏。 */
async function doPreAssign() {
  if (!assignTarget.value || !selectedSeatId.value) return;
  assigning.value = true;
  try {
    await preAssignGzBeanSeat(assignTarget.value.id, selectedSeatId.value);
    ElMessage.success(t('gzBeanBoard.preAssignSuccess'));
    assignVisible.value = false;
    assignTarget.value = null;
    selectedSeatId.value = null;
    await loadBoard();
  } catch (e) {
    // 业务错误码（4002 座被占 / 4022 桌型不符 / 4023 关闭 等）已由拦截器 toast；重拉看板回正空闲座。
    console.error('[gz-bean-board] pre-assign failed', e);
    loadBoard();
  } finally {
    assigning.value = false;
  }
}

async function doAssignVerify() {
  if (!assignTarget.value || !selectedSeatId.value) return;
  assigning.value = true;
  try {
    await verifyGzBeanBookingWithSeat(assignTarget.value.id, selectedSeatId.value);
    ElMessage.success(t('gzBeanBoard.assignSuccess'));
    assignVisible.value = false;
    assignTarget.value = null;
    selectedSeatId.value = null;
    await loadBoard();
  } catch (e) {
    // ruoyi request 拦截器对业务错误码（4002 座被占 / 4021 未分座 / 4022 桌型不符 等 code≠200）
    // 已统一弹 ElNotification(后端 msg)，且 reject 值不含数字 code（仅 'error' 字符串）→ 此处不重复 toast。
    // 失败多因看板空闲座列表过时（座位被并桌改派 / 别店员先核销），重拉看板让空闲座列表回正。
    console.error('[gz-bean-board] assign-verify failed', e);
    loadBoard();
  } finally {
    assigning.value = false;
  }
}

async function doReassign() {
  if (!reassignTargetRow.value?.currentBookingId || !selectedSeatId.value) return;
  assigning.value = true;
  try {
    await reassignGzBeanSeat(reassignTargetRow.value.currentBookingId, selectedSeatId.value);
    ElMessage.success(t('gzBeanBoard.reassignSuccess'));
    assignVisible.value = false;
    reassignTargetRow.value = null;
    selectedSeatId.value = null;
    detailVisible.value = false;
    await loadBoard();
  } catch (e) {
    // 业务错误码（4017 已放座/非 used / 4022 桌型不符 / 4002 座被占）已由拦截器 toast；重拉看板回正空闲座。
    console.error('[gz-bean-board] reassign failed', e);
    loadBoard();
  } finally {
    assigning.value = false;
  }
}

// ============ 过期待处理 + 批量结单（GZ-BEAN-041） ============
const expiredCollapse = ref<string[]>([]);
const expiredRows = ref<GzBeanExpiredUnsettledVO[]>([]);
const expiredLoading = ref(false);
const settling = ref(false);
const selectedExpiredIds = ref<string[]>([]);

async function loadExpired() {
  if (currentStoreId.value == null) return;
  expiredLoading.value = true;
  try {
    const resp = await getGzBeanExpiredUnsettled(currentStoreId.value, sessDate.value);
    expiredRows.value = ((resp as any).data || []) as GzBeanExpiredUnsettledVO[];
    selectedExpiredIds.value = [];
  } catch (e) {
    console.error('[gz-bean-board] loadExpired failed', e);
    // 过期区失败不打断主看板
  } finally {
    expiredLoading.value = false;
  }
}

function onExpiredSelectionChange(sel: GzBeanExpiredUnsettledVO[]) {
  selectedExpiredIds.value = sel.map((r) => r.id);
}

function expiredStatusLabel(status: string): string {
  if (status === 'pending') return t('gzBeanBoard.expiredStatus.pending');
  if (status === 'no_show') return t('gzBeanBoard.expiredStatus.no_show');
  if (status === 'used') return t('gzBeanBoard.expiredStatus.used');
  return status;
}

function expiredStatusTagType(status: string): 'info' | 'warning' | 'danger' {
  if (status === 'no_show') return 'warning';
  if (status === 'used') return 'danger';
  return 'info';
}

/** expiredMinutes → 「已过期 N 分钟 / 小时」（> 60 显小时） */
function expiredLabel(min: number | null | undefined): string {
  if (min == null || min <= 0) return '-';
  if (min > 60) return t('gzBeanBoard.expiredHoursLabel', { n: Math.floor(min / 60) });
  return t('gzBeanBoard.expiredMinutesLabel', { n: min });
}

async function handleBatchSettle(action: GzBeanSettleAction) {
  if (selectedExpiredIds.value.length === 0) {
    ElMessage.warning(t('gzBeanBoard.batchSelectEmpty'));
    return;
  }
  const n = selectedExpiredIds.value.length;
  const confirmMsg =
    action === 'completed'
      ? t('gzBeanBoard.settleCompletedConfirm', { n })
      : action === 'no_show'
        ? t('gzBeanBoard.markNoShowConfirm', { n })
        : t('gzBeanBoard.markEndedConfirm', { n });
  try {
    await ElMessageBox.confirm(confirmMsg, t('gzBeanBoard.batchConfirm'), { type: 'warning' });
  } catch {
    return; // 取消
  }
  settling.value = true;
  try {
    const resp = await batchSettleGzBeanBookings(selectedExpiredIds.value, action);
    const result = (resp as any).data || resp;
    ElMessage.success(
      t('gzBeanBoard.batchResult', {
        succeeded: result.succeeded ?? 0,
        skipped: result.skipped ?? 0,
        failed: result.failed ?? 0
      })
    );
    await loadExpired();
    await loadBoard();
  } catch (e) {
    console.error('[gz-bean-board] batch settle failed', e);
    ElMessage.error(t('gzBeanBoard.batchFailed'));
  } finally {
    settling.value = false;
  }
}

// ============ 时钟 tick：每秒刷倒计时；每 30s 且开启自动刷新时重拉看板 ============
function startTick() {
  stopTick();
  tickTimer = setInterval(() => {
    now.value = Date.now();
    if (autoRefresh.value && currentStoreId.value != null && !listLoading.value && now.value - lastFetchAt >= 30000) {
      loadBoard();
    }
  }, 1000);
}

function stopTick() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

onMounted(() => {
  loadStoreOptions();
});

// 本页在 ruoyi tabsView 下被 keep-alive 缓存：必须仅在「激活（当前 tab）」时轮询，切走即停。
// 否则 startTick 的 setInterval 会在后台持续打 board/pending-assign/expired 三接口（切到别的 tab 也在跑），
// 接口异常时更会刷屏。onActivated 在首次挂载后也会触发一次，故 startTick 只放这里、不放 onMounted。
onActivated(() => {
  if (currentStoreId.value != null) loadBoard();
  startTick();
});

onDeactivated(() => {
  stopTick();
});

onBeforeUnmount(() => {
  stopTick();
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
/* ── 统计条 + 图例（c1 分层双栏格）── */
.board-metrics {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.board-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 92px;
  padding: 8px 14px;
  background: #fff;
  border: 1px solid #e3e8ef;
  border-radius: 8px;
}
.board-metric__num {
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  color: #1f2733;
  font-variant-numeric: tabular-nums;
}
.board-metric__lbl {
  font-size: 11px;
  color: #8792a3;
}
.board-metric.is-reserved .board-metric__num {
  color: #3b6ef5;
}
.board-metric.is-near_end .board-metric__num {
  color: #c47f12;
}
.board-metric.is-overtime .board-metric__num {
  color: #d3454b;
}
.board-legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 12px;
  color: #4b5666;
}
.board-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.board-legend__dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: #dfe4ec;
  display: inline-block;
}
.board-legend__dot.is-reserved {
  background: #3b6ef5;
}
.board-legend__dot.is-in_use {
  background: #1f9a63;
}
.board-legend__dot.is-near_end {
  background: #c47f12;
}
.board-legend__dot.is-overtime {
  background: #d3454b;
}
.board-legend__hint {
  margin-left: auto;
  color: #8792a3;
  font-size: 11.5px;
}
.board-clock {
  margin-left: auto;
  color: #606266;
  font-variant-numeric: tabular-nums;
}
.board-zones {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.board-zone__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-weight: 600;
}
.board-zone__zone {
  color: #303133;
}
.board-zone__type {
  color: #909399;
  font-weight: 400;
}
.board-seat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(212px, 1fr));
  gap: 12px;
}
.board-seat {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid #e3e8ef;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 2px rgba(20, 30, 50, 0.04);
  transition: box-shadow 0.15s;
}
.board-seat:hover {
  box-shadow: 0 4px 14px rgba(20, 30, 50, 0.1);
}
.board-seat.is-overtime {
  border-color: #f4c2c4;
  box-shadow: 0 0 0 1px #f4c2c4;
}
.board-seat__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid #eef1f6;
  background: #fcfdfe;
  cursor: pointer;
}
.board-seat__no {
  font-size: 14px;
  font-weight: 700;
  color: #1f2733;
  letter-spacing: 0.3px;
}
.board-seat__table {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 400;
  color: #8792a3;
}
.board-seat__pill {
  flex: none;
}
/* 备注：米黄便签高亮块 + 左侧琥珀竖条 + 「备注」角标；长文 3 行截断，hover 看全文 */
.board-seat__remark {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 7px 10px 7px 8px;
  border-left: 3px solid #f5a623;
  background: #fff7e0;
  color: #8a6410;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}
.board-seat__remark::before {
  content: '备注';
  flex: none;
  font-weight: 700;
  font-size: 10px;
  line-height: 16px;
  padding: 0 5px;
  border-radius: 3px;
  background: #f5a623;
  color: #fff;
}
.board-seat__remark-text {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
/* ── 分层双栏（上=在座 / 下=待核销）ADR-0018 §2 / c1 mockup ── */
.board-lane {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  min-height: 76px;
}
.board-lane + .board-lane {
  border-top: 1px dashed #e3e8ef;
}
/* 上栏底色随在座剩余时间：绿(在座)→黄(临近)→红(超时) */
.board-lane--top.is-use {
  background: #e9f7f0;
}
.board-lane--top.is-near {
  background: #fbf2df;
}
.board-lane--top.is-over {
  background: #fdecec;
}
/* 下栏：待核销恒蓝 / 空坍成极淡占位底 */
.board-lane--bottom.is-res {
  background: #eef3ff;
}
.board-lane--bottom.is-empty,
.board-lane--top.is-empty {
  background: #fafbfc;
}
/* 栏标签（在座 / 待核销）：绝对定位右上角小字，不与内容抢行 */
.board-lane__label {
  position: absolute;
  top: 7px;
  right: 10px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1px;
  color: #8792a3;
}
.board-lane__label.is-next {
  color: #3b6ef5;
}
.board-lane__more {
  margin-left: 4px;
  color: #8792a3;
  font-weight: 600;
}
.board-lane__body {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 44px;
}
/* 倒计时行：起时刻 + 大数字倒计时（绿/黄/红） */
.board-lane__cd-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.board-lane__start {
  font-size: 13px;
  font-weight: 600;
  color: #1f2733;
}
.board-lane__cd {
  font-size: 15px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.board-lane__cd.is-use {
  color: #1f9a63;
}
.board-lane__cd.is-near {
  color: #c47f12;
}
.board-lane__cd.is-over {
  color: #d3454b;
}
.board-lane__id {
  font-size: 11px;
  color: #8792a3;
}
.board-lane__chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.board-chip {
  font-size: 10px;
  line-height: 16px;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid transparent;
}
.board-chip.is-free {
  background: #f2ecff;
  color: #6b46c1;
  border-color: #ddd0f7;
}
.board-chip.is-cont {
  background: #e6f6ff;
  color: #0f7bb0;
  border-color: #bfe6f7;
}
/* 空栏占位文字（当前无人在座 / 暂无下一位 / 无排位） */
.board-lane__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 34px;
  color: #b3bcca;
  font-size: 12px;
  cursor: pointer;
}
/* 代客抽屉：占用座禁核销提示 + 核销模式「现在起」静态开始 */
.walkin-mode-hint {
  margin: -6px 0 8px 92px;
  color: #e6a23c;
  font-size: 12px;
  line-height: 1.4;
}
.walkin-now {
  color: #67c23a;
  font-weight: 600;
  font-size: 13px;
}
/* 动作行：主按钮撑满 + 次按钮自适应，横排贴各自栏底 */
.board-lane__acts {
  display: flex;
  gap: 6px;
  margin-top: auto;
  padding-top: 2px;
}
.board-lane__cta {
  flex: 1;
}
.board-lane__act {
  flex: 0 0 auto;
}
.board-lane__acts .el-button + .el-button {
  margin-left: 0;
}
/* ②待分座区 */
.pending-assign {
  border: 1px solid #fde2cf;
  background: #fffaf5;
  border-radius: 8px;
  padding: 12px;
}
.pending-assign__head {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}
.pending-assign__icon {
  color: #e6a23c;
}
.pending-assign__title {
  font-weight: 600;
  color: #303133;
}
.pending-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}
.pending-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  border: 1px solid #f3d19e;
  background: #fff;
  border-radius: 8px;
  padding: 10px 12px;
}
.pending-card.is-consecutive {
  border: 2px solid #f56c6c;
  background: #fef4f4;
  box-shadow: 0 0 0 2px rgba(245, 108, 108, 0.12);
}
.pending-card__badge {
  position: absolute;
  top: -10px;
  left: 10px;
}
.pending-card__actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 2px;
}
/* 卡内操作按钮全宽竖排（分配座位并核销 / 直接核销已处理），不再横向溢出卡片；
   去掉 Element 相邻按钮默认左间距（竖排下会把按钮顶偏），用 gap 控距。 */
.pending-card__actions .el-button + .el-button {
  margin-left: 0;
}
.pending-card__no {
  font-weight: 700;
  color: #303133;
  margin-bottom: 4px;
}
.pending-card__line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #606266;
  line-height: 1.6;
}
.pending-card__slot {
  font-variant-numeric: tabular-nums;
}
.pending-card__mobile {
  color: #909399;
}
.pending-card__daypass {
  margin-left: 6px;
  vertical-align: middle;
}
.pending-card__daypass-hint {
  color: var(--el-color-warning);
  font-weight: 600;
}
/* 过期待处理 panel */
.expired-panel {
  border: 1px solid #fde2e2;
  border-radius: 8px;
  padding: 0 12px;
  background: #fffafa;
}
.expired-panel__icon {
  color: #f56c6c;
  margin-right: 6px;
}
.expired-panel__title {
  font-weight: 600;
  color: #303133;
}
.expired-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
/* 分配座位弹窗 */
.assign-seat-label {
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.assign-seat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
}
.assign-seat {
  position: relative;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;
  text-align: center;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.assign-seat:hover {
  border-color: #c0c4cc;
}
.assign-seat.is-selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.assign-seat.is-suggested {
  border-color: #f56c6c;
}
.assign-seat.is-suggested.is-selected {
  background: #fef0f0;
}
.assign-seat__suggest {
  position: absolute;
  top: -8px;
  right: -4px;
  transform: scale(0.85);
}
.assign-seat__no {
  font-weight: 700;
  color: #303133;
}
.assign-seat__table {
  margin-left: 4px;
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}
.assign-seat__type {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}
/* 排位候选：被目标时段占用不可排的座（ADR-0018 §2 客户 7.07）——置灰 + 禁点 + 显「占用至 HH:mm」 */
.assign-seat.is-disabled {
  cursor: not-allowed;
  background: #f5f7fa;
  border-color: #ebeef5;
  opacity: 0.75;
}
.assign-seat.is-disabled:hover {
  border-color: #ebeef5;
}
.assign-seat.is-disabled .assign-seat__no {
  color: #c0c4cc;
}
.assign-seat__occupied {
  font-size: 11px;
  color: #e6a23c;
  margin-top: 4px;
  line-height: 1.2;
}
/* 状态底色 */
.board-seat.is-idle {
  background: #fafafa;
}
.board-seat.is-reserved {
  background: #ecf5ff;
  border-color: #b3d8ff;
}
.board-seat.is-in_use {
  background: #f0f9eb;
  border-color: #c2e7b0;
}
.board-seat.is-near_end {
  background: #fdf6ec;
  border-color: #f3d19e;
}
.board-seat.is-overtime {
  background: #fef0f0;
  border-color: #fbc4c4;
}
.board-detail-idle {
  color: #909399;
  font-size: 13px;
}
.board-actions {
  display: flex;
  gap: 10px;
}
.board-actions-hint {
  color: #909399;
  font-size: 12px;
}
.board-remark {
  border-top: 1px solid #ebeef5;
  padding-top: 12px;
}
.board-remark__label {
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.board-remark__actions {
  display: flex;
  justify-content: flex-end;
}
.board-remark__hint {
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
}
</style>
