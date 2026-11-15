# Shortcuts and local playlists (API v6)

[简体中文](zh-CN/plugin-shortcuts-playlists.md)

Manifest **v1**, Worker **API v6**, inherits v5. Older clients mark these packages incompatible.
Provider Components (API v3) cannot use these Worker interfaces. See the [copyable example](../plugins/script-library/).

## Shortcuts

Declare `shortcuts.register`. Commands belong to the current plugin runtime; stopping, disabling, reloading,
updating or revoking a grant removes registrations and event delivery. User binding overrides persist in YAQMC
preferences. No arbitrary raw key events, system-wide keystroke monitoring or native global registration is exposed.
Commands run only while the main YAQMC window is focused, including external keyboards on Android. Text inputs,
editable content, IME composition and already-handled events do not trigger plugin commands. Repeats are ignored.

```ts
const off = ctx.shortcuts.onTriggered('refresh', () => {
  /* refresh this plugin's page */
});
await ctx.shortcuts.register({
  id: 'refresh',
  label: 'Refresh library',
  accelerator: 'control+shift+L',
});
await ctx.shortcuts.set('refresh', 'alt+L'); // own command only; null disables it
const commands = await ctx.shortcuts.list(); // own registered commands, effective bindings
await ctx.shortcuts.unregister('refresh');
off();
```

IDs: 1–40 ASCII letters, digits, `.`, `_`, `-`. Labels: 1–60 characters, no controls. Up to 8 commands/plugin,
64 total, with up to 256 persisted plugin binding overrides. Accelerators: optional modifiers `mod`, `control`, `alt`, `shift`, `meta` plus one physical key:
`A`–`Z`, `0`–`9`, `Space`, arrows, `F1`–`F24`, `Enter`, `Home`, `End`, `PageUp`, `PageDown`, `Delete`, `Backspace`.
`mod` is Command on macOS and Control elsewhere. `Escape` remains the host's dismissal key. No duplicate modifiers
or `mod` combined with `control`/`meta`. `null` means unassigned. Conflicts with host or other plugin commands reject
registration or changes. Existing user overrides take precedence over a registration's default accelerator.

Settings → Keyboard shortcuts supports recording, clearing and restoring application/global/plugin bindings.
Defaults: Space play/pause, Alt+Left/Right previous/next, Control+Up/Down volume in 5% steps, Command/Control+K search,
F11 lyrics fullscreen. Desktop global defaults use Control+Alt with Space/arrows (including Up/Down volume) and require
the existing global switch. Native Wayland remains unsupported for globals. Android volume buttons retain system behavior.
`player.control` also grants `ctx.player.setVolume(0..1)` and `ctx.player.toggleMuted()` in v6.

## Plugin-owned playlists

Declare `playlists.read` for `list`, `get`, `export`; `playlists.write` for `create`, `update`, `remove`, `import`.
Writes are sensitive and require permission review. Data persists separately per installed plugin, without an account
login, platform playlist mutations, arbitrary filesystem paths or media URLs. Disabling preserves data; uninstalling
with data removal deletes it. These documents do not automatically register a catalog provider or appear as platform
playlists. Plugins render their own pages and handle platform-specific formats/enrichment. A reference is not a grant
to a Provider, account or local-file root, and does not imply a track is available/playable.

```ts
const playlist = await ctx.playlists.create({
  name: 'Imported songs',
  description: '',
  tracks: [
    { providerId: 'qqmusic', trackId: 'provider-track-id', title: 'Example', artists: ['Artist'] },
  ],
});
await ctx.playlists.update(playlist.id, { name: 'Renamed', tracks: playlist.tracks });
const summaries = await ctx.playlists.list(); // id, name, description, trackCount
const full = await ctx.playlists.get(playlist.id);
const document = await ctx.playlists.export(playlist.id);
const copied = await ctx.playlists.import(document); // always creates a NEW ID
await ctx.playlists.remove(copied.id);
```

Documents: `{ format: "yaqmc.playlist", version: 1, playlist: { name, description?, tracks? } }`.
Tracks contain `providerId`, `trackId`, `title`, optional `artists: string[]`, `album`, `durationMs`.
Provider/track IDs are opaque references. No absolute paths, cookies, playback URLs or custom fields are accepted.
Update replaces a supplied track list in its entirety and preserves omitted fields. IDs are host-generated; import/create
cannot overwrite an existing ID. Duplicate `(providerId, trackId)` entries reject the document.

Limits: 100 playlists/plugin, 2,000 tracks/playlist, 256 KiB serialized playlist, 2 MiB compact store, 512 KiB request.
Names 120 characters, descriptions 2,048, track IDs/titles/albums 256, provider IDs 160, up to 8 artists of 120 characters,
duration 0–86,400,000 ms; text controls are rejected. A mutation reads, validates and atomically replaces the store under
the host's serialization lock; invalid data or a failed write preserves the previous document. Complexity is O(S) time
and memory per call for bounded store size S. Shortcut lookup is O(C), bounded to 64 commands. Concurrent updates are
serialized, with the last successful replacement winning; no cross-call transaction or revision compare-and-swap is provided.

Use `ctx.files` with user-triggered pickers to read/write JSON. File permission alone does not select a location.
File writes have their own limits and require explicit overwrite; never modify files automatically at activation.
The example supports native desktop and Android SAF, checks file size, closes temporary handles and confirms deletion.
Typical errors: `shortcuts.conflict`, `shortcuts.limit`, `shortcuts.not-found`, `playlists.invalid-document`,
`playlists.not-found`, `playlists.quota`, `playlists.save-failed`, plus ordinary bridge permission/rate-limit errors.
