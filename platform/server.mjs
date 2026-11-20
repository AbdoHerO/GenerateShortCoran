// Quran Video Studio - local web app.  Start:  node platform/server.mjs   (or double-click "Start Quran Studio.bat")
// Listens on 127.0.0.1 only. Runs the existing pipeline (fetch -> direct -> verify -> prepare -> render) as child
// processes, one preparation and one render at a time. Project state lives in data/<id>/project.json.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'platform', 'public');
const PORT = Number(process.env.PORT || 5178);
const PY = fs.existsSync(path.join(ROOT, '.venv', 'Scripts', 'python.exe')) ? path.join(ROOT, '.venv', 'Scripts', 'python.exe') : path.join(ROOT, '.venv', 'bin', 'python');
const PYARGS = ['-I', '-X', 'utf8'];
const LEGACY = { '15_57-77': 'out/pilot_15_57-77_alafasy.mp4', '26_60-68': 'out/short_musa_26_60-68_alafasy.mp4' };
const CATALOG = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'catalog.json'), 'utf8'));
const SCENES = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'renderer', 'js', 'scene_catalog.json'), 'utf8'));

// ------------------------------------------------------------------ helpers
const now = () => new Date().toISOString();
const rel = (...p) => path.join(ROOT, ...p);
const readJSON = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const writeJSON = (p, o) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p + '.tmp', JSON.stringify(o, null, 1)); fs.renameSync(p + '.tmp', p); };
const validId = (id) => /^[0-9]{1,3}_[0-9]{1,3}-[0-9]{1,3}(_r[0-9]{1,3})?$/.test(id);
const projectId = (ch, a, b, rec) => `${ch}_${a}-${b}${rec === 7 ? '' : '_r' + rec}`;

function readEnv() {
  const env = {};
  const p = rel('.env');
  if (fs.existsSync(p)) for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}
function setEnv(key, value) {   // edits one line of .env, keeps everything else untouched
  const p = rel('.env');
  const lines = fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split(/\r?\n/) : [];
  const i = lines.findIndex((l) => l.trim().startsWith(key + '='));
  if (value === '' || value == null) { if (i >= 0) lines.splice(i, 1); }
  else if (i >= 0) lines[i] = `${key}=${value}`;
  else { if (lines.length && lines[lines.length - 1] === '') lines.pop(); lines.push(`${key}=${value}`, ''); }
  fs.writeFileSync(p, lines.join('\n'));
}

// ------------------------------------------------------------------ project store
const projects = new Map();
function save(p) { p.updated = now(); writeJSON(rel('data', p.id, 'project.json'), p); }
function load(id) {
  if (projects.has(id)) return projects.get(id);
  const p = readJSON(rel('data', id, 'project.json'));
  if (p) projects.set(id, p);
  return p;
}
function newSteps(director) {
  return [
    { key: 'fetch', label: 'Fetching verses, tafsir and recitation', state: 'pending' },
    { key: 'direct', label: director === 'claude' ? 'Claude is writing the storyboard' : 'Writing a simple storyboard', state: 'pending' },
    { key: 'verify', label: 'Accuracy checks (text, timing, explanations)', state: 'pending' },
    { key: 'prepare', label: 'Preparing audio and timeline', state: 'pending' },
  ];
}
function emptyReview() { return { verses: {}, timing: {}, titles: false, reviewer: '', approved: false, approved_at: null }; }

// adopt passages made before the app existed (storyboard + data folder without project.json)
function adoptExisting() {
  for (const f of fs.existsSync(rel('storyboard')) ? fs.readdirSync(rel('storyboard')) : []) {
    const id = f.replace(/\.json$/, '');
    if (!f.endsWith('.json') || !validId(id) || fs.existsSync(rel('data', id, 'project.json')) || !fs.existsSync(rel('data', id, 'source.json'))) continue;
    const sb = readJSON(rel('storyboard', f)); const src = readJSON(rel('data', id, 'source.json'));
    if (!sb || !src) continue;
    const ready = fs.existsSync(rel('data', id, 'render_data.json'));
    const legacy = LEGACY[id];
    const p = {
      id, chapter: sb.passage.chapter, from: sb.passage.from, to: sb.passage.to, reciter: src.meta.recitation_id,
      style: 'story', director: legacy ? 'hand' : (sb.director?.mode || 'auto'), handmade: !!legacy, created: now(),
      stage: ready ? 'review' : 'error', steps: newSteps('auto').map((s) => ({ ...s, state: ready ? 'done' : 'pending' })),
      error: ready ? null : { title: 'Not prepared yet', detail: 'Click "Try again" to prepare this passage.' },
      review: emptyReview(),
      render: legacy && fs.existsSync(rel(legacy)) ? { state: 'done', file: legacy, finished_at: now() } : { state: 'idle' },
    };
    save(p); projects.set(id, p);
  }
}

// ------------------------------------------------------------------ process runner
function run(p, step, cmd, args, onEvent) {
  return new Promise((resolve) => {
    const st = p.steps?.find((s) => s.key === step);
    if (st) { st.state = 'running'; st.detail = ''; st.progress = null; }
    save(p);
    const log = rel('data', p.id, 'log.txt');
    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.appendFileSync(log, `\n[${now()}] $ ${path.basename(cmd)} ${args.join(' ')}\n`);
    const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    const tail = [], events = [];
    let buf = '';
    const onData = (d) => {
      buf += d.toString('utf8');
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1);
        if (line.startsWith('@@ ')) {
          try { const ev = JSON.parse(line.slice(3)); events.push(ev); onEvent?.(ev, st); } catch { /* ignore */ }
        } else if (line.trim()) {
          tail.push(line); if (tail.length > 60) tail.shift();
          fs.appendFileSync(log, line + '\n');
        }
      }
    };
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    child.on('close', (code) => {
      if (st) { st.state = code === 0 ? 'done' : 'error'; st.progress = null; }
      save(p);
      resolve({ code, tail, events });
    });
  });
}

class Queue {
  constructor() { this.items = []; this.busy = false; }
  push(fn) { this.items.push(fn); this.next(); }
  async next() {
    if (this.busy || !this.items.length) return;
    this.busy = true;
    const fn = this.items.shift();
    try { await fn(); } catch (e) { console.error(e); }
    this.busy = false; this.next();
  }
  position(fn) { return this.items.indexOf(fn); }
}
const prepQ = new Queue(), renderQ = new Queue();

function verifySummary(id) {
  const md = (fs.existsSync(rel('data', id, 'verify_report.md')) ? fs.readFileSync(rel('data', id, 'verify_report.md'), 'utf8') : '').replace(/\r/g, '');
  const m = md.match(/Result: \*\*(\w+)\*\*\s+\((\d+) pass, (\d+) fail, (\d+) info\)/);
  const rows = [...md.matchAll(/^- (PASS|FAIL|INFO): (.*)$/gm)];
  let area = '';
  const items = [];
  for (const line of md.split('\n')) {
    const h = line.match(/^## (\w+)/); if (h) area = h[1];
    const r = line.match(/^- (FAIL|INFO): (.*)$/); if (r) items.push({ level: r[1], area, msg: r[2] });
  }
  return m ? { passed: m[1] === 'PASSED', pass: +m[2], fail: +m[3], info: +m[4], items, total: rows.length } : null;
}

function fail(p, title, detail, extra = {}) {
  p.stage = extra.blocked ? 'blocked' : 'error';
  p.error = { title, detail, ...extra };
  save(p);
}

// fetch -> direct -> verify -> prepare
async function prepareJob(p, { from = 'fetch' } = {}) {
  p.stage = 'preparing'; p.error = null; p.review = emptyReview();
  const order = ['fetch', 'direct', 'verify', 'prepare'];
  for (const s of p.steps) if (order.indexOf(s.key) >= order.indexOf(from)) { s.state = 'pending'; s.detail = ''; }
  save(p);
  const sbPath = `storyboard/${p.id}.json`;
  if (order.indexOf(from) <= 0) {
    const r = await run(p, 'fetch', PY, [...PYARGS, 'pipeline/fetch_data.py', '--chapter', p.chapter, '--from', p.from, '--to', p.to, '--recitation', p.reciter, '--out', `data/${p.id}`].map(String),
      (ev, st) => {
        if (ev.what === 'audio') { st.detail = `Downloading the recitation (${Math.round((100 * ev.done) / ev.total)}%)`; st.progress = ev.done / ev.total; }
        else if (ev.what) { st.detail = `${ev.what === 'verses' ? 'Verses' : ev.what.replace('tafsir 16', 'Tafsir al-Muyassar').replace('tafsir 91', "Tafsir as-Sa'di")} ${ev.done + 1}/${ev.total}`; st.progress = (ev.done + 1) / ev.total; }
        save(p);
      });
    if (r.code) return fail(p, 'Could not download the passage', 'Check your internet connection and try again.', { log: r.tail.slice(-12) });
  }
  if (order.indexOf(from) <= 1) {
    const r = await run(p, 'direct', PY, [...PYARGS, 'pipeline/direct.py', '--id', p.id, '--mode', p.director === 'claude' ? 'claude' : 'auto', '--style', p.style],
      (ev, st) => { if (ev.what) { st.detail = ev.what; save(p); } if (ev.done && ev.cost_usd != null) { p.cost_usd = ev.cost_usd; } });
    if (r.code) {
      const msg = r.tail.filter((l) => !l.startsWith('Traceback') && !l.startsWith('  ')).slice(-2).join(' ');
      return fail(p, p.director === 'claude' ? 'Claude could not write the storyboard' : 'Could not write the storyboard', msg, { log: r.tail.slice(-12), canSimple: p.director === 'claude' });
    }
  }
  {
    const r = await run(p, 'verify', PY, [...PYARGS, 'pipeline/verify.py', sbPath]);
    p.verify = verifySummary(p.id);
    if (r.code) {
      const fails = (p.verify?.items || []).filter((x) => x.level === 'FAIL');
      const dataProblem = fails.some((x) => ['text', 'audio', 'resources'].includes(x.area));
      return fail(p, dataProblem ? 'This passage did not pass the accuracy checks' : 'The storyboard did not pass the checks',
        dataProblem ? 'Nothing is produced when the Quran text, the recitation timing or the sources cannot be verified. Try another reciter or a different verse range.'
          : 'Edit the storyboard or ask for a new one.', { blocked: dataProblem, fails });
    }
  }
  {
    const r = await run(p, 'prepare', PY, [...PYARGS, 'pipeline/prepare.py', sbPath]);
    if (r.code) {
      const msg = r.tail.filter((l) => /cut|failed|error/i.test(l)).slice(-2).join(' ');
      return fail(p, 'Could not prepare the audio', msg || 'See the technical log.', { log: r.tail.slice(-12), blocked: /no pause found/.test(msg) });
    }
  }
  const rd = readJSON(rel('data', p.id, 'render_data.json'));
  p.duration = rd?.duration;
  p.stage = 'review'; p.error = null;
  if (p.render?.state === 'done') p.render = { state: 'stale', file: p.render.file };
  save(p);
}

async function renderJob(p) {
  const cat = CATALOG();
  const s = cat.surahs.find((x) => x.n === p.chapter), r = cat.reciters.find((x) => x.id === p.reciter);
  const slug = (x) => String(x || '').normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const file = `out/${p.id}/${slug(s?.name_en)}_${p.chapter}_${p.from}-${p.to}_${slug((r?.name_en || 'reciter').split(' ').pop())}.mp4`;
  p.render = { state: 'running', progress: 0, eta_s: null, started_at: now() }; save(p);
  const res = await run(p, 'render', process.execPath, ['renderer/render.mjs', 'video', '--data', `data/${p.id}/render_data.json`, '--out', file, '--crf', '17'],
    (ev) => { if (ev.step === 'render') { p.render.progress = ev.done / ev.total; p.render.eta_s = ev.eta_s; save(p); } });
  if (res.code) { p.render = { state: 'error', error: res.tail.slice(-6).join('\n') }; save(p); return; }
  p.render.progress = 1; p.render.detail = 'Writing the review sheet'; save(p);
  await run(p, 'review', process.execPath, ['renderer/render.mjs', 'review', '--data', `data/${p.id}/render_data.json`, '--out', `out/${p.id}/review_sheet.pdf`]);
  // the first frame IS the designed cover: export it full size for Instagram / YouTube
  const cover = `out/${p.id}/cover.jpg`;
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', rel(file), '-frames:v', '1', '-q:v', '2', rel(cover)]);
  p.render = { state: 'done', file, sheet: `out/${p.id}/review_sheet.pdf`, cover: fs.existsSync(rel(cover)) ? cover : null, finished_at: now() };
  p.stage = 'done'; save(p);
}

// ------------------------------------------------------------------ API
function summary(p) {
  const cat = CATALOG();
  if (p.duration == null && p.stage !== 'preparing') p.duration = readJSON(rel('data', p.id, 'render_data.json'))?.duration ?? null;
  const s = cat.surahs.find((x) => x.n === p.chapter) || {}, r = cat.reciters.find((x) => x.id === p.reciter) || {};
  return { id: p.id, chapter: p.chapter, from: p.from, to: p.to, reciter: p.reciter, surah_en: s.name_en, surah_ar: s.name_ar, reciter_en: r.name_en, reciter_ar: r.name_ar,
    reciter_style: r.style, stage: p.stage, render: p.render?.state, approved: !!p.review?.approved, duration: p.duration, created: p.created, updated: p.updated,
    handmade: !!p.handmade, director: p.director, style: p.style };
}

function projectDetail(p) {
  const sb = readJSON(rel('storyboard', `${p.id}.json`));
  const rd = readJSON(rel('data', p.id, 'render_data.json'));
  const inPrep = prepQ.items.length + (prepQ.busy ? 1 : 0);
  return {
    ...summary(p), steps: p.steps, error: p.error, verify: p.verify || verifySummary(p.id), review: p.review, render: p.render,
    cost_usd: sb?.director?.cost_usd ?? p.cost_usd ?? null, director_info: sb?.director || null,
    ready: !!rd, data_url: rd ? `data/${p.id}/render_data.json` : null,
    data_version: rd ? Math.round(fs.statSync(rel('data', p.id, 'render_data.json')).mtimeMs) : null,
    verses: rd ? rd.verses.map((v) => ({ n: v.n, key: v.key, num_ar: v.num_ar, start: v.start, end: v.end, words: v.words, segments: v.segments, translation: v.translation,
      glosses: v.glosses.map((g) => ({ chip: g.chip, excerpt: g.excerpt, source: g.source, start: g.start })) })) : [],
    chapters: rd ? rd.chapters.map((c) => ({ id: c.id, title: c.title, verses: c.verses, scene: c.scene, params: c.params, start: c.start })) : [],
    timing_corrections: rd?.timing_corrections || [], aligned_boundaries: rd?.aligned_boundaries || [], timing_flags: rd?.timing_flags || [], cover: rd?.cover || null, queue: { prep: inPrep, render: renderQ.items.length + (renderQ.busy ? 1 : 0) },
  };
}

function editorSource(p) {
  const src = readJSON(rel('data', p.id, 'source.json'));
  const sb = readJSON(rel('storyboard', `${p.id}.json`));
  const rd = readJSON(rel('data', p.id, 'render_data.json'));
  const strip = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().normalize('NFC');
  const times = new Map((rd?.verses || []).map((v) => [v.n, v.segments]));
  return {
    tafsir_labels: sb.tafsir_labels, chapters: sb.chapters, glosses: sb.glosses, scenes: SCENES(),
    verses: src.verses.map((v) => ({
      n: v.verse_number, key: v.verse_key,
      words: v.words.filter((w) => w.char_type_name === 'word').map((w) => ({ pos: w.position, text: w.text_uthmani.normalize('NFC'), t: times.get(v.verse_number)?.find((s) => s[0] === w.position)?.[1] })),
      tafsir: Object.fromEntries(Object.entries(src.tafsirs).map(([tid, m]) => [tid, strip(m[v.verse_key]?.text)])),
    })),
  };
}

async function dryVerify(id, sb) {
  const cand = rel('storyboard', `${id}.candidate.json`);
  writeJSON(cand, sb);
  const r = spawnSync(PY, [...PYARGS, 'pipeline/verify.py', `storyboard/${id}.candidate.json`, '--json'], { cwd: ROOT, encoding: 'utf8' });
  fs.rmSync(cand, { force: true });
  const line = (r.stdout || '').split('\n').find((l) => l.startsWith('@@ '));
  const res = line ? JSON.parse(line.slice(3)).verify : { passed: false, results: [['FAIL', 'internal', (r.stderr || '').slice(-400)]] };
  return { passed: res.passed, fails: res.results.filter((x) => x[0] === 'FAIL').map(([, area, msg]) => ({ area, msg })) };
}

// only these storyboard fields can be changed from the app; Quran text is never part of the storyboard anyway
function applyEdits(sb, body) {
  const out = { ...sb };
  if (Array.isArray(body.chapters)) {
    const byId = new Map(sb.chapters.map((c) => [c.id, c]));
    out.chapters = sb.chapters.map((c) => {
      const e = body.chapters.find((x) => x.id === c.id);
      if (!e) return c;
      const n = { ...c, title: String(e.title ?? c.title).trim() };
      if (e.scene === 'ambient' && e.mood) { n.scene = 'ambient'; n.params = { mood: e.mood }; delete n.bg; }
      else if (e.scene === 'stage' && e.params) { n.scene = 'stage'; n.params = e.params; delete n.bg; }
      return n;
    });
    void byId;
  }
  if (Array.isArray(body.glosses)) {
    out.glosses = body.glosses.map((g) => ({ verse: +g.verse, words: [+g.words[0], +g.words[1]], tafsir: +g.tafsir, excerpt: String(g.excerpt || '').trim(),
      target: String(g.target || ''), tone: String(g.tone || 'blue') }));
  }
  return out;
}

function deleteProject(p) {
  fs.rmSync(rel('data', p.id), { recursive: true, force: true });
  fs.rmSync(rel('storyboard', `${p.id}.json`), { force: true });
  fs.rmSync(rel('out', p.id), { recursive: true, force: true });
  projects.delete(p.id);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.png': 'image/png', '.pdf': 'application/pdf', '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml' };

function sendFile(req, res, file, extraHeaders = {}) {
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  const stat = fs.statSync(file), type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range;
  const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', ...extraHeaders };
  if (range) {
    const [a, b] = range.replace('bytes=', '').split('-');
    const s = Number(a) || 0, e = b ? Math.min(Number(b), stat.size - 1) : stat.size - 1;
    res.writeHead(206, { ...base, 'Content-Range': `bytes ${s}-${e}/${stat.size}`, 'Content-Length': e - s + 1 });
    return fs.createReadStream(file, { start: s, end: e }).pipe(res);
  }
  res.writeHead(200, { ...base, 'Content-Length': stat.size });
  fs.createReadStream(file).pipe(res);
}

// static files: the app, the renderer (preview), and passage data/outputs. Nothing else (never .env).
function serveStatic(req, res, pathname) {
  if (pathname === '/' || pathname === '/index.html') return sendFile(req, res, path.join(PUBLIC, 'index.html'));
  const roots = [['/app/', PUBLIC], ['/renderer/', rel('renderer')], ['/data/', rel('data')], ['/out/', rel('out')]];
  for (const [prefix, dir] of roots) {
    if (!pathname.startsWith(prefix)) continue;
    const f = path.normalize(path.join(dir, decodeURIComponent(pathname.slice(prefix.length))));
    if (!f.startsWith(dir + path.sep) || /\.env|\.mp3\.part$/.test(f)) break;
    return sendFile(req, res, f);
  }
  res.writeHead(404); res.end('not found');
}

const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const body = (req) => new Promise((resolve, reject) => {
  let b = ''; req.on('data', (d) => { b += d; if (b.length > 2e6) req.destroy(); });
  req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
});

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // after 'api'
  const m = req.method;
  if (parts[0] === 'catalog' && m === 'GET') {
    const env = readEnv();
    return json(res, 200, { ...CATALOG(), scenes: SCENES(), claude: { configured: !!env.ANTHROPIC_API_KEY, model: env.CLAUDE_MODEL || 'claude-opus-5-5' } });
  }
  if (parts[0] === 'settings' && m === 'POST') {
    const b = await body(req);
    if (typeof b.anthropic_api_key === 'string') {
      const k = b.anthropic_api_key.trim();
      if (k && !/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(k)) return json(res, 400, { error: 'That does not look like an Anthropic API key (it starts with sk-ant-).' });
      setEnv('ANTHROPIC_API_KEY', k);
    }
    if (typeof b.claude_model === 'string' && ['claude-opus-5-5', 'claude-sonnet-5-5'].includes(b.claude_model)) setEnv('CLAUDE_MODEL', b.claude_model);
    const env = readEnv();
    return json(res, 200, { claude: { configured: !!env.ANTHROPIC_API_KEY, model: env.CLAUDE_MODEL || 'claude-opus-5-5' } });
  }
  const allProjects = () => fs.readdirSync(rel('data')).filter(validId).map(load).filter(Boolean).map(summary);
  if (parts[0] === 'surahs' && m === 'GET') {
    const all = allProjects();
    if (parts.length === 1) {
      const by = {};
      for (const p of all) (by[p.chapter] ||= []).push(p);
      return json(res, 200, CATALOG().surahs.map((s) => ({ ...s, videos: (by[s.n] || []).length, ready: (by[s.n] || []).filter((p) => p.render === 'done').length,
        updated: (by[s.n] || []).map((p) => p.updated).sort().pop() || null, plan: fs.existsSync(rel('plans', `${s.n}.json`)) })));
    }
    const s = CATALOG().surahs.find((x) => x.n === +parts[1]);
    if (!s) return json(res, 404, { error: 'unknown surah' });
    if (parts[2] === 'render-approved') return json(res, 405, { error: 'use POST' });
    const videos = all.filter((p) => p.chapter === s.n).sort((a, b) => a.from - b.from || a.to - b.to || String(a.reciter_en).localeCompare(String(b.reciter_en)));
    return json(res, 200, { surah: s, videos, plan: readJSON(rel('plans', `${s.n}.json`)) });
  }
  if (parts[0] === 'surahs' && parts[2] === 'render-approved' && m === 'POST') {
    // queue every approved video of this surah that has no up-to-date MP4 yet
    const n = +parts[1];
    const ids = fs.readdirSync(rel('data')).filter(validId).map(load).filter((p) => p && p.chapter === n && p.review?.approved
      && !['running', 'queued', 'done'].includes(p.render?.state) && p.stage !== 'preparing');
    for (const p of ids) { p.render = { state: 'queued' }; save(p); renderQ.push(() => renderJob(p)); }
    return json(res, 200, { queued: ids.length });
  }
  if (parts[0] !== 'projects') return json(res, 404, { error: 'unknown endpoint' });

  if (parts.length === 1 && m === 'GET') {
    const list = allProjects();
    list.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
    return json(res, 200, list);
  }
  if (parts.length === 1 && m === 'POST') {
    const b = await body(req);
    const cat = CATALOG();
    const s = cat.surahs.find((x) => x.n === +b.chapter);
    const rec = cat.reciters.find((x) => x.id === +b.reciter);
    const from = +b.from, to = +b.to;
    if (!s || !rec || !(from >= 1 && to >= from && to <= s.verses)) return json(res, 400, { error: 'Please choose a surah, a valid verse range and a reciter.' });
    if (to - from + 1 > 40) return json(res, 400, { error: 'Please choose at most 40 verses per video.' });
    const env = readEnv();
    const director = b.director === 'claude' && env.ANTHROPIC_API_KEY ? 'claude' : 'auto';
    const id = projectId(s.n, from, to, rec.id);
    const existing = load(id);
    if (existing && !b.replace) return json(res, 409, { error: 'exists', id });
    if (existing && (existing.stage === 'preparing' || existing.render?.state === 'running')) return json(res, 409, { error: 'This video is being processed right now.', id });
    if (existing?.handmade) return json(res, 409, { error: 'This passage is a hand-made production and cannot be regenerated here.', id });
    const p = { id, chapter: s.n, from, to, reciter: rec.id, style: b.style === 'calm' ? 'calm' : 'story', director, created: now(),
      stage: 'preparing', steps: newSteps(director), error: null, review: emptyReview(), render: { state: 'idle' } };
    projects.set(id, p); save(p);
    prepQ.push(() => prepareJob(p));
    return json(res, 200, { id });
  }
  const id = parts[1];
  if (!validId(id)) return json(res, 404, { error: 'unknown project' });
  const p = load(id);
  if (!p) return json(res, 404, { error: 'unknown project' });
  const action = parts[2];
  if (!action && m === 'GET') return json(res, 200, projectDetail(p));
  if (!action && m === 'DELETE') {
    if (p.handmade) return json(res, 400, { error: 'Hand-made productions cannot be deleted from the app.' });
    if (p.stage === 'preparing' || p.render?.state === 'running' || p.render?.state === 'queued') return json(res, 409, { error: 'Wait until processing has finished.' });
    deleteProject(p); return json(res, 200, { ok: true });
  }
  if (action === 'retry' && m === 'POST') {
    const b = await body(req);
    if (p.stage === 'preparing') return json(res, 409, { error: 'Already preparing.' });
    if (p.handmade) return json(res, 400, { error: 'Hand-made productions are prepared from the command line.' });
    if (b.simple) { p.director = 'auto'; p.steps = newSteps('auto'); }
    if (b.claude && readEnv().ANTHROPIC_API_KEY) { p.director = 'claude'; p.steps = newSteps('claude'); }
    const from = b.from || (fs.existsSync(rel('data', id, 'source.json')) ? (b.simple || b.claude ? 'direct' : 'direct') : 'fetch');
    p.stage = 'preparing'; p.error = null; save(p);
    prepQ.push(() => prepareJob(p, { from: fs.existsSync(rel('data', id, 'source.json')) ? from : 'fetch' }));
    return json(res, 200, { ok: true });
  }
  if (action === 'source' && m === 'GET') return json(res, 200, editorSource(p));
  if (action === 'report' && m === 'GET') return sendFile(req, res, rel('data', id, 'verify_report.md'));
  if (action === 'storyboard' && m === 'PUT') {
    if (p.stage === 'preparing') return json(res, 409, { error: 'Wait until preparation has finished.' });
    const sb = readJSON(rel('storyboard', `${id}.json`));
    const next = applyEdits(sb, await body(req));
    const chk = await dryVerify(id, next);
    if (!chk.passed) return json(res, 422, { error: 'Some changes did not pass the checks; nothing was saved.', fails: chk.fails });
    writeJSON(rel('storyboard', `${id}.json`), next);
    p.stage = 'preparing'; p.steps = p.steps.map((s) => ({ ...s, state: ['fetch', 'direct'].includes(s.key) ? 'done' : 'pending' })); save(p);
    prepQ.push(() => prepareJob(p, { from: 'verify' }));
    return json(res, 200, { ok: true });
  }
  if (action === 'review' && m === 'POST') {
    const b = await body(req);
    const rd = readJSON(rel('data', id, 'render_data.json'));
    if (!rd) return json(res, 409, { error: 'Not prepared yet.' });
    p.review = { ...emptyReview(), ...p.review, verses: b.verses || {}, timing: b.timing || {}, titles: !!b.titles, reviewer: String(b.reviewer || '').slice(0, 80) };
    if (b.approve) {
      const missing = rd.verses.filter((v) => !p.review.verses[v.n]).map((v) => v.key);
      const timing = (rd.timing_corrections || []).filter((c, i) => p.review.timing[i] !== 'ok');
      if (missing.length || timing.length || !p.review.titles || !p.review.reviewer.trim())
        return json(res, 400, { error: 'Check every verse, the titles and scenes, confirm any flagged timing by ear, and enter the reviewer name before approving.' });
      p.review.approved = true; p.review.approved_at = now();
    } else { p.review.approved = false; p.review.approved_at = null; }
    save(p); return json(res, 200, { review: p.review });
  }
  if (action === 'render' && m === 'POST') {
    if (!p.review?.approved) return json(res, 400, { error: 'Approve the review before exporting.' });
    if (p.render?.state === 'running' || p.render?.state === 'queued') return json(res, 409, { error: 'Already rendering.' });
    p.render = { state: 'queued' }; save(p);
    renderQ.push(() => renderJob(p));
    return json(res, 200, { ok: true });
  }
  if (action === 'open-folder' && m === 'POST') {
    const dir = rel('out', id);
    const target = fs.existsSync(dir) ? dir : rel('out');
    if (process.platform === 'win32') spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' }).unref();
    else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [target], { detached: true, stdio: 'ignore' }).unref();
    return json(res, 200, { ok: true });
  }
  if (action === 'download' && m === 'GET') {
    const f = p.render?.file && rel(p.render.file);
    if (!f || !fs.existsSync(f)) return json(res, 404, { error: 'No video yet.' });
    return sendFile(req, res, f, { 'Content-Disposition': `attachment; filename="${path.basename(f)}"` });
  }
  return json(res, 404, { error: 'unknown action' });
}

// ------------------------------------------------------------------ boot
function boot() {
  fs.mkdirSync(rel('data'), { recursive: true });
  if (!fs.existsSync(rel('data', 'catalog.json'))) {
    console.log('building the surah/reciter catalog (first start)...');
    const r = spawnSync(PY, [...PYARGS, 'pipeline/catalog.py'], { cwd: ROOT, stdio: 'inherit' });
    if (r.status) { console.error('Could not build the catalog. Check the internet connection and start again.'); process.exit(1); }
  }
  adoptExisting();
  // anything interrupted by a previous shutdown can simply be retried
  for (const id of fs.readdirSync(rel('data')).filter(validId)) {
    const p = load(id);
    if (!p) continue;
    if (p.stage === 'preparing') fail(p, 'Preparation was interrupted', 'The app was closed while preparing. Click "Try again".');
    if (p.render?.state === 'running' || p.render?.state === 'queued') { p.render = { state: 'error', error: 'The app was closed while rendering. Click "Render" again.' }; save(p); }
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
      return serveStatic(req, res, url.pathname);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) json(res, 500, { error: String(e.message || e) });
    }
  });
  const u = `http://localhost:${PORT}/`;
  const openBrowser = () => {
    if (!process.argv.includes('--open')) return;
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', u], { detached: true, stdio: 'ignore' }).unref();
    else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [u], { detached: true, stdio: 'ignore' }).unref();
  };
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {   // already running (e.g. double-clicked twice): just open it
      console.log(`\n  Quran Video Studio is already running: ${u}\n`);
      openBrowser(); setTimeout(() => process.exit(0), 1500);
    } else { console.error(e); process.exit(1); }
  });
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n  Quran Video Studio is running:  ${u}\n  (keep this window open; close it to stop the app)\n`);
    openBrowser();
  });
}
boot();
