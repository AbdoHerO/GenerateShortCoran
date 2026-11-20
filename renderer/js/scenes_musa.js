// Musa crosses the sea - Ash-Shu'ara 26:60-68. Musa (peace be upon him) appears only as a labelled light drop with
// his staff; Pharaoh, soldiers and the Children of Israel are faceless. Every beat is anchored to a word time via T.
import { TAU, clamp, lerp, prog, ease, keys, env, hash, mixHex, rgba } from './util.js';
import * as A from './art.js';
import { SW, SH, HY, withCam, S, par } from './scenes.js';

const MUSA = ['موسى', 'عليه السلام'];
const ISR = [['#8a6a4a', '#5a4430', '#efe7d6', false], ['#6f7f5a', '#465338', '#f3eee2', true], ['#a0583c', '#673523', '#efe7d6', false],
  ['#5d6f86', '#3a475a', '#f3eee2', true], ['#94804f', '#5f522f', '#efe7d6', false], ['#7c5a74', '#4f3849', '#f3eee2', true],
  ['#6a8a86', '#41605c', '#efe7d6', false], ['#a87a4a', '#6d4e2c', '#f3eee2', true]];

function israelite(ctx, i, x, y, s, t, o = {}) {
  const [robe, belt, scarf, woman] = ISR[i % ISR.length];
  A.person(ctx, x, y, s, { robe, belt, scarf, woman, beard: !woman && i % 3 === 0, walk: o.walk ?? 0, phase: t * 6.5 + i * 1.1,
    arms: o.arms ?? 0, lean: o.lean ?? 0, back: o.back, alpha: o.alpha });
}
function soldier(ctx, i, x, y, s, t, o = {}) {
  A.person(ctx, x, y, s, { robe: i % 2 ? '#efe6cf' : '#e6dcc0', belt: '#2f5fa8', helmet: true, spear: true, shield: i % 3 !== 1,
    walk: o.walk ?? 1, phase: t * 7 + i * 0.9, back: o.back, alpha: o.alpha });
}
function pharaoh(ctx, x, y, s, t, o = {}) {
  A.person(ctx, x, y, s, { robe: '#f4ecd6', belt: '#d6a63a', nemes: true, cape: '#a8322b', walk: o.walk ?? 1, phase: t * 6 + 0.4, back: o.back, alpha: o.alpha });
}

// Musa's staff: grip at (x, y), angle 0 = upright, positive = leaning forward/right
function staff(ctx, x, y, len, ang, a = 1) {
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.strokeStyle = '#6b4424'; ctx.lineWidth = Math.max(4, len * 0.045); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, len * 0.35); ctx.lineTo(0, -len * 0.62); ctx.stroke();
  ctx.beginPath(); ctx.arc(-len * 0.06, -len * 0.62, len * 0.06, 0, Math.PI, true); ctx.stroke();
  ctx.restore();
}
function musa(ctx, x, y, s, t, o = {}) {
  A.drop(ctx, x, y, s, 'blue', MUSA, t, { seed: 21, glow: o.glow ?? 1, alpha: o.alpha });
  staff(ctx, x + 62 * s, y + 46 * s, 190 * s, o.staffAng ?? -0.08, o.alpha ?? 1);
}

function dustCloud(ctx, x, y, s, t, a) {
  for (let i = 0; i < 7; i++) {
    const dx = -i * 60 * s - ((t * 40 + i * 37) % 60) * s, dy = -Math.abs(Math.sin(i * 1.7)) * 40 * s;
    A.dust(ctx, x + dx, y + dy, (60 + i * 14) * s, a * (0.55 - i * 0.06), '#e7c995');
  }
}

// ---------------- side-view world (60-62): desert on the left, the sea on the right ----------------
const SEA_X = 1430;
const armyX = (t, T) => 120 + (t - T.v(60)) * 26;
const GROUP_X = 1080;

function sideSea(ctx, t) {
  const g = ctx.createLinearGradient(0, HY, 0, SH + 200);
  g.addColorStop(0, '#5fb3d6'); g.addColorStop(1, '#1d5f8a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(SEA_X, HY + 4); ctx.lineTo(2600, HY + 4); ctx.lineTo(2600, SH + 300); ctx.lineTo(SEA_X - 120, SH + 300); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(SEA_X, HY + 4);
  for (let y = HY + 4; y <= SH + 300; y += 12) ctx.lineTo(SEA_X - (y - HY) * 0.4 + Math.sin(t * 2 + y * 0.05) * 6, y);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    const y = HY + 20 + i * 34, x0 = SEA_X + 40 - (y - HY) * 0.4 + 30;
    ctx.beginPath();
    for (let x = x0; x < 2600; x += 20) { const yy = y + Math.sin(t * 1.6 + x * 0.02 + i) * 4; if (x === x0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
    ctx.stroke();
  }
}

function sideWorld(ctx, c, t, T, st) {
  A.sky(ctx, SW, SH, '#f3ae78', '#fde5bd', '#f8c995');
  withCam(ctx, par(c, 0.2), () => {
    A.glowDisc(ctx, 700, st.sunY, 74, '#fff3d4', '#ffcf86', 300, 1, 0.65);
    A.mountains(ctx, [{ x: 120, h: 190, w: 420 }, { x: 470, h: 240, w: 460 }, { x: 820, h: 180, w: 400 }], HY + 5, '#e2a575', '#c88659');
  });
  withCam(ctx, c, () => {
    A.ground(ctx, -900, SEA_X + 60, HY, 520, '#efcf98', '#e0b57a', 'rgba(190,140,80,0.45)', 12);
    sideSea(ctx, t);
    for (let i = 0; i < 10; i++) A.grass(ctx, -500 + i * 190 + hash(i + 40) * 80, 760 + hash(i + 50) * 80, 1.0, t, i + 30, '#8a9a4e', '#a6b35c');
    // the army: Pharaoh in front, soldiers behind, dust above
    const ax = st.armyX;
    dustCloud(ctx, ax - 60, 650, 1.2, t, 1);
    for (let i = 0; i < 9; i++) soldier(ctx, i, ax - 90 - (i % 5) * 62 - Math.floor(i / 5) * 30, 700 + Math.floor(i / 5) * 26, 0.9, t);
    pharaoh(ctx, ax, 712, 1.08, t);
    // the Children of Israel at the shore, Musa at the front
    for (let i = 0; i < 8; i++) {
      const x = GROUP_X + (i % 4) * 58 + Math.floor(i / 4) * 26, y = 700 + Math.floor(i / 4) * 24;
      israelite(ctx, i, x, y, 0.92, t, { lean: -0.12 * st.fear * (i % 2 ? 1 : 0.7), arms: st.fear * (i % 3 === 0 ? 0.9 : 0.4) });
      if (i % 2 === 0) {
        const ba = st.fear * env(t, st.fearT + i * 0.06, 1e9, 0.25, 0.1);
        A.bubble(ctx, x + 6, 552 - Math.abs(Math.sin(t * 6 + i)) * 8, lerp(0.5, 0.85, ease.outBack(ba)), '!', ba);
      }
    }
    musa(ctx, GROUP_X + 300, 610, 1.0, t, { glow: st.musaGlow });
    if (st.halo > 0) A.octagram(ctx, GROUP_X + 300, 600, 130, '#f2c25b', st.halo, t * 0.3, 0.1, 6);
    if (st.sight > 0) {
      const x0 = ax + 10, x1 = GROUP_X + 60, p = ease.outCubic(st.sight);
      ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.setLineDash([14, 12]); ctx.lineDashOffset = -t * 30; ctx.globalAlpha = 0.85 * Math.min(1, st.sight * 2);
      ctx.beginPath();
      for (let k = 0; k <= 40; k++) { const u = k / 40; if (u > p) break; const x = lerp(x0, x1, u), y = 540 - Math.sin(u * Math.PI) * 120; if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke(); ctx.restore();
    }
  });
}

function sideState(t, T) {
  return {
    armyX: armyX(t, T),
    sunY: lerp(560, 330, ease.outCubic(prog(t, T.v(60) - 1, T.v(62)))),
    fear: env(t, T.w(61, 7) - 0.1, T.w(62, 3), 0.4, 0.8),
    fearT: T.w(61, 7) - 0.1,
    sight: prog(t, T.w(61, 2), T.we(61, 3) + 0.4) * (1 - prog(t, T.w(61, 7), T.w(61, 7) + 0.6)),
    musaGlow: 1 + 0.8 * env(t, T.w(62, 2), T.ve(62) + 1, 0.4, 0.3),
    halo: env(t, T.w(62, 3), T.ve(62) + 1, 0.8, 0.3),
  };
}

// ---------------- front view of the sea (63-68) ----------------
const HZ = 330, CX = 480;
const PAL = { far: '#7cc6e2', near: '#1f6a96', faceNear: '#18577f', faceFar: '#4ea9d2' };

function seaSurface(ctx, t, rough = 1) {
  const g = ctx.createLinearGradient(0, HZ, 0, SH);
  g.addColorStop(0, PAL.far); g.addColorStop(1, PAL.near);
  ctx.fillStyle = g; ctx.fillRect(0, HZ, SW, SH - HZ);
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const k = i / 15, y = HZ + Math.pow(k, 1.9) * (SH - HZ) + 4, amp = (1.5 + k * 7) * rough;
    ctx.strokeStyle = `rgba(255,255,255,${0.1 + 0.18 * k})`; ctx.lineWidth = 1.5 + k * 3;
    ctx.beginPath();
    for (let x = -20; x <= SW + 20; x += 16) { const yy = y + Math.sin(t * (1.2 + rough * 0.8) + x * (0.03 - k * 0.018) + i * 1.7) * amp; if (x === -20) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
    ctx.stroke();
  }
}

// the parted sea seen down the corridor; p = how far it has parted (0..1), grow = extra height
function wallsGeom(p, grow) {
  const e = ease.outCubic(clamp(p));
  return { gN: lerp(0, 430, e), gF: lerp(0, 44, e), HN: lerp(20, 560, e) * grow, HF: lerp(3, 105, e) * grow };
}
function depthY(u) { return HZ + (SH + 40 - HZ) / (1 + 7 * u); } // u: 0 near camera .. 1 horizon
function depthS(u) { return 1 / (1 + 7 * u); }

function pathAndWalls(ctx, t, p, grow, drawInPath) {
  const { gN, gF, HN, HF } = wallsGeom(p, grow);
  if (p > 0.002) {
    // dry sea bed
    const g = ctx.createLinearGradient(0, HZ, 0, SH);
    g.addColorStop(0, '#d9bf8c'); g.addColorStop(1, '#b38c58');
    ctx.fillStyle = g; ctx.globalAlpha = clamp(p * 3);
    ctx.beginPath(); ctx.moveTo(CX - gN / 2, SH + 40); ctx.lineTo(CX - gF / 2, HZ); ctx.lineTo(CX + gF / 2, HZ); ctx.lineTo(CX + gN / 2, SH + 40); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,85,45,0.25)'; ctx.lineWidth = 2;
    for (let i = 1; i < 9; i++) { const u = i / 9, y = depthY(u), hw = lerp(gN, gF, 1 - depthS(u)) / 2 * 0.8; ctx.beginPath(); ctx.moveTo(CX - hw, y); ctx.quadraticCurveTo(CX, y + 5, CX + hw, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  drawInPath?.();
  if (p <= 0.002) return;
  for (const side of [-1, 1]) {
    const xN = CX + side * gN / 2, xF = CX + side * gF / 2;
    const yTopAt = (x) => lerp(SH + 40 - HN, HZ - HF, (x - xN) / ((xF - xN) || 1e-6));
    const yBotAt = (x) => lerp(SH + 40, HZ, (x - xN) / ((xF - xN) || 1e-6));
    const xo = side < 0 ? -120 : SW + 120;
    const tl = [xo, yTopAt(xo)], bl = [xo, yBotAt(xo)];
    const g = ctx.createLinearGradient(xo, 0, xF, 0);
    g.addColorStop(0, PAL.faceNear); g.addColorStop(1, PAL.faceFar);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(xF, HZ); ctx.lineTo(xF, HZ - HF); ctx.lineTo(tl[0], tl[1]); ctx.lineTo(bl[0], bl[1]); ctx.closePath(); ctx.fill();
    // strata converging to the far edge
    ctx.save(); ctx.clip();
    for (let k = 1; k < 9; k++) {
      const f = k / 9, a = 0.07 + 0.06 * Math.sin(t * 1.3 + k * 1.9);
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(xF, lerp(HZ, HZ - HF, f)); ctx.lineTo(xo, lerp(bl[1], tl[1], f)); ctx.stroke();
    }
    ctx.restore();
    // foam crest along the top edge
    ctx.strokeStyle = '#f4fbff'; ctx.lineCap = 'round';
    for (let k = 0; k < 26; k++) {
      const u0 = k / 26, u1 = (k + 1) / 26;
      const x0 = lerp(xF, xo, u0), x1 = lerp(xF, xo, u1);
      ctx.lineWidth = 3 + u0 * 16;
      const bump = Math.sin(t * 3 + k * 1.3) * (2 + u0 * 8);
      ctx.beginPath(); ctx.moveTo(x0, yTopAt(x0) + bump * 0.3); ctx.quadraticCurveTo((x0 + x1) / 2, yTopAt((x0 + x1) / 2) - 6 - u0 * 10 + bump, x1, yTopAt(x1)); ctx.stroke();
    }
    // inner edge highlight at the sea bed
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(xF, HZ); ctx.lineTo(bl[0], bl[1]); ctx.stroke();
  }
}

function frontSky(ctx, t, top = '#f6b884', bottom = '#fde9c6') {
  A.sky(ctx, SW, HZ + 40, top, bottom);
}

export const scenes = {
  // 60: Pharaoh's army sets out after them at sunrise
  musa_pursuit: {
    cam(t, T) { return { x: keys(t, [[T.c.start, armyX(t, T) - 60], [T.w(60, 2) - 0.2, armyX(t, T) + 40], [T.ve(60) + 0.3, GROUP_X + 120]]), y: 445, z: keys(t, [[T.c.start, 1.12], [T.ve(60), 0.95]]) }; },
    draw(ctx, t, T) { sideWorld(ctx, this.cam(t, T), t, T, sideState(t, T)); },
    anchors(t, T) { const c = this.cam(t, T); return { sun: S(par(c, 0.2), 700, sideState(t, T).sunY) }; },
  },
  // 61: the two companies see each other; "we will be overtaken"
  musa_meet: {
    cam(t, T) { return { x: keys(t, [[T.c.start, 860], [T.c.end, 900]]), y: 470, z: keys(t, [[T.c.start, 0.62], [T.w(61, 7), 0.66], [T.c.end, 0.8]]) }; },
    draw(ctx, t, T) { sideWorld(ctx, this.cam(t, T), t, T, sideState(t, T)); },
    anchors(t, T) {
      const c = this.cam(t, T), st = sideState(t, T);
      return { sight: S(c, lerp(st.armyX, GROUP_X + 60, 0.5), 430), companions: S(c, GROUP_X + 90, 580) };
    },
  },
  // 62: "No! Indeed, with me is my Lord"
  musa_trust: {
    cam(t, T) { return { x: keys(t, [[T.c.start, GROUP_X + 200], [T.c.end, GROUP_X + 260]]), y: 520, z: keys(t, [[T.c.start, 1.15], [T.c.end, 1.32]]) }; },
    draw(ctx, t, T) { sideWorld(ctx, this.cam(t, T), t, T, sideState(t, T)); },
    anchors(t, T) { const c = this.cam(t, T); return { musa: S(c, GROUP_X + 300, 560) }; },
  },
  // 63: strike the sea - it parts into walls like great mountains
  musa_sea: {
    st(t, T) {
      const strike = prog(t, T.w(63, 5), T.w(63, 7));
      return {
        reveal: env(t, T.v(63), T.w(63, 5), 0.5, 0.6),
        staffAng: lerp(-0.08, 0.95, ease.inOutCubic(strike)),
        hit: T.w(63, 7),
        p: prog(t, T.w(63, 8), T.w(63, 8) + 1.9),
        grow: lerp(1, 1.32, ease.inOutCubic(prog(t, T.w(63, 12), T.we(63, 13)))),
        z: keys(t, [[T.c.start, 1.16], [T.w(63, 12), 1.1], [T.we(63, 13), 1.0]]),
      };
    },
    draw(ctx, t, T) {
      const s = this.st(t, T);
      ctx.save();
      ctx.translate(SW / 2, SH * 0.62); ctx.scale(s.z, s.z); ctx.translate(-SW / 2, -SH * 0.62);
      frontSky(ctx, t);
      A.glowDisc(ctx, 690, 180, 60, '#fff3d4', '#ffcf86', 240, 1, 0.6);
      seaSurface(ctx, t, 1);
      const dt = t - s.hit;
      for (let k = 0; k < 3 && dt > 0; k++) {
        const q = prog(dt, k * 0.25, k * 0.25 + 1.6);
        if (q <= 0 || q >= 1) continue;
        ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - q)})`; ctx.lineWidth = 6 * (1 - q) + 1.5;
        ctx.beginPath(); ctx.ellipse(CX + 30, 690, 40 + q * 420, 10 + q * 90, 0, 0, TAU); ctx.stroke();
      }
      pathAndWalls(ctx, t, s.p, s.grow);
      // the shore in front, Musa with his staff, his people seen from behind
      ctx.fillStyle = '#e4c58f';
      ctx.beginPath(); ctx.moveTo(-60, 812); ctx.quadraticCurveTo(CX, 772, SW + 60, 812); ctx.lineTo(SW + 60, SH + 80); ctx.lineTo(-60, SH + 80); ctx.closePath(); ctx.fill();
      A.octagram(ctx, CX, 690, 120, '#f2c25b', s.reveal, t * 0.3, 0.1, 5);
      musa(ctx, CX - 40, 700, 1.0, t, { staffAng: s.staffAng, glow: 1 + 0.6 * s.reveal });
      [[60, 0], [175, 3], [790, 1], [905, 5]].forEach(([x, i]) => israelite(ctx, i, x, SH + 10, 1.3, t, { back: true }));
      ctx.restore();
    },
    anchors(t, T) {
      const s = this.st(t, T), g = wallsGeom(s.p, s.grow);
      const z = (x, y) => [(x - SW / 2) * s.z + SW / 2, (y - SH * 0.62) * s.z + SH * 0.62];
      return { path: z(CX, 470), wall: z(CX - g.gN / 2 - 110, (SH + 40 - g.HN + HZ) / 2 + 60) };
    },
  },
  // 64-66: the pursuers are drawn in; Musa and all with him saved; then the sea closes
  musa_rescue: {
    st(t, T) {
      const close = T.w(66, 2) - 0.25;
      return {
        p: 1 - ease.inCubic(prog(t, close, close + 1.0)),
        close,
        rough: 1 + 2.5 * env(t, close + 0.6, T.c.end + 2, 0.4, 3.0),
        uGroup: lerp(0.62, 1.05, ease.inOutSine(prog(t, T.c.start - 0.5, T.w(65, 3)))),
        uArmy: lerp(-0.25, 0.42, ease.outCubic(prog(t, T.w(64, 1) - 0.2, T.w(66, 1)))),
        saved: env(t, T.w(65, 4), T.c.end + 1, 0.6, 0.3),
      };
    },
    draw(ctx, t, T) {
      const s = this.st(t, T);
      frontSky(ctx, t, '#f2bd8c', '#fde9c8');
      A.glowDisc(ctx, 700, 170, 58, '#fff4d8', '#ffd68f', 230, 1, 0.55);
      // far shore
      ctx.fillStyle = '#d8bd86'; ctx.fillRect(0, HZ - 6, SW, 10);
      seaSurface(ctx, t, s.rough);
      pathAndWalls(ctx, t, s.p, 1.32, () => {
        const g = wallsGeom(s.p, 1.32);
        // the believers far down the path
        for (let i = 0; i < 8; i++) {
          const u = Math.min(1, s.uGroup + (i % 4) * 0.025), sc = depthS(u) * 1.25;
          const x = CX + ((i % 4) - 1.5) * lerp(g.gN, g.gF, 1 - depthS(u)) * 0.12;
          israelite(ctx, i, x, depthY(u), sc, t, { walk: 1, back: true, alpha: 1 - prog(u, 0.99, 1.05) });
        }
        // the army entering behind them; gone once the sea closes
        const aa = 1 - prog(t, s.close + 0.35, s.close + 0.8);
        if (aa > 0.01) {
          for (let i = 9; i >= 0; i--) {
            const u = s.uArmy + Math.floor(i / 3) * 0.07, sc = depthS(Math.max(0, u)) * 1.3;
            if (u < -0.12) continue;
            const x = CX + ((i % 3) - 1) * lerp(g.gN, g.gF, 1 - depthS(Math.max(0, u))) * 0.22;
            if (i === 0) pharaoh(ctx, x, depthY(Math.max(0, u)) , sc * 1.1, t, { back: true, alpha: aa });
            else soldier(ctx, i, x, depthY(Math.max(0, u)), sc, t, { back: true, alpha: aa });
          }
        }
      });
      // saved on the far shore
      if (s.saved > 0) {
        A.glowDisc(ctx, CX, HZ - 4, 1, 'rgba(0,0,0,0)', '#9fe0ff', 70 + 20 * s.saved, s.saved, 0.7);
        ctx.save(); ctx.globalAlpha = s.saved; ctx.strokeStyle = '#3fae66'; ctx.lineWidth = 4; ctx.setLineDash([8, 7]); ctx.lineDashOffset = -t * 20;
        ctx.beginPath(); ctx.ellipse(CX, HZ - 6, 70, 20, 0, 0, TAU); ctx.stroke(); ctx.restore();
      }
      // the crash of water when it closes
      const dc = t - s.close;
      if (dc > 0.3 && dc < 3.5) {
        for (let i = 0; i < 14; i++) {
          const u = i / 13, y = depthY(u * 0.9), r = (30 + hash(i) * 50) * depthS(u * 0.9) * 3;
          const a = clamp(1 - (dc - 0.3) / 3.2) * 0.9;
          A.dust(ctx, CX + (hash(i * 3) - 0.5) * 200 * depthS(u), y - 20 - Math.sin(dc * 2 + i) * 10, r, a, '#ffffff');
        }
      }
    },
    anchors(t, T) {
      const s = this.st(t, T);
      return { army: [CX, depthY(Math.max(0, s.uArmy + 0.07)) - 80 * depthS(Math.max(0, s.uArmy))], saved: [CX, HZ - 6], sea: [CX, 520] };
    },
  },
  // 67-68: a sign - the Exalted in Might, the Merciful
  musa_lesson: {
    draw(ctx, t, T) {
      const z = keys(t, [[T.c.start, 1.0], [T.c.end, 1.06]]);
      ctx.save(); ctx.translate(SW / 2, SH / 2); ctx.scale(z, z); ctx.translate(-SW / 2, -SH / 2);
      frontSky(ctx, t, '#bcd8e6', '#f7ecd4');
      A.cloud(ctx, 150 + (t * 5) % 900 - 200, 110, 0.8, 0.85);
      const sa = env(t, T.w(67, 4), T.c.end + 1, 0.8, 0.3), sb = env(t, T.w(68, 4), T.c.end + 1, 0.6, 0.3);
      A.glowDisc(ctx, 480, 200, 60, '#fff6dc', '#ffe2a0', 220 + 60 * sb, 1, 0.55 + 0.25 * sb);
      A.octagram(ctx, 480, 200, 112 + 14 * sb, '#e9b54a', sa, t * 0.25, 0.08 + 0.1 * sb, 5);
      for (let i = 0; i < 4; i++) A.bird(ctx, (100 + i * 230 + t * 20) % 1040 - 40, 90 + hash(i + 7) * 110, 1.1, t, i);
      ctx.fillStyle = '#d8bd86'; ctx.fillRect(0, HZ - 6, SW, 10);
      seaSurface(ctx, t, 0.7);
      for (let i = 0; i < 6; i++) A.sparkle(ctx, 120 + i * 150 + Math.sin(t + i) * 10, 420 + hash(i) * 260, 10, Math.max(0, Math.sin(t * 1.4 + i * 1.3)) * 0.8);
      ctx.restore();
    },
    anchors(t, T) { return { star: [480, 200] }; },
  },
};
