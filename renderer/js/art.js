// Flat-vector art kit, drawn in code. Rules: prophets and angels are NEVER drawn as people - only as
// labelled light drops. Ordinary people are faceless. No text is ever baked into imagery except labels.
import { TAU, clamp, lerp, hash, rgba, ease, prog } from './util.js';

export const FONT_UI = '"Tajawal"';

export function sky(ctx, w, h, top, bottom, mid = null) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  if (mid) g.addColorStop(0.55, mid);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function glowDisc(ctx, x, y, r, core, glow, glowR = r * 3, alpha = 1, glowA = 0.55) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, glowR);
  g.addColorStop(0, rgba(glow, glowA));
  g.addColorStop(1, rgba(glow, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, glowR, 0, TAU); ctx.fill();
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}

export function moon(ctx, x, y, r, alpha = 1) {
  glowDisc(ctx, x, y, r, '#f3eedb', '#e8e3c9', r * 3.4, alpha, 0.45);
  ctx.save();
  ctx.globalAlpha = alpha * 0.55;
  ctx.fillStyle = '#d9d1b3';
  for (const [dx, dy, rr] of [[-0.35, -0.2, 0.22], [0.3, 0.25, 0.16], [0.05, 0.45, 0.1], [0.4, -0.35, 0.09], [-0.2, 0.35, 0.12]]) {
    ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, rr * r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export function sparkle(ctx, x, y, r, a = 1, col = '#ffffff') {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.12, y - r * 0.12, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.12, y + r * 0.12, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.12, y + r * 0.12, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.12, y - r * 0.12, x, y - r);
  ctx.fill();
  ctx.restore();
}

export function stars(ctx, w, h, n, seed, t, alpha = 1) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < n; i++) {
    const x = hash(seed + i * 7) * w, y = hash(seed + i * 7 + 1) * h;
    const s = 0.8 + hash(seed + i * 7 + 2) * 1.8;
    const tw = 0.5 + 0.5 * Math.sin(t * (0.8 + hash(seed + i * 7 + 3) * 2.2) + i);
    const a = alpha * (0.3 + 0.7 * tw);
    if (s > 2.2) sparkle(ctx, x, y, s * 3, a * 0.9);
    else { ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

// pyramid-like flat peaks: [{x, h, w}]
export function mountains(ctx, peaks, baseY, light, dark) {
  for (const p of peaks) {
    const ax = p.x, ay = baseY - p.h, l = p.x - p.w / 2, r = p.x + p.w / 2;
    ctx.fillStyle = light;
    ctx.beginPath(); ctx.moveTo(l, baseY); ctx.lineTo(ax, ay); ctx.lineTo(r, baseY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(r, baseY); ctx.lineTo(ax + p.w * 0.08, baseY); ctx.closePath(); ctx.fill();
  }
}

export function ground(ctx, x0, x1, y, h, top, bottom, streak = null, seed = 1) {
  const g = ctx.createLinearGradient(0, y - 20, 0, y + h);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const xa = lerp(x0, x1, (i + 0.5) / n), xb = lerp(x0, x1, (i + 1) / n);
    ctx.quadraticCurveTo(xa, y - 8 - hash(seed + i) * 14, xb, y);
  }
  ctx.lineTo(x1, y + h); ctx.lineTo(x0, y + h); ctx.closePath(); ctx.fill();
  if (streak) {
    ctx.save();
    ctx.strokeStyle = streak; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const sx = lerp(x0, x1, hash(seed * 31 + i)), sy = y + 30 + hash(seed * 17 + i) * (h - 60), L = 40 + hash(seed * 7 + i) * 110;
      ctx.globalAlpha = 0.25 + hash(seed + i * 3) * 0.25;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + L / 2, sy - 6, sx + L, sy); ctx.stroke();
    }
    ctx.restore();
  }
}

export function grass(ctx, x, y, s, t, seed = 1, col = '#5c9a3e', col2 = '#7cb850') {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  const n = 4 + Math.floor(hash(seed) * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / (n - 1) - 0.5) * 1.1 + Math.sin(t * 1.3 + seed + i) * 0.05;
    const L = 26 + hash(seed + i * 5) * 22;
    ctx.fillStyle = i % 2 ? col : col2;
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.quadraticCurveTo(Math.sin(a) * L * 0.5 - 3, -L * 0.6, Math.sin(a) * L, -Math.cos(a) * L);
    ctx.quadraticCurveTo(Math.sin(a) * L * 0.5 + 3, -L * 0.6, 3, 0);
    ctx.fill();
  }
  ctx.restore();
}

export function palm(ctx, x, y, s, t, seed = 1, lean = 0.12) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  const H = 300, segs = 16;
  const pt = (k) => [Math.sin(k * 1.4) * lean * H * 0.5 + k * lean * 60, -k * H];
  for (let i = 0; i < segs; i++) {
    const [ax, ay] = pt(i / segs), [bx, by] = pt((i + 1) / segs);
    const w = lerp(22, 13, i / segs);
    ctx.fillStyle = i % 2 ? '#8c5a33' : '#a8713f';
    ctx.beginPath();
    ctx.moveTo(ax - w, ay); ctx.lineTo(bx - w * 0.92, by - 2); ctx.lineTo(bx + w * 0.92, by - 2); ctx.lineTo(ax + w, ay);
    ctx.closePath(); ctx.fill();
  }
  const [tx, ty] = pt(1);
  const sway = Math.sin(t * 0.9 + seed) * 0.05;
  const fronds = [-2.6, -2.1, -1.55, -1.0, -0.45, 0.05, 0.5];
  fronds.forEach((a0, i) => {
    const a = a0 + sway * (1 + i * 0.1);
    const L = 150 + hash(seed + i) * 40;
    ctx.save();
    ctx.translate(tx, ty); ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = i % 2 ? '#2f7d3f' : '#3f9a4c';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(L * 0.45, -34, L, 22);
    ctx.quadraticCurveTo(L * 0.5, 4, 0, 0);
    ctx.fill();
    ctx.strokeStyle = '#256633'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L * 0.5, -14, L, 22); ctx.stroke();
    ctx.restore();
  });
  ctx.fillStyle = '#6b4424';
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(tx - 12 + i * 8, ty + 10 + (i % 2) * 6, 7, 0, TAU); ctx.fill(); }
  ctx.restore();
}

export function cloud(ctx, x, y, s, a = 1, col = '#ffffff') {
  ctx.save();
  ctx.globalAlpha = a; ctx.fillStyle = col;
  ctx.translate(x, y); ctx.scale(s, s);
  for (const [dx, dy, r] of [[-60, 8, 34], [-20, -12, 44], [28, -2, 38], [64, 12, 28], [0, 16, 36]]) {
    ctx.beginPath(); ctx.arc(dx, dy, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export function bird(ctx, x, y, s, t, seed = 0) {
  const f = Math.sin(t * 7 + seed) * 0.5 + 0.5;
  ctx.save();
  ctx.strokeStyle = '#3d3a44'; ctx.lineWidth = 2.6 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 14 * s, y - (2 + f * 8) * s);
  ctx.quadraticCurveTo(x - 6 * s, y - (6 + f * 6) * s, x, y);
  ctx.quadraticCurveTo(x + 6 * s, y - (6 + f * 6) * s, x + 14 * s, y - (2 + f * 8) * s);
  ctx.stroke();
  ctx.restore();
}

export function tent(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#3d2a1f';
  ctx.beginPath();
  ctx.moveTo(-170, 0);
  ctx.bezierCurveTo(-170, -120, -120, -175, 0, -180);
  ctx.bezierCurveTo(120, -175, 170, -120, 170, 0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#523829'; ctx.lineWidth = 10;
  for (const k of [-0.55, 0, 0.55]) {
    ctx.beginPath(); ctx.moveTo(k * 170, 0); ctx.quadraticCurveTo(k * 150, -120, k * 60, -176); ctx.stroke();
  }
  const g = ctx.createRadialGradient(0, -40, 10, 0, -40, 110);
  g.addColorStop(0, '#ffd77a'); g.addColorStop(1, '#f39a2c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-58, 0); ctx.lineTo(-58, -78); ctx.quadraticCurveTo(-58, -118, 0, -120);
  ctx.quadraticCurveTo(58, -118, 58, -78); ctx.lineTo(58, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2b1d15';
  ctx.fillRect(-178, -6, 356, 8);
  ctx.restore();
}

export function fire(ctx, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  glowDisc(ctx, 0, -20, 4, 'rgba(0,0,0,0)', '#ffb347', 90, 1, 0.45);
  ctx.fillStyle = '#6d4426';
  ctx.save(); ctx.rotate(0.35); ctx.fillRect(-34, -6, 68, 12); ctx.restore();
  ctx.save(); ctx.rotate(-0.35); ctx.fillRect(-34, -6, 68, 12); ctx.restore();
  const layers = [['#e2462b', 1.0], ['#f39a2c', 0.72], ['#ffe08a', 0.42]];
  layers.forEach(([c, k], i) => {
    const fl = 1 + Math.sin(t * 9 + i * 1.7) * 0.08 + Math.sin(t * 13.3 + i) * 0.05;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(0, -80 * k * fl);
    ctx.bezierCurveTo(18 * k, -48 * k, 30 * k, -22 * k, 26 * k, -6);
    ctx.quadraticCurveTo(0, 6, -26 * k, -6);
    ctx.bezierCurveTo(-30 * k, -22 * k, -18 * k, -48 * k, 0, -80 * k * fl);
    ctx.fill();
  });
  ctx.restore();
}

export function pot(ctx, x, y, s, col = '#a8643a') {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(0, -22, 24, 22, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#7b4426';
  ctx.fillRect(-12, -50, 24, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.ellipse(-8, -28, 6, 10, -0.3, 0, TAU); ctx.fill();
  ctx.restore();
}

// mud-brick house; (x, y) = bottom-left of the front face
export function house(ctx, x, y, w, h, o = {}) {
  const d = o.depth ?? w * 0.2;
  const front = o.front ?? '#ead6ad', side = o.side ?? '#cfb07f', top = o.top ?? '#f4e6c6';
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.fillStyle = side;
  ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w + d, y - d * 0.45); ctx.lineTo(x + w + d, y - h - d * 0.45); ctx.lineTo(x + w, y - h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = top;
  ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + w, y - h); ctx.lineTo(x + w + d, y - h - d * 0.45); ctx.lineTo(x + d, y - h - d * 0.45); ctx.closePath(); ctx.fill();
  ctx.fillStyle = front;
  ctx.fillRect(x, y - h, w, h);
  // brick hints
  ctx.strokeStyle = 'rgba(120,85,45,0.16)'; ctx.lineWidth = 2;
  for (let i = 0; i < Math.floor(w * h / 5000); i++) {
    const bx = x + 10 + hash((o.seed ?? 1) * 13 + i) * (w - 40), by = y - h + 30 + hash((o.seed ?? 1) * 29 + i) * (h - 50);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 18, by); ctx.stroke();
  }
  // roof beams
  ctx.fillStyle = o.beam ?? '#8d6a44';
  for (let bx = x + 16; bx < x + w - 8; bx += 34) { ctx.beginPath(); ctx.arc(bx, y - h + 14, 4.5, 0, TAU); ctx.fill(); }
  const lit = o.lit ?? 0;
  const winCol = lit > 0 ? `rgba(255,${190 + 20 * lit},${90 + 30 * lit},1)` : (o.win ?? '#7a5a3a');
  for (const wv of o.windows ?? []) {
    const wx = x + wv[0] * w, wy = y - h + wv[1] * h, ww = wv[2] ?? 22, wh = wv[3] ?? 30;
    if (lit > 0) glowDisc(ctx, wx, wy, 1, 'rgba(0,0,0,0)', '#ffcf6b', ww * 1.8, lit, 0.35);
    ctx.fillStyle = winCol;
    archRect(ctx, wx - ww / 2, wy - wh / 2, ww, wh);
  }
  if (o.door) {
    const [dx, dw, dh] = o.door;
    ctx.fillStyle = o.doorCol ?? '#6b4a2e';
    archRect(ctx, x + dx * w - dw / 2, y - dh, dw, dh);
  }
  ctx.restore();
}

export function archRect(ctx, x, y, w, h) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.arc(x + r, y + r, r, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
}

export function lamp(ctx, x, y, s, lit = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#3b3029';
  ctx.fillRect(-4, -150, 8, 150);
  ctx.fillRect(-12, -6, 24, 6);
  if (lit > 0) glowDisc(ctx, 0, -160, 2, 'rgba(0,0,0,0)', '#ffcf6b', 70, lit, 0.55);
  ctx.fillStyle = '#3b3029';
  ctx.fillRect(-14, -186, 28, 6);
  ctx.fillStyle = lit > 0 ? '#ffd77a' : '#8a7a5a';
  ctx.fillRect(-10, -180, 20, 26);
  ctx.restore();
}

// faceless person; (x, y) = feet baseline
export function person(ctx, x, y, s, o = {}) {
  const robe = o.robe ?? '#c0504d', belt = o.belt ?? '#7a2f2f', scarf = o.scarf ?? '#ffffff', skin = o.skin ?? '#e7b98f';
  const walk = o.walk ?? 0, ph = o.phase ?? 0, arms = clamp(o.arms ?? 0), bob = o.bob ?? 0, lean = o.lean ?? 0;
  const step = Math.sin(ph);
  ctx.save();
  ctx.translate(x, y - Math.abs(step) * 4 * s * walk - bob * s);
  ctx.rotate(lean);
  ctx.scale(s * (o.flip ? -1 : 1), s);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  // shadow
  ctx.fillStyle = 'rgba(40,25,10,0.18)';
  ctx.beginPath(); ctx.ellipse(0, 0, 30, 6, 0, 0, TAU); ctx.fill();
  // feet
  ctx.fillStyle = '#3b2a22';
  ctx.beginPath(); ctx.ellipse(-10 + step * 7 * walk, -3, 10, 5, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10 - step * 7 * walk, -3, 10, 5, 0, 0, TAU); ctx.fill();
  // arms (behind robe when down)
  const armA = lerp(0.18, 2.7, ease.outCubic(arms)) + Math.sin(ph) * 0.12 * walk;
  ctx.strokeStyle = shade(robe, -0.12); ctx.lineWidth = 13; ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * 18, -76);
    ctx.lineTo(side * (18 + Math.sin(armA) * 26), -76 + Math.cos(armA) * 30);
    ctx.stroke();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(side * (18 + Math.sin(armA) * 31), -76 + Math.cos(armA) * 35, 6, 0, TAU); ctx.fill();
  }
  if (o.cape) {
    ctx.fillStyle = o.cape;
    ctx.beginPath(); ctx.moveTo(-22, -80); ctx.quadraticCurveTo(-46, -30, -40, -2); ctx.lineTo(40, -2); ctx.quadraticCurveTo(46, -30, 22, -80); ctx.closePath(); ctx.fill();
  }
  // robe
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-27, -4); ctx.lineTo(-21, -76); ctx.quadraticCurveTo(0, -90, 21, -76); ctx.lineTo(27, -4);
  ctx.quadraticCurveTo(0, 2, -27, -4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(robe, -0.18);
  ctx.beginPath(); ctx.moveTo(-26.4, -12); ctx.lineTo(26.4, -12); ctx.lineTo(27, -4); ctx.quadraticCurveTo(0, 2, -27, -4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = belt;
  ctx.fillRect(-23.5, -48, 47, 9);
  // head
  const hy = -100;
  if (o.nemes) {
    ctx.fillStyle = '#e8b13c';
    ctx.beginPath(); ctx.moveTo(-31, -64); ctx.lineTo(-23, hy - 20); ctx.quadraticCurveTo(0, hy - 36, 23, hy - 20); ctx.lineTo(31, -64);
    ctx.quadraticCurveTo(0, -58, -31, -64); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2f5fa8'; ctx.lineWidth = 4;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 8, hy - 27); ctx.lineTo(i * 14, -64); ctx.stroke(); }
    if (!o.back) { ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0, hy + 1, 11, 13.5, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#c99a2e'; ctx.beginPath(); ctx.arc(0, hy - 27, 5, 0, TAU); ctx.fill();
  } else if (o.helmet) {
    ctx.fillStyle = o.back ? '#7a5c33' : skin; ctx.beginPath(); ctx.arc(0, hy, 16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a6a3a';
    ctx.beginPath(); ctx.arc(0, hy - 2, 18.5, Math.PI, 0); ctx.lineTo(18.5, hy + 3); ctx.lineTo(-18.5, hy + 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b8893f'; ctx.fillRect(-19.5, hy, 39, 5);
    ctx.fillStyle = '#b8352a'; ctx.beginPath(); ctx.ellipse(0, hy - 23, 5, 9, 0, 0, TAU); ctx.fill();
  } else if (o.back) {
    ctx.fillStyle = scarf;
    if (o.woman) { ctx.beginPath(); ctx.moveTo(-27, -66); ctx.quadraticCurveTo(-30, hy - 26, 0, hy - 26); ctx.quadraticCurveTo(30, hy - 26, 27, -66); ctx.quadraticCurveTo(0, -58, -27, -66); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(-22, -70); ctx.quadraticCurveTo(-26, hy - 22, 0, hy - 22); ctx.quadraticCurveTo(26, hy - 22, 22, -70); ctx.quadraticCurveTo(0, -64, -22, -70); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.ellipse(0, hy - 13, 18, 4.5, 0, 0, TAU); ctx.stroke(); }
  } else if (o.woman) {
    ctx.fillStyle = scarf;
    ctx.beginPath();
    ctx.moveTo(-27, -66); ctx.quadraticCurveTo(-30, hy - 26, 0, hy - 26); ctx.quadraticCurveTo(30, hy - 26, 27, -66);
    ctx.quadraticCurveTo(0, -58, -27, -66); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.ellipse(0, hy + 1, 11, 13.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = shade(scarf, -0.12); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, hy + 1, 13, 15.5, 0, 0, TAU); ctx.stroke();
  } else {
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, hy, 16, 0, TAU); ctx.fill();
    ctx.fillStyle = scarf;
    ctx.beginPath();
    ctx.moveTo(-22, -70); ctx.quadraticCurveTo(-26, hy - 22, 0, hy - 22); ctx.quadraticCurveTo(26, hy - 22, 22, -70);
    ctx.lineTo(14, -74); ctx.quadraticCurveTo(15, hy - 6, 0, hy - 12); ctx.quadraticCurveTo(-15, hy - 6, -14, -74); ctx.closePath(); ctx.fill();
    if (o.check) {
      ctx.strokeStyle = 'rgba(190,40,40,0.55)'; ctx.lineWidth = 1.6;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 6 - 6, hy - 20); ctx.lineTo(i * 6 + 6, -72); ctx.stroke(); }
    }
    ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.ellipse(0, hy - 13, 18, 4.5, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = shade(skin, -0.25);
    if (o.beard) { ctx.beginPath(); ctx.ellipse(0, hy + 12, 10, 6, 0, 0, Math.PI); ctx.fill(); }
  }
  if (o.spear) {
    ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(30, -18); ctx.lineTo(33, -158); ctx.stroke();
    ctx.fillStyle = '#c9ccd1'; ctx.beginPath(); ctx.moveTo(33, -176); ctx.lineTo(39, -156); ctx.lineTo(27, -156); ctx.closePath(); ctx.fill();
  }
  if (o.shield) {
    ctx.fillStyle = '#9a7440'; ctx.strokeStyle = '#d2a85a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(-24, -48, 15, 21, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

export function shade(hex, k) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const f = (c) => Math.round(clamp(k < 0 ? c * (1 + k) : c + (255 - c) * k, 0, 255));
  return `rgb(${f((v >> 16) & 255)},${f((v >> 8) & 255)},${f(v & 255)})`;
}

const DROP = {
  blue: ['#f0f9ff', '#8fd0f5', '#3a8fd8', '#1d4f86'],
  green: ['#f1fff2', '#9ae6aa', '#3fae66', '#1f6b3c'],
  gold: ['#fffbea', '#ffd97a', '#eba633', '#8a5a12'],
};
// a labelled light drop standing in for a prophet or an angel
export function drop(ctx, x, y, s, kind, label, t, o = {}) {
  const [c0, c1, c2, c3] = DROP[kind];
  const a = o.alpha ?? 1;
  if (a <= 0.01) return;
  const fy = y + Math.sin(t * 1.6 + (o.seed ?? 0)) * 5 * s;
  const glow = o.glow ?? 1;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, fy); ctx.scale(s, s);
  const g0 = ctx.createRadialGradient(0, 8, 10, 0, 8, 120);
  g0.addColorStop(0, rgba(c1, 0.55 * glow)); g0.addColorStop(1, rgba(c1, 0));
  ctx.fillStyle = g0;
  ctx.beginPath(); ctx.arc(0, 8, 120, 0, TAU); ctx.fill();
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(0, -78);
    ctx.bezierCurveTo(16, -46, 50, -16, 50, 18);
    ctx.bezierCurveTo(50, 48, 27, 66, 0, 66);
    ctx.bezierCurveTo(-27, 66, -50, 48, -50, 18);
    ctx.bezierCurveTo(-50, -16, -16, -46, 0, -78);
    ctx.closePath();
  };
  const g = ctx.createRadialGradient(0, 22, 4, 0, 18, 78);
  g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; path(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2.5; path(); ctx.stroke();
  if (label) {
    ctx.fillStyle = c3;
    ctx.textAlign = 'center'; ctx.direction = 'rtl'; ctx.textBaseline = 'middle';
    const lines = Array.isArray(label) ? label : [label];
    lines.forEach((ln, i) => {
      ctx.font = `${i === 0 ? 800 : 700} ${i === 0 ? 24 : 15}px ${FONT_UI}`;
      ctx.fillText(ln, 0, 20 + (i - (lines.length - 1) / 2) * 24);
    });
  }
  ctx.restore();
  for (let i = 0; i < 3; i++) {
    const ph = t * 1.3 + i * 2.1 + (o.seed ?? 0);
    const sa = Math.max(0, Math.sin(ph)) * a;
    sparkle(ctx, x + (hash(i * 11 + (o.seed ?? 0) * 3) - 0.5) * 130 * s, fy + (hash(i * 5 + 2 + (o.seed ?? 0)) - 0.6) * 120 * s, 8 * s, sa);
  }
}

export function bubble(ctx, x, y, s, ch, a = 1) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0.65 * Math.PI, 0.35 * Math.PI);
  ctx.lineTo(4, 36); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = ch === '!' ? '#c9433d' : '#2b2b33';
  ctx.font = `800 34px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ch, 0, 3);
  ctx.restore();
}

export function noLook(ctx, x, y, s, a = 1) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#c9433d'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-22, 0); ctx.quadraticCurveTo(0, -20, 22, 0); ctx.quadraticCurveTo(0, 20, -22, 0); ctx.stroke();
  ctx.fillStyle = '#2b2b33'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#c9433d'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(-26, -26); ctx.lineTo(26, 26); ctx.stroke();
  ctx.restore();
}

export function rings(ctx, x, y, s, a = 1) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y); ctx.scale(s, s);
  glowDisc(ctx, 0, 0, 1, 'rgba(0,0,0,0)', '#ffd97a', 80, 1, 0.5);
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#e8b13c'; ctx.beginPath(); ctx.arc(-14, 4, 26, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#f5cf6a'; ctx.beginPath(); ctx.arc(14, 4, 26, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#bfe9ff';
  ctx.beginPath(); ctx.moveTo(14, -34); ctx.lineTo(24, -24); ctx.lineTo(14, -14); ctx.lineTo(4, -24); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function swirl(ctx, x, y, s, t, a = 1, col = '#f2c25b') {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(t * 2.6);
  ctx.strokeStyle = col; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const th = (i / 60) * Math.PI * 3.2, r = 3 + th * 5.2;
    const px = Math.cos(th) * r, py = Math.sin(th) * r * 0.8;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

export function octagram(ctx, x, y, r, col, a = 1, rot = 0, fillA = 0.15, lw = 5) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round';
  ctx.fillStyle = rgba(col.startsWith('#') ? col : '#f2c25b', fillA);
  for (const k of [0, Math.PI / 4]) {
    ctx.save(); ctx.rotate(k);
    ctx.beginPath(); ctx.rect(-r * 0.7071, -r * 0.7071, r * 1.4142, r * 1.4142); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export function stone(ctx, x, y, s, rot, trail = 1) {
  ctx.save();
  ctx.translate(x, y);
  if (trail > 0) {
    const g = ctx.createLinearGradient(0, 0, -60 * s, -160 * s);
    g.addColorStop(0, 'rgba(255,170,60,0.85)'); g.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 12 * s; ctx.lineCap = 'round';
    ctx.globalAlpha = trail;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-60 * s, -160 * s); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = '#5a3a2a';
  ctx.beginPath();
  ctx.moveTo(-14, -10); ctx.lineTo(4, -16); ctx.lineTo(16, -4); ctx.lineTo(12, 12); ctx.lineTo(-6, 15); ctx.lineTo(-16, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7c5440';
  ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(4, -12); ctx.lineTo(8, -2); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function crack(ctx, x, y, s, p, seed = 1) {
  if (p <= 0) return;
  ctx.save();
  ctx.strokeStyle = '#2a1d16'; ctx.lineWidth = 5 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const n = 7;
  ctx.beginPath(); ctx.moveTo(x, y);
  let px = x, py = y;
  for (let i = 1; i <= Math.ceil(n * p); i++) {
    const k = Math.min(1, n * p - (i - 1));
    const nx = x + i * 26 * s * (hash(seed) > 0.5 ? 1 : -1), ny = y + (hash(seed * 7 + i) - 0.5) * 30 * s + i * 4 * s;
    ctx.lineTo(lerp(px, nx, k), lerp(py, ny, k));
    px = nx; py = ny;
  }
  ctx.stroke();
  ctx.restore();
}

export function dust(ctx, x, y, r, a, col = '#e9d2a8') {
  if (a <= 0.01) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

export function ruins(ctx, x, y, w, seed = 1, col = '#cdb488', side = '#a88d62') {
  let cx = x;
  for (let i = 0; i < 5; i++) {
    const bw = 50 + hash(seed + i) * 70, bh = 30 + hash(seed * 3 + i) * 70;
    ctx.fillStyle = side;
    ctx.fillRect(cx + bw, y - bh + 6, 10, bh - 6);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx, y); ctx.lineTo(cx, y - bh * 0.7);
    for (let k = 1; k <= 4; k++) ctx.lineTo(cx + (bw * k) / 4, y - bh * (0.55 + hash(seed * 11 + i * 4 + k) * 0.45));
    ctx.lineTo(cx + bw, y); ctx.closePath(); ctx.fill();
    cx += bw + 18 + hash(seed * 5 + i) * 30;
    if (cx > x + w) break;
  }
}
