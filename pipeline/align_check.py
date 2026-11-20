"""Audio <-> timing alignment check for one chapter recitation.

At every verse boundary the reciter pauses. For each boundary this finds the quiet stretch (>= 120 ms below
-28 dBFS) nearest to the boundary given by the word timings, and reports the offset (pause centre - boundary).
A constant non-zero offset means the timing data and the audio file are shifted against each other: the word
highlight would run early or late. Output: data/_align/<chapter>_<recitation>.json

Usage: python pipeline/align_check.py <chapter> <recitation_id> [--mp3 path] [--json timings.json]
"""
import json, math, pathlib, statistics, struct, subprocess, sys, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
UA = {"User-Agent": "quran-video-builder/0.1", "Accept": "application/json"}
SR, WIN = 8000, 160   # 20 ms windows


def envelope(mp3):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(mp3), "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True).stdout
    x = struct.unpack(f"<{len(raw)//2}h", raw)
    db = []
    for i in range(0, len(x) - WIN, WIN):
        s = 0
        for v in x[i:i + WIN]:
            s += v * v
        db.append(20 * math.log10((math.sqrt(s / WIN) or 1e-9) / 32768))
    return db   # one value per 20 ms


def quiet_runs(db, lo_i, hi_i, thr=-28.0, min_len=6):
    runs, start = [], None
    for i in range(max(0, lo_i), min(len(db), hi_i)):
        if db[i] <= thr:
            start = i if start is None else start
        elif start is not None:
            if i - start >= min_len: runs.append((start, i))
            start = None
    if start is not None and hi_i - start >= min_len: runs.append((start, hi_i))
    return runs


def main(ch, rid, mp3=None):
    ts = json.load(urllib.request.urlopen(urllib.request.Request(f"https://api.quran.com/api/v4/chapter_recitations/{rid}/{ch}?segments=true", headers=UA)))["audio_file"]
    mp3 = pathlib.Path(mp3) if mp3 else ROOT / "data" / "_audio" / f"chapter_{ch:03d}_rec{rid}.mp3"
    db = envelope(mp3)
    stamps = ts["timestamps"]
    rows = []
    for a, b in zip(stamps, stamps[1:]):
        sa = [s for s in a["segments"] if len(s) >= 3]; sb_ = [s for s in b["segments"] if len(s) >= 3]
        if not sa or not sb_:
            continue
        end_a = max(s[2] for s in sa) / 1000
        start_b = min(s[1] for s in sb_) / 1000
        bound = (end_a + start_b) / 2
        runs = quiet_runs(db, int((bound - 1.5) * 50), int((bound + 1.5) * 50))
        if not runs:
            rows.append({"after": a["verse_key"], "bound": round(bound, 3), "offset": None}); continue
        c = min(runs, key=lambda r: abs((r[0] + r[1]) / 100 - bound))
        rows.append({"after": a["verse_key"], "bound": round(bound, 3), "pause": [round(c[0] / 50, 2), round(c[1] / 50, 2)],
                     "offset": round((c[0] + c[1]) / 100 - bound, 3)})
    offs = [r["offset"] for r in rows if r["offset"] is not None]
    med = statistics.median(offs) if offs else None
    spread = statistics.median([abs(o - med) for o in offs]) if offs else None
    out = {"chapter": ch, "recitation": rid, "file": ts["audio_url"], "boundaries": len(rows), "with_pause": len(offs),
           "median_offset_s": med, "median_abs_dev_s": spread, "rows": rows}
    d = ROOT / "data" / "_align"; d.mkdir(parents=True, exist_ok=True)
    (d / f"{ch}_{rid}.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"chapter {ch} recitation {rid}: {len(offs)}/{len(rows)} boundaries have a pause nearby; median offset {med:+.3f} s, "
          f"median deviation {spread:.3f} s")
    return out


if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    main(int(a[0]), int(a[1]))
