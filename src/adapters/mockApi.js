/**
 * 离线假适配层（不接游戏，纯内存），用于：
 *   1. 跑 scripts/verify.mjs 自测（不需要开游戏）；
 *   2. 你在没有 Bunny Loader 的环境里改平衡数值时，先看逻辑对不对。
 *
 * 它实现的是 src/adapters/bunnyApi.js 里 BINDINGS 的**同一套签名**，
 * 所以可以直接 buildAdapter(null, mock.world.bindings) 替换掉真实适配层。
 *
 * 注意：它不是"游戏里能跑的实现"，别拿它当真实 API 用。
 */

import { CONFIG } from '../config.js';

/**
 * 造一个假世界。
 * @param {object} [opts]
 * @param {Record<string, number>} [opts.inventory] 初始材料数量
 */
export function createMockWorld(opts = {}) {
  const inventory = Object.assign(
    {
      hallowedBar: 99,
      soulOfMight: 99,
      soulOfSight: 99,
      soulOfFright: 99,
    },
    opts.inventory || {}
  );

  const state = {
    player: { name: 'MockPlayer', hp: 100, maxHp: 100, inventory },
    defeated: new Set(),
    upgraded: false,
    equipped: false,
    /** 当前生效的加成：id -> mod（重复 apply 会覆盖同一 id，不会叠加） */
    modifiers: new Map(),
    /** 事件监听器 */
    listeners: { equip: [], unequip: [], boss: [], hurt: [], hit: [] },
    /** 统计用 */
    stats: { applyCalls: 0, removeCalls: 0 },
  };

  const emit = (name, ...args) => {
    for (const cb of state.listeners[name].slice()) cb(...args);
  };

  const on = (name) => (cb) => {
    state.listeners[name].push(cb);
    return () => {
      const i = state.listeners[name].indexOf(cb);
      if (i >= 0) state.listeners[name].splice(i, 1);
    };
  };

  /** 当前加成合计（按 mod.value 相加，和游戏里"多条加成叠加"语义一致） */
  const totals = () => {
    const t = { damageReduction: 0, defense: 0, damageBonus: 0 };
    for (const mod of state.modifiers.values()) t[mod.stat] += mod.value;
    return t;
  };

  const bindings = {
    // ① 注册饰品
    registerAccessory(def) {
      state.item = def;
      state.texturePath = def.texture.path;
      return { id: def.id, name: def.name };
    },
    // ② 装备状态
    onAccessoryEquip: on('equip'),
    onAccessoryUnequip: on('unequip'),
    isAccessoryEquipped() {
      return state.equipped;
    },
    // ③ Boss 击败（有事件，测试主流程；也可以传 null 测轮询分支）
    onBossDefeated: opts.noBossEvent ? null : on('boss'),
    // ④ 受伤前 / 取消伤害
    onBeforePlayerHurt: on('hurt'),
    cancelDamage(event) {
      if (event) event.cancelled = true;
    },
    // ⑤ 命中 NPC / 实际伤害
    onHitNpc: on('hit'),
    readActualDamage(event) {
      return event && Number(event.actualDamage) > 0 ? Number(event.actualDamage) : 0;
    },
    // ⑥ 属性写入 / 撤销
    applyStatModifiers(player, mods) {
      state.stats.applyCalls += 1;
      for (const mod of mods) {
        // 同一 id 覆盖 → 不会因为重复 apply 而叠加
        state.modifiers.set(mod.id, { ...mod });
      }
      return mods.map((m) => m.id);
    },
    removeStatModifiers(player, handles) {
      state.stats.removeCalls += 1;
      for (const id of handles || []) state.modifiers.delete(id);
    },
    // ⑦ 玩家 / 回血
    getPlayer() {
      return state.player;
    },
    healPlayer(player, amount) {
      player.hp = Math.min(player.maxHp, player.hp + amount);
    },
    // ⑧ Boss 进度 / 升级
    isBossDefeated(player, key) {
      return state.defeated.has(key);
    },
    isUpgraded() {
      return state.upgraded;
    },
    setUpgraded() {
      state.upgraded = true;
    },
    canUpgrade(player, req) {
      if (state.upgraded) return { ok: false, reason: 'already-upgraded' };
      const missingBosses = req.requiredBosses.filter((k) => !state.defeated.has(k));
      if (missingBosses.length) return { ok: false, reason: 'bosses', missingBosses };
      const missing = req.materials
        .filter((m) => (state.player.inventory[m.key] || 0) < m.amount)
        .map((m) => ({ key: m.key, name: m.name, need: m.amount, have: state.player.inventory[m.key] || 0 }));
      return missing.length ? { ok: false, reason: 'materials', missing } : { ok: true };
    },
    consumeMaterials(player, materials) {
      const missing = materials
        .filter((m) => (state.player.inventory[m.key] || 0) < m.amount)
        .map((m) => ({ key: m.key, name: m.name, need: m.amount, have: state.player.inventory[m.key] || 0 }));
      if (missing.length) return { ok: false, missing };
      for (const m of materials) state.player.inventory[m.key] -= m.amount;
      return { ok: true };
    },
    // ⑨ 贴图
    loadTexture(path) {
      return { path, mock: true };
    },
    // ⑩ 调度（测试里不用真定时器，给个可手动推进的假定时器）
    setInterval() {
      return 0;
    },
    clearInterval() {},
  };

  return {
    state,
    bindings,
    totals,
    // ---- 事件触发器 ----
    equip() {
      state.equipped = true;
      emit('equip', state.player);
    },
    unequip() {
      state.equipped = false;
      emit('unequip', state.player);
    },
    defeat(key) {
      state.defeated.add(key);
      emit('boss', key);
    },
    /** 模拟一次受伤：返回是否被取消 */
    hurt(amount, player = state.player) {
      const event = { damage: amount, cancelled: false };
      emit('hurt', event, player);
      return { cancelled: event.cancelled, damage: event.cancelled ? 0 : event.damage };
    },
    /** 模拟一次命中：返回本次实际伤害 */
    hit(actualDamage, player = state.player) {
      const event = { actualDamage };
      emit('hit', event, player);
      return actualDamage;
    },
    /** 模拟读档：玩家身上的临时加成会被游戏清掉，但持久化进度（Boss/升级/背包）还在 */
    reload() {
      state.modifiers.clear();
      state.stats.applyCalls = 0;
      state.stats.removeCalls = 0;
    },
  };
}

/** 一次性把全部 Boss 标记为已击败 */
export function defeatAll(world, keyList = CONFIG.genericGrowth.bosses.map((b) => b.key)) {
  for (const key of keyList) world.state.defeated.add(key);
  return keyList;
}

export default createMockWorld;