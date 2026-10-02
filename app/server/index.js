// Demo backend: the client's whole state blob lives in one SQLite row. Zero dependencies (node:sqlite, Node >= 22.13).
// ponytail: single shared state, no auth or per-record API; split into tables when real multi-user is needed.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const PORT = process.env.PORT || 3001;
const dist = path.resolve('dist');
const db = new DatabaseSync(process.env.DB_FILE || 'server/data.db');
db.exec('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, updated_at TEXT NOT NULL)');
const get = db.prepare('SELECT json FROM state WHERE id = 1');
const put = db.prepare("INSERT INTO state (id, json, updated_at) VALUES (1, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at");
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/state') {
    if (req.method === 'GET') {
      const row = get.get();
      res.writeHead(row ? 200 : 404, { 'Content-Type': 'application/json' });
      return res.end(row ? row.json : '{}');
    }
    if (req.method === 'PUT') {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        try { const body = Buffer.concat(chunks).toString(); JSON.parse(body); put.run(body); res.writeHead(204); }
        catch { res.writeHead(400); }
        res.end();
      });
      return;
    }
    res.writeHead(405); return res.end();
  }
  // Static SPA (after `npm run build`): fall back to index.html for unknown paths.
  let file = path.join(dist, path.normalize(url.pathname));
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('Run "npm run build" first'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
