"""Fill the camera and ambient rhythm of a hand-written storyboard: wherever a chapter has more than ~4.5 s of
recitation with no beat, motif or event, add a neutral beat (camera move, light, pattern...) on the word that starts
nearest to the middle of the gap, preferring words where the reciter pauses (verse end, waqf sign). Only neutral
beats are added: no actor beats (speech, gestures) and nothing that carries meaning. Existing beats are kept.

Usage: python pipeline/autobeats.py <id> [--gap 4.5]
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CAT = json.loads((ROOT / "renderer" / "js" / "scene_catalog.json").read_text(encoding="utf-8"))
WAQF = re.compile(r"[ۖ-ۜ]")
# neutral beats per mood / scene, used in rotation
AMB = {
    "night_sky": ["shot_wide", "stars", "push_in", "pan_left", "light_up", "pan_right", "shot_sky"],
    "dawn": ["shot_wide", "light_up", "push_in", "birds", "pan_right", "clouds_part", "pan_left"],
    "sea": ["shot_wide", "waves", "push_in", "pan_left", "light_up", "pan_right", "birds"],
    "mountains": ["shot_wide", "wind", "push_in", "pan_right", "light_up", "pan_left", "birds"],
    "garden": ["shot_wide", "leaves", "push_in", "birds", "pan_left", "light_up", "pan_right"],
    "rain": ["shot_wide", "light_up", "push_in", "pan_left", "wind", "pan_right", "shot_ground"],
    "geometric": ["shot_wide", "pattern_turn", "push_in", "light_up", "pan_left", "pattern_turn", "pan_right"],
    "light": ["shot_wide", "light_up", "push_in", "sparkle", "pan_left", "light_up", "pan_right"],
}
STAGE = ["shot_wide", "push_in", "pan_left", "wind", "pan_right", "shot_wide", "birds"]


def main(pid, gap=4.5):
    p = ROOT / "storyboard" / f"{pid}.json"
    sb = json.loads(p.read_text(encoding="utf-8"))
    src = json.loads((ROOT / "data" / pid / "source.json").read_text(encoding="utf-8"))
    ch = sb["passage"]["chapter"]
    T = {t["verse_key"]: t for t in src["recitation"]["timestamps"]}
    V = {v["verse_number"]: v for v in src["verses"]}
    added = 0
    for c in sb["chapters"]:
        if c.get("scene") not in ("ambient", "stage"):
            continue
        prm = c.setdefault("params", {})
        words = []   # (t, verse, pos, pause)
        for n in c["verses"]:
            ws = [w for w in V[n]["words"] if w["char_type_name"] == "word"]
            first = {}
            for s in T[f"{ch}:{n}"]["segments"]:
                first.setdefault(s[0], s[1] / 1000)
            for w in ws:
                if w["position"] in first:
                    words.append((first[w["position"]], n, w["position"], w["position"] == len(ws) or bool(WAQF.search(w["text_uthmani"]))))
        words.sort()
        if not words:
            continue
        start = {(n, k): t for t, n, k, _ in words}
        end = max(s[2] for n in c["verses"] for s in T[f"{ch}:{n}"]["segments"]) / 1000
        rot = AMB.get(prm.get("mood"), AMB["light"]) if c["scene"] == "ambient" else STAGE
        allowed = set(CAT["beats"]["camera"]) | set(CAT["beats"]["scene"]) | (set(CAT["beats"]["ambient"]) if c["scene"] == "ambient" else set())
        rot = [b for b in rot if b in allowed]
        k = len(prm.get("beats") or [])
        for _ in range(40):
            acts = sorted(start[tuple(x["at"])] for key in ("beats", "motifs", "events") for x in prm.get(key) or []
                          if isinstance(x.get("at"), list) and tuple(x["at"]) in start)
            pts = [words[0][0]] + acts + [end]
            cand = None
            for a, b in zip(pts, pts[1:]):
                if b - a <= gap:
                    continue
                # words that can take a beat: >= 0.9 s from both neighbours
                ok = [w for w in words if a + 0.9 <= w[0] <= b - 0.9]
                if not ok:
                    continue
                mid = (a + b) / 2
                w = min(ok, key=lambda w: abs(w[0] - mid) - (0.6 if w[3] else 0))
                cand = w
                break
            if not cand:
                break
            beat = {"at": [cand[1], cand[2]], "do": rot[k % len(rot)]}
            if beat["do"] == "sparkle":
                beat["who"] = "light" if c["scene"] == "ambient" else "center"
            k += 1
            prm.setdefault("beats", []).append(beat)
            added += 1
        if prm.get("beats"):
            prm["beats"].sort(key=lambda b: start.get(tuple(b["at"]), 0))
        if len(prm.get("beats") or []) > CAT["beats"]["max_per_chapter"]:
            print(f"warning: chapter {c['id']} has {len(prm['beats'])} beats (max {CAT['beats']['max_per_chapter']}): split the chapter")
    p.write_text(json.dumps(sb, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{pid}: {added} neutral beat(s) added")


if __name__ == "__main__":
    main(sys.argv[1], float(sys.argv[sys.argv.index("--gap") + 1]) if "--gap" in sys.argv else 4.5)
