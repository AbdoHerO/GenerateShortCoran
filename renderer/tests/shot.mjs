import { launchBrowser } from '../browser.mjs'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd(); const [, , page_, out] = process.argv;
const T = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.ttf':'font/ttf' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(new URL(q.url,'http://x').pathname)); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, {'Content-Type': T[path.extname(p)] ?? 'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0, '127.0.0.1');
await new Promise(r => srv.on('listening', r));
const b = await launchBrowser(); const pg = await b.newPage({ viewport: { width: 1080, height: 1900 } });
await pg.goto(`http://127.0.0.1:${srv.address().port}/${page_}`); await pg.waitForFunction('window.done');
await pg.screenshot({ path: out }); await b.close(); srv.close();
