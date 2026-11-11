import { execFileSync } from 'node:child_process';
import { copyFileSync, readFileSync } from 'node:fs';
execFileSync(process.execPath, ['plugins/starter/pack.mjs'], { stdio: 'inherit' });
const m = JSON.parse(readFileSync('plugins/starter/manifest.json', 'utf8'));
copyFileSync(
  'plugins/starter/dist/' + m.id + '-' + m.version + '.yaqmc-plugin',
  'plugins/packages/' + m.id + '-' + m.version + '.yaqmc-plugin',
);
