'use strict';
"use strict";
const PAGE = 'files';
definePlugin({
    async activate(ctx) {
        const capabilities = await ctx.files.capabilities();
        let selection = null;
        let directory = '';
        let entries = [];
        let cursor = 0;
        let nextCursor = null;
        let selected = null;
        let preview = '';
        let message = 'Choose a file or folder. Nothing is modified automatically.';
        let confirmingDelete = false;
        let busy = false;
        let disposed = false;
        const join = (name) => (directory ? `${directory}/${name}` : name);
        const target = () => (selection?.type === 'file' ? '' : join(selected.name));
        async function refresh() {
            selected = null;
            preview = '';
            confirmingDelete = false;
            if (!selection)
                return;
            if (selection.type === 'file') {
                selected = await ctx.files.stat(selection.handle);
                entries = [];
            }
            else {
                const page = await ctx.files.list(selection.handle, { path: directory, cursor, limit: 50 });
                entries = page.entries;
                nextCursor = page.nextCursor;
            }
        }
        async function render() {
            if (disposed)
                return;
            const blocks = [
                { type: 'notice', text: message.slice(0, 900) || 'Ready' },
                {
                    type: 'actions',
                    items: [
                        { id: 'pick-file', label: 'Choose file (read only)' },
                        { id: 'pick-folder', label: 'Choose folder (read only)' },
                        { id: 'pick-write', label: 'Choose writable folder' },
                    ],
                },
            ];
            if (selection) {
                blocks.push({ type: 'text', text: `${selection.name}/${directory}`.slice(0, 900) });
                blocks.push({
                    type: 'actions',
                    items: [
                        { id: 'refresh', label: 'Refresh / first page' },
                        { id: 'up', label: 'Parent folder' },
                        ...(nextCursor !== null ? [{ id: 'next', label: 'Next page' }] : []),
                        { id: 'close', label: 'Close selection' },
                    ],
                });
                if (selection.writable && selection.type === 'directory')
                    blocks.push({
                        type: 'actions',
                        items: [
                            { id: 'create-note', label: 'Create sample note' },
                            { id: 'create-folder', label: 'Create empty sample folder' },
                        ],
                    });
                if (entries.length)
                    blocks.push({
                        type: 'list',
                        items: entries.map((entry, index) => ({
                            id: `e${index}`,
                            actionId: `select-${index}`,
                            title: entry.name.slice(0, 120),
                            subtitle: entry.type === 'directory' ? 'Folder' : `${entry.size ?? '?'} bytes`,
                        })),
                    });
                if (selected) {
                    blocks.push({ type: 'text', text: `Selected: ${selected.name}`.slice(0, 900) });
                    const actions = [
                        selected.type === 'directory'
                            ? { id: 'open', label: 'Open folder' }
                            : { id: 'read', label: 'Preview as text (4 KiB)' },
                    ];
                    if (selection.writable) {
                        actions.push({ id: 'rename', label: 'Rename: append .renamed' });
                        if (selected.type === 'file' ||
                            (capabilities.available && capabilities.directoryDelete))
                            actions.push({
                                id: 'delete',
                                label: confirmingDelete ? 'Confirm permanent deletion' : 'Delete selected entry…',
                            });
                    }
                    blocks.push({ type: 'actions', items: actions });
                }
                if (preview)
                    blocks.push({ type: 'text', text: preview.slice(0, 900) });
            }
            await ctx.pages.render(PAGE, blocks);
        }
        async function action(id) {
            if (busy || disposed)
                return;
            busy = true;
            try {
                if (id.startsWith('pick-')) {
                    const chosen = id === 'pick-file'
                        ? await ctx.files.pickFile()
                        : await ctx.files.pickDirectory({ writable: id === 'pick-write' });
                    if (disposed) {
                        if (chosen)
                            await ctx.files.close(chosen.handle);
                        return;
                    }
                    if (chosen) {
                        if (selection)
                            await ctx.files.close(selection.handle);
                        selection = chosen;
                        directory = '';
                        cursor = 0;
                        nextCursor = null;
                        await refresh();
                        message = chosen.writable
                            ? 'Read/write access granted. Changes require a button press.'
                            : 'Read-only access granted.';
                    }
                }
                else if (selection) {
                    const handle = selection.handle;
                    if (id === 'close') {
                        await ctx.files.close(handle);
                        selection = null;
                        selected = null;
                        entries = [];
                        preview = '';
                    }
                    else if (id === 'refresh' || id === 'up' || id === 'next') {
                        if (id === 'up')
                            directory = directory.split('/').slice(0, -1).join('/');
                        cursor = id === 'next' ? (nextCursor ?? 0) : 0;
                        await refresh();
                    }
                    else if (/^select-\d+$/.test(id)) {
                        selected = entries[Number(id.slice(7))] ?? null;
                        preview = '';
                        confirmingDelete = false;
                    }
                    else if (id === 'create-note' || id === 'create-folder') {
                        const name = `yaqmc-example-${Date.now()}`;
                        if (id === 'create-note')
                            await ctx.files.writeFile(handle, {
                                path: join(`${name}.txt`),
                                data: 'Created by the YAQMC local files example.\n',
                            });
                        else
                            await ctx.files.mkdir(handle, join(name));
                        cursor = 0;
                        await refresh();
                        message = 'Sample entry created.';
                    }
                    else if (selected) {
                        if (id === 'open' && selected.type === 'directory') {
                            directory = target();
                            cursor = 0;
                            await refresh();
                        }
                        else if (id === 'read' && selected.type === 'file') {
                            const data = await ctx.files.readFile(handle, { path: target(), length: 4096 });
                            preview = data.data.trim() || '(empty file)';
                        }
                        else if (id === 'rename') {
                            const result = await ctx.files.rename(handle, target(), `${selected.name}.renamed`);
                            await refresh();
                            message = `Renamed${result.name ? ` to ${result.name}` : ''}.`;
                        }
                        else if (id === 'delete') {
                            if (!confirmingDelete) {
                                confirmingDelete = true;
                                message = 'Deletion is permanent. Press Confirm permanent deletion to proceed.';
                            }
                            else {
                                await ctx.files.remove(handle, target());
                                if (selection.type === 'file') {
                                    selection = null;
                                    selected = null;
                                    preview = '';
                                }
                                else
                                    await refresh();
                                message = 'Entry deleted.';
                            }
                        }
                    }
                }
            }
            catch (error) {
                message = error instanceof Error ? error.message : String(error);
            }
            finally {
                busy = false;
                await render();
            }
        }
        await ctx.pages.register({ id: PAGE, title: 'Local files' });
        await ctx.navigation.register({ id: 'local-files', label: 'Local files', pageId: PAGE });
        const unsubscribe = ctx.events.on('ui.action', (payload) => {
            const event = payload;
            if (event.slot === 'page' && event.pageId === PAGE && event.id)
                void action(event.id);
        });
        if (!capabilities.available)
            message =
                'This host does not support local files. Update YAQMC or use a native desktop/Android host.';
        await render();
        return () => {
            disposed = true;
            unsubscribe();
            if (selection)
                void ctx.files.close(selection.handle).catch(() => undefined);
        };
    },
});
