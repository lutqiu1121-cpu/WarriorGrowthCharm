#!/usr/bin/env node
/**
 * 打印"满级数值汇总表"（Markdown）。
 *
 * 用法：node scripts/summary.mjs
 *
 * README 里的汇总表就是用这个脚本的输出贴进去的 —— 以后改 config.js 的数值，
 * 重跑一次再把表贴回去，文档和代码就不会对不上。
 */

import { CONFIG } from '../src/config.js';
import { calculateStats } from '../src/stats.js';
import { pct } from '../src/tooltip.js';

const allKeys = CONFIG.genericGrowth.bosses.map((b) => b.key);

// 满级 = 全部 Boss 击败 + 已升级 + 四柱计入通用成长（默认配置）
const stats = calculateStats(null, { defeatedBosses: new Set(allKeys), upgraded: true });

const lines = [];
lines.push(`bossCount: ${stats.bossCount}（四柱计入通用成长：${CONFIG.genericGrowth.pillarsCountForGenericGrowth}）`);
lines.push('');
lines.push('### 减伤');
lines.push('| 来源 | 数值 | 满级生效 |');
lines.push('| --- | --- | --- |');
for (const l of stats.breakdown.reduction) {
  lines.push(`| ${l.label} | ${pct(l.applied ? l.value : l.potential)} | ${l.applied ? '✅' : '—'} |`);
}
lines.push(`| **合计** | **${pct(stats.damageReduction)}** | 目标 40%，差 ${pct(0.4 - stats.damageReduction)} |`);
lines.push('');
lines.push('### 防御');
lines.push('| 来源 | 数值 | 满级生效 |');
lines.push('| --- | --- | --- |');
for (const l of stats.breakdown.defense) {
  lines.push(`| ${l.label} | +${l.value} | ${l.applied ? '✅' : '—'} |`);
}
lines.push(`| **合计** | **+${stats.defense}** | |`);
lines.push('');
lines.push('### 伤害');
lines.push('| 来源 | 数值 | 满级生效 |');
lines.push('| --- | --- | --- |');
for (const l of stats.breakdown.damage) {
  lines.push(`| ${l.label} | +${pct(l.value)} | ${l.applied ? '✅' : '—'} |`);
}
lines.push(`| **合计** | **+${pct(stats.damageBonus)}** | |`);
lines.push('');
lines.push('### 闪避（硬上限 12%）');
lines.push('| 来源 | 数值 | 满级生效 |');
lines.push('| --- | --- | --- |');
for (const l of stats.breakdown.dodge) {
  lines.push(`| ${l.label} | +${pct(l.value)} | ${l.applied ? '✅' : '—'} |`);
}
lines.push(
  `| **合计（封顶前）** | **+${pct(stats.dodgeRaw)}** | 封顶后 ${pct(stats.dodgeChance)}${stats.dodgeRaw > stats.dodgeChance ? '（被 12% 截断）' : ''} |`
);
lines.push('');
lines.push('### 吸血');
lines.push(
  `实际伤害的 ${pct(stats.lifesteal.percentOfActualDamage)}，冷却 ${stats.lifesteal.cooldownMs}ms，最少 ${stats.lifesteal.minHeal} 点`
);

// eslint-disable-next-line no-console
console.log(lines.join('\n'));