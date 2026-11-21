"""Command-line production (no web app needed): the tool the cloud agent uses.

  python pipeline/produce.py new <chapter> <from> <to> [--reciter 97]
        fetch the passage (verses, translation, both tafsirs, recitation + word timings) and write a base storyboard
        if none exists yet. Prints the project id.
  python pipeline/produce.py build <id> [--no-video]
        verify (must PASS) -> prepare (audio alignment + cuts) -> render the MP4 -> cover.jpg -> 720p preview
        -> review sheet PDF -> out/<id>/release.json (everything publish_hub.py needs).
  python pipeline/produce.py status [<chapter>]
        one line per project: storyboard mode, verified, built, published.

Project ids: <chapter>_<from>-<to>, plus _r<reciter> when the reciter is not 7 (Alafasy), e.g. 18_17-18_r97.
"""
import argparse, datetime, hashlib, json, pathlib, re, shutil, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
PY = [sys.executable, "-I", "-X", "utf8"]
NODE = shutil.which("node") or "node"


def pid_of(ch, a, b, rec):
    return f"{ch}_{a}-{b}" + ("" if rec == 7 else f"_r{rec}")


def run(cmd, what):
    print(f"\n== {what}: {' '.join(str(c) for c in cmd[-4:])}", flush=True)
    r = subprocess.run([str(c) for c in cmd], cwd=ROOT)
    if r.returncode:
        raise SystemExit(f"{what} FAILED (exit {r.returncode}) - stop and fix before continuing")


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def slug(s):
    return re.sub(r"[^A-Za-z0-9]+", "-", str(s)).strip("-")


def cmd_new(a):
    pid = pid_of(a.chapter, a.vfrom, a.vto, a.reciter)
    data = ROOT / "data" / pid
    if not (data / "source.json").exists():
        run(PY + ["pipeline/fetch_data.py", "--chapter", a.chapter, "--from", a.vfrom, "--to", a.vto, "--recitation", a.reciter, "--out", f"data/{pid}"], "fetch")
    if not (ROOT / "storyboard" / f"{pid}.json").exists():
        run(PY + ["pipeline/direct.py", "--id", pid, "--mode", "auto", "--style", "calm"], "base storyboard")
    print(f"\nproject {pid}: data/{pid}/source.json + storyboard/{pid}.json (base). Now write the storyboard by hand, then: produce.py build {pid}")


def cmd_build(a):
    pid = a.id
    sb_path = ROOT / "storyboard" / f"{pid}.json"
    sb = json.loads(sb_path.read_text(encoding="utf-8"))
    if (sb.get("director") or {}).get("mode") not in ("hand", "claude"):
        raise SystemExit(f"{pid}: the storyboard is still the automatic base one - write it by hand first (docs/STORYBOARD_GUIDE.md)")
    run(PY + ["pipeline/verify.py", f"storyboard/{pid}.json"], "verify")
    run(PY + ["pipeline/prepare.py", f"storyboard/{pid}.json"], "prepare (alignment + audio)")
    if a.no_video:
        return
    rd = json.loads((ROOT / "data" / pid / "render_data.json").read_text(encoding="utf-8"))
    src = json.loads((ROOT / "data" / pid / "source.json").read_text(encoding="utf-8"))
    out = ROOT / "out" / pid
    out.mkdir(parents=True, exist_ok=True)
    name = f"{slug(rd['surah']['name_en'])}_{rd['surah']['number']}_{rd['surah']['from']}-{rd['surah']['to']}_{slug(rd['credits'].get('reciter_en', 'reciter').split(' ')[-1])}"
    video, preview, cover, sheet = out / f"{name}.mp4", out / f"{name}_preview.mp4", out / f"{name}_cover.jpg", out / f"{name}_review.pdf"
    run([NODE, "renderer/render.mjs", "video", "--data", f"data/{pid}/render_data.json", "--crf", "17", "--out", video.relative_to(ROOT).as_posix()], "render")
    run(["ffmpeg", "-v", "error", "-y", "-i", video, "-frames:v", "1", "-q:v", "2", cover], "cover (first frame)")
    run(["ffmpeg", "-v", "error", "-y", "-i", video, "-vf", "scale=720:-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "27",
         "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", preview], "720p preview")
    run([NODE, "renderer/render.mjs", "review", "--data", f"data/{pid}/render_data.json", "--out", sheet.relative_to(ROOT).as_posix()], "review sheet")
    probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height", "-of", "json", str(video)],
                                      capture_output=True, text=True).stdout)
    release = {
        "id": pid, "chapter": rd["surah"]["number"], "from": rd["surah"]["from"], "to": rd["surah"]["to"],
        "surah_ar": rd["surah"]["name_ar"], "surah_en": rd["surah"]["name_en"],
        "reciter_id": src["meta"]["recitation_id"], "reciter_ar": rd["credits"]["reciter_ar"], "reciter_en": rd["credits"].get("reciter_en", ""),
        "cover": rd.get("cover"), "duration_s": round(float(probe["format"]["duration"]), 2),
        "streams": [{k: s.get(k) for k in ("codec_name", "width", "height")} for s in probe["streams"]],
        "files": {"video": video.name, "preview": preview.name, "cover": cover.name, "review_sheet": sheet.name},
        "video_sha256": sha256(video), "storyboard_sha256": sha256(sb_path),
        "aligned_boundaries": len(rd.get("aligned_boundaries") or []), "timing_flags": rd.get("timing_flags") or [],
        "built_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    }
    (out / "release.json").write_text(json.dumps(release, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nbuilt {pid}: {video.relative_to(ROOT)} ({release['duration_s']} s) + preview, cover, review sheet, release.json")


def cmd_status(a):
    ledger = json.loads((ROOT / "publish" / "ledger.json").read_text(encoding="utf-8")) if (ROOT / "publish" / "ledger.json").exists() else {}
    rows = []
    for p in sorted((ROOT / "storyboard").glob("*.json")):
        pid = p.stem
        if not re.match(r"^\d+_\d+-\d+(_r\d+)?$", pid) or (a.chapter and not pid.startswith(f"{a.chapter}_")):
            continue
        sb = json.loads(p.read_text(encoding="utf-8"))
        rep = ROOT / "data" / pid / "verify_report.md"
        verified = "PASSED" if rep.exists() and "**PASSED**" in rep.read_text(encoding="utf-8") else ("FAILED" if rep.exists() else "-")
        built = (ROOT / "out" / pid / "release.json").exists()
        rows.append((int(pid.split("_")[0]), int(pid.split("_")[1].split("-")[0]), pid, (sb.get("director") or {}).get("mode", "?"), verified, built, pid in ledger))
    for _, _, pid, mode, ver, built, pub in sorted(rows):
        print(f"{pid:<18} storyboard={mode:<6} verify={ver:<7} built={'yes' if built else 'no ':<4} published={'yes' if pub else 'no'}")
    print(f"{len(rows)} projects")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    n = sub.add_parser("new"); n.add_argument("chapter", type=int); n.add_argument("vfrom", type=int); n.add_argument("vto", type=int); n.add_argument("--reciter", type=int, default=97)
    b = sub.add_parser("build"); b.add_argument("id"); b.add_argument("--no-video", action="store_true")
    s = sub.add_parser("status"); s.add_argument("chapter", nargs="?", type=int)
    a = ap.parse_args()
    {"new": cmd_new, "build": cmd_build, "status": cmd_status}[a.cmd](a)


if __name__ == "__main__":
    main()
