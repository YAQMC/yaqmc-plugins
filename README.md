# YAQMC 插件与开发示例

YAQMC 官方维护的独立插件示例仓库。插件需要在客户端设置中手动导入并启用。

- [可直接复制的起始模板](plugins/starter/)：无需安装依赖即可打包，内置 SDK 类型和离线中英文 API 文档。
- [API 总览与类型](plugins/starter/API.md) · [歌词工具栏 API](plugins/starter/api/docs/zh-CN/plugin-lyrics-api.md)
- [全部插件源码](plugins/) · [可直接导入的插件包](plugins/packages/)
- [客户端](https://github.com/YAQMC/YAQMC) · [网站](https://yaqmc.github.io/)

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

客户端的 SDK、WIT 和 API 文档是接口定义来源。本仓库每 15 分钟检查客户端 `main`，验证后同步生成文件；GitHub 定时任务可能延迟，也可手动触发。工作流仅使用本仓库的 `GITHUB_TOKEN`。`UPSTREAM.json` 记录对应客户端提交，`plugins/starter/api/contract.json` 记录接口与文档哈希；模板业务代码不会被同步覆盖。手动重建镜像可运行 `npm run api:sync`，校验可运行 `npm run api:check`，拉取最新接口可运行 `npm run api:sync -- --latest`。

仓库及 SDK 默认遵循 GPL-3.0-or-later；可复制模板自身使用其目录中的 MIT 许可。原始来源和许可见 [NOTICE.md](NOTICE.md)、[LICENSE](LICENSE) 与模板中的许可文件。
