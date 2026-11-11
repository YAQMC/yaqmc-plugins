import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
test('independent API export reads client contracts without client SDK, docs or export tools', () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'yaqmc-plugin-contract-'));
  const client = path.join(temporary, 'client');
  const output = path.join(temporary, 'copy');
  mkdirSync(client);
  const sources = JSON.parse(
    readFileSync(path.join(root, 'plugins/starter/api/contract.json'), 'utf8'),
  ).sources;
  const put = (file, value) => {
    const target = path.join(client, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, value);
  };
  for (const name of Object.keys(sources).filter((name) => name.startsWith('client:')))
    put(name.slice(7), '// synthetic client contract\n');
  put('LICENSE', readFileSync(path.join(root, 'LICENSE')));
  const git = (...args) => execFileSync('git', args, { cwd: client, stdio: 'pipe' });
  git('init', '-q');
  git('add', '.');
  git(
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.invalid',
    'commit',
    '-qm',
    'Synthetic contracts',
  );
  const run = (...args) =>
    execFileSync(
      process.execPath,
      ['scripts/export-api.mjs', '--client', client, '--out', output, ...args],
      { cwd: root, stdio: 'pipe' },
    );
  try {
    run();
    run('--check');
    const custom = path.join(output, 'plugins/starter/main.js');
    writeFileSync(custom, '// user-owned plugin code\n');
    put('src/application/plugin-ui.ts', '// changed contract\n');
    assert.throws(
      () => run('--check'),
      (error) => String(error.stderr).includes('Plugin API mirror is stale'),
    );
    run();
    run('--check');
    assert.equal(readFileSync(custom, 'utf8'), '// user-owned plugin code\n');
    const contract = JSON.parse(
      readFileSync(path.join(output, 'plugins/starter/api/contract.json'), 'utf8'),
    );
    assert.equal(contract.schemaVersion, 2);
    assert.ok(contract.sources['plugins:sdk/plugin/src/index.ts']);
    assert.ok(contract.sources['client:src/application/plugin-ui.ts']);
  } finally {
    assert.equal(path.dirname(temporary), os.tmpdir());
    rmSync(temporary, { recursive: true, force: true });
  }
});
