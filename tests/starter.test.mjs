import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { crc32 } from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
const starter = path.join(root, 'plugins/starter');
test('copyable starter packs only runtime files and registers all four actions', async () => {
  execFileSync(process.execPath, [path.join(starter, 'pack.mjs')], { cwd: root });
  const m = JSON.parse(readFileSync(path.join(starter, 'manifest.json'), 'utf8'));
  const zip = readFileSync(path.join(starter, 'dist', m.id + '-' + m.version + '.yaqmc-plugin'));
  const entries = new Map();
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const size = zip.readUInt32LE(offset + 18),
      length = zip.readUInt16LE(offset + 26),
      extra = zip.readUInt16LE(offset + 28);
    const name = zip.subarray(offset + 30, offset + 30 + length).toString();
    const start = offset + 30 + length + extra,
      bytes = zip.subarray(start, start + size);
    assert.equal(crc32(bytes), zip.readUInt32LE(offset + 14));
    entries.set(name, bytes.toString());
    offset = start + size;
  }
  assert.deepEqual([...entries.keys()], ['manifest.json', 'main.js', 'LICENSE']);
  let definition;
  runInNewContext(entries.get('main.js'), {
    definePlugin: (value) => {
      definition = value;
    },
  });
  const actions = [];
  const dispose = await definition.activate({
    ui: { lyrics: { register: async (action) => actions.push(action) } },
    events: { on: () => () => {} },
  });
  assert.deepEqual(
    actions.map((action) => action.id),
    ['minimize', 'maximize', 'close', 'track-info'],
  );
  dispose();
});
test('standalone and workspace SDK mirrors match and offline API pages are present', () => {
  assert.equal(
    readFileSync(path.join(starter, 'api/sdk.ts'), 'utf8'),
    readFileSync(path.join(root, 'sdk/plugin/src/index.ts'), 'utf8'),
  );
  for (const file of [
    'API.md',
    'api/docs/plugin-lyrics-api.md',
    'api/docs/zh-CN/plugin-lyrics-api.md',
  ]) {
    assert.match(readFileSync(path.join(starter, file), 'utf8'), /ui\.lyrics/);
  }
  const sources = JSON.parse(readFileSync(path.join(starter, 'api/contract.json'), 'utf8')).sources;
  assert.ok(sources['plugins:sdk/plugin/src/index.ts']);
});
