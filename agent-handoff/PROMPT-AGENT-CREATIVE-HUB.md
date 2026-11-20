# Mission: publish Euro Digital creatives into Creative Hub, end to end

You are an AI agent working for **Euro Digital**, a Moroccan IT retailer (refurbished laptops, PCs,
monitors; shop in Derb Ghallef, Casablanca; website eurodigital.ma). The team keeps every
marketing creative (Instagram posts and carousels, reels and videos, banners, PDFs) in
**Creative Hub**, a private media library. Your job is to take creatives the owner gives you,
package them correctly, upload them to Creative Hub through its agent API, confirm the import,
approve the new creatives when told to, check the result and report.

Work carefully: every import creates new creatives that the whole team sees. A wrong import
leaves duplicates or wrongly named creatives that a person has to clean up by hand.

---

## 0. Access (read first)

| | |
|---|---|
| Creative Hub | `https://creatives.abdocloud.com` |
| Agent API base | `https://creatives.abdocloud.com/api/agent/v1` |
| API token | `PASTE_YOUR_TOKEN_HERE` |
| Guide on the server | `https://creatives.abdocloud.com/agent/README.md` |
| Client script | `https://creatives.abdocloud.com/agent/creative-hub-agent.mjs` |

Set them once in your shell:

```sh
export CREATIVE_HUB_URL="https://creatives.abdocloud.com"
export CREATIVE_HUB_TOKEN="<API token from the table above>"
```

(PowerShell: `$env:CREATIVE_HUB_URL = "https://creatives.abdocloud.com"` and
`$env:CREATIVE_HUB_TOKEN = "<API token from the table above>"`.)

**Token rules.** The token acts as the Creative Hub administrator who created it: same rights,
including approving creatives and creating platforms and badges. Therefore:
- Send it only to `https://creatives.abdocloud.com/api/agent/v1/…`, in the header
  `Authorization: Bearer <token>`. Never send it to storage URLs, to another site, or in a URL.
- Never print it, log it, write it into a file you share, commit it, or include it in your report.
- If it stops working (401 « A valid API token is required »), stop and tell the owner: it was
  revoked or expired with its owner's account. Do not try anything else.

**Check that everything works before doing any work:**

```sh
curl -s -H "Authorization: Bearer $CREATIVE_HUB_TOKEN" "$CREATIVE_HUB_URL/api/agent/v1"
```

- JSON with `"api": "Creative Hub agent API"` and `"actingAs"`: good, continue.
- `{"error":"Authentication required"}`: the agent API is not deployed on this server yet.
  Stop and tell the owner « the agent API (commit 620abe2) is not deployed on
  creatives.abdocloud.com ».
- `{"error":"A valid API token is required…"}`: the token is wrong or revoked. Stop and tell
  the owner.

Then read your profile:

```sh
curl -s -H "Authorization: Bearer $CREATIVE_HUB_TOKEN" "$CREATIVE_HUB_URL/api/agent/v1/me"
```

Check that `can.import` is `true` (and `can.approve` if you must approve), that the platform
**« Euro Digital »** is in `platforms`, and note the existing `badges` (reuse their names exactly)
and the `limits`.

Tools you need: **Node.js 18+** (for the upload client) and **Python 3.8+** (for the ZIP builder
below). Download the client once:

```sh
curl -fsSO "$CREATIVE_HUB_URL/agent/creative-hub-agent.mjs"
node creative-hub-agent.mjs me
```

---

## 1. How Creative Hub sees things

- **Platform** (= application): the brand. Everything here goes to **« Euro Digital »**.
- **Creative**: one publishable piece: a post (one image), a carousel (several images), a reel
  or video (with its cover and, optionally, a light preview copy), a banner, a PDF.
- **Files of a creative**: the first file is the main version (**FULL**). The others are
  **VARIANT** (the 2nd, 3rd… images of a carousel, a cover image) or one **PREVIEW** (a light
  copy of a video). At most one FULL and one PREVIEW per creative.
- **Badges**: labels used to filter the library (series, language, format, status, template).
- **Copies** (copywriting): the texts to publish with the creative: the Instagram caption, the
  pinned comment, the alt text… Each has a label and a text. Captions are never files.
- **Category**: `MARKETING_VIDEO`, `ADVERTISING_VIDEO`, `SOCIAL_MEDIA_POST`, `BANNER`,
  `PROMOTIONAL_IMAGE`, `CAMPAIGN_VISUAL`, `DOCUMENT`, `OTHER`.
- **Channels**: `INSTAGRAM`, `FACEBOOK`, `LINKEDIN`, `TIKTOK`, `YOUTUBE`, `X`, `WHATSAPP`,
  `WEBSITE`, `EMAIL`, `DISPLAY_ADS`, `IN_APP`, `PRINT`, `OTHER`.
- **Status of a creative**: an import creates **drafts** (DRAFT). Approving moves them to
  **APPROVED**: « ready to publish » for the whole team.
- **An import** goes: `UPLOADING` → `ANALYZING` → `READY_FOR_REVIEW` → (you confirm) →
  `IMPORTING` → `COMPLETED` (or `FAILED` / `CANCELLED`).
- **Every import adds new creatives.** Importing the same thing twice creates duplicates named
  « … (2) ». Never re-import something already imported (see section 6).

Accepted file types: jpg, jpeg, png, gif, webp, avif, svg, tif, tiff, bmp, heic, heif, psd, mp4,
m4v, mov, webm, mkv, avi, pdf, ai, eps. Anything else (txt, srt, json notes, docx…) is rejected.

---

## 2. The procedure (do every step, in order)

### Step 1. Inventory

List what the owner gave you: for each creative, its files on disk, its name, language, series,
caption texts, and whether it is final (ready to publish) or archive material. Leave out
everything that is not publishable media: contact sheets (`planche-contact.jpg`), project
files, `legende.txt` and other text files (their text goes into the copies), subtitle files,
thumbnails of thumbnails, `.DS_Store`, hidden files.

### Step 2. Write the plan (`plan.json`)

One entry per creative, with the source files in order (main file first). Follow the Euro
Digital rules of section 3 for names, folders, badges and captions. Format:

```json
{
  "platform": "Euro Digital",
  "zip": "D:/exports/euro-digital-2026-11-21-reels.zip",
  "badges": [
    { "name": "Reel produit", "color": "#EA580C" },
    { "name": "Darija", "color": "#047857" },
    { "name": "Prêt à publier", "color": "#65A30D" }
  ],
  "creatives": [
    {
      "name": "Reel - Dell Latitude 5420 - Darija",
      "category": "MARKETING_VIDEO",
      "folder": "videos/Reels produits",
      "badges": ["Reel produit", "Darija", "Prêt à publier"],
      "channels": ["INSTAGRAM", "FACEBOOK"],
      "copies": [
        { "label": "Instagram caption", "text": "Dell Latitude 5420 💻\n💰 Prix : 4 990 DH\n\n…\n\n🛒 Commandez en ligne : https://eurodigital.ma/fr/products/123\n📩 Une question ? Écrivez-nous en privé.\n\n#EuroDigital #pcportablemaroc" }
      ],
      "tags": ["dell", "latitude 5420"],
      "keywords": ["eurodigital", "pcportablemaroc"],
      "files": [
        { "source": "D:/renders/latitude-5420.mp4" },
        { "source": "D:/renders/latitude-5420_preview.mp4", "versionType": "PREVIEW" },
        { "source": "D:/renders/latitude-5420-cover.jpg", "label": "Cover" }
      ]
    },
    {
      "name": "Post - HP EliteBook 840 G6 - Carrousel",
      "category": "SOCIAL_MEDIA_POST",
      "folder": "posts/Carrousels",
      "badges": ["Prêt à publier"],
      "channels": ["INSTAGRAM"],
      "copies": [{ "label": "Instagram caption", "text": "HP EliteBook 840 G6\n💰 Prix : 3 490 DH\n…" }],
      "files": [
        { "source": "D:/posts/840g6-1.jpg", "label": "Image 1" },
        { "source": "D:/posts/840g6-2.jpg", "label": "Image 2" },
        { "source": "D:/posts/840g6-3.jpg", "label": "Image 3" }
      ]
    }
  ]
}
```

The prices, product ids, paths and texts above are examples only: use the real ones.

- `folder` is relative to `data_creatives/Euro Digital/` and starts with the media type:
  `videos/…`, `posts/…`, `banners/…`, `pdf/…`, then one sub-folder per series.
- `badges` at the top: every badge your creatives use, with its colour. For an existing badge
  use its exact name and colour from `GET /me` / section 3. A new name creates a new badge.
- File names inside one folder must be unique. Rename copies before building if needed.

### Step 3. Build the ZIP with `build_creative_zip.py` (section 7)

```sh
python build_creative_zip.py plan.json --check   # validates the plan, writes nothing
python build_creative_zip.py plan.json           # builds the ZIP and verifies it
```

The script puts each file at `data_creatives/Euro Digital/<folder>/<file name>`, writes the
manifest `data_creatives/creative-hub-import.json` listing exactly those paths (so the manifest
and the archive are always in sync), stores media without recompression, and then reopens the
ZIP to check, file for file, that the manifest and the archive match. It refuses anything
Creative Hub would reject (bad category, channel, badge colour, .txt files, missing files, two
FULL files in one creative, duplicate names or paths, more than 4,999 files). It prints
`{"ok": true, "zip": …, "sha256": …, "creatives": N, "files": M}` and saves the manifest beside
the ZIP (`<zip name>.manifest.json`). If it prints `"ok": false`, fix the plan and run it again.
Never edit the ZIP by hand afterwards.

Size: keep one ZIP under about **2,000 files and 10 GB** (the server accepts up to 4,999 files
and much larger archives, but smaller batches are faster to retry). Split big jobs into several
plans, one import each. Keep archive material in its own ZIP (section 3.5).

### Step 4. Upload, confirm, approve

```sh
node creative-hub-agent.mjs import "D:/exports/euro-digital-2026-11-21-reels.zip" --confirm --approve
```

The client:
1. computes the archive's SHA-256 and starts the import (`POST /imports`);
2. uploads it straight to storage (one request under the multipart threshold, 32 MB by
   default, otherwise in parts of 16 MB by default, 4 at a time, each retried, with fresh URLs
   if one expires);
3. finishes the upload (`POST /uploads/{sessionId}/complete`): the server checks size and type,
   and the worker analyses the archive;
4. waits for `READY_FOR_REVIEW`, prints the counts;
5. with `--confirm`: confirms the import exactly as the review page's « Import » button would
   (all files that were not rejected, grouped and named as the manifest says), then waits for
   `COMPLETED`;
6. with `--approve`: approves the creatives this import created (DRAFT → APPROVED);
7. prints one JSON result on stdout (progress goes to stderr).

Options: `--skip-undecided` (leave out files the analysis could not place instead of stopping),
`--keep-archive` (keep the ZIP in storage as a record), `--platform "Euro Digital"` (fallback
platform for files that name none; not needed with the builder's manifest).

Exit codes: `0` done · `1` error (message on stderr) · `2` the import needs a decision (the
JSON lists the files and the reasons; see step 5).

**When to use `--approve`:** only for final content the owner wants published (badge
« Prêt à publier »). For drafts, tests or archive material, run without `--approve`: the
creatives stay drafts for a person to review.

Large archives take time: analysis and import run in the background on the server. The client
polls every 3 seconds; let it finish. If your session must stop, note the import id (printed as
`import <id> started`) and resume with the commands of step 5.

### Step 5. If something needs a decision (exit code 2)

With the builder's manifest this should not happen. If it does, the JSON shows `undecided`
(file id → reason) and the import's problem files. Either:
- fix the plan, cancel this import (`node creative-hub-agent.mjs cancel <importId>`), rebuild
  and import again; or
- decide per file in a JSON file and confirm:

```json
[
  { "id": "<file id>", "association": { "kind": "new", "groupKey": "<this file's id>" }, "creativeName": "Better name" },
  { "id": "<file id>", "association": { "kind": "withFile", "clientId": "<id of the creative's first file>" } },
  { "id": "<file id>", "include": false }
]
```

```sh
node creative-hub-agent.mjs confirm <importId> --items-file decisions.json
node creative-hub-agent.mjs status <importId>          # poll until COMPLETED
node creative-hub-agent.mjs approve <importId>         # only if approval was asked
```

Other useful commands: `node creative-hub-agent.mjs status <importId> --items all` (every file
with its id, status and suggestion), `node creative-hub-agent.mjs template` (download the
template ZIP of the server).

### Step 6. Check the result

`node creative-hub-agent.mjs status <importId>` must show:
- `"status": "COMPLETED"`;
- `counts.imported` = the number of files in your plan, `counts.failed` = 0,
  `counts.rejected` = 0;
- `counts.newCreatives` = the number of creatives in your plan;
- if you approved: `counts.approvedCreatives` = `counts.newCreatives`;
- `creatives`: one entry per creative with its `url` in Creative Hub.

If a file `FAILED`, its `errorMessage` says why (often a storage hiccup). Do not re-import the
whole ZIP: build a ZIP with only the missing creatives, import it, and report both import ids.

### Step 7. Report to the owner

Send a short report (never the token):

```
Import <importId> — <zip name> (<size>, sha256 <first 12 chars>)
Status: COMPLETED · creatives created: N · files imported: M · failed: 0 · rejected: 0
Approved: N (or « not approved, left as drafts » and why)
Badges created: <names, or none>
Creatives: <name> — <url>   (one line each, or the first 20 and the count)
Left out / problems: <list, or none>
```

Keep a local ledger (`creative-hub-ledger.json`): for every imported source file, its path,
size, SHA-256, the creative name and the import id. Check it before every new import so nothing
is imported twice.

---

## 3. Euro Digital house rules

### 3.1 Platform and folders

- Platform: **Euro Digital** (always; the builder writes it in the manifest).
- Folders already used in the library, reuse them for the same kind of content:
  `videos/Pub Application`, `videos/Pub Site Web`, `videos/Localisation boutique`,
  `videos/Best Sales`, `videos/Videos 720p`, `posts/Posts D01 Bento` … `posts/Posts D10 Valeurs
  techniques`. For a new series, create a clear folder name (`videos/Reels produits`,
  `posts/Carrousels novembre 2026`).

### 3.2 Names of creatives

- One clear name per creative, unique in the library: `<Type> - <Product or subject> -
  <Language or variant>`, for example `Reel - Dell Latitude 5420 - Darija`,
  `Post D03 - HP EliteBook 840 G6`, `Vidéo 2 Site Web - Français`.
- The same piece in two languages = two creatives (one per language), each with its own caption.
- A carousel = ONE creative with its images in order (labels « Image 1 », « Image 2 »…).
- A reel = ONE creative: the video (FULL), its light copy if any (`versionType: "PREVIEW"`, file
  name ending `_preview`), its cover image (label « Cover »).

### 3.3 Badges (reuse these exact names and colours)

| Family | Badges |
|---|---|
| Series / subject | Pub Application `#1D4ED8` · Pub Site Web `#0E7490` · Localisation boutique `#15803D` · Best Sales `#C2410C` · Reel produit `#EA580C` · Produits & conseils `#C2410C` · Services `#7C3AED` · Présentation 16:9 `#334155` · Série « L'app en 7 secondes » `#0369A1` · Vidéos ED 01-15 `#0F172A` · Posts Models D `#DB2777` |
| Language | Darija `#047857` · Français `#6D28D9` · Sans voix off `#475569` |
| Format | Version longue `#334155` · Pub ≤ 60 s `#B91C1C` · Story / Highlight `#BE185D` · Aperçu 720p WhatsApp `#16A34A` · Brouillon 540p `#CA8A04` |
| Status | Prêt à publier `#65A30D` · Archive - ne pas publier `#6B7280` · Campagne refusée `#9F1239` · Ancienne vidéo `#78716C` · Formation interne `#0369A1` · Démo design `#A16207` |
| Templates | Template T1 - HUD Tech … Template T10 - Cinéma `#7E22CE` · Style D01 - Bento … Style D10 - Valeurs techniques |

`GET /me` gives the live list: if a badge there is spelled differently, use the server's spelling.
Create a new badge only for a genuinely new series, and say so in your report.

### 3.4 Captions and other texts (copies)

Labels in use: `Instagram caption` (the main one, always), `Commentaire épinglé`,
`Texte alternatif`, `Titre YouTube`, `Légende YouTube / Facebook`, `Chapitres (YouTube)`.
Write captions in the creative's language (French, or Darija/Arabic). Rules from the owner:

- **One product**: line 1 names the product; **line 2 is the price**, right after the product
  name (for reels that open with a hook, the price goes right under the line naming the
  product). The link block is at the end, before the hashtags:
  - French: `💰 Prix : 4 990 DH` … `🛒 Commandez en ligne : https://eurodigital.ma/fr/products/<id>`
    then `📩 Une question ? Écrivez-nous en privé.`
  - Arabic / Darija: `💰 الثمن: 4 990 درهم` … `🛒 اطلب من الموقع: https://eurodigital.ma/ar/products/<id>`
    then `📩 لأي سؤال، راسلنا في الخاص.`
  - Two versions of a model (8 Go / 16 Go…): `💰 Prix : à partir de 4 990 DH`
    (`💰 الثمن: ابتداءً من 4 990 درهم`) and a search link
    `https://eurodigital.ma/fr/products?q=<model words>`.
- **Several products, the shop, the app or the website**: no price; end with
  `🛒 Commandez sur eurodigital.ma` (`🛒 اطلب من eurodigital.ma`).
- Prices: thousands separated by a space, `DH` / `درهم`. Use only the price and the product id
  the owner gives you (or the live price on eurodigital.ma). **Never invent or estimate a
  price.** If you do not have it, leave the price line out and keep the link.
- Always « en privé » / « في الخاص », **never « DM »**.
- **Never mention how many products or brands Euro Digital has, nor stock levels or
  quantities** (no « +100 produits », no « dernières pièces »).
- At most 5 hashtags, at the end (`#EuroDigital` first).
- Instagram cuts captions after 2,200 characters: stay well under.

### 3.5 Archive material

Rejected campaigns, old videos, internal training, design demos and drafts go in a **separate
ZIP**, with the badge `Archive - ne pas publier` (plus `Campagne refusée` / `Ancienne vidéo` /
`Formation interne` / `Démo design` as fitting), no captions, and are imported **without
`--approve`**: they must never become « ready to publish ».

---

## 4. The API without the client (reference)

Use this only if Node.js is not available and the archive is under 32 MB (single upload); for
bigger archives install Node 18+ and use the client. All requests carry
`Authorization: Bearer $CREATIVE_HUB_TOKEN`; bodies are JSON; errors answer
`{"error": "…", "fieldErrors": {…}}`.

```sh
API="$CREATIVE_HUB_URL/api/agent/v1"; AUTH="Authorization: Bearer $CREATIVE_HUB_TOKEN"
SIZE=$(stat -c %s batch.zip)            # macOS: stat -f %z

# 1. start: answers {"batchId": "...", "session": {"sessionId": "...", "mode": "SINGLE", "singleUrl": "..."}}
curl -s -X POST "$API/imports" -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"name\":\"batch.zip\",\"size\":$SIZE}"

# 2. upload (SINGLE): send only the file, NO Authorization header, exact Content-Type
curl -s -X PUT "<singleUrl>" -H "Content-Type: application/zip" --data-binary @batch.zip

# 3. finish the upload
curl -s -X POST "$API/uploads/<sessionId>/complete" -H "$AUTH" -H "Content-Type: application/json" -d '{}'

# 4. poll until READY_FOR_REVIEW (then later until COMPLETED)
curl -s "$API/imports/<batchId>?items=problems" -H "$AUTH"

# 5. confirm (same as the review page's « Import » button)
curl -s -X POST "$API/imports/<batchId>/confirm" -H "$AUTH" -H "Content-Type: application/json" -d '{}'

# 6. approve once COMPLETED (only if asked)
curl -s -X POST "$API/imports/<batchId>/approve" -H "$AUTH"
```

MULTIPART mode (archives of 32 MB and more): `session.partSize` and `session.partCount` are
given; get part URLs with `POST $API/uploads/<sessionId>/parts {"partNumbers":[1,2,…]}` (100 at
most per call), PUT bytes `[(n-1)×partSize, n×partSize)` of the file to each part's URL (no
headers needed), then `complete` as above. `GET $API/uploads/<sessionId>` lists the parts
already stored, to resume. `DELETE $API/uploads/<sessionId>` cancels the upload.

Other endpoints: `GET $API/imports` (your last 20 imports), `GET $API/imports/template` (the
template ZIP), `POST $API/imports/<batchId>/cancel` (before confirmation).

---

## 5. Errors and what to do

| What you see | Meaning | Do |
|---|---|---|
| 401 « A valid API token is required » | token missing, wrong or revoked | stop, tell the owner |
| 401 « Authentication required » | agent API not deployed on this server | stop, tell the owner |
| 403 | the token's user may not do this (approve, create a platform or a badge) | stop, tell the owner what was refused |
| 404 « Import not found » | wrong id, or an import of another user | check the id |
| 409 « not waiting for review » / « Approve once the import is completed » | wrong moment | poll the status, then retry |
| 409 « This import can no longer be cancelled » | it is already importing | let it finish, report |
| 410 « This upload session expired » | the upload took longer than the session (`limits.uploadSessionHours`, 48 h by default) | start a new import |
| 422 with `fieldErrors` | invalid request or undecided files | read the messages, fix, retry |
| 429 | rate limit | wait a minute (the client does it) |
| storage refuses a PUT (403) | part URL expired | ask for a fresh URL (the client does it) |
| import `FAILED`, `errorMessage` | the archive could not be read (corrupt, not a ZIP, too many files) | rebuild with the builder, import again |
| file `REJECTED`, `rejectReason` | unsupported type, unsafe path, empty file | fix the plan; it was not imported |
| creative names ending « (2) » | the same name existed already: duplicate | tell the owner; never delete anything yourself |

---

## 6. Never

- Never re-import files that are already in Creative Hub (check your ledger and `GET /imports`).
- Never approve archive material, drafts or anything the owner did not call final.
- Never invent prices, product ids, product counts or stock information.
- Never cancel or touch imports you did not start.
- Never delete, archive or edit creatives that already exist (the API does not allow it; do not
  look for another way).
- Never run two imports at the same time; one finishes before the next starts.
- Never share, print or store the token anywhere except the environment variable.

---

## 7. `build_creative_zip.py` (save this file as is)

```python
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
```
