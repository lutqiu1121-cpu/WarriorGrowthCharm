#!/usr/bin/env node
/**
 * 离线自测：node scripts/verify.mjs
 * 只测纯逻辑（Stats），不需要游戏、不需要加载器。
 */

import assert from 'node:assert/strict';
import { CONFIG } from '../content/Common/Config.js';
import { calculateStats } from '../content/Common/Stats.js';

let pass = 0;
const out = [];
function check(name, fn) {
  try {
    fn();
    pass += 1;
    out.push('✅ ' + name);
  } catch (e) {
    process.exitCode = 1;
    out.push('❌ ' + name + '\n   ' + (e && e.message ? e.message : e));
  }
}
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const ALL = CONFIG.genericGrowth.bosses.map((b) => b.key);

check('基础属性：1% 减伤 / 4 防御 / 4% 伤害，未觉醒无闪避无吸血', () => {
  const s = calculateStats(new Set(), false);
  assert.ok(near(s.damageReduction, 0.01));
  assert.equal(s.defense, 4);
  assert.ok(near(s.damageBonus, 0.04));
  assert.equal(s.dodgeChance, 0);
  assert.equal(s.lifesteal.enabled, false);
});

check('每击败一个 Boss：+1 防御 / +1% 伤害', () => {
  const s = calculateStats(new Set(['plantera']), false);
  assert.equal(s.defense, 5);
  assert.ok(near(s.damageBonus, 0.05));
});

check('世界吞噬者与克苏鲁之脑共用 downedBoss2：只算 1 个', () => {
  const a = calculateStats(new Set(['eaterOfWorlds']), false);
  const b = calculateStats(new Set(['eaterOfWorlds', 'brainOfCthulhu']), false);
  assert.equal(a.bossCount, 1);
  assert.equal(b.bossCount, 1, '共用标记不能算成 2 个');
  assert.equal(b.defense, a.defense);
});

check('四柱各算 1 个通用 Boss', () => {
  const s = calculateStats(new Set(['pillarSolar', 'pillarVortex']), false);
  assert.equal(s.bossCount, 2);
  assert.equal(s.defense, 6);
});

check('pillarsCountForGenericGrowth=false 时四柱不计入通用成长', () => {
  const old = CONFIG.genericGrowth.pillarsCountForGenericGrowth;
  CONFIG.genericGrowth.pillarsCountForGenericGrowth = false;
  try {
    const s = calculateStats(new Set(['pillarSolar', 'pillarVortex']), false);
    assert.equal(s.bossCount, 0);
    assert.equal(s.defense, 4);
    // 但特殊减伤仍然生效
    assert.ok(near(s.damageReduction, 0.01 + 2 * 0.025));
  } finally {
    CONFIG.genericGrowth.pillarsCountForGenericGrowth = old;
  }
});

check('环境 Boss 按标记均分：2/3 × 4% ≈ 2.67%', () => {
  const s = calculateStats(new Set(['eaterOfWorlds', 'wallOfFlesh']), false);
  assert.ok(near(s.damageReduction, 0.01 + (2 / 3) * 0.04, 1e-6), 'reduction=' + s.damageReduction);
});

check('月亮领主：+10% 减伤', () => {
  const before = calculateStats(new Set(['plantera']), false).damageReduction;
  const after = calculateStats(new Set(['plantera', 'moonLord']), false).damageReduction;
  assert.ok(near(after - before, 0.1));
});

check('升级（觉醒）：+2% 减伤 / +5% 伤害 / +5 防御，解锁闪避与吸血', () => {
  const base = calculateStats(new Set(ALL), false);
  const up = calculateStats(new Set(ALL), true);
  assert.ok(near(up.damageReduction - base.damageReduction, 0.02));
  assert.ok(near(up.damageBonus - base.damageBonus, 0.05));
  assert.equal(up.defense - base.defense, 5);
  assert.ok(up.dodgeChance > 0);
  assert.equal(up.lifesteal.enabled, true);
});

check('满级：35.67% 减伤 / 21 防御 / 21% 伤害 / 闪避封顶 12%', () => {
  const s = calculateStats(new Set(ALL), true);
  assert.equal(s.bossCount, 12);
  assert.ok(near(s.damageReduction, 0.356667, 1e-6), 'reduction=' + s.damageReduction);
  assert.equal(s.defense, 21);
  assert.ok(near(s.damageBonus, 0.21, 1e-9));
  assert.ok(near(s.dodgeRaw, 0.17, 1e-9), 'dodgeRaw=' + s.dodgeRaw);
  assert.equal(s.dodgeChance, 0.12);
});

check('四柱全清额外 +1% 闪避（第 4 根增量为 2.5%）', () => {
  const three = calculateStats(
    new Set(['destroyer', 'twins', 'skeletronPrime', 'pillarSolar', 'pillarVortex', 'pillarNebula']),
    true
  ).dodgeRaw;
  const four = calculateStats(
    new Set(['destroyer', 'twins', 'skeletronPrime', 'pillarSolar', 'pillarVortex', 'pillarNebula', 'pillarStardust']),
    true
  ).dodgeRaw;
  assert.ok(near(four - three, 0.025), 'delta=' + (four - three));
});

check('减伤有防御性封顶（不会超过 85%）', () => {
  const s = calculateStats(new Set(ALL), true);
  assert.ok(s.damageReduction <= 0.85);
});

console.log(out.join('\n'));
console.log(`\n${pass} 项通过，${out.length - pass} 项失败`);
