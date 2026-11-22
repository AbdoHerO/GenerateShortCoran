"""Publish built videos to Creative Hub, platform « Coran », as DRAFTS for human review (never auto-approved).

  python pipeline/publish_hub.py plan <chapter> [--ids id1,id2] [--version N]
                                                                  build the Creative Hub plan + ZIP for every built,
                                                                  not-yet-published video of the surah, and validate it.
                                                                  --version N (N >= 2, owner decision 2026-11-21): a
                                                                  restaged NEW version of a video already published; it
                                                                  is uploaded NEXT TO the old draft with « - vN » at the
                                                                  end of its name and recorded under the key « id@vN »
  python pipeline/publish_hub.py upload <plan.json>              import that ZIP (--confirm, WITHOUT --approve), check the
                                                                  result, and record everything in publish/ledger.json
  python pipeline/publish_hub.py check                           test the token and show platforms/badges (GET /me)

Needs CREATIVE_HUB_URL and CREATIVE_HUB_TOKEN in the environment (never in a file, never printed).
Each video becomes ONE creative: the MP4 (FULL), its 720p copy (PREVIEW), the cover (label « Cover »),
and the review sheet PDF (label « Review sheet »). Captions are generated from the data; no Quranic text is typed.
"""
import datetime, hashlib, json, os, pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools" / "creative-hub"
LEDGER = ROOT / "publish" / "ledger.json"
PLATFORM = "Coran"
CATEGORY = "MARKETING_VIDEO"   # Creative Hub's category for social videos (reels); change here if the owner prefers another
CHANNELS = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "FACEBOOK"]
COLORS = {"surah": "#0F766E", "series": "#7C3AED", "reciter": "#1D4ED8", "format": "#BE185D", "status": "#CA8A04"}
STATUS_BADGE = "Needs review"
FORMAT_BADGE = "Reel 9:16"
AR_DIGITS = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def load_ledger():
    return json.loads(LEDGER.read_text(encoding="utf-8")) if LEDGER.exists() else {}


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def tag(s):
    return "#" + re.sub(r"[^\w]+", "_", s, flags=re.UNICODE).strip("_")


def ledger_key(vid, version):
    return vid if version <= 1 else f"{vid}@v{version}"


def creative_for(rel, out, version=1):
    cv = rel.get("cover") or {}
    ch, a, b = rel["chapter"], rel["from"], rel["to"]
    rng = f"{a}" if a == b else f"{a}-{b}"
    rng_ar = (f"الآية {str(a).translate(AR_DIGITS)}" if a == b else f"الآيات {str(a).translate(AR_DIGITS)}–{str(b).translate(AR_DIGITS)}")
    rec_short = rel["reciter_en"].split(" ")[-1].replace("ad-", "").replace("al-", "").title() if rel["reciter_en"] else "Reciter"
    vtag = f" - v{version}" if version > 1 else ""
    name = f"Reel - {ch}:{rng} {rel['surah_en']} - {cv.get('title_ar', '')} - {rec_short}"[:185] + vtag
    caption = "\n".join([
        cv.get("title_ar", ""),
        f"سورة {rel['surah_ar']} · {rng_ar}",
        f"بصوت القارئ {rel['reciter_ar']}",
        "مع معاني الكلمات من التفسير الميسر وتفسير السعدي",
        "",
        f"{cv.get('title_en', '')} — Surah {rel['surah_en']} {ch}:{rng}, recited by {rel['reciter_en']}. English: Saheeh International.",
        "",
        " ".join([tag("القرآن_الكريم"), tag("سورة_" + rel["surah_ar"]), tag(rel["reciter_ar"]), "#Quran", tag(rel["surah_en"].replace("-", ""))]),
    ]).strip()
    yt_title = f"{cv.get('title_ar', '')} | سورة {rel['surah_ar']} {rng} | {rel['reciter_ar']}"[:100]
    yt_desc = "\n".join([
        f"{cv.get('series_ar', '')} — {cv.get('title_ar', '')}",
        f"سورة {rel['surah_ar']} ({rel['surah_en']}) {ch}:{rng} · بصوت القارئ {rel['reciter_ar']} ({rel['reciter_en']})",
        "",
        f"{cv.get('series_en', '')} — {cv.get('title_en', '')}",
        "Quran text, recitation, word timings and tafsir: Quran Foundation (quran.com). English translation: Saheeh International.",
        "Tafsir: التفسير الميسر · تفسير السعدي. Illustrations are symbolic: prophets and angels are never depicted.",
    ]).strip()
    alt = f"Vertical video: Surah {rel['surah_en']} {ch}:{rng} recited by {rel['reciter_en']}, with the Arabic text highlighted word by word, an English translation and symbolic illustrations."
    f = rel["files"]
    return {
        "name": name, "category": CATEGORY, "folder": f"videos/{ch:03d} {rel['surah_en']}",
        "badges": [f"سورة {rel['surah_ar']}"[:40], (cv.get("series_ar") or f"سورة {rel['surah_ar']}")[:40], rel["reciter_ar"][:40], FORMAT_BADGE, STATUS_BADGE],
        "channels": CHANNELS,
        "copies": [{"label": "Instagram caption", "text": caption}, {"label": "YouTube title", "text": yt_title},
                   {"label": "YouTube description", "text": yt_desc}, {"label": "Alt text", "text": alt}],
        "tags": [rel["surah_en"].lower(), f"{ch}:{rng}", rel["reciter_en"].lower()[:40]],
        "keywords": ["quran", "tafsir", rel["surah_en"].lower()],
        "description": f"{ledger_key(rel['id'], version)} · storyboard sha256 {rel['storyboard_sha256'][:12]} · video sha256 {rel['video_sha256'][:12]}",
        "files": [
            {"source": str(out / f["video"])},
            {"source": str(out / f["preview"]), "versionType": "PREVIEW"},
            {"source": str(out / f["cover"]), "label": "Cover"},
            {"source": str(out / f["review_sheet"]), "label": "Review sheet"},
        ],
    }


def cmd_plan(chapter, ids=None, version=1):
    ledger = load_ledger()
    rels = []
    for d in sorted((ROOT / "out").glob(f"{chapter}_*")):
        rf = d / "release.json"
        if not rf.exists() or (ids and d.name not in ids):
            continue
        rel = json.loads(rf.read_text(encoding="utf-8"))
        key = ledger_key(rel["id"], version)
        if version > 1 and rel["id"] not in ledger:
            print(f"SKIP {rel['id']}: --version {version} is only for videos already published (publish it normally)")
            continue
        if version > 1 and any(ledger.get(ledger_key(rel["id"], v), {}).get("video_sha256") == rel["video_sha256"] for v in range(1, version)):
            print(f"SKIP {rel['id']}: this render is one already published (an earlier version), not a new version")
            continue
        if key in ledger:
            if ledger[key]["video_sha256"] != rel["video_sha256"]:
                print(f"SKIP {rel['id']}: already published, and this is a NEW render. Re-importing would create a duplicate « (2) »: ask the owner first.")
            continue
        if sha256(d / rel["files"]["video"]) != rel["video_sha256"]:
            raise SystemExit(f"{rel['id']}: the MP4 on disk does not match release.json - rebuild it")
        rels.append((rel, d))
    if not rels:
        print("nothing to publish for this surah (all built videos are already in the ledger)")
        return
    rels.sort(key=lambda x: (x[0]["chapter"], x[0]["from"]))
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d-%H%M%S")
    creatives = [creative_for(r, d, version) for r, d in rels]
    badges = {}
    for c, (r, _) in zip(creatives, rels):
        kinds = ["surah", "series", "reciter", "format", "status"]
        for k, b in zip(kinds, c["badges"]):
            badges.setdefault(b, COLORS[k])
    vs = f"-v{version}" if version > 1 else ""
    zip_path = ROOT / "out" / "_publish" / f"coran-{chapter:03d}{vs}-{stamp}.zip"
    plan = {"platform": PLATFORM, "zip": str(zip_path), "badges": [{"name": n, "color": col} for n, col in badges.items()],
            "creatives": creatives, "_ids": [ledger_key(r["id"], version) for r, _ in rels],
            "_video_sha256": {ledger_key(r["id"], version): r["video_sha256"] for r, _ in rels}}
    pdir = ROOT / "publish" / "plans"; pdir.mkdir(parents=True, exist_ok=True)
    plan_path = pdir / f"coran-{chapter:03d}{vs}-{stamp}.json"
    plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding="utf-8")
    r = subprocess.run([sys.executable, str(TOOLS / "build_creative_zip.py"), str(plan_path)], capture_output=True, text=True, encoding="utf-8")
    print(r.stdout[-2000:])
    if r.returncode:
        raise SystemExit("the Creative Hub ZIP did not validate - fix the plan (see errors above)")
    print(f"plan {plan_path.relative_to(ROOT)} ready: {len(creatives)} creative(s). Next: python pipeline/publish_hub.py upload {plan_path.relative_to(ROOT).as_posix()}")


def cmd_upload(plan_path):
    for k in ("CREATIVE_HUB_URL", "CREATIVE_HUB_TOKEN"):
        if not os.environ.get(k):
            raise SystemExit(f"{k} is not set in the environment")
    plan = json.loads((ROOT / plan_path).read_text(encoding="utf-8"))
    ledger = load_ledger()
    already = [i for i in plan["_ids"] if i in ledger]
    if already:
        raise SystemExit(f"refusing: {already} are already in the ledger (would create duplicates)")
    r = subprocess.run(["node", str(TOOLS / "creative-hub-agent.mjs"), "import", plan["zip"], "--confirm"],
                       capture_output=True, text=True, encoding="utf-8")
    sys.stderr.write(r.stderr[-3000:])
    try:
        res = json.loads(r.stdout)
    except json.JSONDecodeError:
        raise SystemExit(f"client failed (exit {r.returncode}); nothing recorded. stdout: {r.stdout[-500:]}")
    if r.returncode != 0 or res.get("status") != "COMPLETED":
        raise SystemExit(f"import did not complete (exit {r.returncode}, status {res.get('status')}). importId {res.get('importId')} - "
                         f"see docs/MASTER_DOCUMENTATION.md, section 'Publishing problems'. Nothing recorded in the ledger.")
    counts = res.get("counts", {})
    files = sum(len(c["files"]) for c in plan["creatives"])
    ok = counts.get("failed", 0) == 0 and counts.get("rejected", 0) == 0 and counts.get("imported") == files and counts.get("newCreatives") == len(plan["creatives"])
    urls = {c.get("name"): c.get("url") for c in res.get("creatives", []) if isinstance(c, dict)}
    now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    for pid, c in zip(plan["_ids"], plan["creatives"]):
        ledger[pid] = {"creative": c["name"], "url": urls.get(c["name"]), "import_id": res.get("importId"), "video_sha256": plan["_video_sha256"][pid],
                       "status": "DRAFT (needs human review)", "published_at": now}
    LEDGER.parent.mkdir(exist_ok=True)
    LEDGER.write_text(json.dumps(ledger, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
    print(json.dumps({"importId": res.get("importId"), "status": res.get("status"), "counts": counts, "all_ok": ok,
                      "creatives": [{"name": n, "url": u} for n, u in urls.items()]}, ensure_ascii=False, indent=1))
    if not ok:
        raise SystemExit("import COMPLETED but the counts do not match the plan - report it to the owner (ledger updated for this import)")


def cmd_check():
    r = subprocess.run(["node", str(TOOLS / "creative-hub-agent.mjs"), "me"], capture_output=True, text=True, encoding="utf-8")
    if r.returncode:
        raise SystemExit(r.stderr[-800:])
    me = json.loads(r.stdout)
    plats = [p.get("name") if isinstance(p, dict) else p for p in me.get("platforms", [])]
    print(json.dumps({"actingAs": me.get("actingAs") or me.get("user"), "can": me.get("can"), "platforms": plats,
                      "coran_exists": PLATFORM in plats, "badges": [b.get("name") for b in me.get("badges", []) if isinstance(b, dict)][:60],
                      "limits": me.get("limits")}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] not in ("plan", "upload", "check"):
        print(__doc__); sys.exit(2)
    if a[0] == "plan":
        ids = next((x.split(",") for x in a if x.startswith("--ids=")), None)
        if "--ids" in a: ids = a[a.index("--ids") + 1].split(",")
        ver = int(a[a.index("--version") + 1]) if "--version" in a else 1
        if ver < 1: raise SystemExit("--version must be >= 1")
        cmd_plan(int(a[1]), ids, ver)
    elif a[0] == "upload":
        cmd_upload(a[1])
    else:
        cmd_check()
