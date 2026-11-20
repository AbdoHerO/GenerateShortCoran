"""Dump every gloss / title / cover of a set of storyboards with its full context, for an independent human-style review.
Usage: python pipeline/gloss_audit_dump.py <glob, e.g. 18_*_r97> > out/wip/gloss_review.md
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))
import verify  # noqa: E402

pattern = sys.argv[1] if len(sys.argv) > 1 else "18_*_r97"
ids = sorted([p.stem for p in (ROOT / "storyboard").glob(pattern + ".json")], key=lambda x: int(x.split("_")[1].split("-")[0]))
for pid in ids:
    sb = json.loads((ROOT / "storyboard" / f"{pid}.json").read_text(encoding="utf-8"))
    src = json.loads((ROOT / "data" / pid / "source.json").read_text(encoding="utf-8"))
    V = {v["verse_number"]: v for v in src["verses"]}
    cv = sb.get("cover", {})
    print(f"\n# {pid}\nCOVER: series «{cv.get('series_ar')}» ({cv.get('series_en')}) | title «{cv.get('title_ar')}» ({cv.get('title_en')})")
    for c in sb["chapters"]:
        p = c.get("params", {})
        cast = ", ".join(f"{a['type']}{'('+a['label']+')' if a.get('label') else ''}" for a in p.get("actors", []))
        ev = ", ".join(f"{e['type']}@{e['at']}" for e in p.get("events", []))
        print(f"CHAPTER {c['id']} verses {c['verses']}: «{c['title']}» | {c['scene']} {p.get('mood') or p.get('setting')} {p.get('time', '')} | cast: {cast or '-'} | events: {ev or '-'}")
    for g in sb["glosses"]:
        v = V[g["verse"]]
        words = [w["text_uthmani"] for w in v["words"] if w["char_type_name"] == "word"]
        chip = " ".join(words[g["words"][0] - 1:g["words"][1]])
        body = verify.nfc(verify.strip_html(src["tafsirs"][str(g["tafsir"])][v["verse_key"]]["text"]))
        i = body.find(g["excerpt"])
        ctx = body[max(0, i - 90): i] + " ⟦" + g["excerpt"] + "⟧ " + body[i + len(g["excerpt"]): i + len(g["excerpt"]) + 90]
        print(f"\nGLOSS {v['verse_key']} words {g['words']} «{chip}» -> «{g['excerpt']}» [{sb['tafsir_labels'][str(g['tafsir'])]}] tone {g['tone']}")
        print(f"  verse: {verify.clean_translation(v['translations'][0]['text'])}")
        print(f"  context: …{ctx}…")
