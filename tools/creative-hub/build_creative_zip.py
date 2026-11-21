#!/usr/bin/env python3
"""
Build a Creative Hub import ZIP from a plan, with its manifest in sync.

    python build_creative_zip.py plan.json            # build + verify
    python build_creative_zip.py plan.json --check    # verify the plan only, write nothing

plan.json (UTF-8):
{
  "platform": "Euro Digital",
  "zip": "D:/exports/euro-digital-2026-11-21-reels.zip",
  "badges": [{"name": "Reel produit", "color": "#EA580C"}],
  "creatives": [
    {
      "name": "Reel - Dell Latitude 5420 - Darija",
      "category": "MARKETING_VIDEO",
      "folder": "videos/Reels produits",
      "badges": ["Reel produit", "Darija"],
      "copies": [{"label": "Instagram caption", "text": "..."}],
      "tags": ["dell"], "keywords": ["eurodigital"], "channels": ["INSTAGRAM"],
      "description": "Internal note (optional)",
      "files": [
        {"source": "D:/renders/latitude-5420.mp4"},
        {"source": "D:/renders/latitude-5420_preview.mp4", "versionType": "PREVIEW"},
        {"source": "D:/renders/latitude-5420-cover.jpg", "label": "Cover"}
      ]
    }
  ]
}

Each file goes to  data_creatives/<platform>/<folder>/<file name>  and the manifest
data_creatives/creative-hub-import.json lists exactly those paths, in order: the
first file of a creative is its main (FULL) version, the others are variants
(carousel images, cover) unless "versionType" says PREVIEW. Media are stored
without recompression (ZIP_STORED, ZIP64 for big archives). The script refuses
anything Creative Hub would reject, then reopens the ZIP and checks that the
manifest and the archive match file for file. Standard library only.
"""
import hashlib
import json
import os
import re
import sys
import zipfile

MANIFEST = "creative-hub-import.json"
ROOT = "data_creatives"
EXTENSIONS = {
    "mp4", "m4v", "mov", "webm", "mkv", "avi",
    "jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "tif", "tiff", "bmp", "heic", "heif", "psd",
    "pdf", "ai", "eps",
}
CATEGORIES = {"MARKETING_VIDEO", "ADVERTISING_VIDEO", "SOCIAL_MEDIA_POST", "BANNER", "PROMOTIONAL_IMAGE", "CAMPAIGN_VISUAL", "DOCUMENT", "OTHER"}
CHANNELS = {"INSTAGRAM", "FACEBOOK", "LINKEDIN", "TIKTOK", "YOUTUBE", "X", "WHATSAPP", "WEBSITE", "EMAIL", "DISPLAY_ADS", "IN_APP", "PRINT", "OTHER"}
VERSION_TYPES = {"FULL", "PREVIEW", "VARIANT"}
MAX_ENTRIES = 5000
BAD_SEGMENT = re.compile(r'[\x00-\x1f\x7f<>:"|?*\\]')


def fail(errors):
    print(json.dumps({"ok": False, "errors": errors[:200], "errorCount": len(errors)}, ensure_ascii=False, indent=2))
    sys.exit(1)


def clean_segment(seg, what, errors):
    seg = seg.strip()
    if not seg or seg in (".", "..") or seg.startswith(".") or BAD_SEGMENT.search(seg):
        errors.append(f"{what}: « {seg} » is not a valid folder or file name (no leading dot, no < > : \" | ? * \\).")
    return seg


def build_manifest(plan, errors):
    platform = str(plan.get("platform", "")).strip()
    if not platform or len(platform) > 80:
        errors.append("platform: required, 80 characters at most.")
    declared = {}
    for b in plan.get("badges", []):
        name = str(b.get("name", "")).strip()
        color = b.get("color")
        if not name or len(name) > 40:
            errors.append(f"badge « {name} »: 1 to 40 characters.")
        if color is not None and not re.fullmatch(r"#[0-9a-fA-F]{6}", str(color)):
            errors.append(f"badge « {name} »: color must be #RRGGBB.")
        declared[name.lower()] = name
    creatives, entries, seen_paths, seen_names = [], [], {}, set()
    for i, c in enumerate(plan.get("creatives", [])):
        name = str(c.get("name", "")).strip()
        where = f"creative {i + 1} « {name} »"
        if not name or len(name) > 190:
            errors.append(f"{where}: name required, 190 characters at most.")
        if name.lower() in seen_names:
            errors.append(f"{where}: the same name is used twice in this plan (the second would become « {name} (2) »).")
        seen_names.add(name.lower())
        if c.get("category") and c["category"] not in CATEGORIES:
            errors.append(f"{where}: category must be one of {sorted(CATEGORIES)}.")
        for ch in c.get("channels", []):
            if ch not in CHANNELS:
                errors.append(f"{where}: channel {ch} must be one of {sorted(CHANNELS)}.")
        badges = c.get("badges", [])
        if len(badges) > 30:
            errors.append(f"{where}: 30 badges at most.")
        for b in badges:
            if len(b) > 40:
                errors.append(f"{where}: badge « {b} » is longer than 40 characters.")
        copies = c.get("copies", [])
        if len(copies) > 20:
            errors.append(f"{where}: 20 texts at most.")
        for k in copies:
            text = str(k.get("text", "")).replace("\r\n", "\n").strip()
            if not text or len(text) > 10000:
                errors.append(f"{where}: every text needs 1 to 10,000 characters.")
            if k.get("label") and len(k["label"]) > 80:
                errors.append(f"{where}: label « {k['label']} » is longer than 80 characters.")
        for field, limit, size in (("tags", 30, 40), ("keywords", 50, 60)):
            values = c.get(field, [])
            if len(values) > limit or any(len(v) > size for v in values):
                errors.append(f"{where}: {field}: {limit} values of {size} characters at most.")
        folder = [clean_segment(s, where, errors) for s in str(c.get("folder", "")).replace("\\", "/").split("/") if s.strip()]
        files = c.get("files", [])
        if not 1 <= len(files) <= 200:
            errors.append(f"{where}: 1 to 200 files.")
        types = [f.get("versionType") for f in files]
        if any(t and t not in VERSION_TYPES for t in types):
            errors.append(f"{where}: versionType must be FULL, PREVIEW or VARIANT.")
        resolved = [t or ("FULL" if j == 0 and "FULL" not in types else "VARIANT") for j, t in enumerate(types)]
        if resolved.count("FULL") > 1 or resolved.count("PREVIEW") > 1:
            errors.append(f"{where}: one FULL and one PREVIEW file at most; the others are VARIANT.")
        mfiles = []
        for f in files:
            src = f.get("source", "")
            base = clean_segment(os.path.basename(src), where, errors)
            ext = base.rsplit(".", 1)[-1].lower() if "." in base else ""
            if ext not in EXTENSIONS:
                errors.append(f"{where}: {base}: .{ext} is not accepted (captions and notes go in the manifest, not as files).")
            if not os.path.isfile(src) or os.path.getsize(src) == 0:
                errors.append(f"{where}: {src} is missing or empty.")
            path = "/".join([ROOT, platform, *folder, base])
            if path.lower() in seen_paths:
                errors.append(f"{where}: {path} is already used by « {seen_paths[path.lower()]} »: rename the file.")
            seen_paths[path.lower()] = name
            entry = {"path": path}
            if f.get("label"):
                entry["label"] = f["label"]
            if f.get("versionType"):
                entry["versionType"] = f["versionType"]
            mfiles.append(entry)
            entries.append((src, path))
        creative = {"name": name}
        for key in ("platform", "category", "description", "badges", "tags", "keywords", "channels"):
            if c.get(key):
                creative[key] = c[key]
        if copies:
            creative["copies"] = [{**({"label": k["label"]} if k.get("label") else {}), "text": str(k["text"]).replace("\r\n", "\n").strip()} for k in copies]
        creative["files"] = mfiles
        creatives.append(creative)
    if not creatives:
        errors.append("creatives: at least one.")
    if len(entries) > MAX_ENTRIES - 1:
        errors.append(f"{len(entries)} files: split the plan, an archive holds {MAX_ENTRIES - 1} files at most besides the manifest.")
    used = {b.lower() for c in creatives for b in c.get("badges", [])}
    badges = [{"name": declared[k], **next(({"color": b["color"]} for b in plan.get("badges", []) if b.get("name", "").strip().lower() == k and b.get("color")), {})} for k in declared if k in used]
    manifest = {"version": 1, "platform": platform, **({"badges": badges} if badges else {}), "creatives": creatives}
    return manifest, entries


def verify(zip_path, manifest):
    listed = [f["path"] for c in manifest["creatives"] for f in c["files"]]
    with zipfile.ZipFile(zip_path) as zf:
        names = [n for n in zf.namelist() if not n.endswith("/")]
        inside = json.loads(zf.read(f"{ROOT}/{MANIFEST}").decode("utf-8"))
        bad = zf.testzip()
    media = [n for n in names if n != f"{ROOT}/{MANIFEST}"]
    problems = []
    if bad:
        problems.append(f"corrupt entry: {bad}")
    if inside != manifest:
        problems.append("the manifest inside the ZIP differs from the plan")
    if any("\\" in n for n in names):
        problems.append("backslashes in entry names")
    missing = sorted(set(listed) - set(media))
    extra = sorted(set(media) - set(listed))
    if missing:
        problems.append(f"listed but not in the ZIP: {missing[:20]}")
    if extra:
        problems.append(f"in the ZIP but not listed: {extra[:20]}")
    if len(media) != len(listed):
        problems.append(f"{len(media)} files in the ZIP, {len(listed)} in the manifest")
    return problems


def main():
    # Arabic and French names must print on any console (Windows defaults to cp1252).
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    with open(sys.argv[1], encoding="utf-8") as fh:
        plan = json.load(fh)
    errors = []
    manifest, entries = build_manifest(plan, errors)
    if errors:
        fail(errors)
    if "--check" in sys.argv:
        print(json.dumps({"ok": True, "creatives": len(manifest["creatives"]), "files": len(entries)}, indent=2))
        return
    out = plan.get("zip") or "creative-hub-import.zip"
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    tmp = out + ".part"
    with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_STORED, allowZip64=True) as zf:
        zf.writestr(f"{ROOT}/{MANIFEST}", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        for src, path in entries:
            zf.write(src, path)
    problems = verify(tmp, manifest)
    if problems:
        os.remove(tmp)
        fail(problems)
    os.replace(tmp, out)
    digest = hashlib.sha256()
    with open(out, "rb") as fh:
        for chunk in iter(lambda: fh.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    with open(os.path.splitext(out)[0] + ".manifest.json", "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=2)
    print(json.dumps({
        "ok": True,
        "zip": os.path.abspath(out),
        "bytes": os.path.getsize(out),
        "sha256": digest.hexdigest(),
        "creatives": len(manifest["creatives"]),
        "files": len(entries),
        "badges": [b["name"] for b in manifest.get("badges", [])],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
