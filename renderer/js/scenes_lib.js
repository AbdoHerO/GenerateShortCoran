// Generic scene library for any passage: 'ambient' (calm, non-figurative) and 'stage' (a composable story stage).
// Contract and allowed values: renderer/js/scene_catalog.json. Every frame is a pure function of t; all timing comes
// from T (recited word times), never from literal seconds.
// Rules: Allah is never depicted. Prophets, angels and honoured women appear ONLY as labelled light drops.
// People are faceless. No text is drawn except the drop labels.
import { TAU, clamp, lerp, prog, ease, env, hash, mixHex, rgba } from './util.js';
import * as A from './art.js';
import { SW, SH, HY, withCam, S, par, ROBES } from './scenes.js';

// ================================================================ shared helpers
const H = (a, b = 0) => hash(Math.imul(a | 0, 7919) + Math.imul(b | 0, 104729) + 13);
const BIG = 1e9;

function win(T) {
  const s = Number.isFinite(T?.start) ? T.start : Number.isFinite(T?.c?.start) ? T.c.start : 0;
  let e = Number.isFinite(T?.end) ? T.end : Number.isFinite(T?.c?.end) ? T.c.end : s + 10;
  if (!(e > s)) e = s + 10;
  return [s, e];
}
// time of [verse, word]; null -> fallback
function refT(T, ref, fb) {
  if (!Array.isArray(ref) || ref.length < 2) return fb;
  let v = NaN;
  try { v = T.at ? T.at(ref) : T.w(ref[0], ref[1]); } catch { v = NaN; }
  return Number.isFinite(v) ? v : fb;
}
// recited words that started within `span` seconds before t (newest first)
function recent(T, t, span) {
  const W = T?.words || [];
  let lo = 0, hi = W.length - 1, last = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (W[m].s <= t) { last = m; lo = m + 1; } else hi = m - 1; }
  const out = [];
  for (let i = last; i >= 0 && t - W[i].s < span; i--) out.push({ i, n: W[i].n, p: W[i].p, age: t - W[i].s });
  return out;
}
const pulseA = (age) => (age < 0 ? 0 : age < 0.12 ? age / 0.12 : Math.exp(-(age - 0.12) * 2.4));
const wordKey = (w) => w.n * 131 + w.p * 17;

// smooth dune / hill silhouette
function band(ctx, y, amp, seed, col, n = 7, x0 = -500, x1 = 1500) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x0, SH + 600); ctx.lineTo(x0, y);
  const step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const xc = x0 + step * (i + 0.5), xe = x0 + step * (i + 1);
    ctx.quadraticCurveTo(xc, y - amp * (0.4 + H(seed, i) * 1.2), xe, y + amp * (H(seed, i + 40) - 0.5) * 0.5);
  }
  ctx.lineTo(x1, SH + 600); ctx.closePath(); ctx.fill();
}
function peaks(seed, n, x0, x1, hMin, hMax, wMin, wMax) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: lerp(x0, x1, (i + 0.5) / n) + (H(seed, i) - 0.5) * 70, h: lerp(hMin, hMax, H(seed, i + 9)), w: lerp(wMin, wMax, H(seed, i + 19)) });
  return out;
}
// flat-topped sandstone mesa / butte; (x, baseY) = centre of its base
function mesa(ctx, x, baseY, w, h, light, dark, seed = 1) {
  const tw = w * (0.5 + H(seed, 1) * 0.2), l = x - w / 2, r = x + w / 2, tl = x - tw / 2, tr = x + tw / 2, top = baseY - h;
  const outline = () => {
    ctx.beginPath(); ctx.moveTo(l, baseY);
    ctx.quadraticCurveTo(l + (tl - l) * 0.35, top + h * 0.55, tl - 8, top + h * 0.3); ctx.lineTo(tl, top + 5);
    for (let i = 0; i <= 5; i++) ctx.lineTo(lerp(tl, tr, i / 5), top + (H(seed, i + 5) - 0.5) * 8);
    ctx.lineTo(tr + 6, top + h * 0.28); ctx.quadraticCurveTo(r - (r - tr) * 0.35, top + h * 0.55, r, baseY); ctx.closePath();
  };
  ctx.fillStyle = light; outline(); ctx.fill();
  ctx.save(); outline(); ctx.clip();
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.moveTo(x + tw * 0.2, top - 10); ctx.lineTo(r + 10, top - 10); ctx.lineTo(r + 10, baseY + 2); ctx.lineTo(x + w * 0.12, baseY + 2); ctx.closePath(); ctx.fill();
  // no horizontal "courses": regular bands on a symmetric block read as a step pyramid (Aal Imran picture review)
  ctx.restore();
}
// low rounded headland on the horizon (left side)
function headland(ctx, x0, x1, baseY, h, light, dark) {
  ctx.fillStyle = light;
  ctx.beginPath(); ctx.moveTo(x0, baseY); ctx.bezierCurveTo(x0 + (x1 - x0) * 0.2, baseY - h * 1.1, x0 + (x1 - x0) * 0.55, baseY - h * 0.9, x1, baseY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.moveTo(x0 + (x1 - x0) * 0.42, baseY - h * 0.82); ctx.bezierCurveTo(x0 + (x1 - x0) * 0.6, baseY - h * 0.7, x0 + (x1 - x0) * 0.8, baseY - h * 0.3, x1, baseY); ctx.lineTo(x0 + (x1 - x0) * 0.5, baseY); ctx.closePath(); ctx.fill();
}
function mistBand(ctx, y, h, a) {
  const g = ctx.createLinearGradient(0, y - h, 0, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(-600, y - h, 2200, 2 * h);
}
function waterBand(ctx, y0, y1, t, top, bottom, rough = 1, x0 = -400, x1 = 1400) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.lineCap = 'round';
  const n = 13;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), y = y0 + Math.pow(k, 1.7) * (y1 - y0) + 3, amp = (1.2 + k * 5) * rough;
    ctx.strokeStyle = `rgba(255,255,255,${0.1 + 0.16 * k})`; ctx.lineWidth = 1.4 + k * 2.6;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 18) { const yy = y + Math.sin(t * (1.1 + rough * 0.7) + x * (0.03 - k * 0.017) + i * 1.7) * amp; if (x === x0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
    ctx.stroke();
  }
}
function crescent(ctx, x, y, r, a = 1) {
  A.glowDisc(ctx, x, y, 1, 'rgba(0,0,0,0)', '#f6eec8', r * 3.4, a, 0.35);
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.fillStyle = '#f8f1d6';
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.arc(x + r * 0.38, y - r * 0.26, r * 0.84, 0, TAU); ctx.fill('evenodd');
  ctx.restore();
}
function palmSil(ctx, x, y, s, t, col, seed = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = col; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(18, -120, 30, -240); ctx.stroke();
  ctx.fillStyle = col;
  const sw = Math.sin(t * 0.8 + seed) * 0.04;
  for (const a0 of [-2.7, -2.15, -1.6, -1.05, -0.5, 0.05, 0.55]) {
    ctx.save(); ctx.translate(30, -240); ctx.rotate(a0 + sw + Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(70, -26, 130, 20); ctx.quadraticCurveTo(64, 2, 0, 0); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function cloudSolid(ctx, x, y, s, a = 1, col = '#ffffff') {
  if (a <= 0.01) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = col; ctx.beginPath();
  for (const [dx, dy, r] of [[-60, 8, 34], [-20, -12, 44], [28, -2, 38], [64, 12, 28], [0, 16, 36], [-96, 20, 22], [98, 22, 20]]) {
    ctx.moveTo(x + (dx + r) * s, y + dy * s); ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU);
  }
  ctx.fill(); ctx.restore();
}
// rising motes: deterministic particle field
function motes(ctx, n, seed, t, x0, x1, y0, y1, speed, col, aMax = 0.7, rMax = 3.2) {
  const h = y1 - y0;
  ctx.save();
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const sp = speed * (0.6 + H(seed, i) * 0.8);
    const y = y1 - ((t * sp + H(seed, i + 300) * h) % h);
    const x = lerp(x0, x1, H(seed, i + 600)) + Math.sin(t * 0.5 + i) * 14;
    const fade = Math.sin(Math.PI * clamp((y1 - y) / h));
    ctx.globalAlpha = aMax * fade * (0.5 + 0.5 * Math.sin(t * 1.7 + i * 2.3));
    ctx.beginPath(); ctx.arc(x, y, 1.2 + H(seed, i + 900) * rMax, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

const arr = (x) => (Array.isArray(x) ? x : []);
// a palm whose fronds can dry and droop (dry 0..1)
function palmC(ctx, x, y, s, t, seed = 1, lean = 0.12, dry = 0) {
  if (dry <= 0.01) { A.palm(ctx, x, y, s, t, seed, lean); return; }
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const Hh = 300, segs = 16;
  const pt = (k) => [Math.sin(k * 1.4) * lean * Hh * 0.5 + k * lean * 60, -k * Hh];
  for (let i = 0; i < segs; i++) {
    const [ax, ay] = pt(i / segs), [bx, by] = pt((i + 1) / segs), w = lerp(22, 13, i / segs);
    ctx.fillStyle = mixHex(i % 2 ? '#8c5a33' : '#a8713f', '#8a7a62', dry * 0.6);
    ctx.beginPath(); ctx.moveTo(ax - w, ay); ctx.lineTo(bx - w * 0.92, by - 2); ctx.lineTo(bx + w * 0.92, by - 2); ctx.lineTo(ax + w, ay); ctx.closePath(); ctx.fill();
  }
  const [tx, ty] = pt(1);
  [-2.6, -2.1, -1.55, -1.0, -0.45, 0.05, 0.5].forEach((a0, i) => {
    const droop = dry * (a0 < -1.55 ? -0.9 : 0.9) * (0.6 + 0.4 * Math.abs(a0 + 1.55));
    const L = (150 + hash(seed + i) * 40) * (1 - 0.15 * dry);
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(a0 + droop + Math.PI / 2);
    ctx.fillStyle = mixHex(i % 2 ? '#2f7d3f' : '#3f9a4c', i % 2 ? '#9a7f45' : '#b39456', dry);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L * 0.45, -34, L, 22); ctx.quadraticCurveTo(L * 0.5, 4, 0, 0); ctx.fill();
    ctx.restore();
  });
  ctx.restore();
}

// ================================================================ BEATS (shared by both scenes)
// params.beats = [{at:[verse,word], do, who, to}] -> small timed actions. Times always come from T.at(at).
const CAMERA = new Set(['shot_wide', 'shot_close', 'shot_sky', 'shot_ground', 'pan_left', 'pan_right', 'push_in']);
function beatList(P, T) {
  const out = [];
  arr(P.beats).forEach((b, i) => {
    if (!b || typeof b.do !== 'string') return;
    const t = refT(T, b.at, NaN);
    if (Number.isFinite(t)) out.push({ do: b.do, who: String(b.who ?? ''), to: String(b.to ?? ''), t, i });
  });
  return out.sort((a, b) => a.t - b.t || a.i - b.i);
}
// persistent state that eases to a new value at each matching beat: targets = {do: value}
function rampState(B, t, init, targets, dur = 1.4, e = ease.inOutSine) {
  const M = B.filter((b) => b.do in targets);
  let v = init;
  for (let i = 0; i < M.length; i++) {
    if (M[i].t > t) break;
    const tEnd = i + 1 < M.length && M[i + 1].t <= t ? M[i + 1].t : t;
    v = lerp(v, targets[M[i].do], e(prog(tEnd, M[i].t, M[i].t + dur)));
  }
  return v;
}
// strongest short envelope among beats named `name`
function pulseOf(B, t, name, dur, inD = 0.3, who = null) {
  let k = 0;
  for (const b of B) {
    if (b.t > t) break;
    if (b.do !== name || (who != null && b.who !== who)) continue;
    k = Math.max(k, env(t, b.t, b.t + dur, inD, dur * 0.45));
  }
  return k;
}
const lerpF = (a, b, p) => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), z: lerp(a.z, b.z, p) });

// camera keyframes: explicit camera beats + automatic recomposition in every quiet gap of 5 s
// frameOf(beat, t) -> framing; autoFrames = [(t) -> framing]
const CAMCACHE = new WeakMap();
function camKeys(P, T, B, frameOf, autoFrames, pkey) {
  let byT = T && typeof T === 'object' ? CAMCACHE.get(T) : null;
  if (byT && byT.has(pkey)) return byT.get(pkey);
  const [s, e] = win(T);
  const keys = [{ t: -BIG, f: frameOf({ do: 'shot_wide' }, s), dur: 0 }];
  for (const b of B) if (CAMERA.has(b.do)) keys.push({ t: b.t, f: frameOf(b, b.t), dur: b.do === 'push_in' ? 2.8 : 1.1, ease: ease.inOutCubic });
  const acts = [s, ...B.map((b) => b.t)];
  for (const ev of arr(P.events)) { acts.push(refT(T, ev?.at, NaN)); if (ev?.until) acts.push(refT(T, ev.until, NaN)); }
  for (const a of arr(P.actors)) { if (a?.enter) acts.push(refT(T, a.enter, NaN)); if (a?.exit) acts.push(refT(T, a.exit, NaN)); }
  const Aq = acts.filter(Number.isFinite).sort((x, y) => x - y);
  Aq.push(e);
  const pauses = arr(T?.words).filter((w) => w.pause && Number.isFinite(w.e)).map((w) => w.e).sort((x, y) => x - y);
  let k = 0, prev = -1;
  for (let i = 0; i < Aq.length - 1; i++) {
    let a = Aq[i];
    const b = Aq[i + 1];
    for (let guard = 0; guard < 40 && b - a > 5; guard++) {
      const lo = a + 4.2, hi = Math.min(a + 7.5, b - 1.2);
      let tau = pauses.find((p) => p >= lo && p <= hi);
      if (tau == null) tau = a + 5;
      if (tau > b - 1.2 || autoFrames.length === 0) break;
      let idx = Math.floor(H(k, 401) * autoFrames.length);
      if (idx === prev) idx = (idx + 1) % autoFrames.length;
      keys.push({ t: tau, f: autoFrames[idx](tau), dur: 2.8, ease: ease.inOutSine, auto: true });
      prev = idx; k++; a = tau;
    }
  }
  keys.sort((x, y) => x.t - y.t);
  if (T && typeof T === 'object') { if (!byT) { byT = new Map(); CAMCACHE.set(T, byT); } if (byT.size > 20) byT.clear(); byT.set(pkey, keys); }
  return keys;
}
function camAt(keys, t) {
  let val = keys[0].f;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (k.t > t) break;
    const tEnd = i + 1 < keys.length && keys[i + 1].t <= t ? keys[i + 1].t : t;
    val = lerpF(val, k.f, (k.ease || ease.inOutCubic)(prog(tEnd, k.t, k.t + k.dur)));
  }
  return val;
}
function clampCam(c, zMin, zMax, X0, X1, yMin, yBot) {
  const z = clamp(c.z, zMin, zMax), hw = 480 / z, hh = 435 / z;
  const x = clamp(c.x, Math.min(X0 + hw, 480), Math.max(X1 - hw, 480));
  const y = clamp(c.y, yMin, Math.max(yMin, yBot - hh));
  return { x, y, z };
}

// ---- scene beats (both scenes): birds, wind, sparkle, clouds_part, leaves ----
function birdsBeat(ctx, B, t) {
  for (const b of B) {
    if (b.do !== 'birds' || t < b.t || t > b.t + 6) continue;
    const dir = H(b.i, 501) > 0.5 ? 1 : -1, x0 = 300 + H(b.i, 502) * 360;
    const nb = 5 + Math.floor(H(b.i, 503) * 6);   // flock size varies so it never reads as a number
    for (let j = 0; j < nb; j++) {
      const p = clamp((t - b.t - j * 0.12) / 5.2);
      if (p <= 0) continue;
      const x = x0 + (j - 2.5) * 26 + dir * p * 760 + Math.sin(p * 9 + j) * 8, y = 600 - j * 6 - ease.outCubic(p) * 470 - Math.sin(p * 6 + j) * 10;
      ctx.save(); ctx.globalAlpha = Math.min(1, p * 8) * (1 - prog(p, 0.85, 1)); A.bird(ctx, x, y, lerp(0.8, 1.3, p), t * 1.6, j + b.i); ctx.restore();
    }
  }
}
function windStreaks(ctx, k, t) {
  if (k <= 0.01) return;
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${0.55 * k})`; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 26; i++) {
    const y = 120 + H(i, 511) * 640, x = ((H(i, 512) * 1400 + t * 700) % 1400) - 220, L = 60 + H(i, 513) * 90;
    ctx.moveTo(x, y); ctx.quadraticCurveTo(x + L * 0.5, y - 6, x + L, y + 2);
  }
  ctx.stroke();
  for (let i = 0; i < 4; i++) A.dust(ctx, ((i * 330 + t * 420) % 1500) - 270, 640 + H(i, 514) * 120, 110, 0.35 * k, '#e7d3ad');
  ctx.restore();
}
function sparkleBeats(ctx, B, t, pointOf) {
  for (const b of B) {
    if (b.do !== 'sparkle' || t < b.t || t > b.t + 1.6) continue;
    const p = pointOf(b.who) || [480, 435], q = (t - b.t) / 1.6;
    A.glowDisc(ctx, p[0], p[1], 1, 'rgba(0,0,0,0)', '#fff3c4', 90, Math.sin(Math.PI * q) * 0.9, 0.6);
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * TAU + b.i, r = 18 + q * 60;
      A.sparkle(ctx, p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r * 0.8, 9 * (1 - q) + 3, Math.sin(Math.PI * q));
    }
  }
}
function cloudsPart(ctx, B, t) {
  for (const b of B) {
    if (b.do !== 'clouds_part' || t < b.t - 3 || t > b.t + 9) continue;
    const pin = prog(t, b.t - 3, b.t - 1.6), p = ease.inOutCubic(prog(t, b.t, b.t + 2.6));
    const a = pin * (1 - p * 0.7);
    for (let j = 0; j < 3; j++) {
      cloudSolid(ctx, 480 - 90 - j * 70 - p * 520, 120 + j * 36, 1.4 - j * 0.2, a, j % 2 ? '#c9d0da' : '#dde2e8');
      cloudSolid(ctx, 480 + 90 + j * 70 + p * 520, 130 + j * 32, 1.4 - j * 0.2, a, j % 2 ? '#dde2e8' : '#c9d0da');
    }
    const k = env(t, b.t + 0.5, b.t + 8, 1.2, 2.4);
    if (k > 0.01) {
      ctx.save();
      for (let i = 0; i < 9; i++) {
        const ang = Math.PI / 2 + (i - 4) * 0.14, w = 0.03;
        const g = ctx.createLinearGradient(480, 60, 480 + Math.cos(ang) * 900, 60 + Math.sin(ang) * 900);
        g.addColorStop(0, `rgba(255,248,220,${0.45 * k})`); g.addColorStop(1, 'rgba(255,248,220,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(480, 60); ctx.lineTo(480 + Math.cos(ang - w) * 900, 60 + Math.sin(ang - w) * 900); ctx.lineTo(480 + Math.cos(ang + w) * 900, 60 + Math.sin(ang + w) * 900); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }
}
function leavesBeat(ctx, B, t, cols = ['#7cb850', '#c9a43a', '#a8713f']) {
  for (const b of B) {
    if (b.do !== 'leaves' || t < b.t || t > b.t + 6) continue;
    for (let j = 0; j < 10; j++) {
      const p = clamp((t - b.t - j * 0.2) / 4.8);
      if (p <= 0 || p >= 1) continue;
      const x = 60 + H(b.i * 10 + j, 521) * 840 + Math.sin(p * 7 + j) * 40 + p * 90, y = -20 + p * 900;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(p * 9 + j) * 1.2);
      ctx.globalAlpha = Math.min(1, p * 6) * (1 - prog(p, 0.85, 1));
      ctx.fillStyle = cols[j % cols.length];
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(0, -8, 10, 0); ctx.quadraticCurveTo(0, 8, -10, 0); ctx.fill();
      ctx.restore();
    }
  }
}
// sound waves near a speaker's head (age 0..1.6 s)
function speakArcs(ctx, x, y, age, dir = 1, s = 1) {
  if (age < 0 || age > 1.6) return;
  const a = Math.sin(Math.PI * clamp(age / 1.6));
  ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.95 * a})`; ctx.lineWidth = 4 * s; ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(40,40,60,0.35)'; ctx.shadowBlur = 4;
  for (let j = 0; j < 3; j++) {
    const r = (14 + j * 11 + ((age * 26) % 11)) * s;
    ctx.beginPath(); ctx.arc(x + dir * 14 * s, y, r, dir > 0 ? -0.55 : Math.PI - 0.55, dir > 0 ? 0.55 : Math.PI + 0.55); ctx.stroke();
  }
  ctx.restore();
}

// ================================================================ AMBIENT
const MOODS = ['night_sky', 'dawn', 'sea', 'mountains', 'garden', 'rain', 'geometric', 'light'];

function ambFrame(b, mood) {
  const L = AMB[mood]?.light || [480, 300];
  switch (b.do) {
    case 'shot_sky': return { x: 480, y: 330, z: 1.14 };
    case 'shot_ground': return { x: 480, y: 560, z: 1.16 };
    case 'pan_left': return { x: 400, y: 440, z: 1.12 };
    case 'pan_right': return { x: 560, y: 440, z: 1.12 };
    case 'push_in': return { x: 480, y: 450, z: 1.3 };
    case 'shot_close': {
      if (b.who === 'sky') return { x: 480, y: 280, z: 1.2 };
      if (b.who === 'ground') return { x: 480, y: 620, z: 1.2 };
      if (b.who === 'light') return { x: L[0], y: L[1], z: 1.3 };
      return { x: 480, y: 435, z: 1.3 };
    }
    default: return { x: 480, y: 435, z: 1.02 };
  }
}
const AMB_AUTO = [{ x: 440, y: 440, z: 1.07 }, { x: 520, y: 440, z: 1.07 }, { x: 480, y: 415, z: 1.12 }, { x: 480, y: 465, z: 1.09 }, { x: 465, y: 400, z: 1.05 }].map((f) => () => f);
function ambCam(t, T, P, B, pkey) {
  const mood = AMB[P?.mood] ? P.mood : 'dawn';
  const keys = camKeys(P || {}, T, B, (b) => ambFrame(b, mood), AMB_AUTO, pkey);
  const f = camAt(keys, t);
  const [s, e] = win(T);
  const p = ease.inOutSine(prog(t, s - 0.4, e + 0.4));
  const c = { x: f.x + Math.sin(t * 0.21) * 8, y: f.y + Math.sin(t * 0.25 + 1) * 4, z: f.z * (1 + 0.05 * p) + Math.sin(t * 0.31) * 0.004 };
  return clampCam(c, 1.0, 1.42, -60, 1020, 230, 960);
}
// ambient beat state
function ambState(B, t, mood) {
  let ink = 0, turns = 0;
  for (const b of B) {
    if (b.t > t) break;
    if (b.do === 'ink_waves') ink += ease.inOutSine(prog(t, b.t, b.t + 3.2)) * 0.55;
    if (b.do === 'pattern_turn') turns += ease.inOutCubic(prog(t, b.t, b.t + 1.6));
  }
  return {
    rain: rampState(B, t, mood === 'rain' ? 1 : 0, { rain_start: 1, rain_stop: 0 }, 1.8),
    veg: rampState(B, t, 0, { bloom: 1, wither: -1 }, 2.4),
    lightUp: pulseOf(B, t, 'light_up', 2.6, 0.5),
    stars: pulseOf(B, t, 'stars', 3.6, 0.5),
    wind: pulseOf(B, t, 'wind', 2.6, 0.4),
    ink: Math.min(1, ink), turns,
    waves: B.filter((b) => b.do === 'waves' && t >= b.t && t < b.t + 4.5).map((b) => t - b.t),
  };
}
// plants that sprout (bloom) or dry and scatter (wither) on a ground strip
function vegStrip(ctx, t, X, y0, y1, seed, x0 = -60, x1 = 1020) {
  const bloom = Math.max(0, X.veg), wither = Math.max(0, -X.veg);
  if (bloom < 0.01 && wither < 0.01) return;
  const FL = ['#f2c25b', '#e8738a', '#ffffff', '#c58be0'];
  for (let i = 0; i < 22; i++) {
    const x = lerp(x0, x1, H(seed, i)), y = lerp(y0, y1, H(seed, i + 50));
    if (bloom > 0.01) {
      const k = ease.outBack(clamp(bloom * 1.6 - (i / 22) * 0.6));
      if (k > 0.01) {
        A.grass(ctx, x, y, 0.9 * k, t, i + seed);
        if (i % 2 === 0) { ctx.fillStyle = FL[i % 4]; ctx.beginPath(); ctx.arc(x + 7, y - 30 * k, 5 * k, 0, TAU); ctx.fill(); }
      }
    }
    if (wither > 0.01) {
      ctx.save(); ctx.globalAlpha = wither;
      A.grass(ctx, x, y, 0.75, t, i + seed, '#9a8048', '#b39a5e');
      ctx.restore();
      const p = clamp(wither * 2 - (i % 5) * 0.12);
      if (p > 0 && p < 1) { ctx.fillStyle = '#b39456'; ctx.beginPath(); ctx.ellipse(x + p * 160, y - 20 - Math.sin(p * 6) * 30, 6, 3, p * 4, 0, TAU); ctx.fill(); }
    }
  }
}

const AMB = {
  night_sky: {
    light: [700, 190],
    draw(ctx, t, T, c, P, X) {
      A.sky(ctx, SW, SH, '#0e1533', '#3c4382', '#1c2452');
      A.dust(ctx, 260, 250, 460, 0.12, '#9aa6e0');
      withCam(ctx, par(c, 0.1), () => {
        ctx.save(); ctx.translate(-120, -60); A.stars(ctx, SW + 240, 640, 130, 31, t, 1); ctx.restore();
        crescent(ctx, 700, 190, 46, 1);
        if (X.stars > 0.01) for (let j = 0; j < 22; j++) {
          const sx = H(j, 601) * 1100 - 70, sy = H(j, 602) * 560 - 30;
          A.sparkle(ctx, sx, sy, (6 + 8 * H(j, 603)) * (0.6 + 0.4 * X.stars), X.stars * (0.45 + 0.55 * Math.max(0, Math.sin(t * 5 + j * 1.7))));
        }
        for (const w of P) {
          const a = pulseA(w.age); if (a < 0.02) continue;
          const k = wordKey(w), x = 40 + H(k, 1) * 880, y = 40 + H(k, 2) * 430;
          A.glowDisc(ctx, x, y, 1, 'rgba(0,0,0,0)', '#cfd8ff', 34, a * 0.8, 0.5);
          A.sparkle(ctx, x, y, 9 + a * 9, a);
        }
      });
      A.dust(ctx, 480, 640, 520, 0.22, '#7a7fc0');
      withCam(ctx, par(c, 0.35), () => { band(ctx, 600, 46, 3, '#2b3268'); for (let i = 0; i < 9; i++) palmSil(ctx, 120 + i * 17 + H(i, 31) * 22, 614 + H(i, 32) * 10, 0.32 + H(i, 33) * 0.36, t, '#2b3268', i); });
      withCam(ctx, par(c, 0.7), () => { band(ctx, 665, 40, 7, '#222956'); for (let i = 0; i < 7; i++) palmSil(ctx, 790 + i * 21 + H(i, 41) * 18, 690 + H(i, 42) * 8, 0.42 + H(i, 43) * 0.4, t, '#222956', i + 3); });
      withCam(ctx, c, () => band(ctx, 742, 34, 11, '#1a2046'));
    },
  },

  dawn: {
    light: [520, 520],
    sunY(t, T) { const [s, e] = win(T); return lerp(588, 430, ease.inOutSine(prog(t, s - 0.4, e + 0.4))); },
    draw(ctx, t, T, c, P, X) {
      A.sky(ctx, SW, SH, '#a7bcdb', '#fde3bc', '#f6c6a0');
      const sy = this.sunY(t, T);
      withCam(ctx, par(c, 0.15), () => {
        ctx.save();
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI / 2 + (i - 4) * 0.28 + Math.sin(t * 0.2) * 0.02;
          ctx.globalAlpha = 0.07 + 0.04 * Math.sin(t * 0.6 + i);
          ctx.fillStyle = '#fff4dc';
          ctx.beginPath(); ctx.moveTo(520, sy);
          ctx.lineTo(520 + Math.cos(a - 0.05) * 1200, sy + Math.sin(a - 0.05) * 1200); ctx.lineTo(520 + Math.cos(a + 0.05) * 1200, sy + Math.sin(a + 0.05) * 1200);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        A.glowDisc(ctx, 520, sy, 68, '#fff3d4', '#ffcf86', 330, 1, 0.7);
        A.cloud(ctx, (130 + t * 7) % 1200 - 160, 150, 0.8, 0.55, '#fff1e2');
        A.cloud(ctx, (760 + t * 5) % 1200 - 160, 95, 0.6, 0.45, '#fff1e2');
      });
      for (let i = 0; i < 5; i++) A.bird(ctx, (140 + i * 190 + t * 16) % 1100 - 70, 200 + H(i, 3) * 120, 0.85, t, i);
      withCam(ctx, par(c, 0.25), () => band(ctx, 575, 40, 21, '#f0c39a'));
      withCam(ctx, par(c, 0.5), () => band(ctx, 630, 46, 23, '#e7ae7c'));
      withCam(ctx, par(c, 0.8), () => {
        band(ctx, 700, 40, 25, '#dc9f6c');
        for (const w of P) {
          const a = pulseA(w.age); if (a < 0.02) continue;
          const k = wordKey(w), x = 60 + H(k, 1) * 840, y = 640 + H(k, 2) * 80 - w.age * 50;
          A.glowDisc(ctx, x, y, 3, '#fff6e0', '#ffd99a', 26, a, 0.6);
        }
      });
      withCam(ctx, c, () => { band(ctx, 775, 34, 27, '#cf9361'); vegStrip(ctx, t, X, 790, 860, 27); });
    },
  },

  sea: {
    light: [640, 300],
    draw(ctx, t, T, c, P, X) {
      const HZ = 470;
      A.sky(ctx, SW, SH, '#a6d2ea', '#fbe3c8', '#d7e7ec');
      withCam(ctx, par(c, 0.15), () => {
        A.glowDisc(ctx, 640, 300, 58, '#fff6dc', '#ffe0a6', 260, 1, 0.6);
        A.cloud(ctx, (160 + t * 6) % 1250 - 180, 130, 0.85, 0.85);
        A.cloud(ctx, (820 + t * 4) % 1250 - 180, 210, 0.6, 0.7);
        headland(ctx, -160, 330, HZ + 2, 46, '#a9c2cf', '#93aebe');
      });
      withCam(ctx, par(c, 0.6), () => {
        waterBand(ctx, HZ, SH + 120, t, '#8acbe3', '#226c98', 1, -400, 1400);
        // sun glitter column
        ctx.save();
        for (let i = 0; i < 22; i++) {
          const y = HZ + 8 + Math.pow(i / 21, 1.5) * 330, w = 14 + i * 4.5;
          ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.9));
          ctx.fillStyle = '#fff3d0';
          ctx.fillRect(640 - w / 2 + Math.sin(t * 1.3 + i) * 8, y, w, 2.4 + i * 0.12);
        }
        ctx.restore();
        for (const age of X.waves) {
          const q = age / 4.5, y = HZ + 12 + Math.pow(q, 1.3) * 380, a = Math.sin(Math.PI * clamp(q));
          ctx.save(); ctx.globalAlpha = a;
          ctx.fillStyle = 'rgba(20,80,120,0.35)'; ctx.beginPath(); ctx.moveTo(-400, y);
          for (let x = -400; x <= 1400; x += 24) ctx.lineTo(x, y + 14 + Math.sin(x * 0.012 + age * 2) * 6);
          ctx.lineTo(1400, y + 40); ctx.lineTo(-400, y + 40); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5 + q * 6; ctx.lineCap = 'round'; ctx.beginPath();
          for (let x = -400; x <= 1400; x += 24) { const yy = y + Math.sin(x * 0.012 + age * 2) * 6; if (x === -400) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
          ctx.stroke(); ctx.restore();
        }
        if (X.ink > 0.01) {
          ctx.save();
          ctx.fillStyle = `rgba(14,22,44,${0.22 * X.ink})`; ctx.fillRect(-400, HZ, 1800, 600);
          ctx.lineCap = 'round';
          for (let i = 0; i < 16; i++) {
            const y0 = HZ + 18 + H(i, 611) * 360, len = X.ink * (900 + H(i, 612) * 600), x0 = -260 + H(i, 613) * 200;
            ctx.strokeStyle = `rgba(14,20,40,${0.55 + 0.3 * H(i, 614)})`; ctx.lineWidth = 3 + H(i, 615) * 6 + (y0 - HZ) * 0.01;
            ctx.beginPath();
            for (let x = x0; x <= x0 + len; x += 18) { const yy = y0 + Math.sin(x * 0.014 + t * 0.9 + i) * (8 + (y0 - HZ) * 0.03); if (x === x0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
            ctx.stroke();
          }
          ctx.restore();
        }
        // a distant sail
        const bx = 180 + ((t * 5) % 700);
        ctx.fillStyle = '#5b6f80'; ctx.beginPath(); ctx.moveTo(bx - 16, HZ + 2); ctx.lineTo(bx + 16, HZ + 2); ctx.lineTo(bx + 11, HZ + 7); ctx.lineTo(bx - 11, HZ + 7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f6efe0'; ctx.beginPath(); ctx.moveTo(bx, HZ - 32); ctx.lineTo(bx + 14, HZ - 1); ctx.lineTo(bx - 4, HZ - 1); ctx.closePath(); ctx.fill();
        for (const w of P) {
          const a = pulseA(w.age); if (a < 0.02) continue;
          const k = wordKey(w), x = 60 + H(k, 1) * 840, y = HZ + 30 + H(k, 2) * 300, q = clamp(w.age / 1.8);
          ctx.save(); ctx.globalAlpha = (1 - q) * 0.7; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.ellipse(x, y, 10 + q * 70, 3 + q * 14, 0, 0, TAU); ctx.stroke(); ctx.restore();
          A.sparkle(ctx, x, y - 4, 7 + a * 8, a);
        }
      });
    },
  },

  mountains: {
    light: [720, 200],
    far: null,
    draw(ctx, t, T, c, P, X) {
      A.sky(ctx, SW, SH, '#c6dcea', '#f4efe2', '#dfe7ea');
      const far = peaks(41, 7, -200, 1160, 230, 330, 330, 470);
      withCam(ctx, par(c, 0.1), () => {
        A.glowDisc(ctx, 720, 200, 54, '#fffaf0', '#fff0c8', 230, 1, 0.55);
        A.cloud(ctx, (200 + t * 5) % 1250 - 180, 120, 0.8, 0.8);
      });
      withCam(ctx, par(c, 0.2), () => {
        A.mountains(ctx, far, 560, '#c4d0dd', '#adbccc');
        // snow caps
        ctx.fillStyle = '#f6f8fb';
        for (const p of far) { const ay = 560 - p.h, k = 0.2; ctx.beginPath(); ctx.moveTo(p.x, ay); ctx.lineTo(p.x + p.w * k * 0.5, ay + p.h * k); ctx.lineTo(p.x + p.w * 0.04, ay + p.h * k * 0.75); ctx.lineTo(p.x - p.w * 0.05, ay + p.h * k * 0.9); ctx.lineTo(p.x - p.w * k * 0.5, ay + p.h * k); ctx.closePath(); ctx.fill(); }
        for (const w of P) {
          const a = pulseA(w.age); if (a < 0.02) continue;
          const p = far[Math.floor(H(wordKey(w), 1) * far.length)];
          A.sparkle(ctx, p.x, 560 - p.h + 4, 9 + a * 10, a);
        }
      });
      withCam(ctx, par(c, 0.3), () => mistBand(ctx, 540 + Math.sin(t * 0.3) * 6, 50, 0.55));
      withCam(ctx, par(c, 0.45), () => A.mountains(ctx, peaks(43, 6, -260, 1220, 140, 220, 300, 420), 620, '#9fb0c0', '#8698aa'));
      withCam(ctx, par(c, 0.55), () => { mistBand(ctx, 610, 40, 0.5); for (let i = 0; i < 4; i++) A.dust(ctx, (i * 330 + t * 9) % 1300 - 160, 600 + H(i, 7) * 30, 140, 0.35, '#ffffff'); });
      for (let i = 0; i < 8; i++) A.bird(ctx, ((80 + H(i, 8) * 1100 + t * (12 + H(i, 10) * 10)) % 1400) - 220, 230 + H(i, 9) * 110, 0.55 + H(i, 11) * 0.3, t, i + 3);
      withCam(ctx, par(c, 0.75), () => A.mountains(ctx, peaks(47, 5, -300, 1260, 80, 150, 340, 480), 702, '#7f9786', '#667d6d'));
      withCam(ctx, c, () => {
        A.ground(ctx, -500, 1500, 690, 330, '#a9b27b', '#8d9762', 'rgba(255,255,255,0.12)', 17);
        for (let i = 0; i < 9; i++) A.grass(ctx, -80 + i * 140 + H(i, 11) * 60, 770 + H(i, 12) * 60, 1.0, t, i + 5, '#6f8a45', '#88a356');
        vegStrip(ctx, t, X, 730, 860, 17);
      });
    },
  },

  garden: {
    light: [780, 170],
    draw(ctx, t, T, c, P, X) {
      A.sky(ctx, SW, SH, '#bcdff0', '#f6f1dc', '#dcecec');
      withCam(ctx, par(c, 0.12), () => {
        A.glowDisc(ctx, 780, 170, 52, '#fffaea', '#fff0bf', 220, 1, 0.55);
        A.cloud(ctx, (140 + t * 6) % 1250 - 180, 120, 0.8, 0.9);
        A.cloud(ctx, (700 + t * 4) % 1250 - 180, 200, 0.55, 0.75);
      });
      withCam(ctx, par(c, 0.3), () => band(ctx, 560, 50, 51, '#bcd59c'));
      withCam(ctx, par(c, 0.5), () => { band(ctx, 600, 40, 53, '#a6c682'); palmSil(ctx, 120, 612, 0.38, t, '#8fb06e', 4); palmSil(ctx, 860, 606, 0.34, t, '#8fb06e', 5); });
      withCam(ctx, c, () => {
        A.ground(ctx, -500, 1500, 640, 400, '#9cc06e', '#82a95a', 'rgba(255,255,255,0.10)', 19);
        // river from the horizon to the foreground
        const g = ctx.createLinearGradient(0, 640, 0, SH);
        g.addColorStop(0, '#9ad6ec'); g.addColorStop(1, '#3f93c4');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(470, 640); ctx.bezierCurveTo(440, 700, 600, 760, 520, SH + 40); ctx.lineTo(820, SH + 40); ctx.bezierCurveTo(760, 760, 520, 700, 520, 640); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (let i = 0; i < 14; i++) {
          const y = 650 + ((i * 19 + t * 22) % 240), x = 470 + (y - 640) * 0.55 + H(i, 3) * 120;
          ctx.globalAlpha = 0.5 * Math.sin(Math.PI * clamp((y - 640) / 240));
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 26 + (y - 640) * 0.15, y + 2); ctx.stroke();
        }
        ctx.restore();
        for (const w of P) {
          const a = pulseA(w.age); if (a < 0.02) continue;
          const k = wordKey(w), y = 660 + H(k, 2) * 180, x = 500 + (y - 640) * 0.6 + (H(k, 1) - 0.5) * 60;
          A.sparkle(ctx, x, y, 7 + a * 8, a);
        }
        const dry = Math.max(0, -X.veg);
        palmC(ctx, 80, 720, 0.82, t, 1, 0.1, dry); palmC(ctx, 240, 668, 0.56, t, 2, 0.14, dry);
        palmC(ctx, 880, 712, 0.86, t, 3, -0.08, dry); palmC(ctx, 735, 662, 0.52, t, 4, -0.12, dry);
        vegStrip(ctx, t, X, 720, 860, 19);
        const FL = ['#f2c25b', '#e8738a', '#ffffff', '#c58be0'];
        for (let i = 0; i < 16; i++) {
          const x = H(i, 21) < 0.5 ? 20 + H(i, 22) * 380 : 600 + H(i, 22) * 340, y = 700 + H(i, 23) * 150;
          const dw = Math.max(0, -X.veg);
          A.grass(ctx, x, y, 0.8, t, i + 40, mixHex('#5c9a3e', '#9a8048', dw), mixHex('#7cb850', '#b39a5e', dw));
          if (dw < 0.6) { ctx.fillStyle = FL[i % 4]; ctx.globalAlpha = 1 - dw / 0.6; ctx.beginPath(); ctx.arc(x + 8, y - 30, 4.5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
        }
      });
    },
  },

  rain: {
    light: [700, 130],
    draw(ctx, t, T, c, P, X) {
      const [s, e] = win(T);
      const g = clamp(Math.max(ease.inOutSine(prog(t, s, e)) * (0.4 + 0.6 * X.rain), X.veg) * (1 - Math.max(0, -X.veg)));
      A.sky(ctx, SW, SH, mixHex('#a9c8e0', '#7b8ca2', X.rain), mixHex('#f4f0e4', '#d6dcde', X.rain), mixHex('#d4e2ea', '#a9b5c1', X.rain));
      withCam(ctx, par(c, 0.1), () => {
        A.glowDisc(ctx, 700, 130, 1, 'rgba(0,0,0,0)', '#fff4d8', 200, 0.6 + 0.3 * g, 0.5);
        for (let i = 0; i < 6; i++) cloudSolid(ctx, (i * 230 + t * (4 + i)) % 1400 - 220, 70 + (i % 3) * 55, 1.3 - (i % 3) * 0.2, 0.35 + 0.6 * X.rain, i % 2 ? mixHex('#d8dee6', '#8b98aa', X.rain) : mixHex('#e6ebf0', '#9ba7b6', X.rain));
      });
      withCam(ctx, par(c, 0.3), () => band(ctx, 560, 40, 61, mixHex('#a9b19c', '#9fbf8a', g)));
      withCam(ctx, par(c, 0.55), () => band(ctx, 610, 36, 63, mixHex('#979f86', '#88ad6e', g)));
      withCam(ctx, c, () => {
        A.ground(ctx, -500, 1500, 660, 400, mixHex('#a49372', '#90b067', g), mixHex('#8d7d5f', '#789d55', g), 'rgba(255,255,255,0.08)', 23);
        const PUD = [[200, 730, 90], [620, 790, 120], [820, 715, 70], [420, 700, 60]];
        for (const [x, y, r] of PUD) { ctx.fillStyle = 'rgba(160,190,210,0.75)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.22, 0, 0, TAU); ctx.fill(); }
        for (const w of P) {
          const q = clamp(w.age / 1.6); if (q >= 1) continue;
          const [x, y, r] = PUD[Math.floor(H(wordKey(w), 1) * PUD.length)];
          ctx.save(); ctx.globalAlpha = 0.85 * (1 - q); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(x, y, 6 + q * r * 0.8, (6 + q * r * 0.8) * 0.22, 0, 0, TAU); ctx.stroke(); ctx.restore();
        }
        const N = 26;
        for (let i = 0; i < N; i++) {
          const k = ease.outBack(clamp((g * 1.15 - (i / N) * 0.85) / 0.3));
          if (k > 0.01) A.grass(ctx, -40 + H(i, 31) * 1040, 690 + H(i, 32) * 170, 0.9 * k, t, i + 60);
        }
      });
      withCam(ctx, c, () => vegStrip(ctx, t, { veg: Math.min(0, X.veg) }, 720, 860, 23));
      // rain streaks
      ctx.save();
      ctx.strokeStyle = 'rgba(236,243,250,0.55)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < Math.round(130 * X.rain); i++) {
        const sp = 820 * (0.8 + H(i, 41) * 0.4);
        const y = ((H(i, 42) * 1000 + t * sp) % 1000) - 80, x = ((H(i, 43) * 1100 - t * 90 - y * 0.18) % 1100 + 1100) % 1100 - 70;
        ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 30);
      }
      ctx.stroke();
      ctx.restore();
    },
  },

  geometric: {
    light: [480, 435],
    draw(ctx, t, T, c, P, X) {
      const g = ctx.createLinearGradient(0, 0, 0, SH);
      g.addColorStop(0, '#1c2849'); g.addColorStop(1, '#2b3c6b');
      ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
      let pulse = 0;
      for (const w of P) pulse = Math.max(pulse, pulseA(w.age));
      A.glowDisc(ctx, 480, 435, 1, 'rgba(0,0,0,0)', '#e9c27a', 520, 0.55 + 0.25 * pulse, 0.45);
      const d = 150, rot = t * 0.018 + X.turns * Math.PI / 8, z = c.z;
      // khatam: two overlapping squares -> 8 outer points (every 45 deg) and 8 inner corners (radius 0.7654 R)
      const star = (x, y, R) => {
        const r = R * 0.7654;
        for (let k = 0; k < 16; k++) {
          const a = (k * Math.PI) / 8, rr = k % 2 ? r : R;
          if (k === 0) ctx.moveTo(x + rr, y); else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath();
      };
      ctx.save();
      ctx.translate(480, 435); ctx.scale(z, z); ctx.rotate(rot);
      // tiles lit by recited words
      for (const w of P) {
        const a = pulseA(w.age); if (a < 0.02) continue;
        const k = wordKey(w), i = Math.floor(H(k, 1) * 5) - 2, j = Math.floor(H(k, 2) * 5) - 2;
        ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#f0c96a';
        ctx.beginPath(); star(i * d, j * d, d * 0.5); ctx.fill();
      }
      for (let r = 1; r <= Math.ceil(X.turns) && r <= 4; r++) {
        const k = clamp(X.turns - (r - 1));
        const fresh = X.turns - (r - 1) < 1.6 ? 1 : 0.45;
        ctx.globalAlpha = 0.42 * k * fresh; ctx.fillStyle = '#f0c96a';
        ctx.beginPath();
        for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) if (Math.max(Math.abs(i), Math.abs(j)) === r) star(i * d, j * d, d * 0.5);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) star(i * d, j * d, d * 0.5);
      ctx.fillStyle = 'rgba(255,240,210,0.035)'; ctx.fill();
      ctx.strokeStyle = 'rgba(212,169,85,0.62)'; ctx.lineWidth = 3.2; ctx.stroke();
      ctx.beginPath();
      for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) star(i * d, j * d, d * 0.3);
      ctx.strokeStyle = 'rgba(212,169,85,0.32)'; ctx.lineWidth = 2; ctx.stroke();
      // small diamonds between the stars
      ctx.beginPath();
      for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
        const x = (i + 0.5) * d, y = (j + 0.5) * d, q = d * 0.13;
        ctx.moveTo(x, y - q); ctx.lineTo(x + q, y); ctx.lineTo(x, y + q); ctx.lineTo(x - q, y); ctx.closePath();
      }
      ctx.fillStyle = 'rgba(212,169,85,0.28)'; ctx.fill();
      ctx.restore();
      // central emblem
      A.octagram(ctx, 480, 435, 120 * z, '#e9bf62', 0.95, rot, 0.10 + 0.08 * pulse, 5);
      A.octagram(ctx, 480, 435, 70 * z, '#f6dc9a', 0.85, rot + Math.PI / 8, 0.08, 3);
      ctx.save(); ctx.strokeStyle = rgba('#e9bf62', 0.55); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(480, 435, 168 * z, 0, TAU); ctx.stroke(); ctx.restore();
      motes(ctx, 26, 71, t, 0, SW, 0, SH, 14, '#f6dc9a', 0.55, 2.4);
      // vignette
      const v = ctx.createRadialGradient(480, 435, 300, 480, 435, 760);
      v.addColorStop(0, 'rgba(10,14,30,0)'); v.addColorStop(1, 'rgba(10,14,30,0.45)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, SW, SH);
    },
  },

  light: {
    light: [480, 40],
    draw(ctx, t, T, c, P, X) {
      const bg = ctx.createRadialGradient(480, -60, 40, 480, -60, 1150);
      bg.addColorStop(0, '#fffaf0'); bg.addColorStop(0.4, '#f6e2b8'); bg.addColorStop(1, '#dcae6c');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, SW, SH);
      const beams = 11;
      const lit = new Map();
      for (const w of P) { const b = Math.floor(H(wordKey(w), 1) * beams); lit.set(b, Math.max(lit.get(b) || 0, pulseA(w.age))); }
      withCam(ctx, par(c, 0.3), () => {
        ctx.save();
        for (let i = 0; i < beams; i++) {
          const a = Math.PI / 2 + (i - (beams - 1) / 2) * 0.115 + Math.sin(t * 0.18 + i * 0.7) * 0.02;
          const wA = 0.028 + H(i, 5) * 0.02;
          const g = ctx.createLinearGradient(480, -160, 480 + Math.cos(a) * 1100, -160 + Math.sin(a) * 1100);
          const b = 0.42 + 0.16 * Math.sin(t * 0.5 + i * 1.3) + 0.4 * (lit.get(i) || 0) + 0.35 * X.lightUp;
          g.addColorStop(0, `rgba(255,255,255,${b})`); g.addColorStop(0.7, `rgba(255,236,190,${b * 0.25})`); g.addColorStop(1, 'rgba(255,236,190,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(480, -160);
          ctx.lineTo(480 + Math.cos(a - wA) * 1100, -160 + Math.sin(a - wA) * 1100); ctx.lineTo(480 + Math.cos(a + wA) * 1100, -160 + Math.sin(a + wA) * 1100);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        A.glowDisc(ctx, 480, 40, 1, 'rgba(0,0,0,0)', '#fffaf0', 300, 1, 0.9);
      });
      motes(ctx, 50, 81, t, 20, SW - 20, 120, SH, 18, '#fff4d6', 0.9, 4.2);
      motes(ctx, 24, 83, t, 20, SW - 20, 200, SH, 11, '#c98f2e', 0.5, 3);
      for (const w of P) {
        const a = pulseA(w.age); if (a < 0.02) continue;
        const k = wordKey(w);
        A.sparkle(ctx, 120 + H(k, 2) * 720, 180 + H(k, 3) * 420 - w.age * 30, 6 + a * 8, a, '#fff6dc');
      }
      withCam(ctx, par(c, 0.7), () => {
        for (let i = 0; i < 7; i++) A.cloud(ctx, ((i * 190 + t * (3 + (i % 3))) % 1300) - 170, 780 + (i % 2) * 40, 1.25 + (i % 3) * 0.15, 0.95, i % 2 ? '#fffaf1' : '#f8eedb');
      });
    },
  },
};

// ================================================================ STAGE
const GY = 705;                                   // feet baseline of the actors
const PLACE_X = { left: 230, center: 480, right: 730 };
const HUMAN = new Set(['believers', 'people', 'disbelievers', 'soldiers', 'king', 'ruler', 'man', 'workers']);
const DROPS = { prophet: 'blue', angel: 'gold', honored: 'green' };
const PRAY_DO = { pray: 'stand', ruku: 'ruku', sujud: 'sujud', sit: 'julus', rise: 'stand' };
const DOOMED = new Set(['disbelievers', 'soldiers', 'king']);   // fade under destructive events
const DESTRUCTIVE = ['blast', 'stones', 'quake', 'flood', 'storm', 'lightning'];

const TIMES = {
  day:   { top: '#9fd0ea', mid: '#cfe6ee', bot: '#f6ecd6', sun: [760, 170, 170], sunR: 54, core: '#fff8e6', glow: '#ffe7a8', stars: 0, tint: null },
  dawn:  { top: '#f2b98a', mid: '#f8cfa0', bot: '#fde6c2', sun: [700, 600, 440], sunR: 66, core: '#fff3d4', glow: '#ffcf86', stars: 0, tint: null },
  dusk:  { top: '#b95562', mid: '#de7f74', bot: '#f2a77d', sun: [250, 430, 575], sunR: 64, core: '#ffe2b0', glow: '#ff9a5a', stars: 0.25, tint: ['#ffb08a', 0.16] },
  night: { top: '#121838', mid: '#1d2552', bot: '#2b3570', moon: [740, 160, 40], stars: 1, tint: ['#4a5aa6', 0.66] },
};

const BELIEVERS = [['#f1ece0', '#b49a64', '#ffffff'], ['#dde8de', '#6f8f78', '#ffffff'], ['#e6e0ef', '#857aa0', '#fbf8f0'],
  ['#efe1c9', '#a5844f', '#ffffff'], ['#d9e4ea', '#5d7f95', '#fbf8f0']];
const DISBELIEVERS = [['#5a3b3b', '#2e1d1d'], ['#4a4f5c', '#262a33'], ['#6b4a2e', '#3a2817'], ['#3f3a52', '#211e2e'],
  ['#6a2f2f', '#3a1717'], ['#4f5a4a', '#2a3226']];

function labelLines(s) {
  s = String(s || '').trim();
  if (!s) return null;
  const m = s.match(/^(.+?)\s+((?:عليه|عليها|عليهم|عليهما)\s+السلام)$/);
  if (m) return [m[1], m[2]];
  if (s.length > 7 && s.includes(' ')) { const w = s.split(' '), k = Math.max(1, Math.floor(w.length / 2)); return [w.slice(0, k).join(' '), w.slice(k).join(' ')]; }
  return [s];
}

// ---- layout (cached per params) ----
const LAYOUT = new Map();
const WIDTH = { ship: 300, camel: 190, dog: 150, fish: 90, rock: 230, wall: 290, sleepers: 470, barrier: 0 };
function layout(P) {
  const key = JSON.stringify([P.actors, P.setting, P.time]);
  if (LAYOUT.has(key)) return LAYOUT.get(key);
  const actors = arr(P.actors).slice(0, 5).map((a, idx) => ({
    id: String(a?.id ?? `a${idx + 1}`), type: a?.type, place: PLACE_X[a?.place] != null ? a.place : 'center',
    count: a?.type === 'sleepers' ? 1 : clamp(Math.round(Number(a?.count) || 1), 1, 12), pose: a?.pose || 'stand',
    enter: a?.enter ?? null, exit: a?.exit ?? null, look: a?.look || 'plain', uncountable: !!a?.uncountable,
    label: labelLines(a?.label), rawLabel: String(a?.label || ''), idx,
  }));
  for (const a of actors) {
    if (HUMAN.has(a.type) && a.uncountable) a.w0 = 340;
    else if (HUMAN.has(a.type)) a.w0 = a.pose === 'sleep' ? Math.min(a.count, 6) * 100 + 20 : Math.min(a.count, 6) * 50 + 30;
    else if (a.type === 'angel') a.w0 = 110 + Math.min(a.count - 1, 4) * 60;
    else a.w0 = WIDTH[a.type] ?? 120;
  }
  const ground = actors.filter((a) => a.type !== 'birds' && a.type !== 'barrier');
  // word refs compare in reading order, so time overlap needs no timeline: [enter, exit) per actor
  const rk = (r) => (Array.isArray(r) && r.length >= 2 ? Number(r[0]) * 1000 + Number(r[1]) : null);
  const span = (a) => [rk(a.enter) ?? -Infinity, rk(a.exit) ?? Infinity];
  const overlap = (a, b) => { const [a0, a1] = span(a), [b0, b1] = span(b); return a0 < b1 && b0 < a1; };
  const slots = [];
  for (const pl of Object.keys(PLACE_X)) {
    const here = [];
    for (const a of ground.filter((g) => g.place === pl)) {
      const slot = here.find((sl) => sl.actors.every((o) => !overlap(o, a)));
      if (slot) { slot.actors.push(a); slot.w0 = Math.max(slot.w0, a.w0); a.inPlace = true; }
      else here.push({ actors: [a], w0: a.w0, place: pl, idx: a.idx, ship: a.type === 'ship' });
    }
    const total = here.reduce((s, sl) => s + sl.w0, 0) + 20 * Math.max(0, here.length - 1);
    let x = PLACE_X[pl] - total / 2;
    here.forEach((sl) => { sl.x = x + sl.w0 / 2; sl.w = sl.w0; x += sl.w0 + 20; });
    slots.push(...here);
  }
  for (const a of actors) a.squeeze = 1;
  const water = SETTINGS[P.setting]?.sea || SETTINGS[P.setting]?.river || SETTINGS[P.setting]?.junction;
  const line = slots.filter((sl) => !(water && sl.ship)).sort((a, b) => a.x - b.x || a.idx - b.idx);
  if (line.length) {
    const minX = 40, maxX = 920, gap = 16;
    const total = line.reduce((s, a) => s + a.w, 0) + gap * (line.length - 1);
    const f = total > maxX - minX ? (maxX - minX) / total : 1;
    for (const a of line) { a.w *= f; a.squeeze = f; }
    for (let i = 1; i < line.length; i++) { const lo = line[i - 1].x + line[i - 1].w / 2 + gap * f + line[i].w / 2; if (line[i].x < lo) line[i].x = lo; }
    const last = line[line.length - 1];
    if (last.x + last.w / 2 > maxX) last.x = maxX - last.w / 2;
    for (let i = line.length - 2; i >= 0; i--) { const hi = line[i + 1].x - line[i + 1].w / 2 - gap * f - line[i].w / 2; if (line[i].x > hi) line[i].x = hi; }
    const over = minX - (line[0].x - line[0].w / 2);
    if (over > 0) for (const a of line) a.x += over;
  }
  for (const sl of slots) for (const a of sl.actors) { a.x = sl.x; a.w = Math.min(sl.w, a.w0 * (sl.squeeze || 1)); a.squeeze = sl.squeeze || 1; }
  for (const a of actors.filter((b) => b.type === 'birds')) { a.x = PLACE_X[a.place]; a.w = 260; }
  for (const a of actors.filter((b) => b.type === 'barrier')) { a.x = 480; a.w = 0; }
  const out = { actors, setting: SETTINGS[P.setting] ? P.setting : 'desert', time: TIMES[P.time] ? P.time : 'day' };
  if (LAYOUT.size > 200) LAYOUT.clear();
  LAYOUT.set(key, out);
  return out;
}

const DONE_AT_START = new Set(['wall_repair', 'barrier_build', 'wither', 'wake', 'ship_hole', 'fish_escape', 'sea_part', 'ruin', 'growth', 'flood']);
function events(P, t, T) {
  const [s] = win(T);
  const st = {};
  const first = Number.isFinite(T?.words?.[0]?.s) ? T.words[0].s : s;
  for (const ev of (Array.isArray(P.events) ? P.events : []).slice(0, 4)) {
    if (!ev || !ev.type) continue;
    const t0 = refT(T, ev.at, s), t1 = ev.until ? refT(T, ev.until, BIG) : BIG;
    if (st[ev.type] && t0 >= st[ev.type].t0) continue;
    if (DONE_AT_START.has(ev.type) && t0 <= first + 0.05) st[ev.type] = { t0: s - 1000, t1: Math.max(t1, s + 0.5), done: true };
    else st[ev.type] = { t0, t1: Math.max(t1, t0 + 0.5) };
  }
  const k = (type, inD = 0.8, outD = 0.8) => (st[type] ? env(t, st[type].t0, st[type].t1, inD, outD) : 0);
  const dt = (type) => (st[type] ? t - st[type].t0 : -BIG);
  return { st, k, dt };
}

// ---- camera (beats + automatic recomposition) ----
const STATIC = new Set(['ship', 'rock', 'wall', 'barrier', 'fish', 'sleepers', 'birds']);
function targetX(to, a, L) {
  if (PLACE_X[to] != null) {
    // stop beside whoever already stands at that place instead of walking into them
    const px = PLACE_X[to];
    const occ = L.actors.find((o) => o !== a && o.type !== 'birds' && o.type !== 'barrier' && Math.abs(o.x - px) < (o.w || 100) / 2 + 40);
    if (!occ) return px;
    const side = a.x >= occ.x ? 1 : -1;
    return occ.x + side * ((occ.w || 100) / 2 + (a.w || 80) / 2 + 10);
  }
  const o = L.actors.find((x) => x.id === to && x !== a);
  return o ? o.x + (o.x > a.x ? -120 : 120) : a.x;
}
function headY(a, g) {
  if (DROPS[a.type]) return GY - 185 + (g ? g.sit * 20 + g.lie * 30 : 0);
  switch (a.type) {
    case 'birds': return 200;
    case 'ship': return 430;
    case 'camel': return GY - 200;
    case 'dog': return GY - 90;
    case 'fish': return GY - 60;
    case 'rock': return GY - 150;
    case 'wall': return GY - 200;
    case 'barrier': return 330;
    case 'sleepers': return GY - 90;
    default: return GY - (a.uncountable ? 170 : a.count > 6 ? 160 : 140) + (g ? g.sit * 30 + g.lie * 90 : 0);
  }
}
function stageFrame(b, tb, L, T, E, B) {
  switch (b.do) {
    case 'shot_sky': return { x: 480, y: 300, z: 1.12 };
    case 'shot_ground': return { x: 480, y: 560, z: 1.3 };
    // gentler pans: at 1.16 / ±150 px they cropped a drop's name label at the left or right place (Al-Hijr review)
    case 'pan_left': return { x: 375, y: 445, z: 1.11 };
    case 'pan_right': return { x: 585, y: 445, z: 1.11 };
    case 'push_in': return { x: 480, y: 470, z: 1.38 };
    case 'shot_close': {
      const a = L.actors.find((x) => x.id === b.who);
      if (a) { const st = actorState(a, tb, T, E, B, L); return { x: st.x, y: headY(a) + 90, z: 1.55 }; }
      if (b.who === 'sky') return { x: 480, y: 260, z: 1.3 };
      if (b.who === 'ground') return { x: 480, y: 620, z: 1.45 };
      return { x: 480, y: 450, z: 1.45 };
    }
    default: return { x: 480, y: 440, z: 1.0 };
  }
}
function stageCamera(t, T, P, L, E, B, pkey) {
  const autos = [() => ({ x: 430, y: 445, z: 1.07 }), () => ({ x: 530, y: 445, z: 1.07 }), () => ({ x: 480, y: 455, z: 1.14 }), () => ({ x: 480, y: 410, z: 1.05 })];
  for (const a of L.actors) if (a.type !== 'birds') autos.push((tt) => ({ x: actorState(a, tt, T, E, B, L).x, y: headY(a) + 120, z: 1.28 }));
  const keys = camKeys(P, T, B, (b, tb) => stageFrame(b, tb, L, T, E, B), autos, pkey);
  const f = camAt(keys, t);
  const [s, e] = win(T);
  const p = ease.inOutSine(prog(t, s - 0.4, e + 0.4));
  const c = clampCam({ x: f.x + Math.sin(t * 0.21) * 7, y: f.y + Math.sin(t * 0.17 + 1) * 3, z: f.z * (1 + 0.045 * p) }, 1.0, 1.8, -110, 1070, 230, 905);
  let amp = 0;
  const db = E.dt('blast'); if (db > 0) amp += 18 * Math.exp(-db * 3.2);
  const dq = E.dt('quake'); if (dq > 0) amp += 11 * env(dq, 0, 3.2, 0.2, 1.4) + 2.5 * E.k('quake');
  return { x: c.x + Math.sin(t * 61) * amp, y: c.y + Math.cos(t * 47) * amp, z: c.z };
}

// ---- actor motion and gestures ----
function poseMotion(a, t, T) {
  const [s, e] = win(T);
  const te = a.enter ? refT(T, a.enter, s) : -BIG;
  const dir = a.place === 'right' ? -1 : 1;
  const away = a.place === 'left' ? -1 : a.place === 'right' ? 1 : (H(a.idx, 77) > 0.5 ? 1 : -1);
  const tStart = Math.max(s, te > -BIG ? te : s);
  let dx = 0, moving = 0, speed = 7, lean = 0, flip = false;
  if (STATIC.has(a.type)) return { dx, moving, speed, lean, flip, dir, away, te };
  if (a.pose === 'walk') {
    const dur = clamp((e - tStart) * 0.7, 2, 8);
    const p = prog(t, tStart, tStart + dur);
    dx = -dir * 190 * (1 - ease.inOutSine(p)); moving = p > 0 && p < 1 ? 1 : 0; flip = dir < 0;
  } else if (a.pose === 'flee') {
    const d = Math.max(0, t - tStart - 0.3);
    dx = away * 75 * d; moving = 1; speed = 11; lean = away * 0.12; flip = away < 0;
  }
  return { dx, moving, speed, lean, flip, dir, away, te };
}
function actorState(a, t, T, E, B, L) {
  const pm = poseMotion(a, t, T);
  const tx = a.exit ? refT(T, a.exit, BIG) : BIG;
  const ain = pm.te > -BIG ? ease.outCubic(prog(t, pm.te, pm.te + 0.7)) : 1;
  const aout = 1 - ease.inCubic(prog(t, tx, tx + 0.7));
  let x = a.x + pm.dx + (1 - ain) * (a.pose === 'flee' || STATIC.has(a.type) || a.inPlace ? 0 : -pm.dir * 70);
  let { moving, speed, lean, flip } = pm;
  const W = B ? B.filter((b) => b.do === 'walk_to' && b.who === a.id) : [];
  if (W.length && t >= W[0].t && !STATIC.has(a.type)) {
    let cx = a.x + poseMotion(a, W[0].t, T).dx;
    for (let i = 0; i < W.length; i++) {
      const w = W[i];
      if (w.t > t) break;
      const tgt = clamp(targetX(w.to, a, L), 60, 900), dur = clamp(Math.abs(tgt - cx) / 110, 0.8, 6);
      const tEnd = i + 1 < W.length && W[i + 1].t <= t ? W[i + 1].t : t;
      const p = prog(tEnd, w.t, w.t + dur);
      if (tEnd === t) { moving = p > 0 && p < 1 ? 1 : 0; if (Math.abs(tgt - cx) > 2) flip = tgt < cx; speed = 7; lean = 0; }
      cx = lerp(cx, tgt, ease.inOutSine(p));
    }
    x = cx;
  }
  if (!STATIC.has(a.type) && !a.inPlace) x += (1 - aout) * pm.away * 90;
  let doom = 0, alarm = 0;
  for (const ty of DESTRUCTIVE) {
    if (!E.st[ty]) continue;
    const k = ease.inOutSine(prog(t, E.st[ty].t0 + (ty === 'flood' ? 1.5 : 0.4), E.st[ty].t0 + (ty === 'flood' ? 5 : 2.4)));
    alarm = Math.max(alarm, env(t, E.st[ty].t0, E.st[ty].t1, 0.3, 0.6));
    if (DOOMED.has(a.type) && ty !== 'storm' && ty !== 'lightning') doom = Math.max(doom, k);
  }
  return { x, alpha: ain * aout, moving, speed, lean, flip, doom, alarm, sink: DOOMED.has(a.type) ? E.k('quake') * 30 * doom : 0 };
}
function gest(a, t, B, L, x) {
  const g = { sx: 1, back: false, raise: 0, bow: 0, shake: 0, look: 0, wring: 0, glow: 0, speak: -1, point: 0, pdir: 1, pointAge: -1, pointTx: x };
  let turns = 0;
  const Bw = [];
  for (const b of B) {
    if (b.who !== a.id) continue;
    Bw.push(b);
    if (b.t > t) continue;
    const age = t - b.t;
    switch (b.do) {
      case 'turn': if (age >= 0.2) turns++; if (age < 0.4) g.sx = Math.max(0.1, Math.abs(1 - age / 0.2)); break;
      case 'point': { const k = env(t, b.t, b.t + 1.8, 0.3, 0.45); const tx = targetX(b.to, a, L); if (age < 1.8) { g.pointAge = age; g.pointTx = tx; } if (k >= g.point && k > 0) { g.point = k; g.pdir = Math.abs(tx - x) < 4 ? 1 : Math.sign(tx - x); } break; }
      case 'raise_hands': g.raise = Math.max(g.raise, env(t, b.t, b.t + 2.0, 0.35, 0.55)); break;
      case 'bow': g.bow = Math.max(g.bow, env(t, b.t, b.t + 2.0, 0.4, 0.55)); break;
      case 'speak': if (age < 1.6) g.speak = age; break;
      case 'shake_head': g.shake = Math.max(g.shake, env(t, b.t, b.t + 1.3, 0.12, 0.3)); break;
      case 'look_up': g.look = Math.max(g.look, env(t, b.t, b.t + 2.0, 0.4, 0.55)); break;
      case 'wring_hands': g.wring = Math.max(g.wring, env(t, b.t, b.t + 2.0, 0.3, 0.45)); break;
      case 'glow': g.glow = Math.max(g.glow, env(t, b.t, b.t + 2.0, 0.4, 0.6)); break;
      case 'read': g.read = Math.max(g.read || 0, env(t, b.t, b.t + 3.6, 0.4, 0.5)); break;
      case 'give': {
        const k = env(t, b.t, b.t + 2.0, 0.3, 0.5);
        const o = L.actors.find((q) => q.id === b.to && q !== a);
        const tx = o ? o.x : targetX(b.to, a, L);
        if (age < 2.2) { g.giveAge = age; g.giveTx = tx; }
        if (k > (g.give || 0)) { g.give = k; g.gdir = Math.abs(tx - x) < 4 ? 1 : Math.sign(tx - x); }
        break;
      }
      default: break;
    }
  }
  // prayer: 'pray' stands with folded hands (side view), then 'ruku', 'sujud', 'sit' (julus) and 'rise' change the
  // posture; 'stand_up' or 'walk_to' ends the prayer
  let pOn = -1, pOff = -1, pose = 'stand', prev = 'stand', pT = -BIG;
  for (const b of Bw) {
    if (b.t > t) break;
    if (PRAY_DO[b.do] && (b.do !== 'sit' || pOn > pOff)) {
      if (pOn <= pOff) { pOn = b.t; prev = PRAY_DO[b.do]; } else prev = pose;
      pose = PRAY_DO[b.do]; pT = b.t;
    } else if ((b.do === 'stand_up' || b.do === 'walk_to') && pOn > pOff) pOff = b.t;
  }
  g.pray = pOn < 0 ? 0 : pOn > pOff ? ease.inOutSine(prog(t, pOn, pOn + 0.5)) : 1 - ease.inOutSine(prog(t, pOff, pOff + 0.5));
  g.pFrom = prev; g.pTo = pose; g.pU = prog(t, pT, pT + (pose === 'sujud' ? 1.1 : 0.75));
  g.back = turns % 2 === 1;
  g.sit = rampState(Bw, t, a.pose === 'sit' ? 1 : 0, { sit: 1, stand_up: 0, walk_to: 0 }, 0.7);
  g.lie = rampState(Bw, t, a.pose === 'sleep' ? 1 : 0, { stand_up: 0, sit: 0, walk_to: 0 }, 0.9);
  return g;
}

// draw `fn` into an offscreen layer and let both ends dissolve to transparent (no countable edge, no dark box)
const FADE = { cv: null, cx: null };
function fadeEnds(ctx, xc, halfW, fade, fn) {
  const W = ctx.canvas?.width || SW, Hh = ctx.canvas?.height || SH;
  if (!FADE.cv || FADE.cv.width !== W || FADE.cv.height !== Hh) { FADE.cv = new OffscreenCanvas(W, Hh); FADE.cx = FADE.cv.getContext('2d'); }
  const o = FADE.cx;
  o.setTransform(1, 0, 0, 1, 0, 0); o.globalAlpha = 1; o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, W, Hh);
  o.setTransform(ctx.getTransform());
  fn(o);
  o.globalCompositeOperation = 'destination-in'; o.globalAlpha = 1;
  const g = o.createLinearGradient(xc - halfW, 0, xc + halfW, 0), f = clamp(fade / (2 * halfW), 0.01, 0.49);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(f, 'rgba(0,0,0,1)'); g.addColorStop(1 - f, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  o.fillStyle = g; o.fillRect(xc - halfW - 1, -3000, 2 * halfW + 2, 6000);
  o.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(FADE.cv, 0, 0); ctx.restore();
}

// ---- figure kit (faceless) ----
// person seen from the front; per-arm angles, sitting, head gestures and accessories
function fig(ctx, x, y, s, o = {}) {
  const robe = o.robe ?? '#c0504d', belt = o.belt ?? '#7a2f2f', scarf = o.scarf ?? '#ffffff', skin = o.skin ?? '#e7b98f';
  const walk = o.walk ?? 0, ph = o.phase ?? 0, sit = clamp(o.sit ?? 0);
  const step = Math.sin(ph) * (1 - sit);
  ctx.save();
  ctx.translate(x, y - Math.abs(step) * 4 * s * walk - (o.bob ?? 0) * s);
  ctx.rotate(o.lean ?? 0);
  ctx.scale(s * (o.flip ? -1 : 1) * (o.sx ?? 1), s);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  const sy = sit * 30;
  ctx.fillStyle = 'rgba(40,25,10,0.18)'; ctx.beginPath(); ctx.ellipse(0, 0, 30 + sit * 14, 6, 0, 0, TAU); ctx.fill();
  if (sit < 0.6) {
    const fa = 1 - sit / 0.6;
    ctx.save(); ctx.globalAlpha *= fa; ctx.fillStyle = '#3b2a22';
    ctx.beginPath(); ctx.ellipse(-10 + step * 7 * walk, -3, 10, 5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10 - step * 7 * walk, -3, 10, 5, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  if (o.bundle) {
    ctx.strokeStyle = '#6b4424'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(16, -78 + sy); ctx.lineTo(-30, -122 + sy); ctx.stroke();
    ctx.fillStyle = '#c9a46a'; ctx.beginPath(); ctx.ellipse(-32, -110 + sy, 18, 15, 0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#a8844a'; ctx.beginPath(); ctx.ellipse(-28, -102 + sy, 12, 6, 0.3, 0, TAU); ctx.fill();
  }
  const armA = (side) => { const v = side < 0 ? o.armL : o.armR; return v ?? 0.18 + Math.sin(ph) * 0.12 * walk * side; };
  const drawArm = (side) => {
    const a = armA(side);
    ctx.strokeStyle = A.shade(robe, -0.12); ctx.lineWidth = 13; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(side * 18, -76 + sy); ctx.lineTo(side * (18 + Math.sin(a) * 26), -76 + sy + Math.cos(a) * 30); ctx.stroke();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(side * (18 + Math.sin(a) * 31), -76 + sy + Math.cos(a) * 35, 6, 0, TAU); ctx.fill();
  };
  if (!o.wring) { drawArm(-1); drawArm(1); }
  if (o.cape) {
    ctx.fillStyle = o.cape;
    ctx.beginPath(); ctx.moveTo(-22, -80 + sy); ctx.quadraticCurveTo(-46, -30, -40, -2); ctx.lineTo(40, -2); ctx.quadraticCurveTo(46, -30, 22, -80 + sy); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = robe;
  ctx.beginPath(); ctx.moveTo(-27, -4); ctx.lineTo(-21, -76 + sy); ctx.quadraticCurveTo(0, -90 + sy, 21, -76 + sy); ctx.lineTo(27, -4); ctx.quadraticCurveTo(0, 2, -27, -4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = A.shade(robe, -0.18);
  ctx.beginPath(); ctx.moveTo(-26.4, -12); ctx.lineTo(26.4, -12); ctx.lineTo(27, -4); ctx.quadraticCurveTo(0, 2, -27, -4); ctx.closePath(); ctx.fill();
  if (sit > 0.01) { ctx.fillStyle = A.shade(robe, -0.06); ctx.beginPath(); ctx.ellipse(0, -9, 26 + 18 * sit, 3 + 9 * sit, 0, 0, TAU); ctx.fill(); }
  if (o.patches) {
    ctx.fillStyle = A.shade(robe, -0.2); ctx.fillRect(-16, -40 + sy * 0.5, 11, 10); ctx.fillStyle = A.shade(robe, 0.18); ctx.fillRect(7, -26, 12, 9);
    ctx.strokeStyle = 'rgba(60,45,30,0.5)'; ctx.lineWidth = 1.2; ctx.setLineDash([2, 2]); ctx.strokeRect(-16, -40 + sy * 0.5, 11, 10); ctx.strokeRect(7, -26, 12, 9); ctx.setLineDash([]);
  }
  if (o.trim) {
    // hem and neckline only: a vertical band crossed by the belt reads as a cross (Al-Hijr picture review)
    ctx.fillStyle = o.trim; ctx.fillRect(-26.5, -17, 53, 4);
    ctx.beginPath(); ctx.moveTo(-12, -82 + sy); ctx.quadraticCurveTo(0, -72 + sy, 12, -82 + sy); ctx.lineWidth = 3; ctx.strokeStyle = o.trim; ctx.stroke();
  }
  ctx.fillStyle = belt; ctx.fillRect(-23.5, -48 + sy * 0.55, 47, 9);
  // head
  const hy = -100 + sy + (o.headDy ?? 0);
  ctx.save(); ctx.translate(o.headDx ?? 0, 0);
  if (o.nemes) {
    ctx.fillStyle = '#e8b13c';
    ctx.beginPath(); ctx.moveTo(-31, -64 + sy); ctx.lineTo(-23, hy - 20); ctx.quadraticCurveTo(0, hy - 36, 23, hy - 20); ctx.lineTo(31, -64 + sy);
    ctx.quadraticCurveTo(0, -58 + sy, -31, -64 + sy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2f5fa8'; ctx.lineWidth = 4;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 8, hy - 27); ctx.lineTo(i * 14, -64 + sy); ctx.stroke(); }
    if (!o.back) { ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0, hy + 1, 11, 13.5, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#c99a2e'; ctx.beginPath(); ctx.arc(0, hy - 27, 5, 0, TAU); ctx.fill();
  } else if (o.helmet) {
    ctx.fillStyle = o.back ? '#7a5c33' : skin; ctx.beginPath(); ctx.arc(0, hy, 16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a6a3a';
    ctx.beginPath(); ctx.arc(0, hy - 2, 18.5, Math.PI, 0); ctx.lineTo(18.5, hy + 3); ctx.lineTo(-18.5, hy + 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b8893f'; ctx.fillRect(-19.5, hy, 39, 5);
    ctx.fillStyle = '#b8352a'; ctx.beginPath(); ctx.ellipse(0, hy - 23, 5, 9, 0, 0, TAU); ctx.fill();
  } else if (o.turban) {
    ctx.fillStyle = o.back ? '#6b4a32' : skin; ctx.beginPath(); ctx.arc(0, hy + 2, 15.5, 0, TAU); ctx.fill();
    if (o.beard && !o.back) { ctx.fillStyle = A.shade(skin, -0.45); ctx.beginPath(); ctx.ellipse(0, hy + 13, 11, 7, 0, 0, Math.PI); ctx.fill(); }
    ctx.fillStyle = '#fbf8f0';
    ctx.beginPath(); ctx.ellipse(0, hy - 10, 19, 13, 0, Math.PI * 0.92, Math.PI * 2.08); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, hy - 12, 16, 11, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(160,150,130,0.6)'; ctx.lineWidth = 1.6;
    for (const k of [-6, -1, 4]) { ctx.beginPath(); ctx.moveTo(-17, hy - 12 + k * 0.6); ctx.quadraticCurveTo(0, hy - 18 + k, 17, hy - 8 + k * 0.5); ctx.stroke(); }
    ctx.strokeStyle = o.turban; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, hy - 4, 18, 4.5, 0, 0, Math.PI); ctx.stroke();
  } else if (o.back) {
    ctx.fillStyle = scarf;
    ctx.beginPath(); ctx.moveTo(-22, -70 + sy); ctx.quadraticCurveTo(-26, hy - 22, 0, hy - 22); ctx.quadraticCurveTo(26, hy - 22, 22, -70 + sy); ctx.quadraticCurveTo(0, -64 + sy, -22, -70 + sy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.ellipse(0, hy - 13, 18, 4.5, 0, 0, TAU); ctx.stroke();
  } else if (o.woman) {
    ctx.fillStyle = scarf;
    ctx.beginPath(); ctx.moveTo(-27, -66 + sy); ctx.quadraticCurveTo(-30, hy - 26, 0, hy - 26); ctx.quadraticCurveTo(30, hy - 26, 27, -66 + sy); ctx.quadraticCurveTo(0, -58 + sy, -27, -66 + sy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0, hy + 1, 11, 13.5, 0, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, hy, 16, 0, TAU); ctx.fill();
    ctx.fillStyle = scarf;
    ctx.beginPath();
    ctx.moveTo(-22, -70 + sy); ctx.quadraticCurveTo(-26, hy - 22, 0, hy - 22); ctx.quadraticCurveTo(26, hy - 22, 22, -70 + sy);
    ctx.lineTo(14, -74 + sy); ctx.quadraticCurveTo(15, hy - 6, 0, hy - 12); ctx.quadraticCurveTo(-15, hy - 6, -14, -74 + sy); ctx.closePath(); ctx.fill();
    if (o.check) {
      ctx.strokeStyle = 'rgba(190,40,40,0.55)'; ctx.lineWidth = 1.6;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 6 - 6, hy - 20); ctx.lineTo(i * 6 + 6, -72 + sy); ctx.stroke(); }
    }
    ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.ellipse(0, hy - 13, 18, 4.5, 0, 0, TAU); ctx.stroke();
    if (o.beard) { ctx.fillStyle = A.shade(skin, -0.25); ctx.beginPath(); ctx.ellipse(0, hy + 12, 10, 6, 0, 0, Math.PI); ctx.fill(); }
  }
  if (o.crown) {
    ctx.fillStyle = '#e8b13c'; ctx.strokeStyle = '#a77a1e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-17, hy - 21); ctx.lineTo(-19, hy - 41); ctx.lineTo(-9, hy - 31); ctx.lineTo(0, hy - 45); ctx.lineTo(9, hy - 31); ctx.lineTo(19, hy - 41); ctx.lineTo(17, hy - 21); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9433d'; ctx.beginPath(); ctx.arc(0, hy - 29, 3.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
  if (o.wring) {
    const w = o.wringPh ?? 0;
    for (const side of [-1, 1]) {
      const hx = side * (7 + Math.sin(w + side) * 5), hyy = -56 + sy + Math.cos(w * 1.3 + side) * 4;
      ctx.strokeStyle = A.shade(robe, -0.12); ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(side * 18, -76 + sy); ctx.quadraticCurveTo(side * 22, -60 + sy, hx, hyy); ctx.stroke();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hx, hyy, 6.5, 0, TAU); ctx.fill();
    }
  }
  if (o.spear) {
    ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(30, -18); ctx.lineTo(33, -158 + sy); ctx.stroke();
    ctx.fillStyle = '#c9ccd1'; ctx.beginPath(); ctx.moveTo(33, -176 + sy); ctx.lineTo(39, -156 + sy); ctx.lineTo(27, -156 + sy); ctx.closePath(); ctx.fill();
  }
  if (o.shield) {
    ctx.fillStyle = '#9a7440'; ctx.strokeStyle = '#d2a85a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(-24, -48 + sy, 15, 21, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
  if (o.staff) {
    ctx.strokeStyle = '#6b4424'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(36, -2); ctx.lineTo(40, -150 + sy); ctx.stroke();
    ctx.beginPath(); ctx.arc(35, -150 + sy, 5.5, 0, Math.PI, true); ctx.stroke();
  }
  if (o.block) {
    ctx.fillStyle = '#5d6168'; ctx.fillRect(-29, -140 + sy, 58, 24);
    ctx.fillStyle = '#80858d'; ctx.fillRect(-29, -140 + sy, 58, 6);
    ctx.fillStyle = '#4a4d54'; ctx.fillRect(21, -134 + sy, 8, 18);
  }
  ctx.restore();
}

// one person lying down under a cloak (pose 'sleep'); the head end is covered (faceless)
function lying(ctx, x, y, s, t, o = {}) {
  const robe = o.robe ?? '#8a7a5a', scarf = o.scarf ?? '#efe7d6';
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.flip ? -1 : 1), s);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  const br = Math.sin(t * 1.3 + (o.seed ?? 0)) * 1.2;
  ctx.fillStyle = 'rgba(40,25,10,0.2)'; ctx.beginPath(); ctx.ellipse(4, 0, 68, 7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = robe;
  ctx.beginPath(); ctx.moveTo(-46, -2); ctx.quadraticCurveTo(-48, -30 - br, -16, -32 - br); ctx.quadraticCurveTo(26, -36 - br, 46, -24); ctx.quadraticCurveTo(64, -18, 64, -2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = A.shade(robe, -0.16);
  ctx.beginPath(); ctx.moveTo(-46, -2); ctx.quadraticCurveTo(10, -10, 64, -2); ctx.lineTo(64, 0); ctx.lineTo(-46, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = scarf; ctx.beginPath(); ctx.ellipse(-54, -16, 17, 14, -0.25, 0, TAU); ctx.fill();
  ctx.strokeStyle = A.shade(robe, -0.22); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  for (const k of [-10, 12, 34]) { ctx.beginPath(); ctx.moveTo(k, -6); ctx.quadraticCurveTo(k + 8, -18 - br, k + 2, -28 - br); ctx.stroke(); }
  ctx.restore();
}

// the sleepers of the cave: one cloaked mass in shadow whose ends dissolve - it can never be counted.
// side: -1..1 (turn_sleepers), wake 0..1 (they sit up)
function sleepersFig(ctx, x, y, s, t, o = {}) {
  const side = o.side ?? 1, wake = clamp(o.wake ?? 0), W = 240;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.fillStyle = 'rgba(18,12,8,0.38)'; ctx.beginPath(); ctx.ellipse(0, 2, W + 40, 18, 0, 0, TAU); ctx.fill();
  const N = 15;
  const prof = (seed, u) => {
    let h = 0;
    for (let i = 0; i < N; i++) {
      const ci = lerp(-W, W, (i + 0.3 + H(seed, i) * 0.4) / N), wd = 38 + H(seed, i + 30) * 14;
      const d = (u - ci - side * 8) / wd, sk = d * (1 + 0.8 * side * Math.tanh(d * 1.5));
      h += (0.78 + H(seed, i + 60) * 0.22) * Math.exp(-sk * sk);
    }
    return h;
  };
  const taper = (u) => clamp((W + 50 - Math.abs(u)) / 110);
  const layer = (seed, base, amp, col, yOff) => {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-W - 50, yOff);
    for (let u = -W - 50; u <= W + 50; u += 8) {
      const breath = Math.sin(t * 1.1 + u * 0.03) * 1.2;
      ctx.lineTo(u, yOff - (base + amp * prof(seed, u) * lerp(1, 2.1, wake) + breath) * taper(u));
    }
    ctx.lineTo(W + 50, yOff); ctx.closePath(); ctx.fill();
  };
  layer(1, 8, 18, '#5a4234', -10);
  layer(2, 5, 16, '#7a5d48', -4);
  layer(3, 2, 12, '#93765a', 0);
  // cloth sheen along the folds (cloaks, not rock)
  ctx.strokeStyle = 'rgba(214,186,148,0.35)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (let j = 0; j < 9; j++) {
    const u = lerp(-W + 40, W - 40, (j + 0.5) / 9) + side * 6, hh = (2 + 12 * prof(3, u) * lerp(1, 2.1, wake)) * taper(u);
    ctx.beginPath(); ctx.moveTo(u - 22, -hh + 4); ctx.quadraticCurveTo(u, -hh - 2, u + 22, -hh + 5); ctx.stroke();
  }

  // folds that do not line up with any single body
  ctx.strokeStyle = 'rgba(30,22,16,0.35)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  for (let j = 0; j < 14; j++) {
    const u = lerp(-W + 20, W - 20, (j + H(j, 701) * 0.8) / 14), h = 10 + H(j, 702) * 14 * lerp(1, 2, wake);
    ctx.beginPath(); ctx.moveTo(u, -2); ctx.quadraticCurveTo(u + side * 10, -h * 0.6, u + side * 4, -h); ctx.stroke();
  }
  // soft light on the top from the entrance, shadow swallowing both ends
  const gl = ctx.createLinearGradient(0, -60 * lerp(1, 2, wake), 0, 0);
  gl.addColorStop(0, 'rgba(255,236,200,0.10)'); gl.addColorStop(1, 'rgba(255,236,200,0)');
  ctx.fillStyle = gl; ctx.fillRect(-W - 50, -70 * lerp(1, 2.2, wake), 2 * W + 100, 70 * lerp(1, 2.2, wake));
  ctx.restore();
}

// a dog seen from the side, facing +x; lie 0..1 = lying with forelegs stretched out
function dogFig(ctx, x, y, s, t, o = {}) {
  const lie = clamp(o.lie ?? 0), walk = o.walk ?? 0, ph = t * 7;
  const col = '#b8834f', dark = '#8a5e36', light = '#d6a874';
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.flip ? -1 : 1) * (o.sx ?? 1), s);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.fillStyle = 'rgba(40,25,10,0.2)'; ctx.beginPath(); ctx.ellipse(6, 0, 66, 7, 0, 0, TAU); ctx.fill();
  if (lie > 0.5) {
    const br = Math.sin(t * 1.4) * 1.2;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(-12, -20 - br * 0.5, 46, 19 + br * 0.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(-40, -14, 19, 13, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 11; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-58, -10); ctx.quadraticCurveTo(-82, -6, -88, -18); ctx.stroke();
    // forelegs stretched forward on the ground
    for (const dy of [-3, -9]) { ctx.strokeStyle = dy < -5 ? dark : light; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(18, dy - 4); ctx.lineTo(74, dy); ctx.stroke(); }
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(26, -34, 16, 22, -0.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(42, -56, 18, 15, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(60, -52, 13, 8.5, 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(34, -60, 8, 15, 0.45, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2a20'; ctx.beginPath(); ctx.arc(72, -54, 3.5, 0, TAU); ctx.fill();
  } else {
    ctx.lineCap = 'round';
    [[-34, 0], [-22, Math.PI], [26, Math.PI * 0.5], [38, Math.PI * 1.5]].forEach(([lx, p0], k) => {
      const sw = Math.sin(ph + p0) * 0.35 * walk;
      ctx.strokeStyle = k % 2 ? col : dark; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(lx, -44); ctx.lineTo(lx + Math.sin(sw) * 26, -4); ctx.stroke();
    });
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -52, 46, 17, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(-42, -58); ctx.quadraticCurveTo(-64, -72 - Math.sin(t * 4) * 4, -60, -88); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(40, -70, 14, 20, 0.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(52, -86, 17, 14, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(69, -82, 12, 8, 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(44, -90, 7, 14, 0.45, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2a20'; ctx.beginPath(); ctx.arc(80, -84, 3.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// a woven basket; fishIn 0..1 (the fish is visible inside)
function basketFig(ctx, x, y, s, t, fishIn = 1, alpha = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(40,25,10,0.2)'; ctx.beginPath(); ctx.ellipse(0, 0, 40, 6, 0, 0, TAU); ctx.fill();
  if (fishIn > 0.01) {
    ctx.save(); ctx.globalAlpha *= fishIn;
    const wig = Math.sin(t * 3) * 0.08;
    ctx.translate(4, -46); ctx.rotate(-0.3 + wig);
    ctx.fillStyle = '#9fb7c4'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7f9aaa'; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(-36, -9); ctx.lineTo(-34, 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(4, -3, 14, 2.5, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#b48a4e';
  ctx.beginPath(); ctx.moveTo(-34, -42); ctx.lineTo(34, -42); ctx.lineTo(26, -2); ctx.quadraticCurveTo(0, 4, -26, -2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#8a6532'; ctx.lineWidth = 2.2;
  for (let k = 1; k < 5; k++) { const yy = -42 + k * 8; ctx.beginPath(); ctx.moveTo(-34 + k * 1.6, yy); ctx.lineTo(34 - k * 1.6, yy); ctx.stroke(); }
  for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * 9, -42); ctx.lineTo(k * 7.4, -2); ctx.stroke(); }
  ctx.fillStyle = '#9a743e'; ctx.fillRect(-36, -46, 72, 6);
  ctx.restore();
}

function rockFig(ctx, x, y, s, alpha = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(40,25,10,0.22)'; ctx.beginPath(); ctx.ellipse(0, 0, 120, 12, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#9a8e7c';
  ctx.beginPath(); ctx.moveTo(-112, 0); ctx.lineTo(-96, -70); ctx.lineTo(-54, -128); ctx.lineTo(10, -146); ctx.lineTo(70, -118); ctx.lineTo(108, -60); ctx.lineTo(116, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7d7262';
  ctx.beginPath(); ctx.moveTo(10, -146); ctx.lineTo(70, -118); ctx.lineTo(108, -60); ctx.lineTo(116, 0); ctx.lineTo(30, 0); ctx.lineTo(18, -80); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b3a793';
  ctx.beginPath(); ctx.moveTo(-96, -70); ctx.lineTo(-54, -128); ctx.lineTo(10, -146); ctx.lineTo(-20, -96); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(60,50,40,0.35)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-40, -40); ctx.lineTo(-10, -60); ctx.lineTo(4, -30); ctx.stroke();
  ctx.restore();
}

// an old leaning mud-brick wall; repair 0..1 straightens and restores it
function wallFig(ctx, x, y, s, t, repair = 0, alpha = 1) {
  const W = 250, Hh = 170, lean = lerp(0.16, 0, ease.inOutCubic(clamp(repair)));
  ctx.save(); ctx.translate(x - W / 2 * s, y); ctx.scale(s, s); ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(40,25,10,0.2)'; ctx.beginPath(); ctx.ellipse(W / 2, 0, W * 0.6, 10, 0, 0, TAU); ctx.fill();
  ctx.rotate(lean);
  ctx.fillStyle = '#d9bf8f'; ctx.fillRect(0, -Hh, W, Hh);
  ctx.fillStyle = '#c4a674'; ctx.fillRect(W - 14, -Hh, 14, Hh);
  ctx.fillStyle = '#e8d3a8'; ctx.fillRect(-4, -Hh - 10, W + 8, 12);
  const rows = 7, cols = 6, bh = Hh / rows, bw = W / cols;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const missing = H(r * 13 + c, 801) < 0.18 && r < rows - 1;
    const bx = c * bw + (r % 2 ? bw / 2 : 0) - (r % 2 ? bw : 0), by = -Hh + r * bh;
    if (missing) {
      const k = clamp((repair - 0.3 - H(r * 13 + c, 802) * 0.4) / 0.25);
      ctx.fillStyle = mixHex('#6e5a40', '#d9bf8f', k); ctx.fillRect(bx + 3, by + 3, bw - 6, bh - 6);
    }
    ctx.strokeStyle = 'rgba(120,90,55,0.4)'; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
  }
  const ca = 1 - clamp(repair * 1.4);
  if (ca > 0.01) {
    ctx.strokeStyle = `rgba(60,40,25,${0.8 * ca})`; ctx.lineWidth = 3.5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(150, -Hh); ctx.lineTo(138, -120); ctx.lineTo(160, -90); ctx.lineTo(146, -46); ctx.lineTo(166, -10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(60, -Hh); ctx.lineTo(70, -132); ctx.lineTo(52, -104); ctx.stroke();
  }
  ctx.restore();
  if (repair > 0.85 && repair < 1.6) A.sparkle(ctx, x + 40 * s, y - 180 * s, 12 * s, Math.sin(Math.PI * clamp((repair - 0.85) / 0.75)));
}

// the barrier between the two mountains: p = {stack, heat, pour} each 0..1
const PASS = { y0: HY + 58, y1: 70, l0: 352, l1: 280, r0: 608, r1: 680 };
const passL = (y) => lerp(PASS.l0, PASS.l1, (PASS.y0 - y) / (PASS.y0 - PASS.y1));
const passR = (y) => lerp(PASS.r0, PASS.r1, (PASS.y0 - y) / (PASS.y0 - PASS.y1));
function barrierFig(ctx, t, ph, alpha = 1) {
  const top = 170, rows = 14, rh = (PASS.y0 - top) / rows;
  ctx.save(); ctx.globalAlpha = alpha;
  // foundation trench
  ctx.fillStyle = '#7d6a52'; ctx.beginPath(); ctx.ellipse(480, PASS.y0, 150, 10, 0, 0, TAU); ctx.fill();
  const shown = ph.stack * rows;
  for (let r = 0; r < rows; r++) {
    const k = clamp(shown - r);
    if (k <= 0) break;
    const yb = PASS.y0 - r * rh, yt = yb - rh, drop = (1 - ease.outCubic(k)) * 40;
    const xl = passL(yb) + 2, xr = passR(yb) - 2, n = Math.max(3, Math.round((xr - xl) / 46)), bw = (xr - xl) / n;
    for (let j = 0; j < n; j++) {
      const bx = xl + j * bw + (r % 2 ? bw * 0.5 : 0) - (r % 2 && j === n - 1 ? bw * 0.5 : 0);
      const ww = r % 2 && j === n - 1 ? bw * 0.5 : bw;
      const hot = ph.heat * (1 - ph.pour * 0.85) * (0.8 + 0.2 * Math.sin(t * 6 + r + j));
      ctx.globalAlpha = alpha * Math.min(1, k * 2);
      ctx.fillStyle = mixHex('#5d6168', '#d9532c', hot); ctx.fillRect(bx + 1.5, yt - drop + 1.5, ww - 3, rh - 3);
      ctx.fillStyle = mixHex('#80858d', '#ffb347', hot); ctx.fillRect(bx + 1.5, yt - drop + 1.5, ww - 3, 4);
    }
  }
  ctx.globalAlpha = alpha;
  if (ph.heat > 0.01) {
    const hk = ph.heat * (1 - ph.pour);
    A.glowDisc(ctx, 480, PASS.y0 - 150, 1, 'rgba(0,0,0,0)', '#ff7a3a', 330, hk, 0.55);
    for (let i = 0; i < 6; i++) A.fire(ctx, 380 + i * 40, PASS.y0 + 4, 0.9 * hk, t + i);
  }
  if (ph.pour > 0.01) {
    // molten copper poured from the top runs down over the blocks
    const yTop = PASS.y0 - Math.min(shown, rows) * rh;
    const streamA = 1 - clamp((ph.pour - 0.85) / 0.15);
    for (let i = 0; i < 9 && streamA > 0.01; i++) {
      ctx.globalAlpha = alpha * streamA;
      const sx = lerp(passL(yTop) + 16, passR(yTop) - 16, (i + 0.5) / 9) + Math.sin(i * 2.3) * 6;
      const len = clamp(ph.pour * 1.4 - H(i, 811) * 0.3) * (PASS.y0 - yTop);
      ctx.strokeStyle = '#d98a3a'; ctx.lineWidth = 9 + H(i, 812) * 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, yTop - 6); ctx.quadraticCurveTo(sx + Math.sin(t * 2 + i) * 4, yTop + len * 0.5, sx + 3, yTop + len); ctx.stroke();
      ctx.strokeStyle = '#f6c06a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx - 2, yTop - 4); ctx.lineTo(sx, yTop + len * 0.9); ctx.stroke();
    }
    ctx.globalAlpha = alpha;
    const cov = clamp((ph.pour - 0.35) / 0.65);
    if (cov > 0) {
      ctx.save(); ctx.globalAlpha = alpha * cov;
      ctx.beginPath(); ctx.moveTo(passL(PASS.y0), PASS.y0); ctx.lineTo(passL(yTop), yTop); ctx.lineTo(passR(yTop), yTop); ctx.lineTo(passR(PASS.y0), PASS.y0); ctx.closePath();
      const g = ctx.createLinearGradient(400, yTop, 560, PASS.y0);
      g.addColorStop(0, '#c07a3e'); g.addColorStop(0.5, '#8a5a36'); g.addColorStop(1, '#5e4636');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(255,214,150,0.45)'; ctx.lineWidth = 3;
      for (let k = 1; k < 6; k++) { const yy = lerp(yTop, PASS.y0, k / 6); ctx.beginPath(); ctx.moveTo(passL(yy) + 6, yy); ctx.lineTo(passR(yy) - 6, yy); ctx.stroke(); }
      ctx.restore();
    }
  }
  ctx.restore();
}

function camel(ctx, x, y, s, t, o) {
  const walk = o.moving, ph = t * 5;
  ctx.save();
  ctx.globalAlpha = o.alpha;
  ctx.translate(x, y); ctx.scale(s * (o.flip ? -1 : 1), s);
  ctx.fillStyle = 'rgba(40,25,10,0.18)'; ctx.beginPath(); ctx.ellipse(0, 0, 70, 8, 0, 0, TAU); ctx.fill();
  const body = '#c99a5e', dark = '#a87a44';
  ctx.strokeStyle = dark; ctx.lineWidth = 11; ctx.lineCap = 'round';
  [[-45, 0], [-30, Math.PI], [32, Math.PI * 0.5], [47, Math.PI * 1.5]].forEach(([lx, p0], k) => {
    const sw = Math.sin(ph + p0) * 0.28 * walk;
    ctx.strokeStyle = k % 2 ? body : dark;
    ctx.beginPath(); ctx.moveTo(lx, -100); ctx.lineTo(lx + Math.sin(sw) * 50, -50); ctx.lineTo(lx + Math.sin(sw) * 70 - 4, -4); ctx.stroke();
  });
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, -118, 68, 30, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-40, -130); ctx.bezierCurveTo(-30, -190, 22, -190, 32, -130); ctx.closePath(); ctx.fill();
  ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(-4, -100, 54, 10, 0, 0, Math.PI); ctx.fill();
  ctx.strokeStyle = body; ctx.lineWidth = 22;
  ctx.beginPath(); ctx.moveTo(52, -122); ctx.quadraticCurveTo(84, -132, 92, -176); ctx.stroke();
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(104, -184, 24, 12, 0.15, 0, TAU); ctx.fill();
  ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(94, -196, 5, 7, -0.4, 0, TAU); ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-66, -122); ctx.quadraticCurveTo(-80, -100, -74, -84); ctx.stroke();
  // saddle blanket
  ctx.fillStyle = '#b8433c'; ctx.beginPath(); ctx.moveTo(-34, -132); ctx.quadraticCurveTo(-6, -150, 26, -132); ctx.lineTo(22, -106); ctx.lineTo(-30, -106); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f2c25b'; ctx.fillRect(-30, -112, 52, 5);
  ctx.restore();
}

function shipFig(ctx, x, y, s, t, alpha, hole = 0) {
  const bob = Math.sin(t * 1.4) * 3, rock = Math.sin(t * 1.1) * 0.025;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y + bob); ctx.rotate(rock); ctx.scale(s, s);
  // mast and sail
  ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, -235); ctx.stroke();
  ctx.fillStyle = '#f6efe0';
  ctx.beginPath(); ctx.moveTo(4, -228); ctx.quadraticCurveTo(110, -160, 120, -40); ctx.lineTo(6, -40); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8dcc2';
  ctx.beginPath(); ctx.moveTo(-4, -200); ctx.quadraticCurveTo(-70, -140, -78, -46); ctx.lineTo(-6, -46); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#c9433d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(10, -150); ctx.lineTo(88, -120); ctx.stroke();
  // cabin
  ctx.fillStyle = '#8c5a33'; ctx.fillRect(-120, -62, 90, 44);
  ctx.fillStyle = '#6b4424'; ctx.fillRect(-126, -68, 102, 10);
  ctx.fillStyle = '#f2c25b'; ctx.fillRect(-104, -50, 16, 16); ctx.fillRect(-72, -50, 16, 16);
  // hull
  const g = ctx.createLinearGradient(0, -24, 0, 46);
  g.addColorStop(0, '#a8713f'); g.addColorStop(1, '#6b4424');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-190, -44); ctx.quadraticCurveTo(-170, -20, -150, -20); ctx.lineTo(150, -20); ctx.quadraticCurveTo(178, -24, 196, -56);
  ctx.quadraticCurveTo(170, 30, 110, 40); ctx.lineTo(-120, 40); ctx.quadraticCurveTo(-176, 20, -190, -44); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(60,35,18,0.55)'; ctx.lineWidth = 3;
  for (const yy of [-4, 14, 30]) { ctx.beginPath(); ctx.moveTo(-170, yy); ctx.quadraticCurveTo(0, yy + 6, 172, yy - 12); ctx.stroke(); }
  if (hole > 0) {
    // a plank pulled from the hull, leaving a hole (the ship does not sink)
    const k = clamp(hole * 2), p = ease.inOutCubic(clamp(hole));
    ctx.fillStyle = '#24160d'; ctx.beginPath(); ctx.ellipse(70, 10, 24 * k, 9 * k, -0.05, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(lerp(70, 128, p), lerp(10, -32, p)); ctx.rotate(lerp(0, -0.35, p));
    ctx.fillStyle = '#b07a46'; ctx.fillRect(-28, -5, 56, 10); ctx.strokeStyle = '#6b4424'; ctx.lineWidth = 2; ctx.strokeRect(-28, -5, 56, 10);
    ctx.restore();
  }
  ctx.restore();
}

// ---- settings: far layer (parallax) and mid layer (with the camera) ----
const SETTINGS = {
  desert: {
    ground: ['#efd09a', '#e0b67a', 'rgba(190,140,80,0.45)'],
    far(ctx, t) {
      band(ctx, HY - 22, 26, 103, '#f0cfa2');
      // wide, low, uneven plateaus only: a small symmetric block in the middle read as a truncated pyramid
      mesa(ctx, 90, HY + 6, 430, 105, '#dba273', '#c4875c', 3);
      mesa(ctx, 700, HY + 6, 420, 38, '#dfa979', '#c88d61', 5);
      mesa(ctx, 1000, HY + 6, 470, 120, '#d89d6e', '#bf8358', 7);
      palmSil(ctx, 520, HY - 4, 0.34, t, '#c9a77e', 6); palmSil(ctx, 560, HY - 2, 0.28, t, '#c9a77e', 7);
      band(ctx, HY - 2, 20, 105, '#ecc794');
    },
    mid(ctx, t, X) {
      A.tent(ctx, 70, 640, 0.5 * (1 - 0.6 * X.ruin));
      A.tent(ctx, 905, 628, 0.42 * (1 - 0.6 * X.ruin));
      A.palm(ctx, -40, 700, 0.85, t, 7, 0.12 + X.wind * 0.25);
      A.palm(ctx, 1010, 690, 0.75, t, 8, -0.1 + X.wind * 0.25);
      for (let i = 0; i < 8; i++) A.grass(ctx, -60 + i * 150 + H(i, 3) * 60, 740 + H(i, 4) * 90, 1.0, t, i + 3, '#8a9a4e', '#a6b35c');
    },
  },
  city: {
    ground: ['#d9b68a', '#c39a6c', 'rgba(150,105,60,0.35)'],
    far(ctx) { band(ctx, HY - 16, 28, 113, '#dcc09a'); mesa(ctx, 860, HY + 4, 280, 110, '#d2ad86', '#bb956e', 9); band(ctx, HY - 2, 16, 115, '#d6b68c'); },
    houses: [[-250, 615, 220, 250, 1], [0, 600, 160, 190, 2], [190, 612, 200, 240, 3], [420, 598, 150, 180, 4], [600, 615, 230, 260, 5], [870, 602, 170, 210, 6], [1060, 612, 210, 240, 7]],
    mid(ctx, t, X) { buildings(ctx, this.houses, t, X, 0); },
  },
  palace: {
    ground: ['#e8dcc4', '#d4c4a4', null],
    far(ctx) { band(ctx, HY - 14, 30, 123, '#e4cba4'); },
    mid(ctx, t, X) { palaceSet(ctx, t, X); },
  },
  sea_shore: {
    ground: ['#efd7a6', '#e3c18a', 'rgba(190,150,90,0.35)'],
    sea: true,
    far(ctx) { headland(ctx, -180, 300, 457, 60, '#b9c7c9', '#a2b3b6'); },
    mid(ctx, t, X) {
      A.palm(ctx, -30, 730, 0.8, t, 9, 0.1 + X.wind * 0.25);
      A.palm(ctx, 1000, 720, 0.7, t, 10, -0.08 + X.wind * 0.25);
      for (let i = 0; i < 6; i++) A.grass(ctx, -40 + i * 200 + H(i, 13) * 60, 770 + H(i, 14) * 80, 0.9, t, i + 13, '#8a9a4e', '#a6b35c');
    },
  },
  mountains: {
    ground: ['#bdb486', '#a39a6b', 'rgba(255,255,255,0.10)'],
    far(ctx) {
      const far = peaks(141, 6, -160, 1120, 220, 320, 320, 440);
      A.mountains(ctx, far, HY + 5, '#b8c3cf', '#a0aebd');
      ctx.fillStyle = '#e6dccb';   // pale stone, not snow: the Quran's mountains are in arid lands
      for (const p of far) { const ay = HY + 5 - p.h, k = 0.18; ctx.beginPath(); ctx.moveTo(p.x, ay); ctx.lineTo(p.x + p.w * k * 0.5, ay + p.h * k); ctx.lineTo(p.x, ay + p.h * k * 0.8); ctx.lineTo(p.x - p.w * k * 0.5, ay + p.h * k); ctx.closePath(); ctx.fill(); }
      mistBand(ctx, HY - 20, 40, 0.45);
    },
    mid(ctx, t, X) {
      mesa(ctx, -70, HY + 70, 380, 270, '#9d9278', '#7f7560', 11); mesa(ctx, 1040, HY + 70, 400, 290, '#a29680', '#837963', 13);
      for (let i = 0; i < 9; i++) A.grass(ctx, -60 + i * 140 + H(i, 15) * 60, 740 + H(i, 16) * 90, 1.0, t, i + 21, '#6f8a45', '#88a356');
      for (const [x, y, r] of [[120, 760, 26], [860, 748, 32], [600, 800, 20]]) { ctx.fillStyle = '#8d8574'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.4, r, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#a69d8a'; ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.6, r * 0.4, 0, 0, TAU); ctx.fill(); }
    },
  },
  garden: {
    ground: ['#a9c87a', '#8fb062', 'rgba(255,255,255,0.10)'],
    far(ctx, t) { band(ctx, HY - 10, 40, 151, '#b9d39a'); palmSil(ctx, 200, HY - 4, 0.36, t, '#98b87a', 2); palmSil(ctx, 760, HY - 8, 0.4, t, '#98b87a', 3); },
    mid(ctx, t, X) {
      ctx.save(); ctx.strokeStyle = 'rgba(90,130,60,0.35)'; ctx.lineWidth = 6;
      for (let i = 0; i < 7; i++) { const y = HY + 30 + i * 14 + i * i * 2.2; ctx.beginPath(); ctx.moveTo(-200, y); ctx.lineTo(1200, y); ctx.stroke(); }
      ctx.restore();
      A.palm(ctx, -20, 720, 0.85, t, 11, 0.1 + X.wind * 0.25); A.palm(ctx, 110, 660, 0.6, t, 12, 0.14 + X.wind * 0.2);
      A.palm(ctx, 990, 715, 0.8, t, 13, -0.08 + X.wind * 0.25); A.palm(ctx, 860, 655, 0.55, t, 14, -0.1 + X.wind * 0.2);
      for (let i = 0; i < 10; i++) A.grass(ctx, -60 + i * 125 + H(i, 17) * 50, 740 + H(i, 18) * 90, 1.0, t, i + 31);
    },
  },
  river: {
    ground: ['#cdbf8a', '#b6a46e', 'rgba(255,255,255,0.10)'],
    river: true,
    far(ctx, t) { band(ctx, HY - 6, 26, 161, '#b7c690'); for (let i = 0; i < 6; i++) palmSil(ctx, 40 + i * 180 + H(i, 5) * 40, HY - 2, 0.32 + H(i, 6) * 0.08, t, '#93a878', i); },
    mid(ctx, t, X) {
      for (let i = 0; i < 14; i++) {
        const x = -40 + i * 80 + H(i, 19) * 30;
        ctx.strokeStyle = i % 2 ? '#6f8a45' : '#88a356'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        for (let k = 0; k < 4; k++) { const a = (k - 1.5) * 0.16 + Math.sin(t * 1.1 + i + k) * 0.04; ctx.beginPath(); ctx.moveTo(x, 652); ctx.lineTo(x + Math.sin(a) * 60, 652 - Math.cos(a) * (46 + k * 6)); ctx.stroke(); }
      }
      A.palm(ctx, -30, 740, 0.8, t, 15, 0.1 + X.wind * 0.25); A.palm(ctx, 1000, 735, 0.75, t, 16, -0.08 + X.wind * 0.25);
    },
  },
};

// houses that collapse to rubble with the 'ruin' event (also tilt under 'quake')
function buildings(ctx, list, t, X, seed) {
  list.forEach(([x, y, w, h, sd], i) => {
    const p = X.ruinT > -BIG ? ease.inCubic(prog(t, X.ruinT + i * 0.18, X.ruinT + i * 0.18 + 1.3)) : 0;
    const wob = X.quake * Math.sin(t * 23 + i * 2) * 0.012;
    if (p < 1) {
      ctx.save();
      ctx.translate(x + w / 2, y);
      ctx.rotate(wob + p * (i % 2 ? 0.32 : -0.28));
      ctx.scale(1, 1 - 0.75 * p);
      A.house(ctx, -w / 2, 0, w, h, { seed: sd + seed, windows: [[0.28, 0.32], [0.72, 0.32]].slice(0, 1 + (sd % 2)), door: sd % 2 ? [0.5, 46, 76] : null, lit: X.night * 0.9, alpha: 1 - p * 0.6 });
      ctx.restore();
    }
    if (p > 0.35) { ctx.save(); ctx.globalAlpha = clamp((p - 0.35) * 2); A.ruins(ctx, x - 10, y + 4, w + 20, sd + 3); ctx.restore(); }
  });
}

function palaceSet(ctx, t, X) {
  // back wall with columns, arches and a dais
  const wallTop = 300, wallY = 620;
  const p = X.ruinT > -BIG ? ease.inCubic(prog(t, X.ruinT, X.ruinT + 1.6)) : 0;
  ctx.save();
  // the wall collapses downward behind the rubble line
  ctx.beginPath(); ctx.rect(-400, -200, 1800, wallY + 200); ctx.clip();
  ctx.translate(0, p * (wallY - wallTop + 50));
  ctx.fillStyle = '#ead9b8'; ctx.fillRect(-300, wallTop, 1560, wallY - wallTop);
  ctx.fillStyle = '#d9c39a'; ctx.fillRect(-300, wallTop - 18, 1560, 22);
  ctx.fillStyle = '#c9ad7f';
  for (let i = 0; i < 40; i++) ctx.fillRect(-300 + i * 40, wallTop - 34, 22, 18);
  for (let i = -1; i < 9; i++) {
    const cx = 60 + i * 120;
    ctx.fillStyle = '#b8935f'; archRectFill(ctx, cx + 18, wallTop + 70, 84, wallY - wallTop - 70);
    ctx.fillStyle = mixHex('#7a5a3a', '#2a2a46', X.night); archRectFill(ctx, cx + 26, wallTop + 80, 68, wallY - wallTop - 80);
  }
  for (let i = -1; i < 10; i++) {
    const cx = 60 + i * 120, tilt = p * (i % 2 ? 0.3 : -0.25) * (H(i, 3) > 0.4 ? 1 : 0);
    ctx.save(); ctx.translate(cx, wallY); ctx.rotate(tilt);
    ctx.fillStyle = '#f3e7cc'; ctx.fillRect(-14, -(wallY - wallTop) + 6, 28, wallY - wallTop - 6);
    ctx.fillStyle = '#d6bf91'; ctx.fillRect(-20, -(wallY - wallTop), 40, 14); ctx.fillRect(-20, -14, 40, 14);
    ctx.fillStyle = 'rgba(160,130,90,0.3)'; ctx.fillRect(4, -(wallY - wallTop) + 14, 6, wallY - wallTop - 28);
    ctx.restore();
  }
  // banners (plain, no text)
  for (const [bx, col] of [[240, '#2f5fa8'], [720, '#2f5fa8'], [480, '#b8433c']]) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(bx - 22, wallTop + 20); ctx.lineTo(bx + 22, wallTop + 20); ctx.lineTo(bx + 22, wallTop + 150); ctx.lineTo(bx, wallTop + 132); ctx.lineTo(bx - 22, wallTop + 150); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2c25b'; ctx.fillRect(bx - 22, wallTop + 20, 44, 8);
  }
  ctx.restore();
  // dais and throne
  ctx.fillStyle = '#d8c39a'; ctx.fillRect(330, 612, 300, 22);
  ctx.fillStyle = '#c9b085'; ctx.fillRect(360, 596, 240, 18);
  ctx.save(); ctx.translate(480, 598); ctx.rotate(p * 0.2); ctx.globalAlpha = 1 - p * 0.5;
  ctx.fillStyle = '#c99a2e'; ctx.fillRect(-44, -110, 88, 110);
  ctx.fillStyle = '#a8322b'; ctx.fillRect(-32, -96, 64, 70);
  ctx.fillStyle = '#e8b13c'; ctx.beginPath(); ctx.arc(0, -112, 16, Math.PI, 0); ctx.fill();
  ctx.restore();
  if (p > 0.3) { ctx.save(); ctx.globalAlpha = clamp((p - 0.3) * 2); A.ruins(ctx, -40, 650, 1100, 9); ctx.restore(); }
}
function archRectFill(ctx, x, y, w, h) { A.archRect(ctx, x, y, w, h); }

// sea band for sea_shore: horizon -> shoreline
const SEA_HZ = 455;
const shoreY = (x) => 600 + Math.sin(x * 0.006 + 0.8) * 16 + (x - 480) * 0.03;
function seaSet(ctx, t, X) {
  ctx.save();
  ctx.beginPath(); ctx.moveTo(-400, SEA_HZ);
  ctx.lineTo(1400, SEA_HZ); ctx.lineTo(1400, shoreY(1400));
  for (let x = 1400; x >= -400; x -= 40) ctx.lineTo(x, shoreY(x));
  ctx.closePath(); ctx.clip();
  waterBand(ctx, SEA_HZ, 700, t, '#8acbe3', '#2a78a2', 1 + X.storm * 1.8);
  ctx.restore();
  // foam along the shore
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let x = -400; x <= 1400; x += 20) { const y = shoreY(x) - 2 + Math.sin(t * 2 + x * 0.04) * 2.5; if (x === -400) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();
}
// the sea splits: a dry corridor from the shore to the horizon, between two walls of water
function seaPart(ctx, t, p, cx = 480) {
  if (p <= 0.002) return;
  const e = ease.outCubic(clamp(p));
  const yN = shoreY(cx) + 2, gN = lerp(0, 300, e), gF = lerp(0, 34, e), HN = lerp(6, 205, e), HF = lerp(2, 36, e);
  // dry sea bed
  const g = ctx.createLinearGradient(0, SEA_HZ, 0, yN);
  g.addColorStop(0, '#e2cb9a'); g.addColorStop(1, '#c49d63');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(cx - gN / 2, yN); ctx.lineTo(cx - gF / 2, SEA_HZ); ctx.lineTo(cx + gF / 2, SEA_HZ); ctx.lineTo(cx + gN / 2, yN); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(120,85,45,0.22)'; ctx.lineWidth = 2;
  for (let i = 1; i < 6; i++) { const u = Math.pow(i / 6, 1.4), y = lerp(SEA_HZ, yN, u), hw = lerp(gF, gN, u) / 2 * 0.8; ctx.beginPath(); ctx.moveTo(cx - hw, y); ctx.quadraticCurveTo(cx, y + 3, cx + hw, y); ctx.stroke(); }
  for (const side of [-1, 1]) {
    const xN = cx + side * gN / 2, xF = cx + side * gF / 2, xo = cx + side * (gN / 2 + 900);
    const crest = (u) => [lerp(xF, xN, u), lerp(SEA_HZ - HF, yN - HN, u)];
    // outer body: the piled-up sea, sloping back down to the sea surface
    const gb = ctx.createLinearGradient(0, SEA_HZ - HF, 0, yN);
    gb.addColorStop(0, '#2f86b4'); gb.addColorStop(1, '#1d5f8a');
    ctx.fillStyle = gb;
    ctx.beginPath(); ctx.moveTo(xF, SEA_HZ); ctx.lineTo(xF, SEA_HZ - HF); ctx.lineTo(xN, yN - HN);
    ctx.bezierCurveTo(lerp(xN, xo, 0.3), yN - HN * 1.02, lerp(xN, xo, 0.65), yN - HN * 0.35, xo, SEA_HZ + (yN - SEA_HZ) * 0.5);
    ctx.lineTo(xo, SEA_HZ); ctx.closePath(); ctx.fill();
    // inner face, lit, facing the dry path
    const gi = ctx.createLinearGradient(0, yN - HN, 0, yN);
    gi.addColorStop(0, '#7cc6e2'); gi.addColorStop(1, '#3f9cc9');
    ctx.fillStyle = gi;
    ctx.beginPath(); ctx.moveTo(xF, SEA_HZ); ctx.lineTo(xF, SEA_HZ - HF); ctx.lineTo(xN, yN - HN); ctx.lineTo(xN, yN); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 3;
    for (let k = 1; k < 7; k++) { const f = k / 7; ctx.beginPath(); ctx.moveTo(xF, lerp(SEA_HZ, SEA_HZ - HF, f)); ctx.lineTo(xN, lerp(yN, yN - HN, f) + Math.sin(t * 1.4 + k) * 3); ctx.stroke(); }
    ctx.restore();
    // foam crest
    ctx.strokeStyle = '#f4fbff'; ctx.lineCap = 'round';
    for (let k = 0; k < 14; k++) {
      const [x0, y0] = crest(k / 14), [x1, y1] = crest((k + 1) / 14);
      ctx.lineWidth = 3 + (k / 14) * 6;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 4 - Math.sin(t * 3 + k) * 2.5, x1, y1); ctx.stroke();
    }
    ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(xN, yN - HN);
    ctx.bezierCurveTo(lerp(xN, xo, 0.3), yN - HN * 1.02 - 3, lerp(xN, xo, 0.65), yN - HN * 0.35, xo, SEA_HZ + (yN - SEA_HZ) * 0.5); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(xF, SEA_HZ); ctx.lineTo(xN, yN); ctx.stroke();
  }
}
// river band for 'river'
const RIV0 = 585, RIV1 = 642;
function riverSet(ctx, t, X, part) {
  ctx.fillStyle = '#9fb27a'; ctx.fillRect(-400, HY, 1800, RIV0 - HY);
  const gap = ease.outCubic(clamp(part)) * 120;
  ctx.save();
  ctx.beginPath(); ctx.rect(-400, RIV0, 1800, RIV1 - RIV0);
  if (gap > 1) { ctx.rect(480 + gap / 2, RIV0 - 1, -gap, RIV1 - RIV0 + 2); }
  ctx.clip('evenodd');
  const g = ctx.createLinearGradient(0, RIV0, 0, RIV1);
  g.addColorStop(0, '#7cc0dc'); g.addColorStop(1, '#3f8fbd');
  ctx.fillStyle = g; ctx.fillRect(-400, RIV0, 1800, RIV1 - RIV0);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  for (let i = 0; i < 18; i++) {
    const x = ((i * 97 + t * 40) % 1600) - 300, y = RIV0 + 8 + H(i, 9) * (RIV1 - RIV0 - 16);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 40, y); ctx.stroke();
  }
  ctx.restore();
  if (gap > 1) {
    ctx.fillStyle = '#c9a874'; ctx.fillRect(480 - gap / 2, RIV0, gap, RIV1 - RIV0);
    for (const side of [-1, 1]) {
      const xw = 480 + side * gap / 2;
      ctx.fillStyle = '#3f9cc9';
      ctx.beginPath(); ctx.moveTo(xw, RIV1); ctx.lineTo(xw, RIV0 - 40 * clamp(part)); ctx.quadraticCurveTo(xw + side * 30, RIV0 - 20, xw + side * 60, RIV0); ctx.lineTo(xw + side * 60, RIV1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#f4fbff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(xw, RIV0 - 40 * clamp(part)); ctx.quadraticCurveTo(xw + side * 30, RIV0 - 20, xw + side * 60, RIV0); ctx.stroke();
    }
  }
}

function floorTiles(ctx) {
  ctx.save(); ctx.strokeStyle = 'rgba(150,120,80,0.28)'; ctx.lineWidth = 2;
  for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(480 + i * 40, HY + 50); ctx.lineTo(480 + i * 150, SH + 80); ctx.stroke(); }
  for (let k = 0; k < 7; k++) { const y = HY + 50 + Math.pow(k / 6, 1.6) * (SH - HY); ctx.beginPath(); ctx.moveTo(-300, y); ctx.lineTo(1300, y); ctx.stroke(); }
  ctx.restore();
}

function floodTop(t, E) {
  if (!E.st.flood) return SH + 100;
  const p = ease.inOutSine(prog(t, E.st.flood.t0, E.st.flood.t0 + 7));
  const recede = E.st.flood.t1 < BIG / 2 ? ease.inOutSine(prog(t, E.st.flood.t1, E.st.flood.t1 + 3)) : 0;
  return lerp(SH + 60, HY - 25, p * (1 - recede));
}

function stonesDraw(ctx, t, E) {
  if (!E.st.stones) return;
  const s0 = E.st.stones.t0, s1 = Math.min(E.st.stones.t1, BIG / 2), every = 0.17;
  const last = Math.floor((Math.min(t, s1) - s0) / every);
  // resting stones (only the most recent ones)
  for (let i = Math.max(0, last - 46); i <= last; i++) {
    const tb = s0 + i * every, p = (t - tb) / 1.0;
    const x0 = 40 + H(i, 3) * 900, xf = x0 + 80, yf = HY + 50 + H(i, 4) * 230;
    if (p < 0) continue;
    if (p <= 1) A.stone(ctx, lerp(x0, xf, p), lerp(-80, yf, ease.inCubic(p)), 0.75 + H(i, 5) * 0.55, p * 6 + i, 1);
    else {
      A.stone(ctx, xf, yf, 0.6 + H(i, 5) * 0.4, i, 0);
      if (p < 1.4) A.dust(ctx, xf, yf, 50, (1.4 - p) * 1.6, '#e0b08a');
    }
  }
}

function fireDraw(ctx, t, E) {
  const k = E.k('fire', 1.0, 1.2);
  if (k <= 0.01) return;
  const x = 480, y = GY + 6;
  ctx.save(); ctx.globalAlpha = k;
  A.glowDisc(ctx, x, y - 140, 1, 'rgba(0,0,0,0)', '#ffb347', 460, 1, 0.6);
  const tongues = [[-120, 0.9], [-60, 1.3], [0, 1.7], [60, 1.25], [120, 0.85], [-170, 0.6], [170, 0.6]];
  for (const [dx, sc] of tongues) A.fire(ctx, x + dx * 1.15, y, 1.45 * sc * lerp(0.4, 1, k), t + dx * 0.01);
  for (let i = 0; i < 24; i++) {
    const p = ((t * 0.7 + H(i, 7)) % 1);
    const sx = x + (H(i, 8) - 0.5) * 300 + Math.sin(t * 2 + i) * 20, sy = y - 40 - p * 300;
    ctx.fillStyle = `rgba(255,${200 - p * 80},90,${(1 - p) * 0.9})`;
    ctx.beginPath(); ctx.arc(sx, sy, 3 * (1 - p) + 1, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function lightBeam(ctx, t, E, L, T, c, B = []) {
  const k = E.k('light', 1.2, 1.0);
  if (k <= 0.01) return;
  const tgt = L.actors.find((a) => a.type === 'prophet' || a.type === 'honored') || L.actors.find((a) => a.type === 'believers');
  const x = tgt ? actorState(tgt, t, T, E, B, L).x : 480;
  ctx.save();
  ctx.globalAlpha = k;
  const g = ctx.createLinearGradient(0, -100, 0, GY + 20);
  g.addColorStop(0, 'rgba(255,248,220,0.75)'); g.addColorStop(1, 'rgba(255,236,180,0.12)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - 50, -120); ctx.lineTo(x + 50, -120); ctx.lineTo(x + 170, GY + 20); ctx.lineTo(x - 170, GY + 20); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,190,0.35)'; ctx.beginPath(); ctx.ellipse(x, GY + 10, 190, 34, 0, 0, TAU); ctx.fill();
  motes(ctx, 18, 91, t, x - 140, x + 140, 60, GY, 30, '#fff4cf', 0.9, 3);
  ctx.restore();
}

// lightning: strikes at hashed intervals after the event starts
function lightningAt(t, E) {
  const st = E.st.lightning;
  if (!st || t < st.t0 || t > st.t1 + 0.4) return { flash: 0, bolt: null };
  let tk = st.t0 + 0.2, k = 0;
  while (tk + 1.3 + H(k, 71) * 2.0 <= t && k < 400) { tk += 1.3 + H(k, 71) * 2.0; k++; }
  const age = t - tk;
  if (age < 0 || age > 0.45) return { flash: 0, bolt: null };
  const flash = Math.exp(-age * 9) * (age < 0.06 || (age > 0.12 && age < 0.17) ? 1 : 0.5);
  return { flash, bolt: age < 0.3 ? { seed: k, x: 140 + H(k, 72) * 680, a: 1 - age / 0.3 } : null };
}
function boltDraw(ctx, LT) {
  const b = LT.bolt;
  ctx.save(); ctx.globalAlpha = b.a;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.shadowColor = '#cfe0ff'; ctx.shadowBlur = 18;
  ctx.beginPath();
  let x = b.x, y = 60;
  ctx.moveTo(x, y);
  for (let i = 0; i < 9; i++) { x += (H(b.seed, i + 100) - 0.5) * 70; y += 40 + H(b.seed, i + 200) * 20; ctx.lineTo(x, y); }
  ctx.stroke();
  ctx.restore();
}

// ---- people: looks per type ----
const MAN_LOOKS = {
  plain: { robe: '#b08d63', belt: '#6d5236', scarf: '#ffffff', beard: true },
  rich: { robe: '#5a2a6a', belt: '#8a5a2a', scarf: '#fbf6ea', cape: '#2f2a5e', trim: '#e2b13c', beard: true },
  poor: { robe: '#9c8f78', belt: '#6f6450', scarf: '#e9e2d2', patches: true },
  traveller: { robe: '#8a6a4a', belt: '#5a4430', scarf: '#efe7d6', staff: true, bundle: true, beard: true },
};
const WORKERS = [['#8a6a4a', '#4f3c2a'], ['#6f7f5a', '#3f4a33'], ['#a0583c', '#5a3020'], ['#5d6f86', '#33404f']];
function looksFor(a, i, grey) {
  switch (a.type) {
    case 'soldiers': return { robe: grey(i % 2 ? '#efe6cf' : '#e6dcc0'), belt: grey('#2f5fa8'), helmet: true, spear: true, shield: i % 3 !== 1 };
    case 'king': return /فرعون/.test(a.rawLabel)
      ? { robe: grey('#f4ecd6'), belt: grey('#d6a63a'), nemes: true, cape: grey('#a8322b') }
      : { robe: grey('#7a2f5a'), belt: grey('#d6a63a'), cape: grey('#3b2a6b'), scarf: '#f4ecd6', beard: true, crown: true };
    case 'ruler': return { robe: '#f6f3ea', belt: '#2f7d4f', cape: '#3f8a5c', turban: '#2f7d4f', beard: true };
    case 'man': return { ...(MAN_LOOKS[a.look] || MAN_LOOKS.plain) };
    case 'workers': { const [robe, belt] = WORKERS[i % WORKERS.length]; return { robe, belt, scarf: '#efe7d6', block: true, beard: i % 2 === 0 }; }
    case 'believers': { const [robe, belt, scarf] = BELIEVERS[i % BELIEVERS.length]; return { robe, belt, scarf, beard: i % 4 === 0 }; }
    case 'disbelievers': { const [robe, belt] = DISBELIEVERS[i % DISBELIEVERS.length]; return { robe: grey(robe), belt: grey(belt), scarf: '#d9d3c8', check: i % 2 === 0, beard: i % 2 === 1 }; }
    default: { const [robe, belt] = ROBES[i % ROBES.length]; return { robe: grey(robe), belt: grey(belt), scarf: i % 3 === 1 ? '#f3efe6' : '#ffffff', check: i % 3 === 1, beard: i % 2 === 0, woman: i % 4 === 3 }; }
  }
}
function drawHuman(ctx, a, i, x, y, s, t, st, g, extra = {}, lookOverride = null) {
  const look = lookOverride || looksFor(a, i, (c) => (st.doom > 0 ? mixHex(c, '#7d7a80', st.doom * 0.85) : c));
  const al = extra.alpha ?? st.alpha;
  if (g.lie > 0.01) lying(ctx, x, y, s, t, { robe: look.robe, scarf: look.scarf ?? '#efe7d6', flip: i % 2 === 1, alpha: al * g.lie, seed: i });
  if (g.lie > 0.99) return;
  const rest = 0.18;
  let armL = null, armR = null;
  if (look.block) armL = armR = 2.75;
  const alarmA = st.alarm * (0.4 + 0.5 * Math.max(0, Math.sin(t * 5 + i * 1.7))) * (a.type === 'believers' ? 0.25 : 1);
  if (alarmA > 0.01 && armL == null) armL = armR = lerp(rest, 2.7, ease.outCubic(alarmA));
  if (g.raise > 0.01) armL = armR = lerp(armL ?? rest, 2.55, ease.outCubic(g.raise)) + Math.sin(t * 3 + i) * 0.08 * g.raise;
  const flip = !!st.flip;
  if (g.point > 0.01) { const side = g.pdir * (flip ? -1 : 1), v = lerp(rest, 1.85, ease.outCubic(g.point)); if (side > 0) armR = v; else armL = v; }
  if ((g.give || 0) > 0.01) { const side = g.gdir * (flip ? -1 : 1), v = lerp(rest, 1.3, ease.outCubic(g.give)); if (side > 0) armR = v; else armL = v; }
  const rd = g.read || 0;
  if (rd > 0.01) { armL = lerp(armL ?? rest, -0.42, ease.outCubic(rd)); armR = lerp(armR ?? rest, -0.42, ease.outCubic(rd)); }
  const pr = g.pray || 0;
  if (pr > 0.01) prayerFig(ctx, x, y, s * 1.18, g.pFrom, g.pTo, g.pU, look, al * pr, flip);
  if (pr < 0.99) fig(ctx, x, y, s, {
    ...look, walk: st.moving, phase: t * st.speed + i * 1.3, lean: st.lean + (extra.sway || 0), alpha: al * (1 - g.lie) * (1 - pr),
    flip, sx: g.sx, back: g.back, armL, armR, bob: extra.bob || 0, sit: g.sit,
    headDy: 10 * g.bow - 6 * g.look + 7 * rd, headDx: Math.sin(t * 22) * 6 * g.shake, wring: g.wring > 0.05, wringPh: t * 6,
  });
  if (rd > 0.01 && pr < 0.5) heldBook(ctx, x, y - (48 - 30 * g.sit * 0.55) * s, s, al * rd * (1 - pr));
  if (pr > 0.5) return;
  const hy = y - (100 - 30 * g.sit) * s;
  if (g.speak >= 0) speakArcs(ctx, x + (flip ? -1 : 1) * 12 * s, hy, g.speak, flip ? -1 : 1, s);
  if (g.look > 0.3) A.sparkle(ctx, x + 6 * s, hy - 70 * s, 8 * s, (g.look - 0.3) * 1.2);
}
// a group the viewer cannot count: overlapping rows, shadow swallowing both ends, rocks in front
function crowdUncountable(ctx, a, st, t, B, L, shadowCol) {
  fadeEnds(ctx, st.x, 205, 120, (o) => crowdRows(o, a, st, t, B, L));
  rockFig(ctx, st.x - 120, GY + 16, 0.42, st.alpha); rockFig(ctx, st.x + 30, GY + 22, 0.34, st.alpha); rockFig(ctx, st.x + 140, GY + 14, 0.45, st.alpha);
}
function crowdRows(ctx, a, st, t, B, L) {
  const rows = [{ n: 9, dy: -34, sc: 0.8, sp: 30, dark: 0.6 }, { n: 8, dy: -17, sc: 0.87, sp: 34, dark: 0.34 }, { n: 6, dy: 0, sc: 0.95, sp: 42, dark: 0.06 }];
  rows.forEach((r, ri) => {
    for (let j = r.n - 1; j >= 0; j--) {
      const i = ri * 10 + j;
      const x = st.x + ((j - (r.n - 1) / 2) * r.sp + (ri === 1 ? r.sp / 2 : 0)) * a.squeeze + Math.sin(t * 0.7 + i) * 2;
      const g = gest(a, t - j * 0.06 - ri * 0.1, B, L, st.x);
      const look = looksFor(a, i, (c) => c);
      look.robe = mixHex(look.robe, '#2b241e', r.dark); look.belt = mixHex(look.belt, '#2b241e', r.dark); look.scarf = mixHex(look.scarf ?? '#ffffff', '#2b241e', r.dark * 0.9);
      drawHuman(ctx, a, i, x, GY + r.dy + (i % 2) * 4 + (st.sink || 0), r.sc, t, st, g, { alpha: st.alpha * (1 - 0.6 * st.doom) }, look);
    }
  });
}

// ---- new settings: cave, cave_mouth, pass, sea_junction; garden rebuilt ----
const caveOpening = (ctx) => { ctx.beginPath(); ctx.moveTo(650, 650); ctx.bezierCurveTo(628, 430, 668, 236, 784, 206); ctx.bezierCurveTo(902, 196, 962, 340, 956, 650); ctx.closePath(); };
function caveSet(ctx, t, X) {
  const g = ctx.createLinearGradient(0, -300, 0, 1100);
  g.addColorStop(0, '#3a312a'); g.addColorStop(0.45, '#54473c'); g.addColorStop(1, '#382f28');
  ctx.fillStyle = g; ctx.fillRect(-500, -400, 2000, 1600);
  for (let i = 0; i < 30; i++) {
    const x = -300 + H(i, 901) * 1600, y = -120 + H(i, 902) * 760, r = 60 + H(i, 903) * 120;
    ctx.fillStyle = i % 2 ? 'rgba(90,76,62,0.35)' : 'rgba(40,33,27,0.35)';
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x - r * 0.3, y - r * 0.7); ctx.lineTo(x + r * 0.6, y - r * 0.5); ctx.lineTo(x + r, y + r * 0.2); ctx.lineTo(x + r * 0.1, y + r * 0.6); ctx.closePath(); ctx.fill();
  }
  // outside, seen through the opening
  const tm = TIMES[X.time];
  ctx.save(); caveOpening(ctx); ctx.clip();
  const sg = ctx.createLinearGradient(0, 200, 0, 650);
  sg.addColorStop(0, tm.top); sg.addColorStop(0.6, tm.mid); sg.addColorStop(1, tm.bot);
  ctx.fillStyle = sg; ctx.fillRect(600, 150, 420, 520);
  if (X.time === 'night') { ctx.save(); ctx.translate(620, 200); A.stars(ctx, 340, 300, 26, 9, t, 1); ctx.restore(); crescent(ctx, 880, 280, 22, 1); }
  if (X.sunArc >= 0) {
    const p = X.sunArc, sx = lerp(990, 620, p), sy = 330 - Math.sin(Math.PI * p) * 90;
    A.glowDisc(ctx, sx, sy, 34, '#fff6dc', '#ffd98a', 170, 1, 0.75);
  } else if (X.time === 'day' || X.time === 'dawn') A.glowDisc(ctx, 900, 280, 30, '#fff6dc', '#ffe0a0', 150, 1, 0.6);
  band(ctx, 560, 22, 911, '#c9b48e', 5, 600, 1000);
  palmSil(ctx, 720, 572, 0.3, t, '#a8946f', 3);
  ctx.fillStyle = '#dcc79c'; ctx.fillRect(600, 600, 420, 80);
  ctx.restore();
  // soft light that enters the cave
  const lk = X.time === 'night' ? 0.25 : X.time === 'dusk' ? 0.6 : 1;
  for (let k = 0; k < 5; k++) A.dust(ctx, lerp(700, 300, k / 4), lerp(520, 690, k / 4), lerp(200, 260, k / 4), (0.16 - k * 0.025) * lk, '#ffe8bf');
  ctx.strokeStyle = `rgba(255,226,180,${0.35 * lk})`; ctx.lineWidth = 7; caveOpening(ctx); ctx.stroke();
  // floor
  const fg = ctx.createLinearGradient(0, 620, 0, 1000);
  fg.addColorStop(0, '#6e604f'); fg.addColorStop(1, '#43392f');
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.moveTo(-500, 660); ctx.quadraticCurveTo(300, 620, 650, 645); ctx.lineTo(960, 648); ctx.quadraticCurveTo(1200, 650, 1500, 668); ctx.lineTo(1500, 1300); ctx.lineTo(-500, 1300); ctx.closePath(); ctx.fill();
  A.dust(ctx, 800, 690, 230, 0.32 * lk, '#ffe2b0');
  for (let i = 0; i < 9; i++) { ctx.fillStyle = 'rgba(40,32,26,0.45)'; ctx.beginPath(); ctx.ellipse(-200 + H(i, 921) * 1400, 700 + H(i, 922) * 180, 30 + H(i, 923) * 40, 8, 0, 0, TAU); ctx.fill(); }
  // overhang along the top
  ctx.fillStyle = '#2e2620';
  ctx.beginPath(); ctx.moveTo(-500, -400); ctx.lineTo(1500, -400); ctx.lineTo(1500, 40);
  for (let x = 1500; x >= -500; x -= 60) ctx.lineTo(x, 30 + Math.sin(x * 0.02) * 26 + H(x | 0, 931) * 30);
  ctx.closePath(); ctx.fill();
  // sun_arc: sunlight passes across the entrance from one side to the other and never reaches the sleepers
  if (X.sunArc >= 0 && X.time !== 'night') {
    const p = X.sunArc, a = Math.sin(Math.PI * clamp(p * 1.05)) * 0.9;
    const px = lerp(930, 668, p);
    ctx.save(); caveOpening(ctx); ctx.rect(600, 640, 400, 80); ctx.clip();
    A.dust(ctx, px, 640, 120, 0.5 * a, '#fff0c8');
    ctx.restore();
    ctx.save(); ctx.globalAlpha = a;
    const gr = ctx.createRadialGradient(px, 668, 4, px, 668, 110);
    gr.addColorStop(0, 'rgba(255,236,170,0.75)'); gr.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(px, 668, 110, 22, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
function caveMouthSet(ctx, t, X) {
  ctx.fillStyle = '#a8957a';
  const ridge = [[-400, 260], [-160, 190], [90, 128], [300, 160], [480, 78], [700, 116], [900, 64], [1120, 150], [1400, 210]];
  ctx.beginPath(); ctx.moveTo(-400, HY + 80); for (const [x, y] of ridge) ctx.lineTo(x, y); ctx.lineTo(1400, HY + 80); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8c7a62';
  for (let i = 0; i < ridge.length - 1; i += 2) { const [x0, y0] = ridge[i], [x1, y1] = ridge[i + 1]; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + 120, HY + 80); ctx.lineTo(x0 + 60, HY + 80); ctx.lineTo(lerp(x0, x1, 0.6), lerp(y0, y1, 0.6) + 60); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = 'rgba(70,55,40,0.25)'; ctx.lineWidth = 4;
  for (let k = 0; k < 6; k++) { const y = 220 + k * 60; ctx.beginPath(); ctx.moveTo(-400, y + 20); for (let x = -400; x <= 1400; x += 80) ctx.lineTo(x, y + Math.sin(x * 0.01 + k) * 12); ctx.stroke(); }
  // the cave entrance
  const ent = () => { ctx.beginPath(); ctx.moveTo(556, 646); ctx.bezierCurveTo(552, 520, 590, 438, 644, 432); ctx.bezierCurveTo(702, 436, 728, 520, 724, 646); ctx.closePath(); };
  const g = ctx.createRadialGradient(640, 600, 10, 640, 560, 150);
  g.addColorStop(0, '#0e0a08'); g.addColorStop(1, '#3a2e24');
  ctx.fillStyle = g; ent(); ctx.fill();
  ctx.strokeStyle = '#c4b293'; ctx.lineWidth = 8; ent(); ctx.stroke();
  // path, boulders, shrubs
  ctx.fillStyle = 'rgba(232,214,176,0.6)'; ctx.beginPath(); ctx.moveTo(560, 650); ctx.quadraticCurveTo(420, 720, 250, 900); ctx.lineTo(520, 900); ctx.quadraticCurveTo(600, 740, 720, 650); ctx.closePath(); ctx.fill();
  rockFig(ctx, 830, 668, 0.55); rockFig(ctx, 140, 650, 0.6); rockFig(ctx, 470, 640, 0.32);
  for (let i = 0; i < 8; i++) A.grass(ctx, -40 + i * 145 + H(i, 941) * 60, 690 + H(i, 942) * 140, 0.9, t, i + 70, '#7d8a45', '#99a356');
}
function passSet(ctx, t, X) {
  for (const side of [-1, 1]) {
    const edge = (y) => (side < 0 ? passL(y) : passR(y));
    const pts = [];
    for (let k = 0; k <= 12; k++) { const y = lerp(PASS.y0 + 40, -320, k / 12); pts.push([edge(Math.max(y, PASS.y1)) + side * (H(k + (side > 0 ? 50 : 0), 951) - 0.5) * 30 + (y < PASS.y1 ? side * (PASS.y1 - y) * 0.25 : 0), y]); }
    const g = ctx.createLinearGradient(side < 0 ? 350 : 610, 0, side < 0 ? -200 : 1160, 0);
    g.addColorStop(0, side < 0 ? '#9a8a72' : '#7d6e5c'); g.addColorStop(1, side < 0 ? '#7a6b58' : '#665a4b');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(side < 0 ? -600 : 1560, -320); ctx.lineTo(side < 0 ? -600 : 1560, PASS.y0 + 80); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(50,40,30,0.25)'; ctx.lineWidth = 4;
    for (let k = 1; k < 9; k++) { const y = lerp(PASS.y0, -200, k / 9); ctx.beginPath(); ctx.moveTo(edge(Math.max(y, PASS.y1)) + side * 10, y); ctx.lineTo(edge(Math.max(y, PASS.y1)) + side * 420, y + 40 * side); ctx.stroke(); }
    ctx.fillStyle = side < 0 ? 'rgba(255,240,210,0.12)' : 'rgba(20,14,10,0.12)';
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0] + side * 4, p[1]); for (let k = pts.length - 1; k >= 0; k--) ctx.lineTo(pts[k][0] + side * 70, pts[k][1]); ctx.closePath(); ctx.fill();
  }
  for (let i = 0; i < 7; i++) A.grass(ctx, -40 + i * 160 + H(i, 961) * 60, 720 + H(i, 962) * 130, 0.85, t, i + 80, '#8a8a4e', '#a3a35c');
}
// two seas of slightly different colour meeting; the seam never mixes
function seaJunction(ctx, t, X) {
  const seam = (y) => 480 + (y - SEA_HZ) * 0.22 + Math.sin(y * 0.06 + t * 0.7) * 5;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(-400, SEA_HZ); ctx.lineTo(1400, SEA_HZ); ctx.lineTo(1400, shoreY(1400));
  for (let x = 1400; x >= -400; x -= 40) ctx.lineTo(x, shoreY(x));
  ctx.closePath(); ctx.clip();
  waterBand(ctx, SEA_HZ, 700, t, '#8ad2c4', '#2a8070', 1);
  ctx.beginPath(); ctx.moveTo(-400, SEA_HZ - 2);
  for (let y = SEA_HZ - 2; y <= 700; y += 10) ctx.lineTo(seam(y), y);
  ctx.lineTo(-400, 700); ctx.closePath(); ctx.clip();
  waterBand(ctx, SEA_HZ, 700, t + 3, '#6fa9d8', '#1d4f86', 1);
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.moveTo(-400, SEA_HZ); ctx.lineTo(1400, SEA_HZ); ctx.lineTo(1400, 720); ctx.lineTo(-400, 720); ctx.closePath(); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); for (let y = SEA_HZ + 2; y <= shoreY(seam(y)); y += 6) { if (y === SEA_HZ + 2) ctx.moveTo(seam(y), y); else ctx.lineTo(seam(y), y); } ctx.stroke();
  for (let k = 0; k < 7; k++) { const y = SEA_HZ + 14 + ((k * 23 + t * 9) % 140); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(seam(y), y, 5 + (y - SEA_HZ) * 0.05, 0, TAU); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); for (let x = -400; x <= 1400; x += 20) { const y = shoreY(x) - 2 + Math.sin(t * 2 + x * 0.04) * 2.5; if (x === -400) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
}
// two gardens of grapevines on trellises, bordered by palms, crops between them and a river flowing through
function trellis(ctx, x0, x1, y, s, w, t, seed) {
  const n = Math.max(2, Math.round((x1 - x0) / (64 * s)));
  const post = (i) => { const x = lerp(x0, x1, i / n), tilt = w * (H(seed, i) - 0.5) * 0.9; return [x, y, x + Math.sin(tilt) * 44 * s, y - Math.cos(tilt) * 44 * s * (1 - 0.35 * w)]; };
  ctx.strokeStyle = '#7a5532'; ctx.lineWidth = 4 * s; ctx.lineCap = 'round';
  for (let i = 0; i <= n; i++) { const [ax, ay, bx, by] = post(i); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
  ctx.beginPath(); for (let i = 0; i <= n; i++) { const [, , bx, by] = post(i); if (i === 0) ctx.moveTo(bx, by); else ctx.quadraticCurveTo(lerp(post(i - 1)[2], bx, 0.5), by + w * 16 * s, bx, by); } ctx.stroke();
  const leaf = mixHex('#4f8f3a', '#8a7444', w), leaf2 = mixHex('#68a84a', '#a08a52', w);
  for (let i = 0; i < n * 3; i++) {
    const u = (i + 0.5) / (n * 3), k = Math.floor(u * n), [, , bx0, by0] = post(k), [, , bx1, by1] = post(Math.min(n, k + 1)), f = u * n - k;
    const cx = lerp(bx0, bx1, f), cy = lerp(by0, by1, f) + w * (10 + Math.sin(f * Math.PI) * 14) * s;
    ctx.fillStyle = i % 2 ? leaf : leaf2;
    ctx.beginPath(); ctx.ellipse(cx, cy - 4 * s + Math.sin(t * 1.2 + i) * 1.2, 16 * s, (11 - 4 * w) * s, 0, 0, TAU); ctx.fill();
    if (i % 3 === 1) {
      const fall = clamp(w * 1.5 - H(seed, i + 40) * 0.5), gy = lerp(cy + 12 * s, y + 4, ease.inCubic(fall));
      ctx.fillStyle = mixHex('#6a3a7a', '#4a3a3a', w);
      for (let q = 0; q < 4; q++) { ctx.beginPath(); ctx.arc(cx + (q % 2 ? 3 : -3) * s, gy + Math.floor(q / 2) * 5 * s, 3.6 * s, 0, TAU); ctx.fill(); }
    }
  }
}
function gardenSet(ctx, t, X) {
  const w = X.wither;
  // river flowing across the middle ground, between the gardens and the near bank
  const R0 = 640, R1 = 668;
  const g = ctx.createLinearGradient(0, R0, 0, R1);
  g.addColorStop(0, '#8fd0e8'); g.addColorStop(1, '#4596c4');
  ctx.fillStyle = g; ctx.fillRect(-500, R0, 2000, R1 - R0);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) { const x = ((i * 113 + t * 34) % 1700) - 350, y = R0 + 6 + H(i, 971) * (R1 - R0 - 10); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 36, y); ctx.stroke(); }
  // palms bordering the gardens (back row)
  for (let i = 0; i < 9; i++) { const x = -80 + i * 140; if (x > 360 && x < 600) continue; palmC(ctx, x, 584, 0.52, t, 20 + i, 0.06 * (i % 2 ? 1 : -1), w); }
  // crops between the two gardens
  for (let k = 0; k < 6; k++) {
    const y = 594 + k * 7, hgt = lerp(14, 5, w) * (0.6 + k * 0.1);
    ctx.strokeStyle = mixHex(k % 2 ? '#c9b54a' : '#a9b84a', '#8a7a50', w); ctx.lineWidth = 2.2;
    ctx.beginPath(); for (let x = 372; x < 592; x += 7) { const sway = Math.sin(t * 1.6 + x * 0.05) * 2 * (1 - w); ctx.moveTo(x, y); ctx.lineTo(x + sway + w * 6, y - hgt); } ctx.stroke();
  }
  // the two vineyards
  for (const [x0, x1] of [[-140, 350], [612, 1100]]) {
    trellis(ctx, x0, x1, 598, 0.95, w, t, x0 + 1000);
    trellis(ctx, x0 - 20, x1 + 20, 628, 1.25, w, t, x0 + 2000);
  }
  // border palms, near
  palmC(ctx, -30, 732, 0.82, t, 11, 0.1 + X.wind * 0.25, w); palmC(ctx, 990, 726, 0.8, t, 13, -0.08 + X.wind * 0.25, w);
  for (let i = 0; i < 9; i++) A.grass(ctx, -60 + i * 130 + H(i, 17) * 50, 745 + H(i, 18) * 90, 1.0, t, i + 31, mixHex('#5c9a3e', '#9a8048', w), mixHex('#7cb850', '#b39a5e', w));
}
Object.assign(SETTINGS, {
  garden: { ground: ['#a9c87a', '#8fb062', 'rgba(255,255,255,0.10)'], far(ctx, t) { band(ctx, HY - 10, 34, 151, '#b9d39a'); }, mid(ctx, t, X) { gardenSet(ctx, t, X); } },
  cave: { interior: true, tint: ['#8c7c6a', 0.3], back(ctx, t, X) { caveSet(ctx, t, X); } },
  cave_mouth: {
    ground: ['#cdb68c', '#b39c73', 'rgba(150,120,80,0.3)'],
    far(ctx) { const far = peaks(181, 6, -160, 1120, 160, 250, 320, 440); A.mountains(ctx, far, HY + 5, '#b8c3cf', '#a0aebd'); },
    mid(ctx, t, X) { caveMouthSet(ctx, t, X); },
  },
  pass: {
    ground: ['#c9b68e', '#b19d76', 'rgba(150,120,80,0.3)'],
    far(ctx) { band(ctx, HY - 6, 8, 191, '#d8ccb0'); headland(ctx, 380, 600, HY - 2, 22, '#b9b6aa', '#a5a296'); },
    mid(ctx, t, X) { passSet(ctx, t, X); },
  },
  sea_junction: {
    ground: ['#ecd5a6', '#dcc08c', 'rgba(190,150,90,0.3)'], junction: true,
    far(ctx) { headland(ctx, -200, 220, SEA_HZ + 2, 40, '#b9c7c9', '#a2b3b6'); },
    mid(ctx, t, X) {
      if (!X.L.actors.some((a) => a.type === 'rock')) rockFig(ctx, 110, 712, 0.9);
      palmC(ctx, 1010, 728, 0.72, t, 17, -0.08 + X.wind * 0.25, 0);
      for (let i = 0; i < 5; i++) A.grass(ctx, 160 + i * 190 + H(i, 981) * 60, 780 + H(i, 982) * 70, 0.8, t, i + 90, '#8a9a4e', '#a6b35c');
    },
  },
});

// ================================================================ daily-life pack (home, prayer hall, market, fields)
// a small oil lamp hanging on a chain; the flame flickers and glows more at night
function hangLamp(ctx, x, y, s, t, night, seed = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = '#6b5638'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -400); ctx.lineTo(0, -18); ctx.stroke();
  ctx.fillStyle = '#b8893f';
  ctx.beginPath(); ctx.moveTo(-20, -18); ctx.lineTo(20, -18); ctx.lineTo(12, 8); ctx.lineTo(-12, 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e0b860'; ctx.beginPath(); ctx.ellipse(0, -18, 20, 5, 0, 0, TAU); ctx.fill();
  const fl = 1 + Math.sin(t * 9 + seed) * 0.08 + Math.sin(t * 13.7 + seed * 2) * 0.05;
  A.glowDisc(ctx, 0, -30, 6 * fl, '#fff3c4', '#ffc760', 60 + 70 * night, 1, 0.35 + 0.35 * night);
  ctx.fillStyle = '#ffd77a'; ctx.beginPath(); ctx.ellipse(0, -30, 4.5 * fl, 9 * fl, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
// the sky seen through a window or an arch, by time of day
function skyThrough(ctx, t, X, x, y, w, h) {
  const tm = TIMES[X.time];
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, tm.top); g.addColorStop(0.6, tm.mid); g.addColorStop(1, tm.bot);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  if (X.time === 'night') { ctx.save(); ctx.translate(x, y); A.stars(ctx, w, h, 12, 31, t, 1); ctx.restore(); crescent(ctx, x + w * 0.7, y + h * 0.3, 14, 1); }
  else if (X.time === 'day' || X.time === 'dawn') A.glowDisc(ctx, x + w * 0.68, y + h * (X.time === 'dawn' ? 0.7 : 0.3), 16, '#fff8e6', '#ffe7a8', 70, 1, 0.5);
}
function carpet(ctx, x0, x1, y0, y1, base, border, stripe, rows = 0) {
  ctx.fillStyle = base; ctx.beginPath(); ctx.moveTo(x0 + 40, y0); ctx.lineTo(x1 - 40, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = border; ctx.lineWidth = 10; ctx.stroke();
  ctx.strokeStyle = stripe; ctx.lineWidth = 3;
  if (rows) for (let k = 1; k < rows; k++) { const y = lerp(y0, y1, k / rows), dx = lerp(40, 0, k / rows); ctx.beginPath(); ctx.moveTo(x0 + dx + 8, y); ctx.lineTo(x1 - dx - 8, y); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(x0 + 70, y0 + 24); ctx.lineTo(x1 - 70, y0 + 24); ctx.lineTo(x1 - 34, y1 - 24); ctx.lineTo(x0 + 34, y1 - 24); ctx.closePath(); ctx.stroke(); }
}
function homeSet(ctx, t, X) {
  const g = ctx.createLinearGradient(0, -300, 0, 660);
  g.addColorStop(0, '#d9c6a4'); g.addColorStop(1, '#ead9bb');
  ctx.fillStyle = g; ctx.fillRect(-500, -400, 2000, 1060);
  ctx.fillStyle = 'rgba(170,140,100,0.18)';
  for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.ellipse(-300 + H(i, 301) * 1500, -100 + H(i, 302) * 700, 60 + H(i, 303) * 90, 20 + H(i, 304) * 30, 0, 0, TAU); ctx.fill(); }
  // ceiling beams
  ctx.fillStyle = '#7a5a3a'; ctx.fillRect(-500, -60, 2000, 26);
  for (let i = 0; i < 9; i++) { ctx.fillStyle = '#6a4c30'; ctx.fillRect(-380 + i * 190, -60, 16, 34); }
  // window with a wooden lattice
  const wx = 600, wy = 170, ww = 200, wh = 250;
  ctx.fillStyle = '#7a5a3a'; A.archRect(ctx, wx - 14, wy - 14, ww + 28, wh + 28);
  ctx.save(); ctx.beginPath(); const r = ww / 2; ctx.moveTo(wx, wy + wh); ctx.lineTo(wx, wy + r); ctx.arc(wx + r, wy + r, r, Math.PI, 0); ctx.lineTo(wx + ww, wy + wh); ctx.closePath(); ctx.clip();
  skyThrough(ctx, t, X, wx, wy, ww, wh);
  ctx.strokeStyle = 'rgba(110,80,50,0.75)'; ctx.lineWidth = 4;
  for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(wx + (ww * k) / 4, wy); ctx.lineTo(wx + (ww * k) / 4, wy + wh); ctx.stroke(); }
  for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(wx, wy + (wh * k) / 5); ctx.lineTo(wx + ww, wy + (wh * k) / 5); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = '#6a4c30'; ctx.fillRect(wx - 24, wy + wh + 10, ww + 48, 14);
  // shelf with jars, a lamp hanging
  ctx.fillStyle = '#7a5a3a'; ctx.fillRect(70, 360, 250, 12);
  A.pot(ctx, 120, 360, 0.75, '#b5683c'); A.pot(ctx, 200, 360, 0.6, '#c98a4a'); A.pot(ctx, 270, 360, 0.7, '#9a5a32');
  hangLamp(ctx, 380, 200, 1, t, X.night, 1);
  // floor, cushions, rug
  ctx.fillStyle = '#c8ad84'; ctx.fillRect(-500, 640, 2000, 600);
  ctx.fillStyle = '#b39670'; ctx.fillRect(-500, 640, 2000, 8);
  for (const [x, col] of [[-60, '#a8453a'], [120, '#2f6b8a'], [300, '#b8893f'], [760, '#3f7a5a'], [940, '#8a3f6a']]) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, 640, 82, 26, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 82, 640, 164, 14);
  }
  carpet(ctx, 60, 900, 676, 860, '#9b3d32', '#6e2a22', '#e0b860');
  if (X.night > 0) { ctx.save(); ctx.globalAlpha = 0.35 * X.night; A.glowDisc(ctx, 380, 170, 1, 'rgba(0,0,0,0)', '#ffcf6b', 380, 1, 0.5); ctx.restore(); }
}
function prayerHallSet(ctx, t, X) {
  const g = ctx.createLinearGradient(0, -300, 0, 660);
  g.addColorStop(0, '#e2d4b8'); g.addColorStop(1, '#f1e7d2');
  ctx.fillStyle = g; ctx.fillRect(-500, -400, 2000, 1060);
  // an arcade: arches open onto a bright courtyard, columns between them
  const cols = [-200, 40, 280, 520, 760, 1000, 1240];
  for (let i = 0; i < cols.length - 1; i++) {
    const x0 = cols[i] + 26, w = cols[i + 1] - cols[i] - 52;
    ctx.save(); ctx.beginPath(); const r = w / 2; ctx.moveTo(x0, 600); ctx.lineTo(x0, 150 + r); ctx.arc(x0 + r, 150 + r, r, Math.PI, 0); ctx.lineTo(x0 + w, 600); ctx.closePath(); ctx.clip();
    skyThrough(ctx, t, X, x0, 120, w, 300);
    ctx.fillStyle = X.time === 'night' ? '#3a3a52' : '#e8d8b4'; ctx.fillRect(x0, 420, w, 200);
    ctx.fillStyle = X.time === 'night' ? '#2e2e44' : '#d9c49a'; ctx.fillRect(x0, 470, w, 140);
    ctx.restore();
    ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 10;
    ctx.beginPath(); const r2 = w / 2; ctx.moveTo(x0, 600); ctx.lineTo(x0, 150 + r2); ctx.arc(x0 + r2, 150 + r2, r2, Math.PI, 0); ctx.lineTo(x0 + w, 600); ctx.stroke();
    hangLamp(ctx, x0 + w / 2, 250, 0.8, t, X.night, i);
  }
  for (const x of cols) { ctx.fillStyle = '#d6c29a'; ctx.fillRect(x - 26, 120, 52, 520); ctx.fillStyle = '#c4ad82'; ctx.fillRect(x - 32, 120, 64, 20); ctx.fillRect(x - 32, 610, 64, 30); }
  ctx.fillStyle = '#c9b48a'; ctx.fillRect(-500, 96, 2000, 26);
  // floor: a green carpet with straight prayer rows
  ctx.fillStyle = '#d6c4a0'; ctx.fillRect(-500, 640, 2000, 600);
  carpet(ctx, -260, 1220, 648, 900, '#2f6b55', '#244f40', 'rgba(230,200,110,0.75)', 6);
  if (X.night > 0) { ctx.save(); ctx.globalAlpha = 0.3 * X.night; for (let i = 0; i < cols.length - 1; i++) A.glowDisc(ctx, (cols[i] + cols[i + 1]) / 2, 230, 1, 'rgba(0,0,0,0)', '#ffcf6b', 200, 1, 0.5); ctx.restore(); }
  if (X.time === 'day' || X.time === 'dawn') for (let k = 0; k < 4; k++) A.dust(ctx, 160 + k * 220, 520, 160, 0.10, '#fff3d0');
}
function stall(ctx, x, y, t, X, seed, cols) {
  const wv = Math.sin(t * 2 + seed) * 3 * (0.4 + X.wind);
  ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 96, y - 150, 8, 150); ctx.fillRect(x + 88, y - 150, 8, 150);
  // striped awning
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = k % 2 ? cols[0] : cols[1];
    ctx.beginPath(); ctx.moveTo(x - 110 + k * 37, y - 160); ctx.lineTo(x - 73 + k * 37, y - 160);
    ctx.lineTo(x - 73 + k * 37 + wv, y - 120); ctx.quadraticCurveTo(x - 91 + k * 37 + wv, y - 110, x - 110 + k * 37 + wv, y - 120); ctx.closePath(); ctx.fill();
  }
  // counter and goods
  ctx.fillStyle = '#9a7448'; ctx.fillRect(x - 92, y - 58, 184, 58); ctx.fillStyle = '#7d5c36'; ctx.fillRect(x - 92, y - 58, 184, 8);
  const goods = H(seed, 7) > 0.5;
  for (let k = 0; k < 3; k++) {
    const gx = x - 60 + k * 60;
    if (goods) { ctx.fillStyle = ['#d8c38e', '#c9a46a', '#e2cf9a'][k]; ctx.beginPath(); ctx.ellipse(gx, y - 78, 24, 22, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(120,90,50,0.35)'; ctx.fillRect(gx - 10, y - 102, 20, 6); }
    else { ctx.fillStyle = '#8a6a3a'; ctx.beginPath(); ctx.ellipse(gx, y - 66, 26, 12, 0, 0, TAU); ctx.fill(); for (let f = 0; f < 5; f++) { ctx.fillStyle = ['#d9533b', '#f0a73a', '#7cb850', '#c0392b', '#e8c547'][(f + k) % 5]; ctx.beginPath(); ctx.arc(gx - 14 + f * 7, y - 74 - (f % 2) * 6, 7, 0, TAU); ctx.fill(); } }
  }
}
function marketSet(ctx, t, X) {
  buildings(ctx, SETTINGS.city.houses, t, X, 0);
  stall(ctx, 90, 690, t, X, 1, ['#c8483f', '#f1e4c8']);
  stall(ctx, 860, 684, t, X, 2, ['#2f7fb8', '#f1e4c8']);
  ctx.save(); ctx.globalAlpha = 0.95; stall(ctx, 470, 640, t, X, 3, ['#3f9a6b', '#f1e4c8']); ctx.restore();
  A.pot(ctx, 220, 740, 0.8, '#b5683c'); A.pot(ctx, 735, 744, 0.7, '#9a5a32');
}
function fieldsSet(ctx, t, X) {
  const w = X.wither;
  palmC(ctx, -40, 640, 0.6, t, 41, 0.1 + X.wind * 0.2, w); palmC(ctx, 1000, 636, 0.62, t, 42, -0.08 + X.wind * 0.2, w);
  for (let r = 0; r < 7; r++) {
    const y = 600 + r * 26 + r * r * 3.2, sc = 0.55 + r * 0.12;
    const col = mixHex(mixHex('#d8b44a', '#9cc06e', X.grow || 0), '#a88d62', w);
    for (let x = -60 + (r % 2) * 14; x < 1020; x += 18 + r * 3) {
      const sway = Math.sin(t * 1.5 + x * 0.02 + r) * 4 * sc * (1 + X.wind * 2), hgt = (46 + H(x, r) * 12) * sc * (1 - 0.45 * w);
      ctx.strokeStyle = A.shade(col, -0.18); ctx.lineWidth = 2.2 * sc;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sway * 0.4, y - hgt * 0.6, x + sway, y - hgt); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x + sway, y - hgt - 6 * sc, 3.4 * sc, 9 * sc, sway * 0.03, 0, TAU); ctx.fill();
    }
  }
}
Object.assign(SETTINGS, {
  home: { interior: true, tint: ['#c9a87a', 0.12], back(ctx, t, X) { homeSet(ctx, t, X); } },
  prayer_hall: { interior: true, back(ctx, t, X) { prayerHallSet(ctx, t, X); } },
  market: {
    ground: ['#dcbf92', '#c8a474', 'rgba(150,105,60,0.3)'],
    far(ctx) { band(ctx, HY - 16, 28, 117, '#dcc09a'); band(ctx, HY - 2, 16, 119, '#d6b68c'); },
    mid(ctx, t, X) { marketSet(ctx, t, X); },
  },
  fields: {
    ground: ['#d7c48a', '#bfa86c', 'rgba(255,255,255,0.10)'],
    far(ctx, t) { band(ctx, HY - 8, 30, 171, '#c9cf98'); for (let i = 0; i < 5; i++) palmSil(ctx, 80 + i * 210 + H(i, 171) * 50, HY - 2, 0.3 + H(i, 172) * 0.08, t, '#a3ad7a', i + 40); },
    mid(ctx, t, X) { fieldsSet(ctx, t, X); },
  },
});

// a faceless person in prayer, seen from the side (facing +x): standing with folded hands, bowing, prostrating, sitting.
// Joint keyframes (feet baseline at y = 0); poses blend by lerping the joints.
const PRAY_POSES = {
  stand: { F: [0, 0], K: [0, -26], Hp: [0, -50], Sh: [3, -84], Hd: [5, -103], Hn: [16, -64] },
  ruku: { F: [0, 0], K: [0, -26], Hp: [-6, -52], Sh: [34, -58], Hd: [54, -62], Hn: [8, -30] },
  sujud: { F: [-38, 0], K: [0, -2], Hp: [-20, -30], Sh: [20, -24], Hd: [38, -12], Hn: [44, -3] },
  julus: { F: [-30, 0], K: [20, -2], Hp: [-16, -14], Sh: [-10, -50], Hd: [-8, -69], Hn: [16, -16] },
};
function prayerFig(ctx, x, y, s, from, to, u, look, alpha, flip) {
  const A0 = PRAY_POSES[from] || PRAY_POSES.stand, A1 = PRAY_POSES[to] || PRAY_POSES.stand, k = ease.inOutSine(clamp(u));
  const P = (j) => [lerp(A0[j][0], A1[j][0], k), lerp(A0[j][1], A1[j][1], k)];
  const F = P('F'), K = P('K'), Hp = P('Hp'), Sh = P('Sh'), Hd = P('Hd'), Hn = P('Hn');
  const robe = look.robe ?? '#f1ece0', skin = '#e7b98f', scarf = look.scarf ?? '#ffffff';
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (flip ? -1 : 1), s); ctx.globalAlpha *= alpha;
  ctx.fillStyle = 'rgba(40,25,10,0.18)'; ctx.beginPath(); ctx.ellipse(4, 0, 34, 6, 0, 0, TAU); ctx.fill();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = A.shade(robe, -0.12); ctx.lineWidth = 24;
  ctx.beginPath(); ctx.moveTo(F[0], F[1] - 6); ctx.lineTo(K[0], K[1]); ctx.lineTo(Hp[0], Hp[1]); ctx.stroke();
  ctx.strokeStyle = robe; ctx.lineWidth = 36;
  ctx.beginPath(); ctx.moveTo(Hp[0], Hp[1]); ctx.lineTo(Sh[0], Sh[1]); ctx.stroke();
  ctx.fillStyle = '#3b2a22'; ctx.beginPath(); ctx.ellipse(F[0] + 8, F[1] - 3, 10, 4, 0, 0, TAU); ctx.fill();
  if (look.belt) { const m = [lerp(Hp[0], Sh[0], 0.18), lerp(Hp[1], Sh[1], 0.18)]; ctx.strokeStyle = look.belt; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(m[0] - 1, m[1]); ctx.lineTo(m[0] + 1, m[1]); ctx.stroke(); }
  // head: skin, covered by the head cloth on the top and the back (no features)
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(Hd[0], Hd[1], 14, 0, TAU); ctx.fill();
  const ang = Math.atan2(Hd[1] - Sh[1], Hd[0] - Sh[0]) + Math.PI / 2;
  ctx.save(); ctx.translate(Hd[0], Hd[1]); ctx.rotate(ang);
  ctx.fillStyle = scarf;
  ctx.beginPath(); ctx.arc(0, 0, 17, Math.PI * 0.9, Math.PI * 2.05); ctx.lineTo(-6, 22); ctx.lineTo(-16, 20); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.ellipse(-1, -10, 15, 4, 0, 0, TAU); ctx.stroke();
  ctx.restore();
  // arm
  ctx.strokeStyle = A.shade(robe, -0.06); ctx.lineWidth = 11;
  const El = [lerp(Sh[0], Hn[0], 0.5) + 6, lerp(Sh[1], Hn[1], 0.5) + 4];
  ctx.beginPath(); ctx.moveTo(Sh[0], Sh[1] + 4); ctx.quadraticCurveTo(El[0], El[1], Hn[0], Hn[1]); ctx.stroke();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(Hn[0], Hn[1], 5.5, 0, TAU); ctx.fill();
  ctx.restore();
}
// an open book held in both hands
function heldBook(ctx, x, y, s, a) {
  if (a <= 0.01) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha *= a;
  ctx.fillStyle = '#7a4a2a'; ctx.beginPath(); ctx.moveTo(-26, -4); ctx.lineTo(0, 2); ctx.lineTo(26, -4); ctx.lineTo(26, 14); ctx.lineTo(0, 20); ctx.lineTo(-26, 14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fbf6e6'; ctx.beginPath(); ctx.moveTo(-23, -6); ctx.quadraticCurveTo(-11, -10, 0, -2); ctx.lineTo(0, 15); ctx.quadraticCurveTo(-11, 8, -23, 11); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(23, -6); ctx.quadraticCurveTo(11, -10, 0, -2); ctx.lineTo(0, 15); ctx.quadraticCurveTo(11, 8, 23, 11); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(120,100,70,0.5)'; ctx.lineWidth = 1.2;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-19, -2 + k * 5); ctx.lineTo(-4, 0 + k * 5); ctx.moveTo(4, 0 + k * 5); ctx.lineTo(19, -2 + k * 5); ctx.stroke(); }
  ctx.restore();
}
// a small cloth purse that travels from the giver to the receiver, then a sparkle
function givePurse(ctx, x0, x1, y, age) {
  if (age < 0.25 || age > 2.2) return;
  const p = ease.inOutSine(clamp((age - 0.25) / 1.0)), x = lerp(x0, x1, p), yy = y - Math.sin(Math.PI * p) * 50;
  const fade = 1 - prog(age, 1.6, 2.2);
  ctx.save(); ctx.globalAlpha *= fade;
  ctx.fillStyle = '#c9a046'; ctx.beginPath(); ctx.ellipse(x, yy, 11, 10, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#a8803a'; ctx.beginPath(); ctx.moveTo(x - 6, yy - 8); ctx.lineTo(x + 6, yy - 8); ctx.lineTo(x + 3, yy - 15); ctx.lineTo(x - 3, yy - 15); ctx.closePath(); ctx.fill();
  ctx.restore();
  if (p >= 1) A.sparkle(ctx, x1, y - 18, 12, fade * (1 - prog(age, 1.25, 2.0)) * 0.9 + 0.1 * fade);
}

// the fish slips from the basket into the water and leaves a tunnel-like trail
function fishEscape(ctx, t, age, a, st, L) {
  if (age < 0) return;
  const set = SETTINGS[L.setting];
  const dir = st.x < 480 ? 1 : -1;
  const ex = st.x + dir * 120;
  const ey = set.sea || set.junction ? shoreY(ex) - 16 : set.river ? RIV0 + 24 : GY - 40;
  const x0 = st.x + 4, y0 = GY - 46;
  if (age < 1.0) {
    const p = ease.inOutSine(age / 1.0), x = lerp(x0, ex, p), y = lerp(y0, ey, p) - Math.sin(Math.PI * p) * 120;
    const ang = Math.atan2(lerp(y0, ey, Math.min(1, p + 0.05)) - Math.sin(Math.PI * Math.min(1, p + 0.05)) * 120 - y, (ex - x0) * 0.05);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = '#9fb7c4'; ctx.beginPath(); ctx.ellipse(0, 0, 24, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7f9aaa'; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-34, -9); ctx.lineTo(-32, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
    for (let k = 1; k < 5; k++) A.sparkle(ctx, lerp(x0, ex, Math.max(0, p - k * 0.06)), lerp(y0, ey, Math.max(0, p - k * 0.06)) - Math.sin(Math.PI * Math.max(0, p - k * 0.06)) * 120, 5, 0.6 * (1 - k / 5));
    return;
  }
  const q = age - 1.0;
  if (q < 1.2) for (let k = 0; k < 3; k++) { const r = prog(q, k * 0.2, k * 0.2 + 1); if (r > 0 && r < 1) { ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - r)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(ex, ey, 8 + r * 60, 3 + r * 14, 0, 0, TAU); ctx.stroke(); } }
  if (!(set.sea || set.junction || set.river)) return;
  const grow = ease.outCubic(clamp(q / 2.6));
  const yEnd = set.sea || set.junction ? SEA_HZ + 14 : ey - 30;
  const P = (u) => [ex + dir * u * 300 + Math.sin(u * 4) * 26, lerp(ey, yEnd, u)];
  const Wd = (u) => lerp(28, 6, u);
  const steps = 24, um = grow;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) { const u = (i / steps) * um, [x, y] = P(u); ctx.lineTo(x, y - Wd(u) * 0.35); }
  for (let i = steps; i >= 0; i--) { const u = (i / steps) * um, [x, y] = P(u); ctx.lineTo(x, y + Wd(u) * 0.35); }
  ctx.closePath(); ctx.fillStyle = 'rgba(12,44,70,0.55)'; ctx.fill();
  ctx.strokeStyle = 'rgba(190,235,250,0.85)'; ctx.lineWidth = 2;
  for (let k = 1; k < 9; k++) { const u = (k / 9) * um; if (u <= 0.02) continue; const [x, y] = P(u), r = Wd(u) * 0.5; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, 0, Math.PI, TAU); ctx.stroke(); }
  if (grow < 1) { const [fx, fy] = P(um); ctx.fillStyle = '#c4d8e2'; ctx.beginPath(); ctx.ellipse(fx, fy, 9 * (1 - um * 0.6), 3.5, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

function skyColors(time, E, SF, SR) {
  const tm = TIMES[time];
  let top = tm.top, mid = tm.mid, bot = tm.bot;
  if (SF >= 0) { top = mixHex(top, '#5a3a5e', SF * 0.85); mid = mixHex(mid, '#d0704c', SF); bot = mixHex(bot, '#f1a35c', SF); }
  if (SR >= 0) { top = mixHex(top, '#f3e2b0', SR); mid = mixHex(mid, '#fff0c8', SR); bot = mixHex(bot, '#fffaf0', SR); }
  const storm = Math.max(E.k('storm', 1.2, 1), E.k('lightning', 1.2, 1) * 0.9, E.k('rain', 1.2, 1) * 0.45);
  if (storm > 0) { top = mixHex(top, '#4a5068', storm * 0.8); mid = mixHex(mid, '#6a7084', storm * 0.75); bot = mixHex(bot, '#9a9c9e', storm * 0.6); }
  return [top, mid, bot, storm];
}
const evDur = (ev, d) => (ev.t1 < BIG / 2 ? clamp(ev.t1 - ev.t0, 3, 30) : d);

function stageDraw(ctx, t, T) {
  const P = (T?.c?.params && typeof T.c.params === 'object') ? T.c.params : {};
  const pkey = JSON.stringify(P);
  const L = layout(P);
  const set = SETTINGS[L.setting], tm = TIMES[L.time];
  const E = events(P, t, T);
  const B = beatList(P, T);
  const [s, e] = win(T);
  const c = stageCamera(t, T, P, L, E, B, pkey);
  const st = E.st;
  const X = {
    L, time: L.time,
    night: L.time === 'night' ? 1 : L.time === 'dusk' ? 0.5 : 0,
    wind: Math.max(E.k('storm', 1, 1), pulseOf(B, t, 'wind', 2.6, 0.4)), storm: E.k('storm', 1, 1),
    quake: E.k('quake', 0.2, 1),
    ruinT: st.ruin ? st.ruin.t0 : -BIG, ruin: st.ruin ? ease.inCubic(prog(t, st.ruin.t0, st.ruin.t0 + 1.5)) : 0,
    sunArc: st.sun_arc ? prog(t, st.sun_arc.t0, st.sun_arc.t0 + evDur(st.sun_arc, 9)) : -1,
    sleepSide: lerp(1, Math.cos(Math.PI * Math.max(0, t - (st.turn_sleepers?.t0 ?? 0)) / 3.2), st.turn_sleepers ? E.k('turn_sleepers', 0.8, 0.8) : 0),
    wake: st.wake ? ease.inOutSine(prog(t, st.wake.t0, st.wake.t0 + 1.5)) : 0,
    wither: st.wither ? ease.inOutSine(prog(t, st.wither.t0, st.wither.t0 + evDur(st.wither, 4))) : 0,
    fish: st.fish_escape ? t - st.fish_escape.t0 : -1,
    hole: st.ship_hole ? prog(t, st.ship_hole.t0, st.ship_hole.t0 + 1.4) : 0,
    repair: st.wall_repair ? Math.min(2, (t - st.wall_repair.t0) / evDur(st.wall_repair, 3.5)) : 0,
  };
  if (st.barrier_build) {
    const q = (t - st.barrier_build.t0) / evDur(st.barrier_build, 10);
    X.barrier = { stack: clamp(q / 0.45), heat: clamp((q - 0.4) / 0.15), pour: clamp((q - 0.62) / 0.38) };
  } else X.barrier = { stack: 0, heat: 0, pour: 0 };
  const SF = st.sunset_far ? ease.inOutSine(prog(t, st.sunset_far.t0, st.sunset_far.t0 + evDur(st.sunset_far, 9))) : -1;
  const SR = st.sunrise_open ? ease.outCubic(prog(t, st.sunrise_open.t0, st.sunrise_open.t0 + evDur(st.sunrise_open, 6))) : -1;
  const LT = lightningAt(t, E);
  if (!set.interior) {
    const [skyTop, skyMid, skyBot, stormK] = skyColors(L.time, E, SF, SR);
    A.sky(ctx, SW, SH, skyTop, skyBot, skyMid);
    if (tm.stars && SR < 0) A.stars(ctx, SW, 470, 70, 7, t, tm.stars * (1 - stormK) * (SF >= 0 ? 1 : 1));
    withCam(ctx, par(c, 0.15), () => {
      if (SF >= 0) A.glowDisc(ctx, 230, lerp(HY - 240, HY + 34, SF), 60, '#ffe2aa', '#ff8a4a', 300, 1 - stormK * 0.8, 0.7);
      else if (SR >= 0) A.glowDisc(ctx, 730, lerp(HY + 50, 190, SR), 66, '#fffbe8', '#fff0b0', 520, 1, 0.8);
      else if (tm.sun) {
        const sy = lerp(tm.sun[1], tm.sun[2], ease.inOutSine(prog(t, s - 0.4, e + 0.4)));
        A.glowDisc(ctx, tm.sun[0], sy, tm.sunR, tm.core, tm.glow, tm.sunR * 4.2, 1 - stormK * 0.85, 0.65);
      }
      if (tm.moon && SR < 0) crescent(ctx, tm.moon[0], tm.moon[1], tm.moon[2], 1 - stormK * 0.7);
      if ((L.time === 'day' || L.time === 'dawn') && SF < 0) {
        A.cloud(ctx, (150 + t * 6) % 1250 - 180, 120, 0.8, 0.85 * (1 - stormK));
        A.cloud(ctx, (780 + t * 4) % 1250 - 180, 190, 0.55, 0.7 * (1 - stormK));
      }
    });
    if (LT.flash > 0) { ctx.fillStyle = `rgba(235,240,255,${LT.flash * 0.55})`; ctx.fillRect(0, 0, SW, SH); }
    if (stormK > 0.01) withCam(ctx, par(c, 0.2), () => { for (let i = 0; i < 7; i++) cloudSolid(ctx, ((i * 210 + t * (8 + i * 2) * (0.4 + X.wind)) % 1500) - 260, 60 + (i % 3) * 60, 1.5 - (i % 3) * 0.2, stormK, i % 2 ? '#5d6478' : '#6e7589'); });
    cloudsPart(ctx, B, t);
    withCam(ctx, par(c, 0.3), () => {
      set.far(ctx, t);
      if (SF >= 0 && !set.sea && !set.junction) {
        const g = ctx.createLinearGradient(0, HY - 22, 0, HY + 10);
        g.addColorStop(0, '#2a4252'); g.addColorStop(1, '#1a2a36');
        ctx.fillStyle = g; ctx.fillRect(-700, HY - 22, 2400, 34);
        ctx.fillStyle = `rgba(255,190,110,${0.55 * SF})`;
        for (let k = 0; k < 6; k++) ctx.fillRect(230 - 40 + Math.sin(t * 2 + k) * 8 - k * 4, HY - 18 + k * 4, 80 + k * 8, 2);
      }
    });
  }
  withCam(ctx, c, () => {
    if (set.interior) set.back(ctx, t, X);
    else {
      const gr = st.growth ? ease.inOutSine(prog(t, st.growth.t0, st.growth.t0 + 2.5)) : 0;
      const wg = (col) => mixHex(mixHex(col, '#9cc06e', gr), '#b9a27a', X.wither);
      A.ground(ctx, -600, 1600, HY, 460, wg(set.ground[0]), wg(set.ground[1]), set.ground[2], 7);
      if (L.setting === 'palace') floorTiles(ctx);
      if (set.sea) { seaSet(ctx, t, X); seaPart(ctx, t, st.sea_part ? prog(t, st.sea_part.t0, st.sea_part.t0 + 2.6) : 0); }
      if (set.junction) seaJunction(ctx, t, X);
      if ((set.sea || set.junction) && SF >= 0) { ctx.fillStyle = `rgba(16,26,40,${0.45 * SF})`; ctx.fillRect(-500, SEA_HZ, 2000, 160); }
      if (set.river) riverSet(ctx, t, X, st.sea_part ? prog(t, st.sea_part.t0, st.sea_part.t0 + 2.0) : 0);
      set.mid(ctx, t, X);
      if (X.ruinT > -BIG && !(L.setting === 'city' || L.setting === 'palace')) {
        const dr = t - X.ruinT;
        if (dr > 0.3) { ctx.save(); ctx.globalAlpha = clamp((dr - 0.3) * 1.5); A.ruins(ctx, 120, HY + 40, 700, 5); ctx.restore(); }
      }
      if (st.quake) {
        const cp = prog(t, st.quake.t0 + 0.2, st.quake.t0 + 1.4);
        A.crack(ctx, 60, HY + 120, 1.9, cp, 3); A.crack(ctx, 600, HY + 150, 1.8, cp, 8); A.crack(ctx, 330, HY + 230, 1.7, cp, 5); A.crack(ctx, 760, HY + 250, 1.6, cp, 11);
      }
      if (st.growth) {
        const g0 = st.growth.t0;
        for (let i = 0; i < 28; i++) {
          const k = ease.outBack(prog(t, g0 + 0.3 + i * 0.09, g0 + 1.1 + i * 0.09));
          if (k <= 0.01) continue;
          const x = -40 + H(i, 51) * 1040, y = HY + 40 + H(i, 52) * 260;
          A.grass(ctx, x, y, 1.05 * k, t, i + 90);
          if (i % 3 === 0) { ctx.fillStyle = ['#f2c25b', '#e8738a', '#ffffff'][i % 9 / 3 | 0]; ctx.beginPath(); ctx.arc(x + 6, y - 34 * k, 5 * k, 0, TAU); ctx.fill(); }
        }
      }
      if (SR >= 0) {
        ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.22 * SR})`; ctx.lineWidth = 2;
        for (let k = 0; k < 9; k++) { const y = 620 + k * 26 - ((t * 20) % 26); ctx.beginPath(); for (let x = -300; x <= 1300; x += 20) { const yy = y + Math.sin(x * 0.03 + t * 3 + k) * 3; if (x === -300) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); } ctx.stroke(); }
        ctx.restore();
      }
    }
    drawActors(ctx, t, T, L, E, c, X, 'world', B);
    const fa = L.actors.find((a) => a.type === 'fish');
    if (fa && X.fish >= 0) fishEscape(ctx, t, X.fish, fa, actorState(fa, t, T, E, B, L), L);
    const fl = floodTop(t, E);
    if (fl < SH + 30) {
      waterBand(ctx, fl, SH + 120, t, '#5aa6cf', '#1d5f8a', 1.6, -400, 1400);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let x = -400; x <= 1400; x += 20) { const y = fl + Math.sin(t * 2.4 + x * 0.03) * 5; if (x === -400) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
      drawActors(ctx, t, T, L, E, c, X, 'float', B);
    }
    stonesDraw(ctx, t, E);
    birdsBeat(ctx, B, t);
  });
  // indoors the lamps light the room: the time-of-day tint is much weaker
  const tints = [tm.tint && set.interior ? [tm.tint[0], tm.tint[1] * 0.35] : tm.tint, set.tint].filter(Boolean);
  for (const ti of tints) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = rgba(ti[0], ti[1]); ctx.fillRect(0, 0, SW, SH); ctx.restore(); }
  const dk = E.k('darkness', 1.5, 1);
  if (dk > 0) { ctx.fillStyle = `rgba(11,16,34,${0.62 * dk})`; ctx.fillRect(0, 0, SW, SH); }
  if (X.storm > 0.01) { ctx.fillStyle = `rgba(214,186,140,${0.24 * X.storm})`; ctx.fillRect(0, 0, SW, SH); }
  withCam(ctx, c, () => {
    if (st.fire) fireDraw(ctx, t, E);
    if (L.setting === 'pass' && X.barrier.heat > 0 && X.barrier.pour < 1) A.glowDisc(ctx, 480, PASS.y0 - 120, 1, 'rgba(0,0,0,0)', '#ff7a3a', 300, X.barrier.heat * (1 - X.barrier.pour) * 0.6, 0.5);
    lightBeam(ctx, t, E, L, T, c, B);
    drawActors(ctx, t, T, L, E, c, X, 'drops', B);
  });
  if (LT.bolt) boltDraw(ctx, LT);
  const rk = E.k('rain', 1, 1), sk = X.storm;
  if (rk > 0.01 || sk > 0.01) {
    ctx.save();
    ctx.strokeStyle = sk > rk ? `rgba(225,205,165,${0.5 * sk})` : `rgba(236,243,250,${0.55 * rk * (L.time === 'night' ? 0.6 : 1)})`;
    ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    const n = Math.round(130 * Math.max(rk, sk));
    for (let i = 0; i < n; i++) {
      if (sk > rk) {
        const y = H(i, 61) * SH, x = ((H(i, 62) * 1300 + t * 900 * (0.8 + H(i, 63) * 0.5)) % 1300) - 170;
        ctx.moveTo(x, y); ctx.lineTo(x + 46, y + 4);
      } else {
        const sp = 820 * (0.8 + H(i, 41) * 0.4);
        const y = ((H(i, 42) * 1000 + t * sp) % 1000) - 80, x = ((H(i, 43) * 1100 - t * 90 - y * 0.18) % 1100 + 1100) % 1100 - 70;
        ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 30);
      }
    }
    ctx.stroke(); ctx.restore();
    if (sk > 0.01) for (let i = 0; i < 6; i++) A.dust(ctx, ((i * 260 + t * 160) % 1400) - 220, 520 + H(i, 3) * 220, 200, 0.4 * sk, '#d9bf8f');
  }
  const db = E.dt('blast');
  if (db > -0.05 && db < BIG / 2) {
    for (let i = 0; i < 6; i++) { const a = db > 0.15 ? clamp(1 - (db - 0.15) / 3.5) * 0.6 : 0; A.dust(ctx, 100 + i * 150, HY + 40 - db * 18 * (1 + H(i, 1)), 120 + db * 30, a); }
    for (let k = 0; k < 3; k++) {
      const p = prog(db, k * 0.18, k * 0.18 + 1.3);
      if (p <= 0 || p >= 1) continue;
      ctx.save(); ctx.globalAlpha = (1 - p) * 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 14 * (1 - p) + 2;
      ctx.beginPath(); ctx.arc(480, 400, lerp(30, 720, ease.outCubic(p)), 0, TAU); ctx.stroke(); ctx.restore();
    }
    const f = db < 0 ? 0 : Math.exp(-db * 5) * 0.85;
    if (f > 0.01) { ctx.fillStyle = `rgba(255,252,240,${f})`; ctx.fillRect(0, 0, SW, SH); }
  }
  const dq = E.dt('quake');
  if (dq > 0 && dq < 6) for (let i = 0; i < 6; i++) A.dust(ctx, 120 + i * 145, HY + 70 - dq * 12, 100 + dq * 20, clamp(1 - dq / 5) * 0.5, '#d9b88a');
  if (X.ruinT > -BIG) { const dr = t - X.ruinT; if (dr > 0 && dr < 6) for (let i = 0; i < 6; i++) A.dust(ctx, 80 + i * 170, HY + 20 - dr * 14, 110 + dr * 24, clamp(1 - dr / 5) * 0.55, '#e3c9a0'); }
  // scene beats on top
  windStreaks(ctx, pulseOf(B, t, 'wind', 2.6, 0.4), t);
  leavesBeat(ctx, B, t, X.wither > 0.3 ? ['#b39456', '#9a7f45', '#c9a43a'] : undefined);
  if (B.some((b) => b.do === 'sparkle')) {
    const an = stageAnchors(t, T, P, L, E, B, c);
    sparkleBeats(ctx, B, t, (who) => an[who] || an.center);
  }
}

// actor drawing, in passes: 'world' (everything on the ground), 'float' (ship above the flood), 'drops' (light drops, last)
const DRAW_ORDER = { barrier: 0, ship: 1, rock: 2, wall: 2, sleepers: 3, fish: 4 };
function drawActors(ctx, t, T, L, E, c, X, pass, B) {
  const fl = floodTop(t, E);
  const order = L.actors.slice().sort((a, b) => (DRAW_ORDER[a.type] ?? 5) - (DRAW_ORDER[b.type] ?? 5) || a.idx - b.idx);
  for (const a of order) {
    const st = actorState(a, t, T, E, B, L);
    if (st.alpha <= 0.01) continue;
    const isDrop = !!DROPS[a.type];
    if (pass === 'drops' && !isDrop) continue;
    if (pass === 'float' && a.type !== 'ship') continue;
    if (pass === 'world' && isDrop) continue;
    if (pass === 'world' && a.type === 'ship' && fl < SH + 30) continue;
    const al = st.alpha * (1 - 0.75 * st.doom);
    const g = gest(a, t, B, L, st.x);
    if (a.type === 'ship') {
      const set = SETTINGS[L.setting];
      const base = set.sea || set.junction ? 575 : set.river ? 628 : GY - 20;
      ctx.save(); ctx.translate(st.x, 0); ctx.scale(g.sx, 1); ctx.translate(-st.x, 0);
      shipFig(ctx, st.x, Math.min(base, fl + 22), set.river ? 0.62 : 0.78, t, st.alpha, X.hole);
      ctx.restore();
    } else if (a.type === 'birds') {
      for (let i = 0; i < a.count; i++) {
        const bx = st.x + (H(i, 81) - 0.5) * 260 + Math.sin(t * 0.6 + i) * 30, by = 150 + H(i, 82) * 130 + Math.cos(t * 0.8 + i * 1.3) * 14;
        ctx.save(); ctx.globalAlpha = st.alpha; A.bird(ctx, bx, by, 1.3, t, i); ctx.restore();
      }
    } else if (a.type === 'camel') {
      camel(ctx, st.x, GY + 5 + st.sink, 0.95, t, { moving: st.moving, alpha: al, flip: st.flip !== g.back });
    } else if (a.type === 'dog') {
      const face = st.moving ? st.flip : a.place === 'right';
      dogFig(ctx, st.x, GY + 4, 0.95, t, { lie: Math.max(g.sit, g.lie), walk: st.moving, flip: face !== g.back, sx: g.sx, alpha: al });
      if (g.speak >= 0) speakArcs(ctx, st.x + (face !== g.back ? -70 : 70), GY - 80, g.speak, face !== g.back ? -1 : 1, 0.8);
    } else if (a.type === 'fish') {
      basketFig(ctx, st.x, GY + 4, 1.0, t, X.fish >= 0 ? 0 : 1, al);
    } else if (a.type === 'rock') {
      rockFig(ctx, st.x, GY + 8, 1.0, al);
    } else if (a.type === 'wall') {
      wallFig(ctx, st.x, GY + 4, 1.0, t, X.repair, al);
    } else if (a.type === 'barrier') {
      if (L.setting === 'pass') barrierFig(ctx, t, X.barrier, al);
    } else if (a.type === 'sleepers') {
      const wk = X.wake;
      A.dust(ctx, st.x, GY - 10, 300 * a.squeeze, 0.35 * al, '#1e1712');
      // wake: the cloaks lift and fade while the youths sit up in the same spot (still uncountable)
      if (wk < 0.999) fadeEnds(ctx, st.x, 300 * a.squeeze, 150 * a.squeeze, (o) => sleepersFig(o, st.x, GY + 8 - 14 * wk, a.squeeze, t, { side: X.sleepSide, wake: wk * 0.6, alpha: al * (1 - 0.92 * ease.inCubic(wk)) }));
      if (wk > 0.01) {
        const woke = { id: '__woke_' + a.id, type: 'believers', pose: 'sit', squeeze: a.squeeze, idx: a.idx, rawLabel: '', uncountable: true, x: st.x };
        const rise = ease.outCubic(wk);
        crowdUncountable(ctx, woke, { x: st.x, alpha: al * rise, doom: 0, moving: 0, flip: false, lean: 0, speed: 7, alarm: 0, sink: 30 * (1 - rise) }, t, [], L, '#2a221c');
      }
    } else if (isDrop) {
      const kind = DROPS[a.type];
      const yBase = Math.min(GY - 100, fl - 80) - 18 * g.raise + 10 * g.bow - 12 * g.look + 20 * g.sit + 30 * g.lie;
      const dx = Math.sin(t * 20) * 4 * g.shake;
      const glow = 1 + 0.4 * E.k('light') + 1.3 * g.glow + 0.5 * g.raise;
      // drops never get a face or a body: gestures are dips, tilts, wobbles, glides and light
      const tilt = 0.14 * g.bow * (g.pdir || 1) + Math.sin(t * 18) * 0.09 * g.shake;
      ctx.save(); ctx.translate(st.x, yBase + 60); ctx.rotate(tilt); ctx.scale(g.sx, 1); ctx.translate(-st.x, -(yBase + 60));
      if (a.type === 'angel') {
        const n = Math.min(a.count, 5);
        const offs = [[0, 0, 1.0], [-95, 45, 0.6], [92, 52, 0.6], [-170, 20, 0.5], [168, 26, 0.5]];
        for (let i = n - 1; i >= 0; i--) A.drop(ctx, st.x + dx + offs[i][0], yBase - 10 + offs[i][1], offs[i][2], kind, i === 0 ? a.label : null, t, { seed: a.idx * 7 + i, alpha: st.alpha, glow });
      } else {
        A.drop(ctx, st.x + dx, yBase, 0.95, kind, a.label, t, { seed: a.idx * 7 + 3, alpha: st.alpha, glow });
      }
      ctx.restore();
      if (g.glow > 0.01) A.glowDisc(ctx, st.x, yBase + 10, 1, 'rgba(0,0,0,0)', kind === 'gold' ? '#ffe39a' : kind === 'green' ? '#c8f0c8' : '#cfe8ff', 160, g.glow * 0.8, 0.6);
      if (g.pointAge >= 0) {
        // a small spark of light travels from the drop toward the target
        const q = clamp(g.pointAge / 1.3), x0 = st.x + g.pdir * 52, x1 = Math.abs(g.pointTx - st.x) > 60 ? g.pointTx : st.x + g.pdir * 240;
        const fade = 1 - prog(g.pointAge, 1.3, 1.8);
        for (let k = 0; k < 5; k++) {
          const u = Math.max(0, ease.outCubic(q) - k * 0.05), sx = lerp(x0, x1, u), sy = yBase - 24 - Math.sin(Math.PI * u) * 46;
          A.sparkle(ctx, sx, sy, (10 - k * 1.6), fade * (1 - k * 0.18));
        }
      }
      if (g.speak >= 0) speakArcs(ctx, st.x + 46, yBase - 40, g.speak, 1, 1);
    } else if (HUMAN.has(a.type)) {
      if (a.uncountable && a.type !== 'king' && a.type !== 'ruler' && a.type !== 'man') {
        crowdUncountable(ctx, a, st, t, B, L, L.setting === 'cave' ? '#2a221c' : SETTINGS[L.setting].interior ? '#2a221c' : '#5a4a3a');
        continue;
      }
      const single = a.type === 'king' || a.type === 'ruler' || a.type === 'man';
      const n = single ? 1 : a.count;
      const sleep = g.lie > 0.5;
      const two = n > 6 && !sleep, perRow = two ? Math.ceil(n / 2) : n;
      const sp = (sleep ? 100 : a.pose === 'gather' ? 38 : 50) * a.squeeze;
      for (let i = n - 1; i >= 0; i--) {
        const row = two && i >= perRow ? 1 : 0, j = row ? i - perRow : i, cnt = row ? n - perRow : perRow;
        const x = st.x + (j - (cnt - 1) / 2) * sp + row * 24 + (a.pose === 'gather' ? Math.sin(t * 1.3 + i) * 4 : 0);
        const y = GY + (row ? -20 : 0) + (i % 2) * 8 + st.sink;
        const sc = (single ? 1.06 : 0.9) * (row ? 0.92 : 1);
        const gi = n > 1 ? gest(a, t - i * 0.07, B, L, st.x) : g;
        const sway = pulseOf(B, t, 'wind', 2.6, 0.4) * Math.sin(t * 3 + i) * 0.05;
        drawHuman(ctx, a, i, x, y, sc, t, { ...st, flip: a.pose === 'gather' ? (i % 2 === 1) !== st.flip : st.flip }, gi, { alpha: al, sway, bob: a.pose === 'gather' ? Math.abs(Math.sin(t * 2 + i)) * 3 : 0 });
      }
      if ((g.giveAge ?? -1) >= 0) {
        const x0 = st.x + g.gdir * (((n - 1) / 2) * sp + 34), x1 = g.giveTx - g.gdir * 26;
        ctx.save(); ctx.globalAlpha = al; givePurse(ctx, x0, x1, GY - 70, g.giveAge); ctx.restore();
      }
      if (a.pose === 'flee' && st.alpha > 0.1) {
        for (let i = 0; i < Math.min(n, 6); i += 2) A.bubble(ctx, st.x + (i - (Math.min(n, 6) - 1) / 2) * sp + 8, GY - 150 - Math.abs(Math.sin(t * 6 + i)) * 8, 0.7, '!', st.alpha);
      }
    }
  }
}

function stageAnchors(t, T, P, L, E, B, c) {
  const out = { center: S(c, 480, 435), sky: S(par(c, 0.15), 480, 160), ground: S(c, 480, GY - 10) };
  const fl = floodTop(t, E);
  for (const a of L.actors) {
    const st = actorState(a, t, T, E, B, L), g = gest(a, t, B, L, st.x);
    let y = headY(a, g);
    if (DROPS[a.type]) y = Math.min(y, fl - 165);
    const p = S(c, st.x, y);
    out[a.id] = [clamp(p[0], 40, SW - 40), clamp(p[1], 40, SH - 40)];
  }
  return out;
}

// ================================================================ ambient entry points
function ambParams(T) { return T?.c?.params && typeof T.c.params === 'object' ? T.c.params : {}; }
function ambientAnchors(t, T, c0) {
  const P = ambParams(T), mood = AMB[P.mood] ? P.mood : 'dawn';
  const c = c0 || ambCam(t, T, P, beatList(P, T), JSON.stringify(P));
  const L0 = mood === 'dawn' ? [520, AMB.dawn.sunY(t, T)] : AMB[mood].light;
  const light = mood === 'geometric' ? S(c, 480, 435) : S(par(c, 0.15), L0[0], L0[1]);
  return { center: S(c, 480, 435), sky: S(par(c, 0.15), 480, 170), light: [clamp(light[0], 40, SW - 40), clamp(light[1], 40, SH - 40)], ground: S(c, 480, 720) };
}
function rainOverlay(ctx, t, k) {
  ctx.save();
  ctx.strokeStyle = 'rgba(236,243,250,0.55)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < Math.round(130 * k); i++) {
    const sp = 820 * (0.8 + H(i, 41) * 0.4);
    const y = ((H(i, 42) * 1000 + t * sp) % 1000) - 80, x = ((H(i, 43) * 1100 - t * 90 - y * 0.18) % 1100 + 1100) % 1100 - 70;
    ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 30);
  }
  ctx.stroke(); ctx.restore();
}
function ambientDraw(ctx, t, T) {
  const P = ambParams(T), mood = AMB[P.mood] ? P.mood : 'dawn';
  const B = beatList(P, T), c = ambCam(t, T, P, B, JSON.stringify(P)), X = ambState(B, t, mood);
  ctx.save();
  AMB[mood].draw(ctx, t, T, c, recent(T, t, 2.2), X);
  if (X.rain > 0.01 && mood !== 'rain') { ctx.fillStyle = `rgba(70,84,104,${0.22 * X.rain})`; ctx.fillRect(0, 0, SW, SH); rainOverlay(ctx, t, X.rain); }
  const an = ambientAnchors(t, T, c);
  if (X.lightUp > 0.01) A.glowDisc(ctx, an.light[0], an.light[1], 1, 'rgba(0,0,0,0)', '#fff3cf', 420, X.lightUp, 0.7);
  if (X.stars > 0.01 && mood !== 'night_sky') for (let j = 0; j < 14; j++) A.sparkle(ctx, H(j, 621) * 960, H(j, 622) * 360, 8 + 6 * H(j, 623), X.stars * (0.4 + 0.6 * Math.max(0, Math.sin(t * 5 + j))));
  cloudsPart(ctx, B, t);
  withCam(ctx, par(c, 0.6), () => birdsBeat(ctx, B, t));
  windStreaks(ctx, X.wind, t);
  leavesBeat(ctx, B, t, X.veg < -0.3 ? ['#b39456', '#9a7f45', '#c9a43a'] : undefined);
  sparkleBeats(ctx, B, t, (who) => an[who] || an.center);
  ctx.restore();
}

// ================================================================ exports
export const scenes = {
  ambient: {
    draw(ctx, t, T) { ambientDraw(ctx, t, T); },
    anchors(t, T) { return ambientAnchors(t, T); },
  },
  stage: {
    draw(ctx, t, T) { ctx.save(); stageDraw(ctx, t, T); ctx.restore(); },
    anchors(t, T) {
      const P = (T?.c?.params && typeof T.c.params === 'object') ? T.c.params : {};
      const L = layout(P), E = events(P, t, T), B = beatList(P, T);
      return stageAnchors(t, T, P, L, E, B, stageCamera(t, T, P, L, E, B, JSON.stringify(P)));
    },
  },
};
export const AMBIENT_MOODS = MOODS;
// for the test harness: the camera a scene uses at time t
export const _debug = {
  cam(scene, t, T) {
    const P = (T?.c?.params && typeof T.c.params === 'object') ? T.c.params : {};
    const B = beatList(P, T), pkey = JSON.stringify(P);
    if (scene === 'ambient') return ambCam(t, T, P, B, pkey);
    const L = layout(P), E = events(P, t, T);
    return stageCamera(t, T, P, L, E, B, pkey);
  },
};
