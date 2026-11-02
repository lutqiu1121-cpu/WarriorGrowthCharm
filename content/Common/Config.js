/**
 * WarriorGrowthCharm —— 全部可调数值集中在本文件。
 *
 * 单位约定：百分比一律用小数（1% = 0.01）；防御是整数。
 * 改平衡只改这里，不要改 Stats.js 的加总逻辑。
 *
 * 关于 `flag` 字段（Bunny Loader / tModLoader 语义的真实 Boss 标记）：
 *  - 取自 Terraria.NPC 上的 downed* 布尔量，或 Terraria.Main.hardMode；
 *  - 世界吞噬者与克苏鲁之脑在游戏里**共用** downedBoss2，只有一个标记，
 *    所以这两个条目最多只能各算 1 次，但实际只会有 1 个被计入（去重规则见 Stats.js）。
 */

export const CONFIG = {
  meta: {
    id: 'warrior-growth-charm',
    name: '战士成长饰品拓展',
    version: '1.0.0',
  },

  // 贴图：与 js 同目录同名 .png（content/Content/Items/Accessories/*.png）
  // 换图 = 覆盖 PNG，保持文件名与尺寸（32x32），不需要改代码。
  texture: {
    size: 32,
    base: 'WarriorGrowthCharm',
    awakened: 'AwakenedWarriorGrowthCharm',
  },

  // 饰品初始属性：1% 减伤 / 4 防御 / 4% 伤害
  base: {
    damageReduction: 0.01,
    defense: 4,
    damageBonus: 0.04,
  },

  // 通用 Boss 成长：每击败一个 Boss → +1 防御 / +1% 伤害 / +0.5% 闪避
  genericGrowth: {
    defensePerBoss: 1,
    damagePerBoss: 0.01,
    dodgePerBoss: 0.005,
    // 四柱是否计入"每 Boss"成长（true = 四根各算 1 个）
    pillarsCountForGenericGrowth: true,
    // 手动补计（不在这张表里的 Boss，想算几个写几个）
    extraBossCount: 0,
    bosses: [
      { key: 'eaterOfWorlds', name: '世界吞噬者', flag: 'downedBoss2' },
      { key: 'brainOfCthulhu', name: '克苏鲁之脑', flag: 'downedBoss2' },
      { key: 'wallOfFlesh', name: '血肉墙', flag: 'hardMode' },
      { key: 'plantera', name: '世纪之花', flag: 'downedPlantBoss' },
      { key: 'lunaticCultist', name: '拜月教徒', flag: 'downedAncientCultist' },
      { key: 'pillarSolar', name: '日耀柱', flag: 'downedTowerSolar', pillars: true },
      { key: 'pillarVortex', name: '星旋柱', flag: 'downedTowerVortex', pillars: true },
      { key: 'pillarNebula', name: '星云柱', flag: 'downedTowerNebula', pillars: true },
      { key: 'pillarStardust', name: '星尘柱', flag: 'downedTowerStardust', pillars: true },
      { key: 'moonLord', name: '月亮领主', flag: 'downedMoonlord' },
      { key: 'destroyer', name: '毁灭者（机械三王）', flag: 'downedMechBoss1' },
      { key: 'twins', name: '双子魔眼（机械三王）', flag: 'downedMechBoss2' },
      { key: 'skeletronPrime', name: '机械骷髅王（机械三王）', flag: 'downedMechBoss3' },
    ],
  },

  // 环境 Boss 减伤
  // mode 'total'：三个合计最多 +4%（按已击败标记数均分；因 evil Boss 共用标记，
  //               实际最多只能吃到 2/3 × 4% ≈ 2.67%）
  // mode 'each' ：每个 +4%
  environmentReduction: {
    mode: 'total',
    total: 0.04,
    each: 0.04,
    bosses: ['eaterOfWorlds', 'brainOfCthulhu', 'wallOfFlesh'],
  },

  // 特殊减伤（按 Boss 逐个配置）
  specialReduction: {
    plantera: 0.05,
    lunaticCultist: 0.05,
    pillars: {
      pillarSolar: 0.025,
      pillarVortex: 0.025,
      pillarNebula: 0.025,
      pillarStardust: 0.025,
    },
    moonLord: 0.1,
    upgraded: 0.02,
  },

  // 闪避（升级后解锁，硬上限 12%）
  dodge: {
    baseAfterUpgrade: 0.05,
    plantera: 0.01,
    perPillar: 0.01,
    allPillarsBonus: 0.01,
    hardCap: 0.12,
  },

  // 升级：机械三王后，用「觉醒饰品」合成（消耗基础饰品 + 神圣锭 + 三魂）
  upgrade: {
    requiredBosses: ['destroyer', 'twins', 'skeletronPrime'],
    materials: [
      { key: 'hallowedBar', name: '神圣锭', amount: 10 },
      { key: 'soulOfMight', name: '力量之魂', amount: 5 },
      { key: 'soulOfSight', name: '视野之魂', amount: 5 },
      { key: 'soulOfFright', name: '恐惧之魂', amount: 5 },
    ],
    balanceNote: '待平衡：材料数量为占位',
    gains: {
      damageReduction: 0.02,
      damageBonus: 0.05,
      defense: 5,
    },
  },

  // 吸血（升级后解锁）
  lifesteal: {
    enabled: true,
    percentOfActualDamage: 0.01,
    cooldownMs: 200,
    minHeal: 1,
  },

  // 调试日志
  debug: false,
};

export default CONFIG;