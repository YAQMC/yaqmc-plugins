# 快捷键与本地歌单（API v6）

[English](../plugin-shortcuts-playlists.md)

使用 manifest v1 / Worker API v6，继承 v5。旧客户端将包标记为不兼容；Wasm Provider API v3 不适用。
[可复制示例](../../plugins/script-library/)展示快捷键、独立歌单及通过原生选择器导入导出 JSON。

## 快捷键

声明 `shortcuts.register`，调用 `ctx.shortcuts.register({id,label,accelerator})` 注册自己的动作，
`ctx.shortcuts.onTriggered(id, handler)` 订阅并返回取消订阅函数；`list()` 返回自己的有效绑定，
`set(id, accelerator)` 修改自己的绑定，`unregister(id)` 注销。`null` 表示未绑定。

示例：`await ctx.shortcuts.register({id:'refresh',label:'刷新歌单',accelerator:'control+shift+L'})`。
最多每插件 8 个、全应用 64 个，最多保存 256 个插件绑定覆盖；id 为 1–40 个 ASCII 字母、数字、点、下划线或连字符，标签最多 60 字且不含控制字符。
修饰键为 `mod/control/alt/shift/meta`，不能重复；`mod` 对应 macOS Command 或其他系统 Control，不能再与 control/meta 组合。
物理键支持 A–Z、0–9、Space、ArrowLeft/Right/Up/Down、F1–F24、Enter、Home、End、PageUp/Down、Delete、Backspace。
Esc 保留用于宿主关闭临时界面。与宿主或其他插件冲突时拒绝注册/修改，用户自定义覆盖插件默认绑定。

仅主窗口获得焦点时有效，Android 外接键盘同样可用。文本输入、可编辑内容、IME、已处理事件和按键重复不触发插件动作。
只向拥有该动作的插件发送动作 ID，不提供原始按键流、键盘记录或系统全局监听。停用、重载、更新或撤销授权清理注册；用户覆盖保存在偏好中。

设置 → 键盘快捷键支持录入、清除和恢复默认。默认应用内 Space 播放暂停，Alt+左右切歌，Ctrl+上下调整 5% 音量，
Cmd/Ctrl+K 搜索、F11 歌词全屏。桌面全局默认 Ctrl+Alt 配合 Space/方向键，需要全局开关；原生 Wayland 不支持全局路径。
Android 实体音量键保持系统行为。v6 还增加 `player.control` 下的 `ctx.player.setVolume(0..1)` 与 `toggleMuted()`。

## 插件自己的本地歌单

读取权限 `playlists.read` 对应 list/get/export；敏感写权限 `playlists.write` 对应 create/update/remove/import。
数据按插件隔离、持久保存，停用不删除；卸载且删除数据时清除。不需要账户登录，不修改 QQ 音乐等平台歌单。
插件自行渲染页面、转换平台文件格式和补全信息；这些文档不会自动注册为 Provider 或加入平台曲库。
保存曲目引用不代表获取对应 Provider、账户、本地文件根目录授权，也不保证该曲目可播放。

```ts
const p = await ctx.playlists.create({
  name: '导入的歌单',
  tracks: [{ providerId: 'qqmusic', trackId: '曲目 ID', title: '标题', artists: ['歌手'] }],
});
await ctx.playlists.update(p.id, { name: '改名', tracks: p.tracks });
const summaries = await ctx.playlists.list(); // id/name/description/trackCount
const full = await ctx.playlists.get(p.id);
const document = await ctx.playlists.export(p.id);
const copy = await ctx.playlists.import(document); // 始终创建新 ID
await ctx.playlists.remove(copy.id);
```

导入导出文档：`{format:'yaqmc.playlist',version:1,playlist:{name,description?,tracks?}}`。
曲目字段为 providerId、trackId、title，可选 artists（字符串数组）、album、durationMs。未提供的描述/曲目使用空值。
update 只修改提供的字段，提供 tracks 时完整替换。ID 由宿主产生；禁止导入覆盖旧 ID、未知字段、重复 providerId/trackId 对。
不接受绝对路径、Cookie 或播放 URL 等字段。

每插件最多 100 个歌单，单歌单最多 2,000 首及序列化 256 KiB，总紧凑存储 2 MiB，请求 512 KiB；
名称 120 字、描述 2,048 字、曲目 ID/标题/专辑 256 字、Provider ID 160 字、最多 8 位歌手且各 120 字，时长 0–86,400,000 毫秒。
拒绝文本控制字符。宿主串行执行读取/校验/原子替换，失败保留旧数据；单次时间和空间为 O(S)，S 为有上限的存储大小。
并发更新按成功顺序替换，不提供跨调用事务或版本比较交换。快捷键查找 O(C)，C 最多 64。

结合 v5 的 `ctx.files` 和用户主动触发的文件选择器完成 JSON 导入导出；授权不等于已经选择文件，覆盖仍需显式指定。
示例不会在激活时读写文件，关闭临时句柄，删除需要二次点击。常见错误为 shortcuts.conflict/limit/not-found、
playlists.invalid-document/not-found/quota/save-failed，以及权限或速率限制错误。更完整约束见英文文档。
