/**
 * 模组入口。
 *
 * 加载器侧要做的两件事（具体入口导出名待确认，见下方 TODO）：
 *   1. 注入完成后调用 install(loader)；卸载/关模组时调用 uninstall()；
 *   2. 玩家在合成/升级界面点"升级"时调用 tryUpgrade(player)。
 *      （升级配方注册接口待确认 —— 如果加载器有自己的配方系统，
 *        在那里把配方条件换成调用 tryUpgrade 即可，本文件不假设任何配方 API。）
 *
 * TODO：待确认 —— Bunny Loader 1.4.5.8 的入口是 export default { install }，
 * 还是 onLoad/onEnable 之类的约定名。若不是 install，写一个同名包装再调 install。
 */

import { CONFIG } from './config.js';
import { buildAdapter } from './adapters/bunnyApi.js';
import { WarriorGrowthCharm } from './accessory.js';
import { BossProgress } from './state.js';
import { DodgeGuard, LifestealController } from './runtime.js';
import { bossName } from './stats.js';

/** 当前会话（install 时创建，uninstall 时清空） */
let session = null;

/**
 * 安装模组。
 * @param {object} loader 加载器注入对象（可空，取决于适配层实现）
 * @param {object} [overrides] 覆盖 BINDINGS 的项（离线测试 / 局部替换用）
 * @returns {object} 公开句柄
 */
export function install(loader, overrides = {}) {
  if (session) uninstall();

  const api = buildAdapter(loader, overrides);
  const caps = api.capabilities();

  // 缺关键能力时直接抛错，别让它"看起来装上了但什么都不生效"
  if (!caps.registerAccessory) {
    throw new Error('[WarriorGrowthCharm] 适配层缺少 registerAccessory：请先实现 src/adapters/bunnyApi.js 的 BINDINGS');
  }

  const charm = new WarriorGrowthCharm(api, {
    onStatsChanged: (stats) => {
      api.log(
        `属性更新：减伤 ${(stats.damageReduction * 100).toFixed(2)}% / 防御 ${stats.defense} / 伤害 +${(
          stats.damageBonus * 100
        ).toFixed(2)}% / 闪避 ${(stats.dodgeChance * 100).toFixed(2)}% / 吸血 ${
          stats.lifesteal.enabled ? '已解锁' : '未解锁'
        }`
      );
    },
  });
  charm.create();

  const progress = new BossProgress();
  const dodge = new DodgeGuard({ getChance: () => charm.dodgeChance, rng: () => api.random() });
  const lifesteal = new LifestealController({
    getConfig: () => charm.lifesteal,
    now: () => api.nowMs(),
  });

  const disposers = [];
  const timers = [];
  const keep = (d) => {
    if (typeof d === 'function') disposers.push(d);
  };

  // ---------------- 装备 / 卸下 ----------------
  keep(
    api.onEquip((player) => {
      charm.onEquip(player);
      syncProgress(api, progress, player);
      api.log('饰品已装备，属性已施加');
    })
  );

  keep(
    api.onUnequip((player) => {
      // 卸载：撤销全部加成（防御/伤害/减伤 + 闪避/吸血解锁状态）
      charm.onUnequip(player);
      lifesteal.reset();
      api.log('饰品已卸下，加成全部撤销');
    })
  );

  // ---------------- Boss 击败 ----------------
  // 有事件就用事件；没有就靠下面的轮询兜底（两者都只是"触发重算"，
  // 真正的数值永远由"已击败集合"现算，所以触发多少次都不会重复叠加）
  if (caps.bossEvents) {
    keep(
      api.onBossDefeated((bossKey) => {
        if (bossKey) api.log(`Boss 击败：${bossName(bossKey)}`);
        refresh('boss-defeated');
      })
    );
  } else {
    api.warn('适配层没有 Boss 击败事件（BINDINGS.onBossDefeated 未实现），改用轮询兜底。');
  }

  // ---------------- 闪避：受伤前判定，命中则取消本次伤害 ----------------
  if (caps.dodge) {
    keep(
      api.onBeforePlayerHurt((event, player) => {
        const res = dodge.roll();
        if (res.chance <= 0) return; // 没解锁 / 概率为 0：完全不参与
        if (res.dodged) {
          const cancelled = api.cancelDamage(event);
          api.log(
            `闪避触发：概率 ${(res.chance * 100).toFixed(2)}%，roll=${res.roll.toFixed(4)}，` +
              `${cancelled ? '已取消本次伤害' : '取消伤害失败（检查 BINDINGS.cancelDamage）'}`
          );
        }
      })
    );
  } else {
    // TODO：待确认 —— 受伤前事件 + 取消伤害的写法（BINDINGS.onBeforePlayerHurt / cancelDamage）
    api.warn('适配层没有受伤前事件，闪避不会生效（游标效果：属性照常，只是不闪）。');
  }

  // ---------------- 吸血：命中 NPC 回血，带冷却 ----------------
  if (caps.lifesteal && caps.heal) {
    keep(
      api.onHitNpc((event, player) => {
        const cfg = lifesteal.getConfig ? lifesteal.getConfig() : null;
        if (!cfg || !cfg.enabled) return;
        const actualDamage = api.readActualDamage(event);
        const res = lifesteal.registerHit(actualDamage);
        if (res.heal > 0) {
          api.healPlayer(player, res.heal);
          api.log(`吸血：实际伤害 ${actualDamage} → 回复 ${res.heal}`);
        }
      })
    );
  } else {
    // TODO：待确认 —— 命中 NPC 事件 + 实际伤害字段（BINDINGS.onHitNpc / readActualDamage），
    // 以及回血写入口（BINDINGS.healPlayer）
    api.warn('适配层缺少命中事件或回血接口，吸血不会生效。');
  }

  // ---------------- 读档补状态 ----------------
  // 如果载入时饰品已经戴着，靠 isAccessoryEquipped 立刻补上属性，不用等玩家手动换一次
  let initialPlayer = null;
  try {
    initialPlayer = api.getPlayer();
  } catch (err) {
    api.warn('初始化时取玩家失败：', err && err.message ? err.message : err);
  }
  if (initialPlayer) {
    try {
      const equipped = api.isEquipped(initialPlayer);
      if (equipped === true) {
        charm.onEquip(initialPlayer);
        api.log('载入时检测到饰品已装备，属性已补上');
      } else if (equipped === null) {
        api.log('适配层未实现 isAccessoryEquipped：等一次装备事件后才会应用属性');
      }
    } catch (err) {
      api.warn('初始化时同步装备状态失败：', err && err.message ? err.message : err);
    }
    syncProgress(api, progress, initialPlayer);
  }

  // ---------------- 轮询兜底 ----------------
  // 作用只有一个：在没有"Boss 击败事件"时也能发现进度变化。
  // 数值一样时 refresh 内部会走指纹短路，不会重复 apply。
  const timer = api.setInterval(() => {
    if (!charm.equipped) return;
    refresh('poll');
  }, CONFIG.runtime.pollIntervalMs);
  timers.push(timer);

  /** 重新读进度 + 重算属性（先撤销旧加成，再应用新加成） */
  function refresh(reason) {
    let player = null;
    try {
      player = api.getPlayer();
    } catch (err) {
      api.warn('刷新时取玩家失败：', err && err.message ? err.message : err);
      return charm.getStats();
    }
    if (!player) return charm.getStats();
    const stats = charm.refresh(player);
    const added = syncProgress(api, progress, player);
    if (added.length && reason) {
      api.log(`新增进度（${reason}）：${added.map(bossName).join('、')}`);
    }
    return stats;
  }

  session = { api, charm, progress, dodge, lifesteal, disposers, timers, refresh };

  return {
    /** 适配层（调试/测试用：可 setRandom、看 capabilities） */
    api,
    charm,
    getStats: () => charm.getStats(),
    refresh: () => refresh('manual'),
    tryUpgrade: (player) => tryUpgrade(player),
    uninstall,
    instance: charm,
  };
}

/** 从玩家读出已击败集合，更新本地账本；返回本次新增的 key */
function syncProgress(api, progress, player) {
  try {
    const ctx = api.readContext(player);
    return progress.sync(ctx.defeatedBosses);
  } catch (err) {
    api.warn('读取 Boss 进度失败：', err && err.message ? err.message : err);
    return [];
  }
}

/**
 * 尝试升级（由加载器的升级/合成界面调用）。
 * 顺序固定：检查前置 → 扣材料 → 写升级标记 → 强制重算属性。
 * @param {object} [player]
 */
export function tryUpgrade(player) {
  if (!session) return { ok: false, reason: 'not-installed' };
  const { api, charm } = session;

  let p = player;
  if (!p) {
    try {
      p = api.getPlayer();
    } catch (err) {
      return { ok: false, reason: 'no-player', error: String(err && err.message) };
    }
  }
  if (!charm.equipped) return { ok: false, reason: 'not-equipped' };

  const stats = charm.getStats();
  if (stats && stats.upgraded) return { ok: false, reason: 'already-upgraded' };

  const can = api.canUpgrade(p);
  if (!can || can.ok === false) {
    // 把"材料不够"和"前置没达成"分开报，方便界面提示
    const reason = can && can.reason === 'materials' ? 'materials' : 'requirements';
    return { ok: false, reason, detail: can };
  }

  const consumed = api.consumeMaterials(p);
  if (!consumed || consumed.ok === false) return { ok: false, reason: 'materials', detail: consumed };

  api.applyUpgrade(p);
  const after = charm.refresh(p, { force: true });
  api.log('升级完成：已解锁闪避与吸血');
  return { ok: true, stats: after };
}

/** 卸载：撤销全部加成 + 解绑事件 + 清定时器（可重复调用） */
export function uninstall() {
  if (!session) return;
  const { api, charm, disposers, timers } = session;

  for (const d of disposers) {
    try {
      d();
    } catch (err) {
      api.warn('解绑事件失败：', err && err.message ? err.message : err);
    }
  }
  for (const t of timers) {
    try {
      api.clearInterval(t);
    } catch (err) {
      api.warn('清定时器失败：', err && err.message ? err.message : err);
    }
  }

  let player = null;
  try {
    player = api.getPlayer();
  } catch (err) {
    api.warn('卸载时取玩家失败：', err && err.message ? err.message : err);
  }
  try {
    charm.onUnequip(player); // 撤销全部加成
  } catch (err) {
    api.warn('卸载时撤销加成失败：', err && err.message ? err.message : err);
  }

  session = null;
}

export default { install, uninstall, tryUpgrade };