// The ten plates. Each scene is a pure function of time; every beat is anchored to a verse/word time
// from the recitation data via T (never a literal second). Scene canvas is SW x SH.
import { TAU, clamp, lerp, prog, ease, keys, env, hash, mixHex, rgba } from './util.js';
import * as A from './art.js';

export const SW = 960, SH = 870;
export const HY = 565; // horizon

// Flat-topped sandstone mesas behind the desert (Arabian setting). These replaced triangular peaks that read as
// pyramids, which would wrongly place the story of Ibrahim and Lut in Egypt. Same {x, h, w} list as A.mountains.
function mesas(ctx, peaks, baseY, light, dark) {
  for (const p of peaks) {
    const top = baseY - p.h * 0.62, l = p.x - p.w / 2, r = p.x + p.w / 2, tl = p.x - p.w * 0.2, tr = p.x + p.w * 0.16;
    ctx.fillStyle = light;
    ctx.beginPath(); ctx.moveTo(l, baseY); ctx.quadraticCurveTo(tl - p.w * 0.12, top + p.h * 0.18, tl, top);
    ctx.lineTo(tr, top); ctx.quadraticCurveTo(tr + p.w * 0.14, top + p.h * 0.2, r, baseY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = dark;   // shaded right face and one rock band
    ctx.beginPath(); ctx.moveTo(tr, top); ctx.quadraticCurveTo(tr + p.w * 0.14, top + p.h * 0.2, r, baseY);
    ctx.lineTo(tr + p.w * 0.04, baseY); ctx.lineTo(tr - p.w * 0.02, top + p.h * 0.1); ctx.closePath(); ctx.fill();
    ctx.globalAlpha *= 0.35;
    ctx.fillRect(tl + 4, top + p.h * 0.16, tr - tl - 8, 5);
    ctx.globalAlpha /= 0.35;
  }
}

export function withCam(ctx, c, fn) {
  ctx.save();
  ctx.translate(SW / 2, SH / 2); ctx.scale(c.z, c.z); ctx.translate(-c.x, -c.y);
  fn();
  ctx.restore();
}
export const S = (c, x, y) => [(x - c.x) * c.z + SW / 2, (y - c.y) * c.z + SH / 2];
export const par = (c, p) => ({ x: lerp(SW / 2, c.x, p), y: lerp(SH / 2, c.y, p), z: lerp(1, c.z, p) });

export const ROBES = [['#c8483f', '#7d2620'], ['#2f7fb8', '#1c4d70'], ['#e0a12f', '#8a5f12'], ['#6a4fa0', '#3d2c63'],
  ['#3f9a6b', '#22593d'], ['#d0663a', '#7a361b'], ['#2c8f94', '#1a5659'], ['#a8455f', '#5f2334']];

export function cityCluster(ctx, x, y, s, o = {}) {
  const tint = o.tint ?? 0, lit = o.lit ?? 0;
  const f = (c) => mixHex(c, '#b8564a', tint * 0.55);
  const specs = [[-260, 150, 150, 1], [-110, 120, 210, 2], [40, 170, 170, 3], [220, 130, 230, 4], [360, 150, 140, 5], [-200, 90, 100, 6], [130, 100, 110, 7]];
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  for (const [hx, w, h, seed] of specs) {
    A.house(ctx, hx, 0, w, h, {
      seed, front: f('#e6cfa2'), side: f('#c9a774'), top: f('#f1e1bf'), lit,
      windows: [[0.3, 0.35], [0.7, 0.35], [0.5, 0.68, 20, 26]].slice(0, 2 + (seed % 2)), door: seed % 3 === 0 ? [0.5, 40, 64] : null,
    });
  }
  ctx.restore();
}

export function crowdMember(ctx, i, x, y, s, t, o = {}) {
  const [robe, belt] = ROBES[i % ROBES.length];
  A.person(ctx, x, y, s, {
    robe, belt, scarf: i % 3 === 1 ? '#f3efe6' : '#ffffff', check: i % 3 === 1, beard: i % 2 === 0,
    walk: o.walk ?? 0, phase: t * 7 + i * 1.3, arms: o.arms ?? 0, bob: o.bob ?? 0, lean: o.lean ?? 0,
  });
}

// ---------- shared dusk street set (arrival / crowd / refusal) ----------
function street(ctx, c, t, o = {}) {
  A.sky(ctx, SW, SH, o.top ?? '#c25a60', o.bottom ?? '#f2a77d');
  withCam(ctx, par(c, 0.3), () => {
    ctx.save(); ctx.globalAlpha = 0.5;
    cityCluster(ctx, 300, HY - 10, 0.7, { tint: 0.9 });
    cityCluster(ctx, 1000, HY - 10, 0.6, { tint: 0.9 });
    ctx.restore();
  });
  withCam(ctx, c, () => {
    A.ground(ctx, -600, 1800, HY, 420, '#d9b68a', '#c39a6c', 'rgba(150,105,60,0.35)', 7);
    A.house(ctx, -260, HY + 40, 230, 260, { seed: 11, windows: [[0.3, 0.3], [0.7, 0.3]], door: [0.5, 56, 92], lit: o.lit ?? 0.6 });
    A.house(ctx, 20, HY + 30, 170, 200, { seed: 12, windows: [[0.5, 0.35]], lit: o.lit ?? 0.6 });
    A.lamp(ctx, 470, HY + 70, 1, 1);
    A.house(ctx, 560, HY + 50, 300, 300, { seed: 13, windows: [[0.22, 0.3], [0.78, 0.3]], door: [0.5, 76, 120], lit: o.lit ?? 0.8 });
    A.house(ctx, 920, HY + 30, 220, 240, { seed: 14, windows: [[0.5, 0.3]], lit: o.lit ?? 0.6 });
    A.lamp(ctx, 1180, HY + 70, 1, 1);
  });
}

export const scenes = {
  // 57-58: the angels at Ibrahim's tent; camera reveals the guilty city
  abraham: {
    cam(t, T) {
      return { x: keys(t, [[T.c.start, 470], [T.w(58, 3), 520], [T.we(58, 6) + 0.3, 1130]]), y: 435, z: keys(t, [[T.c.start, 1.05], [T.c.end, 1.0]]) };
    },
    draw(ctx, t, T) {
      const c = this.cam(t, T);
      A.sky(ctx, SW, SH, '#f2c68c', '#fbe8c4');
      withCam(ctx, par(c, 0.25), () => {
        A.glowDisc(ctx, 780, 280, 72, '#fff5da', '#ffe0a0', 280, 1, 0.6);
        mesas(ctx, [{ x: 160, h: 170, w: 360 }, { x: 500, h: 230, w: 430 }, { x: 860, h: 190, w: 380 }, { x: 1180, h: 240, w: 430 }, { x: 1500, h: 180, w: 380 }], HY + 5, '#eab37c', '#d29261');
      });
      const red = ease.outCubic(prog(t, T.w(58, 6) - 0.2, T.w(58, 6) + 0.9));
      withCam(ctx, c, () => {
        A.ground(ctx, -400, 2100, HY, 420, '#f0d29c', '#e2b878', 'rgba(190,140,80,0.5)', 3);
        cityCluster(ctx, 1290, HY + 10, 0.62, { tint: red });
        A.palm(ctx, 30, 650, 0.95, t, 2);
        A.tent(ctx, 230, 650, 1.0);
        A.fire(ctx, 470, 668, 0.8, t);
        A.pot(ctx, 545, 676, 0.8); A.pot(ctx, 582, 680, 0.62, '#b97447');
        for (let i = 0; i < 9; i++) A.grass(ctx, -100 + i * 170 + hash(i) * 60, 720 + hash(i + 9) * 70, 1.1, t, i);
        A.drop(ctx, 370, 560, 0.95, 'green', ['إبراهيم', 'عليه السلام'], t, { seed: 1 });
        A.drop(ctx, 610, 600, 0.6, 'gold', null, t, { seed: 4 });
        A.drop(ctx, 700, 540, 1.05, 'gold', 'ملائكة', t, { seed: 2 });
        A.drop(ctx, 800, 595, 0.62, 'gold', null, t, { seed: 3 });
      });
    },
    anchors(t, T) { const c = this.cam(t, T); return { angels: S(c, 700, 500), city: S(c, 1300, 470) }; },
  },

  // 59-60: Lut and his believing family protected; his wife stays outside the circle
  rescue: {
    cam(t, T) { return { x: keys(t, [[T.c.start, 470], [T.w(60, 1), 470], [T.w(60, 2) + 0.8, 560]]), y: 435, z: keys(t, [[T.c.start, 1.0], [T.c.end, 1.06]]) }; },
    wifeX(t, T) { return keys(t, [[T.w(60, 1) - 0.3, 1120], [T.w(60, 2) + 0.9, 820]], ease.outCubic); },
    draw(ctx, t, T) {
      const c = this.cam(t, T);
      A.sky(ctx, SW, SH, '#f5d39d', '#fcefd6');
      withCam(ctx, par(c, 0.25), () => {
        A.glowDisc(ctx, 150, 240, 60, '#fff6de', '#ffe3a8', 230, 1, 0.5);
        mesas(ctx, [{ x: 620, h: 210, w: 420 }, { x: 900, h: 160, w: 360 }, { x: 1180, h: 220, w: 420 }], HY + 5, '#e6ae7a', '#cc8d5f');
      });
      withCam(ctx, c, () => {
        A.ground(ctx, -400, 1800, HY, 420, '#efd09a', '#e0b67a', 'rgba(190,140,80,0.45)', 4);
        A.house(ctx, 130, HY + 70, 340, 260, { seed: 5, windows: [[0.22, 0.32], [0.78, 0.32]], door: [0.5, 72, 112] });
        A.palm(ctx, 880, 680, 1.0, t, 3, 0.1);
        for (let i = 0; i < 8; i++) A.grass(ctx, -60 + i * 170 + hash(i + 3) * 70, 730 + hash(i + 19) * 60, 1.1, t, i + 4);
        const rp = prog(t, T.w(59, 5), T.w(59, 5) + 1.0);
        if (rp > 0) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, rp * 3);
          ctx.strokeStyle = '#f2c25b'; ctx.lineWidth = 7; ctx.setLineDash([22, 14]); ctx.lineDashOffset = -t * 30;
          ctx.beginPath(); ctx.ellipse(400, 640, lerp(40, 215, ease.outBack(rp)), lerp(20, 120, ease.outBack(rp)), 0, 0, TAU); ctx.stroke();
          ctx.restore();
        }
        A.person(ctx, 300, 700, 1.05, { woman: true, robe: '#2f8a8a', belt: '#1f5a5a', scarf: '#f7f3ea' });
        A.person(ctx, 385, 706, 1.0, { woman: true, robe: '#6a4f9e', belt: '#43306b', scarf: '#f7f3ea' });
        A.drop(ctx, 500, 610, 1.0, 'blue', ['لوط', 'عليه السلام'], t, { seed: 5 });
        const wx = this.wifeX(t, T), moving = prog(t, T.w(60, 1) - 0.3, T.w(60, 2) + 0.9);
        const grey = ease.outCubic(prog(t, T.w(60, 6), T.w(60, 6) + 0.8));
        A.person(ctx, wx, 706, 1.02, { woman: true, robe: mixHex('#8e2f5e', '#6b6670', grey), belt: '#4d1d33', scarf: mixHex('#7d3a8c', '#5f5b66', grey), walk: moving > 0 && moving < 1 ? 1 : 0, phase: t * 7, alpha: 1 - grey * 0.35 });
      });
    },
    anchors(t, T) { const c = this.cam(t, T); return { family: S(c, 345, 585), wife: S(c, this.wifeX(t, T), 585) }; },
  },

  // 61-64: the angels arrive at Lut's house at dusk
  arrival: {
    cam(t, T) { return { x: keys(t, [[T.c.start, 420], [T.v(62), 520], [T.v(64), 470]]), y: 435, z: keys(t, [[T.c.start, 1.0], [T.c.end, 1.1]]) }; },
    angelX(t, T) { return keys(t, [[T.v(61) - 0.4, -180], [T.w(61, 2) + 0.9, 260]], ease.outCubic); },
    draw(ctx, t, T) {
      const c = this.cam(t, T);
      street(ctx, c, t);
      const ax = this.angelX(t, T);
      const glow = 1 + 0.7 * env(t, T.v(63), T.ve(63), 0.4, 0.4);
      withCam(ctx, c, () => {
        A.octagram(ctx, ax, 520, 120, '#f2c25b', env(t, T.w(64, 2), T.c.end + 0.5, 0.6, 0.3), t * 0.35, 0.12, 6);
        A.drop(ctx, ax - 95, 600, 0.62, 'gold', null, t, { seed: 6, glow });
        A.drop(ctx, ax + 90, 610, 0.6, 'gold', null, t, { seed: 7, glow });
        A.drop(ctx, ax, 540, 1.05, 'gold', 'ملائكة', t, { seed: 8, glow });
        A.drop(ctx, 690, 590, 1.0, 'blue', ['لوط', 'عليه السلام'], t, { seed: 9 });
        const qa = env(t, T.w(62, 2), T.ve(62) + 0.2, 0.3, 0.3);
        A.bubble(ctx, 760, 440 - 10 * ease.outBack(qa), lerp(0.6, 1.1, ease.outBack(qa)), '؟', qa);
      });
    },
    anchors(t, T) { const c = this.cam(t, T), ax = this.angelX(t, T); return { angels: S(c, ax, 500), lut: S(c, 690, 560), town: S(c, -120, 420) }; },
  },

  // 65-66: leaving by night, Lut behind his family; the night turns to dawn
  night: {
    gx(t, T) { return 260 + (t - T.c.start) * 24; },
    cam(t, T) { return { x: this.gx(t, T) + 160, y: 435, z: keys(t, [[T.c.start, 1.06], [T.c.end, 1.0]]) }; },
    dawn(t, T) { return ease.inOutSine(prog(t, T.w(66, 5), T.we(66, 9) + 0.5)); },
    sunY(t, T) { return lerp(690, 400, ease.inOutSine(prog(t, T.w(66, 5), T.we(66, 9) + 0.8))); },
    draw(ctx, t, T) {
      const c = this.cam(t, T), k = this.dawn(t, T), gx = this.gx(t, T);
      A.sky(ctx, SW, SH, mixHex('#121838', '#6a5a96', k), mixHex('#2b3570', '#f6a77c', k), mixHex('#1d2552', '#c27f95', k));
      A.stars(ctx, SW, 480, 70, 3, t, 1 - k);
      A.moon(ctx, 760, 170, 46, 1 - k * 0.85);
      withCam(ctx, par(c, 0.2), () => {
        A.glowDisc(ctx, 650, this.sunY(t, T), 60, '#fff1cf', '#ffc27a', 300, k, 0.7);
        mesas(ctx, [{ x: 250, h: 200, w: 420 }, { x: 600, h: 260, w: 460 }, { x: 950, h: 210, w: 420 }, { x: 1300, h: 250, w: 460 }], HY + 5, mixHex('#2e3670', '#8a6a92', k), mixHex('#232a5a', '#6a5078', k));
      });
      withCam(ctx, c, () => {
        A.ground(ctx, -400, 2200, HY, 420, mixHex('#30366a', '#b88a78', k * 0.7), mixHex('#262b56', '#9a705f', k * 0.7), 'rgba(255,255,255,0.08)', 5);
        ctx.save(); ctx.globalAlpha = 0.9;
        cityCluster(ctx, -40, HY + 10, 0.6, { lit: 1 - k, tint: 0.2 });
        ctx.restore();
        A.palm(ctx, 140, 680, 0.9, t, 4);
        const ph = t * 6.5;
        A.drop(ctx, gx - 120, 600, 0.9, 'blue', ['لوط', 'عليه السلام'], t, { seed: 10 });
        A.person(ctx, gx, 700, 1.0, { woman: true, robe: '#2f8a8a', belt: '#1f5a5a', scarf: '#efeadf', walk: 1, phase: ph });
        A.person(ctx, gx + 80, 704, 0.96, { woman: true, robe: '#6a4f9e', belt: '#43306b', scarf: '#efeadf', walk: 1, phase: ph + 1.4 });
        const na = env(t, T.w(65, 8), T.ve(65), 0.35, 0.35);
        A.noLook(ctx, gx + 40, 470, lerp(0.6, 1, ease.outBack(na)), na);
      });
    },
    anchors(t, T) {
      const c = this.cam(t, T), cs = par(c, 0.2);
      return { moon: [760, 170], nolook: S(c, this.gx(t, T) + 40, 470), sun: S(cs, 650, Math.min(this.sunY(t, T), 540)) };
    },
  },

  // 67-69: the townsmen come to Lut's house
  crowd: {
    cam(t, T) { return { x: keys(t, [[T.c.start, 400], [T.w(67, 4), 450], [T.v(68), 560], [T.c.end, 540]]), y: 435, z: keys(t, [[T.c.start, 1.0], [T.c.end, 1.06]]) }; },
    xs: [60, 130, 195, 265, 330, 395, 460],
    draw(ctx, t, T) {
      const c = this.cam(t, T);
      street(ctx, c, t);
      withCam(ctx, c, () => {
        const pa = env(t, T.w(68, 4), T.c.end + 0.5, 0.6, 0.3);
        if (pa > 0) {
          ctx.save(); ctx.globalAlpha = pa; ctx.strokeStyle = '#f2c25b'; ctx.lineWidth = 6; ctx.setLineDash([18, 12]); ctx.lineDashOffset = -t * 25;
          ctx.beginPath(); ctx.arc(820, 590, 120 * lerp(0.6, 1, ease.outBack(pa)), 0, TAU); ctx.stroke(); ctx.restore();
        }
        A.drop(ctx, 790, 600, 0.7, 'gold', 'ملائكة', t, { seed: 11 });
        A.drop(ctx, 870, 615, 0.55, 'gold', null, t, { seed: 12 });
        A.drop(ctx, 660, 600, 1.0, 'blue', ['لوط', 'عليه السلام'], t, { seed: 13, glow: 1 + 0.6 * env(t, T.v(69), T.ve(69), 0.3, 0.3) });
        this.xs.forEach((bx, i) => {
          const p = prog(t, T.v(67) - 0.4 + i * 0.1, T.w(67, 3) + 0.6 + i * 0.1);
          const x = bx - 560 * (1 - ease.outCubic(p));
          const y = 708 + (i % 2) * 14;
          const excited = env(t, T.w(67, 4) + i * 0.08, T.c.end + 1, 0.3, 0.3);
          crowdMember(ctx, i, x, y, 0.95, t, { walk: p > 0 && p < 1 ? 1 : 0, bob: Math.abs(Math.sin(t * 6 + i)) * 6 * excited });
          if (i % 2 === 1) {
            const ba = env(t, T.w(67, 4) + i * 0.12, T.ve(69), 0.25, 0.3);
            A.bubble(ctx, x + 10, 545 - Math.abs(Math.sin(t * 5 + i)) * 8, lerp(0.5, 0.9, ease.outBack(ba)), '!', ba);
          }
        });
      });
    },
    anchors(t, T) { const c = this.cam(t, T); return { crowd: S(c, 260, 560), lut: S(c, 660, 560) }; },
  },

  // 70-71: they reject him; Lut points them to lawful marriage
  refusal: {
    cam(t, T) { return { x: keys(t, [[T.c.start, 380], [T.w(71, 3), 430]]), y: 450, z: keys(t, [[T.c.start, 1.14], [T.c.end, 1.08]]) }; },
    xs: [60, 130, 195, 265, 330, 395, 460],
    draw(ctx, t, T) {
      const c = this.cam(t, T);
      street(ctx, c, t, { top: '#b95562', bottom: '#f09d7e' });
      const ra = env(t, T.w(71, 3), T.c.end + 0.5, 0.5, 0.3);
      withCam(ctx, c, () => {
        A.drop(ctx, 660, 600, 1.0, 'blue', ['لوط', 'عليه السلام'], t, { seed: 13 });
        const agit = env(t, T.v(70), T.ve(70), 0.3, 0.6);
        this.xs.forEach((bx, i) => {
          const wave = Math.max(0, Math.sin(t * 5 + i * 1.7));
          crowdMember(ctx, i, bx, 708 + (i % 2) * 14, 0.95, t, { arms: agit * (0.5 + 0.5 * wave) * (i % 3 === 2 ? 0.3 : 1), bob: Math.abs(Math.sin(t * 6 + i)) * 7 * agit });
          if (i % 2 === 0) {
            const ba = env(t, T.w(70, 2) + i * 0.1, T.ve(70), 0.25, 0.3);
            A.bubble(ctx, bx + 8, 548 - Math.abs(Math.sin(t * 6 + i)) * 10, lerp(0.5, 0.9, ease.outBack(ba)), '!', ba);
          }
        });
        if (ra > 0) {
          ctx.save(); ctx.globalAlpha = ra; ctx.strokeStyle = '#f2c25b'; ctx.lineWidth = 5; ctx.setLineDash([4, 14]); ctx.lineCap = 'round';
          const p = ease.outCubic(prog(t, T.w(71, 3), T.w(71, 3) + 1.4));
          ctx.beginPath();
          for (let i = 0; i <= 40 * p; i++) { const k = i / 40; const x = lerp(260, 760, k), y = 520 - Math.sin(k * Math.PI) * 190; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
          ctx.stroke(); ctx.restore();
          A.rings(ctx, 500, 340, lerp(0.5, 1, ease.outBack(ra)), ra);
        }
      });
    },
    anchors(t, T) { const c = this.cam(t, T); return { crowd: S(c, 260, 560), rings: S(c, 500, 340) }; },
  },

  // 72: lost in their intoxication
  heedless: {
    cam(t, T) { return { x: keys(t, [[T.c.start, 300], [T.c.end, 330]]), y: 460, z: keys(t, [[T.c.start, 1.12], [T.c.end, 1.22]]) }; },
    xs: [40, 110, 180, 250, 320, 390, 460, 530],
    draw(ctx, t, T) {
      const c = this.cam(t, T);
      street(ctx, c, t, { top: '#5d3b80', bottom: '#e59b8c', lit: 0.9 });
      const sw = env(t, T.w(72, 2), T.c.end + 0.6, 0.8, 0.3);
      withCam(ctx, c, () => {
        this.xs.forEach((bx, i) => {
          const lean = Math.sin(t * 1.8 + i * 0.9) * 0.09 * (0.3 + sw);
          crowdMember(ctx, i, bx, 712 + (i % 2) * 12, 0.95, t, { lean });
          A.swirl(ctx, bx + Math.sin(t * 1.8 + i * 0.9) * 10, 560 - (i % 2) * 6, 0.9, t + i, sw, i % 2 ? '#f2c25b' : '#fff1d0');
        });
      });
    },
    anchors(t, T) { const c = this.cam(t, T); return { crowd: S(c, 290, 570) }; },
  },

  // 73: the blast at sunrise
  blast: {
    t0(T) { return T.w(73, 2); },
    sunY(t, T) { return lerp(560, 300, ease.outCubic(prog(t, T.c.start - 0.4, T.ve(73)))); },
    draw(ctx, t, T) {
      const t0 = this.t0(T), dt = t - t0;
      const amp = dt > 0 ? 16 * Math.exp(-dt * 3.5) : 0;
      const c = { x: 480 + Math.sin(t * 61) * amp, y: 435 + Math.cos(t * 47) * amp, z: keys(t, [[T.c.start, 1.0], [T.c.end, 1.08]]) };
      A.sky(ctx, SW, SH, '#f5ae74', '#fde3b8');
      withCam(ctx, par(c, 0.2), () => {
        A.glowDisc(ctx, 480, this.sunY(t, T), 80, '#fff4d6', '#ffcf86', 330, 1, 0.75);
        mesas(ctx, [{ x: 150, h: 180, w: 400 }, { x: 820, h: 200, w: 420 }], HY + 5, '#e3a172', '#c8835a');
      });
      withCam(ctx, c, () => {
        A.ground(ctx, -400, 1500, HY, 420, '#ebcb98', '#d9b27a', 'rgba(170,120,70,0.4)', 8);
        cityCluster(ctx, 470, HY + 60, 1.0, { tint: 0 });
        for (let i = 0; i < 6; i++) {
          const a = dt > 0.15 ? clamp(1 - (dt - 0.15) / 3.5) * 0.7 : 0;
          A.dust(ctx, 120 + i * 150, HY + 30 - dt * 20 * (1 + hash(i)), 120 + dt * 30, a);
        }
      });
      if (dt > -0.05) {
        for (let k = 0; k < 3; k++) {
          const p = prog(dt, k * 0.18, k * 0.18 + 1.3);
          if (p <= 0 || p >= 1) continue;
          ctx.save(); ctx.globalAlpha = (1 - p) * 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 14 * (1 - p) + 2;
          ctx.beginPath(); ctx.arc(480, 420, lerp(30, 720, ease.outCubic(p)), 0, TAU); ctx.stroke(); ctx.restore();
        }
        const fl = dt < 0 ? 0 : Math.exp(-dt * 5) * 0.85;
        if (fl > 0.01) { ctx.fillStyle = `rgba(255,252,240,${fl})`; ctx.fillRect(0, 0, SW, SH); }
      }
    },
    anchors(t, T) { return { blast: [480, 420], sun: [480, Math.min(this.sunY(t, T), 560)] }; },
  },

  // 74: the city overturned; stones of baked clay
  overturn: {
    ang(t, T) { return Math.PI * ease.inOutCubic(prog(t, T.w(74, 2), T.we(74, 3) + 0.6)); },
    draw(ctx, t, T) {
      const z = keys(t, [[T.c.start, 1.0], [T.c.end, 1.05]]);
      const c = { x: 480, y: 435, z };
      A.sky(ctx, SW, SH, '#6e241e', '#e8854a', '#b2452c');
      withCam(ctx, par(c, 0.2), () => {
        A.glowDisc(ctx, 700, 250, 56, '#ffd6a0', '#ff9a5a', 220, 0.8, 0.5);
        mesas(ctx, [{ x: 120, h: 190, w: 400 }, { x: 520, h: 230, w: 440 }, { x: 900, h: 190, w: 400 }], HY + 5, '#7d3326', '#5e241c');
      });
      const a = this.ang(t, T);
      withCam(ctx, c, () => {
        A.ground(ctx, -400, 1500, HY, 420, '#c98f62', '#a86d48', 'rgba(80,40,20,0.35)', 9);
        ctx.save();
        ctx.translate(470, HY - 70 - Math.sin(a) * 110);
        ctx.rotate(a);
        ctx.translate(0, 110);
        cityCluster(ctx, -120, 0, 0.95, { tint: 0.35 });   // cluster spans -260..510 -> centred on the pivot
        ctx.restore();
        const cp = prog(t, T.we(74, 3), T.we(74, 3) + 0.8);
        A.crack(ctx, 260, HY + 120, 1.2, cp, 3); A.crack(ctx, 650, HY + 150, 1.1, cp, 8); A.crack(ctx, 470, HY + 200, 1.0, cp, 5);
        const dt = t - T.we(74, 3);
        for (let i = 0; i < 6; i++) A.dust(ctx, 140 + i * 140, HY + 40 - Math.max(0, dt) * 25, 110 + Math.max(0, dt) * 25, dt > 0 ? clamp(1 - dt / 3.0) * 0.65 : 0, '#d9a77a');
      });
      // stones: born on a fixed clock from the first "wa-amtarna"; each falls for 1.1 s
      const s0 = T.w(74, 4), s1 = T.ve(74) + 0.6, every = 0.2;
      for (let i = 0; ; i++) {
        const tb = s0 + i * every;
        if (tb > Math.min(t, s1)) break;
        const p = (t - tb) / 1.1;
        if (p < 0 || p > 1.15) continue;
        const x0 = 80 + hash(i * 3 + 1) * 860, xf = x0 + 70;
        const yf = HY + 40 + hash(i * 3 + 2) * 180;
        if (p <= 1) A.stone(ctx, lerp(x0, xf, p), lerp(-60, yf, ease.inCubic(p)), 0.8 + hash(i) * 0.6, p * 6 + i, 1);
        else A.dust(ctx, xf, yf, 50, (1.15 - p) * 4, '#e0b08a');
      }
    },
    anchors(t, T) { return { city: [470, 400], stones: [560, 300] }; },
  },

  // 75-77: the ruins on an established road - a sign for those who reflect
  lesson: {
    tx(t, T) { return keys(t, [[T.v(76) - 0.6, -160], [T.ve(76) + 3, 760]], ease.linear); },
    draw(ctx, t, T) {
      const c = { x: keys(t, [[T.c.start, 470], [T.c.end, 500]]), y: 435, z: keys(t, [[T.c.start, 1.0], [T.c.end, 1.06]]) };
      A.sky(ctx, SW, SH, '#b9d6e4', '#f6ecd6');
      A.cloud(ctx, 160 + t * 6 % 1200 - 200, 140, 0.9, 0.9);
      A.cloud(ctx, 760 + (t * 4) % 900 - 300, 90, 0.7, 0.8);
      const sa = env(t, T.w(75, 4), T.c.end + 1, 0.8, 0.3), sb = env(t, T.w(77, 4), T.c.end + 1, 0.6, 0.3);
      A.glowDisc(ctx, 700, 250, 62, '#fff6dc', '#ffe2a0', 240 + 60 * sb, 1, 0.55 + 0.25 * sb);
      A.octagram(ctx, 700, 250, 115 + 15 * sb, '#e9b54a', sa, t * 0.25, 0.08 + 0.1 * sb, 5);
      for (let i = 0; i < 4; i++) A.bird(ctx, (120 + i * 210 + t * 22) % 1040 - 40, 130 + hash(i) * 120, 1.1, t, i);
      withCam(ctx, par(c, 0.3), () => {
        mesas(ctx, [{ x: 120, h: 170, w: 400 }, { x: 460, h: 220, w: 440 }, { x: 860, h: 180, w: 400 }], HY + 5, '#a9b6c9', '#8d9bb2');
      });
      withCam(ctx, c, () => {
        A.ground(ctx, -400, 1500, HY, 420, '#ead2a0', '#dcc08a', 'rgba(170,130,80,0.35)', 10);
        A.ruins(ctx, 180, HY + 30, 600, 4);
        ctx.fillStyle = 'rgba(255,248,230,0.55)';
        ctx.beginPath(); ctx.moveTo(-400, 760); ctx.quadraticCurveTo(480, 640, 1500, 720); ctx.lineTo(1500, 790); ctx.quadraticCurveTo(480, 712, -400, 830); ctx.closePath(); ctx.fill();
        A.palm(ctx, -10, 690, 0.85, t, 6);
        const tx = this.tx(t, T);
        [[0, '#2f7fb8', '#1c4d70'], [-85, '#c8483f', '#7d2620'], [-170, '#6a4fa0', '#3d2c63']].forEach(([dx, robe, belt], i) => {
          const x = tx + dx, y = 735 - (x - 300) * 0.02;
          ctx.save(); ctx.strokeStyle = '#6b4424'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 30, y - 4); ctx.lineTo(x + 34, y - 125); ctx.stroke(); ctx.restore();
          A.person(ctx, x, y, 0.9, { robe, belt, walk: 1, phase: t * 6 + i, beard: true });
        });
      });
    },
    anchors(t, T) {
      const c = { x: keys(t, [[T.c.start, 470], [T.c.end, 500]]), y: 435, z: keys(t, [[T.c.start, 1.0], [T.c.end, 1.06]]) };
      return { ruins: S(c, 430, HY - 20), travelers: S(c, this.tx(t, T) - 40, 640), star: [700, 250] };
    },
  },
};
