# Quran explainer video pipeline

Vertical (1080×1920, 30 fps) recitation videos with a word-by-word synced verse card, short tafsir glosses,
English translation and code-drawn flat illustrations. Pilot: **Al-Hijr 15:57–77, Mishari Alafasy**.

## Productions

| Passage | Storyboard | Scenes | Output |
|---|---|---|---|
| Al-Hijr 15:57–77 (Lut), 3:20 | `storyboard/15_57-77.json` | `renderer/js/scenes.js` | `out/pilot_15_57-77_alafasy.mp4` |
| Ash-Shu'ara 26:60–68 (Musa crosses the sea), 1:32 | `storyboard/26_60-68.json` | `renderer/js/scenes_musa.js` | `out/short_musa_26_60-68_alafasy.mp4` |
| Any passage made in the Studio app | `storyboard/<id>.json` | `renderer/js/scenes_lib.js` (generic) | `out/<id>/` |

Pass `--data data/<passage>/render_data.json` to `render.mjs` (and `?data=` to the preview) to pick a passage.

## The Studio app (any passage)

`Start Quran Studio.bat` runs `platform/server.mjs`, a local web app that drives the same pipeline for any surah,
verse range (max 40) and reciter. User guide: [STUDIO.md](STUDIO.md). The app adds:

- **`pipeline/catalog.py`** builds `data/catalog.json`: the 114 surahs, and the 11 reciters that have word timings.
- **`pipeline/direct.py`** writes the storyboard in one of two modes:
  - `--mode auto`: no AI. Calm visuals, chapters of about 16 s, no glosses.
  - `--mode claude`: the Anthropic API with structured output. Each draft goes through `verify.check()`, and failures
    are sent back to Claude for up to 2 repair rounds. Anything still failing is removed.
- **Generic scenes** (`renderer/js/scenes_lib.js`, contract in `renderer/js/scene_catalog.json`):
  - `ambient`: 8 calm moods, safe for every passage.
  - `stage`: 7 settings × 4 times of day, 11 actor types and 13 timed events.

  The catalog also holds the picture rules that Claude, the verifier and the app all share.
- **Long verses are paged** on the card, at most 3 lines per page. Breaks prefer waqf signs, and the translation is
  split at sentence ends. Verses of 3 lines or fewer render exactly as before.
- **Review gate**: export stays locked until every verse, the titles and scenes, and any flagged timing are
  confirmed, and a reviewer name is entered. This is saved in `data/<id>/project.json`.

Project ids are `<chapter>_<from>-<to>`, with a `_r<reciter>` suffix for any reciter other than Alafasy (7).
Full-chapter mp3s are shared in `data/_audio/`.

## The one rule

**No Quranic text is ever typed, pasted or generated.** Verse text, word text, ayah numbers, translation, tafsir and
word timings come from the Quran Foundation dataset and are drawn exactly as received. The storyboard only refers to
words by `verse + word position`.

## Run it

```sh
# 1. fetch (public quran.com v4 = QF dataset; use --source qf-production once production access is granted)
.venv/Scripts/python -I -X utf8 pipeline/fetch_data.py --chapter 15 --from 57 --to 77 --recitation 7 --out data/15_57-77
# 2. verify (exit 1 = do not render)
.venv/Scripts/python -I -X utf8 pipeline/verify.py storyboard/15_57-77.json
# 3. prepare render data + mastered audio (re-runs verify and refuses on failure)
.venv/Scripts/python -I -X utf8 pipeline/prepare.py storyboard/15_57-77.json
# 4. look, then render
node renderer/render.mjs serve                       # browser preview with audio
node renderer/render.mjs sheet --from 0 --to 30 --n 9 --cols 3 --out out/wip/sheet.png
node renderer/render.mjs video --out out/pilot.mp4   # ~8-9 min for 3:20
node renderer/render.mjs review --out out/review_sheet.pdf   # for the human reviewer
```

## What `verify.py` checks

| Area | Check |
|---|---|
| Text | The words, joined, are exactly what gets drawn. They are compared with an independent second source (Tanzil Uthmani). Only documented encoding equivalences are allowed (tatweel + dagger alef, hamza-on-kashida). |
| Text | The QF verse-level text drops the small-meem tanween marks (U+06E2/U+06ED). The word-level text keeps them, so the word-level text is rendered. |
| Text | alquran.cloud adds the basmala to verse 1 of every surah except 1 and 9. The prefix is removed using Tanzil's own text of 1:1, only on an exact match, and the report notes it. |
| Audio | A word segment may lie up to 1 s outside the verse window: that is normal aligner jitter, reported as INFO. What fails is any overlap with a neighbouring verse's words, including the verses just before and after the passage (`neighbors` in `source.json`). `prepare.py` cuts at the quiet point closest to the ideal cut, inside a window that stays clear of those words. |
| Audio | **Alignment with the real audio** (`pipeline/align.py`, run by `prepare.py`). At every verse boundary, the timing gap must fall inside a real pause: at least 140 ms on a 60 ms-smoothed envelope, below −30 dB, or below −26 dB when the pause is filled by room echo. If it doesn't, the boundary is moved onto the nearest measured pause within 0.8 s. A stop consonant's closure (50–100 ms) never counts as a pause. A video may not start or end where the reciter joins two verses with no pause; Dussary does this at 18:46→47. The moves are listed in `render_data.aligned_boundaries` and on the review sheet. `pipeline/align_check.py` audits a whole chapter. |
| Text | QF's verse-level field can differ from its word-level field by small-meem marks (U+06E2/U+06ED) or sakt spacing. That is reported as INFO; the word-level text, identical to Tanzil, is what's drawn. |
| Fonts | The English line uses the stack "Montserrat", "Scheherazade New", so symbols Montserrat lacks (e.g. ﷺ in Saheeh International) are drawn by Scheherazade New. The check accepts them only if Scheherazade New has them. |
| Cover | Every video opens on a 1.0 s cover: the series, the title, surah and verses and the reciter over a frozen scene. The `cover` block in the storyboard follows the title rules. The export also saves `cover.jpg`. |
| Beats | `params.beats` (contract v2 in `scene_catalog.json`): camera, actor, scene and ambient actions on words. They must be valid for the scene, use real word positions and actors, and be at least 0.8 s apart. |
| Scenes | Chapter titles must be 1–28 characters, have no diacritics, and never repeat two consecutive Quran words of the passage. Scene ids and parameters must be valid according to `scene_catalog.json`. Labels are Arabic letters only, and only for prophet, angel and honored actors (plus the optional, never-drawn «فرعون» on the king). Word references must point into the chapter's own verses. The hand-made scenes are allowed only for their original passages. |
| Glosses | Tone must be one of red, green, blue or amber. The arrow target must be an anchor of the chapter's scene. Two glosses must start at least 1 s apart. |
| Audio | Every word has a timing. Segments are time-ordered and never overlap the previous verse. Reciter repetitions are reported (15:74 repeats words 4–6; the highlight jumps back). |
| Audio | `prepare.py` checks that both cut points sit in silence (< −30 dB), so no sample of 15:56 or 15:78 leaks in. |
| Glosses | Each excerpt must be a **verbatim substring** of the cited tafsir and may not contain or sit inside a `{…}` Quran quotation. Tafsir quotations use simplified spelling; that is how the reference video ended up showing «جِئْنَاكَ» instead of the Mushaf «جِئْنَـٰكَ». |
| Glosses | An excerpt may not share **two consecutive words** with any verse of the passage, and may not contain a word with two or more harakat that matches a Quran word. Both are compared on a letters-only skeleton, so Uthmani and plain spellings match. This catches As-Sa'di's *unbracketed* quotations (Ash-Shu'ara). Known limit: a one-word quote with one haraka (e.g. «كُلا») is not caught, so the human review still matters. |
| Timing | Known errors in the QF word timings are fixed through `timing_corrections` in the storyboard. Each fix states the exact error it expects and applies only if the raw data still shows it. It is logged in the report and appears in the review sheet as a "listen and confirm" item. First case: 26:63, where word 2 «إلى» is labelled as word 3. |
| Resources | Translation 20 = Saheeh International; tafsir 16 = Al-Muyassar, 91 = As-Sa'di. |
| Fonts | Every code point drawn exists in the font that draws it. The renderer also refuses to start if any web font failed to load (no silent fallback). |

## Font decision (visual proof, not just data)

Amiri Quran was tried first and **rejected**. With this text encoding it detaches the waqf mark in «قَدَّرْنَآ ۙ»
(15:60), turns «لَـَٔايَـٰتٍۢ» (15:75) into a «لأ» ligature, and drifts the small meem of «قَوْمٍۢ» / «حِجَارَةًۭ». **Scheherazade New** (SIL)
renders all of them correctly. Before any new font is adopted, compare it with `renderer/tests/shaping3.html`.

## QF API status (2026-11-19)

- The credentials in `.env` are **pre-live** keys. Request granular scopes (`content.quran.read content.translations.read
  content.tafsirs.read content.audio.read content.metadata.read`). The legacy `content` scope is refused.
- Pre-live only contains Al-Fatiha and Al-Baqarah. Other surahs need **production access**: request it in the
  Developer Console (dev-console.quran.foundation) or at developers@quran.com.
- Cloudflare blocks Python's default User-Agent (error 1010), so the scripts send `quran-video-builder/0.1`.
- Hazza Al-Balushi is not among the QF reciters.

## Content rules baked into the art

- Prophets and angels are never drawn as people. They appear only as labelled light drops (Ibrahim green, Lut blue, angels gold).
- Ordinary people are faceless.
- No text is baked into illustrations. All text is rendered from data.

## Layout

```
platform/   server.mjs (local web app) · public/{index.html,app.js,app.css}
pipeline/   catalog.py · fetch_data.py · direct.py · verify.py · prepare.py
storyboard/ <passage>.json   chapters, titles, glosses (by word position), scene ids + params
renderer/   index.html (preview + export page) · js/{util,art,scenes,scenes_musa,scenes_lib,main}.js · scene_catalog.json · render.mjs · review.html · fonts/
            tests/lib.html + lib_shot.mjs (scene library sheets) · ui_shot.mjs (app screenshots) · pages.mjs (card paging)
data/<passage>/  source.json · second_source_tanzil_uthmani.json · verify_report.md · render_data.json · audio_master.wav
out/        final mp4, review sheet, wip stills
```
