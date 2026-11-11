import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const upstream = JSON.parse(readFileSync(path.join(root, 'UPSTREAM.json'), 'utf8'));
if (process.argv.includes('--latest')) {
  upstream.revision = execFileSync(
    'git',
    ['ls-remote', 'https://github.com/YAQMC/YAQMC.git', 'refs/heads/main'],
    { encoding: 'utf8' },
  ).split(/\s/)[0];
}
const source = path.join(root, '.upstream');
if (!existsSync(path.join(source, '.git'))) {
  mkdirSync(source, { recursive: true });
  execFileSync('git', ['init', source]);
  execFileSync('git', [
    '-C',
    source,
    'remote',
    'add',
    'origin',
    'https://github.com/YAQMC/YAQMC.git',
  ]);
}
execFileSync('git', ['-C', source, 'fetch', '--depth=1', 'origin', upstream.revision], {
  stdio: 'inherit',
});
execFileSync('git', ['-C', source, 'checkout', '--detach', upstream.revision], {
  stdio: 'inherit',
});
execFileSync(
  process.execPath,
  [
    path.join(root, 'scripts/export-api.mjs'),
    '--client',
    source,
    ...process.argv.slice(2).filter((value) => value !== '--latest'),
  ],
  { cwd: source, stdio: 'inherit' },
);
