# `.bl` 打包说明（已核实结构）

`.bl` 就是一个标准 ZIP 容器，结构取自官方模组仓库里可用的成品包：

```
manifest.json          ← 必须在根目录
icon.png               ← 可选，模组列表图标
description.md         ← 可选，详情页说明
content/
├── main.js            ← manifest.entry = "main.js"（相对 content/ 解析）
├── Common/**          ← 普通 JS 模块（Config / Progress / Stats / Players）
└── Content/Items/...  ← ModItem 与**同名 .png** 贴图
```

证据：
- 官方 mod 索引 `index.json` 里每个模组的 `download.url` 指向 `.bl`，解压即为上述结构；
- 例如 Abuse Goblin 的 `.bl`：`manifest.json` + `content/main.js` + `content/Common/GlobalNPCs/*.js`
  + `content/Localization/*.json`，`manifest.blVersion = 2`、`entry = "main.js"`。

## 打包命令

```bash
npm run build          # = python3 scripts/build_bl.py
# 产物：dist/WarriorGrowthCharm-1.0.0.bl
```

脚本会自动：
1. 读 `manifest.json` 的 `version` 决定文件名；
2. 收集 `manifest.json` / `icon.png` / `description.md` / `content/**`；
3. 校验 `content/Content/Items/**.js` 是否有同名 `.png`（缺图直接报错，避免装上去白图）；
4. 用 deflate 打包（`.bl` 与 zip 兼容，`unzip -l` 可验证）。

## 发布

```bash
git tag v1.0.0 && git push origin v1.0.0
# 或在 GitHub Release 页面上传 dist/WarriorGrowthCharm-1.0.0.bl
```

`.gitignore` 已忽略 `dist/` 与 `*.bl`，成品走 Release，不进源码树。

## 常见坑

1. `manifest.entry` 是相对 `content/` 的路径，不是仓库根目录。
2. 物品贴图必须和 `.js` **同目录同名**（`WarriorGrowthCharm.js` ↔ `WarriorGrowthCharm.png`）。
3. 物品/ModPlayer 类由加载器扫描 `content/` 自动注册，不要在 `main.js` 里重复 new。
4. 打包后先 `unzip -l` 看一眼层级，再导入加载器。
