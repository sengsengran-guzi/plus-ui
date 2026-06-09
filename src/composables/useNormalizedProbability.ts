import { computed, unref, type MaybeRefOrGetter, type ComputedRef } from 'vue';

/**
 * GZ-ADMIN-102 奖品池权重 → 归一化后概率（%）reactive 计算。
 *
 * 口径锚定 doc/11 §7.2 计算框 + doc/10 §8.N3：
 *   P(prize_i) = weight_i / Σ weight_j，j ∈ {enabled=1 AND stock_remain>0}
 * 与 GACHA-103 运行时抽奖归一化同口径——归一化基数**仅统计可参与抽奖的奖品**
 * （enabled=1 且 有剩余库存），运营所见即抽奖所得。
 *
 * 设计要点（ticket §关键技术决策 D1/D2）：
 *   - 前端 reactive 计算，运营改 weight 即时刷新，无需后端往返；后端只存 raw weight。
 *   - 不参与项（enabled=0 或 stock_remain=0）归一化%返回 null（UI 显 `—`），且不计入 Σ 基数。
 *   - 浮点展示保留 2 位小数（ticket §风险 R3：展示值，最终判定以 GACHA-103 抽奖事务为准）。
 */

/** 参与归一化计算所需的奖品最小形状（与 GzGachaPrizeVO 子集对齐）。 */
export interface NormalizablePrize {
  /** 概率权重整数（≥0） */
  weight?: number | null;
  /** 剩余库存 */
  stockRemain?: number | null;
  /** 0 临时下架（不参与）/ 1 参与抽奖 */
  enabled?: number | null;
}

/** 单台机器奖品池归一化汇总。 */
export interface NormalizationSummary {
  /** 参与归一化的奖品权重之和（enabled=1 且 stock_remain>0） */
  weightSum: number;
  /** 参与归一化的奖品数 */
  participatingCount: number;
}

/**
 * 判定一个奖品是否参与归一化（可参与抽奖）。
 * enabled === 1 且 stock_remain > 0 且 weight > 0。
 */
export function isParticipating(prize: NormalizablePrize): boolean {
  const weight = prize.weight ?? 0;
  const stockRemain = prize.stockRemain ?? 0;
  const enabled = prize.enabled ?? 0;
  return enabled === 1 && stockRemain > 0 && weight > 0;
}

/**
 * 计算单个奖品的归一化后概率（%），不参与则返回 null。
 *
 * @param prize     当前奖品
 * @param weightSum 归一化基数（仅含参与奖品权重之和）
 * @returns 百分比数值（保留 2 位小数）或 null（不参与 / 基数为 0）
 */
export function computeNormalizedPercent(prize: NormalizablePrize, weightSum: number): number | null {
  if (!isParticipating(prize) || weightSum <= 0) {
    return null;
  }
  const weight = prize.weight ?? 0;
  const percent = (weight / weightSum) * 100;
  // 保留 2 位小数（展示值）
  return Math.round(percent * 100) / 100;
}

/**
 * reactive 归一化 composable。
 *
 * @param prizes 奖品列表（ref / getter / 普通数组皆可）
 * @returns
 *   - summary: { weightSum, participatingCount } 归一化基数（底部展示用，AC 7）
 *   - normalizedPercentOf(prize): 单行归一化%（null = 不参与，UI 显 `—`）
 */
export function useNormalizedProbability<T extends NormalizablePrize>(prizes: MaybeRefOrGetter<T[]>) {
  const list: ComputedRef<T[]> = computed(() => {
    const v = typeof prizes === 'function' ? (prizes as () => T[])() : unref(prizes);
    return v ?? [];
  });

  const summary: ComputedRef<NormalizationSummary> = computed(() => {
    let weightSum = 0;
    let participatingCount = 0;
    for (const p of list.value) {
      if (isParticipating(p)) {
        weightSum += p.weight ?? 0;
        participatingCount += 1;
      }
    }
    return { weightSum, participatingCount };
  });

  /** 单行归一化%（null = 不参与）。 */
  function normalizedPercentOf(prize: NormalizablePrize): number | null {
    return computeNormalizedPercent(prize, summary.value.weightSum);
  }

  return { summary, normalizedPercentOf };
}
