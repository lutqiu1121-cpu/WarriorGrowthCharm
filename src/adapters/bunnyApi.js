/**
 * ⚠️ 本文件是唯一允许出现"待确认 API"的地方。
 *
 * 我（作者）没有 Bunny Loader 1.4.5.8 的官方 API 文档，因此**不编造任何接口名**。
 * 下面 BINDINGS 里所有值为 null 的项，都需要你替换成 1.4.5.8 的真实实现。
 * 替换规则：保持方法签名一致，返回/接收的数据结构按注释来。
 *
 * 未替换时不会"静默失效"：调用会抛出 code = 'WGC_TODO' 的错误并指出缺哪一项，
 * 这样你一运行就知道还差什么，而不是看着饰品不涨属性却不知道原因。
 *
 * TODO 总清单（同样列在 README 的"TODO 清单"里）：
 *   1. 饰品注册：创建一个占用饰品栏的饰品（名称 / 贴图 / 槽位标识）
 *   2. 饰品装备事件、卸下事件
 *   3. Boss 击败事件（可选，缺省靠轮询兜底）与"该 Boss 是否已击败"的查询
 *   4. 受伤前事件 + 取消本次伤害的写法（闪避）
 *   5. 命中 NPC 事件 + 取"实际伤害"的字段/参数（吸血）
 *   6. 属性加成写入 / 撤销（减伤、防御、伤害）—— 必须支持撤销，否则会重复叠加
 *   7. 升级配方：能否升级、扣材料、写入"已升级"标记（且该标记要能读档保留）
 *   8. res 资源目录声明格式 / 贴图加载方式
 *
 * 另外这些也待确认（README 有同名条目）：
 *   - .bl 打包命令
 *   - manifest.json 的必填字段
 *   - 加载器是否支持 ESM（import/export），见文件末尾说明
 */

import { CONFIG } from '../config.js';

// ---------------------------------------------------------------------------
// TODO：把下面每一项替换成 Bunny Loader 1.4.5.8 的真实 API。
// 注释里的签名就是适配层要对外提供的形状，照抄实现即可，不用改其它文件。
// ---------------------------------------------------------------------------
export const BINDINGS = {
  /**
   * ① 注册饰品。
   * 需要做的事：在游戏里创建"战士成长饰品"，挂到饰品栏（config.accessory.slot），
   * 用 config.texture.path 作为贴图，并把 def.tooltipLines 塞进物品说明。
   * @type {null | (def: {id:string,name:string,slot:string,texture:{path:string,width:number,height:number},tooltipLines:string[]}) => any}
   */
  registerAccessory: null,

  /**
   * ② 饰品被装备到玩家身上。
   * cb(player) 会在装备发生时被调用，返回一个"取消订阅"函数（没有就返回 undefined）。
   * @type {null | (cb: (player:any) => void) => (() => void) | void}
   */
  onAccessoryEquip: null,

  /**
   * ② 饰品被卸下。
   * cb(player) —— 卸下时必须让我们把加成全部撤销。
   * @type {null | (cb: (player:any) => void) => (() => void) | void}
   */
  onAccessoryUnequip: null,

  /**
   * ② 载入/读档时"饰品是否已经戴在身上"（可选，但强烈建议实现）。
   * 不实现时：读档后如果玩家已经戴着饰品，要等下一次"装备事件"才会补上属性。
   * @type {null | (player:any) => boolean}
   */
  isAccessoryEquipped: null,

  /**
   * ③ Boss 击败事件（可选）。没有也能跑：main.js 会用轮询兜底。
   * cb(bossKey|null)，bossKey 用 config.genericGrowth.bosses[].key 里的标识；
   * 认不出是哪个 Boss 就传 null，我们照旧重新计算一次。
   * @type {null | (cb: (bossKey:string|null) => void) => (() => void) | void}
   */
  onBossDefeated: null,

  /**
   * ④ 玩家"受伤前"事件（闪避要用）。
   * cb(event, player)；需要能通过 cancelDamage(event) 取消这一次伤害。
   * @type {null | (cb: (event:any, player:any) => void) => (() => void) | void}
   */
  onBeforePlayerHurt: null,

  /**
   * ④ 取消一次伤害（配合 onBeforePlayerHurt）。可能是 event.cancel=true、
   * 也可能是返回 false、也可能是 event.damage=0 —— 由你按真实 API 实现。
   * @type {null | (event:any) => void}
   */
  cancelDamage: null,

  /**
   * ⑤ 命中 NPC 事件（吸血要用）。
   * cb(event, player)；event 里要能取到"本次实际造成的伤害"。
   * @type {null | (cb: (event:any, player:any) => void) => (() => void) | void}
   */
  onHitNpc: null,

  /**
   * ⑤ 从命中事件里取"实际伤害"（减伤/暴击结算之后的数值）。
   * 取不到就返回 0（我们会按"不回血"处理）。
   * @type {null | (event:any) => number}
   */
  readActualDamage: null,

  /**
   * ⑥ 施加属性加成。mods 形如：
   *   [{ id, stat:'damageReduction'|'defense'|'damageBonus', mode:'flat', value, source }]
   * 返回值会被我们原样保存，卸下/重算时交回 removeStatModifiers。
   * 要求：同一个 id 重复 apply 时必须是"替换"而不是"再叠一层"，或由你确保我们
   * 总是先 remove 再 apply（本模组就是这么做的，见 accessory.js）。
   * @type {null | (player:any, mods:Array<object>) => any}
   */
  applyStatModifiers: null,

  /**
   * ⑥ 撤销属性加成（传入 applyStatModifiers 的原始返回值）。
   * 必须能完全撤销，否则会"每帧重复叠加"。
   * @type {null | (player:any, handles:any) => void}
   */
  removeStatModifiers: null,

  /**
   * ⑦ 当前玩家对象。
   * @type {null | () => any}
   */
  getPlayer: null,

  /**
   * ⑦ 给玩家回血（吸血用）。amount 是整数点数。
   * @type {null | (player:any, amount:number) => void}
   */
  healPlayer: null,

  /**
   * ⑧ 某个 Boss 是否已被击败（读档后也要正确）。bossKey 见 config。
   * 注意：四柱可能要分别判定，也可能只有一个"已击败四柱"的标记 —— 按真实 API 处理。
   * @type {null | (player:any, bossKey:string) => boolean}
   */
  isBossDefeated: null,

  /**
   * ⑧ 本饰品是否已升级（持久化标记，读档后要还在）。
   * @type {null | (player:any) => boolean}
   */
  isUpgraded: null,

  /**
   * ⑧ 写入"已升级"标记（持久化）。
   * @type {null | (player:any) => void}
   */
  setUpgraded: null,

  /**
   * ⑧ 能否升级：机械三王已击败 + 材料足够 + 未升级。
   * 返回 boolean 或 { ok:boolean, reason?:string, missing?:Array<{key,name,need,have}> }
   * @type {null | (player:any, req: {requiredBosses:string[], materials:Array<object>}) => any}
   */
  canUpgrade: null,

  /**
   * ⑧ 扣材料。返回 { ok:boolean, missing?:Array } —— ok=false 表示材料不够，不要扣。
   * @type {null | (player:any, materials:Array<object>) => {ok:boolean, missing?:Array}}
   */
  consumeMaterials: null,

  /**
   * ⑨ 加载贴图（res 资源目录声明格式待确认）。
   * 返回什么我们不管，原样存着。
   * @type {null | (path:string, width:number, height:number) => any}
   */
  loadTexture: null,
};

/** 生成一条"待确认"错误（code=WGC_TODO，方便测试里断言） */
function todo(what, hint) {
  const err = new Error(
    `[WarriorGrowthCharm] TODO 待确认：${what}。` +
      `请在 src/adapters/bunnyApi.js 的 BINDINGS 里替换成 Bunny Loader 1.4.5.8 的真实 API。` +
      (hint ? ` 说明：${hint}` : '')
  );
  err.code = 'WGC_TODO';
  return err;
}

/**
 * 构造适配器。
 * @param {object} loader 加载器注入的对象（可以不用，仅为兼容不同入口风格）
 * @param {object} [overrides] 覆盖 BINDINGS 的项（测试 / 局部替换用）
 */
export function buildAdapter(loader, overrides = {}) {
  const b = { ...BINDINGS, ...overrides };

  const need = (name, what) => {
    const fn = b[name];
    if (typeof fn !== 'function') {
      throw todo(what, `BINDINGS.${name} 目前是 null，还没有对应实现`);
    }
    return fn;
  };

  const optional = (name) => (typeof b[name] === 'function' ? b[name] : null);

  const api = {
    loader,

    // ---------- 日志 / 时钟 / 随机数 ----------
    log(...args) {
      if (CONFIG.runtime.log) {
        // eslint-disable-next-line no-console
        console.log('[WGC]', ...args);
      }
    },
    warn(...args) {
      // eslint-disable-next-line no-console
      console.warn('[WGC]', ...args);
    },
    nowMs() {
      return typeof Date !== 'undefined' ? Date.now() : 0;
    },
    random: Math.random,
    /** 便于测试替换随机源（0 必闪避，0.999 必不闪避） */
    setRandom(fn) {
      api.random = typeof fn === 'function' ? fn : Math.random;
    },

    // ---------- 饰品 ----------
    registerAccessory(def) {
      const fn = need('registerAccessory', '① 饰品注册');
      const item = fn(def);
      // 贴图单独走一条路（可能和饰品注册不是同一个接口）
      const loadTexture = optional('loadTexture');
      let texture = null;
      if (loadTexture) {
        try {
          texture = loadTexture(CONFIG.texture.path, CONFIG.texture.width, CONFIG.texture.height);
        } catch (err) {
          api.warn('贴图加载失败（不影响属性逻辑）：', err && err.message ? err.message : err);
        }
      } else {
        api.warn('BINDINGS.loadTexture 未实现：贴图不会显示，但属性逻辑照常工作。');
      }
      return { item, texture };
    },

    // ---------- 事件订阅 ----------
    onEquip(cb) {
      return need('onAccessoryEquip', '② 饰品装备事件')(cb);
    },
    onUnequip(cb) {
      return need('onAccessoryUnequip', '② 饰品卸下事件')(cb);
    },
    /** 载入时查询是否已装备：未实现返回 null（= 不知道，只能等装备事件） */
    isEquipped(player) {
      const fn = optional('isAccessoryEquipped');
      if (!fn) return null;
      try {
        return !!fn(player);
      } catch (err) {
        api.warn('读取装备状态失败：', err && err.message ? err.message : err);
        return null;
      }
    },
    /** 可选：没有就返回 null，main.js 用轮询兜底 */
    onBossDefeated(cb) {
      const fn = optional('onBossDefeated');
      return fn ? fn(cb) : null;
    },
    onBeforePlayerHurt(cb) {
      const fn = optional('onBeforePlayerHurt');
      return fn ? fn(cb) : null;
    },
    cancelDamage(event) {
      const fn = optional('cancelDamage');
      if (!fn) {
        api.warn('cancelDamage 未实现：闪避判到了但没能取消伤害（见 BINDINGS.cancelDamage）。');
        return false;
      }
      fn(event);
      return true;
    },
    onHitNpc(cb) {
      const fn = optional('onHitNpc');
      return fn ? fn(cb) : null;
    },
    readActualDamage(event) {
      const fn = optional('readActualDamage');
      if (!fn) return 0;
      try {
        const v = Number(fn(event));
        return Number.isFinite(v) && v > 0 ? v : 0;
      } catch (err) {
        api.warn('readActualDamage 抛错，按 0 处理：', err && err.message ? err.message : err);
        return 0;
      }
    },

    // ---------- 属性 ----------
    applyStatModifiers(player, mods) {
      const fn = need('applyStatModifiers', '⑥ 属性加成写入');
      return fn(player, mods);
    },
    removeStatModifiers(player, handles) {
      const fn = need('removeStatModifiers', '⑥ 属性加成撤销');
      return fn(player, handles);
    },

    // ---------- 玩家 / 血量 ----------
    getPlayer() {
      const fn = need('getPlayer', '⑦ 取当前玩家');
      return fn();
    },
    healPlayer(player, amount) {
      const fn = optional('healPlayer');
      if (!fn) {
        api.warn('healPlayer 未实现：吸血的回血动作被跳过（见 BINDINGS.healPlayer）。');
        return false;
      }
      fn(player, amount);
      return true;
    },

    // ---------- Boss 进度 / 升级 ----------
    /**
     * 读取"已击败 Boss 集合 + 是否已升级"，喂给 calculateStats。
     * 单个 Boss 读取失败只跳过该项（不整体崩），但 BINDINGS 没实现会直接抛 WGC_TODO。
     */
    readContext(player) {
      const fn = need('isBossDefeated', '⑧ Boss 是否已击败');
      const defeated = new Set();
      for (const boss of CONFIG.genericGrowth.bosses) {
        try {
          if (fn(player, boss.key)) defeated.add(boss.key);
        } catch (err) {
          api.warn(`读取 Boss「${boss.name}」失败，按未击败处理：`, err && err.message ? err.message : err);
        }
      }
      const isUpgradedFn = optional('isUpgraded');
      let upgraded = false;
      if (isUpgradedFn) {
        try {
          upgraded = !!isUpgradedFn(player);
        } catch (err) {
          api.warn('读取升级标记失败，按未升级处理：', err && err.message ? err.message : err);
        }
      }
      return { defeatedBosses: defeated, upgraded };
    },

    canUpgrade(player) {
      const fn = optional('canUpgrade');
      if (!fn) return { ok: false, reason: 'BINDINGS.canUpgrade 未实现（待确认）' };
      const res = fn(player, {
        requiredBosses: CONFIG.upgrade.requiredBosses,
        materials: CONFIG.upgrade.materials,
      });
      if (typeof res === 'boolean') return { ok: res, reason: res ? 'ok' : 'not-ready' };
      return res || { ok: false, reason: 'unknown' };
    },
    consumeMaterials(player) {
      const fn = optional('consumeMaterials');
      if (!fn) return { ok: false, reason: 'BINDINGS.consumeMaterials 未实现（待确认）' };
      return fn(player, CONFIG.upgrade.materials) || { ok: false, reason: 'unknown' };
    },
    applyUpgrade(player) {
      const fn = need('setUpgraded', '⑧ 写入升级标记');
      fn(player);
    },

    // ---------- 调度 ----------
    /** 优先用加载器自己的定时器（如果它要求在主线程 tick 里跑） */
    setInterval(fn, ms) {
      const impl = optional('setInterval');
      if (impl) return impl(fn, ms);
      // TODO：待确认 —— 是否需要走加载器自己的 tick/调度器；这里用全局定时器兜底
      return globalThis.setInterval(fn, ms);
    },
    clearInterval(id) {
      const impl = optional('clearInterval');
      if (impl) return impl(id);
      return globalThis.clearInterval(id);
    },

    // ---------- 能力探测 ----------
    capabilities() {
      return {
        registerAccessory: typeof b.registerAccessory === 'function',
        equipEvents: typeof b.onAccessoryEquip === 'function' && typeof b.onAccessoryUnequip === 'function',
        equipStateQuery: typeof b.isAccessoryEquipped === 'function',
        bossEvents: typeof b.onBossDefeated === 'function',
        dodge: typeof b.onBeforePlayerHurt === 'function' && typeof b.cancelDamage === 'function',
        lifesteal: typeof b.onHitNpc === 'function' && typeof b.readActualDamage === 'function',
        heal: typeof b.healPlayer === 'function',
        stats: typeof b.applyStatModifiers === 'function' && typeof b.removeStatModifiers === 'function',
        upgrade: typeof b.canUpgrade === 'function' && typeof b.consumeMaterials === 'function',
        persistence: typeof b.isUpgraded === 'function' && typeof b.setUpgraded === 'function',
        texture: typeof b.loadTexture === 'function',
      };
    },
  };

  return api;
}

/**
 * 关于模块格式（待确认）：
 *   - 本仓库全部使用 ESM（import / export）。
 *   - 如果 Bunny Loader 1.4.5.8 只支持 CommonJS（require / module.exports），
 *     需要把每个文件的 export 改成 module.exports，并把 import 改成 require。
 *     这一步是机械替换，不影响逻辑；改完在 README 里记一笔。
 */
export default buildAdapter;