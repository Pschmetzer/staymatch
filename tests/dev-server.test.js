// scripts/dev-server.mjs: kaputte URL → 400 statt Absturz, Server lauscht nur lokal
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const get = (port, p) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path: p }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); }).on('error', reject);
});

test('dev-server: %-Fehler in der Adresse gibt 400, Server läuft weiter', async (t) => {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const env = { ...process.env, PORT: String(port) };
  delete env.HOST;
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'scripts', 'dev-server.mjs')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => srv.kill());
  const out = await new Promise((resolve, reject) => {
    srv.stdout.once('data', d => resolve(String(d)));
    srv.once('exit', c => reject(new Error('Server beendet: ' + c)));
  });
  assert.match(out, /localhost/);
  assert.equal(await get(port, '/%E0%A4%A'), 400);
  assert.equal(await get(port, '/'), 200, 'Server läuft nach der kaputten Adresse weiter');
  assert.equal(srv.exitCode, null);
});
