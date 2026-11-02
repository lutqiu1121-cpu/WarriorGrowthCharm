/**
 * 饰品主体：负责"装上 / 卸下 / 重算"三件事，以及最重要的一条铁律：
 *
 *   ****每次更新属性 = 先撤销上一次加成，再应用新加成。****
 *
 * 为什么必须这样：
 *  - 如果只 apply 不 remove，每帧/每次事件都会再叠一层，属性会指数膨胀；
 *  - 所以我们把上次 apply 返回的 handle 存起来，下一次先 remove 掉。
 *  - 卸载饰品时把 handle 全部撤销，玩家身上不留任何残留加成。
 */

import { CONFIG } from './config.js';
import { calculateStats, statsSignature } from './stats.js';
import { formatTooltip } from './tooltip.js';

/** 属性加成 id 前缀：方便在游戏里认出"这条加成是哪个模组加的" */
const SOURCE = CONFIG.meta.id;

export class WarriorGrowthCharm {
  /**
   * @param {object} api 适配层（src/adapters/bunnyApi.js 的 buildAdapter 产物，或 mockApi）
   * @param {object} [opts]
   * @param {(stats:object) => void} [opts.onStatsChanged] 属性变化回调（打日志/tooltip 用）
   */
  constructor(api, opts = {}) {
    this.api = api;
    this.onStatsChanged = opts.onStatsChanged || null;

    /** 最后一次 applyStatModifiers 的返回值（撤销时原样交回） */
    this.appliedHandles = null;
    /** 当前属性快照（calculateStats 的返回值） */
    this.stats = null;
    /** 属性指纹：值没变就不做撤销/重放 */
    this.lastSignature = '';
    /** 是否处于"已装备"状态 */
    this.equipped = false;
    /** 饰品实例（registerAccessory 的返回值） */
    this.item = null;
    this.texture = null;
  }

  /** 注册饰品（只做一次） */
  create() {
    if (this.item) return this.item;

    // 注册时先按"什么都没打、也没升级"算一份静态说明；
    // TODO：待确认 —— 1.4.5.8 是否支持动态刷新 tooltip。不支持时这里就是静态文本，
    // 玩家看到的数字以实际生效值为准（本模组所有数值都从 calculateStats 来）。
    const preview = calculateStats(null, { defeatedBosses: new Set(), upgraded: false });

    const def = {
      id: CONFIG.meta.id,
      name: CONFIG.accessory.name,
      slot: CONFIG.accessory.slot,
      texture: {
        path: CONFIG.texture.path,
        width: CONFIG.texture.width,
        height: CONFIG.texture.height,
      },
      tooltipLines: formatTooltip(preview),
    };

    const created = this.api.registerAccessory(def);
    // 兼容两种返回：直接返回 item，或 { item, texture }
    if (created && typeof created === 'object' && 'item' in created) {
      this.item = created.item;
      this.texture = created.texture;
    } else {
      this.item = created;
    }
    return this.item;
  }

  /** 装备：标记状态 + 立即算一次并施加 */
  onEquip(player) {
    this.equipped = true;
    this.refresh(player, { force: true });
  }

  /**
   * 卸下：撤销全部加成（包括闪避/吸血这类行为效果的解锁状态）。
   * 属性是"撤销"，不需要重新计算。
   */
  onUnequip(player) {
    this.equipped = false;
    this.revertAll(player);
    this.stats = null;
    this.lastSignature = '';
  }

  /**
   * 重新计算并更新属性。
   * @param {object} player
   * @param {{force?:boolean}} [opts] force=true 时即使指纹没变也强制撤销+重放（初始装备/升级瞬间用）
   */
  refresh(player, opts = {}) {
    const force = opts.force === true;
    if (!this.equipped && !force) return this.stats;

    const ctx = this.api.readContext(player);
    const stats = calculateStats(player, ctx);
    const signature = statsSignature(stats);

    if (!force && signature === this.lastSignature && this.appliedHandles) {
      // 数值没变：只更新快照，不碰游戏里的加成（避免每帧 remove/apply 抖动）
      this.stats = stats;
      return stats;
    }

    // ① 先撤销上一次加成
    this.revertAll(player);
    // ② 再应用新加成
    this.applyStats(player, stats);

    this.stats = stats;
    this.lastSignature = signature;
    if (this.onStatsChanged) this.onStatsChanged(stats);
    return stats;
  }

  /** 把 stats 转成适配层的 mods 数组 */
  buildModifiers(stats) {
    return [
      {
        id: `${SOURCE}:damageReduction`,
        stat: 'damageReduction',
        mode: 'flat',
        value: stats.damageReduction,
        source: SOURCE,
      },
      {
        id: `${SOURCE}:defense`,
        stat: 'defense',
        mode: 'flat',
        value: stats.defense,
        source: SOURCE,
      },
      {
        id: `${SOURCE}:damageBonus`,
        stat: 'damageBonus',
        mode: 'flat',
        value: stats.damageBonus,
        source: SOURCE,
      },
    ];
  }

  /** 应用加成，并记住 handle */
  applyStats(player, stats) {
    const mods = this.buildModifiers(stats);
    const handles = this.api.applyStatModifiers(player, mods);
    // 适配层即使不返回 handle，也把 mods 存下来（remove 时按 mods 撤销）
    this.appliedHandles = handles == null ? mods : handles;
    return this.appliedHandles;
  }

  /** 撤销全部加成（幂等：没有可撤销的就直接返回） */
  revertAll(player) {
    if (!this.appliedHandles) return false;
    const handles = this.appliedHandles;
    this.appliedHandles = null;
    this.api.removeStatModifiers(player, handles);
    return true;
  }

  // ---------------- 对外只读 ----------------
  getStats() {
    return this.stats;
  }

  /** 闪避概率（没装备/没解锁 = 0） */
  get dodgeChance() {
    return this.equipped && this.stats ? this.stats.dodgeChance : 0;
  }

  /** 吸血配置（没装备/没解锁 = enabled:false） */
  get lifesteal() {
    if (!this.equipped || !this.stats) return { enabled: false };
    return this.stats.lifesteal;
  }

  /** 当前 tooltip 文本 */
  tooltipLines(extra = {}) {
    return formatTooltip(this.stats, extra);
  }
}

export default WarriorGrowthCharm;