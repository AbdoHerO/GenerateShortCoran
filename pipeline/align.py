"""Align verse boundaries in the word-timing data with the real pauses in the recitation audio.

The QF word timings are aligned automatically; for some reciters (e.g. Yasser ad-Dussary) the boundary between two
verses is sometimes placed while the reciter is still sounding, up to ~0.7 s before or after the real pause. That would
make the gold highlight jump to the next verse too early and leave no clean point to cut the audio.

For every verse boundary of a passage (including the boundaries just before and after it) this checks whether the
timing gap contains silence. If not, it looks for the nearest real pause (>= 100 ms below -30 dBFS, within 0.8 s)
and moves the previous verse's last-word end and the next verse's first-word start onto that pause. Nothing is
invented: every move is measured in the audio, logged, and listed on the review sheet. A boundary with no pause
nearby (the reciter joins the verses) is reported; prepare.py refuses to cut the audio there.
"""
import math, struct, subprocess

SR, WIN = 8000, 160          # 20 ms windows
# a pause must last >= 140 ms on a 60 ms-smoothed envelope: the closure of a stop consonant (e.g. the q of «قل») is
# silent for 50-100 ms inside a word and must never be mistaken for the pause between two verses
QUIET_DB, ECHO_DB, MIN_PAUSE, SEARCH = -30.0, -26.0, 7, 0.8   # dBFS, dBFS (echo-filled pause), windows (140 ms), seconds


def envelope(mp3, a, b):
    a = max(0.0, a)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{a:.3f}", "-t", f"{b - a:.3f}", "-i", str(mp3), "-ac", "1", "-ar", str(SR),
                          "-f", "s16le", "-"], capture_output=True).stdout
    x = struct.unpack(f"<{len(raw)//2}h", raw)
    out = []
    for i in range(0, len(x) - WIN + 1, WIN):
        s = 0
        for v in x[i:i + WIN]:
            s += v * v
        out.append(20 * math.log10((math.sqrt(s / WIN) or 1e-9) / 32768))
    return a, out


def snap_boundaries(src, mp3, nums, ch):
    """Mutates src['recitation'] (timestamps + neighbors) in place. Returns (moves, unresolved) lists."""
    rec = src["recitation"]
    T = {t["verse_key"]: t for t in rec["timestamps"]}
    nb = rec.setdefault("neighbors", {})
    segs = lambda n: [s for s in T[f"{ch}:{n}"]["segments"] if len(s) >= 3]
    first = min(s[1] for s in segs(nums[0])) / 1000
    last = max(s[2] for s in segs(nums[-1])) / 1000
    t0, raw = envelope(mp3, first - 2.0, last + 2.0)
    # 60 ms moving average of the power, back in dB
    pw = [10 ** (d / 10) for d in raw]
    db = [10 * math.log10(max(1e-12, sum(pw[max(0, i - 1):i + 2]) / len(pw[max(0, i - 1):i + 2]))) for i in range(len(pw))]
    at = lambda sec: int((sec - t0) / (WIN / SR))

    def runs_in(lo, hi, thr):
        out, start = [], None
        for i in range(max(0, lo), min(len(db), hi) + 1):
            if i < len(db) and db[i] <= thr:
                start = i if start is None else start
            elif start is not None:
                if i - start >= MIN_PAUSE: out.append((start, i))
                start = None
        return out

    # boundaries: (label, end_of_previous_ms, start_of_next_ms, setter)
    bounds = []
    if nb.get("prev_end") is not None:
        bounds.append(("before", nums[0] - 1, nums[0], nb["prev_end"], min(s[1] for s in segs(nums[0]))))
    for a, b in zip(nums, nums[1:]):
        bounds.append(("inside", a, b, max(s[2] for s in segs(a)), min(s[1] for s in segs(b))))
    if nb.get("next_start") is not None:
        bounds.append(("after", nums[-1], nums[-1] + 1, max(s[2] for s in segs(nums[-1])), nb["next_start"]))

    moves, unresolved = [], []
    for kind, va, vb, e_ms, s_ms in bounds:
        e, s = e_ms / 1000, s_ms / 1000
        gm = at((e + s) / 2)
        if any(r[0] - 2 <= gm <= r[1] + 2 for thr in (QUIET_DB, ECHO_DB) for r in runs_in(gm - 60, gm + 60, thr)):
            continue   # the timing boundary already lies inside a real pause (+-40 ms)
        lo, hi = at(min(e, s) - SEARCH), at(max(e, s) + SEARCH)
        runs, level = [], None
        # strict pause first; then a pause filled by room echo (reverberant recordings rarely drop below -30 dB)
        for thr in (QUIET_DB, ECHO_DB):
            runs = runs_in(lo, hi, thr)
            if runs:
                level = thr; break
        if not runs:
            unresolved.append({"kind": kind, "after": va, "gap_s": [round(e, 3), round(s, 3)]})
            continue
        mid = (e + s) / 2
        ps, pe = min(runs, key=lambda r: abs(t0 + (r[0] + r[1]) * WIN / SR / 2 - mid))
        ps, pe = t0 + ps * WIN / SR, t0 + pe * WIN / SR
        ps_ms, pe_ms = round(ps * 1000), round(pe * 1000)
        # previous verse's last word now ends where the pause begins; next verse's first word starts where it ends
        if kind in ("inside", "after"):
            sa = segs(va); lastseg = max(sa, key=lambda x: x[2])
            lastseg[2] = ps_ms
            lastseg[1] = min(lastseg[1], ps_ms - 40)
            T[f"{ch}:{va}"]["timestamp_to"] = max(T[f"{ch}:{va}"]["timestamp_to"], ps_ms) if pe > s else ps_ms
        else:
            nb["prev_end"] = ps_ms
        if kind in ("inside", "before"):
            sb = segs(vb); firstseg = min(sb, key=lambda x: x[1])
            firstseg[1] = pe_ms
            firstseg[2] = max(firstseg[2], pe_ms + 40)
            T[f"{ch}:{vb}"]["timestamp_from"] = pe_ms
        else:
            nb["next_start"] = pe_ms
        moves.append({"kind": kind, "after": va, "gap_s": [round(e, 3), round(s, 3)], "pause_s": [round(ps, 3), round(pe, 3)],
                      "shift_s": round((ps + pe) / 2 - mid, 3), "pause_db": level})
    return moves, unresolved
