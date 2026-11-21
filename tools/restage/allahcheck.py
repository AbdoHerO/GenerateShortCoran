"""allahcheck.py [--fix] id... : flag motifs (other than geometric/light/seal) alive over a sacred word (Allah's name,
«رب», al-Rahman, angels, prophets, the Prophet), and `mountains` mood where His name is recited.
Lifetime = at .. min(until, next motif at) or chapter end. --fix: end the motif at the first sacred word (until), or
drop it when it would live fewer than 2 words; mountains mood -> dawn."""
import json, pathlib, re, sys
ROOT = pathlib.Path('/home/user/GenerateShortCoran')
sys.path.insert(0, str(ROOT / 'pipeline'))
import autobeats  # noqa
SAFE = {'geometric', 'light', 'seal'}
NAME = re.compile(r"الله|لله|الرحمان|^(و|ف|ب|ل|يا)*رب(ي|ك|كم|كما|نا|ه|هم|هما|هن|كن)?$")
def is_name(t): return any(NAME.search(w) for w in autobeats.verify.skel(t))
FIX = '--fix' in sys.argv
for pid in [a for a in sys.argv[1:] if not a.startswith('--')]:
    p_sb = ROOT / 'storyboard' / f'{pid}.json'
    sb = json.loads(p_sb.read_text(encoding='utf-8'))
    src = json.loads((ROOT / 'data' / pid / 'source.json').read_text(encoding='utf-8'))
    V = {v['verse_number']: [x['text_uthmani'] for x in v['words'] if x['char_type_name'] == 'word'] for v in src['verses']}
    chn = sb['passage']['chapter']
    SEG = {}   # (verse, pos) -> [(start, end)] for EVERY recited occurrence, the reciter's repeats included
    for t in src['recitation']['timestamps']:
        n = int(t['verse_key'].split(':')[1])
        for sg in t['segments']:
            if len(sg) >= 3: SEG.setdefault((n, sg[0]), []).append((sg[1] / 1000, sg[2] / 1000))
    first = lambda k: min(a for a, _ in SEG[k]) if k in SEG else None
    changed = False
    for c in sb['chapters']:
        p = c.get('params') or {}
        seq = [(n, i + 1) for n in c['verses'] for i in range(len(V[n]))]
        idx = {k: j for j, k in enumerate(seq)}
        if p.get('mood') == 'mountains':
            hits = [f'{n}:{w}' for n, w in seq if is_name(V[n][w - 1])]
            if hits:
                print(f'{pid} {c["id"]} MOOD mountains over the Name at {hits}')
                if FIX: p['mood'] = 'dawn'; changed = True
        ms = sorted(p.get('motifs') or [], key=lambda m: idx.get(tuple(m['at']), 0))
        drop = []
        for k, m in enumerate(ms):
            if m['motif'] in SAFE: continue
            a = idx.get(tuple(m['at']), 0)
            e = len(seq)
            if m.get('until'): e = min(e, idx.get(tuple(m['until']), e))
            if k + 1 < len(ms): e = min(e, idx.get(tuple(ms[k + 1]['at']), e))
            hits = [j for j in range(a, e) if autobeats.sacred(V[seq[j][0]][seq[j][1] - 1])]
            # time check: the reciter's repeats can bring a Name back while the plate is still on screen
            t0 = first(tuple(m['at']))
            t1 = first(seq[e]) if e < len(seq) else max((b for k2 in seq for _, b in SEG.get(k2, [])), default=None)
            if t0 is not None and t1 is not None and not hits:
                rep = [f'{n}:{w}@{x:.1f}s' for (n, w) in seq if is_name(V[n][w - 1]) for x, y in SEG.get((n, w), []) if x < t1 and y > t0]
                if rep: print(f'{pid} {c["id"]} NAME-REPEAT {m["motif"]} at {m["at"]} until {m.get("until")} over {rep}')
            if hits:
                kind = 'NAME' if any(is_name(V[seq[j][0]][seq[j][1] - 1]) for j in hits) else 'person'
                print(f'{pid} {c["id"]} {kind} {m["motif"]} at {m["at"]} until {m.get("until")} over {[f"{seq[j][0]}:{seq[j][1]}" for j in hits]}')
                if FIX:
                    j = hits[0]
                    if j - a < 2: drop.append(m); print('   -> dropped')
                    else: m['until'] = list(seq[j]); print(f'   -> until {seq[j]}')
                    changed = True
        if drop: p['motifs'] = [m for m in p['motifs'] if m not in drop]
    if changed: p_sb.write_text(json.dumps(sb, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
