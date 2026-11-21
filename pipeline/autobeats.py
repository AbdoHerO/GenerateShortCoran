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
# Only CAMERA moves are added automatically. Beats that carry meaning (light swelling, stars, rain, bloom, sparkle,
# birds, wind) land on whatever word happens to be in the gap: a light swelling on a negated word, on "their devils"
# or just before the Name is wrong (Al-Baqarah review, 2026-11-21). Such beats are written by hand, on chosen words.
CAM = ["shot_wide", "push_in", "pan_left", "pan_right", "shot_sky", "push_in", "pan_right", "pan_left", "shot_ground"]
AMB = {}
STAGE = ["shot_wide", "push_in", "pan_left", "pan_right", "shot_wide", "push_in"]
# Never put a camera move on the Name, «رب», «إله», an angel or a prophet: a push_in or shot_sky there zooms into the
# scene's light exactly as the Name is recited, which reads as depicting Him (Aal Imran review, 2026-11-21).
sys.path.insert(0, str(ROOT / "pipeline"))
import verify  # noqa: E402
PROPHETS = ("محمد|احمد|موسي|عيسي|مريم|ابراهيم|ابرهيم|اسماعيل|اسحاق|يعقوب|يوسف|نوح|لوط|هارون|داود|داوود|سليمان|زكريا|"
            "يحيي|ادم|ايوب|يونس|ادريس|شعيب|صالح|هود|الياس|اليسع|عزير|جبريل|ميكال")
SACRED = re.compile(r"الله|لله|الاه|الرحمان|ملايك|^(و|ف|ب|ل|يا)*رب(ي|ك|كم|كما|نا|ه|هم|هما|هن|كن)?$|"
                    rf"^(و|ف|ب|ل|يا)*(ال)?(نبي|رسول)(ه|ك|نا|هم|كم)?$|^(و|ف|ب|ل|يا)*({PROPHETS})ا?$")


def sacred(text):
    return any(SACRED.search(w) for w in verify.skel(text))


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
                    words.append((first[w["position"]], n, w["position"], w["position"] == len(ws) or bool(WAQF.search(w["text_uthmani"])),
                                  sacred(w["text_uthmani"])))
        words.sort()
        if not words:
            continue
        start = {(n, k): t for t, n, k, _, _ in words}
        end = max(s[2] for n in c["verses"] for s in T[f"{ch}:{n}"]["segments"]) / 1000
        rot = CAM if c["scene"] == "ambient" else STAGE
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
                ok = [w for w in words if a + 0.9 <= w[0] <= b - 0.9 and not w[4]]
                if not ok:
                    continue
                mid = (a + b) / 2
                w = min(ok, key=lambda w: abs(w[0] - mid) - (0.6 if w[3] else 0))
                cand = w
                break
            if not cand:
                break
            beat = {"at": [cand[1], cand[2]], "do": rot[k % len(rot)]}
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
