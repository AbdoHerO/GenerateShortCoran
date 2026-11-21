"""Show a storyboard compactly for restaging: chapters, words with times (seconds into the video), glosses, notes.
Usage: python3 sbshow.py <pid> [<pid> ...]
"""
import json, pathlib, sys

ROOT = pathlib.Path('/home/user/GenerateShortCoran')


def show(pid):
    sb = json.loads((ROOT / "storyboard" / f"{pid}.json").read_text(encoding="utf-8"))
    src = json.loads((ROOT / "data" / pid / "source.json").read_text(encoding="utf-8"))
    ch = sb["passage"]["chapter"]
    T = {t["verse_key"]: t for t in src["recitation"]["timestamps"]}
    V = {v["verse_number"]: v for v in src["verses"]}
    first_v = min(V)
    t0 = T[f"{ch}:{first_v}"]["timestamp_from"] / 1000
    print(f"=== {pid}  cover: {sb['cover'].get('title_ar')} | series {sb['cover'].get('series_ar')} | at {sb['cover'].get('at')}")
    notes = (sb.get("director") or {}).get("notes", "")
    if notes: print("notes:", notes[:900])
    G = {}
    for g in sb.get("glosses", []):
        G.setdefault(g["verse"], []).append(f"[{g['words'][0]}-{g['words'][1]}] {g['excerpt']}")
    for c in sb["chapters"]:
        p = c.get("params", {})
        mot = ", ".join(f"{m['at'][0]}:{m['at'][1]} {m['motif']}" + (f" until={m['until'][0]}:{m['until'][1]}" if m.get("until") else "") for m in p.get("motifs", []))
        print(f"-- {c['id']} «{c['title']}» verses {c['verses']} now: {c['scene']} {p.get('mood') or p.get('setting')} t={p.get('transition')} motifs: {mot}")
        for n in c["verses"]:
            ws = [w for w in V[n]["words"] if w["char_type_name"] == "word"]
            first = {}
            for s in T[f"{ch}:{n}"]["segments"]:
                first.setdefault(s[0], s[1] / 1000 - t0)
            print(f"   {n}: " + " | ".join(f"{w['position']} {w['text_uthmani']} @{first.get(w['position'], float('nan')):.1f}" for w in ws))
            for g in G.get(n, []): print(f"      gloss {g}")


for pid in sys.argv[1:]:
    show(pid)
