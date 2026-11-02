/**
 * 属性计算：全部集中在 calculateStats(defeated, upgraded)。
 *
 * 纯函数：输入"已击败 Boss 集合 + 是否觉醒"，输出属性。
 * 不持有任何累加状态 —— 这正是"每个 Boss 只加一次、读档不叠加"的根本保证：
 * 属性永远是当前进度的一次性映射，而不是历史事件的累加结果。
 *
 * 去重规则：世界吞噬者 / 克苏鲁之脑共用 NPC.downedBoss2，
 * 因此按 `flag` 去重统计（同一个标记只算 1 个 Boss）。
 */

import { CONFIG } from './Config.js';

/** 保留 6 位小数，避免 0.01 + 0.04/3*2 这类浮点脏值 */
const r6 = (n) => Math.round(n * 1e6) / 1e6;

export const PILLAR_KEYS = CONFIG.genericGrowth.bosses
  .filter((b) => b.pillars === true)
  .map((b) => b.key);

export function bossName(key) {
  const b = CONFIG.genericGrowth.bosses.find((x) => x.key === key);
  return b ? b.name : key;
}

/** 按 flag 去重后，已击败的"独立 Boss 数量" */
export function countGenericBosses(defeated) {
  const g = CONFIG.genericGrowth;
  const flags = new Set();
  for (const boss of g.bosses) {
    if (boss.pillars === true && g.pillarsCountForGenericGrowth === false) continue;
    if (!defeated.has(boss.key)) continue;
    flags.add(boss.flag || boss.key);
  }
  return flags.size + (g.extraBossCount || 0);
}

/** 环境 Boss：按 flag 去重后命中的个数 */
function countEnvHits(defeated) {
  const env = CONFIG.environmentReduction;
  const flags = new Set();
  for (const key of env.bosses) {
    if (!defeated.has(key)) continue;
    const boss = CONFIG.genericGrowth.bosses.find((b) => b.key === key);
    flags.add(boss && boss.flag ? boss.flag : key);
  }
  return flags.size;
}

/**
 * @param {Set<string>} defeated 已击败 Boss 的 key 集合（readDefeated() 的返回值）
 * @param {boolean} upgraded 是否已装备"觉醒"版本
 */
export function calculateStats(defeated, upgraded) {
  const set = defeated instanceof Set ? defeated : new Set(defeated || []);
  const up = upgraded === true;
  const { base, genericGrowth: g, specialReduction: sp, dodge: d, upgrade: u, lifesteal: ls } = CONFIG;

  const bossCount = countGenericBosses(set);

  // ---------------- 减伤 ----------------
  const reduction = [];
  const push = (key, label, value, applied) => reduction.push({ key, label, value: r6(value), applied: !!applied });

  push('base', '基础属性', base.damageReduction, true);

  const envHit = countEnvHits(set);
  const envTotal = CONFIG.environmentReduction.bosses.length;
  const envValue =
    CONFIG.environmentReduction.mode === 'each'
      ? envHit * CONFIG.environmentReduction.each
      : envHit * (CONFIG.environmentReduction.total / envTotal);
  push('environment', `环境 Boss（${envHit}/${envTotal}）`, envValue, envHit > 0);

  push('plantera', '世纪之花', sp.plantera, set.has('plantera'));
  push('lunaticCultist', '拜月教徒', sp.lunaticCultist, set.has('lunaticCultist'));
  for (const [key, value] of Object.entries(sp.pillars)) {
    push(key, `${bossName(key)}（四柱）`, value, set.has(key));
  }
  push('moonLord', '月亮领主', sp.moonLord, set.has('moonLord'));
  push('upgraded', '升级后额外', sp.upgraded, up);

  const reductionRaw = r6(reduction.reduce((s, l) => s + (l.applied ? l.value : 0), 0));
  const damageReduction = Math.min(0.85, reductionRaw); // 防御性封顶，避免改配置改成无敌

  // ---------------- 防御 ----------------
  const defense =
    base.defense + bossCount * g.defensePerBoss + (up ? u.gains.defense : 0);

  // ---------------- 伤害 ----------------
  const damageBonus = r6(
    base.damageBonus + bossCount * g.damagePerBoss + (up ? u.gains.damageBonus : 0)
  );

  // ---------------- 闪避 ----------------
  const pillarHit = PILLAR_KEYS.filter((k) => set.has(k)).length;
  const dodgeRaw = up
    ? r6(
        d.baseAfterUpgrade +
          bossCount * g.dodgePerBoss +
          (set.has('plantera') ? d.plantera : 0) +
          pillarHit * d.perPillar +
          (PILLAR_KEYS.length > 0 && pillarHit === PILLAR_KEYS.length ? d.allPillarsBonus : 0)
      )
    : 0;
  const dodgeChance = up ? Math.min(d.hardCap, dodgeRaw) : 0;

  // ---------------- 吸血 ----------------
  const lifestealEnabled = ls.enabled === true && up;

  return {
    upgraded: up,
    bossCount,
    damageReduction,
    reductionRaw,
    defense,
    damageBonus,
    dodgeChance,
    dodgeRaw,
    lifesteal: {
      enabled: lifestealEnabled,
      percent: ls.percentOfActualDamage,
      cooldownMs: ls.cooldownMs,
      minHeal: ls.minHeal,
    },
    breakdown: { reduction },
  };
}

export default calculateStats;