// Pure helpers. Nothing here may depend on wall-clock time or Math.random (every frame = f(t)).
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, b) => (b <= a ? (t >= a ? 1 : 0) : clamp((t - a) / (b - a)));

export const ease = {
  linear: (x) => x,
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  outBack: (x) => { const c1 = 1.70158, c3 = c1 + 1; return x <= 1e-4 ? 0 : 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
};

// window envelope: 0 before a, rises over `inD`, holds, falls over `outD` before b
export function env(t, a, b, inD = 0.3, outD = 0.3, e = ease.outCubic) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.min(e(prog(t, a, a + inD)), 1 - ease.inCubic(prog(t, b - outD, b)));
}

// keyframes [[t, v], ...]
export function keys(t, kf, e = ease.inOutCubic) {
  if (t <= kf[0][0]) return kf[0][1];
  for (let i = 0; i < kf.length - 1; i++) {
    if (t <= kf[i + 1][0]) return lerp(kf[i][1], kf[i + 1][1], e(prog(t, kf[i][0], kf[i + 1][0])));
  }
  return kf[kf.length - 1][1];
}

export function hash(n) {
  n = (n | 0) ^ 0x9e3779b9;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

export function hex2rgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export const rgba = (hex, a = 1) => { const [r, g, b] = hex2rgb(hex); return `rgba(${r},${g},${b},${a})`; };
export function mixHex(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b);
  const c = A.map((x, i) => Math.round(lerp(x, B[i], clamp(t))));
  return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
}

// deterministic per-frame index for flicker (never Math.floor(t*fps) on sub-frames)
export const frameIdx = (t, fps = 30) => Math.floor(t * fps + 1e-6);
