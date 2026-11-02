/**
 * WarriorGrowthCharm（战士成长饰品拓展）—— 全部可调数值集中在这里。
 *
 * 约定：
 *  - 百分比一律用小数：1% = 0.01，2.5% = 0.025；
 *  - 防御用整数；
 *  - 改平衡只改本文件，不要改 stats.js 的计算逻辑
 *    （stats.js 只负责"把这里的表按已击败 Boss 加总"）。
 *
 * 本文件不引用任何 Bunny Loader API，纯数据，可单独用 Node 跑（见 scripts/summary.mjs）。
 */

export const CONFIG = {
  // ---------------------------------------------------------------------------
  // 元信息
  // ---------------------------------------------------------------------------
  meta: {
    id: 'warrior-growth-charm',
    name: '战士成长饰品拓展',
    internalName: 'WarriorGrowthCharm',
    version: '1.0.0',
    // TODO：待确认 —— 作者名/仓库地址按你自己的 GitHub 填
    author: 'YOUR_GITHUB_NAME',
  },

  // ---------------------------------------------------------------------------
  // 贴图 / 资源
  // ---------------------------------------------------------------------------
  texture: {
    // 换图：把新 PNG 直接覆盖成 res/WarriorGrowthCharm.png，文件名与尺寸保持不变，
    // 不需要改代码（路径就从这里读）。
    path: 'res/WarriorGrowthCharm.png',
    width: 32,
    height: 32,
    // TODO：待确认 —— Bunny Loader 1.4.5.8 的 res 资源目录声明格式 / 是否需要资源清单，
    // 见 res/README.md 与 src/adapters/bunnyApi.js 的 loadTexture()。
  },

  // ---------------------------------------------------------------------------
  // 饰品本体
  // ---------------------------------------------------------------------------
  accessory: {
    name: '战士成长饰品',
    // TODO：待确认 —— 1.4.5.8 里"饰品栏"槽位标识到底是字符串、枚举还是数字索引。
    slot: 'accessory',
  },

  // ---------------------------------------------------------------------------
  // 初始属性（1% 减伤 / 4 防御 / 4% 伤害）
  // ---------------------------------------------------------------------------
  base: {
    damageReduction: 0.01,
    defense: 4,
    damageBonus: 0.04,
  },

  // ---------------------------------------------------------------------------
  // 通用 Boss 成长：每击败一个 Boss → +1 防御 / +1% 伤害 / +0.5% 闪避
  // ---------------------------------------------------------------------------
  genericGrowth: {
    defensePerBoss: 1,
    damagePerBoss: 0.01,
    dodgePerBoss: 0.005,

    // 四柱是否计入"每 Boss +1 防御 / +1% 伤害 / +0.5% 闪避"。
    // true  = 每根柱子各算 1 个 Boss（默认，四柱合计算 4 个）
    // false = 四柱完全不计入通用成长（只吃下文的特殊减伤/闪避）
    pillarsCountForGenericGrowth: true,

    // 手动补计：不在下面列表里、但你想算成"已击败 Boss"的数量。
    // 例如以后加了新 Boss，懒得写进列表就把它加进这个数字。
    extraBossCount: 0,

    // 通用 Boss 列表。key 是内部标识（要和 bunnyApi.js 的判定表对上），
    // 加一条就多一个"每 Boss"成长位；删一条就少一个。
    bosses: [
      { key: 'eaterOfWorlds', name: '世界吞噬者', note: '“蠕虫”指世界吞噬者，不是毁灭者' },
      { key: 'brainOfCthulhu', name: '克苏鲁之脑' },
      { key: 'wallOfFlesh', name: '血肉墙' },
      { key: 'plantera', name: '世纪之花' },
      { key: 'lunaticCultist', name: '拜月教徒' },
      { key: 'pillarSolar', name: '日耀柱', pillars: true },
      { key: 'pillarVortex', name: '星旋柱', pillars: true },
      { key: 'pillarNebula', name: '星云柱', pillars: true },
      { key: 'pillarStardust', name: '星尘柱', pillars: true },
      { key: 'moonLord', name: '月亮领主' },
      { key: 'destroyer', name: '毁灭者（机械三王之一）' },
      { key: 'twins', name: '双子魔眼（机械三王之一）' },
      { key: 'skeletronPrime', name: '机械骷髅王（机械三王之一）' },
    ],
  },

  // ---------------------------------------------------------------------------
  // 环境 Boss 减伤：世界吞噬者 / 克苏鲁之脑 / 血肉墙
  // mode = 'total' ：三个合计最多 +total（按已击败个数均分，每个 0.04/3 ≈ 1.33%）
  // mode = 'each'  ：每个各 +each（三个全击败 = 12%）
  // 想改成"每个 +4%"只把 mode 改成 'each' 即可，不用动代码。
  // ---------------------------------------------------------------------------
  environmentReduction: {
    mode: 'total',
    total: 0.04,
    each: 0.04,
    bosses: ['eaterOfWorlds', 'brainOfCthulhu', 'wallOfFlesh'],
  },

  // ---------------------------------------------------------------------------
  // 特殊减伤（按 Boss 逐个配置；value 是该 Boss 被击败后提供的减伤）
  // ---------------------------------------------------------------------------
  specialReduction: {
    plantera: 0.05, // 世纪之花 +5%
    lunaticCultist: 0.05, // 拜月教徒 +5%
    pillars: {
      // 四柱各 +2.5%
      pillarSolar: 0.025,
      pillarVortex: 0.025,
      pillarNebula: 0.025,
      pillarStardust: 0.025,
    },
    moonLord: 0.1, // 月亮领主 +10%
    upgraded: 0.02, // 升级后额外 +2%
  },

  // ---------------------------------------------------------------------------
  // 闪避（升级后解锁）
  // ---------------------------------------------------------------------------
  dodge: {
    unlockAfterUpgrade: true,
    baseAfterUpgrade: 0.05, // 解锁即 5%
    plantera: 0.01, // 世纪之花 +1%
    perPillar: 0.01, // 每根柱子 +1%
    allPillarsBonus: 0.01, // 四柱全部打完再 +1%
    hardCap: 0.12, // 硬上限 12%（Math.min(0.12, ...)）
  },

  // ---------------------------------------------------------------------------
  // 升级：击败机械三王后，消耗 神圣锭 + 三魂
  // ---------------------------------------------------------------------------
  upgrade: {
    // 升级前置：这三个都击败（顺序无关）
    requiredBosses: ['destroyer', 'twins', 'skeletronPrime'],
    materials: [
      // 数量为默认占位，待平衡
      { key: 'hallowedBar', name: '神圣锭', amount: 10 },
      { key: 'soulOfMight', name: '力量之魂', amount: 5 },
      { key: 'soulOfSight', name: '视野之魂', amount: 5 },
      { key: 'soulOfFright', name: '恐惧之魂', amount: 5 },
    ],
    balanceNote: '待平衡：材料数量只是占位，正式发布前按强度自行调整',
    // 升级后额外获得（减伤 +2% / 伤害 +5% / 防御 +5，并解锁闪避与吸血）
    gains: {
      damageReduction: 0.02,
      damageBonus: 0.05,
      defense: 5,
    },
  },

  // ---------------------------------------------------------------------------
  // 吸血（升级后解锁）：命中敌人回复"实际伤害的 1%"，内置冷却 0.2 秒
  // ---------------------------------------------------------------------------
  lifesteal: {
    enabled: true,
    unlockAfterUpgrade: true,
    percentOfActualDamage: 0.01, // 按"实际造成伤害"（减伤/暴击之后）结算
    cooldownMs: 200, // 0.2 秒冷却，防高频武器失控
    minHeal: 1, // 单次至少回 1 点，避免小数血量
    // 是否对"伤害 ≤ 0"的命中（如免疫）回血：false = 不回
    requirePositiveDamage: true,
  },

  // ---------------------------------------------------------------------------
  // 运行时（这几个不是平衡数值，是性能/调试开关）
  // ---------------------------------------------------------------------------
  runtime: {
    // 没有 Boss 击败事件时的轮询兜底间隔（毫秒）；有事件时只做保险，不靠它
    pollIntervalMs: 1000,
    // 打印调试日志
    log: false,
  },
};

export default CONFIG;