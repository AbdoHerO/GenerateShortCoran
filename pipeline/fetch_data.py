"""Fetch everything a passage video needs from the Quran Foundation dataset.

Nothing Quranic is typed by hand: verse text, word text, ayah numbers, translation, tafsir,
audio and word timings all come from the API and are saved untouched in source.json.

Sources:
  public         https://api.quran.com/api/v4   (QF dataset, no auth; used while QF prod access is pending)
  qf-prelive     QF Content API pre-live (only Al-Fatiha + Al-Baqarah)
  qf-production  QF Content API production (needs production credentials in .env)

Usage:
  python pipeline/fetch_data.py --chapter 15 --from 57 --to 77 --recitation 7 --out data/15_57-77
"""
import argparse, base64, json, os, pathlib, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
UA = "quran-video-builder/0.1"   # Cloudflare rejects the default Python UA (error 1010)

SOURCES = {
    "public": {"base": "https://api.quran.com/api/v4", "oauth": None},
    "qf-prelive": {"base": "https://apis-prelive.quran.foundation/content/api/v4",
                   "oauth": "https://prelive-oauth2.quran.foundation/oauth2/token"},
    "qf-production": {"base": "https://apis.quran.foundation/content/api/v4",
                      "oauth": "https://oauth2.quran.foundation/oauth2/token"},
}
SCOPES = "content.quran.read content.translations.read content.tafsirs.read content.audio.read content.metadata.read"


def load_env():
    env = {}
    p = ROOT / ".env"
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


class Client:
    def __init__(self, source):
        self.cfg = SOURCES[source]
        self.headers = {"User-Agent": UA, "Accept": "application/json"}
        if self.cfg["oauth"]:
            env = load_env()
            cid, sec = env["Client_ID"], env["Client_Secret"]
            basic = base64.b64encode(f"{cid}:{sec}".encode()).decode()
            req = urllib.request.Request(
                self.cfg["oauth"],
                data=urllib.parse.urlencode({"grant_type": "client_credentials", "scope": SCOPES}).encode(),
                headers={"Authorization": f"Basic {basic}", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                tok = json.load(r)["access_token"]
            self.headers.update({"x-auth-token": tok, "x-client-id": cid})

    def get(self, path, **params):
        url = self.cfg["base"] + path + ("?" + urllib.parse.urlencode(params) if params else "")
        for attempt in range(4):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=self.headers), timeout=60) as r:
                    return json.load(r)
            except urllib.error.HTTPError as e:
                if e.code in (429, 500, 502, 503, 504) and attempt < 3:
                    time.sleep(2 ** attempt); continue
                raise SystemExit(f"HTTP {e.code} on {path}: {e.read()[:200].decode('utf-8', 'replace')}")


def progress(**kw):
    """Machine-readable progress line for the platform server."""
    print("@@ " + json.dumps(kw, ensure_ascii=False), flush=True)


def download(url, dest):
    """Download to a temp file, then rename, so an interrupted download never leaves a truncated mp3 behind."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    tmp = dest.with_suffix(dest.suffix + ".part")
    with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
        total, got, last = int(r.headers.get("Content-Length") or 0), 0, 0
        while chunk := r.read(1 << 16):
            f.write(chunk); got += len(chunk)
            if total and got - last > total / 50:
                last = got; progress(step="fetch", what="audio", done=got, total=total)
    os.replace(tmp, dest)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="public", choices=SOURCES)
    ap.add_argument("--chapter", type=int, required=True)
    ap.add_argument("--from", dest="vfrom", type=int, required=True)
    ap.add_argument("--to", dest="vto", type=int, required=True)
    ap.add_argument("--recitation", type=int, default=7, help="chapter-recitation id (7 = Mishari Alafasy)")
    ap.add_argument("--translation", type=int, default=20, help="20 = Saheeh International")
    ap.add_argument("--tafsirs", default="16,91", help="16 = Al-Muyassar, 91 = As-Sa'di")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    out = (ROOT / a.out).resolve(); out.mkdir(parents=True, exist_ok=True)
    c = Client(a.source)
    keys = [f"{a.chapter}:{n}" for n in range(a.vfrom, a.vto + 1)]
    tafsir_ids = [int(x) for x in a.tafsirs.split(",") if x]

    src = {"meta": {"source": a.source, "base": c.cfg["base"], "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "chapter": a.chapter, "from": a.vfrom, "to": a.vto, "recitation_id": a.recitation,
                    "translation_id": a.translation, "tafsir_ids": tafsir_ids}}

    src["chapter"] = c.get(f"/chapters/{a.chapter}", language="ar")["chapter"]
    src["chapter_en"] = c.get(f"/chapters/{a.chapter}", language="en")["chapter"]
    src["translation_resource"] = next((t for t in c.get("/resources/translations")["translations"] if t["id"] == a.translation), None)
    all_tafsirs = c.get("/resources/tafsirs")["tafsirs"]
    src["tafsir_resources"] = [t for t in all_tafsirs if t["id"] in tafsir_ids]

    src["verses"] = []
    for i, k in enumerate(keys):
        progress(step="fetch", what="verses", done=i, total=len(keys))
        v = c.get(f"/verses/by_key/{k}", words="true", translations=str(a.translation),
                  fields="text_uthmani,text_imlaei", word_fields="text_uthmani,location")["verse"]
        src["verses"].append(v)
        print("verse", k, "words:", len([w for w in v["words"] if w["char_type_name"] == "word"]))

    src["tafsirs"] = {}
    for tid in tafsir_ids:
        src["tafsirs"][str(tid)] = {}
        for i, k in enumerate(keys):
            progress(step="fetch", what=f"tafsir {tid}", done=i, total=len(keys))
            src["tafsirs"][str(tid)][k] = c.get(f"/tafsirs/{tid}/by_ayah/{k}")["tafsir"]
        print("tafsir", tid, "ok")

    rec = c.get(f"/chapter_recitations/{a.recitation}/{a.chapter}", segments="true")["audio_file"]
    src["recitation"] = {k: v for k, v in rec.items() if k != "timestamps"}
    src["recitation"]["timestamps"] = [t for t in rec["timestamps"] if t["verse_key"] in keys]
    # where the neighbouring verses' words end/start, so audio cuts never take a sample of them
    allts = {t["verse_key"]: t for t in rec["timestamps"]}
    pk, nk = f"{a.chapter}:{a.vfrom - 1}", f"{a.chapter}:{a.vto + 1}"
    src["recitation"]["neighbors"] = {
        "prev_end": max((s[2] for s in allts[pk].get("segments") or []), default=allts[pk]["timestamp_to"]) if pk in allts else None,
        "next_start": min((s[1] for s in allts[nk].get("segments") or []), default=allts[nk]["timestamp_from"]) if nk in allts else None,
    }
    reciters_ar = c.get("/resources/chapter_reciters", language="ar").get("reciters", [])
    reciters_en = c.get("/resources/chapter_reciters", language="en").get("reciters", [])
    src["reciter_ar"] = next((r for r in reciters_ar if r["id"] == a.recitation), None)
    src["reciter_en"] = next((r for r in reciters_en if r["id"] == a.recitation), None)

    # full-chapter recitations are shared by every passage of that chapter (data/_audio)
    cache = ROOT / "data" / "_audio"; cache.mkdir(parents=True, exist_ok=True)
    audio = out / f"chapter_{a.chapter:03d}_rec{a.recitation}.mp3"
    if not audio.exists():
        audio = cache / f"chapter_{a.chapter:03d}_rec{a.recitation}.mp3"
        if not audio.exists():
            print("downloading audio", rec["audio_url"])
            download(rec["audio_url"], audio)
    src["recitation"]["local_file"] = pathlib.Path(os.path.relpath(audio, out)).as_posix()

    (out / "source.json").write_text(json.dumps(src, ensure_ascii=False, indent=1), encoding="utf-8")
    print("saved", out / "source.json")


if __name__ == "__main__":
    main()
