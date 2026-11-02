/**
 * 战斗行为类效果：闪避判定 + 吸血冷却。
 *
 * 这两个都不走"属性加成"通道（不是 +防御 那种数值），而是挂在战斗事件里，
 * 所以单独放一个文件，并且把随机数 / 时钟做成可注入 —— 方便离线测试
 * （测试里用固定 rng 和假时钟就能验证"封顶"和"冷却"）。
 */

/** 闪避判定器 */
export class DodgeGuard {
  /**
   * @param {object} opts
   * @param {() => number} opts.getChance 返回当前闪避概率（0~1），由 calculateStats 提供
   * @param {() => number} [opts.rng] 随机数源，默认 Math.random
   */
  constructor({ getChance, rng = Math.random }) {
    this.getChance = getChance;
    this.rng = rng;
    this.lastRoll = null;
  }

  /**
   * 掷一次闪避。
   * @returns {{dodged: boolean, chance: number, roll: number}}
   */
  roll() {
    const chance = Number(this.getChance()) || 0;
    if (chance <= 0) {
      this.lastRoll = { dodged: false, chance: 0, roll: 1 };
      return this.lastRoll;
    }
    const roll = this.rng();
    const dodged = roll < chance; // [0, chance) 命中闪避
    this.lastRoll = { dodged, chance, roll };
    return this.lastRoll;
  }
}

/**
 * 吸血控制器：负责"百分比 + 冷却 + 最小回复量"，
 * 真正的加血动作由外部传入的 api.healPlayer(player, amount) 执行。
 */
export class LifestealController {
  /**
   * @param {object} opts
   * @param {() => ({enabled:boolean, percentOfActualDamage:number, cooldownMs:number, minHeal:number, requirePositiveDamage:boolean})} opts.getConfig
   * @param {() => number} [opts.now] 毫秒时钟（默认 Date.now，测试可注入假时钟）
   */
  constructor({ getConfig, now = () => Date.now() }) {
    this.getConfig = getConfig;
    this.now = now;
    this.lastHealAt = -Infinity;
    this.lastResult = null;
  }

  /** 卸载饰品 / 换角色时清空冷却，避免"上次的冷却"影响到下次装备 */
  reset() {
    this.lastHealAt = -Infinity;
    this.lastResult = null;
  }

  /**
   * 一次命中（伤害已结算完毕，actualDamage 是"实际造成"的伤害）。
   * @param {number} actualDamage
   * @returns {{heal:number, reason:string, retryInMs?:number}}
   */
  registerHit(actualDamage) {
    const cfg = this.getConfig() || {};
    const done = (res) => {
      this.lastResult = res;
      return res;
    };

    if (cfg.enabled !== true) return done({ heal: 0, reason: 'disabled' });

    const dmg = Number(actualDamage);
    if (cfg.requirePositiveDamage !== false && (!Number.isFinite(dmg) || dmg <= 0)) {
      // 免疫 / 0 伤害 / 非数字：不回血，也不吃冷却
      return done({ heal: 0, reason: 'no-damage' });
    }

    const t = this.now();
    const cooldown = Number(cfg.cooldownMs) || 0;
    const elapsed = t - this.lastHealAt;
    if (elapsed < cooldown) {
      return done({ heal: 0, reason: 'cooldown', retryInMs: cooldown - elapsed });
    }

    let heal = dmg * (Number(cfg.percentOfActualDamage) || 0);
    if (!Number.isFinite(heal) || heal <= 0) return done({ heal: 0, reason: 'zero-heal' });

    // 最小回复量（默认 1）→ 再四舍五入成整数，避免小数血量
    heal = Math.max(Number(cfg.minHeal) || 0, Math.round(heal));

    this.lastHealAt = t;
    return done({ heal, reason: 'ok' });
  }
}

export default { DodgeGuard, LifestealController };