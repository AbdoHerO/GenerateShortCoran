// Contact sheets for the generic scene library.
// node renderer/tests/lib_shot.mjs <suite> [out.png]     suites: moods, settings, actors, events, edges, perf, custom (JSON cases in argv[4])
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const [, , suite = 'moods', outArg, customJson] = process.argv;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf' };
const srv = http.createServer((q, r) => {
  const p = path.normalize(path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] ?? 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
}).listen(0, '127.0.0.1');
await new Promise((r) => srv.on('listening', r));

const MOODS = ['night_sky', 'dawn', 'sea', 'mountains', 'garden', 'rain', 'geometric', 'light'];
const SETS = ['desert', 'city', 'sea_shore', 'mountains', 'garden', 'palace', 'river'];
const TIMES = ['day', 'dawn', 'dusk', 'night'];
const A = (id, type, place, extra = {}) => ({ id, type, label: '', place, count: 1, pose: 'stand', enter: null, exit: null, ...extra });
const STD = [A('musa', 'prophet', 'center', { label: 'موسى عليه السلام' }), A('folk', 'believers', 'left', { count: 5 }), A('foes', 'disbelievers', 'right', { count: 5 })];

const suites = {
  moods: () => MOODS.flatMap((m) => [{ scene: 'ambient', params: { mood: m }, t: 2.1, label: m }]).concat([{ scene: 'ambient', params: { mood: 'rain' }, t: 13, label: 'rain end' }]),
  settings: () => SETS.flatMap((s, i) => [{ scene: 'stage', params: { setting: s, time: TIMES[i % 4], actors: STD, events: [] }, t: 3, label: `${s} ${TIMES[i % 4]}` }])
    .concat(TIMES.map((tm) => ({ scene: 'stage', params: { setting: 'desert', time: tm, actors: STD, events: [] }, t: 6, label: `desert ${tm}` }))),
  actors: () => [
    { scene: 'stage', params: { setting: 'desert', time: 'day', actors: [A('n', 'prophet', 'left', { label: 'نوح عليه السلام' }), A('ang', 'angel', 'center', { label: 'ملائكة', count: 3 }), A('m', 'honored', 'right', { label: 'مريم عليها السلام' })], events: [] }, t: 2, label: 'drops' },
    { scene: 'stage', params: { setting: 'city', time: 'day', actors: [A('p', 'people', 'left', { count: 6 }), A('b', 'believers', 'center', { count: 4 }), A('d', 'disbelievers', 'right', { count: 12 })], events: [] }, t: 2, label: 'groups' },
    { scene: 'stage', params: { setting: 'palace', time: 'day', actors: [A('k', 'king', 'center', { label: 'فرعون' }), A('s', 'soldiers', 'left', { count: 6 }), A('s2', 'soldiers', 'right', { count: 4 })], events: [] }, t: 2, label: 'pharaoh court' },
    { scene: 'stage', params: { setting: 'desert', time: 'dusk', actors: [A('k', 'king', 'left'), A('c', 'camel', 'center', { pose: 'walk' }), A('br', 'birds', 'right', { count: 7 })], events: [] }, t: 2, label: 'king camel birds' },
    { scene: 'stage', params: { setting: 'sea_shore', time: 'day', actors: [A('sh', 'ship', 'right'), A('nh', 'prophet', 'left', { label: 'نوح عليه السلام' }), A('b', 'believers', 'center', { count: 3 })], events: [] }, t: 2, label: 'ship sea' },
    { scene: 'stage', params: { setting: 'river', time: 'dawn', actors: [A('sh', 'ship', 'center'), A('p', 'people', 'left', { count: 3, pose: 'gather' })], events: [] }, t: 2, label: 'river ship gather' },
    { scene: 'stage', params: { setting: 'desert', time: 'day', actors: [A('w', 'believers', 'left', { count: 4, pose: 'walk' }), A('f', 'people', 'right', { count: 4, pose: 'flee' })], events: [] }, t: 0.5, label: 'walk/flee t0.5' },
    { scene: 'stage', params: { setting: 'desert', time: 'day', actors: [A('w', 'believers', 'left', { count: 4, pose: 'walk' }), A('f', 'people', 'right', { count: 4, pose: 'flee' })], events: [] }, t: 4, label: 'walk/flee t4' },
    { scene: 'stage', params: { setting: 'desert', time: 'day', actors: [A('x', 'prophet', 'center', { label: 'إبراهيم عليه السلام', enter: [2, 1], exit: [3, 4] }), A('y', 'people', 'center', { count: 3 }), A('z', 'camel', 'center')], events: [] }, t: 5.5, label: 'shared place + enter' },
  ],
  events: () => {
    const ev = (type, setting, actors, times, extra = {}) => times.map((t) => ({ scene: 'stage', params: { setting, time: extra.time ?? 'day', actors, events: [{ type, at: [2, 1], until: null }] }, t, label: `${type} ${setting}` }));
    const crowd = [A('d', 'disbelievers', 'left', { count: 5 }), A('lut', 'prophet', 'right', { label: 'لوط عليه السلام' })];
    return [
      ...ev('rain', 'garden', crowd, [4.5, 7]), ...ev('storm', 'desert', crowd, [7]), ...ev('flood', 'sea_shore', [A('sh', 'ship', 'right'), A('nh', 'prophet', 'center', { label: 'نوح عليه السلام' }), A('d', 'disbelievers', 'left', { count: 5 })], [6, 9, 13]),
      ...ev('stones', 'city', crowd, [5.6, 9]), ...ev('blast', 'city', crowd, [4.95, 5.5, 9]), ...ev('quake', 'mountains', crowd, [5.3, 9]),
      ...ev('fire', 'desert', [A('ib', 'prophet', 'center', { label: 'إبراهيم عليه السلام' }), A('p', 'disbelievers', 'right', { count: 4 })], [7]),
      ...ev('sea_part', 'sea_shore', [A('m', 'prophet', 'center', { label: 'موسى عليه السلام' }), A('b', 'believers', 'left', { count: 6 })], [5.5, 9]),
      ...ev('sea_part', 'river', [A('m', 'prophet', 'left', { label: 'موسى عليه السلام' })], [9]),
      ...ev('light', 'mountains', [A('m', 'prophet', 'left', { label: 'موسى عليه السلام' })], [8], { time: 'night' }), ...ev('darkness', 'city', crowd, [8]),
      ...ev('ruin', 'city', crowd, [5.6, 9]), ...ev('ruin', 'palace', [A('k', 'king', 'center', { label: 'فرعون' })], [9]), ...ev('growth', 'desert', [], [8]),
      ...ev('lightning', 'mountains', crowd, [5.2, 5.3]),
    ];
  },
  edges: () => [
    { scene: 'ambient', params: { mood: 'dawn' }, t: -0.35, label: 'ambient pre-start' },
    { scene: 'ambient', params: {}, t: 3, label: 'ambient no mood' },
    { scene: 'ambient', params: { mood: 'nope' }, t: 3, label: 'ambient bad mood' },
    { scene: 'stage', params: {}, t: 3, label: 'stage empty params' },
    { scene: 'stage', params: { setting: 'x', time: 'y', actors: [{ type: 'king' }, { id: 'q', type: 'prophet', place: 'nowhere', label: 'يونس عليه السلام', enter: [9, 9] }], events: [{ type: 'stones', at: [9, 99] }, { type: 'flood' }] }, t: 3, label: 'stage bad refs' },
    { scene: 'stage', params: { setting: 'city', time: 'day', actors: STD, events: [{ type: 'blast', at: [1, 1] }] }, t: 14.4, label: 'after end' },
    { scene: 'stage', params: { setting: 'desert', time: 'day', actors: STD, events: [] }, t: 40, label: 'long chapter t=40', o: { verses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } },
    { scene: 'stage', params: { setting: 'city', time: 'day', actors: STD, events: [{ type: 'stones', at: [1, 2] }, { type: 'rain', at: [1, 1] }] }, t: 60, label: 'stones t=60', o: { verses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] } },
    { scene: 'ambient', params: { mood: 'light' }, t: 85, label: 'light t=85', o: { verses: [...Array(20).keys()].map((i) => i + 1) } },
  ],
};
// ---------------- v2: Al-Kahf pack, beats, auto camera ----------------
// fake timeline: verse v, word p starts at 0.3 + (v-1)*5.3 + (p-1)*0.5 (+0.35 after word 4); 8 words per verse
const wt = (v, p) => +(0.3 + (v - 1) * 5.3 + (p - 1) * 0.5 + (p > 4 ? 0.35 : 0)).toFixed(2);
const LONG = { verses: [1, 2, 3, 4, 5, 6] };
const st = (setting, time, actors, events = [], beats = []) => ({ setting, time, actors, events, beats });
const SLEEP = A('ss', 'sleepers', 'center'), DOGS = A('dg', 'dog', 'right', { pose: 'sleep' });
suites.kahf_settings = () => [
  { scene: 'stage', params: st('cave', 'day', [SLEEP, DOGS]), t: 3, label: 'cave day' },
  { scene: 'stage', params: st('cave', 'night', [SLEEP, DOGS]), t: 3, label: 'cave night' },
  { scene: 'stage', params: st('cave_mouth', 'dawn', [A('y', 'believers', 'left', { count: 4, pose: 'walk' }), A('dg', 'dog', 'center', { pose: 'walk' })]), t: 4, label: 'cave_mouth dawn' },
  { scene: 'stage', params: st('cave_mouth', 'day', [A('y', 'believers', 'left', { count: 6, uncountable: true }), A('dg', 'dog', 'right', { pose: 'sit' })]), t: 3, label: 'cave_mouth uncountable' },
  { scene: 'stage', params: st('pass', 'day', [A('r', 'ruler', 'left'), A('b', 'barrier', 'center'), A('w', 'workers', 'right', { count: 4 })]), t: 3, label: 'pass day (barrier done)' },
  { scene: 'stage', params: st('pass', 'dusk', [A('r', 'ruler', 'left'), A('p', 'people', 'right', { count: 5 })]), t: 3, label: 'pass dusk (no barrier)' },
  { scene: 'stage', params: st('sea_junction', 'day', [A('m', 'prophet', 'left', { label: 'موسى عليه السلام' }), A('f', 'fish', 'center'), A('yt', 'believers', 'right', { count: 1 })]), t: 3, label: 'sea_junction day' },
  { scene: 'stage', params: st('sea_junction', 'dusk', [A('rk', 'rock', 'left'), A('m', 'prophet', 'center', { label: 'موسى عليه السلام' })]), t: 3, label: 'sea_junction dusk + rock' },
  { scene: 'stage', params: st('garden', 'day', [A('o', 'man', 'left', { look: 'rich' }), A('f', 'man', 'right', { look: 'poor' })]), t: 3, label: 'garden (vines)' },
];
suites.kahf_actors = () => [
  { scene: 'stage', params: st('desert', 'day', [A('r', 'ruler', 'left'), A('k', 'king', 'center'), A('k2', 'king', 'right', { label: 'فرعون' })]), t: 2, label: 'ruler vs kings' },
  { scene: 'stage', params: st('city', 'day', [A('a', 'man', 'left', { look: 'plain' }), A('b', 'man', 'left', { look: 'rich' }), A('c', 'man', 'center', { look: 'poor' }), A('d', 'man', 'right', { look: 'traveller' })]), t: 2, label: 'man looks' },
  { scene: 'stage', params: st('pass', 'day', [A('w', 'workers', 'left', { count: 4 }), A('w2', 'workers', 'right', { count: 3 })]), t: 2, label: 'workers' },
  { scene: 'stage', params: st('desert', 'day', [A('d1', 'dog', 'left', { pose: 'sleep' }), A('d2', 'dog', 'center'), A('d3', 'dog', 'right', { pose: 'walk' })]), t: 2, label: 'dog lie/stand/walk' },
  { scene: 'stage', params: st('sea_junction', 'day', [A('f', 'fish', 'left'), A('r', 'rock', 'center'), A('w', 'wall', 'right')]), t: 2, label: 'fish rock wall' },
  { scene: 'stage', params: st('desert', 'night', [A('b', 'believers', 'left', { count: 3, pose: 'sleep' }), A('p', 'people', 'right', { count: 4, pose: 'sit' })]), t: 2, label: 'sleep / sit poses' },
  { scene: 'stage', params: st('cave', 'day', [A('y', 'believers', 'center', { count: 7, uncountable: true, pose: 'sit' }), DOGS]), t: 3, label: 'cave: youths awake, uncountable' },
  { scene: 'stage', params: st('cave', 'dawn', [SLEEP, DOGS]), t: 3, label: 'sleepers close-up', o: {} },
  { scene: 'stage', params: st('city', 'day', [A('y', 'believers', 'center', { count: 5, uncountable: true })]), t: 3, label: 'uncountable outdoors' },
];
suites.kahf_events = () => {
  const ev = (type, at = [2, 1], until = null) => [{ type, at, until }];
  const S1 = (label, setting, time, actors, events, times) => times.map((t) => ({ scene: 'stage', params: st(setting, time, actors, events), t, label: `${label}` }));
  return [
    ...S1('sun_arc', 'cave', 'day', [SLEEP, DOGS], ev('sun_arc', [1, 2], [3, 8]), [1.5, 7, 13]),
    ...S1('turn_sleepers', 'cave', 'day', [SLEEP, DOGS], ev('turn_sleepers', [1, 2]), [2, 3.6]),
    ...S1('wake', 'cave', 'dawn', [SLEEP, DOGS], ev('wake', [2, 1]), [4, 6.5, 10]),
    ...S1('wither', 'garden', 'day', [A('o', 'man', 'left', { look: 'rich' })], ev('wither', [2, 1]), [4, 7, 11]),
    ...S1('fish_escape', 'sea_junction', 'day', [A('f', 'fish', 'center'), A('yt', 'believers', 'right', { count: 1 })], ev('fish_escape', [2, 1]), [5, 6.1, 9.5]),
    ...S1('ship_hole', 'sea_shore', 'day', [A('sh', 'ship', 'center'), A('k', 'prophet', 'left', { label: 'الخضر' })], ev('ship_hole', [2, 1]), [5, 8]),
    ...S1('wall_repair', 'city', 'day', [A('w', 'wall', 'center'), A('k', 'prophet', 'left', { label: 'الخضر' })], ev('wall_repair', [2, 1]), [5, 7, 10]),
    ...S1('barrier_build', 'pass', 'day', [A('b', 'barrier', 'center'), A('r', 'ruler', 'left'), A('w', 'workers', 'right', { count: 3 })], ev('barrier_build', [1, 2], [3, 8]), [0.5, 5, 8.6, 10.5, 13]),
    ...S1('sunset_far', 'desert', 'dusk', [A('r', 'ruler', 'left')], ev('sunset_far', [1, 2]), [2, 6, 10]),
    ...S1('sunset_far sea', 'sea_shore', 'dusk', [A('r', 'ruler', 'left')], ev('sunset_far', [1, 2]), [10]),
    ...S1('sunrise_open', 'desert', 'dawn', [A('p', 'people', 'center', { count: 6 }), A('r', 'ruler', 'left')], ev('sunrise_open', [1, 2]), [1.5, 4, 8]),
  ];
};
const beatCase = (scene, params, times, label) => times.map((t) => ({ scene, params, t, label, o: LONG }));
suites.beats = () => {
  const actors = [A('k', 'prophet', 'left', { label: 'موسى عليه السلام' }), A('y', 'man', 'center', { look: 'traveller' }), A('p', 'people', 'right', { count: 3 }), A('d', 'dog', 'right')];
  const beats = [
    { at: [1, 3], do: 'speak', who: 'y' }, { at: [1, 6], do: 'point', who: 'y', to: 'left' }, { at: [2, 1], do: 'raise_hands', who: 'p' },
    { at: [2, 4], do: 'shot_close', who: 'y' }, { at: [2, 6], do: 'bow', who: 'y' }, { at: [2, 8], do: 'shake_head', who: 'p' },
    { at: [3, 2], do: 'shot_wide' }, { at: [3, 3], do: 'walk_to', who: 'y', to: 'left' }, { at: [3, 6], do: 'look_up', who: 'k' },
    { at: [3, 8], do: 'wring_hands', who: 'p' }, { at: [4, 2], do: 'sit', who: 'y' }, { at: [4, 4], do: 'glow', who: 'k' },
    { at: [4, 6], do: 'turn', who: 'p' }, { at: [4, 8], do: 'birds' }, { at: [5, 2], do: 'stand_up', who: 'y' }, { at: [5, 3], do: 'wind' },
    { at: [5, 5], do: 'sparkle', who: 'k' }, { at: [5, 7], do: 'clouds_part' }, { at: [6, 1], do: 'leaves' }, { at: [6, 3], do: 'pan_right' }, { at: [6, 6], do: 'push_in' },
  ];
  const P = st('desert', 'day', actors, [], beats);
  return beatCase('stage', P, [wt(1, 3) + 0.6, wt(1, 6) + 0.7, wt(2, 1) + 0.9, wt(2, 4) + 1.4, wt(2, 6) + 0.8, wt(2, 8) + 0.5, wt(3, 3) + 1.5, wt(3, 6) + 0.9, wt(3, 8) + 0.8,
    wt(4, 2) + 1.2, wt(4, 4) + 0.8, wt(4, 6) + 0.25, wt(4, 8) + 1.6, wt(5, 3) + 1.0, wt(5, 5) + 0.6, wt(5, 7) + 3, wt(6, 1) + 2, wt(6, 6) + 2.5], 'beats');
};
suites.amb_beats = () => {
  const B = (mood, beats, times) => times.map((t) => ({ scene: 'ambient', params: { mood, beats }, t, label: mood + ' ' + beats.map((b) => b.do).join('+'), o: LONG }));
  return [
    ...B('night_sky', [{ at: [1, 4], do: 'stars' }], [wt(1, 4) + 1.2]),
    ...B('light', [{ at: [1, 4], do: 'light_up' }], [wt(1, 4) + 1]),
    ...B('mountains', [{ at: [1, 2], do: 'rain_start' }, { at: [3, 1], do: 'rain_stop' }], [wt(1, 2) + 2.5, wt(3, 1) + 3]),
    ...B('rain', [{ at: [1, 2], do: 'rain_stop' }, { at: [2, 1], do: 'bloom' }], [wt(2, 1) + 3]),
    ...B('garden', [{ at: [1, 2], do: 'wither' }], [wt(1, 2) + 3.5]),
    ...B('dawn', [{ at: [1, 2], do: 'bloom' }], [wt(1, 2) + 3]),
    ...B('sea', [{ at: [1, 2], do: 'waves' }], [wt(1, 2) + 1.8]),
    ...B('sea', [{ at: [1, 2], do: 'ink_waves' }, { at: [2, 2], do: 'ink_waves' }], [wt(2, 2) + 3.5]),
    ...B('geometric', [{ at: [1, 2], do: 'pattern_turn' }, { at: [2, 2], do: 'pattern_turn' }], [wt(2, 2) + 0.8]),
    ...B('garden', [{ at: [1, 2], do: 'clouds_part' }, { at: [1, 6], do: 'birds' }, { at: [2, 1], do: 'leaves' }], [wt(1, 6) + 1.5]),
    ...B('dawn', [{ at: [1, 2], do: 'shot_sky' }, { at: [2, 2], do: 'shot_ground' }], [wt(1, 2) + 1.6]),
    ...B('dawn', [{ at: [1, 2], do: 'shot_sky' }, { at: [2, 2], do: 'shot_ground' }], [wt(2, 2) + 1.6]),
  ];
};
// zero beats over ~32 s: automatic recomposition only
suites.auto = () => [0, 4, 6, 8, 12, 16, 20, 24, 28].map((t) => ({ scene: 'stage', params: st('cave', 'day', [SLEEP, DOGS]), t, label: 'auto cam', o: LONG }));
suites.perf = () => [...suites.moods(), ...suites.settings(), ...suites.events(), ...suites.kahf_settings(), ...suites.kahf_actors(), ...suites.kahf_events(), ...suites.beats(), ...suites.amb_beats()];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${srv.address().port}/renderer/tests/lib.html`);
await page.waitForFunction('window.done', null, { timeout: 30000 });
const cases = suite === 'custom' ? JSON.parse(customJson) : suites[suite] ? suites[suite]() : [];
if (suite === 'camprobe') {
  // camera path with zero beats (auto recomposition) and with beats; prints t, x, y, z
  const times = [...Array(66).keys()].map((i) => i * 0.5);
  for (const [label, scene, params] of [['stage zero beats', 'stage', { setting: 'cave', time: 'day', actors: [{ id: 'ss', type: 'sleepers', place: 'center' }, { id: 'dg', type: 'dog', place: 'right', pose: 'sleep' }] }], ['ambient zero beats', 'ambient', { mood: 'dawn' }]]) {
    const res = await page.evaluate(([s, p, ts]) => window.camAt(s, p, ts, { verses: [1, 2, 3, 4, 5, 6] }), [scene, params, times]);
    console.log(label); console.log(res.map((r) => r.join(' ')).join(' | '));
  }
  const tl = await page.evaluate(() => window.timeline({ verses: [1, 2, 3, 4, 5, 6] }));
  console.log('pauses at', tl.words.filter((w) => w[3]).map((w) => w[2]).join(' '), 'end', tl.end.toFixed(2));
} else if (suite === 'perf') {
  // warm up, then time each case 5x
  const res = await page.evaluate((cases) => { window.flush = true; return cases.map((k) => { for (let i = 0; i < 3; i++) window.drawAt(k.scene, k.params, k.t + i / 30, k.o); let s = 0; for (let i = 0; i < 6; i++) s += window.drawAt(k.scene, k.params, k.t + i / 30, k.o).ms; return [k.label, s / 6]; }); }, cases);
  for (const [l, ms] of res) console.log(ms.toFixed(1).padStart(6), 'ms', l);
} else {
  const timings = await page.evaluate(([c]) => window.sheet(c, 3, 0.4), [cases]);
  const out = path.resolve(ROOT, outArg || `out/wip/lib_${suite}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const cv = await page.$('#c');
  await cv.screenshot({ path: out });
  console.log(out);
  const bad = timings.filter((x) => x.ms == null);
  if (bad.length) console.log('ANCHOR PROBLEMS:', bad.map((b) => b.label).join(' | '));
}
if (errors.length) console.log('PAGE ERRORS:', errors.join(' | '));
await browser.close(); srv.close();
