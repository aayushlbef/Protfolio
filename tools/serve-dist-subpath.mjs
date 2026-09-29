// Serves ./dist under a sub-path to mirror how GitHub Pages hosts a project
// site (https://<user>.github.io/<repo>/). Verifies the relative asset paths
// that base:'./' is meant to produce, which serving dist at "/" would not.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const BASE = '/Protfolio';
const ROOT = path.resolve('dist');
const PORT = Number(process.argv[2] || 4321);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
};

http
  .createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === BASE || p === BASE + '/') p = BASE + '/index.html';
    if (!p.startsWith(BASE)) { res.writeHead(404).end('outside base'); return; }

    const rel = p.slice(BASE.length + 1);
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('nope'); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found: ' + rel);
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log('serving dist at http://localhost:' + PORT + BASE + '/'));
