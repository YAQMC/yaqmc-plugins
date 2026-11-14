# Provider 本地音频文件

> [English](../plugin-provider-local-files.md) | **简体中文**

这是 **manifest v2 / Provider API v3** 的增量扩展，与 Worker API v5 的 `ctx.files` 分开。
旧 v3 world/导出不变。需支持本扩展的客户端，旧版不接受新增能力。
在 `provider.capabilities` 和 `permissions` 中同时声明敏感能力 `provider.localFiles`，并声明
`provider.catalog`，播放时再声明 `provider.playback`。权限审核不等于目录已授权，仍需系统选择器。
仅提供只读临时目录句柄，guest 不接收绝对路径或 Android URI。

| World                                  | 导入                   | 配套权限                      |
| -------------------------------------- | ---------------------- | ----------------------------- |
| `provider-local-files`                 | utilities、local-files | provider.localFiles           |
| `provider-local-files-storage`         | 另加 storage           | 另加 plugin.storage           |
| `provider-local-files-network`         | 另加 network           | 另加精确 network:https://host |
| `provider-local-files-network-storage` | 另加 storage、network  | 另加存储和网络权限            |

world 与清单权限精确匹配。这四个显式 world 不导入 credentials/账号能力，不增加自动组合矩阵或原始 WASI 文件系统。

```wit
interface local-files {
  list-roots: func() -> result<list<string>, string>;
  request-root: func(title: string) -> result<option<string>, string>;
  walk: func(root: string, cursor: string, limit: u32) -> result<string, string>;
  tracks: func(root: string, cursor: string, limit: u32) -> result<string, string>;
  read-chunk: func(root: string, relative: string, offset: u64, length: u32) -> result<list<u8>, string>;
}
```

`request-root` 打开原生目录框，返回根 ID，取消返回 `none`。仅应由明确用户操作触发，例如示例的 `:add-folder`
搜索命令，宿主不会在启用或后台扫描时自动调用。title 是最长 80 字符且无控制字符的提示，实际授权文案由宿主管理。
桌面使用原生选择器；Android 使用 SAF，不申请广泛存储权限，也不持久化 URI 授权。授权粒度为目录。
根 ID 绑定单个提供器 context（含 profile/session），最多 16 个。停用、卸载、重载、触发 context 重建的设置变更和更新
均撤销授权；重启后用 `list-roots` 重新校验已存曲目引用。更新候选验证阶段不能弹框，过期选择器结果不能重新授予权限。

`walk` / `tracks` 返回 JSON `{ "entries": [...], "nextCursor": "opaque" | null }`。
首次游标为空字符串，后续游标绑定根和操作且仅能消费一次。每项包含 `name`、`relative`、`type`、`size`、
`modifiedMs`、`writable: false`。跳过隐藏条目。路径使用 `/`，拒绝绝对路径、穿越、平台别名和控制字符；
原生宿主拒绝符号链接/junction 遍历。目录变化后应重新扫描，不保证分页快照。`walk` 包含目录、支持的音频和约定封面文件。

原生每页最多检查 1,000 个物理条目，包含被路径/类型过滤掉的条目；空页仍可能有续传游标。
取消只撤销该次原生请求 ID，不清空其他已批准目录；调用方退出也会取消未完成的 Wasm/原生工作。

`tracks` 添加 `metadata`：title、artist、album、discNumber、trackNumber、durationMs、sampleRateHz、bitDepth、
bitrateKbps、可选 artworkDataUri。Core 统一使用锁定版本 Lofty，文本每字段最多 512 字符，未知字段可缺失或为 null。
单文件解析失败仍保留条目，附 `metadataError: "unreadable-or-limit-exceeded"`。内嵌 JPEG/PNG/WebP 封面最多 64 KiB。
插件自行决定封面优先级、专辑/艺术家映射、搜索排序和网络补全；宿主不注册内置本地音乐库。

限制：walk 每页最多 200 项，tracks 最多 20 项；每轮遍历最多 100,000 条目、深度 32、4,096 个待遍历目录，
每 context 最多 8 个游标。每页另有工作量预算，可能返回较少条目并保留续传游标。原生 I/O 串行，broker 最多 32 个
待完成请求。标签解析每文件实际读取最多 4 MiB，并将 Lofty 受控分配路径的限制设为 1 MiB；这不是所有解析分配或宿主总内存的硬限制。压缩 ID3 帧在解压前拒绝，避免膨胀绕过原生读取预算。大标签或损坏文件可能降级为 metadataError。

遍历处理条目时间为 O(N)，读取 L 字节的时间/返回内存为 O(L)。底层目录分页使用数值偏移，可能反复访问前序条目，
因此超大平铺目录的所有分页累计工作量最坏可接近 O(N²)。游标内存由上述目录/页面配额限制，标签解析使用固定读取预算。

`read-chunk` 按字节偏移读取，每次最多 512 KiB。音频扩展名：mp3/flac/wav/aac/m4a/mp4/ogg/opus/aiff/aif/ape/wv；
封面仅限 cover.jpg、cover.jpeg、cover.png、folder.jpg、folder.png（不区分大小写）。不能读取任意文档或隐藏文件。
可读标签不等于音频引擎能解码所有格式。SAF 文档提供器需报告大小并支持 seek 才能播放，也可能拒绝请求或中途失效。

## 本地播放

在 `provider.playback` 的现有响应中保留外层 `cacheKey`、`format`、`qualityLabel`、`contentLength`、`selection`，
将 source 设为：

```json
{ "kind": "local", "root": "opaque-root-id", "relative": "Albums/Foo/01.flac" }
```

Core 检查能力、根/session 实时授权、原生边界、音频扩展名、文件类型和实际大小。继续使用**不透明媒体通道**，
避免裸 `PlaybackLocation::Local` 在授权撤销后继续打开文件。路径与 Android URI 不进入 guest/renderer。
缓存身份包含实际根 ID、文件和元数据，不只相信插件给的缓存键。现有准备器先复制到受管播放缓存再解码，
因此首次播放有准备时间和缓存空间成本。本接口不提供写入、删除、重命名、执行程序或原始 IPC。

提供器缺少修改时间或返回零时，每次解析使用新的缓存身份，避免同大小文件被编辑后仍播放旧缓存。

原生内部使用 Host-only 的 `plugin_local_files` 和 `host://provider-local-files`，不转发给 renderer/WebView。
普通原生请求等待上限 15 秒、目录选择 90 秒、本地文件 Component 单次调用 110 秒，CPU fuel/内存限制不变。
桌面 `provider_search` 传输超时为 120 秒，以容纳用户选择。应分小批扫描并处理 `local-files.*` 错误。

完整[可复制本地音频示例](https://github.com/YAQMC/YAQMC/blob/main/plugins/provider-local-files-rust/)用 `npm run provider:local-files` 构建，
演示“选择目录 → 标签 → 搜索 → 播放”。Worker 页面与 Provider Component 仍为不同包形状。
