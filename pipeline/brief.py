"""Print everything a storyboard writer needs for one passage: numbered words with the reciter's word start times
(seconds from the first word), translation, both tafsirs (exact text that gloss excerpts must be copied from),
and the surah plan entry (title + cautions) if there is one.

Usage: python pipeline/brief.py 18_17-18_r97
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))
import verify  # noqa: E402


def main(pid):
    src = json.loads((ROOT / "data" / pid / "source.json").read_text(encoding="utf-8"))
    m = src["meta"]
    T = {t["verse_key"]: t for t in src["recitation"]["timestamps"]}
    t0 = min(s[1] for s in T[src["verses"][0]["verse_key"]]["segments"])
    print(f"# {pid}: Surah {m['chapter']} {src['chapter_en']['name_simple']} ({src['chapter']['name_arabic']}) {m['from']}-{m['to']}, "
          f"reciter {m['recitation_id']} ({(src.get('reciter_en') or {}).get('name')})")
    plan = ROOT / "plans" / f"{m['chapter']}.json"
    if plan.exists():
        for g in json.loads(plan.read_text(encoding="utf-8"))["groups"]:
            for v in g["videos"]:
                if v["from"] == m["from"] and v["to"] == m["to"]:
                    print(f"PLAN: series «{g['title_ar']}» / {g['title_en']} -> video «{v['title_ar']}» / {v['title_en']} | visual {v['visual']}"
                          + (f"\nCAUTION: {v['care']}" if v.get("care") else ""))
    for v in src["verses"]:
        k = v["verse_key"]; segs = T[k]["segments"]
        first = {}
        for s in segs:
            first.setdefault(s[0], (s[1] - t0) / 1000)
        a, b = min(s[1] for s in segs), max(s[2] for s in segs)
        reps = sorted({s[0] for i, s in enumerate(segs) if s[0] in [x[0] for x in segs[:i]]})
        print(f"\n## {k}  recited {(a - t0) / 1000:.1f}-{(b - t0) / 1000:.1f} s ({(b - a) / 1000:.1f} s)" + (f"  repeats words {reps}" if reps else ""))
        print("words: " + " | ".join(f"{w['position']} {w['text_uthmani']} @{first.get(w['position'], 0):.1f}" for w in v["words"] if w["char_type_name"] == "word"))
        print("translation: " + verify.clean_translation(v["translations"][0]["text"]))
        for tid, label in (("16", "Al-Muyassar"), ("91", "As-Sa'di")):
            print(f"tafsir {tid} ({label}): " + verify.nfc(verify.strip_html(src["tafsirs"][tid][k]["text"])))


if __name__ == "__main__":
    main(sys.argv[1])
