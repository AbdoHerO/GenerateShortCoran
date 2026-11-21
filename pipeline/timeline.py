"""Compact timeline of a storyboard for writing motion graphics v3: per chapter, every word with its position and start
time (seconds from the chapter's first word), the actions already placed (beats B, motifs M, events E, glosses G) and
the longest gap with nothing happening.

Usage: python pipeline/timeline.py <id> [--no-words]
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]


def main(pid, words=True):
    sb = json.loads((ROOT / "storyboard" / f"{pid}.json").read_text(encoding="utf-8"))
    src = json.loads((ROOT / "data" / pid / "source.json").read_text(encoding="utf-8"))
    ch = sb["passage"]["chapter"]
    T = {t["verse_key"]: t for t in src["recitation"]["timestamps"]}
    V = {v["verse_number"]: v for v in src["verses"]}
    start = {}
    for n in V:
        for s in T[f"{ch}:{n}"]["segments"]:
            start.setdefault((n, s[0]), s[1] / 1000)
    t00 = min(start.values())
    print(f"# {pid} motion={sb.get('motion')} cover at {sb.get('cover', {}).get('at')}")
    for c in sb["chapters"]:
        p = c.get("params") or {}
        ws = [(n, w["position"], w["text_uthmani"]) for n in c["verses"] for w in V[n]["words"] if w["char_type_name"] == "word"]
        a = min(start[(n, k)] for n, k, _ in ws)
        b = max(s[2] / 1000 for n in c["verses"] for s in T[f"{ch}:{n}"]["segments"])
        acts = []
        for k, tag in (("beats", "B"), ("motifs", "M"), ("events", "E")):
            for x in p.get(k) or []:
                at = x.get("at")
                if isinstance(at, list) and tuple(at) in start:
                    acts.append((start[tuple(at)], f"{tag}:{x.get('do') or x.get('motif') or x.get('type')}{('/' + x['who']) if x.get('who') else ''}@{at[0]}:{at[1]}"))
        gl = [(start[(g["verse"], g["words"][0])], f"G@{g['verse']}:{g['words'][0]}") for g in sb["glosses"] if g["verse"] in c["verses"]]
        acts.sort()
        pts = [a] + [x for x, _ in acts] + [b]
        gap = max(((y - x), x) for x, y in zip(pts, pts[1:]))
        actors = ", ".join(f"{x['id']}:{x['type']}" for x in p.get("actors") or [])
        print(f"\n## {c['id']} v{c['verses'][0]}-{c['verses'][-1]} «{c['title']}» {c['scene']} {p.get('mood') or p.get('setting', '')} {p.get('time', '')} "
              f"[{actors}] trans={p.get('transition', '-')} | {b - a:.1f}s | max gap {gap[0]:.1f}s at +{gap[1] - a:.1f}s")
        print("  actions: " + " ".join(f"{x - a:.1f}{lbl}" for x, lbl in sorted(acts + gl)))
        if words:
            for n in c["verses"]:
                print(f"  {n}: " + " ".join(f"{k}{w}@{start[(n, k)] - a:.1f}" for nn, k, w in ws if nn == n))


if __name__ == "__main__":
    main(sys.argv[1], "--no-words" not in sys.argv)
