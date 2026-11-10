// Syntax aller JavaScript-Dateien prüfen (ohne Shell-Schleife, läuft auch unter Windows) und shared/-Kopien abgleichen.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const dirs = [['shared', '.js'], ['web', '.js'], ['extension', '.js'], ['scripts', '.mjs'], ['.github/scripts', '.mjs']];
const run = (args) => spawnSync(process.execPath, args, { stdio: 'inherit' }).status === 0;
let ok = run(['scripts/sync-core.mjs', '--check']);
for (const [dir, ext] of dirs) for (const f of readdirSync(dir).filter((n) => n.endsWith(ext))) ok = run(['--check', `${dir}/${f}`]) && ok;
if (!ok) process.exit(1);
console.log('Syntax ok');
