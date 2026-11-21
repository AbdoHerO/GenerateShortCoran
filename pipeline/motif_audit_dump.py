"""Dump every motif (motion graphics v3) of a set of storyboards with its context, for an independent review of the
picture choices: the word it appears on, the verse's translation, the scene, and what the motif means in the catalog.

Usage: python pipeline/motif_audit_dump.py "<glob, e.g. 18_*_r97>" > out/wip/motif_review_18.md
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))
import verify  # noqa: E402

CAT = json.loads((ROOT / "renderer" / "js" / "scene_catalog.json").read_text(encoding="utf-8"))
LIB = CAT["motifs"]["library"]
pattern = sys.argv[1] if len(sys.argv) > 1 else "18_*_r97"
ids = sorted([p.stem for p in (ROOT / "storyboard").glob(pattern + ".json")], key=lambda x: (int(x.split("_")[0]), int(x.split("_")[1].split("-")[0])))
print("# Motif review dump\n\nEach motif is a symbol drawn on a cream plate at the word shown. Catalog meaning in brackets.\n")
for pid in ids:
    sb = json.loads((ROOT / "storyboard" / f"{pid}.json").read_text(encoding="utf-8"))
    src = json.loads((ROOT / "data" / pid / "source.json").read_text(encoding="utf-8"))
    V = {v["verse_number"]: v for v in src["verses"]}
    print(f"\n## {pid}")
    for c in sb["chapters"]:
        p = c.get("params") or {}
        print(f"\n### chapter {c['id']} verses {c['verses']} «{c['title']}» scene {c['scene']} {p.get('mood') or p.get('setting', '')} transition {p.get('transition', 'dissolve')}")
        for n in c["verses"]:
            print(f"- {n}: {verify.clean_translation(V[n]['translations'][0]['text'])}")
        for m in p.get("motifs") or []:
            v, w = m["at"]
            words = [x["text_uthmani"] for x in V[v]["words"] if x["char_type_name"] == "word"]
            ctx = " ".join(words[max(0, w - 3):w - 1]) + " ⟦" + words[w - 1] + "⟧ " + " ".join(words[w:w + 2])
            until = f" until {m['until']}" if m.get("until") else ""
            print(f"  * MOTIF `{m['motif']}` [{LIB.get(m['motif'], '?')}] at {v}:{w} «{ctx}»{until} ({m['place']}, {m['size']})")
