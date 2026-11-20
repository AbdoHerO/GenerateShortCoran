"""Build render_data.json (video timeline) + mastered audio. Refuses to run unless verify.py passes.

Every Quranic string in render_data.json is copied from source.json (API) - never from the storyboard.
Usage: python pipeline/prepare.py storyboard/15_57-77.json
"""
import json, pathlib, re, subprocess, sys, unicodedata

ROOT = pathlib.Path(__file__).resolve().parents[1]
FPS, W, H = 30, 1080, 1920
AR_DIGITS = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def nfc(s): return unicodedata.normalize("NFC", s)
def clean_translation(s): return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", re.sub(r"<sup[^>]*>.*?</sup>", "", s))).strip()


def edge_level(mp3, at):
    """RMS (dBFS) of the source audio in a 100 ms window centred on a cut point."""
    import math, struct
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{at - 0.05:.3f}", "-t", "0.1", "-i", str(mp3), "-ac", "1", "-ar", "16000",
                          "-f", "s16le", "-"], capture_output=True).stdout
    x = struct.unpack(f"<{len(raw)//2}h", raw)
    return 20 * math.log10((math.sqrt(sum(v * v for v in x) / max(len(x), 1)) or 1e-9) / 32768)


def find_cut(mp3, ideal, lo, hi, limit=-30.0):
    """Quiet cut point closest to `ideal` inside [lo, hi]: RMS of a 100 ms window, scanned every 10 ms.
    The window never leaves [lo, hi], which callers keep clear of the neighbouring verses' words."""
    import math, struct
    lo, hi = min(lo, ideal), max(hi, ideal)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{max(0, lo - 0.05):.3f}", "-t", f"{hi - lo + 0.1:.3f}", "-i", str(mp3),
                          "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True).stdout
    x = struct.unpack(f"<{len(raw)//2}h", raw)
    pre = [0]
    for v in x:
        pre.append(pre[-1] + v * v)
    t0, pts = max(0, lo - 0.05), []
    for i in range(0, max(0, len(x) - 1600) + 1, 160):
        t = t0 + (i + 800) / 16000
        if lo - 1e-6 <= t <= hi + 1e-6:
            rms = math.sqrt((pre[i + 1600] - pre[i]) / 1600) if i + 1600 <= len(x) else 0
            pts.append((t, 20 * math.log10((rms or 1e-9) / 32768)))
    # a strict pause (<= -30 dB) if there is one; otherwise a pause filled only by room echo (<= -26 dB)
    quiet = [p for p in pts if p[1] <= limit] or [p for p in pts if p[1] <= -26.0]
    if quiet:
        return min(quiet, key=lambda p: abs(p[0] - ideal))
    return min(pts, key=lambda p: p[1]) if pts else (ideal, 0.0)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise SystemExit(f"command failed: {' '.join(cmd[:6])}...\n{r.stderr[-1500:]}")
    return r


def main(sb_path):
    v = subprocess.run([sys.executable, "-I", "-X", "utf8", str(ROOT / "pipeline" / "verify.py"), sb_path])
    if v.returncode:
        print("@@ " + json.dumps({"error": "verify"}), flush=True)
        raise SystemExit("verify.py FAILED - refusing to prepare render data")

    sb = json.loads((ROOT / sb_path).read_text(encoding="utf-8"))
    data_dir = ROOT / sb["data_dir"]
    src = json.loads((data_dir / "source.json").read_text(encoding="utf-8"))
    sys.path.insert(0, str(ROOT / "pipeline"))
    from verify import apply_timing_corrections
    corrections = apply_timing_corrections(src, sb)
    ch = sb["passage"]["chapter"]
    verses_src = {x["verse_number"]: x for x in src["verses"]}
    T = {t["verse_key"]: t for t in src["recitation"]["timestamps"]}
    nums = list(range(sb["passage"]["from"], sb["passage"]["to"] + 1))
    src_mp3 = data_dir / src["recitation"]["local_file"]

    # verse boundaries -> the reciter's real pauses (measured in the audio; see pipeline/align.py)
    from align import snap_boundaries
    aligned, unresolved = snap_boundaries(src, src_mp3, nums, ch)
    for m in aligned:
        print(f"aligned verse boundary after {ch}:{m['after']} ({m['kind']} the passage): timing gap {m['gap_s']} s -> measured pause {m['pause_s']} s (shift {m['shift_s']:+.2f} s)")
    for u in unresolved:
        if u["kind"] in ("before", "after"):
            print("@@ " + json.dumps({"error": "joined"}), flush=True)
            raise SystemExit(f"the reciter joins {ch}:{u['after']} and {ch}:{u['after'] + 1} without a pause, so the audio cannot be cut there "
                             f"without cutting his voice - choose a range that {'starts' if u['kind'] == 'before' else 'ends'} at another verse")
        print(f"note: no pause between {ch}:{u['after']} and {ch}:{u['after'] + 1} (joined recitation); the highlight there follows the timing data")

    # every video opens on a cover frame (thumbnail) held for COVER_S, then the usual intro
    COVER_S = 1.0
    INTRO, OUTRO = sb["intro_s"] + COVER_S, sb["outro_s"]
    first = T[f"{ch}:{nums[0]}"]; last = T[f"{ch}:{nums[-1]}"]
    first_word = min(s[1] for s in first["segments"]) / 1000
    last_word_end = max(s[2] for s in last["segments"]) / 1000
    ideal_start = min(first["timestamp_from"] / 1000, first_word) - 0.06
    # end 100 ms before the next verse's boundary so not a single sample of the next verse leaks in
    ideal_end = max(last_word_end * 1000, last["timestamp_to"] - 100) / 1000
    nb = src["recitation"].get("neighbors") or {}
    prev_end, next_start = nb.get("prev_end"), nb.get("next_start")
    # search windows stay clear of the neighbouring verses' words
    lo_s = max(prev_end / 1000 + 0.04, ideal_start - 0.8) if prev_end else ideal_start - 0.6
    hi_e = min(next_start / 1000 - 0.04, ideal_end + 0.8) if next_start else ideal_end + 0.6
    if first_word <= 0.12:   # the recitation starts at the very beginning of the file: nothing before it to exclude
        slice_start, lvl_s = 0.0, -99.0
    else:
        slice_start, lvl_s = find_cut(src_mp3, max(0.0, ideal_start), max(0.0, lo_s), first_word - 0.02)
    slice_end, lvl_e = find_cut(src_mp3, ideal_end, ideal_end, max(ideal_end, hi_e))
    for label, at, lvl in (("start", slice_start, lvl_s), ("end", slice_end, lvl_e)):
        if lvl > -26:
            raise SystemExit(f"audio {label} cut: no pause found near {at:.3f}s (quietest {lvl:.0f} dB) - the word timings for this reciter look off here")
        print(f"audio {label} cut at {at:.3f}s " + ("= start of the recitation file" if lvl <= -99 else f"sits in a pause ({lvl:.0f} dB RMS over +/-50 ms)"))
    audio_len = slice_end - slice_start
    duration = round(INTRO + audio_len + OUTRO, 3)
    tv = lambda ms: round(INTRO + ms / 1000 - slice_start, 4)   # audio ms -> video seconds

    verses = []
    for n in nums:
        vs = verses_src[n]; t = T[f"{ch}:{n}"]
        words = [{"pos": w["position"], "text": nfc(w["text_uthmani"])} for w in vs["words"] if w["char_type_name"] == "word"]
        segs = [[s[0], tv(s[1]), tv(s[2])] for s in t["segments"]]
        verses.append({
            "n": n, "key": vs["verse_key"], "num_ar": str(n).translate(AR_DIGITS),
            "words": words, "segments": segs,
            "start": round(min(tv(t["timestamp_from"]), segs[0][1]), 4),
            "first_word": segs[0][1], "last_word": max(s[2] for s in segs),
            "translation": clean_translation(vs["translations"][0]["text"]),
            "glosses": [],
        })
    for i, v in enumerate(verses):
        v["end"] = verses[i + 1]["start"] if i + 1 < len(verses) else round(INTRO + audio_len + 0.6, 4)

    labels = sb["tafsir_labels"]
    byn = {v["n"]: v for v in verses}
    for g in sb["glosses"]:
        v = byn[g["verse"]]; w0, w1 = g["words"]
        chip = " ".join(w["text"] for w in v["words"][w0 - 1:w1])     # Quran text from API words only
        start = min(s[1] for s in v["segments"] if s[0] == w0)
        v["glosses"].append({"w0": w0, "w1": w1, "chip": chip, "excerpt": g["excerpt"], "source": labels[str(g["tafsir"])],
                             "target": g.get("target") or None, "tone": g["tone"], "start": start})
    for v in verses:
        v["glosses"].sort(key=lambda g: g["start"])
        for j, g in enumerate(v["glosses"]):
            g["end"] = v["glosses"][j + 1]["start"] - 0.05 if j + 1 < len(v["glosses"]) else v["end"] - 0.1

    cat = json.loads((ROOT / "renderer" / "js" / "scene_catalog.json").read_text(encoding="utf-8"))
    def default_bg(c):
        p = c.get("params") or {}
        if c["scene"] == "ambient": return cat["ambient"]["moods"].get(p.get("mood"), {}).get("bg", "#ece6da")
        if c["scene"] == "stage": return cat["stage"]["settings"].get(p.get("setting"), {}).get("bg", "#ece6da")
        return "#ece6da"
    chapters = []
    for c in sb["chapters"]:
        chapters.append({"id": c["id"], "title": c["title"], "scene": c["scene"], "params": c.get("params") or {},
                         "bg": c.get("bg") or default_bg(c), "verses": c["verses"],
                         "start": 0.0 if not chapters else byn[c["verses"][0]]["start"]})
    for i, c in enumerate(chapters):
        c["end"] = chapters[i + 1]["start"] if i + 1 < len(chapters) else duration

    # cover: storyboard block, or a default (surah name + first chapter title); picture = the scene at the chosen word
    cv = sb.get("cover") or {}
    at = cv.get("at")
    if at and at[0] in byn:
        pic_t = next((s[1] for s in byn[at[0]]["segments"] if s[0] == at[1]), byn[at[0]]["start"])
    else:
        c0 = chapters[0]
        pic_t = (byn[c0["verses"][0]]["start"] + min(c0["end"], INTRO + audio_len)) / 2
    cover = {"dur": COVER_S, "t": round(pic_t + 0.6, 3),
             "series_ar": cv.get("series_ar") or ("سورة " + src["chapter"]["name_arabic"]),
             "series_en": cv.get("series_en") or ("Surat " + src["chapter_en"]["name_simple"]),
             "title_ar": cv.get("title_ar") or sb["chapters"][0]["title"],
             "title_en": cv.get("title_en") or ""}

    rd = {
        "fps": FPS, "W": W, "H": H, "duration": duration, "intro": INTRO, "outro_start": round(INTRO + audio_len + 0.4, 4),
        "surah": {"name_ar": src["chapter"]["name_arabic"], "name_en": src["chapter_en"]["name_simple"], "number": ch,
                  "from_ar": str(nums[0]).translate(AR_DIGITS), "to_ar": str(nums[-1]).translate(AR_DIGITS),
                  "from": nums[0], "to": nums[-1]},
        "credits": sb["credits"],
        "cover": cover,
        "chapters": chapters, "verses": verses,
        "audio": {"slice_start": round(slice_start, 3), "slice_end": round(slice_end, 3), "file": "audio_master.wav"},
        "timing_corrections": [{**c, "video_t": tv(c["start_ms"])} for c in corrections],
        # words whose timing is implausibly short (the highlight would only flash): listed for listening
        "timing_flags": [{"verse": v["n"], "word": s[0], "text": v["words"][s[0] - 1]["text"], "dur_ms": round((s[2] - s[1]) * 1000), "video_t": s[1]}
                         for v in verses for s in v["segments"]
                         if s[2] - s[1] < 0.15 and len(re.findall(r"[ء-يٱ]", v["words"][s[0] - 1]["text"])) >= 4],
        # verse boundaries moved onto the reciter's measured pauses (listed on the review sheet)
        "aligned_boundaries": [{**m, "video_t": tv(m["pause_s"][1] * 1000)} for m in aligned if m["kind"] == "inside"],
    }
    (data_dir / "render_data.json").write_text(json.dumps(rd, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"render_data.json: {len(verses)} verses, {len(chapters)} chapters, duration {duration}s ({int(duration*FPS)} frames)")

    # ---- audio: cut, fades, intro delay, pad, two-pass loudnorm to -14 LUFS / -1.5 dBTP ----
    pre = data_dir / "audio_cut.wav"
    delay_ms = int(round(INTRO * 1000))
    run(["ffmpeg", "-v", "error", "-y", "-i", str(src_mp3),
         "-af", f"atrim=start={slice_start:.4f}:end={slice_end:.4f},asetpts=PTS-STARTPTS,"
                f"afade=t=in:d=0.04,afade=t=out:st={audio_len-0.35:.3f}:d=0.35,adelay={delay_ms}|{delay_ms},apad=whole_dur={duration}",
         "-ar", "48000", "-ac", "2", str(pre)])
    r = run(["ffmpeg", "-hide_banner", "-i", str(pre), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"])
    m = json.loads(r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1])
    run(["ffmpeg", "-v", "error", "-y", "-i", str(pre), "-af",
         f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true",
         "-ar", "48000", "-t", f"{duration}", str(data_dir / "audio_master.wav")])
    pre.unlink()
    print(f"audio_master.wav: slice {slice_start:.3f}-{slice_end:.3f}s of {src_mp3.name}, input {m['input_i']} LUFS -> -14 LUFS")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "storyboard/15_57-77.json")
