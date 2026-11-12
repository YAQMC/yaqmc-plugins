# 本地文件管理 API

> [English](../plugin-files-api.md) | **简体中文**

Plugin API **v5** 为 manifest v1 的 Worker 插件新增 `ctx.files`。API v1/v2/v4 保持兼容；API v3 Provider
Component 及其 WIT 协议不变。旧客户端将 v5 插件保留为“不兼容”，不会激活缺少接口的脚本。需要使用支持 v5 的客户端构建。

声明 `files.read` 可选择并读取文件或目录；请求可写位置时必须同时声明 `files.write`。两者均为敏感权限，在插件授权界面单独展示。
插件权限授权不等于文件访问授权：还须通过 `pickFile()` 或 `pickDirectory()` 打开原生系统选择器，由用户选择具体位置。
取消选择返回 `null`；默认只读。Android 使用 Storage Access Framework，不申请广泛的存储权限。

```js
const selected = await ctx.files.pickDirectory({ writable: true });
if (!selected) return;
try {
  const page = await ctx.files.list(selected.handle, { limit: 50 });
  await ctx.files.writeFile(selected.handle, {
    path: 'note.txt',
    data: '由用户点击触发的示例\n',
  }); // note.txt 已存在时拒绝覆盖
  const result = await ctx.files.readFile(selected.handle, { path: 'note.txt' });
  await ctx.log.info(result.data);
} finally {
  await ctx.files.close(selected.handle);
}
```

选择器和修改操作应由明确的用户按钮触发，不要在 `activate()` 中自动弹出选择器或修改文件。
[文件管理示例](https://github.com/YAQMC/YAQMC/blob/main/plugins/script-files/)提供了页面与按钮的完整调用流程。

## 方法与限制

| 方法                                                        | 权限                                   | 行为                                                                                                  |
| ----------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `capabilities()`                                            | 无                                     | 查询 `available`、`maxBytes`、`maxEntries`、`persistentHandles`、`recursiveDelete`、`directoryDelete` |
| `pickFile({ writable? })`、`pickDirectory({ writable? })`   | `files.read`，可写时另需 `files.write` | 返回 `{ handle, name, type, writable }` 或 `null`                                                     |
| `stat(handle, path?)`                                       | `files.read`                           | 名称、文件/目录类型、大小、修改时间与所选授权模式                                                     |
| `list(handle, { path?, cursor?, limit? })`                  | `files.read`                           | 返回 `{ entries, nextCursor }`；默认每页 100 项，上限 200 项                                          |
| `readFile(handle, { path?, offset?, length?, encoding? })`  | `files.read`                           | 返回 `{ data, bytesRead, eof }`；按字节偏移，每次最多 512 KiB                                         |
| `writeFile(handle, { path?, data, encoding?, overwrite? })` | `files.write`                          | 默认新建；覆盖已有文件须显式传 `overwrite: true`；解码后最多 512 KiB                                  |
| `mkdir(handle, path)`                                       | `files.write`                          | 只创建一级目录，父目录必须存在                                                                        |
| `rename(handle, path, name)`                                | `files.write`                          | 在同一父目录中改名；`name` 是单个可移植文件名                                                         |
| `remove(handle, path?)`                                     | `files.write`                          | 删除文件；桌面端还可删除空目录；从不递归                                                              |
| `close(handle)`                                             | 无                                     | 释放句柄                                                                                              |

编码默认 `utf8`，也可用带正确填充的标准 `base64`。大小和偏移均按字节计算。读取二进制文件或分块读取多字节文本时，
应使用 base64 并通过流式解码器处理跨块字符。写入替换整个文件，不提供追加、流式写入、复制或移动。
列表游标是原生枚举顺序中的数值偏移，不提供稳定快照保证；目录变化后应刷新列表。

空路径表示用户选择的对象本身。单文件句柄不能访问相邻文件；目录下仅接受使用 `/` 的相对路径。
拒绝绝对路径、`..`、`.`、空路径分段、反斜杠、控制字符、Windows 设备名、备用数据流、末尾点/空格与过长名称。
桌面端不遍历符号链接和 junction。不能重命名或删除用户选中的目录根节点。

句柄绑定到单个插件运行实例和渲染窗口，每实例最多 64 个、每原生宿主最多 512 个；句柄不是路径或 Android content URI，
不要持久化到设置或插件存储。插件停用、重载、更新或停止时会撤销句柄，正在等待的选择器结果也会失效。
每次操作在原生执行前和返回结果前均向 Core 检查实时授权。操作中撤销权限可能使结果不再返回，但已经完成的磁盘修改不会回滚；
原生 I/O 失败也可能留下部分写入，因此该接口不提供事务语义。

## 平台行为

桌面端使用系统文件选择器和文件系统；Android 在原生宿主内保留文档或目录 URI，通过 `DocumentsContract` 解析子节点。
文档提供器可能只读、失效、缺少大小/时间信息、调整重命名结果，或不支持随机访问（`files.unsupported-seek`）。
`writable` 表示请求的授权模式，不能覆盖系统或提供器自身的权限；提供器的实际重命名结果可通过返回值 `name` 获取。

Android 返回 `directoryDelete: false`：SAF 删除目录可能递归删除内容，且没有原子的“仅为空时删除”操作，因此只支持删除文件。
桌面端返回 `directoryDelete: true`，拒绝删除非空目录。两端均返回 `recursiveDelete: false`、`persistentHandles: false`。
插件应查询能力，而不是通过窗口宽度猜测平台行为。

错误使用稳定的 `files.*` 消息，例如 `invalid-handle`、`permission-denied`、`read-only`、`invalid-path`、`not-found`、
`exists`、`too-large`、`not-empty`、`busy`、`cancelled`、`unsupported-directory-delete`。原生错误经过脱敏，不向插件泄露路径或 URI。

本接口只管理用户选择的数据，不提供 Node.js、任意文件系统访问、Shell、执行程序、账号凭据、Android 应用私有目录访问，
也不直接提供本地音频播放功能。
