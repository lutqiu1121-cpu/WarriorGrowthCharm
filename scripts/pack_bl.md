# `.bl` 打包说明

> ⚠️ **待确认**：Bunny Loader 1.4.5.8 的官方 `.bl` 打包命令我不确定，
> 下面不写"看起来像真的"的命令。请你从加载器作者处/官方文档拿到命令后，
> 替换下面的 `TODO_PACK_COMMAND`。

## 1. 打包前必须确认的三件事

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| `.bl` 打包命令 | **待确认** | 可能是 GUI 按钮导出，也可能是 CLI 工具；两者的产物应当等价 |
| `.bl` 是不是 zip 容器 | **待确认** | 如果是 zip，`unzip -l` 能列目录；如果不是，不要手工改后缀 |
| `res/` 在包内的层级 | **待确认** | 见 `res/README.md` 第 3 节 |

## 2. 打包内容清单（无论命令是什么，这几样必须在包里）

```
manifest.json          ← 根目录，必须
src/main.js            ← entry（manifest.entry 指向它）
src/config.js
src/stats.js
src/state.js
src/accessory.js
src/runtime.js
src/tooltip.js
src/adapters/bunnyApi.js
res/WarriorGrowthCharm.png   ← 贴图，别漏
```

不用打进去的：

- `scripts/`（`summary.mjs`、`verify.mjs` 是开发期工具）
- `README.md`、`LICENSE`、`.gitignore`、`package.json`
- `node_modules/`（本项目零依赖）
- `src/adapters/mockApi.js`（只在离线自测里用；如果你想一起发也可以，不影响运行）

## 3. 打包步骤（骨架，命令待确认）

```bash
# 0) 先在本地把逻辑测通（不需要游戏）
node scripts/verify.mjs      # 期望：27 项通过，0 项失败
node scripts/summary.mjs     # 打印满级汇总表，核对数值

# 1) 检查贴图就位
ls -l res/WarriorGrowthCharm.png

# 2) 打包（命令待确认）
# TODO_PACK_COMMAND
# 例如：<加载器工具> pack --src . --out dist/WarriorGrowthCharm.bl
#       如果加载器只提供 GUI：导入本文件夹 → Build/Export → 选 .bl

# 3) 产物检查（如果是 zip 容器）
unzip -l dist/WarriorGrowthCharm.bl   # 待确认：能列目录说明是 zip
```

## 4. 常见坑

1. **贴图没打进去**：`res/` 是资源目录，有些打包器默认只收集 `src/`，要手动加 `res/**`。
2. **manifest 字段过严**：见 `manifest.json` 的 `_notes`，本仓库的 `entry/gameVersion/type/resources` 都是待确认字段。
3. **路径大小写**：Windows 上不区分、Android/Linux 区分。贴图引用写 `res/WarriorGrowthCharm.png` 就别写成 `Res/...`。
4. **ESM vs CommonJS**：本仓库是 ESM（`import/export`）。加载器若只认 `require`，先做机械替换再打包，见 `src/adapters/bunnyApi.js` 文件末尾说明。
5. **重复打包导致旧文件残留**：先清 `dist/`，避免把上一版的文件带进新包。

## 5. 发布到 GitHub 的建议

```bash
git init
git add .
git commit -m "feat: WarriorGrowthCharm 1.0.0"
git branch -M main
git remote add origin git@github.com:<你>/WarriorGrowthCharm.git
git push -u origin main
```

- Release 里附 `.bl` 文件 + 一张满级属性截图；
- Release 说明里写清"需要 Bunny Loader 1.4.5.8"；
- 如果加载器有创意工坊类渠道，`.bl` 直接上传即可（待确认是否还有额外审核）。

## 6. 兼容性声明模板（可粘进 Release）

> 依赖 Bunny Loader 1.4.5.8。属性数值集中在 `src/config.js`，升级材料**待平衡**。
> 减伤满级实测 **37%**（目标 40%，差 3 个百分点，原因与调整方法见 README）。