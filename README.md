# YAQMC 插件与开发示例

YAQMC 官方维护的独立插件示例仓库。插件需要在客户端设置中手动导入并启用。

- [可直接复制的起始模板](plugins/starter/)：无需安装依赖即可打包，内置 SDK 类型和离线中英文 API 文档。
- [API 总览与类型](plugins/starter/API.md) · [歌词工具栏 API](plugins/starter/api/docs/zh-CN/plugin-lyrics-api.md)
- [全部插件源码](plugins/) · [可直接导入的插件包](plugins/packages/)
- [客户端](https://github.com/YAQMC/YAQMC) · [网站](https://yaqmc.github.io/)
- [本地文件管理 API v5](docs/zh-CN/plugin-files-api.md) · [文件管理示例](plugins/script-files/)

复制 `plugins/starter`，修改插件 ID、名称和 `main.js`，然后使用 Node.js 26.7 或更新版本执行 `node pack.mjs`，从 `dist/` 取得 `.yaqmc-plugin`。

完整仓库的构建命令：

```sh
npm ci
npm run pack
npm test
# 安装 Rust 1.88+ 和 wasm32-wasip2 target 后：
npm run provider:catalog
npm run provider:platform
```

本仓库维护 [SDK 类型](sdk/plugin/src/index.ts)、[开发文档](docs/plugin-development.md)与[中文文档](docs/zh-CN/plugin-development.md)。客户端仅保留插件宿主实现和运行时 WIT 协议。本仓库每 15 分钟检查客户端 `main`，更新 WIT 副本、接口哈希和模板离线文档；GitHub 定时任务可能延迟，也可手动触发。工作流仅使用本仓库的 `GITHUB_TOKEN`。`UPSTREAM.json` 记录对应客户端提交，`plugins/starter/api/contract.json` 分别记录客户端实现和本仓库 SDK/文档的哈希。修改 API 时，应同时维护本仓库的 SDK 与开发文档；离线副本由工具生成，不手工修改。

在本仓库运行 `npm run api:sync` 重建离线副本，`npm run api:check` 校验同步状态，`npm run api:sync -- --latest` 拉取最新客户端协议。同步工具本身也由本仓库维护，客户端不再承担插件示例或网站维护任务。

同时开发客户端 API 时，可用 `npm run api:sync -- --client ../YAQMC` 读取本地工作区（含未提交改动），
再用 `npm run api:check -- --client ../YAQMC` 校验；默认命令仍使用 `UPSTREAM.json` 固定的上游提交。

仓库及 SDK 默认遵循 GPL-3.0-or-later；可复制模板自身使用其目录中的 MIT 许可。原始来源和许可见 [NOTICE.md](NOTICE.md)、[LICENSE](LICENSE) 与模板中的许可文件。
