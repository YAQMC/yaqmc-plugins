# Local audio Provider example

Copyable manifest v2 / API v3 Component using `provider-local-files-storage`. Requires a YAQMC build with
`provider.localFiles` support on native desktop or Android.

```sh
rustup target add wasm32-wasip2
npm run provider:local-files
```

Import `plugins/packages/dev.yaqmc.example.local-files-1.0.0.yaqmc-plugin`, review read/play/private-storage
permissions, enable it, and select **Local audio example** in YAQMC's song search:

1. Search `:add-folder` to choose a directory and scan the first batch.
2. Search `:scan` to scan the next five audio files.
3. Search a title, or `:list` for indexed tracks, and select a track to play.

The example indexes at most 256 tracks within a 512 KiB catalog budget and stores only text metadata/references. It leaves artwork, rich album
pages, automatic watching and library policy to a real plugin. Failed metadata falls back to the filename.
Playback uses mp3/flac/wav/aac; unknown-size/non-seekable SAF documents may not play. Roots are revoked at
stop/reload/restart and must be selected again. Audio is cached before decoding, with initial preparation cost.

Commands run only on the first page of song search. Pagination respects the requested page size and never reopens
the picker. Catalog and scan continuation are saved atomically; opaque track IDs are not reused after reauthorization.

中文：启用后在搜索页选本插件和“歌曲”，搜索 `:add-folder` 授权目录并扫描首批，`:scan` 扫描下一批，
`:list` 查看已索引曲目，随后可搜索标题并播放。启用时不弹框，不修改用户文件。重启、重载或停用撤销根句柄。

[English API](../../docs/plugin-provider-local-files.md) · [中文接口与限制](../../docs/zh-CN/plugin-provider-local-files.md).
Sources and generated fixture use GPL-3.0-or-later.
