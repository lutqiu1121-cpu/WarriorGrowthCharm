/**
 * 属性计算：全部集中到 calculateStats(player)（第二参数 ctx 可选）。
 *
 * 设计要点：
 *  - 本函数是"纯函数"：只看"已击败 Boss 集合 + 是否已升级"，不持有任何累加状态。
 *    所以同一个 Boss 被打多少次、什么时候读档，结果都一样 —— 天然不会重复叠加。
 *  - 数值全部来自 config.js，本文件只做"按表加总 + 封顶"。
 *  - 返回对象里带 breakdown（逐项拆解），README 的满级汇总表和游戏内 tooltip
 *    都从它渲染，保证"文档数字 = 运行时数字"。
 */

import { CONFIG } from './config.js';

/** 取整到 1e-6，避免 0.01+0.04/3*3 = 0.04000000000000001 这种浮点脏值 */
const r6 = (n) => Math.round(n * 1e6) / 1e6;

/** 四柱的 key 列表（从配置推导，不写死） */
export const PILLAR_KEYS = CONFIG.genericGrowth.bosses
  .filter((b) => b.pillars === true)
  .map((b) => b.key);

/** Boss key → 中文名（tooltip / 日志用） */
export function bossName(key) {
  const found = CONFIG.genericGrowth.bosses.find((b) => b.key === key);
  return found ? found.name : key;
}

/**
 * 通用成长计数的 Boss 数量。
 * 注意：四柱是否计入由 config.genericGrowth.pillarsCountForGenericGrowth 决定，
 * 计入时"每根柱子各算 1 个"。
 */
export function countGenericBosses(defeated) {
  const g = CONFIG.genericGrowth;
  let n = 0;
  for (const boss of g.bosses) {
    if (boss.pillars === true && g.pillarsCountForGenericGrowth === false) continue;
    if (defeated.has(boss.key)) n += 1;
  }
  return n + (g.extraBossCount || 0);
}

/** 已击败的 key 里命中 keys 的个数 */
function countHit(defeated, keys) {
  let n = 0;
  for (const k of keys) if (defeated.has(k)) n += 1;
  return n;
}

/** 环境 Boss 减伤：按配置的 mode 计算 */
function environmentReduction(defeated) {
  const env = CONFIG.environmentReduction;
  const hit = countHit(defeated, env.bosses);
  if (hit === 0) return { hit, value: 0 };
  if (env.mode === 'each') {
    // 每个 +each
    return { hit, value: r6(hit * env.each) };
  }
  // 'total'：三个合计 total，按"已击败个数 / 总数"线性分摊
  const per = env.total / env.bosses.length;
  return { hit, value: r6(hit * per) };
}

/**
 * 计算饰品当前提供的全部属性。
 *
 * @param {object} player 玩家对象（本函数不直接读它，交给 ctx 提供数据；保留该参数是为了调用签名固定）
 * @param {object} [ctx]
 * @param {Set<string>|string[]} [ctx.defeatedBosses] 已击败 Boss 的 key 集合
 * @param {boolean} [ctx.upgraded] 是否已完成升级
 * @returns {object} stats
 */
export function calculateStats(player, ctx = {}) {
  const defeated =
    ctx.defeatedBosses instanceof Set
      ? ctx.defeatedBosses
      : new Set(ctx.defeatedBosses || []);
  const upgraded = ctx.upgraded === true;

  const { base, genericGrowth: g, specialReduction: sp, dodge: d, upgrade: up, lifesteal: ls } =
    CONFIG;

  const bossCount = countGenericBosses(defeated);

  // ---------------- 减伤：逐项累加，带"是否生效"标记 ----------------
  const reductionLines = [];

  const pushReduction = (key, label, value, applied, note) => {
    reductionLines.push({ key, label, value: r6(applied ? value : 0), potential: r6(value), applied, note });
  };

  pushReduction('base', '基础属性', base.damageReduction, true);

  const env = environmentReduction(defeated);
  pushReduction(
    'environment',
    `环境 Boss（${env.hit}/${CONFIG.environmentReduction.bosses.length}）`,
    env.value,
    env.hit > 0,
    CONFIG.environmentReduction.mode === 'each' ? '每个 +4% 模式' : '三只合计 +4% 模式'
  );

  // 特殊减伤：世纪之花、拜月教徒、四柱、月亮领主
  const specials = [
    { key: 'plantera', label: '世纪之花', value: sp.plantera },
    { key: 'lunaticCultist', label: '拜月教徒', value: sp.lunaticCultist },
  ];
  for (const [key, value] of Object.entries(sp.pillars)) {
    specials.push({ key, label: `${bossName(key)}（四柱）`, value });
  }
  specials.push({ key: 'moonLord', label: '月亮领主', value: sp.moonLord });

  for (const s of specials) {
    const applied = defeated.has(s.key);
    pushReduction(s.key, s.label, s.value, applied);
  }

  pushReduction('upgraded', '升级后额外', sp.upgraded, upgraded, upgraded ? '' : '未升级');

  const reductionRaw = r6(reductionLines.reduce((sum, l) => sum + l.value, 0));
  // 防御性封顶：避免以后调配置调到 >100% 变成无敌
  const reductionCap = 0.85;
  const damageReduction = Math.min(reductionCap, reductionRaw);

  // ---------------- 防御 ----------------
  const defenseLines = [
    { key: 'base', label: '基础属性', value: base.defense, applied: true },
    {
      key: 'genericBosses',
      label: `通用 Boss × ${bossCount}（每个 +${g.defensePerBoss}）`,
      value: bossCount * g.defensePerBoss,
      applied: bossCount > 0,
    },
    { key: 'upgraded', label: '升级后额外', value: up.gains.defense, applied: upgraded },
  ];
  // 只加 applied 的行（未升级时“升级后额外”那行不算）
  const defense = Math.round(defenseLines.reduce((sum, l) => sum + (l.applied ? l.value : 0), 0));

  // ---------------- 伤害 ----------------
  const damageLines = [
    { key: 'base', label: '基础属性', value: base.damageBonus, applied: true },
    {
      key: 'genericBosses',
      label: `通用 Boss × ${bossCount}（每个 +1%）`,
      value: bossCount * g.damagePerBoss,
      applied: bossCount > 0,
    },
    { key: 'upgraded', label: '升级后额外', value: up.gains.damageBonus, applied: upgraded },
  ];
  const damageBonus = r6(damageLines.reduce((sum, l) => sum + (l.applied ? l.value : 0), 0));

  // ---------------- 闪避（升级后解锁，硬上限 12%）----------------
  const dodgeUnlocked = d.unlockAfterUpgrade === false || upgraded;
  const pillarHit = countHit(defeated, PILLAR_KEYS);
  const dodgeLines = [
    { key: 'base', label: '解锁基础', value: d.baseAfterUpgrade, applied: dodgeUnlocked },
    {
      key: 'genericBosses',
      label: `通用 Boss × ${bossCount}（每个 +0.5%）`,
      value: r6(bossCount * g.dodgePerBoss),
      applied: dodgeUnlocked && bossCount > 0,
    },
    { key: 'plantera', label: '世纪之花', value: d.plantera, applied: dodgeUnlocked && defeated.has('plantera') },
  ];
  for (const key of PILLAR_KEYS) {
    dodgeLines.push({
      key,
      label: `${bossName(key)}（四柱）`,
      value: d.perPillar,
      applied: dodgeUnlocked && defeated.has(key),
    });
  }
  dodgeLines.push({
    key: 'allPillars',
    label: '四柱全部打完',
    value: d.allPillarsBonus,
    applied: dodgeUnlocked && PILLAR_KEYS.length > 0 && pillarHit === PILLAR_KEYS.length,
  });

  const dodgeRaw = r6(dodgeLines.reduce((sum, l) => sum + (l.applied ? l.value : 0), 0));
  // 硬上限 12%：就是 Math.min(0.12, ...)，0.12 来自 config.dodge.hardCap
  const dodgeChance = dodgeUnlocked ? Math.min(d.hardCap, dodgeRaw) : 0;

  // ---------------- 吸血 ----------------
  const lifestealEnabled = ls.enabled === true && (ls.unlockAfterUpgrade === false || upgraded);
  const lifesteal = {
    enabled: lifestealEnabled,
    percentOfActualDamage: ls.percentOfActualDamage,
    cooldownMs: ls.cooldownMs,
    minHeal: ls.minHeal,
    requirePositiveDamage: ls.requirePositiveDamage,
  };

  return {
    player,
    upgraded,
    bossCount,
    pillarHit,
    defeatedBosses: [...defeated],
    damageReduction,
    damageReductionRaw: reductionRaw,
    reductionCap,
    defense,
    damageBonus,
    dodgeChance,
    dodgeRaw,
    dodgeUnlocked,
    lifesteal,
    breakdown: {
      reduction: reductionLines,
      defense: defenseLines,
      damage: damageLines,
      dodge: dodgeLines,
    },
  };
}

/** 属性指纹：值没变就不重复撤销/施加（省性能，也避免高频事件抖动） */
export function statsSignature(stats) {
  if (!stats) return '';
  return [
    stats.upgraded ? 1 : 0,
    stats.bossCount,
    stats.damageReduction,
    stats.defense,
    stats.damageBonus,
    stats.dodgeChance,
  ].join('|');
}

export default calculateStats;