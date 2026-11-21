"""Propose how a surah splits into videos, from the audit (data/_analysis/<n>_r<rec>/audit.json).

You give the thematic sections (first verse of each); inside each section the verses are grouped into videos of
about --target seconds of recitation (default 60), never more than --max (110) seconds or 40 verses, and a video
only ever starts/ends at a boundary the audit measured as a pause ('ok' or 'aligned'), never at a JOINED one. A
section boundary that is JOINED is moved to the nearest pause and reported.

Usage: python pipeline/plan_split.py <chapter> --sections 1,6,8,21 [--reciter 97] [--target 60] [--max 110]
Prints the proposal (verses, seconds, warnings) and writes data/_analysis/<n>_r<rec>/split.json.
The titles, visuals and cautions of plans/<n>.json are written by hand from it.
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
OVERHEAD = 7.4   # cover + intro + outro seconds added to the recitation


def main(ch, sections, rec=97, target=60.0, mx=110.0):
    a = json.loads((ROOT / "data" / "_analysis" / f"{ch}_r{rec}" / "audit.json").read_text(encoding="utf-8"))
    n = a["verses"]
    dur = {int(k): v for k, v in a["durations_s"].items()}
    joined = set(a["joined_after"])
    defects = {int(k): v for k, v in a["timing_defects"].items()}
    # a cut "after v" is allowed if v is the last verse or the boundary after v is not JOINED
    can_cut = lambda v: v == n or v not in joined
    secs = sorted(set([1] + sections))
    starts = []
    for s in secs:
        if s == 1 or can_cut(s - 1):
            starts.append(s); continue
        # move to the nearest allowed start
        best = min((x for x in range(max(2, s - 6), min(n, s + 6) + 1) if can_cut(x - 1)), key=lambda x: abs(x - s), default=None)
        print(f"section start {s} is JOINED to {s - 1}: moved to {best}")
        if best and best not in starts:
            starts.append(best)
    starts = sorted(set(starts))
    bounds = list(zip(starts, [x - 1 for x in starts[1:]] + [n]))
    videos = []
    for s, e in bounds:
        v = s
        while v <= e:
            acc, end, best = 0.0, None, None
            for w in range(v, e + 1):
                acc += dur.get(w, 0) + 0.8
                if acc > mx or w - v + 1 > 40:
                    break
                if can_cut(w):
                    end = w
                    # stop near the target once there
                    if acc >= target and (best is None):
                        best = w
                        break
            if best is None:
                best = end if end is not None else e
            # avoid a short tail: if what remains of the section is < 45% of target and fits, take it in
            rest = sum(dur.get(x, 0) + 0.8 for x in range(best + 1, e + 1))
            tot = sum(dur.get(x, 0) + 0.8 for x in range(v, e + 1))
            if 0 < rest < target * 0.45 and tot <= mx and e - v + 1 <= 40:
                best = e
            secs_ = sum(dur.get(x, 0) + 0.8 for x in range(v, best + 1))
            warn = [f"timing defect in {x}" for x in range(v, best + 1) if x in defects]
            if secs_ > mx:
                warn.append("LONG (no pause to cut earlier)")
            videos.append({"from": v, "to": best, "recited_s": round(secs_, 1), "est_s": round(secs_ + OVERHEAD), "warnings": warn})
            v = best + 1
    out = ROOT / "data" / "_analysis" / f"{ch}_r{rec}" / "split.json"
    out.write_text(json.dumps({"chapter": ch, "sections": starts, "videos": videos}, ensure_ascii=False, indent=1), encoding="utf-8")
    for x in videos:
        print(f"{x['from']:>3}-{x['to']:<3} {x['recited_s']:6.1f}s  est {x['est_s']:>3}s  {'; '.join(x['warnings'])}")
    print(f"{len(videos)} videos, {sum(x['est_s'] for x in videos) / 60:.1f} min in all; JOINED after {sorted(joined)}")


if __name__ == "__main__":
    av = sys.argv
    g = lambda k, d: av[av.index(k) + 1] if k in av else d
    main(int(av[1]), [int(x) for x in g("--sections", "1").split(",")], int(g("--reciter", 97)), float(g("--target", 60)), float(g("--max", 110)))
