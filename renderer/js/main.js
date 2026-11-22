// Orchestrator: renderAt(t) draws one complete 1080x1920 frame as a pure function of t.
// Quranic text is only ever taken from render_data.json (API words); this file never contains any.
import { TAU, clamp, lerp, prog, ease, keys, env, hash, mixHex, rgba } from './util.js';
import { scenes as SC_HIJR, SW, SH } from './scenes.js';
import { scenes as SC_MUSA } from './scenes_musa.js';
import { scenes as SC_LIB } from './scenes_lib.js';
const scenes = { ...SC_HIJR, ...SC_MUSA, ...SC_LIB };
import * as A from './art.js';
import { drawMotifs, motifAnchor } from './motifs.js';

const W = 1080, H = 1920;
const FRAME = { x: 60, y: 222, w: SW, h: SH, r: 150, bulge: 12 };
const CARD_TOP = 1200, QF = 58, QLH = 104, PAD_TOP = 60, PAD_BOT = 30, PAD_X = 72, CARD_MIN_W = 440;
const BOX_BOTTOM = 1128;
const NAVY = '#1f2b4f', NAVY2 = '#16203f', GOLD = '#d4a955', GOLD_HI = '#f4c75e', CREAM = '#f8f1e2', INK = '#2a2c38';
const TONE = { red: '#c9473f', green: '#3d9a68', blue: '#3a7cc8', amber: '#d6962a' };
// English falls back to Scheherazade New for symbols Montserrat lacks (e.g. ﷺ in Saheeh International); verify.py checks coverage
const QFONT = '"Scheherazade New"', UIF = '"Tajawal"', TITLEF = '"Lalezar"', ENF = '"Montserrat", "Scheherazade New"';

let D, cv, ctx, sA, sAx, sB, sBx, noise;
let VL = [], cardEvents = [], chT = [], vByN = new Map();

const R = (window.R = { ready: false, fontsOk: {}, init, renderAt, get duration() { return D?.duration; }, get pages() { return VL.length; } });

async function init(data) {
  D = data;
  cv = document.getElementById('c'); ctx = cv.getContext('2d');
  sA = new OffscreenCanvas(SW, SH); sAx = sA.getContext('2d');
  sB = new OffscreenCanvas(SW, SH); sBx = sB.getContext('2d');
  const specs = [[`${QF}px ${QFONT}`, 'قَالَ'], [`500 30px ${UIF}`, 'ا'], [`700 30px ${UIF}`, 'ا'], [`800 30px ${UIF}`, 'ا'],
    [`40px ${TITLEF}`, 'ا'], [`500 30px ${ENF}`, 'A'], [`600 30px ${ENF}`, 'A']];
  await Promise.all(specs.map(([f, s]) => document.fonts.load(f, s)));
  for (const [f] of specs) R.fontsOk[f] = document.fonts.check(f);
  for (const v of D.verses) vByN.set(v.n, v);
  buildNoise();
  layoutVerses();
  layoutTranslations();
  layoutGlosses();
  chT = D.chapters.map(makeT);
  R.ready = true;
}

// Sacred words (the Name, «رب», al-Rahman, a prophet, Maryam, «رسول»/«نبي»): the ambient backgrounds never pulse on
// them, so no light or pattern brightens as the Name or a prophet is recited (An-Nisa picture review, 2026-11-22).
// Also His acts that light could seem to depict: «تجلى» (7:143), «استوى» (on the Throne), «وجهه» (Al-A'raf review).
const PROPHETS = 'محمد|احمد|موسي|عيسي|مريم|ابراهيم|ابرهيم|اسماعيل|اسمعيل|اسحاق|اسحق|يعقوب|يوسف|نوح|لوط|هارون|هرون|داود|داوود|سليمان|سليمن|زكريا|يحيي|ادم|ايوب|يونس|ادريس|شعيب|صالح|صلح|هود|الياس|اليسع|عزير';
const SACRED_RE = new RegExp(`الله|لله|الاه|الرحمن|^(و|ف|ب|ل|يا)*رب(ي|ك|كم|كما|نا|ه|هم|هما|هن|كن)?$|^(و|ف|ب|ل|يا)*(ال)?(نبي|رسول|رسل)(ه|ك|نا|هم|كم)?$|^(و|ف|ب|ل|يا|ي)*(${PROPHETS})ا?$|^(و|ف|ب|ل)*(ال)?امي$|^(و|ف|ب|ل|يا)*(ال)?مسيح$|^(و|ف)*(تجلي|استوي)$|^(و|ف|ب|ل)*وجهه$`);
function skel(t) {
  return String(t).normalize('NFC').replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ءا/g, 'ا').replace(/[^\u0621-\u064A]/g, '');
}
function isSacred(t) { const k = skel(t); return !!k && SACRED_RE.test(k); }

function makeT(c) {
  const seg = (n, p) => vByN.get(n)?.segments.find((s) => s[0] === p);
  const words = [];
  // params.quiet: word ranges where the background never pulses (e.g. «فلما تجلى ربه للجبل», Allah speaking to Musa)
  const Q = (Array.isArray(c.params?.quiet) ? c.params.quiet : []).filter((q) => Array.isArray(q) && q.length === 2);
  const key = (r) => (Array.isArray(r) ? r[0] * 1000 + r[1] : NaN);
  const quiet = (n, p) => Q.some((q) => key([n, p]) >= key(q[0]) && key([n, p]) <= key(q[1]));
  for (const n of c.verses) {
    const v = vByN.get(n); if (!v) continue;
    const last = v.words.length;
    // pause = the reciter stops after this word (waqf sign or end of verse): a natural moment for a camera move
    for (const s of v.segments) words.push({ n, p: s[0], s: s[1], e: s[2], pause: s[0] === last || WAQF.test(v.words[s[0] - 1]?.text || ''),
      sacred: isSacred(v.words[s[0] - 1]?.text || '') || quiet(n, s[0]) });
  }
  words.sort((a, b) => a.s - b.s);
  return {
    c, start: c.start, end: c.end, words,
    v: (n) => vByN.get(n)?.start ?? NaN, ve: (n) => vByN.get(n)?.end ?? NaN,
    w: (n, p) => seg(n, p)?.[1] ?? NaN, we: (n, p) => seg(n, p)?.[2] ?? NaN,
    at: (a) => (Array.isArray(a) && seg(a[0], a[1]) ? seg(a[0], a[1])[1] : c.start),
  };
}

function buildNoise() {
  noise = new OffscreenCanvas(540, 960);
  const nx = noise.getContext('2d'), img = nx.createImageData(540, 960);
  for (let i = 0; i < 540 * 960; i++) {
    const v = hash(i * 2 + 17) * 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  nx.putImageData(img, 0, 0);
}

// ---------------- layout (once) ----------------
function balance(widths, space, maxW) {
  const n = widths.length;
  const lineW = (a, b) => widths.slice(a, b).reduce((s, x) => s + x, 0) + space * (b - a - 1);
  const total = lineW(0, n);
  for (let L = Math.max(1, Math.ceil(total / maxW)); L <= 6; L++) {
    // minimise the widest line with exactly L lines
    const memo = new Map();
    const best = (i, l) => {
      if (l === 1) return { m: lineW(i, n), cuts: [] };
      const key = i + ',' + l;
      if (memo.has(key)) return memo.get(key);
      let res = { m: Infinity, cuts: [] };
      for (let j = i + 1; j <= n - l + 1; j++) {
        const r = best(j, l - 1), m = Math.max(lineW(i, j), r.m);
        if (m < res.m) res = { m, cuts: [j, ...r.cuts] };
      }
      memo.set(key, res);
      return res;
    };
    if (L > n) break;
    const r = best(0, L);
    if (r.m <= maxW || L === Math.min(6, n)) {
      const bounds = [0, ...r.cuts, n];
      return bounds.slice(0, -1).map((a, k) => ({ idx: [...Array(bounds[k + 1] - a).keys()].map((q) => q + a), w: lineW(a, bounds[k + 1]) }));
    }
  }
  return [{ idx: widths.map((_, i) => i), w: total }];
}

// A verse longer than MAXL lines is shown as several pages ("blocks"); each block behaves like a verse
// on the card. Page breaks prefer a word carrying a waqf sign, so the page turns while the reciter pauses.
const MAXL = 3, LINE_W = 820, WAQF = /[ۖ-ۜ]/;
function greedy(widths, space, maxW) {
  const out = [[]]; let cw = 0;
  widths.forEach((w, i) => {
    if (cw > 0 && cw + space + w > maxW) { out.push([]); cw = 0; }
    out[out.length - 1].push(i); cw += (cw > 0 ? space : 0) + w;
  });
  return out;
}
function firstStart(v, fromPos) {
  const s = v.segments.filter((x) => x[0] >= fromPos).map((x) => x[1]);
  return s.length ? Math.min(...s) : v.end;
}
function pageCuts(v, widths, space) {
  const G = greedy(widths, space, LINE_W);
  if (G.length <= MAXL) return [];
  const P = Math.ceil(G.length / MAXL), per = G.length / P, n = widths.length;
  const ideal = [...Array(P - 1).keys()].map((k) => G[Math.round((k + 1) * per)][0]);
  const fits = (cuts) => {
    const b = [0, ...cuts, n];
    for (let k = 0; k + 1 < b.length; k++) {
      if (b[k + 1] <= b[k] || greedy(widths.slice(b[k], b[k + 1]), space, LINE_W).length > MAXL) return false;
    }
    return true;
  };
  const pref = ideal.map((c, k) => {
    const lo = k ? ideal[k - 1] + 2 : 2;
    for (let d = 0; d <= 4; d++) for (const x of [c - d, c + d]) if (x >= lo && x < n - 1 && WAQF.test(v.words[x - 1].text)) return x;
    return c;
  });
  return fits(pref) ? pref : ideal;
}
function splitTranslation(text, fracs) {
  const words = text.split(' '), n = words.length, cuts = [];
  // cut after punctuation near the proportional point; sentence ends are strongly preferred over commas
  for (const f of fracs) {
    const c = Math.round(n * f), lo = (cuts.at(-1) ?? 0) + 1;
    let best = c, score = Infinity;
    for (let x = Math.max(lo, c - 10); x <= Math.min(n - 1, c + 10); x++) {
      const w = words[x - 1];
      const s = /[.!?]["”’)\]]?$/.test(w) ? 0 : /[;:]["”’)\]]?$/.test(w) ? 2 : /,["”’)\]]?$/.test(w) ? 4 : Infinity;
      if (Math.abs(x - c) + s < score) { score = Math.abs(x - c) + s; best = x; }
    }
    cuts.push(Math.max(best, lo));
  }
  return [0, ...cuts, n].slice(0, -1).map((a, k, arr) => words.slice(a, k + 1 < arr.length ? arr[k + 1] : n).join(' '));
}
function layoutVerses() {
  ctx.font = `${QF}px ${QFONT}`;
  const space = Math.max(ctx.measureText(' ').width, 16);
  VL = [];
  for (const v of D.verses) {
    const widths = v.words.map((w) => ctx.measureText(w.text).width);
    const cuts = pageCuts(v, widths, space);
    const bounds = [0, ...cuts, v.words.length];
    const trParts = cuts.length ? splitTranslation(v.translation, cuts.map((c) => c / v.words.length)) : [v.translation];
    const blocks = bounds.slice(0, -1).map((a, k) => {
      const b = bounds[k + 1];
      const lines = cuts.length ? balance(widths.slice(a, b), space, LINE_W).map((ln) => ({ ...ln, idx: ln.idx.map((i) => i + a) }))
        : balance(widths, space, v.words.length <= 7 ? 600 : LINE_W);
      return { v, widths, space, lines, page: k, pages: bounds.length - 1, a, b, tr: trParts[k] };
    });
    blocks.forEach((B, k) => {
      B.start = k === 0 ? v.start : firstStart(v, v.words[B.a].pos);
      B.lines.forEach((ln, j) => { ln.time = j === 0 ? B.start : firstStart(v, v.words[ln.idx[0]].pos); });
    });
    blocks.forEach((B, k) => {
      B.end = k + 1 < blocks.length ? blocks[k + 1].start : v.end;
      B.first_word = k === 0 ? v.first_word : B.start;
      B.last_word = k + 1 < blocks.length ? B.end : v.last_word;
    });
    VL.push(...blocks);
  }
  cardEvents = [];
  for (const L of VL) {
    L.lines.forEach((ln, k) => {
      const w = Math.max(CARD_MIN_W, Math.max(...L.lines.slice(0, k + 1).map((x) => x.w)) + PAD_X * 2);
      cardEvents.push({ time: k === 0 ? ln.time - 0.06 : ln.time, w, h: PAD_TOP + (k + 1) * QLH + PAD_BOT });
    });
  }
  cardEvents.sort((a, b) => a.time - b.time);
}

function layoutTranslations() {
  for (const L of VL) {
    const words = L.tr.toUpperCase().split(' ');
    let fs = 32, lines;
    for (; fs >= 22; fs -= 2) {
      ctx.font = `500 ${fs}px ${ENF}`; ctx.letterSpacing = '1.5px';
      const sp = ctx.measureText(' ').width;
      lines = [[]]; let cw = 0;
      for (const w of words) {
        const ww = ctx.measureText(w).width;
        if (cw > 0 && cw + sp + ww > 900) { lines.push([]); cw = 0; }
        lines[lines.length - 1].push({ text: w, w: ww }); cw += (cw > 0 ? sp : 0) + ww;
      }
      L.trSpace = sp;
      if (lines.length <= 4) break;
    }
    if (fs < 22) fs = 22;   // a very long page keeps 22 px and may use a 5th line
    ctx.letterSpacing = '0px';
    L.trFs = fs; L.trLines = lines; L.trN = words.length;
  }
}

function wrapAr(text, font, maxW) {
  ctx.font = font;
  if (ctx.measureText(text).width <= maxW) return [text];
  const words = text.split(' ');
  // two balanced lines (no one-word widows) when possible
  let best = null;
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(' '), b = words.slice(k).join(' ');
    const m = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
    if (m <= maxW && (!best || m < best.m)) best = { m, lines: [a, b] };
  }
  if (best) return best.lines;
  const lines = [''];
  for (const w of words) {
    const cand = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w;
    if (ctx.measureText(cand).width > maxW && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = cand;
  }
  return lines;
}

function layoutGlosses() {
  for (const v of D.verses) {
    for (const g of v.glosses) {
      g.lines = wrapAr(g.excerpt, `700 30px ${UIF}`, 520);
      ctx.font = `700 30px ${UIF}`;
      g.bw = Math.max(...g.lines.map((l) => ctx.measureText(l).width)) + 64;
      g.bh = g.lines.length * 42 + 30;
      ctx.font = `38px ${QFONT}`;
      g.cfs = 38;
      g.cw = ctx.measureText(g.chip).width + 48; g.ch = 62;
      // a long chip must stay inside the frame: shrink its Quran font (never below 26 px) so it fits W - 80
      const CHIP_MAX = W - 80;
      if (g.cw > CHIP_MAX) {
        g.cfs = Math.max(26, Math.floor(38 * (CHIP_MAX - 48) / (g.cw - 48)));
        ctx.font = `${g.cfs}px ${QFONT}`;
        g.cw = ctx.measureText(g.chip).width + 48;
      }
    }
  }
}

// ---------------- timeline queries ----------------
function chapterAt(t) {
  let i = 0;
  while (i + 1 < D.chapters.length && t >= D.chapters[i + 1].start) i++;
  return i;
}
function cardDims(t) {
  let i = -1;
  while (i + 1 < cardEvents.length && cardEvents[i + 1].time <= t) i++;
  if (i < 0) return { w: cardEvents[0].w, h: cardEvents[0].h };
  const ev = cardEvents[i], pv = cardEvents[Math.max(0, i - 1)];
  const p = ease.outCubic(prog(t, ev.time, ev.time + 0.35));
  return { w: lerp(pv.w, ev.w, p), h: lerp(pv.h, ev.h, p) };
}
function wordState(v, t) {
  // segments are time-ordered; a reciter repetition simply re-activates an earlier word
  let maxR = 0, active = -1, aStart = 0, last = null;
  const lastEnd = new Map();
  for (const s of v.segments) {
    if (s[1] > t) break;
    maxR = Math.max(maxR, s[0]);
    if (last) lastEnd.set(last[0], last[2]);
    last = s;
  }
  if (last) {
    if (t < last[2] + 0.1) { active = last[0]; aStart = last[1]; } else lastEnd.set(last[0], last[2]);
  }
  return { maxR, active, aStart, lastEnd };
}

// ---------------- drawing ----------------
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }

function squircle(c, x, y, w, h, r, b) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.quadraticCurveTo(x + w / 2, y - b, x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.quadraticCurveTo(x + w + b, y + h / 2, x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.quadraticCurveTo(x + w / 2, y + h + b, x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.quadraticCurveTo(x - b, y + h / 2, x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}
const framePath = (c) => squircle(c, FRAME.x, FRAME.y, FRAME.w, FRAME.h, FRAME.r, FRAME.bulge);

function bgColor(t) {
  const i = chapterAt(t), c = D.chapters[i];
  if (i === 0) return c.bg;
  return mixHex(D.chapters[i - 1].bg, c.bg, ease.inOutSine(prog(t, c.start - 0.3, c.start + 0.5)));
}

function drawBackground(t) {
  ctx.fillStyle = bgColor(t);
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.045; ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(noise, 0, 0, W, H);
  ctx.restore();
  const g = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.45, H * 0.8);
  g.addColorStop(0, 'rgba(60,40,20,0)'); g.addColorStop(1, 'rgba(60,40,20,0.10)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

const coverDur = () => D.cover?.dur || 0;

// ---- cover: the first frame is a designed thumbnail (series, title, surah + verses, reciter over a frozen scene) ----
function drawCover(t) {
  const cd = coverDur();
  if (!cd) return;
  const a = 1 - ease.inOutSine(prog(t, cd - 0.05, cd + 0.45));
  if (a <= 0.01) return;
  const C = D.cover, s = D.surah;
  const drop = (1 - a) * 40;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  // big title: the largest size (<= 2 balanced lines) that fits; then centre the whole block under the picture
  let fs = 124, lines;
  for (; fs >= 72; fs -= 4) {
    lines = wrapAr(C.title_ar, `${fs}px ${TITLEF}`, 960);
    ctx.font = `${fs}px ${TITLEF}`;
    if (lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= 960)) break;
  }
  const en = C.title_en ? wrapLines(C.title_en, `500 34px ${ENF}`, 920) : [];
  const blockH = (C.series_en ? 44 : 0) + fs * 1.1 * lines.length + (en.length ? 30 + en.length * 46 : 0) + 56 + 70 + 62;
  let y = 1150 + Math.max(0, (1800 - 1150 - blockH) / 2) + drop;
  if (C.series_en) {
    y += 26;
    ctx.direction = 'ltr'; ctx.font = `600 27px ${ENF}`; ctx.letterSpacing = '6px'; ctx.fillStyle = '#8d8778';
    ctx.fillText(C.series_en.toUpperCase(), W / 2, y); ctx.letterSpacing = '0px';
    y += 18;
  }
  ctx.direction = 'rtl'; ctx.fillStyle = NAVY; ctx.font = `${fs}px ${TITLEF}`;
  for (const ln of lines) { y += fs * 1.1; ctx.fillText(ln, W / 2, y - fs * 0.12); }
  if (en.length) {
    y += 30; ctx.direction = 'ltr'; ctx.font = `500 34px ${ENF}`; ctx.fillStyle = '#464a58';
    for (const ln of en) { y += 46; ctx.fillText(ln, W / 2, y - 8); }
  }
  // ornament
  y += 56;
  ctx.strokeStyle = rgba(GOLD, 0.9); ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(W / 2 - 170, y); ctx.lineTo(W / 2 - 26, y); ctx.moveTo(W / 2 + 26, y); ctx.lineTo(W / 2 + 170, y); ctx.stroke();
  ctx.save(); ctx.translate(W / 2, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = GOLD; ctx.fillRect(-9, -9, 18, 18); ctx.restore();
  y += 70;
  ctx.direction = 'rtl'; ctx.font = `800 42px ${UIF}`; ctx.fillStyle = '#a5762a';
  ctx.fillText(`سورة ${s.name_ar} · ${s.from === s.to ? `الآية ${s.from_ar}` : `الآيات ${s.from_ar} – ${s.to_ar}`}`, W / 2, y);
  y += 62;
  ctx.font = `700 36px ${UIF}`; ctx.fillStyle = INK;
  ctx.fillText(`بصوت القارئ ${D.credits.reciter_ar}`, W / 2, y);
  ctx.restore();
}
function wrapLines(text, font, maxW) {
  ctx.font = font;
  const out = [''];
  for (const w of text.split(' ')) {
    const cand = out[out.length - 1] ? out[out.length - 1] + ' ' + w : w;
    if (ctx.measureText(cand).width > maxW && out[out.length - 1]) out.push(w); else out[out.length - 1] = cand;
  }
  return out;
}

function drawLogo(t, a) {
  if (a <= 0.01) return;
  ctx.save(); ctx.globalAlpha = a;
  A.octagram(ctx, W / 2, 84, 30, '#b8433c', 1, t * 0.15, 0.08, 4);
  ctx.fillStyle = '#b8433c'; ctx.beginPath(); ctx.arc(W / 2, 84, 7, 0, TAU); ctx.fill();
  ctx.restore();
}

function titleW(title) { ctx.font = `40px ${TITLEF}`; return ctx.measureText(title).width + 72; }

function drawTitle(t, uiA) {
  const i = chapterAt(t), c = D.chapters[i];
  const cd = coverDur();
  const pin = i === 0 ? (cd ? 1 : ease.outBack(prog(t, 0.15, 0.6))) : 1;
  // with a cover, the pill first shows the series name, then morphs into the first chapter title
  const sw = cd ? ease.outCubic(prog(t, cd - 0.1, cd + 0.4)) : 1;
  const wNow = i === 0 ? (cd ? lerp(titleW(D.cover.series_ar), titleW(c.title), sw) : titleW(c.title))
    : lerp(titleW(D.chapters[i - 1].title), titleW(c.title), ease.outCubic(prog(t, c.start - 0.2, c.start + 0.3)));
  const y = 166, h = 66;
  ctx.save();
  ctx.globalAlpha = uiA;
  ctx.strokeStyle = rgba(NAVY, 0.75); ctx.fillStyle = rgba(NAVY, 0.75); ctx.lineWidth = 2.5;
  const lx = W / 2 - (wNow * pin) / 2 - 20, rx = W / 2 + (wNow * pin) / 2 + 20;
  const lineA = cd ? 1 : ease.outCubic(prog(t, 0.3, 0.9));
  ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lerp(lx, 46, lineA), y); ctx.moveTo(rx, y); ctx.lineTo(lerp(rx, W - 46, lineA), y); ctx.stroke();
  if (lineA > 0.95) { ctx.beginPath(); ctx.arc(46, y, 5.5, 0, TAU); ctx.arc(W - 46, y, 5.5, 0, TAU); ctx.fill(); }
  ctx.translate(W / 2, y); ctx.scale(pin, pin);
  ctx.shadowColor = 'rgba(20,24,45,0.3)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
  ctx.fillStyle = NAVY; rr(ctx, -wNow / 2, -h / 2, wNow, h, h / 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  rr(ctx, -wNow / 2, -h / 2, wNow, h, h / 2); ctx.clip();
  ctx.font = `40px ${TITLEF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
  const pairs = i === 0 && cd ? [[-1, D.cover.series_ar], [0, c.title]] : [[i - 1, D.chapters[i - 1]?.title], [i, c.title]];
  for (const [k, ttl] of pairs) {
    if (!ttl) continue;
    const a = i === 0 && cd ? (k === 0 ? sw : 1 - sw)
      : k === i ? (i === 0 ? 1 : ease.outCubic(prog(t, c.start - 0.1, c.start + 0.35))) : 1 - prog(t, c.start - 0.3, c.start + 0.05);
    if (a <= 0.01) continue;
    ctx.fillStyle = CREAM;
    if (k === i) kineticTitle(ttl, a, uiA);   // UI text only: words arrive one by one, right to left
    else { ctx.globalAlpha = uiA * a; ctx.fillText(ttl, 0, 4 - (1 - a) * 14); }
  }
  // a light sweep crosses the pill once the new title has landed
  const t0 = i === 0 ? (cd || 0) + 0.25 : c.start + 0.3, sp = prog(t, t0, t0 + 0.8);
  if (sp > 0 && sp < 1) {
    ctx.globalAlpha = uiA * Math.sin(sp * Math.PI) * 0.55;
    const x = lerp(wNow / 2 + 60, -wNow / 2 - 60, ease.inOutSine(sp));
    const g = ctx.createLinearGradient(x - 50, 0, x + 50, 0);
    g.addColorStop(0, 'rgba(255,236,190,0)'); g.addColorStop(0.5, 'rgba(255,236,190,0.9)'); g.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 50, -h / 2, 100, h);
  }
  ctx.restore();
}
function kineticTitle(ttl, a, uiA) {
  const words = ttl.split(' ');
  if (words.length < 2 || a >= 0.999) { ctx.globalAlpha = uiA * a; ctx.fillText(ttl, 0, 4 + (1 - a) * 14); return; }
  const sp = ctx.measureText(' ').width, ws = words.map((w) => ctx.measureText(w).width);
  const tw = ws.reduce((x, y) => x + y, 0) + sp * (words.length - 1);
  const align = ctx.textAlign;
  ctx.textAlign = 'right';
  let x = tw / 2;
  const n = words.length, span = 0.45;
  words.forEach((w, j) => {
    const aj = ease.outCubic(clamp((a * (1 + span) - (j / Math.max(1, n - 1)) * span)));
    if (aj > 0.01) {
      ctx.save(); ctx.globalAlpha = uiA * aj;
      ctx.translate(x - ws[j] / 2, 4 + (1 - aj) * 18); ctx.scale(0.85 + 0.15 * aj, 0.85 + 0.15 * aj);
      ctx.fillText(w, ws[j] / 2, 0); ctx.restore();
    }
    x -= ws[j] + sp;
  });
  ctx.textAlign = align;
}

function renderScene(sx, idx, t, settle = false) {
  const c = D.chapters[idx];
  sx.save();
  sx.setTransform(1, 0, 0, 1, 0, 0);
  sx.clearRect(0, 0, SW, SH);
  scenes[c.scene].draw(sx, t, chT[idx]);
  sx.restore();
  // motion graphics v3: a living light layer over every scene, then the chapter's motifs
  sx.save(); sx.setTransform(1, 0, 0, 1, 0, 0);
  lifeLayer(sx, t, idx);
  // no plate while people pray (a plate over a praying group reads as the object of worship)
  const pk = scenes[c.scene].praying ? scenes[c.scene].praying(t, chT[idx]) : 0;
  if (pk < 0.99) { sx.globalAlpha = 1 - pk; drawMotifs(sx, t, chT[idx], c.params, settle); }
  sx.restore();
}

// deterministic drifting motes and a slow light sweep, so no 2-second window of any scene is ever still
function lifeLayer(sx, t, idx) {
  const seed = 97 + idx * 13;
  for (let j = 0; j < 16; j++) {
    const sp = 10 + hash(seed + j * 7) * 18, ph = (t * sp + hash(seed + j * 11) * 900) % 900;
    const x = (hash(seed + j * 3) * 1100 - 70) + Math.sin(t * 0.7 + j) * 22, y = 860 - ph;
    const a = Math.sin((ph / 900) * Math.PI) * (0.22 + 0.25 * hash(seed + j * 5));
    if (a < 0.02) continue;
    const r = 2.5 + 4 * hash(seed + j * 17);
    const g = sx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, `rgba(255,246,214,${a})`); g.addColorStop(1, 'rgba(255,246,214,0)');
    sx.fillStyle = g; sx.beginPath(); sx.arc(x, y, r * 3, 0, TAU); sx.fill();
  }
  // a soft diagonal sheen crosses the picture every 9 s
  const ph = ((t + idx * 3.1) % 9) / 9;
  if (ph < 0.3) {
    const u = ph / 0.3, x = lerp(-400, 1360, ease.inOutSine(u));
    sx.save();
    sx.globalCompositeOperation = 'screen';
    const g = sx.createLinearGradient(x - 160, 0, x + 160, 0);
    const a = 0.10 * Math.sin(u * Math.PI);
    g.addColorStop(0, 'rgba(255,248,225,0)'); g.addColorStop(0.5, `rgba(255,248,225,${a})`); g.addColorStop(1, 'rgba(255,248,225,0)');
    sx.setTransform(1, 0, -0.35, 1, 150, 0);
    sx.fillStyle = g; sx.fillRect(x - 160, 0, 320, SH);
    sx.restore();
  }
}

// designed chapter transitions (params.transition of the chapter that begins): dissolve (default), wipe, iris,
// light_sweep, slide, page_turn, morph. Arabic reads right to left, so "forward" moves leftward.
const TRANS = new Set(['dissolve', 'wipe', 'iris', 'light_sweep', 'slide', 'page_turn', 'morph']);
// a light_sweep is a band of light: it never crosses the frame while the Name, «رب» or a prophet is recited
// (Al-A'raf review: the band landed on «ولله»); there it becomes a dissolve.
const sacredNear = (i) => { const cs = D.chapters[i]?.start ?? 0; return [chT[i - 1], chT[i]].some((T) => T && T.words.some((w) => w.sacred && w.e > cs - 0.7 && w.s < cs + 0.9)); };
const transOf = (i) => { const x = D.chapters[i]?.params?.transition; const k = TRANS.has(x) ? x : 'dissolve'; return k === 'light_sweep' && sacredNear(i) ? 'dissolve' : k; };
const halfOf = (i) => (transOf(i) === 'dissolve' ? 0.35 : 0.5);

function drawFrame(t) {
  const cd = coverDur();
  // with a cover the frame is already in place on the very first frame (it is the thumbnail)
  const pin = cd ? 1 : ease.outBack(prog(t, 0, 0.6)), fa = cd ? 1 : ease.outCubic(prog(t, 0, 0.35));
  const i = chapterAt(t);
  let from = i, to = i, mix = 0, tA = t, kind = 'dissolve';
  const cs = D.chapters[i].start;
  const nx = D.chapters[i + 1];
  if (cd && t < cd + 0.6) {
    // cover picture = the scene frozen at the chosen moment, dissolving into the live opening scene
    from = chapterAt(D.cover.t); tA = D.cover.t; to = i; mix = ease.inOutSine(prog(t, cd, cd + 0.6));
    if (mix <= 0) to = from;
  } else if (i > 0 && t < cs + halfOf(i)) { from = i - 1; to = i; kind = transOf(i); mix = prog(t, cs - halfOf(i), cs + halfOf(i)); }
  else if (nx && t > nx.start - halfOf(i + 1)) { from = i; to = i + 1; kind = transOf(i + 1); mix = prog(t, nx.start - halfOf(i + 1), nx.start + halfOf(i + 1)); }
  if (kind === 'dissolve') mix = ease.inOutSine(mix);
  renderScene(sAx, from, tA, cd > 0 && tA === D.cover.t);
  const useB = mix > 0 && (to !== from || tA !== t);
  if (useB) renderScene(sBx, to, t);

  ctx.save();
  ctx.globalAlpha = fa;
  ctx.translate(W / 2, FRAME.y + FRAME.h / 2); ctx.scale(lerp(0.94, 1, pin), lerp(0.94, 1, pin)); ctx.translate(-W / 2, -(FRAME.y + FRAME.h / 2));
  ctx.save();
  ctx.shadowColor = 'rgba(70,50,30,0.28)'; ctx.shadowBlur = 34; ctx.shadowOffsetY = 12;
  framePath(ctx); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.restore();
  ctx.save();
  framePath(ctx); ctx.clip();
  if (useB) composeTransition(kind, mix, fa); else ctx.drawImage(sA, FRAME.x, FRAME.y);
  const op = prog(t, D.outro_start, D.outro_start + 0.9);
  if (op > 0) { ctx.fillStyle = rgba('#fbf6ec', 0.9 * ease.inOutSine(op)); ctx.fillRect(FRAME.x - 20, FRAME.y - 20, FRAME.w + 40, FRAME.h + 40); }
  ctx.restore();
  framePath(ctx); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 14; ctx.stroke();
  ctx.restore();
}

function composeTransition(kind, m, fa) {
  const X = FRAME.x, Y = FRAME.y, FW = FRAME.w, FH = FRAME.h;
  const e = ease.inOutCubic(m);
  const edge = (fn) => { ctx.save(); ctx.globalAlpha = fa * Math.sin(m * Math.PI); fn(); ctx.restore(); };
  switch (kind) {
    case 'wipe': {   // the new picture is revealed from the right edge, moving left (reading direction)
      ctx.drawImage(sA, X, Y);
      const ex = X + FW * (1 - e);
      ctx.save(); ctx.beginPath(); ctx.rect(ex, Y, FW, FH); ctx.clip(); ctx.drawImage(sB, X, Y); ctx.restore();
      edge(() => { const g = ctx.createLinearGradient(ex - 40, 0, ex + 40, 0); g.addColorStop(0, rgba(GOLD, 0)); g.addColorStop(0.5, rgba(GOLD_HI, 0.95)); g.addColorStop(1, rgba(GOLD, 0));
        ctx.fillStyle = g; ctx.fillRect(ex - 40, Y, 80, FH); });
      break;
    }
    case 'iris': {
      ctx.drawImage(sA, X, Y);
      const r = Math.hypot(FW, FH) * 0.55 * e, cx = X + FW / 2, cy = Y + FH / 2;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.5, r), 0, TAU); ctx.clip(); ctx.drawImage(sB, X, Y); ctx.restore();
      edge(() => { ctx.strokeStyle = GOLD_HI; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.5, r), 0, TAU); ctx.stroke();
        ctx.strokeStyle = rgba(CREAM, 0.8); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.5, r - 12), 0, TAU); ctx.stroke(); });
      break;
    }
    case 'light_sweep': {   // a band of light crosses the frame; behind it the new picture
      ctx.drawImage(sA, X, Y);
      const sx = lerp(X + FW + 260, X - 260, e), sk = 180;
      ctx.save(); ctx.beginPath(); ctx.moveTo(sx, Y); ctx.lineTo(X + FW + 400, Y); ctx.lineTo(X + FW + 400, Y + FH); ctx.lineTo(sx - sk, Y + FH); ctx.closePath(); ctx.clip();
      ctx.drawImage(sB, X, Y); ctx.restore();
      edge(() => {
        ctx.globalCompositeOperation = 'screen';
        ctx.save(); ctx.transform(1, 0, -sk / FH, 1, sx - X, 0);
        const g = ctx.createLinearGradient(X - 150, 0, X + 150, 0);
        g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(0.5, 'rgba(255,244,214,0.95)'); g.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = g; ctx.fillRect(X - 150, Y, 300, FH + 10); ctx.restore();
      });
      break;
    }
    case 'slide': {   // the old picture moves right, the new one comes in from the left (right-to-left reading)
      ctx.save(); ctx.globalAlpha = fa * (1 - e * 0.6); ctx.drawImage(sA, X + FW * 0.45 * e, Y); ctx.restore();
      ctx.save(); ctx.shadowColor = 'rgba(30,20,10,0.35)'; ctx.shadowBlur = 30; ctx.shadowOffsetX = 12;
      ctx.drawImage(sB, X - FW * (1 - e), Y); ctx.restore();
      break;
    }
    case 'page_turn': {   // the page lifts from the left edge and folds to the right, uncovering the new picture
      const fx = X + FW * e;
      ctx.drawImage(sB, X, Y);
      ctx.save(); ctx.beginPath(); ctx.rect(fx, Y, FW, FH); ctx.clip(); ctx.drawImage(sA, X, Y); ctx.restore();
      const bw = 90 * Math.sin(m * Math.PI);
      if (bw > 1) {
        ctx.save();
        const sh = ctx.createLinearGradient(fx - bw - 40, 0, fx - bw, 0); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.25)');
        ctx.fillStyle = sh; ctx.fillRect(fx - bw - 40, Y, 40, FH);
        const pg = ctx.createLinearGradient(fx - bw, 0, fx, 0); pg.addColorStop(0, '#efe4cc'); pg.addColorStop(0.7, '#fbf6ec'); pg.addColorStop(1, '#d9cbb0');
        ctx.fillStyle = pg; ctx.fillRect(fx - bw, Y, bw, FH);
        ctx.restore();
      }
      break;
    }
    case 'morph': {   // zoom through: the old picture grows and fades, the new one settles in
      const cx = X + FW / 2, cy = Y + FH / 2;
      ctx.save(); ctx.globalAlpha = fa * (1 - e); ctx.translate(cx, cy); ctx.scale(1 + 0.16 * e, 1 + 0.16 * e); ctx.drawImage(sA, -FW / 2, -FH / 2); ctx.restore();
      ctx.save(); ctx.globalAlpha = fa * e; ctx.translate(cx, cy); ctx.scale(0.9 + 0.1 * e, 0.9 + 0.1 * e); ctx.drawImage(sB, -FW / 2, -FH / 2); ctx.restore();
      break;
    }
    default: {
      ctx.drawImage(sA, X, Y);
      ctx.save(); ctx.globalAlpha = fa * m; ctx.drawImage(sB, X, Y); ctx.restore();
    }
  }
}

function anchorsAt(t) {
  const i = chapterAt(t), c = D.chapters[i];
  const a = { ...(scenes[c.scene].anchors?.(t, chT[i]) ?? {}) };
  const ma = motifAnchor(t, chT[i], c.params);
  if (ma && !((scenes[c.scene].praying?.(t, chT[i]) ?? 0) > 0.5)) a.motif = ma;   // the plate is hidden during prayer
  const out = {};
  for (const k in a) out[k] = [FRAME.x + a[k][0], FRAME.y + a[k][1]];
  return out;
}

function quadPt(p0, p1, p2, u) {
  const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
  return [a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]];
}

function drawGlosses(t, uiA) {
  for (const v of D.verses) {
    for (const g of v.glosses) {
      if (t < g.start - 0.02 || t > g.end + 0.3) continue;
      const pin = ease.outBack(prog(t, g.start, g.start + 0.38));
      const a = Math.min(prog(t, g.start, g.start + 0.15), 1 - prog(t, g.end, g.end + 0.25)) * uiA;
      if (a <= 0.01) continue;
      const tgt0 = g.target ? anchorsAt(g.start + 0.6)[g.target] : null;
      const tgt = g.target ? anchorsAt(t)[g.target] : null;
      const left = !tgt0 || tgt0[0] > FRAME.x + FRAME.w * 0.45;
      const bx = left ? 86 : W - 86 - g.bw, by = BOX_BOTTOM - g.bh;
      const tone = TONE[g.tone] ?? TONE.blue;
      // arrow (inside the frame)
      if (tgt) {
        const p0 = [left ? bx + g.bw * 0.74 : bx + g.bw * 0.26, by - 6];
        const d = Math.hypot(tgt[0] - p0[0], tgt[1] - p0[1]);
        const p2 = [tgt[0] - ((tgt[0] - p0[0]) / d) * 40, tgt[1] - ((tgt[1] - p0[1]) / d) * 40];
        const mx = (p0[0] + p2[0]) / 2, my = (p0[1] + p2[1]) / 2;
        let nxv = -(p2[1] - p0[1]) / d, nyv = (p2[0] - p0[0]) / d;
        if (nyv > 0) { nxv = -nxv; nyv = -nyv; }
        const p1 = [mx + nxv * d * 0.22, my + nyv * d * 0.22];
        const ap = ease.inOutCubic(prog(t, g.start + 0.12, g.start + 0.7));
        ctx.save();
        framePath(ctx); ctx.clip();
        ctx.globalAlpha = a;
        ctx.strokeStyle = tone; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        const N = 40;
        for (let k = 0; k <= N * ap; k++) { const q = quadPt(p0, p1, p2, k / N); if (k === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]); }
        ctx.stroke();
        if (ap > 0.9) {
          const e = quadPt(p0, p1, p2, 1), b = quadPt(p0, p1, p2, 0.93), ang = Math.atan2(e[1] - b[1], e[0] - b[0]);
          const s = ease.outBack(prog(ap, 0.9, 1)) * 18;
          ctx.fillStyle = tone;
          ctx.beginPath();
          ctx.moveTo(e[0] + Math.cos(ang) * s * 0.6, e[1] + Math.sin(ang) * s * 0.6);
          ctx.lineTo(e[0] + Math.cos(ang + 2.5) * s, e[1] + Math.sin(ang + 2.5) * s);
          ctx.lineTo(e[0] + Math.cos(ang - 2.5) * s, e[1] + Math.sin(ang - 2.5) * s);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = a;
      const cx = bx + g.bw / 2, cy = by + g.bh / 2;
      ctx.translate(cx, cy); ctx.scale(lerp(0.8, 1, pin), lerp(0.8, 1, pin)); ctx.translate(-cx, -cy);
      // box
      ctx.shadowColor = 'rgba(40,30,20,0.22)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
      ctx.fillStyle = '#fcf8ef'; rr(ctx, bx, by, g.bw, g.bh, 24); ctx.fill();
      ctx.shadowColor = 'transparent';
      // the border draws itself on, then the explanation is typed in word by word (tafsir text: UI, never Quran)
      const per = 2 * (g.bw + g.bh), bp = ease.inOutCubic(prog(t, g.start, g.start + 0.45));
      ctx.strokeStyle = tone; ctx.lineWidth = 3.5;
      if (bp < 0.999) { ctx.setLineDash([per * bp, per + 10]); ctx.lineDashOffset = -per * 0.25; }
      rr(ctx, bx, by, g.bw, g.bh, 24); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = INK; ctx.font = `700 30px ${UIF}`; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
      typeLines(g, cx, by, t);
      // chip with the Quranic word(s) - text from API words
      const chx = Math.max(24, Math.min(left ? bx + 10 : bx + g.bw - g.cw - 10, W - g.cw - 24)), chy = by - g.ch - 8;
      ctx.shadowColor = 'rgba(20,24,45,0.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
      ctx.fillStyle = NAVY; rr(ctx, chx, chy, g.cw, g.ch, g.ch / 2); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = CREAM; ctx.font = `${g.cfs || 38}px ${QFONT}`;
      ctx.fillText(g.chip, chx + g.cw / 2, chy + g.ch / 2 + 4);
      // source
      ctx.fillStyle = '#8d8778'; ctx.font = `500 22px ${UIF}`;
      ctx.fillText(g.source, cx, by + g.bh + 22);
      ctx.restore();
    }
  }
}

function typeLines(g, cx, by, t) {
  let idx = 0;
  const t0 = g.start + 0.18, rate = 0.075;
  g.lines.forEach((ln, k) => {
    const words = ln.split(' '), y = by + 15 + 21 + k * 42 + 2;
    const all = t >= t0 + rate * (idx + words.length) + 0.3;
    if (all) { ctx.textAlign = 'center'; ctx.fillText(ln, cx, y); idx += words.length; return; }
    const sp = ctx.measureText(' ').width, ws = words.map((w) => ctx.measureText(w).width);
    let x = cx + (ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1)) / 2;
    ctx.textAlign = 'right';
    words.forEach((w, j) => {
      const a = ease.outCubic(prog(t, t0 + rate * idx, t0 + rate * idx + 0.3));
      if (a > 0.01) { ctx.save(); ctx.globalAlpha *= a; ctx.fillText(w, x, y + (1 - a) * 8); ctx.restore(); }
      x -= ws[j] + sp; idx++;
    });
  });
  ctx.textAlign = 'center';
}

function badge(x, y, num, sx) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(Math.max(0.02, sx), 1);
  const g = ctx.createLinearGradient(0, -44, 0, 44);
  g.addColorStop(0, '#f6d27a'); g.addColorStop(1, '#c4913a');
  ctx.fillStyle = g; ctx.strokeStyle = '#9c7128'; ctx.lineWidth = 2;
  for (const k of [0, Math.PI / 4]) {
    ctx.save(); ctx.rotate(k); ctx.beginPath(); ctx.rect(-30, -30, 60, 60); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  ctx.fillStyle = NAVY; ctx.beginPath(); ctx.arc(0, 0, 27, 0, TAU); ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#f6dc9a'; ctx.font = `30px ${QFONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
  ctx.fillText(num, 0, 6);
  ctx.restore();
}

function diamond(x, y) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = GOLD; ctx.fillRect(-10, -10, 20, 20);
  ctx.fillStyle = NAVY2; ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
}

// verse content: old verse fades out before the card resizes, the new one fades in after it
function contentAlpha(B, t) {
  const first = B === VL[0];
  return Math.min(ease.outCubic(prog(t, B.start + (first ? -0.1 : 0.1), B.start + (first ? 0.2 : 0.4))), 1 - prog(t, B.end - 0.26, B.end - 0.06));
}

function drawCard(t, uiA) {
  const pin = ease.outBack(prog(t, D.intro - 0.55, D.intro - 0.1));
  const a = Math.min(prog(t, D.intro - 0.55, D.intro - 0.35), uiA);
  if (a <= 0.01) return { bottom: CARD_TOP + 200 };
  const { w, h } = cardDims(t);
  const x = W / 2 - w / 2, y = CARD_TOP;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(W / 2, y + h / 2); ctx.scale(lerp(0.85, 1, pin), lerp(0.85, 1, pin)); ctx.translate(-W / 2, -(y + h / 2));
  ctx.shadowColor = 'rgba(20,24,45,0.38)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#26355f'); g.addColorStop(1, NAVY2);
  ctx.fillStyle = g; rr(ctx, x, y, w, h, 16); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = GOLD; ctx.lineWidth = 3; rr(ctx, x, y, w, h, 16); ctx.stroke();
  ctx.strokeStyle = rgba(GOLD, 0.65); ctx.lineWidth = 1.5; rr(ctx, x + 10, y + 10, w - 20, h - 20, 10); ctx.stroke();
  for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) diamond(px, py);

  // verse content (at most two verses overlap during a switch)
  ctx.save(); rr(ctx, x + 4, y + 4, w - 8, h - 8, 12); ctx.clip();
  ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.font = `${QF}px ${QFONT}`;
  let cur = VL[0];
  for (const L of VL) {
    const v = L.v;
    if (t >= L.start - 0.15) cur = L;
    if (t < L.start - 0.08 || t > L.end + 0.02) continue;
    const ca = contentAlpha(L, t);
    if (ca <= 0.01) continue;
    const st = wordState(v, t);
    L.lines.forEach((ln, k) => {
      const la = k === 0 ? 1 : ease.outCubic(prog(t, ln.time, ln.time + 0.3));
      if (la <= 0.01) return;
      let xr = W / 2 + ln.w / 2;
      const by = y + PAD_TOP + k * QLH + QLH * 0.66;
      for (const wi of ln.idx) {
        const word = v.words[wi], ww = L.widths[wi];
        let col = CREAM, alpha = 1, glow = 0;
        if (word.pos === st.active) { glow = ease.outCubic(prog(t, st.aStart, st.aStart + 0.12)); col = mixHex(CREAM, GOLD_HI, glow); }
        else if (word.pos <= st.maxR) {
          const le = st.lastEnd.get(word.pos);
          const fade = le != null ? 1 - prog(t, le + 0.1, le + 0.45) : 0;
          col = mixHex(CREAM, GOLD_HI, fade * 0.9); glow = fade * 0.5;
        } else alpha = 0.24;
        ctx.globalAlpha = a * ca * la * alpha;
        if (glow > 0.02) { ctx.shadowColor = rgba(GOLD_HI, 0.8 * glow); ctx.shadowBlur = 22; }
        ctx.fillStyle = col;
        ctx.fillText(word.text, xr, by);
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
        xr -= ww + L.space;
      }
    });
  }
  ctx.restore();
  ctx.globalAlpha = a;
  // badge with a flip on verse change
  const ci = VL.indexOf(cur), prev = VL[Math.max(0, ci - 1)];
  const flip = ci > 0 && prev.v !== cur.v;   // pages of the same verse keep the badge still
  const f = prog(t, cur.start - 0.15, cur.start + 0.15);
  badge(W / 2, y, flip && f < 0.5 ? prev.v.num_ar : cur.v.num_ar, flip ? Math.abs(Math.cos(f * Math.PI)) : 1);
  ctx.restore();
  return { bottom: y + h };
}

function drawTranslation(t, uiA, top) {
  ctx.save();
  ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  for (const L of VL) {
    if (t < L.start - 0.08 || t > L.end + 0.02) continue;
    const ca = contentAlpha(L, t) * uiA;
    if (ca <= 0.01) continue;
    const r = prog(t, L.first_word, L.last_word - 0.3) * L.trN + 0.8;
    ctx.font = `500 ${L.trFs}px ${ENF}`; ctx.letterSpacing = '1.5px';
    const lh = L.trFs * 1.45;
    let i = 0;
    L.trLines.forEach((ln, k) => {
      const lw = ln.reduce((s, w) => s + w.w, 0) + L.trSpace * (ln.length - 1);
      let x = W / 2 - lw / 2;
      for (const w of ln) {
        const wa = clamp(r - i);
        if (wa > 0.01) {
          ctx.globalAlpha = ca * (0.18 + 0.82 * wa) * (r - i > -1.5 ? 1 : 0);
          ctx.fillStyle = '#464a58';
          if (r - i > -1.5) ctx.fillText(w.text, x, top + 40 + k * lh + (1 - wa) * 6);
        }
        x += w.w + L.trSpace; i++;
      }
    });
  }
  ctx.letterSpacing = '0px';
  ctx.restore();
}

function drawDots(t, a) {
  if (a <= 0.01) return;
  const n = D.chapters.length, ci = chapterAt(t);
  const ws = D.chapters.map((c, k) => {
    const on = k === ci ? ease.outCubic(prog(t, c.start - 0.2, c.start + 0.3)) : k === ci - 1 ? 1 - ease.outCubic(prog(t, D.chapters[ci].start - 0.2, D.chapters[ci].start + 0.3)) : 0;
    return { w: lerp(11, 42, on), on };
  });
  const gap = 10, total = ws.reduce((s, x) => s + x.w, 0) + gap * (n - 1);
  let x = W / 2 - total / 2;
  ctx.save(); ctx.globalAlpha = a;
  // RTL progress: first chapter on the right
  for (let k = n - 1; k >= 0; k--) {
    const { w, on } = ws[k];
    ctx.fillStyle = mixHex('#c9c2b6', '#e0a63a', on);
    rr(ctx, x, 1868 - 5.5, w, 11, 5.5); ctx.fill();
    x += w + gap;
  }
  ctx.restore();
}

function drawOutro(t) {
  const os = D.outro_start;
  if (t < os + 0.3) return;
  const s = D.surah;
  const item = (k) => ease.outCubic(prog(t, os + 0.5 + k * 0.18, os + 1.1 + k * 0.18));
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
  let a = item(0);
  ctx.globalAlpha = a;
  A.octagram(ctx, W / 2, 500, 70 * lerp(0.6, 1, ease.outBack(a)), '#c99a3f', a, t * 0.2, 0.1, 6);
  ctx.fillStyle = '#b8433c'; ctx.beginPath(); ctx.arc(W / 2, 500, 14, 0, TAU); ctx.fill();
  a = item(1); ctx.globalAlpha = a; ctx.fillStyle = NAVY; ctx.font = `86px ${TITLEF}`;
  ctx.fillText(`سورة ${s.name_ar}`, W / 2, 680 + (1 - a) * 20);
  a = item(2); ctx.globalAlpha = a; ctx.fillStyle = '#a5762a'; ctx.font = `800 42px ${UIF}`;
  ctx.fillText(`الآيات ${s.from_ar} – ${s.to_ar}`, W / 2, 780 + (1 - a) * 20);
  a = item(3); ctx.globalAlpha = a; ctx.fillStyle = '#5b5f6e'; ctx.font = `600 28px ${ENF}`; ctx.letterSpacing = '6px'; ctx.direction = 'ltr';
  ctx.fillText(`SURAT ${s.name_en.toUpperCase()} · ${s.from}–${s.to}`, W / 2, 850 + (1 - a) * 20);
  ctx.letterSpacing = '0px';
  a = item(5); ctx.globalAlpha = a; ctx.direction = 'rtl'; ctx.fillStyle = INK; ctx.font = `700 38px ${UIF}`;
  ctx.fillText(`بصوت القارئ ${D.credits.reciter_ar}`, W / 2, 1300);
  a = item(6); ctx.globalAlpha = a; ctx.direction = 'ltr'; ctx.fillStyle = '#7a7666'; ctx.font = `500 24px ${ENF}`;
  ctx.fillText(D.credits.translation_en, W / 2, 1400);
  ctx.fillText(D.credits.data_en, W / 2, 1446);
  ctx.restore();
}

function renderAt(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.shadowColor = 'transparent';
  const uiA = 1 - ease.inOutSine(prog(t, D.outro_start, D.outro_start + 0.6));
  drawBackground(t);
  const cd = coverDur();
  drawLogo(t, cd ? 1 : ease.outCubic(prog(t, 0, 0.5)));
  drawTitle(t, uiA);
  drawFrame(t);
  drawGlosses(t, uiA);
  const card = drawCard(t, uiA);
  drawTranslation(t, uiA, card.bottom);
  drawDots(t, ease.outCubic(prog(t, cd + 0.3, cd + 0.8)));
  drawCover(t);
  drawOutro(t);
}
