// Motion graphics v3 acceptance check: "in any 2-second window something visibly moves in the scene".
// Renders the video's frames in the page (no encoding) every 0.5 s and measures, inside the scene frame, the share of
// pixels that changed by more than 10 levels between consecutive samples. A 2-second window is STATIC when no pair of
// its samples reaches the threshold (default 0.4 % of the frame = about 3,300 pixels).
//   node renderer/tests/motion_check.mjs --data data/<id>/render_data.json [--thr 0.004] [--json out.json]
// Exit 1 if any window of the recitation (cover and outro excluded) is static.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from '../browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const DATA = opt('data');
if (!DATA) { console.error('usage: motion_check.mjs --data data/<id>/render_data.json'); process.exit(2); }
const THR = Number(opt('thr', 0.004)), STEP = 0.5;
const data = JSON.parse(fs.readFileSync(path.join(ROOT, DATA), 'utf8'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf' };
const srv = http.createServer((q, r) => {
  const p = path.normalize(path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] ?? 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
}).listen(0, '127.0.0.1');
await new Promise((r) => srv.on('listening', r));
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(`http://127.0.0.1:${srv.address().port}/renderer/index.html?export=1&data=${encodeURIComponent(DATA)}`);
await page.waitForFunction('window.R && window.R.ready', null, { timeout: 60000 });
const t0 = (data.cover?.dur || 0) + 0.6, t1 = data.outro_start;
const times = [];
for (let t = t0; t <= t1 + 1e-6; t += STEP) times.push(+t.toFixed(3));
const diffs = await page.evaluate((times) => {
  const cv = document.getElementById('c'), cx = cv.getContext('2d', { willReadFrequently: true });
  const X = 60, Y = 222, W = 960, H = 870;
  let prev = null; const out = [];
  for (const t of times) {
    window.R.renderAt(t);
    const d = cx.getImageData(X, Y, W, H).data;
    if (prev) {
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (Math.abs(d[i] - prev[i]) > 10 || Math.abs(d[i + 1] - prev[i + 1]) > 10 || Math.abs(d[i + 2] - prev[i + 2]) > 10) n++;
      }
      out.push(n / (W * H));
    }
    prev = d;
  }
  return out;
}, times);
await browser.close(); srv.close();
// window [t, t+2]: samples t..t+2 -> 4 consecutive pairs
const per = Math.round(2 / STEP), windows = [];
for (let i = 0; i + per <= diffs.length; i++) {
  const m = Math.max(...diffs.slice(i, i + per));
  windows.push({ t: times[i], max: m });
}
const stat = windows.filter((w) => w.max < THR);
const pct = (x) => (x * 100).toFixed(2) + '%';
console.log(`${DATA}: ${windows.length} two-second windows from ${t0.toFixed(1)} s to ${t1.toFixed(1)} s; median change ${pct([...diffs].sort((a, b) => a - b)[diffs.length >> 1])}, weakest window ${pct(Math.min(...windows.map((w) => w.max)))}`);
if (stat.length) console.log(`STATIC windows (< ${pct(THR)} of the picture changes): ` + stat.map((w) => `${w.t.toFixed(1)}s (${pct(w.max)})`).join(', '));
else console.log('MOTION OK: something visibly moves in every 2-second window');
if (opt('json')) fs.writeFileSync(path.resolve(ROOT, opt('json')), JSON.stringify({ times, diffs, windows }, null, 1));
process.exit(stat.length ? 1 : 0);
