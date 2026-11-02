#!/usr/bin/env node
/**
 * 离线自测（不需要游戏）：node scripts/verify.mjs
 *
 * 用 src/adapters/mockApi.js 的假世界跑完整流程，覆盖 README 测试清单里
 * 可以自动化的那几条。真机清单（装载、贴图、读档、升级界面）仍需手动测。
 */

import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { install, tryUpgrade, uninstall } from '../src/main.js';
import { calculateStats } from '../src/stats.js';
import { createMockWorld } from '../src/adapters/mockApi.js';
import { LifestealController } from '../src/runtime.js';

let passed = 0;
const results = [];
function check(name, fn) {
  try {
    fn();
    passed += 1;
    results.push(`✅ ${name}`);
  } catch (err) {
    results.push(`❌ ${name}\n   ${err && err.message ? err.message : err}`);
    process.exitCode = 1;
  }
}

const ALL_KEYS = CONFIG.genericGrowth.bosses.map((b) => b.key);
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ---------------------------------------------------------------------------
// 1. 基础属性 + 装备施加
// ---------------------------------------------------------------------------
{
  const world = createMockWorld();
  const h = install(null, world.bindings);
  world.equip();
  const t = world.totals();

  check('基础属性：1% 减伤 / 4 防御 / 4% 伤害', () => {
    assert.ok(near(t.damageReduction, 0.01), `减伤=${t.damageReduction}`);
    assert.equal(t.defense, 4);
    assert.ok(near(t.damageBonus, 0.04), `伤害=${t.damageBonus}`);
  });

  check('未升级：闪避不生效、吸血未解锁', () => {
    const s = h.getStats();
    assert.equal(s.dodgeChance, 0);
    assert.equal(s.lifesteal.enabled, false);
  });

  check('重复 refresh 不会叠加（撤销→重放而不是累加）', () => {
    for (let i = 0; i < 5; i += 1) h.refresh();
    const again = world.totals();
    assert.equal(again.defense, 4);
    assert.ok(near(again.damageBonus, 0.04));
    assert.ok(near(again.damageReduction, 0.01));
  });

  check('卸载饰品：加成全部撤销', () => {
    world.unequip();
    const after = world.totals();
    assert.equal(after.defense, 0);
    assert.equal(after.damageReduction, 0);
    assert.equal(after.damageBonus, 0);
  });

  uninstall();
}

// ---------------------------------------------------------------------------
// 2. 每个 Boss 只加一次（同一个 Boss 反复触发事件也只加一次）
// ---------------------------------------------------------------------------
{
  const world = createMockWorld();
  install(null, world.bindings);
  world.equip();

  check('每击败一个 Boss：+1 防御 / +1% 伤害', () => {
    world.defeat('eaterOfWorlds');
    let t = world.totals();
    assert.equal(t.defense, 5);
    assert.ok(near(t.damageBonus, 0.05));

    world.defeat('brainOfCthulhu');
    t = world.totals();
    assert.equal(t.defense, 6);
    assert.ok(near(t.damageBonus, 0.06));
  });

  check('同一个 Boss 再触发第二次：属性不变（只结算一次）', () => {
    world.defeat('eaterOfWorlds'); // 已经击败过，再发一次事件
    world.defeat('eaterOfWorlds');
    const t = world.totals();
    assert.equal(t.defense, 6);
    assert.ok(near(t.damageBonus, 0.06));
  });

  check('四柱各算 1 个通用 Boss（pillarsCountForGenericGrowth=true）', () => {
    world.defeat('pillarSolar');
    world.defeat('pillarVortex');
    const t = world.totals();
    // 2 个环境之外：6 → 8
    assert.equal(t.defense, 8);
  });

  uninstall();
}

// ---------------------------------------------------------------------------
// 3. 满级数值 + 闪避封顶 + 月总减伤
// ---------------------------------------------------------------------------
{
  const world = createMockWorld();
  const h = install(null, world.bindings);
  world.equip();

  // 先打掉除月亮领主外的全部 Boss（12 个），再升级
  for (const key of ALL_KEYS) if (key !== 'moonLord') world.defeat(key);
  const beforeUpgrade = h.getStats();
  const upgraded = tryUpgrade();
  const beforeMoonLord = h.getStats();

  check('升级前减伤 = 1% + 4%(环境) + 5%(世纪之花) + 5%(拜月教徒) + 10%(四柱) = 25%', () => {
    assert.ok(beforeUpgrade, 'stats 为空');
    assert.ok(near(beforeUpgrade.damageReduction, 0.25), `升级前=${beforeUpgrade.damageReduction}`);
  });

  check('升级后额外 +2% 减伤（25% → 27%）', () => {
    assert.equal(upgraded.ok, true, JSON.stringify(upgraded));
    assert.ok(near(beforeMoonLord.damageReduction, 0.27), `升级后=${beforeMoonLord.damageReduction}`);
  });

  check('月亮领主：单独 +10% 减伤（27% → 37%）', () => {
    world.defeat('moonLord');
    const after = h.getStats();
    assert.ok(near(after.damageReduction - beforeMoonLord.damageReduction, 0.1));
    assert.ok(near(after.damageReduction, 0.37), `满级减伤=${after.damageReduction}`);
  });

  check('满级防御 = 4 + 13 + 5 = 22；伤害 = 4% + 13% + 5% = 22%', () => {
    const s = h.getStats();
    assert.equal(s.bossCount, 13);
    assert.equal(s.defense, 22);
    assert.ok(near(s.damageBonus, 0.22), `伤害=${s.damageBonus}`);
    assert.ok(near(s.damageReduction, 0.37));
  });

  check('闪避封顶 12%（原始 17.5% 被 Math.min(0.12, ...) 截断）', () => {
    const s = h.getStats();
    assert.ok(near(s.dodgeRaw, 0.175), `raw=${s.dodgeRaw}`);
    assert.ok(near(s.dodgeChance, 0.12), `dodge=${s.dodgeChance}`);
  });

  check('闪避命中则取消本次伤害', () => {
    h.api.setRandom(() => 0); // 必定闪避
    const res = world.hurt(50);
    assert.equal(res.cancelled, true);
    assert.equal(res.damage, 0);

    h.api.setRandom(() => 0.999); // 必定不闪避
    const res2 = world.hurt(50);
    assert.equal(res2.cancelled, false);
    assert.equal(res2.damage, 50);
  });

  uninstall();
}

// ---------------------------------------------------------------------------
// 4. 四柱额外 +1% 闪避（只有四根全打完才给）
// ---------------------------------------------------------------------------
{
  const world = createMockWorld();
  const h = install(null, world.bindings);
  world.equip();
  for (const key of CONFIG.upgrade.requiredBosses) world.defeat(key);
  tryUpgrade(); // 解锁闪避

  world.defeat('pillarSolar');
  world.defeat('pillarVortex');
  world.defeat('pillarNebula');
  // 此时已击败机械三王（3）+ 三根柱子（3）= 6 个通用 Boss
  const three = h.getStats().dodgeRaw; // 5% + 6*0.5% + 3*1% = 11%
  world.defeat('pillarStardust');
  const four = h.getStats().dodgeRaw; // + 0.5%(通用) + 1%(柱) + 1%(四柱全清) = 13.5%

  check('四柱额外加成：打完第 4 根时同时吃到 +0.5%(通用) +1%(柱) +1%(全清)', () => {
    assert.ok(near(three, 0.11), `三根=${three}`);
    assert.ok(near(four, 0.135), `四根=${four}`);
    assert.ok(near(four - three, 0.025), `差值=${four - three}`);
  });

  uninstall();
}

// ---------------------------------------------------------------------------
// 5. 升级：前置条件 + 材料消耗 + 增益
// ---------------------------------------------------------------------------
{
  const world = createMockWorld({ inventory: { hallowedBar: 10, soulOfMight: 5, soulOfSight: 5, soulOfFright: 5 } });
  const h = install(null, world.bindings);
  world.equip();

  check('机械三王没打齐：不能升级，也不扣材料', () => {
    world.defeat('destroyer');
    const res = tryUpgrade();
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'requirements');
    assert.equal(world.state.player.inventory.hallowedBar, 10);
    assert.equal(world.state.upgraded, false);
  });

  check('材料不足：不扣材料、不升级', () => {
    world.defeat('twins');
    world.defeat('skeletronPrime');
    world.state.player.inventory.hallowedBar = 9;
    const res = tryUpgrade();
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'materials');
    assert.equal(world.state.upgraded, false);
    assert.equal(world.state.player.inventory.hallowedBar, 9);
  });

  check('材料足够：正好扣 神圣锭10 + 三魂各5，并写入升级标记', () => {
    world.state.player.inventory.hallowedBar = 10;
    const res = tryUpgrade();
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(world.state.upgraded, true);
    assert.equal(world.state.player.inventory.hallowedBar, 0);
    assert.equal(world.state.player.inventory.soulOfMight, 0);
    assert.equal(world.state.player.inventory.soulOfSight, 0);
    assert.equal(world.state.player.inventory.soulOfFright, 0);
  });

  check('升级增益：+2% 减伤 / +5% 伤害 / +5 防御，并解锁闪避与吸血', () => {
    const s = h.getStats();
    assert.ok(near(s.damageReduction, 0.01 + 0.0 + 0.02), `减伤=${s.damageReduction}`); // 只打了机械三王
    assert.ok(near(s.damageBonus, 0.04 + 0.03 + 0.05), `伤害=${s.damageBonus}`);
    assert.equal(s.defense, 4 + 3 + 5);
    assert.ok(s.dodgeChance > 0);
    assert.equal(s.lifesteal.enabled, true);
  });

  check('重复升级被拒绝（不会二次扣材料）', () => {
    const res = tryUpgrade();
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'already-upgraded');
  });

  uninstall();
}

// ---------------------------------------------------------------------------
// 6. 读档：属性重新施加一次，而不是叠两层
// ---------------------------------------------------------------------------
{
  const world = createMockWorld();
  install(null, world.bindings);
  world.equip();
  for (const key of ALL_KEYS) world.defeat(key);
  world.defeat('destroyer') && null;
  const before = world.totals();

  check('读档后重新装载：属性等于单层，不是双倍', () => {
    world.reload(); // 读档：游戏清掉临时加成，但进度还在
    uninstall();
    const h2 = install(null, world.bindings); // 重新装载（此时 isAccessoryEquipped=true）
    const after = world.totals();
    assert.ok(near(after.defense, before.defense), `${after.defense} vs ${before.defense}`);
    assert.ok(near(after.damageBonus, before.damageBonus));
    assert.ok(near(after.damageReduction, before.damageReduction));
    assert.equal(h2.getStats().bossCount, before.defense - 4); // 防御 = 4 + bossCount（未升级）
  });

  check('读档后重复 refresh 仍然不叠加', () => {
    const h2 = install(null, world.bindings);
    for (let i = 0; i < 10; i += 1) h2.refresh();
    assert.ok(near(world.totals().defense, before.defense));
  });

  uninstall();
}

// ---------------------------------------------------------------------------
// 7. 吸血：1% 实际伤害 + 0.2s 冷却
// ---------------------------------------------------------------------------
{
  let now = 0;
  const ls = new LifestealController({
    getConfig: () => ({
      enabled: true,
      percentOfActualDamage: 0.01,
      cooldownMs: 200,
      minHeal: 1,
      requirePositiveDamage: true,
    }),
    now: () => now,
  });

  check('吸血：回 1% 实际伤害（100 → 1）', () => {
    const res = ls.registerHit(100);
    assert.deepEqual(res, { heal: 1, reason: 'ok' });
  });

  check('吸血冷却：0.2 秒内第二次命中不回血', () => {
    now += 100;
    const res = ls.registerHit(1000);
    assert.equal(res.heal, 0);
    assert.equal(res.reason, 'cooldown');
    assert.equal(res.retryInMs, 100);
  });

  check('吸血冷却：过了 0.2 秒恢复（1000 伤害 → 10）', () => {
    now += 100;
    const res = ls.registerHit(1000);
    assert.equal(res.heal, 10);
  });

  check('吸血：0 伤害 / 免疫命中不回血（也不吃冷却）', () => {
    now += 1000; // 冷却好了
    const res = ls.registerHit(0);
    assert.equal(res.heal, 0);
    assert.equal(res.reason, 'no-damage');
    assert.equal(ls.registerHit(200).heal, 2); // 0 伤害那次没占用冷却
  });
}

// ---------------------------------------------------------------------------
// 8. 配置默认值自检（防止手滑改坏关键项）
// ---------------------------------------------------------------------------
{
  check('默认配置自检：闪避上限 12%、吸血冷却 200ms、四柱计入通用成长', () => {
    assert.equal(CONFIG.dodge.hardCap, 0.12);
    assert.equal(CONFIG.lifesteal.cooldownMs, 200);
    assert.equal(CONFIG.genericGrowth.pillarsCountForGenericGrowth, true);
    assert.equal(CONFIG.genericGrowth.bosses.filter((b) => b.pillars).length, 4);
  });

  check('满级减伤 37%（不是 40%）：差值已如实暴露，不要靠改代码硬凑', () => {
    const s = calculateStats(null, { defeatedBosses: new Set(ALL_KEYS), upgraded: true });
    assert.ok(near(s.damageReduction, 0.37), `实际=${s.damageReduction}`);
  });
}

// eslint-disable-next-line no-console
console.log(results.join('\n'));
// eslint-disable-next-line no-console
console.log(`\n${passed} 项通过，${results.length - passed} 项失败`);
if (process.exitCode) {
  // eslint-disable-next-line no-console
  console.log('有失败项，见上面 ❌');
}