# Quran Video Studio: complete documentation

This document gives the whole vision, every rule, every tool and the full production method. It is written for
the owner and for the AI agent (Claude Code, local or cloud) that continues the work. If anything here conflicts
with an older document, **this one wins**. The other docs go deeper into one topic:
- [STORYBOARD_GUIDE.md](STORYBOARD_GUIDE.md): how to write a storyboard;
- [PIPELINE.md](PIPELINE.md): the verifier's checks, in detail;
- [STUDIO.md](STUDIO.md): the local web app.

---

## 1. Vision

The goal is short, beautiful, **animated** vertical videos (9:16, for Instagram Reels, TikTok and YouTube Shorts)
for **every passage of the Quran**, surah by surah, from Al-Fatiha to An-Nas. Each video shows:

1. **A cover frame**, which is the first frame and the thumbnail: the series or story name, the video's title,
   the surah and verse range, and the reciter, over a picture from the video.
2. **An animated illustration** in a rounded frame. Stories are told with symbolic flat-vector motion graphics:
   - faceless people;
   - prophets, angels and honoured people as labelled lights.

   Non-narrative passages get abstract motion graphics: light, nature, geometry, animated symbols. Something is
   always moving.
3. **The verse card:** the Quranic text exactly as in the Mushaf (Uthmani script, Scheherazade New font). Each
   word lights up in gold as the reciter says it.
4. **The English translation** (Saheeh International), revealed in step with the recitation.
5. **Short tafsir explanations** that pop up on key words. They are exact quotes from Tafsir al-Muyassar or
   Tafsir as-Sa'di, with an arrow into the picture.
6. **An outro** with the surah, the verses, the reciter and the credits.

The reciter for the whole project is **Yasser ad-Dussary · ياسر الدوسري** (QF recitation id 97). Recitations, text,
timings and tafsir come from the **Quran Foundation** dataset (quran.com). Finished videos are uploaded as
**drafts** to the owner's **Creative Hub** (platform **« Coran »**), where a person reviews and approves them
before anything is posted publicly.

**The most important thing is accuracy.** A single mistake in the Quranic text, the recitation, the
highlighting, a translation line, an explanation or the story is unacceptable. Everything in this project
exists to make mistakes impossible, or to catch them before a human sees the video.

---

## 2. Non-negotiable rules

### 2.1 The Quran text
- **Never type, paste, generate or "correct" Quranic text.** Verse text, words, verse numbers, translation, tafsir
  and timings come only from the API data (`data/<id>/source.json`) and are drawn exactly as received.
  Storyboards refer to words by `[verse, word position]` only.
- Every verse is cross-checked against a second, independent source (Tanzil Uthmani via alquran.cloud). Only the
  documented encoding equivalences are tolerated (see PIPELINE.md). Any other difference blocks the video.
- Any new special mark or font change needs **visual proof**: render it and look at it. Amiri Quran was rejected
  for this reason. Scheherazade New must stay the Quran font unless a new font passes
  `renderer/tests/shaping3.html`.
- Captions, titles and descriptions only **reference** a passage (surah name and verse numbers). They never
  contain verse text.

### 2.2 The recitation and the highlight
- Only reciters whose word timings are complete for the verses used. `pipeline/audit_surah.py` checks every
  verse. Words without timing, extra words, order problems and overlaps all block a video.
- Audio is cut only inside a real, measured pause. A video **never** starts or ends at a boundary where the
  reciter joins two verses (`JOINED` in the audit).
- Verse changes in the timing data that sit while the reciter is still sounding are moved onto the measured pause
  (`pipeline/align.py`). Every move is listed on the review sheet.
- Implausibly short word timings (`timing_flags`, under 150 ms for a long word) are listed for a person to check
  by ear. Never "fix" a word timing by guessing. Known errors may be corrected only with an explicit, guarded
  `timing_corrections` entry that a person confirms by ear (example: 26:63 with Alafasy).

### 2.3 Explanations (glosses)
- An explanation is a **character-for-character** excerpt of the cited tafsir for that verse. It may not contain:
  - a `{…}` or `﴿…﴾` quotation;
  - two consecutive words of the passage's verses;
  - a fully vocalised Quran word.

  It is at most 64 characters. The verifier enforces all of this.
- **It must keep its meaning when cut out.** Never drop a negation or a condition («إن فعلتم ذلك»). Never show a
  disbeliever's claim on its own, as if it were a statement. Never let a first-person paraphrase of Allah's words
  read like a quotation. Never let an excerpt take a side where the tafsirs differ: al-Khidr's status, the number
  of the sleepers, who surges in 18:99, the meaning of al-Firdaws.
- Every series of explanations gets an **independent review** before it is built (section 9.6).

### 2.4 Pictures (adab)
- **Allah** is never depicted in any form: not as a light, a figure or a voice source.
- **Prophets** appear only as **blue light drops** with a name label. **Angels** appear only as **gold light
  drops**.
- **Honoured people, or anyone whose status scholars dispute**, appear only as **green light drops** with a name:
  Maryam, the Mothers of the Believers, al-Khidr, Yusha' bin Nun and Dhul-Qarnayn. A hadith reports the Prophet ﷺ
  saying «ما أدري ذا القرنين أنبيًّا كان أم لا».
- Ordinary people are **always faceless**. No eyes, no facial features, ever, in any image or extra file.
- **The unseen is never illustrated literally:** Paradise, Hell, the Day of Judgement, the Throne, jinn, Iblis and
  the grave. Use calm or abstract motion graphics.
- **No violence is shown:** killing, punishment of individuals, blood.
- **Never show a countable group where the Quran leaves the number to Allah.** For example, the sleepers of the
  cave: use the `sleepers` actor or `uncountable: true`.
- Nothing historically misleading. No pyramids outside Egypt. Gog and Magog are never drawn; Al-Muyassar describes
  them as two great nations of the children of Adam, not monsters.
- No text inside the art except the name labels of the light drops.

### 2.5 Titles and covers
- Chapter titles and cover titles are UI text: 2–4 words of Modern Standard Arabic with no diacritics. They never
  repeat two consecutive Quran words; the verifier checks this against the passage. Avoid famous Quran phrases
  from other verses too. A story's well-known name, like أصحاب الكهف, is allowed as a series name.
- Watch modern meanings: «رحلة المغرب» reads as "trip to Morocco", so use «الرحلة غربا».

### 2.6 Human review is mandatory
No video is ever made public by the agent. The agent uploads **drafts** with their review sheet. **Never use
`--approve`.** A person who reads Quranic Arabic watches every video, ticks every verse, listens at every flagged
moment, and approves it in Creative Hub.

### 2.7 Secrets
- `.env` is never committed. `CREATIVE_HUB_TOKEN` lives only in environment variables.
- Never print, log, write to a file, commit or send the token anywhere except
  `https://creatives.abdocloud.com/api/agent/v1/…` in the `Authorization: Bearer` header.

---

## 3. How a video is built

```
fetch_data.py ──► source.json (verses, words, translation, tafsir 16 & 91, recitation + word timings, neighbours)
       │
storyboard/<id>.json  ◄── written by hand (Claude Code) following STORYBOARD_GUIDE.md: chapters, scenes, beats,
       │                  motifs, events, glosses, cover. Never Quran text, only [verse, word] references.
verify.py ──► verify_report.md   (blocks on ANY failure: text vs Tanzil, timings, scenes, glosses, titles, fonts)
       │
prepare.py ──► align.py (verse boundaries → real pauses) ─► render_data.json + audio_master.wav (-14 LUFS)
       │
renderer (headless Chrome, every frame = f(t)) ──► MP4 1080×1920 30 fps H.264/AAC
       │
produce.py build ──► cover.jpg (first frame), 720p preview, review sheet PDF, release.json
       │
publish_hub.py ──► Creative Hub ZIP (platform « Coran », drafts) ──► publish/ledger.json
```

| Step | Command (Linux: `.venv/bin/python -I -X utf8`; Windows: `.venv/Scripts/python -I -X utf8`) |
|---|---|
| Investigate a surah | `python pipeline/audit_surah.py <n> --reciter 97` |
| Read a passage (words, timings, tafsir) | `python pipeline/brief.py <id>` (or `_analysis/<n>_r97` for the whole surah) |
| Create a project | `python pipeline/produce.py new <n> <from> <to> --reciter 97` |
| Check a storyboard | `python pipeline/verify.py storyboard/<id>.json` (must print `PASSED`) |
| Build everything | `python pipeline/produce.py build <id>` |
| Look at frames | `node renderer/render.mjs sheet --data data/<id>/render_data.json --from 0 --to 60 --n 12 --cols 6 --out out/wip/x.png` |
| Gloss review dump | `python pipeline/gloss_audit_dump.py "<n>_*_r97" > out/wip/gloss_review_<n>.md` |
| Publish drafts | `python pipeline/publish_hub.py plan <n>` then `python pipeline/publish_hub.py upload <plan.json>` |
| Progress | `python pipeline/produce.py status <n>` · `python pipeline/progress.py` |

Project ids are `<chapter>_<from>-<to>_r97`, for example `18_17-18_r97`.

---

## 4. Data sources and what we learned about them

| Source | Use | Notes |
|---|---|---|
| `api.quran.com/api/v4` (Quran Foundation dataset) | text (word-level `text_uthmani`), translation 20 (Saheeh International), tafsir 16 (Al-Muyassar) and 91 (As-Sa'di), chapter recitations with word segments | Needs the User-Agent `quran-video-builder/0.1`; Cloudflare blocks Python's default. The QF OAuth credentials in `.env` are **pre-live only** (surahs 1–2). The public API serves the same dataset. |
| `api.alquran.cloud` (Tanzil Uthmani) | second source for every verse | It prefixes the basmala to verse 1 of surahs other than 1 and 9. `verify.py` strips it using Tanzil's own 1:1 text, exact match only. |
| `download.quranicaudio.com` | full-chapter MP3s | Cached in `data/_audio/`. |

QF text facts:
- The verse-level field can drop the small high/low meem (U+06E2/U+06ED) or space the sakt sign (ۜ) differently
  from the word-level field. We always draw the word-level text, which is identical to Tanzil.
- The Saheeh translation contains ﷺ. The English line falls back to Scheherazade New for it.

Reciters with word timings (`data/catalog.json`): Alafasy 7, Abdul Basit 2 and 1, Sudais 3, Shatri 4, Rifai 5,
Husary 6, Minshawi 9, Shuraym 10, **Dussary 97**, Tunaiji 161.

**Dussary findings (Al-Kahf):**
- **Word timings are structurally complete for all 110 verses.**
- **At about 37 verse boundaries the timing data is 0.2–0.6 s off the real pause.** Alignment fixes this.
- **He sometimes joins verses without pausing** (18:23→24, 46→47, 65→66). That is why 45–46 and 47–49 became one
  video.
- **One implausibly short word timing:** 18:49, word 4, 80 ms. Check it by ear.

Expect similar findings in every surah. **Always run the audit first.**

---

## 5. The verifier (`pipeline/verify.py`)

Exit code 1 means the video must not be made. It checks:
- **text:** against Tanzil, word positions, QF field consistency;
- **audio:** every word timed, order, no overlap with neighbouring verses, the reciter and file;
- **storyboard:** chapters cover every verse once, in order;
- **scenes:** against the scene catalog, including actors, labels, events and the settings they need, beats and
  titles;
- **glosses:** verbatim, no quotation or Quran bigram, tone, arrow target, at least 1 s apart;
- **resources:** the translation and tafsir ids;
- **fonts:** every drawn code point exists in its font, with the documented fallback;
- **cover.**

The full table is in PIPELINE.md. `--json` gives a dry run without writing the report. **Never weaken a check to
make a video pass.** Fix the storyboard, choose different verses, or ask the owner.

---

## 6. Audio alignment (`pipeline/align.py`, run by `prepare.py`)

At every verse boundary in the passage, plus the ones just before and after it, the timing gap must lie inside a
real pause:
- at least 140 ms long, measured on a 60 ms-smoothed envelope;
- below −30 dBFS, or below −26 dBFS when the pause is filled by room echo.

If it does not, the boundary moves onto the nearest pause within 0.8 s. A stop consonant's closure (50–100 ms) is
never mistaken for a pause. If no pause exists at the passage's first or last boundary, `prepare.py` refuses:
choose another range. `render_data.aligned_boundaries` and `timing_flags` reach the review sheet and the app.

---

## 7. The renderer

`renderer/index.html` + `renderer/js/main.js` draw one 1080×1920 frame as a pure function of time. There is no
randomness, no clock and no state, so any frame can be rendered alone. `render.mjs` drives headless Chrome
(through `renderer/browser.mjs`: `CHROME_PATH`, then Chrome, then Playwright Chromium) and pipes JPEG frames to
ffmpeg (libx264 crf 17, yuv420p, bt709, AAC 192 kbit/s).

**Layout:**
- the logo;
- the chapter title pill, which morphs between chapters;
- the scene frame (960×870, a rounded squircle);
- the verse card with its badge, which flips per verse;
- the translation;
- the chapter dots, running right to left;
- the outro.

**The verse card:**
- Long verses are **paged**: at most 3 lines per page, breaking at waqf signs, with the translation split at
  sentence ends.
- The active word glows gold.
- Repetitions by the reciter re-activate earlier words.

**The cover:** for the first 1.0 s the frame shows the scene frozen at `cover.at`, with the series in the pill and,
below it:
- the big title (Lalezar, up to 2 lines);
- the English subtitle;
- the surah and verses;
- the reciter.

It then dissolves into the video. Every video has a cover; the export saves it as `cover.jpg`.

**Scenes** (`renderer/js/`):
- `scenes.js` and `scenes_musa.js`: hand-made scenes for the two first productions (15:57–77, 26:60–68);
- `scenes_lib.js`: the **generic library**:
  - `ambient`: 8 moods;
  - `stage`: 11 settings × 4 times of day, about 20 actor types including the Al-Kahf pack, 23 events, poses,
    and `uncountable` groups.

  The contract is `renderer/js/scene_catalog.json`, enforced by `verify.py`.

**Beats** (`params.beats`) are small timed actions on words:
- camera: wide, close, sky, ground, pan, push-in;
- actors: speak, turn, point, raise_hands, bow, walk_to, sit, stand_up, glow…;
- scene: birds, wind, sparkle, clouds, leaves;
- ambient: light, stars, rain, bloom, wither, waves, pattern_turn, ink_waves.

The renderer adds automatic camera reframes wherever nothing happens for 5 s.

---

## 8. Motion graphics v3 (REQUIRED before mass production)

The owner's direction: **every video must be motion graphics, animated and interactive**. Several calm videos
today show a mostly static background with gentle drift. That is not enough. Before producing new surahs, extend
the system as follows. Then upgrade the 33 Al-Kahf storyboards, and every later storyboard must use it.

### 8.1 Motifs: animated symbolic illustrations (new contract `params.motifs`)
- **Format:** `params.motifs = [{"at": [v, w], "until": [v, w] | null, "motif": "<id>", "place": "center|left|right|top|bottom", "size": "s|m|l"}]`
- **What a motif is:** a line-art or flat icon that **draws itself on** (stroke animation, 0.6–1.2 s), then
  *lives* (breathes, rotates, particles, glow), then **transforms or leaves** (morph, dissolve, fly out). It is
  tied to the word that names the concept.
- **Starting library** (extend it freely; always faceless, no prophets, angels or Allah):
  - book, scroll, pen and ink, scales, hourglass, two paths;
  - door, key, lamp, candle, sun, moon, crescent, stars;
  - cloud and rain, water drop, wave, seed → sprout → tree, falling leaf, mountain, wind lines;
  - coins and jewels (worldly adornment), crown (kingship), house, ship, fish, cave, the dog;
  - hands raised in du'a (hands only), chains broken (freedom, not punishment), sparkle or star burst (a sign);
  - a crowd silhouette that is uncountable.
- **Rules:**
  - never a face or eye;
  - no motif for Allah, nor for His attributes as a figure (use geometry and light);
  - nothing literal for the unseen. A flame motif may stand for worldly fire, never for Hell.
- Add every motif to `scene_catalog.json` and validate it in `verify.py`: id, place, size, word reference, and at
  least 0.8 s between motif starts.

### 8.2 Continuous motion
- Every layer is alive: deterministic particles (dust, light motes, leaves), parallax and drifting clouds,
  shimmering water, light sweeps, slowly rotating geometry.
- The acceptance rule: **in any 2-second window something visibly moves in the scene.** At least one motif or one
  event or beat every 4–6 s of recitation.

### 8.3 Designed transitions between chapters
- `params.transition` is one of `wipe`, `iris`, `light_sweep`, `morph`, `slide`, `page_turn`, or `dissolve` (the
  current default).
- Prefer **match cuts**: the motif that ends one chapter becomes the first shape of the next.

### 8.4 Kinetic UI typography (UI text only)
- Chapter titles may animate word by word: slide, scale, a light sweep across the pill.
- Gloss boxes may draw their border and type the excerpt in, word by word.
- The cover may animate in. Keep the first frame of the video a complete, still, beautiful thumbnail.
- **Never animate the Quranic text letter by letter or deform it.** The verse card keeps its exact Mushaf
  rendering and only the gold word highlight.

### 8.5 Style
- Keep the current visual identity: cream, navy and gold, flat vector, soft gradients, faceless figures, labelled
  lights.
- You may **introduce new styles and mix them**, as long as every rule in section 2.4 holds. Examples: paper-cut
  layers, line-art on dark navy, watercolour-like flat washes, Islamic geometric overlays, isometric scenes.
- Pick one style per video (or per series) and keep it consistent within the video.

### 8.6 Quality bar and process
- Build every new motif or transition in `renderer/tests/lib.html` / `lib_shot.mjs`, render contact sheets, and
  **look at them**.
- Keep each scene under about 15 ms per frame.
- Render a real video, then extract frames at 1 s spacing and check motion, legibility and the rules.
- Update STORYBOARD_GUIDE.md and the catalog in the same change.

---

## 9. Production method for one surah (repeat for every surah)

### 9.1 Investigate (never skip)
1. `python pipeline/audit_surah.py <n> --reciter 97`.
2. If **text mismatches Tanzil**, stop. Investigate character by character. Only a documented encoding
   equivalence may be added, and only with visual proof that both encodings render identically. Otherwise report
   it to the owner.
3. Note the timing defects, short-word flags and **JOINED** boundaries.
4. Read every verse with its translation and **both tafsirs**:
   `python pipeline/brief.py _analysis/<n>_r97`, or per project after `produce.py new`. Use Al-Muyassar and
   As-Sa'di to understand the stories, the people, and where scholars differ.

### 9.2 Plan the videos (`plans/<n>.json`)
- Split the surah into videos that follow its meaning: each story, episode or theme.
  - **20–120 s each**, 30–90 s ideal, at most 40 verses.
  - **Start and end only at "ok" or "aligned" boundaries**, never at JOINED ones. If a theme boundary is JOINED,
    merge the neighbouring videos.
  - Avoid verses with timing defects, or flag them clearly.
- Write `plans/<n>.json` in the format of `plans/18.json`:
  - `summary`, `reciter`, and `notes`: findings, cautions and scholarly differences;
  - `groups` (stories or themes), each with `videos`: `from`, `to`, `title_ar`, `title_en`,
    `visual` (`stage`/`ambient`), `care`, `est_s`.

  The plan **is** the answer to "how many videos can this surah give": record the number and the reasons.
- Titles follow section 2.5.

### 9.3 Create projects and write storyboards
1. Run `produce.py new <n> <from> <to>` for every planned video.
2. Write each storyboard by hand (STORYBOARD_GUIDE.md):
   - chapters, scenes, events, **beats**, **motifs**, transitions, glosses and cover;
   - story passages use `stage`; others use `ambient` plus motifs;
   - keep continuity across the videos of one story: setting, actors, labels.
3. `verify.py` must print `PASSED` for every storyboard.

### 9.4 Look before building
- Prepare: `produce.py build <id> --no-video`.
- Render contact sheets of each video, with frames at chapter starts, events and covers.
- **Look at them.** Fix anything that breaks a rule, reads badly or is static.

### 9.5 Build
`produce.py build <id>` produces the MP4, cover, preview, review sheet and `release.json`. Check with `ffprobe`:
1080×1920, 30 fps, H.264 + AAC 48 kHz. `loudnorm` should measure about −14 LUFS.

### 9.6 Independent review (before publishing a surah)
1. Run `python pipeline/gloss_audit_dump.py "<n>_*_r97" > out/wip/gloss_review_<n>.md`.
2. Give it to a **separate reviewer sub-agent** that did not write the storyboards. Ask it to flag:
   - meaning changes, wrong attachment and trivial glosses;
   - disputes stated as fact;
   - adab or content problems;
   - Arabic or English language errors in titles and covers.
3. Fix every serious item and re-verify. Keep the review in `data/_analysis/` (it is not committed) and summarise
   it in the surah's plan notes.

### 9.7 Publish drafts and record (section 11)
Run `publish_hub.py plan <n>`, then `upload`, then `progress.py`, then commit and push.

---

## 10. Extra creative files (recommended, optional)

Beside each video, the agent may make more publishable media for the same passage. All of it is **without faces**
and follows section 2. It may use the house style, a new style, or a mix.

| Extra | Size | Content | Creative Hub |
|---|---|---|---|
| YouTube thumbnail | 1280×720 JPG | the cover recomposed for 16:9 | variant of the video creative, label « YouTube thumbnail » |
| Instagram post | 1080×1350 JPG | key scene, title, surah and verses, one explanation | own creative, `SOCIAL_MEDIA_POST` |
| Carousel | 4–7 × 1080×1350 JPG | cover, then one slide per chapter (scene still + title + one verified explanation), then credits | ONE creative, images in order |
| Teaser | 9:16 MP4, 10–20 s | the most striking chapter, **whole verses only**, cut in real pauses | own creative, name starts « Teaser » |
| Story frames | 1080×1920 JPG | cover + 2 stills for Instagram Stories | variants or own creative |

**Rules:**
- Any Quranic text in an image is **rendered from the API data** with the same fonts and checked like the
  video, never typed.
- Text files (txt, srt, json) cannot be uploaded to Creative Hub. Captions go into the creative's **copies**.
- Add each extra to `release.json` and extend `publish_hub.py` so it is packaged correctly.

---

## 11. Publishing to Creative Hub (platform « Coran »)

Creative Hub (`https://creatives.abdocloud.com`) is the owner's private media library. Its agent API
(`/api/agent/v1`) imports a ZIP built by `tools/creative-hub/build_creative_zip.py`, using the client
`tools/creative-hub/creative-hub-agent.mjs`. `pipeline/publish_hub.py` wraps both.

**Conventions:**

| Item | Value |
|---|---|
| Platform | **Coran** (check it exists with `publish_hub.py check`; if it does not, the first import creates it. Say so in the report.) |
| Folder | `videos/<NNN> <Surah English name>`, e.g. `videos/018 Al-Kahf` |
| Creative name | `Reel - <ch>:<from>-<to> <Surah> - <Arabic title> - <Reciter>` |
| Category | `MARKETING_VIDEO` (social video) |
| Channels | INSTAGRAM, TIKTOK, YOUTUBE, FACEBOOK |
| Badges | `سورة <name>` `#0F766E` · series (cover `series_ar`) `#7C3AED` · reciter `#1D4ED8` · `Reel 9:16` `#BE185D` · `Needs review` `#CA8A04` |
| Files | MP4 (FULL) · `_preview.mp4` 720p (PREVIEW) · `_cover.jpg` (label « Cover ») · `_review.pdf` (label « Review sheet ») |
| Copies | « Instagram caption » (Arabic + English, ≤ 5 hashtags) · « YouTube title » · « YouTube description » (credits) · « Alt text ». References only, never verse text. |
| Status | **DRAFT**. Import with `--confirm`, **never `--approve`**. The owner approves after review. |

**Commands:**

```sh
export CREATIVE_HUB_URL=https://creatives.abdocloud.com     # in the cloud: environment variables
# CREATIVE_HUB_TOKEN must already be in the environment, never in a file
python pipeline/publish_hub.py check                 # token OK? platforms, badges, limits
python pipeline/publish_hub.py plan 18               # ZIP for every built, unpublished video of surah 18 (validated)
python pipeline/publish_hub.py upload publish/plans/coran-018-<stamp>.json
```

**The ledger.** `publish/ledger.json` (committed) records, per project id: creative name, URL, import id, video
SHA-256 and date. **It is the only protection against duplicates**, because importing the same thing twice creates
« … (2) » copies.
- Never import an id that is in the ledger.
- If a published video must be re-rendered, ask the owner before importing it again.
- Commit and push the ledger right after every upload.

**One import at a time.** Keep a ZIP to about one surah, or up to 2,000 files or 10 GB. Do not delete local media
until the upload is `COMPLETED`, all counts match, and the ledger is committed.

**Publishing problems:**

| Sign | Meaning | What to do |
|---|---|---|
| 401 « A valid API token is required » | wrong or revoked token | stop and tell the owner |
| 401 « Authentication required » | the agent API is not deployed | stop and tell the owner |
| 403 | the action is not allowed for this token | stop and report what was refused |
| exit code 2 (needs decision) | files the analysis could not place | cancel the import, fix the plan, rebuild |
| file FAILED | storage hiccup | import a ZIP of only the missing creatives |
| names ending « (2) » | a duplicate was created | tell the owner; never delete anything |

Never delete, edit or approve existing creatives, and never touch imports you did not start.

---

## 12. Cloud setup (Claude Code on the web)

The owner works without a PC. Cloud sessions run on Anthropic's Ubuntu 24.04 VMs (about 4 vCPU, 16 GB RAM, 30 GB
disk). They come with Node 22, Python 3 and Chrome for Testing (`CHROME_PATH` is set), but **not ffmpeg**.

1. **Repository:** the GitHub repo (private). Install the **Claude GitHub App** on it so claude.ai/code can clone
   it.
2. **Environment** (claude.ai/code → environment settings):
   - **Setup script:** `apt-get update && apt-get install -y ffmpeg`
   - **Environment variables:**
     ```
     CREATIVE_HUB_URL=https://creatives.abdocloud.com
     CREATIVE_HUB_TOKEN=<the token>
     BASH_DEFAULT_TIMEOUT_MS=600000
     BASH_MAX_TIMEOUT_MS=3600000
     ```
     Anyone who can use this environment can read these variables, so keep the environment private.
   - **Network access:** *Limited*, with "Allow package managers" checked, plus these allowed domains:
     ```
     api.quran.com
     api.alquran.cloud
     download.quranicaudio.com
     verses.quran.com
     creatives.abdocloud.com
     ```
     Add the storage host used for uploads if `upload` reports a blocked host. Its URLs come from Creative Hub;
     `*.r2.cloudflarestorage.com` and `*.amazonaws.com` are already allowed by default. "Full" access also works.
3. **Every session starts with** `bash scripts/cloud-setup.sh`. It installs the Python venv and renderer
   dependencies, and checks ffmpeg, the browser, the data sources and the Creative Hub token. **Do nothing until it
   prints `SETUP OK`.**
4. **Branches:** the branch `production` is the single source of truth for progress.
   - Start every session with `git fetch origin` and check out `production` (create it from `main` the first
     time).
   - Commit and `git push origin HEAD:production` after every published batch.
   - The owner merges `production` into `main` when they like.
5. **Session limits:**
   - Foreground commands can run for up to 10 minutes; longer jobs move to the background, with about 30 more
     minutes allowed. Build **one video at a time**.
   - An idle VM pauses, and can later be reclaimed **with all uncommitted files lost**. So build, check, publish
     and commit in small units: one surah, or 3–6 videos for long surahs.
   - Never leave built videos unpublished at the end of a session.
6. **Media are never committed** (`out/` and `data/*` are ignored). Durable state is `plans/`, `storyboard/`,
   `publish/ledger.json`, `docs/progress/STATUS.md` and the code. Data is re-fetched on demand.

---

## 13. Repository layout

```
CLAUDE.md                    rules every Claude session loads automatically
CLOUD_AGENT_PROMPT.md        the mission prompt for the cloud agent
Start Quran Studio.bat       local web app (Windows)
docs/                        MASTER_DOCUMENTATION (this), STORYBOARD_GUIDE, PIPELINE, STUDIO, CREDITS, progress/STATUS.md
pipeline/                    catalog, fetch_data, audit_surah, brief, direct, verify, align, prepare, produce,
                             publish_hub, progress, gloss_audit_dump, align_check
renderer/                    index.html, review.html, render.mjs, browser.mjs, js/{main,util,art,scenes,scenes_musa,scenes_lib}.js,
                             js/scene_catalog.json, fonts/ (OFL), tests/
platform/                    local web app (server.mjs + public/)
plans/<n>.json               researched video plan per surah
storyboard/<id>.json         one storyboard per video
publish/ledger.json          what is in Creative Hub (never delete entries)
tools/creative-hub/          build_creative_zip.py + creative-hub-agent.mjs
scripts/cloud-setup.sh       session setup and health check
data/catalog.json            surahs + reciters (data/* otherwise ignored: re-fetched)
```

---

## 14. Status (2026-11-21)

- **Al-Kahf (18), Dussary: 33 storyboards written, verified and independently reviewed** (263 explanations; 4
  meaning-changing cuts fixed). Plan: `plans/18.json`.
  - They use catalog v2 (beats and the Al-Kahf scene pack) but **not yet motifs**: upgrade them to motion graphics
    v3 first.
  - Then build, independent-check and publish them.
- **First productions:** Al-Hijr 15:57–77 and Ash-Shu'ara 26:60–68 (Alafasy). Hand-made scenes, re-rendered with
  covers, not yet human-approved.
- Test passages from the app: 2:255 (Husary), 103 (Alafasy), 112 (Sudais), 11:40–44 (test storyboard).
- **Not done yet:**
  - motion graphics v3;
  - the extra creative files;
  - more reciters (mp3quran.net has about 96 more, with verse-level timings only: whole-verse highlight);
  - QF production credentials;
  - confirming publishing rights for recitation audio and data;
  - the first real Creative Hub upload.

---

## 15. Order of work for the cloud agent

1. Run setup and health checks, and read this document, STORYBOARD_GUIDE.md and CLAUDE.md.
2. **Motion graphics v3** (section 8), with contact-sheet proof.
3. **Al-Kahf:** upgrade its 33 storyboards to v3, build, independent-check, publish drafts.
4. **Every other surah, in order 1, 2, 3 … 114** (skipping 18): investigate, plan, storyboard, review, build,
   publish, record, commit. Long surahs such as Al-Baqarah span many sessions: plan the whole surah first, then
   produce it group by group.
5. After each surah, report:
   - videos planned and published, with links;
   - every finding and every item a person must check by ear or by eye;
   - what comes next.
