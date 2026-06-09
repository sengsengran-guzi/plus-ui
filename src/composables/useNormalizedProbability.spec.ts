import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import {
  useNormalizedProbability,
  computeNormalizedPercent,
  isParticipating,
  type NormalizablePrize
} from './useNormalizedProbability';

/**
 * GZ-ADMIN-102 归一化 composable 单测（AC 11）。
 *
 * 口径：P(prize_i) = weight_i / Σ weight_j，j ∈ {enabled=1 AND stock_remain>0}
 * （doc/11 §7.2 + doc/10 §8.N3）。
 */
describe('useNormalizedProbability', () => {
  it('3 个全参与奖品归一化% 求和 = 100', () => {
    const prizes = ref<NormalizablePrize[]>([
      { weight: 1, stockRemain: 10, enabled: 1 },
      { weight: 3, stockRemain: 10, enabled: 1 },
      { weight: 6, stockRemain: 10, enabled: 1 }
    ]);
    const { summary, normalizedPercentOf } = useNormalizedProbability(prizes);

    expect(summary.value.weightSum).toBe(10);
    expect(summary.value.participatingCount).toBe(3);

    const pcts = prizes.value.map((p) => normalizedPercentOf(p));
    expect(pcts).toEqual([10, 30, 60]);
    expect(pcts.reduce((a, b) => a! + b!, 0)).toBe(100);
  });

  it('含 1 个 stock_remain=0 + 1 个 enabled=0 时该两项显示 —（null）且不计入基数', () => {
    const prizes = ref<NormalizablePrize[]>([
      { weight: 5, stockRemain: 10, enabled: 1 }, // 参与
      { weight: 5, stockRemain: 0, enabled: 1 }, // 库存空 → 不参与
      { weight: 5, stockRemain: 10, enabled: 0 }, // 停用 → 不参与
      { weight: 5, stockRemain: 10, enabled: 1 } // 参与
    ]);
    const { summary, normalizedPercentOf } = useNormalizedProbability(prizes);

    // 基数仅含 2 个参与项，Σweight=10
    expect(summary.value.weightSum).toBe(10);
    expect(summary.value.participatingCount).toBe(2);

    const pcts = prizes.value.map((p) => normalizedPercentOf(p));
    expect(pcts[0]).toBe(50); // 参与
    expect(pcts[1]).toBeNull(); // stock_remain=0
    expect(pcts[2]).toBeNull(); // enabled=0
    expect(pcts[3]).toBe(50); // 参与
    // 两个参与项归一化%求和 = 100
    expect(pcts[0]! + pcts[3]!).toBe(100);
  });

  it('weight=0 的奖品不参与归一化（避免 0 权重稀释）', () => {
    const prizes = ref<NormalizablePrize[]>([
      { weight: 0, stockRemain: 10, enabled: 1 },
      { weight: 10, stockRemain: 10, enabled: 1 }
    ]);
    const { summary, normalizedPercentOf } = useNormalizedProbability(prizes);
    expect(summary.value.weightSum).toBe(10);
    expect(summary.value.participatingCount).toBe(1);
    expect(normalizedPercentOf(prizes.value[0])).toBeNull();
    expect(normalizedPercentOf(prizes.value[1])).toBe(100);
  });

  it('全部不参与时基数 = 0，所有行显示 —（null）', () => {
    const prizes = ref<NormalizablePrize[]>([
      { weight: 5, stockRemain: 0, enabled: 1 },
      { weight: 5, stockRemain: 10, enabled: 0 }
    ]);
    const { summary, normalizedPercentOf } = useNormalizedProbability(prizes);
    expect(summary.value.weightSum).toBe(0);
    expect(summary.value.participatingCount).toBe(0);
    expect(normalizedPercentOf(prizes.value[0])).toBeNull();
    expect(normalizedPercentOf(prizes.value[1])).toBeNull();
  });

  it('保留 2 位小数（1/3 → 33.33）', () => {
    const prizes = ref<NormalizablePrize[]>([
      { weight: 1, stockRemain: 10, enabled: 1 },
      { weight: 1, stockRemain: 10, enabled: 1 },
      { weight: 1, stockRemain: 10, enabled: 1 }
    ]);
    const { normalizedPercentOf } = useNormalizedProbability(prizes);
    expect(normalizedPercentOf(prizes.value[0])).toBe(33.33);
  });

  it('reactive：改 weight 后归一化% 即时刷新', () => {
    const prizes = ref<NormalizablePrize[]>([
      { weight: 1, stockRemain: 10, enabled: 1 },
      { weight: 1, stockRemain: 10, enabled: 1 }
    ]);
    const { summary } = useNormalizedProbability(prizes);
    expect(summary.value.weightSum).toBe(2);
    prizes.value[0].weight = 9;
    expect(summary.value.weightSum).toBe(10);
  });

  it('纯函数 isParticipating / computeNormalizedPercent 边界', () => {
    expect(isParticipating({ weight: 1, stockRemain: 1, enabled: 1 })).toBe(true);
    expect(isParticipating({ weight: 1, stockRemain: 0, enabled: 1 })).toBe(false);
    expect(isParticipating({ weight: 1, stockRemain: 1, enabled: 0 })).toBe(false);
    expect(isParticipating({ weight: 0, stockRemain: 1, enabled: 1 })).toBe(false);
    expect(isParticipating({})).toBe(false);
    // weightSum<=0 → null
    expect(computeNormalizedPercent({ weight: 5, stockRemain: 1, enabled: 1 }, 0)).toBeNull();
    expect(computeNormalizedPercent({ weight: 5, stockRemain: 1, enabled: 1 }, 20)).toBe(25);
  });
});
