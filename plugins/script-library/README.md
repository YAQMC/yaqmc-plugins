# Local playlist tools (API v6)

Copy this directory, update the manifest id, then run `npm run pack` from the examples repository.
Import `plugins/packages/dev.yaqmc.example.library-1.0.0.yaqmc-plugin` into a YAQMC build supporting API v6.

The page creates plugin-owned playlists and imports/exports `yaqmc.playlist` JSON through the native file picker.
Deleting requires a second explicit click. No platform-account playlists are changed. It displays the first 20
playlists as a small demonstration; the API supports listing all local playlist summaries.

The refresh shortcut is application-only and can be changed under Settings → Keyboard shortcuts. It never opens
a file picker automatically. The API document contains examples for adding/replacing tracks and updating metadata.

中文：该示例展示独立本地歌单的创建、JSON 导入导出、二次点击删除确认和可自定义的应用内快捷键，不修改平台账户歌单。
