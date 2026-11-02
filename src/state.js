/**
 * 运行期状态簿记（不是属性来源！属性永远由 stats.js 从"已击败集合"现算）。
 *
 * 这里只做两件事：
 *  1. 记录上一帧看到的"已击败集合"，算出这一帧新击败了谁（用于一次性提示 / 打日志 / 触发刷新）；
 *  2. 给"每击败一个 Boss 只结算一次"提供一份可断言的本地账本
 *     （真正的防重复叠加靠"属性 = f(已击败集合)"这个纯函数性质，见 README）。
 */

/** Boss 进度账本 */
export class BossProgress {
  /** @param {Iterable<string>} [initialKeys] */
  constructor(initialKeys = []) {
    this.defeated = new Set(initialKeys);
  }

  /**
   * 用最新的已击败集合刷新账本。
   * @param {Iterable<string>} nextKeys
   * @returns {string[]} 本次新增的 key（已经记过的不再返回 → 每个 Boss 只结算一次）
   */
  sync(nextKeys) {
    const next = nextKeys instanceof Set ? nextKeys : new Set(nextKeys || []);
    const added = [];
    for (const key of next) {
      if (!this.defeated.has(key)) added.push(key);
    }
    // 只增不减：即使某次读取失败返回空集合，也不会把已记录的进度"退回"
    for (const key of added) this.defeated.add(key);
    return added;
  }

  has(key) {
    return this.defeated.has(key);
  }

  get count() {
    return this.defeated.size;
  }

  /** 读档/重载后恢复用 */
  serialize() {
    return [...this.defeated];
  }

  static deserialize(keys) {
    return new BossProgress(keys || []);
  }
}

export default BossProgress;