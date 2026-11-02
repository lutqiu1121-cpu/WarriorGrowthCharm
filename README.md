# 战士成长饰品拓展（WarriorGrowthCharm）

一件占饰品栏的战士饰品，随 Boss 进度成长：减伤 / 防御 / 伤害 / 闪避 / 吸血。
击败机械三王、集齐神圣锭与三魂后，可合成**觉醒版**，额外 +2% 减伤 / +5% 伤害 / +5 防御，并解锁闪避与吸血。

- 数值全部在 `content/Common/Config.js`
- 属性计算集中在 `content/Common/Stats.js` 的 `calculateStats(defeated, upgraded)`（纯函数）
- 真实 API：`ModItem` / `ModPlayer` / `ModContent` / `Terraria.NPC.downed*`，没有任何占位接口

## 安装

1. 打开 Bunny Loader 的模组管理 → 导入/安装 → 选 `WarriorGrowthCharm-1.0.0.bl`；
2. 启用后进游戏，在铁砧用 **12 铁/铅锭 + 1 生命水晶** 做出基础饰品；
3. 戴上即可看到面板变化（`+4 防御`、伤害 `+4%`、受伤 `-1%`）。

`.bl` 就是 ZIP 容器：根目录 `manifest.json` + `content/main.js`（`manifest.entry` 相对 `content/`）。
本地重新打包：`npm run build`（= `python3 scripts/build_bl.py`）。

## 结构

```
manifest.json                 # uid / id / version / entry / blVersion 2
icon.png                      # 模组列表图标
description.md                # 商店/详情页说明
content/
├── main.js                   # 入口：export default class ... extends Mod
├── Common/
│   ├── Config.js             # ★ 全部数值 + Boss 标记表
│   ├── Progress.js           # 读 NPC.downed* / Main.hardMode
│   ├── Stats.js              # ★ calculateStats + 逐项拆解
│   └── Players/WarriorGrowthPlayer.js   # 属性写入 / 闪避 / 吸血
└── Content/Items/Accessories/
    ├── WarriorGrowthCharm.js            # 基础款 + 获取配方
    ├── WarriorGrowthCharm.png           # 32x32 贴图
    ├── AwakenedWarriorGrowthCharm.js    # 觉醒款 + 升级配方
    └── AwakenedWarriorGrowthCharm.png
```

## 数值（满级）

满级 = 13 个 Boss 全清 + 已觉醒。**因为世界吞噬者与克苏鲁之脑共用 `NPC.downedBoss2`，
实际只能算 12 个独立标记**（下面按真实可达到的上限算）：

| 项 | 满级 |
| --- | --- |
| 减伤 | 35.67%（基础 1% + 环境 2.67% + 世纪之花 5% + 拜月教徒 5% + 四柱 10% + 月总 10% + 觉醒 2%） |
| 防御 | +21（4 + 12 + 5） |
| 伤害 | +21%（4% + 12% + 5%） |
| 闪避 | 原始 17% → **封顶 12%** |
| 吸血 | 实际伤害 1%，冷却 200ms |

> 与目标 40% 的差异：真实标记上限只有 12 个 Boss、环境 Boss 只有 2 个独立标记，
> 所以比原设计表少 3.67 个百分点。要补到 40%：把世纪之花/拜月教徒各提到 6.8%（只改 Config）。

## 机制

- **每个 Boss 只加一次**：属性是 `f(已击败标记集合)` 的一次性映射，不是历史累加。
- **读档不叠加**：进度读的是 `NPC.downed*`（世界级存档数据），戴上即按当前进度算一次。
- **每 tick 不重复叠加**：`ResetEffects` 里重算并写入；引擎每 tick 会重置这些字段，因此不会累加。
- **卸下即失效**：下一 tick 不再写入，加成自动消失，无残留。
- **闪避**：`ModPlayer.FreeDodge(...)` 返回 `true` 取消本次伤害。
- **吸血**：`ModPlayer.OnHitNPC(player, target, hit, damageDone)`，按 `damageDone` 计算并带 200ms 冷却。

## 待确认（我没瞎写的地方）

- `gameVersion: [301720, 301720]` 抄自同期官方模组；1.4.5.8 对应的确切构建号未核实。
- `ItemID.SoulofMight/Sight/Fright`、`HallowedBar` 用的是原版常量名，并带了数字回退（524/523/525/122）。
- 物品贴图按同目录同名 `.png` 自动加载（与 LanternSlot 等官方模组一致）；若你的加载器版本要求显式
  `this.Texture = '...'`，在 `SetDefaults()` 里加一行即可。
- 制作站假定为铁砧（获取配方）与秘银砧（觉醒配方）。

## 测试清单

- [ ] 装上饰品：面板 +4 防御、伤害 +4%，受伤 -1%
- [ ] 击败世界吞噬者或克苏鲁之脑：防御/伤害只 +1（共用标记，不会 +2）
- [ ] 进入困难模式（血肉墙）：减伤 +≈1.33%
- [ ] 击败世纪之花：减伤 +5%
- [ ] 四柱各 +2.5% 减伤；第 4 根额外 +1% 闪避
- [ ] 未觉醒：不闪避、不吸血
- [ ] 觉醒配方：基础饰品 + 10 神圣锭 + 三魂各 5 → 觉醒版（材料确实被扣）
- [ ] 觉醒后：减伤/伤害/防御各 +2%/+5%/+5，闪避与吸血生效
- [ ] 闪避概率长时间统计 ≈ 12%（封顶生效）
- [ ] 高频武器吸血约 5 次/秒上限
- [ ] 卸下饰品：全部加成消失
- [ ] 读档后：属性与存档前一致，不是双倍

## 换贴图

直接覆盖同名 PNG，保持 32x32，不改代码：

- `content/Content/Items/Accessories/WarriorGrowthCharm.png`
- `content/Content/Items/Accessories/AwakenedWarriorGrowthCharm.png`
- `icon.png`（模组列表图标，128x128）

占位图由 `python3 scripts/make_textures.py` 生成（手写 PNG，零依赖）。

## 已知边界（写清楚，不装）

- 世界吞噬者 / 克苏鲁之脑只有一个原版标记，无法区分先打的是谁；两者合计只 +1 个 Boss 的量。
- 血肉墙没有独立标记，用 `Main.hardMode` 近似。
- 防御/减伤/伤害写在 `ResetEffects`，依赖"引擎每 tick 重置"的 tModLoader 语义；
  若某些版本不重置，需改成先减掉上一 tick 的增量（结构已预留，见 `WarriorGrowthPlayer.js` 注释）。
- 版本号 `gameVersion: [301720, 301720]` 抄自同期官方模组，未逐版本核实。

## 许可

MIT（见 LICENSE）。Terraria 为 Re-Logic 商标，本项目为非官方模组。