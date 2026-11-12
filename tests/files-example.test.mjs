import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
execFileSync(process.execPath, ['scripts/build-plugin-examples.mjs'], { cwd: root, stdio: 'pipe' });
const source = readFileSync(path.join(root, 'plugins/script-files/dist/main.js'), 'utf8');

async function start() {
  let definition,
    listener,
    rendered = 0;
  const calls = [];
  const files = Object.fromEntries(
    [
      'pickFile',
      'pickDirectory',
      'stat',
      'list',
      'readFile',
      'writeFile',
      'mkdir',
      'rename',
      'remove',
      'close',
    ].map((name) => [
      name,
      async (...args) => {
        calls.push([name, ...args]);
        if (name.startsWith('pick'))
          return {
            handle: 'opaque',
            name: 'scratch',
            type: 'directory',
            writable: args[0]?.writable === true,
          };
        if (name === 'list')
          return { entries: [{ name: 'sample.txt', type: 'file', size: 2 }], nextCursor: null };
        if (name === 'readFile') return { data: 'ok', bytesRead: 2, eof: true };
        return { ok: true };
      },
    ]),
  );
  files.capabilities = async () => ({ available: true, directoryDelete: false });
  runInNewContext(source, {
    definePlugin: (value) => {
      definition = value;
    },
  });
  const dispose = await definition.activate({
    files,
    pages: {
      register: async () => {},
      render: async () => {
        rendered++;
      },
    },
    navigation: { register: async () => {} },
    events: {
      on: (_name, handler) => {
        listener = handler;
        return () => {
          listener = null;
        };
      },
    },
  });
  const action = async (id) => {
    const before = rendered;
    listener({ slot: 'page', pageId: 'files', id });
    for (let i = 0; i < 20 && rendered === before; i++) await new Promise(setImmediate);
    assert.ok(rendered > before, `action ${id} completed`);
  };
  return { calls, action, dispose };
}

test('local files example uses explicit selection, requires delete confirmation and releases its handle', async () => {
  const { calls, action, dispose } = await start();
  assert.equal(calls.length, 0, 'activation must not open a picker or mutate files');
  await action('pick-write');
  await action('select-0');
  await action('delete');
  assert.equal(calls.filter(([name]) => name === 'remove').length, 0);
  await action('delete');
  const deleted = calls.find(([name]) => name === 'remove');
  assert.equal(deleted[1], 'opaque');
  assert.equal(deleted[2], 'sample.txt');
  dispose();
  assert.ok(calls.some(([name, handle]) => name === 'close' && handle === 'opaque'));
});

test('local files example creates a bounded note only after its action is clicked', async () => {
  const { calls, action, dispose } = await start();
  await action('pick-write');
  assert.equal(calls.filter(([name]) => name === 'writeFile').length, 0);
  await action('create-note');
  const write = calls.find(([name]) => name === 'writeFile');
  assert.equal(write[1], 'opaque');
  assert.match(write[2].path, /^yaqmc-example-\d+\.txt$/);
  assert.equal(write[2].overwrite, undefined, 'example must not overwrite an existing file');
  assert.ok(write[2].data.length < 512 * 1024);
  dispose();
});
