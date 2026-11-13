// Lokaler Server für web/ auf http://localhost:8765. Setzt dieselben Header wie web/vercel.json (auch die CSP),
// damit Verstöße schon lokal auffallen. Keine Abhängigkeiten, nur Node.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../web/', import.meta.url));
const PORT = +process.env.PORT || 8765;
// Nur dieser Rechner (nicht das ganze WLAN). Für Tests am Handy: HOST=0.0.0.0 npm run dev
const HOST = process.env.HOST || '127.0.0.1';
const cfg = JSON.parse(await readFile(join(ROOT, 'vercel.json'), 'utf8'));
const globalHeaders = Object.fromEntries((cfg.headers.find((h) => h.source === '/(.*)')?.headers || []).map((h) => [h.key, h.value]));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.zip': 'application/zip', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

createServer(async (req, res) => {
  let path;
  try {
    path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  } catch {
    // kaputte %-Kodierung: 400 statt Absturz des Servers
    res.writeHead(400, { ...globalHeaders, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Ungültige Adresse');
    return;
  }
  let file = join(ROOT, path);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {
    file = extname(file) ? file : file + '.html'; // cleanUrls
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { ...globalHeaders, 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    const body = await readFile(join(ROOT, '404.html')).catch(() => 'Nicht gefunden');
    res.writeHead(404, { ...globalHeaders, 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body);
  }
}).listen(PORT, HOST, () => console.log(`StayMatch: http://localhost:${PORT}${HOST === '127.0.0.1' ? '' : ` (auch über ${HOST})`}`));
