# Provider local audio files

> **English** | [简体中文](zh-CN/plugin-provider-local-files.md)

This is an additive **manifest v2 / Provider API v3** extension, separate from Worker API v5 `ctx.files`.
Existing v3 worlds/exports remain unchanged. Use a client implementing this extension; older clients do not
accept the new capability. Declare sensitive `provider.localFiles` in both `provider.capabilities` and
`permissions`, plus `provider.catalog` and (for playback) `provider.playback`. Permission approval alone selects
no directory. The native system picker grants read-only, session-scoped directory handles, never paths or URIs.

| World                                  | Imports                | Additional grants               |
| -------------------------------------- | ---------------------- | ------------------------------- |
| `provider-local-files`                 | utilities, local-files | provider.localFiles             |
| `provider-local-files-storage`         | plus storage           | plus plugin.storage             |
| `provider-local-files-network`         | plus network           | plus exact network:https://host |
| `provider-local-files-network-storage` | plus storage, network  | plus both grants                |

World imports must exactly match the manifest. These four explicit worlds do not import credentials/account
capabilities; no generated world matrix or raw WASI filesystem is introduced.

```wit
interface local-files {
  list-roots: func() -> result<list<string>, string>;
  request-root: func(title: string) -> result<option<string>, string>;
  walk: func(root: string, cursor: string, limit: u32) -> result<string, string>;
  tracks: func(root: string, cursor: string, limit: u32) -> result<string, string>;
  read-chunk: func(root: string, relative: string, offset: u64, length: u32) -> result<list<u8>, string>;
}
```

`request-root` opens the native directory picker, returns an opaque root or `none` on cancellation. Invoke it
only from an explicit user action, such as the example's `:add-folder` search command. The host never requests
a directory automatically at activation. Title is advisory, at most 80 characters without controls; the host
owns consent text. Desktop uses native dialogs; Android uses SAF without broad storage or persisted URI grants.
Directory selection is the grant unit. Roots are scoped to one provider context, including profile/session,
with at most 16 roots. Disable, uninstall, reload, context-rebuilding settings changes and updates revoke them.
After restart revalidate catalog references with `list-roots`. Update candidates cannot open pickers; late
picker results cannot restore authority. Roots are temporary and must not be treated as paths.

`walk` / `tracks` return JSON `{ "entries": [...], "nextCursor": "opaque" | null }`. Start with an empty cursor.
Continuations are single-use and bound to root and operation. Entries contain `name`, `relative`, `type`, `size`,
`modifiedMs`, `writable: false`. Hidden entries are skipped. Paths use `/`; absolute paths, traversal, aliases
and controls are rejected. Native hosts reject symlink/junction traversal. Directory changes invalidate stable
pagination; start a fresh scan to refresh. `walk` includes directories, supported audio and known sidecar covers.

Native enumeration examines at most 1,000 physical entries per page, including entries rejected by path/type
filters. Empty pages can still carry a continuation. Cancellation retires the individual native request ID;
it does not discard other approved roots. Dropping a caller also cancels its outstanding Wasm/native work.

`tracks` adds `metadata`: title, artist, album, discNumber, trackNumber, durationMs, sampleRateHz, bitDepth,
bitrateKbps and optional artworkDataUri. Core uses pinned Lofty; text is bounded to 512 characters/field.
Unknown fields can be null/absent. Parse failures preserve the entry with
`metadataError: "unreadable-or-limit-exceeded"`. Embedded JPEG/PNG/WebP artwork is at most 64 KiB. Plugins own
cover priority, album/artist mapping, search, sorting and optional enrichment; the host registers no local library.

Limits: 200 entries per walk page, 20 per tracks page, 100,000 visited entries per traversal, depth 32, 4,096
pending directories and 8 open cursors/context. Each page has a work budget and may return fewer entries with a
continuation. Native I/O is serialized; the broker permits 32 pending requests. Tag parsing reads at most 4 MiB
per file and sets Lofty's guarded-allocation limit to 1 MiB; this is not a hard limit on all parser allocations
or total host memory. Compressed ID3 frames are rejected before decompression
so expansion cannot bypass the native read budget. Large/malformed tags may fail metadata parsing.

Traversal time is O(N) for visited entries; read time/returned memory is O(L) for L bytes. Native offset-based
directory pagination can revisit earlier entries, so a very large flat directory may approach O(N²) work over
all pages. Cursor memory is bounded by the directory/page quotas above; tag parsing has a fixed read budget.

`read-chunk` reads at most 512 KiB per call at a byte offset. Audio extensions: mp3/flac/wav/aac/m4a/mp4/ogg/opus/
aiff/aif/ape/wv. Sidecars: cover.jpg, cover.jpeg, cover.png, folder.jpg, folder.png (case insensitive). Arbitrary
documents and hidden paths are refused. Metadata support does not imply every format is playable. SAF providers
must report size and support seeking for playback; providers can reject requests or disappear.

## Playback

Under `provider.playback`, return the existing enclosing response (`cacheKey`, `format`, `qualityLabel`,
`contentLength`, `selection`) with this source:

```json
{ "kind": "local", "root": "opaque-root-id", "relative": "Albums/Foo/01.flac" }
```

Core checks capability, active root/session, native containment, audio extension, file type and actual size.
It retains the **opaque media** channel so later reads remain revocable; no bare `PlaybackLocation::Local`
outlives the grant. Paths and Android URIs never enter the guest or renderer. Cache identity includes the actual
root/file/metadata, not just the guest cache key. The existing preparer copies audio into managed playback cache
before decoding, costing initial preparation time and cache space. No write, delete, rename, executable or raw
IPC access is provided.

Sources with missing/zero modification times receive a fresh cache identity on resolution so equal-sized edits
do not silently replay stale cached audio.

Native calls use Host-only `plugin_local_files` and `host://provider-local-files`; neither is forwarded to
renderer windows/WebViews. Native waits are 15 seconds, directory consent 90 seconds, and local-file Component
invocations 110 seconds. CPU fuel/memory limits are unchanged. Desktop `provider_search` has a 120-second
transport deadline for explicit selection. Scan small batches and handle `local-files.*` errors.

Build the [copyable local audio example](../plugins/provider-local-files-rust/) with `npm run provider:local-files`.
It demonstrates picker → metadata → search → playback. Worker pages and Provider Components remain separate packages.
