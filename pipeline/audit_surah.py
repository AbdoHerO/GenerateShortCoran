"""Investigate a whole surah for one reciter BEFORE planning its videos (the Al-Kahf method, automated).

  python pipeline/audit_surah.py <chapter> [--reciter 97]

Writes data/_analysis/<chapter>_r<reciter>/audit.json and prints a summary:
  * text: every verse's word-level QF text vs Tanzil Uthmani (same canon/equivalences as verify.py)
  * timing: per verse, words without timing, non-existent words, order problems, overlaps, repetitions
  * audio: every verse boundary checked against the real pauses in the recording:
      ok        - the timing boundary already sits in a pause
      aligned   - a real pause exists within 0.8 s (prepare.py will move the boundary onto it)
      JOINED    - no pause at all: the reciter joins the verses. A video may NEVER start or end here.
  * durations: recited seconds per verse (for planning video lengths)
Use the result to choose video boundaries: start/end only at 'ok' or 'aligned' boundaries, avoid verses with timing defects
(or plan to confirm them by ear), keep each video 20-120 s.
"""
import json, math, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))
import verify  # noqa: E402
import align  # noqa: E402


def main(ch, rec):
    cat = json.loads((ROOT / "data" / "catalog.json").read_text(encoding="utf-8"))
    S = next(s for s in cat["surahs"] if s["n"] == ch)
    d = ROOT / "data" / "_analysis" / f"{ch}_r{rec}"
    if not (d / "source.json").exists():
        r = subprocess.run([sys.executable, "-I", "-X", "utf8", str(ROOT / "pipeline" / "fetch_data.py"), "--chapter", str(ch), "--from", "1",
                            "--to", str(S["verses"]), "--recitation", str(rec), "--out", str(d.relative_to(ROOT))], cwd=ROOT)
        if r.returncode:
            raise SystemExit("fetch failed")
    src = json.loads((d / "source.json").read_text(encoding="utf-8"))
    V = {v["verse_number"]: v for v in src["verses"]}
    words = {n: [w for w in v["words"] if w["char_type_name"] == "word"] for n, v in V.items()}

    # ---- text
    tanzil, ed = verify.second_source(ch, d)
    text_fail = [n for n in V if verify.canon(" ".join(w["text_uthmani"] for w in words[n])) != verify.canon(tanzil[n])]

    # ---- timing structure
    T = {t["verse_key"]: t for t in src["recitation"]["timestamps"]}
    timing, prev, dur, reps = {}, None, {}, {}
    for n in sorted(V):
        t = T.get(f"{ch}:{n}")
        segs = [s for s in (t or {}).get("segments") or [] if len(s) >= 3]
        if not segs:
            timing[n] = ["no timing"]; continue
        seen = [s[0] for s in segs]
        probs = []
        miss = sorted(set(range(1, len(words[n]) + 1)) - set(seen)); extra = sorted(set(seen) - set(range(1, len(words[n]) + 1)))
        if miss: probs.append(f"words without timing {miss}")
        if extra: probs.append(f"non-existent words {extra}")
        if [s[1] for s in segs] != sorted(s[1] for s in segs): probs.append("not time-ordered")
        if prev is not None and segs[0][1] < prev: probs.append(f"overlaps previous verse by {prev - segs[0][1]} ms")
        short = [(s[0], s[2] - s[1]) for s in segs if s[2] - s[1] < 150 and len(words[n][s[0] - 1]["text_uthmani"]) >= 5] if not extra else []
        if short: probs.append(f"implausibly short words (pos, ms) {short} - listen")
        r = sorted({x for i, x in enumerate(seen) if x in seen[:i]})
        if r: reps[n] = r
        if probs: timing[n] = probs
        prev = max(s[2] for s in segs)
        dur[n] = round((max(s[2] for s in segs) - min(s[1] for s in segs)) / 1000, 2)

    # ---- verse boundaries vs real pauses (whole surah, verse by verse, reusing align.snap_boundaries)
    mp3 = d / src["recitation"]["local_file"]
    bounds = {}
    nums = sorted(n for n in V if n in dur)
    for a, b in zip(nums, nums[1:]):
        probe = json.loads(json.dumps(src))   # snap on a copy, verse pair by pair
        probe["recitation"]["neighbors"] = {}
        moves, unresolved = align.snap_boundaries(probe, mp3, [a, b], ch)
        if unresolved:
            bounds[a] = {"after": a, "state": "JOINED"}
        elif moves:
            bounds[a] = {"after": a, "state": "aligned", "shift_s": moves[0]["shift_s"]}
        else:
            bounds[a] = {"after": a, "state": "ok"}
    joined = [a for a, x in bounds.items() if x["state"] == "JOINED"]
    aligned = [a for a, x in bounds.items() if x["state"] == "aligned"]

    out = {"chapter": ch, "surah": S["name_en"], "reciter": rec, "verses": S["verses"], "audio_file": src["recitation"].get("audio_url"),
           "text_mismatch_vs_tanzil": text_fail, "basmala_note": ed.get("basmala_note"), "timing_defects": timing, "repetitions": reps,
           "boundaries": list(bounds.values()), "joined_after": joined, "aligned_after": aligned, "durations_s": dur,
           "total_recited_min": round(sum(dur.values()) / 60, 1)}
    (d / "audit.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Surah {ch} {S['name_en']} ({S['verses']} verses), reciter {rec}: {out['total_recited_min']} min recited")
    print(f"  text vs Tanzil: {'all identical' if not text_fail else 'MISMATCH in ' + str(text_fail) + ' - investigate before anything else'}")
    print(f"  timing defects: {len(timing)} verse(s) {dict(list(timing.items())[:8])}")
    print(f"  verse boundaries: {len(bounds) - len(aligned) - len(joined)} ok, {len(aligned)} aligned to a measured pause, "
          f"{len(joined)} JOINED (never start/end a video after verse(s) {joined})")
    print(f"  written: {(d / 'audit.json').relative_to(ROOT)}")


if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    main(int(a[0]), int(sys.argv[sys.argv.index("--reciter") + 1]) if "--reciter" in sys.argv else 97)
