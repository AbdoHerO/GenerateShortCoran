// Headless driver: frames are rendered by the same page used for preview, captured, and piped to ffmpeg.
// node renderer/render.mjs serve
// node renderer/render.mjs perf
// node renderer/render.mjs stills --t 3,10.5 --out out/wip/s
// node renderer/render.mjs sheet --from 0 --to 20 --n 12 --cols 4 --out out/wip/sheet.png
// node renderer/render.mjs video --from 0 --to 200.6 --out out/pilot.mp4
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const mode = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const DATA = opt('data', 'data/15_57-77/render_data.json');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, DATA), 'utf8'));
const FPS = Number(opt('fps', data.fps));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.png': 'image/png', '.mp3': 'audio/mpeg' };
function serve(port = 0) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const p = path.normalize(path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      const stat = fs.statSync(p), type = TYPES[path.extname(p)] ?? 'application/octet-stream';
      const range = req.headers.range;
      if (range) {
        const [a, b] = range.replace('bytes=', '').split('-'); const s = Number(a), e = b ? Number(b) : stat.size - 1;
        rsp.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${s}-${e}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': e - s + 1 });
        return fs.createReadStream(p, { start: s, end: e }).pipe(rsp);
      }
      rsp.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(port, '127.0.0.1', () => res(srv));
  });
}

async function openPage(srv) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--force-color-profile=srgb', '--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/renderer/index.html?export=1&data=${encodeURIComponent(DATA)}`);
  try { await page.waitForFunction('window.R && window.R.ready', null, { timeout: 60000 }); }
  catch (e) { throw new Error('renderer failed to init: ' + errors.join(' | ')); }
  const fonts = await page.evaluate(() => window.R.fontsOk);
  const bad = Object.entries(fonts).filter(([, ok]) => !ok);
  if (bad.length) throw new Error('fonts not loaded (refusing to render with fallback fonts): ' + bad.map(([f]) => f).join(', '));
  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  return { browser, page, errors };
}

async function frame(page, t, type = 'png') {
  await page.evaluate((t) => window.R.renderAt(t), t);
  return page.screenshot({ type, quality: type === 'jpeg' ? 95 : undefined, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
}

function ensureDir(d) { const p = path.resolve(ROOT, d); if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); return p; }

async function main() {
  const srv = await serve(mode === 'serve' ? Number(opt('port', 5173)) : 0);
  if (mode === 'serve') {
    console.log(`preview: http://127.0.0.1:${srv.address().port}/renderer/index.html?data=${DATA}`);
    return;
  }
  if (mode === 'review') {
    const out = path.resolve(ROOT, opt('out', path.join(path.dirname(DATA), 'review_sheet.pdf')));
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${srv.address().port}/renderer/review.html?data=${encodeURIComponent(DATA)}`);
    await page.waitForFunction('window.done', null, { timeout: 60000 });
    await page.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true });
    await page.setViewportSize({ width: 820, height: 1200 });
    await page.screenshot({ path: out.replace(/\.pdf$/, '_preview.png'), clip: { x: 0, y: 0, width: 820, height: 1500 } });
    await browser.close(); srv.close();
    console.log(out);
    return;
  }
  const { browser, page, errors } = await openPage(srv);
  try {
    if (mode === 'perf') {
      for (const type of ['png', 'jpeg']) {
        const t0 = Date.now();
        for (let i = 0; i < 20; i++) await frame(page, 30 + i / FPS, type);
        console.log(`${type}: ${((Date.now() - t0) / 20).toFixed(0)} ms/frame`);
      }
    } else if (mode === 'stills') {
      const out = opt('out', 'out/wip/still');
      ensureDir(path.dirname(out));
      for (const t of opt('t', '1').split(',').map(Number)) {
        const f = path.resolve(ROOT, `${out}_${t.toFixed(2)}.png`);
        fs.writeFileSync(f, await frame(page, t));
        console.log(f);
      }
    } else if (mode === 'sheet') {
      const from = Number(opt('from', 0)), to = Number(opt('to', data.duration)), n = Number(opt('n', 12)), cols = Number(opt('cols', 4));
      const out = path.resolve(ROOT, opt('out', 'out/wip/sheet.png'));
      const tmp = ensureDir('out/.tmp_sheet');
      for (const f of fs.readdirSync(tmp)) fs.unlinkSync(path.join(tmp, f));
      const times = opt('t') ? opt('t').split(',').map(Number) : [...Array(n).keys()].map((i) => from + ((to - from) * i) / Math.max(1, n - 1));
      for (let i = 0; i < times.length; i++) fs.writeFileSync(path.join(tmp, `f_${String(i).padStart(3, '0')}.png`), await frame(page, times[i]));
      const rows = Math.ceil(times.length / cols);
      const label = `drawtext=fontfile=renderer/fonts/Montserrat-SemiBold.ttf:text='%{eif\\:n\\:d}':x=8:y=8:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.6`;
      const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(tmp, 'f_%03d.png'), '-vf', `scale=360:640,${label},tile=${cols}x${rows}`, '-frames:v', '1', out], { cwd: ROOT, encoding: 'utf8' });
      if (r.status) throw new Error(r.stderr);
      console.log(out, '\n' + times.map((t, i) => `${i}: ${t.toFixed(2)}s`).join('  '));
    } else if (mode === 'video') {
      const from = Number(opt('from', 0)), to = Number(opt('to', data.duration));
      const out = path.resolve(ROOT, opt('out', 'out/pilot.mp4'));
      ensureDir(path.dirname(path.relative(ROOT, out)));
      const silent = out.replace(/\.mp4$/, '.silent.tmp.mp4');
      const nFrames = Math.round((to - from) * FPS);
      const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
        '-c:v', 'libx264', '-preset', opt('preset', 'medium'), '-crf', opt('crf', '16'), '-pix_fmt', 'yuv420p',
        '-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
        silent], { stdio: ['pipe', 'inherit', 'inherit'] });
      const t0 = Date.now();
      for (let i = 0; i < nFrames; i++) {
        const buf = await frame(page, from + i / FPS, 'jpeg');
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
        if (i % 15 === 0 && i > 0) {
          const el = (Date.now() - t0) / 1000;
          console.log('@@ ' + JSON.stringify({ step: 'render', done: i, total: nFrames, eta_s: Math.round((el / i) * (nFrames - i)) }));
        }
        if (i % 150 === 0) {
          const el = (Date.now() - t0) / 1000, eta = (el / (i + 1)) * (nFrames - i - 1);
          console.log(`frame ${i}/${nFrames}  t=${(from + i / FPS).toFixed(1)}s  ${(el / (i + 1) * 1000).toFixed(0)} ms/f  eta ${(eta / 60).toFixed(1)} min`);
        }
        if (errors.length) throw new Error('page errors during render: ' + errors.join(' | '));
      }
      ff.stdin.end();
      await new Promise((r) => ff.on('close', r));
      const audio = path.join(ROOT, path.dirname(DATA), data.audio.file);
      const m = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', silent, '-ss', String(from), '-t', String(to - from), '-i', audio,
        '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out], { encoding: 'utf8' });
      if (m.status) throw new Error(m.stderr);
      fs.unlinkSync(silent);
      console.log(`done: ${out}  (${nFrames} frames in ${((Date.now() - t0) / 60000).toFixed(1)} min)`);
    }
  } finally {
    await browser.close();
    srv.close();
  }
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
