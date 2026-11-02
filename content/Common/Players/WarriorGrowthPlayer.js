/**
 * WarriorGrowthPlayer —— 真正把属性写进玩家的地方（ModPlayer）。
 *
 * 关键点：
 *  1. Bunny Loader 沿用 tModLoader 语义：每 tick 引擎会把 statDefense / endurance /
 *     meleeDamage 等重置回基础值，然后调用 ModPlayer.ResetEffects()。
 *      => 我们在这里"每帧重新加一次"不会叠加，这是幂等的正确写法。
 *  2. 属性值永远来自 calculateStats(进度, 是否觉醒)，是"一次性映射"而不是累加，
 *     所以同一个 Boss 无论触发多少次、读档多少次，结果都一样。
 *  3. 卸下饰品 = 下一 tick 不再写入 => 加成自动消失，玩家身上不留残留。
 *     （若未来加载器改成"不重置"，只需在此处改成先减掉 this.applied 再重新加，结构已预留。）
 */

import { CONFIG } from '../Config.js';
import { readDefeated } from '../Progress.js';
import { calculateStats } from '../Stats.js';

const ItemTypeCache = { base: -1, awakened: -1 };

/** 取本模组物品的 type 数字（失败返回 -1） */
function itemType(name) {
  try {
    const t = ModContent.ItemType(name);
    return typeof t === 'number' ? t : -1;
  } catch (e) {
    return -1;
  }
}

/**
 * 当前身上戴的是哪一版饰品。
 * @returns {'awakened'|'base'|null}
 */
export function equippedKind(player) {
  if (!player || !player.armor) return null;
  if (ItemTypeCache.base < 0) ItemTypeCache.base = itemType(CONFIG.texture.base);
  if (ItemTypeCache.awakened < 0) ItemTypeCache.awakened = itemType(CONFIG.texture.awakened);

  const armor = player.armor;
  let kind = null;
  for (let i = 0; i < armor.length; i += 1) {
    const it = armor[i];
    if (!it || !it.type) continue;
    if (ItemTypeCache.awakened > 0 && it.type === ItemTypeCache.awakened) return 'awakened';
    if (ItemTypeCache.base > 0 && it.type === ItemTypeCache.base) kind = 'base';
  }
  return kind;
}

export class WarriorGrowthPlayer extends ModPlayer {
  // 用类字段初始化（样例模组同样用法），不写 constructor，避免和原生基类构造签名冲突
  lastLifestealAt = -Infinity;
  lastStats = null;

  /** 引擎每 tick 重置基础属性后调用：把我们的一层加成重新加上 */
  ResetEffects(player) {
    const p = player || this.Player;
    const kind = equippedKind(p);
    if (!kind) {
      this.lastStats = null;
      return;
    }

    const stats = calculateStats(readDefeated(), kind === 'awakened');
    this.lastStats = stats;

    // 减伤（endurance 是"受到伤害减少的比例"，原生字段）
    p.endurance = (p.endurance || 0) + stats.damageReduction;
    // 防御
    p.statDefense = (p.statDefense || 0) + stats.defense;
    // 伤害：逐职业字段都加，保证"伤害 +4%"对近战/远程/魔法/召唤都成立
    for (const field of ['meleeDamage', 'rangedDamage', 'magicDamage', 'minionDamage']) {
      if (typeof p[field] === 'number') p[field] += stats.damageBonus;
    }
  }

  /**
   * 闪避：受伤前判定，返回 true 表示取消本次伤害。
   * 只有觉醒了（且概率 > 0）才参与，未觉醒直接不介入。
   */
  FreeDodge(player, damageSource, damage, hitDirection, pvp, quiet, crit, cooldownCounter, dodgeable) {
    if (dodgeable === false) return false;
    const p = player || this.Player;
    if (equippedKind(p) !== 'awakened') return false;

    const stats = calculateStats(readDefeated(), true);
    const chance = Math.min(CONFIG.dodge.hardCap, stats.dodgeChance);
    if (!(chance > 0)) return false;
    if (Math.random() >= chance) return false;

    // 飘字提示（拿不到 UI API 就静默，不影响逻辑）
    try {
      const color = Color.new(120, 220, 255, 255);
      Terraria.CombatText['int NewText(Rectangle location, Color color, string text, bool dramatic, bool dot)'](
        p.Hitbox,
        color,
        '闪避',
        false,
        false
      );
    } catch (e) {}
    return true;
  }

  /** 吸血：命中敌人后按"实际伤害"回血，带内置冷却 */
  OnHitNPC(player, target, hit, damageDone) {
    const p = player || this.Player;
    if (equippedKind(p) !== 'awakened') return;
    if (CONFIG.lifesteal.enabled !== true) return;

    const dmg = Number(damageDone);
    if (!Number.isFinite(dmg) || dmg <= 0) return;

    const now = Date.now();
    if (now - this.lastLifestealAt < CONFIG.lifesteal.cooldownMs) return;

    let heal = dmg * CONFIG.lifesteal.percentOfActualDamage;
    if (!Number.isFinite(heal) || heal <= 0) return;
    heal = Math.max(CONFIG.lifesteal.minHeal, Math.round(heal));

    this.lastLifestealAt = now;
    const max = p.statLifeMax2 || p.statLifeMax || p.statLife;
    p.statLife = Math.min(max, p.statLife + heal);
    try {
      p.HealEffect(heal, false);
    } catch (e) {}
  }
}

export default WarriorGrowthPlayer;