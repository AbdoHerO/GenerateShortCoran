// Motion graphics v3: MOTIFS, animated symbolic line-art illustrations tied to recited words.
// Contract: renderer/js/scene_catalog.json "motifs" (ids, places, sizes, exits), enforced by pipeline/verify.py.
// A motif draws itself on (plate, gold ring, strokes, then fills), lives (breathes with every recited word, its own
// gentle motion and particles), then leaves (dissolve, fly or undraw) at `until`, when the next motif takes its place,
// or at the chapter end. Every frame is a pure function of t (no randomness, no clock).
// Rules: never a face or an eye; nothing for Allah (geometry and light only); nothing literal for the unseen.
// The motifs allowed on the Name or «رب» (geometric, seal, light) are revealed whole (`reveal: 'fade'`): a half-stroked
// circle and star can read as a head in profile, so they never show a partial outline.
import { TAU, clamp, lerp, prog, ease, hash, rgba } from './util.js';

const NAVY = '#1f2b4f', GOLD = '#d4a955', GOLD_HI = '#f2c25b', CREAM = '#fbf6ec';
const H = (a, b = 0) => hash(Math.imul(a | 0, 7919) + Math.imul(b | 0, 104729) + 977);

// ---------------------------------------------------------------- path helpers (unit box -100..100)
const f = (n) => +n.toFixed(2);
const M = (x, y) => `M ${f(x)} ${f(y)}`;
const Lp = (...pts) => pts.map((p, i) => (i ? 'L ' : 'M ') + f(p[0]) + ' ' + f(p[1])).join(' ');
const circ = (x, y, r) => `M ${f(x + r)} ${f(y)} A ${f(r)} ${f(r)} 0 1 0 ${f(x - r)} ${f(y)} A ${f(r)} ${f(r)} 0 1 0 ${f(x + r)} ${f(y)}`;
const ell = (x, y, rx, ry) => `M ${f(x + rx)} ${f(y)} A ${f(rx)} ${f(ry)} 0 1 0 ${f(x - rx)} ${f(y)} A ${f(rx)} ${f(ry)} 0 1 0 ${f(x + rx)} ${f(y)}`;
function star(x, y, r1, r2, n, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
  return Lp(...pts) + ' Z';
}
const mirror = (d) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${f(-x)} ${y}`)
  .replace(/A (\S+) (\S+) (\S+) (\S+) (\S+)/g, (m, rx, ry, rot, la, sw) => `A ${rx} ${ry} ${rot} ${la} ${sw === '1' ? 0 : 1}`);
function wavePath(y, amp, x0 = -96, x1 = 96, n = 4) {
  const step = (x1 - x0) / n;
  let d = M(x0, y);
  for (let i = 0; i < n; i++) d += ` Q ${f(x0 + step * (i + 0.5))} ${f(y + (i % 2 ? amp : -amp))} ${f(x0 + step * (i + 1))} ${f(y)}`;
  return d;
}

// ---------------------------------------------------------------- the library
// strokes: [d | {d, g}] drawn on in order; fills: [{d, c, g?, a?}] fade in after the strokes; g = group (own live motion)
// live: idle motion; fx: particles; dur: draw-on seconds; accent: glow colour
const HAND_R = 'M 14 84 L 12 22 Q 6 8 -2 -6 Q -8 -18 0 -22 Q 8 -24 16 -12 L 22 -2 L 22 -50 Q 22 -60 29 -60 Q 36 -60 36 -50 L 36 -16 L 37 -58 Q 37 -68 44 -68 Q 51 -68 51 -58 L 50 -14 L 52 -50 Q 52 -60 59 -60 Q 66 -60 66 -50 L 64 -10 L 67 -36 Q 68 -45 74 -45 Q 80 -44 79 -35 L 74 22 Q 70 52 56 84 Z';
const DOG = 'M -88 44 Q -92 6 -50 4 Q 0 0 40 10 Q 46 -14 62 -24 Q 84 -36 98 -18 Q 106 -4 94 6 Q 80 12 70 14 Q 64 34 44 44 Z';
const LIB = {
  book: {
    strokes: ['M 0 -46 Q -40 -62 -86 -50 L -86 50 Q -40 38 0 54 Z', 'M 0 -46 Q 40 -62 86 -50 L 86 50 Q 40 38 0 54 Z', 'M 0 -46 L 0 54',
      'M -72 -26 Q -42 -36 -14 -26', 'M -72 -6 Q -42 -16 -14 -6', 'M -72 14 Q -42 4 -14 14', 'M 14 -26 Q 42 -36 72 -26', 'M 14 -6 Q 42 -16 72 -6', 'M 14 14 Q 42 4 60 10'],
    fills: [{ d: 'M 0 -46 Q -40 -62 -86 -50 L -86 50 Q -40 38 0 54 Z', c: '#fff7e6' }, { d: 'M 0 -46 Q 40 -62 86 -50 L 86 50 Q 40 38 0 54 Z', c: '#fff7e6' }],
    live: 'bob', fx: 'rise', accent: GOLD_HI,
  },
  scroll: {
    strokes: ['M -54 -56 L -54 56 L 54 56 L 54 -56', 'M -66 -62 Q -66 -78 -50 -78 L 66 -78 Q 82 -78 82 -62 Q 82 -46 66 -46 L -50 -46 Q -66 -46 -66 -62 Z',
      'M -66 62 Q -66 46 -50 46 L 66 46 Q 82 46 82 62 Q 82 78 66 78 L -50 78 Q -66 78 -66 62 Z', 'M -32 -24 L 34 -24', 'M -32 -4 L 34 -4', 'M -32 16 L 20 16'],
    fills: [{ d: 'M -54 -50 L -54 52 L 54 52 L 54 -50 Z', c: '#fbefd2' }],
    live: 'bob', fx: 'sparkles', accent: GOLD_HI,
  },
  pen: {
    strokes: ['M -88 48 Q -88 86 -60 86 Q -32 86 -32 48 Z', 'M -96 48 L -24 48', 'M -52 40 L 62 -80', 'M 62 -80 Q 18 -70 -8 -20 Q 30 -38 62 -80',
      'M 40 -64 L 20 -50', 'M 30 -52 L 12 -40'],
    fills: [{ d: 'M -88 48 Q -88 86 -60 86 Q -32 86 -32 48 Z', c: '#2f3f6b' }, { d: 'M 62 -80 Q 18 -70 -8 -20 Q 30 -38 62 -80', c: '#fbefd2' }],
    live: 'sway', fx: 'sparkles', accent: GOLD_HI,
  },
  scales: {
    strokes: ['M 0 -64 L 0 70', 'M -44 76 L 44 76', 'M 0 -78 L 0 -64',
      { d: 'M -72 -50 L 72 -50', g: 'beam' }, { d: 'M -72 -50 L -92 10 M -72 -50 L -52 10', g: 'beam' }, { d: 'M -98 10 Q -72 36 -46 10 Z', g: 'beam' },
      { d: 'M 72 -50 L 92 10 M 72 -50 L 52 10', g: 'beam' }, { d: 'M 98 10 Q 72 36 46 10 Z', g: 'beam' }],
    fills: [{ d: 'M -98 10 Q -72 36 -46 10 Z', c: GOLD_HI, g: 'beam' }, { d: 'M 98 10 Q 72 36 46 10 Z', c: GOLD_HI, g: 'beam' }],
    groups: { beam: { pivot: [0, -50], live: 'tilt' } }, live: 'none', fx: 'sparkles', accent: GOLD_HI,
  },
  hourglass: {
    strokes: ['M -54 -80 L 54 -80', 'M -54 80 L 54 80', 'M -42 -76 Q -42 -20 -6 0 Q -42 20 -42 76', 'M 42 -76 Q 42 -20 6 0 Q 42 20 42 76'],
    fills: [], live: 'none', fx: 'sand', accent: GOLD_HI, dur: 0.9,
  },
  two_paths: {
    strokes: ['M -22 92 Q -18 30 -70 -56', 'M 22 92 Q 18 30 70 -56', 'M -2 92 Q -2 50 -30 -10 Q -40 -36 -46 -56', 'M 2 92 Q 2 50 30 -10 Q 40 -36 46 -56',
      circ(58, -70, 12), circ(-58, -70, 12)],
    fills: [{ d: 'M 2 92 Q 2 50 30 -10 Q 40 -36 46 -56 L 70 -56 Q 18 30 22 92 Z', c: '#f6e2b3' }, { d: circ(58, -70, 12), c: GOLD_HI }, { d: circ(-58, -70, 12), c: '#9aa0ad' }],
    live: 'breathe', fx: 'sparkles', accent: GOLD_HI,
  },
  door: {
    strokes: ['M -56 82 L -56 -28 Q -56 -84 0 -84 Q 56 -84 56 -28 L 56 82', 'M -76 82 L 76 82',
      { d: 'M -42 82 L -42 -24 Q -42 -68 0 -68 Q 42 -68 42 -24 L 42 82', g: 'leaf' }, { d: circ(26, 12, 5), g: 'leaf' }],
    fills: [{ d: 'M -42 82 L -42 -24 Q -42 -68 0 -68 Q 42 -68 42 -24 L 42 82 Z', c: '#fff1c9' },
      { d: 'M -42 82 L -42 -24 Q -42 -68 0 -68 Q 42 -68 42 -24 L 42 82 Z', c: '#8a5a32', g: 'leaf' }],
    groups: { leaf: { pivot: [-42, 0], live: 'open' } }, live: 'none', fx: 'glow', accent: '#ffe9a8',
  },
  key: {
    strokes: [circ(-46, 0, 26), circ(-46, 0, 10), 'M -20 0 L 80 0', 'M 52 0 L 52 24', 'M 68 0 L 68 18'],
    fills: [], live: 'sway', fx: 'sparkles', accent: GOLD_HI,
  },
  lamp: {
    strokes: ['M -62 16 Q -40 52 20 46 Q 62 40 84 -4 Q 50 14 30 12 Q -20 6 -62 16 Z', 'M -62 16 Q -96 12 -86 -10 Q -76 -26 -58 -6',
      'M -20 46 L -28 68 L 28 68 L 20 46', { d: 'M 84 -6 Q 68 -40 86 -68 Q 106 -38 84 -6 Z', g: 'flame' }],
    fills: [{ d: 'M -62 16 Q -40 52 20 46 Q 62 40 84 -4 Q 50 14 30 12 Q -20 6 -62 16 Z', c: '#c9973f' }, { d: 'M 84 -6 Q 68 -40 86 -68 Q 106 -38 84 -6 Z', c: GOLD_HI, g: 'flame' }],
    groups: { flame: { pivot: [84, -6], live: 'flicker' } }, live: 'none', fx: 'glow', accent: '#ffd37a', glowAt: [84, -36],
  },
  candle: {
    strokes: ['M -22 -8 L -22 80 L 22 80 L 22 -8 Z', 'M 0 -8 L 0 -22', 'M -54 82 L 54 82', { d: 'M 0 -22 Q -16 -50 0 -80 Q 16 -50 0 -22 Z', g: 'flame' }],
    fills: [{ d: 'M -22 -8 L -22 80 L 22 80 L 22 -8 Z', c: '#f7ebd5' }, { d: 'M 0 -22 Q -16 -50 0 -80 Q 16 -50 0 -22 Z', c: GOLD_HI, g: 'flame' }],
    groups: { flame: { pivot: [0, -22], live: 'flicker' } }, live: 'none', fx: 'glow', accent: '#ffd37a', glowAt: [0, -50],
  },
  sun: {
    strokes: [circ(0, 0, 40), ...[...Array(12).keys()].map((i) => { const a = (i * TAU) / 12; return { d: Lp([Math.cos(a) * 56, Math.sin(a) * 56], [Math.cos(a) * 84, Math.sin(a) * 84]), g: 'rays' }; })],
    fills: [{ d: circ(0, 0, 40), c: GOLD_HI }], groups: { rays: { pivot: [0, 0], live: 'spin' } }, live: 'breathe', fx: 'glow', accent: '#ffd37a',
  },
  moon: {
    strokes: ['M 24 -72 A 76 76 0 1 0 24 72 A 60 60 0 1 1 24 -72 Z'],
    fills: [{ d: 'M 24 -72 A 76 76 0 1 0 24 72 A 60 60 0 1 1 24 -72 Z', c: '#f6e7b8' }], live: 'sway', fx: 'twinkle', accent: '#e9ecff',
  },
  stars: {
    strokes: [{ d: star(-30, -10, 46, 18, 5), g: 's1' }, { d: star(46, -50, 26, 10, 5), g: 's2' }, { d: star(50, 46, 20, 8, 5), g: 's3' }],
    fills: [{ d: star(-30, -10, 46, 18, 5), c: GOLD_HI, g: 's1' }, { d: star(46, -50, 26, 10, 5), c: GOLD_HI, g: 's2' }, { d: star(50, 46, 20, 8, 5), c: GOLD_HI, g: 's3' }],
    groups: { s1: { pivot: [-30, -10], live: 'twinkle', k: 0 }, s2: { pivot: [46, -50], live: 'twinkle', k: 1 }, s3: { pivot: [50, 46], live: 'twinkle', k: 2 } },
    live: 'none', fx: 'twinkle', accent: '#fff3c4',
  },
  cloud_rain: {
    strokes: ['M -64 10 Q -88 -30 -46 -40 Q -36 -78 6 -66 Q 36 -90 62 -50 Q 96 -42 84 6 Q 80 16 64 16 L -50 16 Q -60 16 -64 10 Z'],
    fills: [{ d: 'M -64 10 Q -88 -30 -46 -40 Q -36 -78 6 -66 Q 36 -90 62 -50 Q 96 -42 84 6 Q 80 16 64 16 L -50 16 Q -60 16 -64 10 Z', c: '#ffffff' }],
    live: 'drift', fx: 'rain', accent: '#cfe6ff',
  },
  drop: {
    strokes: ['M 0 -82 Q 58 -4 50 30 Q 40 74 0 74 Q -40 74 -50 30 Q -58 -4 0 -82 Z', 'M -26 26 Q -24 48 -6 54'],
    fills: [{ d: 'M 0 -82 Q 58 -4 50 30 Q 40 74 0 74 Q -40 74 -50 30 Q -58 -4 0 -82 Z', c: '#9fd0ee' }], live: 'bob', fx: 'ripples', accent: '#cfe6ff',
  },
  wave: {
    strokes: [{ d: wavePath(-34, 18), g: 'w1' }, { d: wavePath(0, 18), g: 'w2' }, { d: wavePath(34, 18), g: 'w3' }],
    fills: [], groups: { w1: { pivot: [0, 0], live: 'slide', k: 0 }, w2: { pivot: [0, 0], live: 'slide', k: 1 }, w3: { pivot: [0, 0], live: 'slide', k: 2 } },
    live: 'none', fx: 'none', accent: '#cfe6ff', stroke: '#2a6f97',
  },
  growth: {
    strokes: ['M -84 82 L 84 82', ell(0, 74, 10, 6), 'M 0 74 Q -4 40 0 10', 'M 0 40 Q -26 26 -34 6 Q -10 10 0 40', 'M 0 30 Q 24 14 34 -6 Q 10 0 0 30',
      'M 0 10 L 0 -16', circ(0, -42, 34), circ(-32, -22, 24), circ(32, -22, 24)],
    fills: [{ d: circ(0, -42, 34), c: '#7cb850' }, { d: circ(-32, -22, 24), c: '#6aa86a' }, { d: circ(32, -22, 24), c: '#6aa86a' },
      { d: 'M 0 40 Q -26 26 -34 6 Q -10 10 0 40', c: '#8fd06a' }, { d: 'M 0 30 Q 24 14 34 -6 Q 10 0 0 30', c: '#8fd06a' }],
    live: 'sway', fx: 'rise', accent: '#c8f0a0', dur: 2.6,
  },
  leaf: {
    strokes: ['M 0 -74 Q 58 -20 0 72 Q -58 -20 0 -74 Z', 'M 0 -62 L 0 86', 'M 0 -30 L 22 -46', 'M 0 -6 L 26 -24', 'M 0 18 L 22 2', 'M 0 -18 L -22 -34', 'M 0 6 L -24 -12'],
    fills: [{ d: 'M 0 -74 Q 58 -20 0 72 Q -58 -20 0 -74 Z', c: '#c9a43a' }], live: 'fall', fx: 'none', accent: '#f1d27a',
  },
  mountain: {
    strokes: ['M -96 72 L -40 -26 L -10 12 L 30 -72 L 96 72 Z', 'M 14 -40 L 30 -72 L 46 -40'],
    fills: [{ d: 'M -96 72 L -40 -26 L -10 12 L 30 -72 L 96 72 Z', c: '#a9b4bf' }, { d: 'M 14 -40 L 30 -72 L 46 -40 Q 38 -46 30 -38 Q 22 -46 14 -40 Z', c: '#ffffff' }],
    live: 'breathe', fx: 'mist', accent: '#e8eef4',
  },
  wind: {
    strokes: ['M -90 -32 L 30 -32 Q 62 -32 62 -56 Q 62 -76 42 -76 Q 24 -76 24 -58', 'M -96 0 L 56 0 Q 90 0 90 26 Q 90 50 68 50 Q 50 50 50 32', 'M -80 32 L 10 32'],
    fills: [], live: 'drift', fx: 'streaks', accent: '#ffffff',
  },
  coins: {
    strokes: [ell(-24, 56, 46, 14), ell(-24, 40, 46, 14), ell(-24, 24, 46, 14), circ(46, -12, 40), circ(46, -12, 28)],
    fills: [{ d: ell(-24, 56, 46, 14), c: GOLD_HI }, { d: ell(-24, 40, 46, 14), c: GOLD_HI }, { d: ell(-24, 24, 46, 14), c: GOLD_HI }, { d: circ(46, -12, 40), c: GOLD_HI }],
    live: 'bob', fx: 'sparkles', accent: '#ffe08a',
  },
  jewel: {
    strokes: ['M -64 -20 L -32 -62 L 32 -62 L 64 -20 L 0 72 Z', 'M -64 -20 L 64 -20', 'M -32 -62 L -14 -20 L 0 72', 'M 32 -62 L 14 -20 L 0 72'],
    fills: [{ d: 'M -64 -20 L -32 -62 L 32 -62 L 64 -20 L 0 72 Z', c: '#8fd8cf' }], live: 'sway', fx: 'sparkles', accent: '#d9fffa',
  },
  crown: {
    strokes: ['M -70 48 L -82 -32 L -40 2 L 0 -62 L 40 2 L 82 -32 L 70 48 Z', 'M -74 66 L 74 66', circ(0, -62, 8), circ(-82, -32, 7), circ(82, -32, 7)],
    fills: [{ d: 'M -70 48 L -82 -32 L -40 2 L 0 -62 L 40 2 L 82 -32 L 70 48 Z', c: GOLD_HI }], live: 'bob', fx: 'sparkles', accent: '#ffe08a',
  },
  house: {
    strokes: ['M -74 -4 L 0 -72 L 74 -4', 'M -58 -18 L -58 76 L 58 76 L 58 -18', 'M -14 76 L -14 32 Q 0 16 14 32 L 14 76', 'M 26 2 L 44 2 L 44 20 L 26 20 Z'],
    fills: [{ d: 'M -58 -18 L 0 -70 L 58 -18 L 58 76 L -58 76 Z', c: '#f7ebd5' }], live: 'breathe', fx: 'glow', accent: '#ffe9a8', glowAt: [35, 11],
  },
  ship: {
    strokes: ['M -92 20 Q -70 70 0 70 Q 70 70 92 20 Z', 'M 0 20 L 0 -86', 'M 6 -80 Q 64 -38 6 6 Z', 'M -6 -70 Q -52 -34 -6 2 Z'],
    fills: [{ d: 'M -92 20 Q -70 70 0 70 Q 70 70 92 20 Z', c: '#a8713f' }, { d: 'M 6 -80 Q 64 -38 6 6 Z', c: '#fbf3e0' }, { d: 'M -6 -70 Q -52 -34 -6 2 Z', c: '#fbf3e0' }],
    live: 'rock', fx: 'ripples', accent: '#cfe6ff',
  },
  fish: {
    strokes: ['M -72 0 Q -20 -50 48 0 Q -20 50 -72 0 Z', 'M 48 0 L 86 -32 L 78 0 L 86 32 Z', 'M -14 -30 Q 0 -50 16 -24', 'M -40 -12 Q -34 0 -40 12'],
    fills: [{ d: 'M -72 0 Q -20 -50 48 0 Q -20 50 -72 0 Z', c: '#7fb2d9' }, { d: 'M 48 0 L 86 -32 L 78 0 L 86 32 Z', c: '#5f97c2' }],
    live: 'swim', fx: 'bubbles', accent: '#cfe6ff',
  },
  cave: {
    strokes: ['M -96 80 Q -92 -60 0 -72 Q 92 -60 96 80', 'M -52 80 Q -50 -8 0 -14 Q 50 -8 52 80', 'M -84 40 L -66 34', 'M 70 20 L 86 26'],
    fills: [{ d: 'M -96 80 Q -92 -60 0 -72 Q 92 -60 96 80 Z', c: '#b9a98d' }, { d: 'M -52 80 Q -50 -8 0 -14 Q 50 -8 52 80 Z', c: '#3b3348' }],
    live: 'breathe', fx: 'motes', accent: '#ffe9a8',
  },
  dog: {
    // the dog of the cave lying at the entrance, forelegs stretched out (no eye)
    strokes: [DOG, 'M 34 40 L 98 40', 'M 40 30 L 96 30', 'M -86 32 Q -104 14 -94 -8', 'M 60 -26 Q 58 -44 70 -48 Q 74 -34 70 -22'],
    fills: [{ d: DOG, c: '#b07a48' }, { d: 'M 60 -26 Q 58 -44 70 -48 Q 74 -34 70 -22 Z', c: '#8a5a32' }],
    live: 'breathe', fx: 'none', accent: '#ffe9a8',
  },
  hands: {
    // two open hands raised in du'a, palms toward the viewer (hands only)
    strokes: [HAND_R, mirror(HAND_R)],
    fills: [{ d: HAND_R, c: '#f7ebd5' }, { d: mirror(HAND_R), c: '#f7ebd5' }],
    live: 'bob', fx: 'rise', accent: '#ffe9a8', dur: 1.2,
  },
  chains: {
    strokes: [{ d: ell(-76, 0, 22, 12), g: 'L' }, { d: ell(-44, 0, 22, 12), g: 'L' }, { d: 'M -24 -8 L -14 -2 L -24 6', g: 'L' },
      { d: ell(44, 0, 22, 12), g: 'R' }, { d: ell(76, 0, 22, 12), g: 'R' }, { d: 'M 24 -8 L 14 -2 L 24 6', g: 'R' },
      'M 0 -40 L 0 -22', 'M -22 -34 L -12 -20', 'M 22 -34 L 12 -20', 'M 0 40 L 0 22'],
    fills: [], groups: { L: { pivot: [0, 0], live: 'apartL' }, R: { pivot: [0, 0], live: 'apartR' } }, live: 'none', fx: 'sparkles', accent: '#ffe08a',
  },
  burst: {
    strokes: [star(0, 0, 54, 22, 8, -Math.PI / 2), ...[...Array(8).keys()].map((i) => { const a = (i * TAU) / 8 + Math.PI / 8; return { d: Lp([Math.cos(a) * 62, Math.sin(a) * 62], [Math.cos(a) * 88, Math.sin(a) * 88]), g: 'rays' }; })],
    fills: [{ d: star(0, 0, 54, 22, 8, -Math.PI / 2), c: GOLD_HI }], groups: { rays: { pivot: [0, 0], live: 'spin' } }, live: 'breathe', fx: 'sparkles', accent: '#fff3c4',
  },
  crowd: {
    // rows of faceless silhouettes that run past the plate's edge, so they cannot be counted
    strokes: ['M -110 92 Q 0 80 110 92'],
    fills: [...[[-4, 9, 12, '#9b8a78', 0.85], [28, 8, 15, '#7a6856', 0.92], [64, 7, 19, '#5a4a3c', 1]].flatMap(([y, n, r, c, a], row) =>
      [...Array(n + 3).keys()].map((k) => {
        const x = -125 + (k * 250) / (n + 1) + (row % 2) * 10 + (H(k, row + 3) - 0.5) * 10, yy = y + (H(k, row + 9) - 0.5) * 6;
        return { d: circ(x, yy - r * 1.35, r * 0.62) + ' ' + `M ${f(x - r * 1.15)} ${f(yy + 90)} Q ${f(x - r * 1.2)} ${f(yy - r * 0.45)} ${f(x)} ${f(yy - r * 0.55)} Q ${f(x + r * 1.2)} ${f(yy - r * 0.45)} ${f(x + r * 1.15)} ${f(yy + 90)} Z`, c, a };
      }))],
    live: 'sway', fx: 'none', accent: '#ffe9a8', dur: 0.8,
  },
  geometric: {
    reveal: 'fade',
    strokes: [{ d: 'M -60 -60 L 60 -60 L 60 60 L -60 60 Z', g: 'r1' }, { d: 'M 0 -85 L 85 0 L 0 85 L -85 0 Z', g: 'r1' }, { d: circ(0, 0, 40), g: 'r2' }, { d: star(0, 0, 40, 30, 8, 0), g: 'r2' }],
    fills: [{ d: star(0, 0, 40, 30, 8, 0), c: '#f6e2b3', g: 'r2' }], groups: { r1: { pivot: [0, 0], live: 'spin' }, r2: { pivot: [0, 0], live: 'spinBack' } },
    live: 'none', fx: 'glow', accent: '#ffe9a8', stroke: '#a5762a',
  },
  light: {
    reveal: 'fade',
    strokes: [...[...Array(9).keys()].map((i) => { const a = Math.PI / 2 + (i - 4) * 0.2; return { d: Lp([0, -90], [Math.cos(a) * 190, -90 + Math.sin(a) * 190]), g: 'rays' }; }), circ(0, -76, 14)],
    fills: [{ d: circ(0, -76, 14), c: '#fff3c4' }], groups: { rays: { pivot: [0, -90], live: 'pulse' } }, live: 'none', fx: 'motes', accent: '#fff3c4', stroke: '#c9973f',
  },
  palm: {
    strokes: ['M 4 86 Q -8 30 6 -36', 'M 6 -36 Q -40 -60 -80 -30', 'M 6 -36 Q -30 -86 -60 -84', 'M 6 -36 Q 30 -90 68 -76', 'M 6 -36 Q 52 -54 86 -20', 'M 6 -36 Q 4 -70 10 -90',
      circ(-2, -26, 6), circ(14, -24, 6)],
    fills: [{ d: circ(-2, -26, 6), c: '#a8573a' }, { d: circ(14, -24, 6), c: '#a8573a' }], live: 'sway', fx: 'none', accent: '#c8f0a0', stroke: '#3f6b35',
  },
  wheat: {
    strokes: ['M 0 86 Q -4 20 0 -70', ...[...Array(5).keys()].flatMap((i) => [ell(-12, -50 + i * 22, 9, 15), ell(12, -50 + i * 22, 9, 15)]), 'M 0 -70 L 0 -92'],
    fills: [...[...Array(5).keys()].flatMap((i) => [{ d: ell(-12, -50 + i * 22, 9, 15), c: GOLD_HI }, { d: ell(12, -50 + i * 22, 9, 15), c: GOLD_HI }])],
    live: 'sway', fx: 'none', accent: '#ffe08a',
  },
  fire: {
    strokes: [{ d: 'M -46 70 Q -70 10 -30 -30 Q -30 0 -10 6 Q -24 -50 10 -84 Q 6 -40 34 -20 Q 40 -40 34 -56 Q 74 -10 46 70 Z', g: 'flame' }, 'M -70 76 L 70 76', 'M -50 82 L 30 66', 'M 50 82 L -30 66'],
    fills: [{ d: 'M -46 70 Q -70 10 -30 -30 Q -30 0 -10 6 Q -24 -50 10 -84 Q 6 -40 34 -20 Q 40 -40 34 -56 Q 74 -10 46 70 Z', c: '#f2a03b', g: 'flame' },
      { d: 'M -20 70 Q -30 30 -8 10 Q 0 30 14 34 Q 18 18 14 6 Q 40 40 20 70 Z', c: '#ffe08a', g: 'flame' }],
    groups: { flame: { pivot: [0, 70], live: 'flicker' } }, live: 'none', fx: 'embers', accent: '#ffc070',
  },
  lightning: {
    strokes: ['M -64 -20 Q -88 -50 -48 -60 Q -36 -90 6 -80 Q 40 -98 62 -60 Q 92 -54 80 -22 L -56 -22', 'M 10 -22 L -14 26 L 10 26 L -10 84 L 40 8 L 14 8 L 30 -22'],
    fills: [{ d: 'M 10 -22 L -14 26 L 10 26 L -10 84 L 40 8 L 14 8 L 30 -22 Z', c: GOLD_HI }], live: 'none', fx: 'flash', accent: '#fff3c4',
  },
  footsteps: {
    strokes: [...[[-36, 60, -0.2], [10, 24, 0.2], [-30, -14, -0.2], [16, -52, 0.2]].map(([x, y, r]) => ({ d: ell(x, y, 13, 22), g: 'p' + ((y + 60) | 0) }))],
    fills: [...[[-36, 60], [10, 24], [-30, -14], [16, -52]].map(([x, y]) => ({ d: ell(x, y, 13, 22), c: '#c9a46a', g: 'p' + ((y + 60) | 0) }))],
    live: 'none', fx: 'none', accent: '#ffe9a8', stagger: 1,
  },
  bricks: {
    strokes: ['M -84 -60 L 84 -60 L 84 72 L -84 72 Z', 'M -84 -16 L 84 -16', 'M -84 28 L 84 28', 'M -28 -60 L -28 -16', 'M 28 -60 L 28 -16', 'M 0 -16 L 0 28', 'M -56 -16 L -56 28', 'M 56 -16 L 56 28', 'M -28 28 L -28 72', 'M 28 28 L 28 72'],
    fills: [{ d: 'M -84 -60 L 84 -60 L 84 72 L -84 72 Z', c: '#d9b48a' }], live: 'breathe', fx: 'sparkles', accent: '#ffe08a', dur: 1.3,
  },
  bird: {
    strokes: [{ d: 'M -86 -10 Q -46 -52 -6 4 Q 34 -52 86 -10', g: 'wings' }, 'M -6 4 Q 4 20 22 14'],
    fills: [], groups: { wings: { pivot: [0, 0], live: 'flap' } }, live: 'fly', fx: 'none', accent: '#ffffff',
  },
  night_day: {
    strokes: [circ(0, 0, 70), 'M 0 -70 A 70 70 0 0 0 0 70', 'M 0 -70 A 70 70 0 0 1 0 70'],
    fills: [{ d: 'M 0 -70 A 70 70 0 0 0 0 70 Z', c: '#1c2452' }, { d: 'M 0 -70 A 70 70 0 0 1 0 70 Z', c: GOLD_HI }],
    live: 'spinSlow', fx: 'twinkle', accent: '#fff3c4',
  },
  river: {
    strokes: ['M -40 -86 Q 40 -50 -10 -10 Q -60 30 20 86', 'M 0 -86 Q 80 -50 30 -10 Q -20 30 60 86'],
    fills: [{ d: 'M -40 -86 Q 40 -50 -10 -10 Q -60 30 20 86 L 60 86 Q -20 30 30 -10 Q 80 -50 0 -86 Z', c: '#9fd0ee' }], live: 'none', fx: 'flow', accent: '#cfe6ff',
  },
  seal: {
    reveal: 'fade',
    strokes: [circ(0, 0, 70), circ(0, 0, 52), star(0, 0, 40, 28, 8, 0)],
    fills: [{ d: circ(0, 0, 70), c: '#e8d3a2' }], live: 'spinSlow', fx: 'sparkles', accent: '#ffe08a',
  },
};
export const MOTIF_IDS = Object.keys(LIB);

// ---------------------------------------------------------------- geometry
export const PLACES = { center: [480, 400], left: [250, 330], right: [710, 330], top: [480, 210], bottom: [480, 640] };
export const SIZES = { s: 170, m: 240, l: 320 };

const CACHE = new Map();
let measurer = null;
function pathLen(d) {
  if (typeof document === 'undefined') return 600;
  if (!measurer) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    measurer = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.appendChild(measurer); svg.style.position = 'absolute'; svg.style.width = '0'; svg.style.height = '0';
    document.body.appendChild(svg);
  }
  measurer.setAttribute('d', d);
  return measurer.getTotalLength() || 1;
}
function compiled(id) {
  if (CACHE.has(id)) return CACHE.get(id);
  const m = LIB[id];
  if (!m) return null;
  const strokes = m.strokes.map((s) => { const d = typeof s === 'string' ? s : s.d; return { p: new Path2D(d), len: pathLen(d), g: typeof s === 'string' ? null : s.g }; });
  const fills = (m.fills || []).map((x) => ({ p: new Path2D(x.d), c: x.c, g: x.g || null, a: x.a ?? 1 }));
  const c = { ...m, strokes, fills, dur: m.dur ?? clamp(0.55 + strokes.length * 0.07, 0.7, 1.4) };
  CACHE.set(id, c);
  return c;
}

// ---------------------------------------------------------------- timing
function refT(T, ref, fb) {
  if (!Array.isArray(ref) || ref.length < 2) return fb;
  let v = NaN;
  try { v = T.at ? T.at(ref) : T.w(ref[0], ref[1]); } catch { v = NaN; }
  return Number.isFinite(v) ? v : fb;
}
// the motifs of a chapter with resolved times; a motif ends when the next one takes its place (match cut)
const PLAN = new WeakMap();
export function motifPlan(P, T) {
  const list = (P && Array.isArray(P.motifs)) ? P.motifs : [];
  if (!list.length) return [];
  const key = T || {};
  const hit = PLAN.get(key);
  if (hit && hit.src === list) return hit.out;
  const cs = Number.isFinite(T?.start) ? T.start : 0, ce = Number.isFinite(T?.end) ? T.end : cs + 30;
  const out = list.map((m, i) => ({ i, id: m.motif, place: PLACES[m.place] ? m.place : 'center', size: SIZES[m.size] ? m.size : 'm',
    exit: m.exit || 'dissolve', ts: refT(T, m.at, cs), te0: m.until ? refT(T, m.until, ce) : ce })).filter((m) => LIB[m.id]).sort((a, b) => a.ts - b.ts);
  for (const m of out) {
    const next = out.find((n) => n !== m && n.ts > m.ts + 0.2 && (n.place === m.place || overlaps(n, m)));
    m.te = Math.min(m.te0, next ? next.ts + 0.15 : Infinity, ce + 0.6);
    m.handoff = !!next && next.ts + 0.15 <= m.te0;
  }
  PLAN.set(key, { src: list, out });
  return out;
}
function overlaps(a, b) {
  const [ax, ay] = PLACES[a.place], [bx, by] = PLACES[b.place];
  return Math.hypot(ax - bx, ay - by) < (SIZES[a.size] + SIZES[b.size]) * 0.42;
}

// recited-word pulse: every word start inside the motif's life gives a small pop
function wordPop(T, t, ts) {
  const W = T?.words || [];
  let lo = 0, hi = W.length - 1, last = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (W[m].s <= t) { last = m; lo = m + 1; } else hi = m - 1; }
  if (last < 0) return 0;
  const age = t - W[last].s;
  if (W[last].s < ts + 0.4 || age > 0.6 || W[last].sacred) return 0;   // never pops on the Name, «رب», «قل», a prophet or a quiet word
  return age < 0.08 ? age / 0.08 : Math.exp(-(age - 0.08) * 6);
}

// ---------------------------------------------------------------- drawing
function groupXf(ctx, m, g, life, k0) {
  const spec = m.groups?.[g];
  if (!spec) return;
  const [px, py] = spec.pivot, k = (spec.k ?? 0) + k0;
  ctx.translate(px, py);
  switch (spec.live) {
    case 'tilt': ctx.rotate(Math.sin(life * 1.1) * 0.12); break;
    case 'spin': ctx.rotate(life * 0.35); break;
    case 'spinBack': ctx.rotate(-life * 0.5); break;
    case 'open': { const o = ease.inOutSine(clamp((life - 0.2) / 1.6)); ctx.scale(1 - 0.62 * o, 1); ctx.transform(1, -0.25 * o, 0, 1, 0, 0); break; }
    case 'flicker': { const s = 1 + 0.08 * Math.sin(life * 13 + 1) + 0.05 * Math.sin(life * 21); ctx.scale(1 + 0.04 * Math.sin(life * 17), s); break; }
    case 'twinkle': { const s = 1 + 0.16 * Math.sin(life * 3 + k * 2.1); ctx.scale(s, s); ctx.rotate(Math.sin(life * 1.3 + k) * 0.15); break; }
    case 'slide': ctx.translate(Math.sin(life * 1.6 + k * 1.3) * 12, 0); break;
    case 'apartL': ctx.translate(-12 * ease.outCubic(clamp(life / 0.9)) - 3 * Math.sin(life * 2), 0); break;
    case 'apartR': ctx.translate(12 * ease.outCubic(clamp(life / 0.9)) + 3 * Math.sin(life * 2), 0); break;
    case 'pulse': { const s = 1 + 0.05 * Math.sin(life * 2.4); ctx.scale(s, s); break; }
    case 'flap': ctx.scale(1, 0.75 + 0.35 * Math.sin(life * 7)); break;
    default: break;
  }
  ctx.translate(-px, -py);
}
function bodyXf(ctx, m, life) {
  switch (m.live) {
    case 'bob': ctx.translate(0, Math.sin(life * 1.7) * 6); break;
    case 'sway': ctx.rotate(Math.sin(life * 1.3) * 0.06); break;
    case 'breathe': { const s = 1 + 0.035 * Math.sin(life * 2.2); ctx.scale(s, s); break; }
    case 'drift': ctx.translate(Math.sin(life * 0.9) * 12, Math.sin(life * 1.4) * 3); break;
    case 'rock': ctx.rotate(Math.sin(life * 1.5) * 0.07); ctx.translate(0, Math.sin(life * 3) * 3); break;
    case 'swim': ctx.translate(Math.sin(life * 1.2) * 14, Math.sin(life * 2.4) * 5); ctx.rotate(Math.sin(life * 2.4) * 0.08); break;
    case 'fall': ctx.translate(Math.sin(life * 1.1) * 18, ((life * 10) % 40) - 20); ctx.rotate(Math.sin(life * 1.1) * 0.35); break;
    case 'fly': ctx.translate(Math.sin(life * 0.8) * 16, Math.sin(life * 1.6) * 8); break;
    case 'spinSlow': ctx.rotate(life * 0.22); break;
    default: break;
  }
}

function fxDraw(ctx, m, fx, life, a, k, id) {
  if (!fx || fx === 'none' || a <= 0.01) return;
  const seed = id.length * 31;
  ctx.save();
  switch (fx) {
    case 'sparkles':
      for (let j = 0; j < 6; j++) {
        const ang = H(seed, j) * TAU + life * 0.25, r = 78 + H(seed, j + 9) * 18, tw = Math.max(0, Math.sin(life * 3 + j * 1.9));
        sparkle(ctx, Math.cos(ang) * r, Math.sin(ang) * r, 6 + 7 * tw, a * (0.25 + 0.75 * tw), '#fff3c4');
      }
      break;
    case 'twinkle':
      for (let j = 0; j < 9; j++) {
        const x = (H(seed, j) - 0.5) * 170, y = (H(seed, j + 20) - 0.5) * 170, tw = Math.max(0, Math.sin(life * 2.6 + j * 2.3));
        sparkle(ctx, x, y, 3 + 5 * tw, a * tw * 0.9, '#ffffff');
      }
      break;
    case 'rise': case 'motes':
      for (let j = 0; j < 10; j++) {
        const sp = 18 + H(seed, j) * 22, ph = (life * sp + H(seed, j + 5) * 200) % 200, x = (H(seed, j + 40) - 0.5) * 150 + Math.sin(life + j) * 8;
        const y = fx === 'rise' ? 80 - ph : 90 - ph, al = a * Math.sin((ph / 200) * Math.PI) * 0.85;
        ctx.fillStyle = rgba(m.accent, al); ctx.beginPath(); ctx.arc(x, y, 2.2 + 2.2 * H(seed, j + 70), 0, TAU); ctx.fill();
      }
      break;
    case 'rain':
      ctx.strokeStyle = rgba('#5d8fc2', a * 0.85); ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      for (let j = 0; j < 12; j++) {
        const x = -60 + (j % 6) * 24 + (j > 5 ? 12 : 0), ph = (life * 150 + H(seed, j) * 90) % 90;
        ctx.beginPath(); ctx.moveTo(x - ph * 0.12, 22 + ph); ctx.lineTo(x - ph * 0.12 - 3, 36 + ph); ctx.stroke();
      }
      break;
    case 'ripples': case 'flow':
      for (let j = 0; j < 3; j++) {
        const ph = ((life * 0.6 + j / 3) % 1), y = fx === 'flow' ? 0 : 88;
        ctx.strokeStyle = rgba('#5d8fc2', a * (1 - ph) * 0.8); ctx.lineWidth = 3;
        if (fx === 'flow') { ctx.beginPath(); ctx.arc(-30 + j * 30 + Math.sin(life + j) * 6, -70 + ph * 150, 4 + ph * 4, 0, TAU); ctx.stroke(); }
        else { ctx.beginPath(); ctx.ellipse(0, y, 20 + ph * 70, 5 + ph * 12, 0, 0, TAU); ctx.stroke(); }
      }
      break;
    case 'bubbles':
      for (let j = 0; j < 6; j++) {
        const ph = (life * 0.5 + H(seed, j)) % 1;
        ctx.strokeStyle = rgba('#5d8fc2', a * (1 - ph)); ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(-80 - j * 4 + Math.sin(life * 2 + j) * 6, 10 - ph * 90, 4 + j % 3 * 2, 0, TAU); ctx.stroke();
      }
      break;
    case 'mist':
      for (let j = 0; j < 3; j++) {
        const x = ((life * (12 + j * 6) + j * 70) % 260) - 130;
        ctx.fillStyle = rgba('#ffffff', a * 0.5);
        ctx.beginPath(); ctx.ellipse(x, 40 + j * 16, 60, 9, 0, 0, TAU); ctx.fill();
      }
      break;
    case 'streaks':
      ctx.strokeStyle = rgba('#ffffff', a * 0.9); ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let j = 0; j < 5; j++) {
        const ph = (life * 0.9 + H(seed, j)) % 1, y = -60 + j * 30, x = -120 + ph * 240;
        ctx.globalAlpha = Math.sin(ph * Math.PI);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 40, y); ctx.stroke();
      }
      break;
    case 'embers':
      for (let j = 0; j < 9; j++) {
        const ph = (life * 0.7 + H(seed, j)) % 1, x = (H(seed, j + 3) - 0.5) * 90 + Math.sin(life * 3 + j) * 10;
        ctx.fillStyle = rgba('#ffb347', a * (1 - ph)); ctx.beginPath(); ctx.arc(x, 40 - ph * 140, 3 + 2 * (1 - ph), 0, TAU); ctx.fill();
      }
      break;
    case 'flash': {
      const fl = Math.max(0, Math.sin(life * 2.2)) ** 8;
      ctx.fillStyle = rgba('#fff8d8', a * fl * 0.7); ctx.beginPath(); ctx.arc(0, 0, 96, 0, TAU); ctx.fill();
      break;
    }
    case 'sand': {
      const p = clamp(life / 6);
      ctx.fillStyle = rgba('#e0b25c', a);
      ctx.beginPath(); ctx.moveTo(-34 * (1 - p), -66 + 50 * p); ctx.lineTo(34 * (1 - p), -66 + 50 * p); ctx.lineTo(0, -6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-36, 74); ctx.lineTo(36, 74); ctx.lineTo(36 * (1 - p * 0.4), 74 - 40 * p); ctx.lineTo(0, 74 - 52 * p); ctx.lineTo(-36 * (1 - p * 0.4), 74 - 40 * p); ctx.closePath(); ctx.fill();
      if (p < 1) { ctx.strokeStyle = rgba('#e0b25c', a); ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.lineDashOffset = -life * 40; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 74 - 52 * p); ctx.stroke(); }
      break;
    }
    case 'glow': default: break;
  }
  ctx.restore();
  void k;
}
function sparkle(ctx, x, y, r, a, col) {
  if (a <= 0.01) return;
  ctx.fillStyle = rgba(col, a);
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

// one motif at time t (scene-canvas coordinates, 960 x 870)
function drawOne(ctx, m, t, T, settle = false) {
  const C = compiled(m.id);
  if (!C || t < m.ts - 0.05 || t > m.te + 0.05) return;
  // leaving
  const leaveD = m.exit === 'undraw' || m.handoff ? 0.55 : 0.5;
  // a short-lived motif draws on faster, so it is complete before it starts to leave (never seen half drawn)
  const D = Math.min(C.dur, Math.max(0.25, (m.te - m.ts) - leaveD - 0.1));
  // on the cover (a frozen frame used as thumbnail) a motif that has started is shown complete, never half drawn
  const age = settle && t >= m.ts ? Math.max(t - m.ts, D + 0.45) : t - m.ts, life = Math.max(0, age);
  const lv = prog(t, m.te - leaveD, m.te);
  let alpha = 1, sc = 1, dy = 0, undraw = 0;
  if (m.handoff || m.exit === 'undraw') undraw = ease.inOutSine(lv);
  else if (m.exit === 'fly') { dy = -150 * ease.inCubic(lv); alpha = 1 - ease.inCubic(lv); sc = 1 - 0.2 * lv; }
  else { alpha = 1 - ease.inOutSine(lv); sc = 1 + 0.14 * ease.inOutSine(lv); }
  if (alpha <= 0.01) return;
  const [cx, cy] = PLACES[m.place], size = SIZES[m.size], k = size / 200;
  const plateIn = ease.outBack(prog(age, 0, 0.42)) * (1 - ease.inCubic(undraw));
  const pop = wordPop(T, t, m.ts) * 0.035;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy + dy);
  ctx.scale(k * sc * (1 + pop), k * sc * (1 + pop));
  // plate: soft cream disc with a gold ring that draws on
  if (plateIn > 0.01) {
    ctx.save();
    ctx.scale(plateIn, plateIn);
    const glow = ctx.createRadialGradient(0, 0, 60, 0, 0, 132);
    glow.addColorStop(0, rgba(C.accent, 0.38 + 0.12 * Math.sin(life * 2.2))); glow.addColorStop(1, rgba(C.accent, 0));
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 132, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(-30, -40, 10, 0, 0, 104);
    g.addColorStop(0, rgba(CREAM, 0.96)); g.addColorStop(1, rgba('#f1e3c4', 0.93));
    ctx.fillStyle = g; ctx.shadowColor = 'rgba(40,30,20,0.25)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.beginPath(); ctx.arc(0, 0, 104, 0, TAU); ctx.fill();
    ctx.shadowColor = 'transparent';
    const ringP = ease.inOutCubic(prog(age, 0.1, 0.65)) * (1 - undraw);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 104, -Math.PI / 2, -Math.PI / 2 + TAU * ringP); ctx.stroke();
    ctx.strokeStyle = rgba(GOLD, 0.45); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 94, Math.PI / 2, Math.PI / 2 + TAU * ringP); ctx.stroke();
    // a slow orbiting bead on the ring keeps the plate alive
    if (ringP > 0.98) { const ba = -Math.PI / 2 + life * 0.6; ctx.fillStyle = GOLD_HI; ctx.beginPath(); ctx.arc(Math.cos(ba) * 104, Math.sin(ba) * 104, 6, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // icon (clipped to the plate)
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, 100 * Math.max(0.01, plateIn), 0, TAU); ctx.clip();
  ctx.scale(0.78, 0.78);
  if (C.glowAt || C.fx === 'glow') {
    const [gx, gy] = C.glowAt || [0, 0], ga = 0.45 + 0.2 * Math.sin(life * 3.1);
    const gg = ctx.createRadialGradient(gx, gy, 4, gx, gy, 90);
    gg.addColorStop(0, rgba(C.accent, ga * prog(age, D * 0.6, D + 0.3))); gg.addColorStop(1, rgba(C.accent, 0));
    ctx.fillStyle = gg; ctx.fillRect(-130, -130, 260, 260);
  }
  bodyXf(ctx, C, life);
  const n = C.strokes.length, drawP = (j) => {
    const a = C.stagger ? (j / n) * 0.8 : (j / n) * 0.45, b = C.stagger ? a + 0.25 : a + 0.55;
    return ease.inOutSine(clamp((age / D - a) / (b - a))) * (1 - clamp(undraw * 1.3 - (j / n) * 0.3));
  };
  const fillA = ease.outCubic(prog(age, D * 0.55, D + 0.35)) * (1 - undraw);
  const withG = (g, fn) => { ctx.save(); if (g) groupXf(ctx, C, g, life, 0); fn(); ctx.restore(); };
  for (const fl of C.fills) {
    if (fillA <= 0.01) break;
    withG(fl.g, () => { ctx.globalAlpha *= fillA * fl.a; ctx.fillStyle = fl.c; ctx.fill(fl.p, 'evenodd'); });
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  C.strokes.forEach((s, j) => {
    const p = drawP(j);
    if (p <= 0.005) return;
    withG(s.g, () => {
      ctx.strokeStyle = C.stroke || NAVY; ctx.lineWidth = 6.5;
      if (C.reveal === 'fade') ctx.globalAlpha *= p;   // whole outline, fading in: never a partial shape
      else if (p < 0.999) { ctx.setLineDash([s.len * p, s.len + 10]); ctx.lineDashOffset = 0; }
      ctx.stroke(s.p);
    });
  });
  ctx.setLineDash([]);
  fxDraw(ctx, C, C.fx, Math.max(0, age - D * 0.6), fillA, 0, m.id);
  ctx.restore();
  ctx.restore();
}

// all motifs of a chapter, drawn on top of its scene
export function drawMotifs(ctx, t, T, P, settle = false) {
  const plan = motifPlan(P, T);
  for (const m of plan) drawOne(ctx, m, t, T, settle);
}
// motif anchors (scene coordinates) for gloss arrows: 'motif' = the motif visible now (latest started)
export function motifAnchor(t, T, P) {
  const plan = motifPlan(P, T).filter((m) => t >= m.ts && t < m.te);
  if (!plan.length) return null;
  const m = plan[plan.length - 1];
  const [x, y] = PLACES[m.place];
  return [x, y + SIZES[m.size] * 0.45];
}
