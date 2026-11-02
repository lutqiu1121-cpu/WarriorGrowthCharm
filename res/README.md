# res/ 资源目录

## 1. 贴图占位

本仓库**不包含二进制文件**，所以 `res/WarriorGrowthCharm.png` 目前不存在，需要你自己放一张：

- 文件名：`WarriorGrowthCharm.png`（必须一模一样，大小写敏感）
- 尺寸：`32x32`（默认配置）或 `16x16`；改了尺寸要同步改 `src/config.js` 的 `texture.width / height`
- 内容：纯空白 PNG 就能先跑通流程

**贴图待替换：画好后直接把新 PNG 覆盖为 `res/WarriorGrowthCharm.png`，文件名和尺寸保持不变，不需要改代码。**

代码里的贴图路径就是配置项 `CONFIG.texture.path`（默认 `res/WarriorGrowthCharm.png`），
所以换图 = 覆盖文件，不动代码。

## 2. 打包时要带上 res/

`.bl` 打包必须把整个 `res/` 目录打进去，否则进游戏是一张白图（或直接报错）。
具体打包命令待确认，见 `scripts/pack_bl.md`。

## 3. 资源声明 —— TODO：待确认 res 资源声明格式

TODO：待确认 res 资源声明格式

需要确认的点（我无法从公开信息确定 Bunny Loader 1.4.5.8 的真实规范，所以不编造）：

1. `res/` 下的贴图是否需要一份资源清单（例如 `res/manifest.json`、`resources.json`、`index.json`）？
2. 如果需要，清单里贴图的路径是相对模组根目录（`res/x.png`）还是相对 `res/`（`x.png`）？
3. 路径分隔符要用 `/` 还是 `\`？是否区分大小写？
4. 是否需要在根 `manifest.json` 里声明资源（本仓库当前的 `resources.texture` 只是占位，字段名未确认）？
5. `.bl` 是 zip 容器还是自定义格式？如果 `res/` 需要在压缩包里保持固定层级，层级是什么？

确认后请：
- 在本文件补上真实格式；
- 删掉代码里 `src/adapters/bunnyApi.js` 中 `loadTexture` 的 TODO 注释并实现；
- 同步更新根 `manifest.json` 的 `resources` 字段。

## 4. 不要做的事

- 不要把 `.bl` 成品塞进 `res/`（那是打包产物，见 `scripts/pack_bl.md`，输出目录在仓库外或 `dist/` 并加进 `.gitignore`）。
- 不要在这里放生成脚本产出的临时文件。