/**
 * 模组入口（manifest.entry = "main.js"，相对 content/ 目录）。
 *
 * 物品 / ModPlayer 由加载器按 content/ 目录自动注册，这里只做启动自检与日志。
 */

import { CONFIG } from './Common/Config.js';
import { readDefeated } from './Common/Progress.js';
import { calculateStats } from './Common/Stats.js';

export default class WarriorGrowthCharmMod extends Mod {
  Load() {
    try {
      const stats = calculateStats(readDefeated(), false);
      bl.log(
        `[WGC] 战士成长饰品已加载｜当前已击败 Boss ${stats.bossCount} 个` +
          `｜未觉醒属性：减伤 ${(stats.damageReduction * 100).toFixed(2)}% / 防御 ${stats.defense} / 伤害 ${(
            stats.damageBonus * 100
          ).toFixed(2)}%`
      );
      if (CONFIG.debug) bl.log('[WGC] debug 模式开启');
    } catch (e) {
      bl.log('[WGC] 启动自检失败：' + (e && e.message ? e.message : e));
    }
  }
}