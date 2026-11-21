"""Regenerate docs/progress/STATUS.md: one row per surah with its production state, computed from the files
(plans/<n>.json, storyboard/*.json, out/*/release.json, publish/ledger.json). Run after every surah.

Usage: python pipeline/progress.py [--reciter 97]
"""
import datetime, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]


def main(rec=97):
    cat = json.loads((ROOT / "data" / "catalog.json").read_text(encoding="utf-8"))
    ledger = json.loads((ROOT / "publish" / "ledger.json").read_text(encoding="utf-8")) if (ROOT / "publish" / "ledger.json").exists() else {}
    suffix = "" if rec == 7 else f"_r{rec}"
    sbs = {}
    for p in (ROOT / "storyboard").glob(f"*{suffix}.json"):
        m = re.match(rf"^(\d+)_(\d+)-(\d+){suffix}$", p.stem)
        if m:
            sb = json.loads(p.read_text(encoding="utf-8"))
            beats = sum(len((c.get("params") or {}).get("beats", [])) for c in sb.get("chapters", []))
            motifs = sum(len((c.get("params") or {}).get("motifs", [])) for c in sb.get("chapters", []))
            sbs.setdefault(int(m.group(1)), []).append((p.stem, (sb.get("director") or {}).get("mode"), beats, motifs))
    rows, totals = [], dict(planned=0, written=0, built=0, published=0)
    for s in cat["surahs"]:
        n = s["n"]
        plan = ROOT / "plans" / f"{n}.json"
        planned = sum(len(g["videos"]) for g in json.loads(plan.read_text(encoding="utf-8"))["groups"]) if plan.exists() else 0
        mine = sbs.get(n, [])
        written = sum(1 for _, mode, _, _ in mine if mode in ("hand", "claude"))
        motion3 = sum(1 for _, _, _, mo in mine if mo > 0)
        built = sum(1 for pid, *_ in mine if (ROOT / "out" / pid / "release.json").exists())
        published = sum(1 for pid, *_ in mine if pid in ledger)
        state = ("not started" if not plan.exists() else "planned" if not written else "storyboards" if written < max(planned, 1)
                 else "published" if published and published >= planned else "ready to build")
        rows.append(f"| {n} | {s['name_ar']} | {s['name_en']} | {s['verses']} | {planned or '-'} | {written or '-'} | {motion3 or '-'} | {built or '-'} | {published or '-'} | {state} |")
        totals["planned"] += planned; totals["written"] += written; totals["built"] += built; totals["published"] += published
    out = ROOT / "docs" / "progress" / "STATUS.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join([
        "# Production status (generated - do not edit by hand)",
        "",
        f"Regenerated {datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} by `pipeline/progress.py` for reciter {rec}.",
        "Columns: videos in the surah plan · storyboards written by hand · of those with motion graphics v3 (motifs) · built locally in this session · published to Creative Hub (drafts).",
        "`built` only counts files present on this machine; `published` (publish/ledger.json) is the durable record.",
        "",
        f"**Totals:** planned {totals['planned']} · written {totals['written']} · built {totals['built']} · published {totals['published']}",
        "",
        "| # | Surah | Name | Verses | Planned | Written | Motion v3 | Built | Published | State |",
        "|---|---|---|---|---|---|---|---|---|---|",
        *rows, ""]), encoding="utf-8")
    print(f"{out.relative_to(ROOT)}: planned {totals['planned']}, written {totals['written']}, built {totals['built']}, published {totals['published']}")


if __name__ == "__main__":
    main(int(sys.argv[sys.argv.index("--reciter") + 1]) if "--reciter" in sys.argv else 97)
