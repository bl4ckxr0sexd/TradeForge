// TradeForge dev server — live view while editing.
// Serves the site, re-runs build.mjs when inputs change, live-reloads the browser.
//
// Usage: node dev.mjs   →  http://localhost:3000

import { createServer } from 'node:http';
import { readFileSync, existsSync, watch, watchFile } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { execFile } from 'node:child_process';

const ROOT = new URL('.', import.meta.url).pathname;
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

const RELOAD_SNIPPET =
  '<script>new EventSource("/__reload").onmessage = () => location.reload();</script>';

// ---- live-reload channel (SSE) ----
const clients = new Set();
const broadcast = () => {
  for (const res of clients) res.write('data: reload\n\n');
};

// ---- static server ----
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/__reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  let path = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
  if (path === '/' || path === '') path = '/index.html';
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT) || !existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 — not found');
    return;
  }

  const type = MIME[extname(file)] || 'application/octet-stream';
  let body = readFileSync(file);
  if (type.startsWith('text/html')) {
    body = Buffer.from(
      body.toString('utf8').replace('</body>', `${RELOAD_SNIPPET}\n</body>`)
    );
  }
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
});

// ---- rebuild on input change ----
let timer = null;
let building = false;

function rebuild(reason) {
  if (building) return;
  building = true;
  execFile('node', [join(ROOT, 'build.mjs')], { cwd: ROOT }, (err, stdout, stderr) => {
    building = false;
    if (err) {
      console.error(`✗ build failed (${reason}):\n${stderr || err.message}`);
      return; // keep serving the last good build
    }
    console.log(`✓ rebuilt (${reason})`);
    broadcast();
  });
}

const schedule = (reason) => {
  clearTimeout(timer);
  timer = setTimeout(() => rebuild(reason), 150);
};

for (const dir of ['src', 'design']) {
  watch(join(ROOT, dir), { recursive: true }, (_, name) => schedule(`${dir}/${name}`));
}
for (const f of ['.env', 'build.mjs', 'privacy.html', 'terms.html']) {
  watchFile(join(ROOT, f), { interval: 500 }, () => schedule(f));
}

server.listen(PORT, () => {
  console.log(`TradeForge dev server → http://localhost:${PORT}`);
  console.log('watching: src/, design/, .env, build.mjs, privacy.html, terms.html');
  rebuild('startup');
});
