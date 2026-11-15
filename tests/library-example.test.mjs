import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { setImmediate as nextTurn } from 'node:timers/promises';
import test from 'node:test';
import ts from 'typescript';

test('playlist example requires user gestures, closes file grants, and confirms deletion', async () => {
  const source = readFileSync(
    new URL('../plugins/script-library/src/main.ts', import.meta.url),
    'utf8',
  )
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];?\s*/g, '')
    .replace('export default definePlugin', 'definePlugin');
  let plugin, handler, trigger;
  const messages = [];
  const calls = { pick: 0, close: 0, remove: 0, register: 0 };
  let stored = [];
  const playlist = { id: 'test-id', name: 'Imported', description: '', tracks: [] };
  const document = {
    format: 'yaqmc.playlist',
    version: 1,
    playlist: { name: 'Imported', tracks: [] },
  };
  let input = JSON.stringify(document);
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
    }).outputText,
    {
      definePlugin: (p) => {
        plugin = p;
      },
    },
  );
  const ctx = {
    pages: {
      register: async () => {},
      render: async (_id, blocks) => {
        messages.push(blocks[0].text);
      },
    },
    navigation: { register: async () => {} },
    shortcuts: {
      register: async (command) => {
        calls.register++;
        if (command.accelerator) throw Error('shortcuts.conflict');
      },
      onTriggered: (_id, fn) => {
        trigger = fn;
        return () => {};
      },
    },
    events: {
      on: (_event, fn) => {
        handler = fn;
        return () => {};
      },
    },
    playlists: {
      list: async () => stored,
      get: async () => playlist,
      create: async () => playlist,
      import: async (doc) => {
        assert.equal(doc.format, 'yaqmc.playlist');
        stored = [playlist];
        return playlist;
      },
      export: async () => document,
      remove: async () => {
        calls.remove++;
        stored = [];
      },
    },
    files: {
      pickFile: async () => {
        calls.pick++;
        return { handle: 'file' };
      },
      pickDirectory: async () => {
        calls.pick++;
        return { handle: 'folder' };
      },
      readFile: async () => ({ data: input, eof: true }),
      writeFile: async (_handle, options) => {
        assert.equal(JSON.parse(options.data).format, 'yaqmc.playlist');
        assert.equal(options.overwrite, undefined);
      },
      close: async () => {
        calls.close++;
      },
    },
  };
  const cleanup = await plugin.activate(ctx);
  assert.equal(calls.pick, 0);
  trigger();
  await nextTurn();
  assert.equal(messages.at(-1), 'Refreshed local playlists');
  assert.equal(calls.register, 2, 'occupied default falls back to an unassigned command');
  const click = async (id) => {
    handler({ id, pageId: 'library' });
    await nextTurn();
  };
  await click('import');
  assert.equal(calls.close, 1);
  assert.equal(stored.length, 1);
  await click('export');
  assert.equal(calls.close, 2);
  input = '{bad JSON';
  await click('import');
  assert.equal(calls.close, 3);
  assert.equal(stored.length, 1);
  await click('delete');
  assert.equal(calls.remove, 0);
  await click('confirm-delete');
  assert.equal(calls.remove, 1);
  cleanup();
});
