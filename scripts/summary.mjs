#!/usr/bin/env node
/**
 * 打印满级数值汇总表（Markdown），README 里的表就是它生成的。
 * 用法：node scripts/summary.mjs
 */

import { readFileSync } from 'node:fs';
import { CONFIG } from '../content/Common/Config.js';
import { calculateStats } from '../content/Common/Stats.js';

const pct = (v) => `${(v * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
const allKeys = CONFIG.genericGrowth.bosses.map((b) => b.key);
const stats = calculateStats(new Set(allKeys), true);

const lines = [];
lines.push(`独立 Boss 标记数：${stats.bossCount}（条目 ${allKeys.length}，去重后按真实标记算）`);
lines.push('');
lines.push('| 减伤来源 | 数值 | 生效 |');
lines.push('| --- | --- | --- |');
for (const l of stats.breakdown.reduction) {
  lines.push(`| ${l.label} | ${pct(l.value)} | ${l.applied ? '✅' : '—'} |`);
}
lines.push(`| **合计** | **${pct(stats.damageReduction)}** | |`);
lines.push('');
lines.push(
  `防御：+${stats.defense}｜伤害：+${pct(stats.damageBonus)}｜闪避：原始 ${pct(stats.dodgeRaw)} → 封顶 ${pct(stats.dodgeChance)}`
);
lines.push(`吸血：实际伤害 ${pct(stats.lifesteal.percent)}，冷却 ${stats.lifesteal.cooldownMs}ms`);

try {
  const m = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  lines.push('');
  lines.push(`manifest: ${m.id} ${m.version}（blVersion ${m.blVersion}, entry ${m.entry}）`);
} catch (e) {
  lines.push('manifest 读取失败：' + e.message);
}

console.log(lines.join('\n'));
