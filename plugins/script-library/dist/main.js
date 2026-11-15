'use strict';
"use strict";
definePlugin({
    async activate(ctx) {
        let selected = null;
        let message = 'Local playlists belong to this plugin. File operations start only after a click.';
        let busy = false, disposed = false, confirmDelete = false;
        async function render() {
            if (disposed)
                return;
            const list = await ctx.playlists.list();
            const blocks = [
                { type: 'notice', text: message.slice(0, 900) },
                {
                    type: 'actions',
                    items: [
                        { id: 'create', label: 'Create empty playlist' },
                        { id: 'import', label: 'Import JSON' },
                        { id: 'refresh', label: 'Refresh' },
                    ],
                },
                {
                    type: 'text',
                    text: 'Use Settings → Keyboard shortcuts to change this plugin’s shortcut. Ctrl+Shift+L refreshes this page by default.',
                },
                ...list.slice(0, 20).map((p) => ({
                    type: 'actions',
                    items: [{ id: `select-${p.id}`, label: `${p.name} (${p.trackCount})`.slice(0, 60) }],
                })),
            ];
            if (selected) {
                blocks.push({
                    type: 'text',
                    text: `${selected.name}\n${selected.tracks.length} tracks`.slice(0, 900),
                });
                blocks.push({
                    type: 'actions',
                    items: [
                        { id: 'export', label: 'Export selected playlist' },
                        {
                            id: confirmDelete ? 'confirm-delete' : 'delete',
                            label: confirmDelete ? 'Confirm delete local playlist' : 'Delete selected playlist',
                        },
                    ],
                });
            }
            await ctx.pages.render('library', blocks);
        }
        async function run(action) {
            if (busy || disposed)
                return;
            busy = true;
            try {
                await action();
            }
            catch (error) {
                message = String(error);
            }
            finally {
                busy = false;
                if (!disposed)
                    await render();
            }
        }
        await ctx.pages.register({ id: 'library', title: 'Local playlist tools' });
        await ctx.navigation.register({
            id: 'library',
            label: 'Local playlist tools',
            pageId: 'library',
        });
        try {
            await ctx.shortcuts.register({
                id: 'refresh',
                label: 'Refresh local playlists',
                accelerator: 'control+shift+L',
            });
        }
        catch (error) {
            if (!String(error).includes('shortcuts.conflict'))
                throw error;
            await ctx.shortcuts.register({
                id: 'refresh',
                label: 'Refresh local playlists',
                accelerator: null,
            });
            message = 'Default shortcut is occupied. Assign one under Settings → Keyboard shortcuts.';
        }
        const unbind = ctx.shortcuts.onTriggered('refresh', () => {
            void run(async () => {
                message = 'Refreshed local playlists';
            });
        });
        const unsubscribe = ctx.events.on('ui.action', (event) => {
            const e = event;
            if (e.pageId !== 'library')
                return;
            void run(async () => {
                if (e.id !== 'delete' && e.id !== 'confirm-delete')
                    confirmDelete = false;
                if (e.id?.startsWith('select-')) {
                    selected = await ctx.playlists.get(e.id.slice(7));
                    confirmDelete = false;
                }
                else if (e.id === 'create') {
                    selected = await ctx.playlists.create({ name: 'My plugin playlist', tracks: [] });
                    message = 'Created a local playlist.';
                }
                else if (e.id === 'import') {
                    const file = await ctx.files.pickFile();
                    if (!file)
                        return;
                    try {
                        const result = await ctx.files.readFile(file.handle, { length: 512 * 1024 });
                        if (!result.eof)
                            throw new Error('The JSON file exceeds the example’s 512 KiB limit.');
                        selected = await ctx.playlists.import(JSON.parse(result.data));
                        message = 'Imported as a new local playlist.';
                    }
                    finally {
                        await ctx.files.close(file.handle);
                    }
                }
                else if (e.id === 'export' && selected) {
                    const folder = await ctx.files.pickDirectory({ writable: true });
                    if (!folder)
                        return;
                    try {
                        const document = await ctx.playlists.export(selected.id);
                        await ctx.files.writeFile(folder.handle, {
                            path: `playlist-${selected.id}.json`,
                            data: JSON.stringify(document),
                        });
                        message = 'Exported JSON. Existing files are never overwritten by this example.';
                    }
                    finally {
                        await ctx.files.close(folder.handle);
                    }
                }
                else if (e.id === 'delete' && selected) {
                    confirmDelete = true;
                }
                else if (e.id === 'confirm-delete' && selected && confirmDelete) {
                    await ctx.playlists.remove(selected.id);
                    selected = null;
                    confirmDelete = false;
                    message = 'Deleted this plugin’s local playlist.';
                }
            });
        });
        await render();
        return () => {
            disposed = true;
            unbind();
            unsubscribe();
        };
    },
});
