/**
 * 读取真实 Boss 进度（不需要任何自定义事件、不需要存档字段）。
 *
 * 数据源（Bunny Loader / tModLoader 语义）：
 *   - Terraria.NPC.downedXXX 布尔量 —— 世界级进度，读档后依然正确；
 *   - Terraria.Main.hardMode   —— 血肉墙没有独立标记，用"进入困难模式"代替。
 *
 * 注意：世界吞噬者与克苏鲁之脑共用 NPC.downedBoss2，游戏里无法区分是谁被打死过，
 * 所以它们在统计里只算 1 个（去重规则在 Stats.js）。
 */

import { CONFIG } from './Config.js';

/** 安全取全局对象（加载早期可能还没注入） */
function terraria() {
  try {
    return typeof Terraria !== 'undefined' ? Terraria : null;
  } catch (e) {
    return null;
  }
}

/** 某个 Boss 的标记当前是否为 true（读不到一律按未击败） */
export function isFlagSet(flag) {
  const T = terraria();
  if (!T || !flag) return false;
  try {
    if (flag === 'hardMode') return T.Main && T.Main.hardMode === true;
    return !!(T.NPC && T.NPC[flag] === true);
  } catch (e) {
    return false;
  }
}

/**
 * 读出"已击败 Boss"的 key 集合。
 * @returns {Set<string>}
 */
export function readDefeated() {
  const defeated = new Set();
  for (const boss of CONFIG.genericGrowth.bosses) {
    if (isFlagSet(boss.flag)) defeated.add(boss.key);
  }
  return defeated;
}

/** 机械三王是否已全部击败（升级前置） */
export function mechBossesDown() {
  return CONFIG.upgrade.requiredBosses.every((key) => {
    const boss = CONFIG.genericGrowth.bosses.find((b) => b.key === key);
    return boss ? isFlagSet(boss.flag) : false;
  });
}

export default readDefeated;