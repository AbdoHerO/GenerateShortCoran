"""Build data/catalog.json for the web app: the 114 surahs (names and verse counts from the Quran Foundation
dataset) and the reciters that have word-level timings (checked against the API).

Usage: python pipeline/catalog.py
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))
from fetch_data import Client  # noqa: E402

# Recitation id -> Arabic display name (UI text). Only murattal/mujawwad recitations with word timings are offered;
# 'kids repeat', 'muallim' (teaching repeats) and the duplicate streaming files are left out on purpose.
RECITERS_AR = {
    7: "مشاري راشد العفاسي",
    2: "عبد الباسط عبد الصمد",
    1: "عبد الباسط عبد الصمد",
    3: "عبد الرحمن السديس",
    4: "أبو بكر الشاطري",
    5: "هاني الرفاعي",
    6: "محمود خليل الحصري",
    9: "محمد صديق المنشاوي",
    10: "سعود الشريم",
    97: "ياسر الدوسري",
    161: "خليفة الطنيجي",
}


def build():
    c = Client("public")
    en = c.get("/chapters", language="en")["chapters"]
    surahs = [{"n": x["id"], "name_en": x["name_simple"], "name_ar": x["name_arabic"], "meaning": x["translated_name"]["name"],
               "verses": x["verses_count"], "place": x["revelation_place"]} for x in en]
    api = {r["id"]: r for r in c.get("/resources/chapter_reciters", language="en")["reciters"]}
    reciters = []
    for rid, ar in RECITERS_AR.items():
        r = api.get(rid)
        if not r:
            continue
        reciters.append({"id": rid, "name_en": r["name"].replace("`", "'"), "name_ar": ar, "style": r["style"]["name"]})
    out = {"surahs": surahs, "reciters": reciters}
    assert len(surahs) == 114 and sum(s["verses"] for s in surahs) == 6236, "unexpected surah list"
    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data" / "catalog.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"catalog: {len(surahs)} surahs, {len(reciters)} reciters")


if __name__ == "__main__":
    build()
