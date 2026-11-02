/**
 * Tooltip 渲染：只从 calculateStats() 的结果渲染，保证"界面数字 = 实际生效数字"。
 *
 * 注意：Bunny Loader 的 tooltip 文案接口待确认（见 bunnyApi.js 的 TODO），
 * 这里只产出纯字符串数组，适配层怎么塞进游戏由适配层决定。
 */

/** 百分比格式化：0.0125 → "1.25%" */
export function pct(v) {
  return `${(Number(v) * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}

/**
 * @param {object} stats calculateStats() 的返回值
 * @param {object} [opts]
 * @param {string[]} [opts.nextBosses] 还没打的关键 Boss 中文名（可选，由调用方喂）
 * @returns {string[]} 逐行文本
 */
export function formatTooltip(stats, opts = {}) {
  if (!stats) return ['战士成长饰品：未装备'];
  const lines = [];
  const p = pct;
  lines.push('战士成长饰品');
  lines.push(`减伤 ${p(stats.damageReduction)}  防御 +${stats.defense}  伤害 +${p(stats.damageBonus)}`);

  if (stats.dodgeUnlocked) {
    const capped = stats.dodgeRaw > stats.dodgeChance + 1e-9;
    lines.push(`闪避 ${p(stats.dodgeChance)}${capped ? `（已封顶，原始 ${p(stats.dodgeRaw)}）` : ''}`);
  } else {
    lines.push('闪避：升级后解锁');
  }

  if (stats.lifesteal && stats.lifesteal.enabled) {
    lines.push(
      `吸血：命中回复实际伤害的 ${p(stats.lifesteal.percentOfActualDamage)}（冷却 ${stats.lifesteal.cooldownMs}ms）`
    );
  } else {
    lines.push('吸血：升级后解锁');
  }

  lines.push(`已击败 Boss：${stats.bossCount}`);
  if (stats.upgraded) lines.push('状态：已升级');
  else lines.push('状态：未升级（击败机械三王后可升级）');

  const next = (opts.nextBosses || []).slice(0, 3);
  if (next.length) lines.push(`下一目标：${next.join('、')}`);

  return lines;
}

export default formatTooltip;