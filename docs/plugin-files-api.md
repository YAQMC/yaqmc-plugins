# Local files API

> **English** | [简体中文](zh-CN/plugin-files-api.md)

Plugin API **v5** adds `ctx.files` to manifest v1 worker plugins. API v1/v2/v4 plugins keep their existing behavior;
API v3 Provider Components and their WIT worlds are unchanged. Older clients retain v5 packages as incompatible
instead of activating a script with missing capabilities. Use a client build that implements API v5.

Declare `files.read` to choose and read files, or both `files.read` and `files.write` to request a writable selection.
Both permissions are sensitive and shown in YAQMC's permission review. Permission approval alone does not select
a location: `pickFile()` or `pickDirectory()` opens the native system picker each time. Cancellation returns `null`.
The default selection is read-only. Android uses the Storage Access Framework, without broad storage permissions.

```js
const selected = await ctx.files.pickDirectory({ writable: true });
if (!selected) return;
try {
  const page = await ctx.files.list(selected.handle, { limit: 50 });
  await ctx.files.writeFile(selected.handle, {
    path: 'note.txt',
    data: 'A user-triggered example\n',
  }); // fails if note.txt already exists
  const result = await ctx.files.readFile(selected.handle, { path: 'note.txt' });
  await ctx.log.info(result.data);
} finally {
  await ctx.files.close(selected.handle);
}
```

Expose picker and mutation actions as explicit buttons. Do not launch dialogs or modify user files automatically
from `activate()`. [The file-manager example](../plugins/script-files/) provides a page and user-triggered actions.

## Methods and limits

| Method                                                      | Permission                                     | Behavior                                                                                         |
| ----------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `capabilities()`                                            | None                                           | `available`, `maxBytes`, `maxEntries`, `persistentHandles`, `recursiveDelete`, `directoryDelete` |
| `pickFile({ writable? })`, `pickDirectory({ writable? })`   | `files.read`; also `files.write` when writable | `{ handle, name, type, writable }` or `null`                                                     |
| `stat(handle, path?)`                                       | `files.read`                                   | Name, file/directory type, size, modification time and selection write mode                      |
| `list(handle, { path?, cursor?, limit? })`                  | `files.read`                                   | `{ entries, nextCursor }`; default 100, maximum 200 entries per call                             |
| `readFile(handle, { path?, offset?, length?, encoding? })`  | `files.read`                                   | `{ data, bytesRead, eof }`; byte offset, maximum 512 KiB per call                                |
| `writeFile(handle, { path?, data, encoding?, overwrite? })` | `files.write`                                  | Creates a file; existing files require `overwrite: true`; maximum 512 KiB of decoded data        |
| `mkdir(handle, path)`                                       | `files.write`                                  | Creates exactly one directory; its parent must exist                                             |
| `rename(handle, path, name)`                                | `files.write`                                  | Renames within the same parent; `name` is one portable filename                                  |
| `remove(handle, path?)`                                     | `files.write`                                  | Deletes a file; desktop also supports empty directories; never recursive                         |
| `close(handle)`                                             | None                                           | Releases the handle                                                                              |

`encoding` is `utf8` by default, or canonical padded `base64`. Sizes and offsets count bytes. For binary data or
multibyte text read in chunks, use base64 and decode with a streaming decoder so a character split between calls
is not replaced. Writes replace the complete file; append, streaming writes and copy/move are not implemented.
List cursors are numeric offsets in native enumeration order, not stable snapshots; refresh when contents change.

An empty path addresses the selected entry. A selected file cannot access siblings. Directory paths are relative
and use `/`; absolute paths, `..`, `.`, empty components, backslashes, NUL/control characters, Windows device
names, alternate data streams, trailing dots/spaces, and oversized names are rejected. Desktop symbolic links
and junctions cannot be traversed. The selected directory itself cannot be renamed or removed.

Handles belong to one plugin runtime and renderer window, with at most 64 per runtime and 512 per native host.
They are not filesystem paths or Android content URIs. Never persist them in settings or plugin storage.
Disabling, reloading, updating or stopping a plugin retires its handles, including pending picker requests.
Every operation is authorized against the live Core runtime before native work and before returning a result.
Changes to grants during an operation can prevent delivery of its result; an already completed disk mutation
is not rolled back. Native I/O failures can also leave partial writes, so this is not a transactional file API.

## Platform behavior

Desktop uses its native open dialog and filesystem. Android keeps document/tree URIs entirely in the native host
and resolves names through `DocumentsContract`. Document providers may be read-only, disappear, report unknown
sizes/timestamps, change names on rename, or reject random access (`files.unsupported-seek`). `writable` describes
the requested selection mode; it does not override OS/provider permissions. A provider's actual rename result may
be returned as `name`.

Android reports `directoryDelete: false`: SAF directory deletion may be recursive, and the platform has no atomic
"delete only if empty" operation. File deletion is supported; folder deletion is refused. Desktop reports
`directoryDelete: true` and rejects non-empty directories. Both report `recursiveDelete: false` and
`persistentHandles: false`. Scripts must inspect capabilities rather than infer behavior from screen size.

Errors are stable `files.*` messages, including `invalid-handle`, `permission-denied`, `read-only`, `invalid-path`,
`not-found`, `exists`, `too-large`, `not-empty`, `busy`, `cancelled`, and `unsupported-directory-delete`.
Native failures are sanitized; paths and content URIs are not included in plugin-visible error messages.

This is a user-selected data API. It does not grant Node.js, raw filesystem access, shell commands, executable
launching, account credentials, Android app-private directories, or direct playback of local files.
