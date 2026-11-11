# YAQMC 插件 example

此目录可以单独复制、改名和分发，不依赖 YAQMC 仓库、npm 安装或 TypeScript 编译器。
需要包含 `ui.lyrics` API 的 YAQMC 构建；旧版宿主无法识别这个新增权限。

1. 修改 `manifest.json` 的 `id`、名称和版本。发布自己的插件时请使用自己的反向域名 ID。
2. 编辑 `main.js`。它是宿主 `definePlugin` 执行的普通 JavaScript，不能使用 ESM import/export。
3. 安装 Node.js 26.7 或更新版本，在此目录执行 `npm run pack`（也可直接 `node pack.mjs`）。
4. 在 YAQMC 设置 → 插件中导入 `dist/*.yaqmc-plugin`，核对权限并启用。
5. 打开歌词页，顶部将出现最小化、最大化/还原、关闭与歌曲信息按钮。

窗口操作只在用户点击后执行，关闭遵循应用本身的托盘设置。不支持窗口控制的宿主隐藏窗口按钮。
窗口按钮默认透明，悬停或键盘聚焦时显示；当前宿主内置窗口控件可用时，示例注册复用这些控件。
禁用插件后插件动作自动清理，宿主内置窗口按钮继续保留。顶部拖动区域由应用提供，不依赖插件。

从 [API.md](API.md) 查阅 API 总览、权限与全部 SDK 类型。详细离线文档位于 `api/docs/`，
中文入口为 [插件开发](api/docs/zh-CN/plugin-development.md)和
[歌词工具栏 API](api/docs/zh-CN/plugin-lyrics-api.md)。`api/sdk.ts` 可提供编辑器类型提示。

本模板位于独立的 [YAQMC/yaqmc-plugins](https://github.com/YAQMC/yaqmc-plugins) 仓库。SDK、开发文档和同步工具均由插件仓库维护；WIT 副本和接口哈希从客户端同步。`UPSTREAM.json` 与 API 契约记录来源；在插件仓库运行 `npm run api:check` 可核验离线副本。

示例插件代码采用本目录的 MIT 许可。`api/` 中复制的 YAQMC SDK、WIT 与文档遵循 YAQMC 原许可，
见 `api/YAQMC-LICENSE`（GPL-3.0-or-later）。
