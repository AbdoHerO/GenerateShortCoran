# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A pipeline plus a local web app ("Quran Video Studio") that turns a Quran passage into a vertical 1080×1920, 30 fps
recitation video. Each video has a word-by-word highlighted verse card, the English translation, short tafsir glosses
and flat illustrations drawn in code. Python does the data and audio work, a headless Chrome canvas page draws the
frames, and ffmpeg encodes them. The user docs are `docs/PIPELINE.md` (pipeline and checks), `docs/STUDIO.md` (the app),
`docs/STORYBOARD_GUIDE.md` (writing storyboards by hand) and `docs/CREDITS.md`. There is no README.

## The non-negotiable rule

**No Quranic text is ever typed, pasted or generated anywhere: code, storyboards, prompts, tests or commits.** Verse
text, word text, ayah numbers, translation, tafsir and word timings come only from the Quran Foundation API
(`source.json`), and are copied from there into `render_data.json` by `pipeline/prepare.py`. Storyboards refer to
words only as `[verse, word_position]`. `pipeline/verify.py` is the gate that enforces this, along with the picture
rules. If a check fails, fix the input. **Never weaken the verifier** to make something pass.

## Setup and commands

Requirements: Python 3.12+ in `.venv` with `fonttools` (verify) and `anthropic` (Claude director only), Node 20+,
**Google Chrome** (the renderer launches `playwright-core` with `channel: 'chrome'`), and `ffmpeg` on the PATH.
`npm install` goes in `renderer/` (its only dependency is `playwright-core`).

The project is Windows-first: the docs and the `.bat` file use `.venv/Scripts/python`. On Linux or macOS use
`.venv/bin/python`. `platform/server.mjs` picks whichever exists. Always pass `-I -X utf8`: the scripts add
`pipeline/` to `sys.path` themselves.

```sh
# Studio web app on http://localhost:5178 (PORT env overrides). Builds data/catalog.json on first start.
node platform/server.mjs --open

# Pipeline for one passage (id = <chapter>_<from>-<to>, plus _r<reciter> for any reciter other than 7 = Alafasy)
.venv/bin/python -I -X utf8 pipeline/fetch_data.py --chapter 18 --from 17 --to 18 --recitation 97 --out data/18_17-18_r97
.venv/bin/python -I -X utf8 pipeline/direct.py --id 18_17-18_r97 --mode auto            # or --mode claude --style story|calm
.venv/bin/python -I -X utf8 pipeline/verify.py storyboard/18_17-18_r97.json            # exit 1 = do not render; writes data/<id>/verify_report.md
.venv/bin/python -I -X utf8 pipeline/verify.py storyboard/18_17-18_r97.json --json     # dry run: prints one "@@ {json}" line, writes nothing
.venv/bin/python -I -X utf8 pipeline/prepare.py storyboard/18_17-18_r97.json           # re-runs verify, then writes render_data.json + audio_master.wav
.venv/bin/python -I -X utf8 pipeline/brief.py 18_17-18_r97                             # words with times, translation, tafsir text: for writing a storyboard by hand

# Renderer (--data defaults to data/15_57-77/render_data.json)
node renderer/render.mjs serve  --data data/<id>/render_data.json                     # browser preview with audio on :5173
node renderer/render.mjs stills --data data/<id>/render_data.json --t 3,10.5 --out out/wip/s
node renderer/render.mjs sheet  --data data/<id>/render_data.json --from 0 --to 30 --n 9 --cols 3 --out out/wip/sheet.png
node renderer/render.mjs video  --data data/<id>/render_data.json --out out/<id>/x.mp4  # roughly 2.5 min per minute of video
node renderer/render.mjs review --data data/<id>/render_data.json --out out/<id>/review_sheet.pdf

# Other tools
.venv/bin/python -I -X utf8 pipeline/catalog.py                  # rebuild data/catalog.json (114 surahs, reciters with word timings)
.venv/bin/python -I -X utf8 pipeline/align_check.py 18 97        # audit a whole chapter's timing vs audio pauses -> data/_align/
.venv/bin/python -I -X utf8 pipeline/gloss_audit_dump.py '18_*_r97'   # every gloss/title/cover with its tafsir context, for review
```

There is no unit-test suite and no linter. Verification works like this:
- **Correctness**: `verify.py` on the storyboard you changed (use `--json` so the report file stays unchanged). To
  check everything, loop over `storyboard/*.json`.
- **Visual**: the harnesses in `renderer/tests/`.
  - `node renderer/tests/lib_shot.mjs <suite> [out.png]` draws contact sheets of the generic scene library. Suites:
    `moods`, `settings`, `actors`, `events`, `edges`, `perf`, `custom`.
  - `pages.mjs` (card paging) and `ui_shot.mjs` (app screenshots) need the Studio server running on :5178.
  - `shaping*.html` are the font-shaping proofs.

`out/`, `.env`, `.venv/`, `node_modules/` and every `*.mp3` are gitignored. Each `data/<id>/` (including the large
`audio_master.wav`) is committed, but the full-chapter source mp3s in `data/_audio/` are not. So on a fresh clone,
`render.mjs` works straight away, but `prepare.py` needs `fetch_data.py` to run first to download the mp3 again.

## Architecture

### Data flow (one passage = one id)

```
fetch_data.py → data/<id>/source.json             raw QF API data, untouched (verses+words, translation 20, tafsirs 16/91,
                                                  recitation timestamps, neighbouring-verse bounds, path to the shared mp3)
direct.py     → storyboard/<id>.json               chapters (title, scene, params, beats), glosses, cover. No Quran text.
verify.py     → data/<id>/verify_report.md         gate; also caches data/<id>/second_source_tanzil_uthmani.json
prepare.py    → data/<id>/render_data.json         timeline in video seconds + every string the renderer draws
              → data/<id>/audio_master.wav         cut in silence, faded, padded, two-pass loudnorm to -14 LUFS
render.mjs    → out/<id>/*.mp4, review_sheet.pdf, cover.jpg
```

- `verify.check(sb, src, data_dir)` returns `(level, area, msg)` tuples. The areas are text, audio, storyboard,
  scenes, gloss, resources and fonts. `direct.py` and the Studio decide what to do based on the area. A FAIL in
  text, audio or resources means the data itself is wrong, and the project is **blocked**. A FAIL in the other areas
  means the storyboard needs fixing.
- Text check: the API's word-level text is compared with Tanzil Uthmani (via alquran.cloud). They must match after
  NFC and the short documented `EQUIVALENCES` list. `skel()` reduces text to a letters-only skeleton, which is how
  titles and glosses are checked for Quran wording (two consecutive Quran words fail).
- Audio: `align.py` `snap_boundaries()` moves verse boundaries in the timing data onto pauses it measures in the audio
  (RMS envelope from ffmpeg). `prepare.py` then cuts at the quiet point nearest the ideal cut. It refuses when the
  reciter joins the first or last verse to its neighbour with no pause. Known errors in the QF timing data are
  fixed through `timing_corrections` in the storyboard; each fix applies only if the raw data still shows the exact
  error it describes.
- Every video opens on a 1.0 s cover (`COVER_S`): the scene frozen at the `cover.at` word. That first frame is also
  exported as `cover.jpg`.

### `renderer/js/scene_catalog.json` is a shared contract

The scene vocabulary lives in this catalog: ambient moods, stage settings, times, places, poses, looks, actors,
events, beats and anchors, plus the picture `rules`. Four parts of the project read it:
- `scenes_lib.js` draws each of them.
- `verify.py` (`check_scenes`, `check_beats`) validates against it.
- `direct.py` builds the Claude JSON schema enums and the system prompt from it.
- `platform/server.mjs` sends it to the app's editor.

To add a mood, setting, actor, event or beat, change the catalog **and** the drawing code in `scenes_lib.js`. Also
update `verify.py`'s hard-coded `EVENT_NEEDS` (which setting or actor an event requires) if the new piece has such a
requirement, and add a case to `renderer/tests/lib_shot.mjs`.

### Renderer: every frame is a pure function of `t`

- `renderer/index.html` is both the live preview and the export page. With `?export=1`, `render.mjs` loads it in
  headless Chrome and calls `window.R.renderAt(t)` for each frame. Each frame is screenshotted as JPEG and piped to
  ffmpeg (libx264). The video is then muxed with `audio_master.wav`.
- Determinism is required. No `Math.random`, wall-clock time or per-call state that changes the output. Use
  `util.hash()` for pseudo-randomness. All timing comes from the recited word times through the chapter timeline
  object `T` (`T.w(verse, pos)`, `T.at([v, w])`, `T.words`, `T.start`/`T.end`), never from literal seconds.
- `main.js` composes the frame: background, logo, chapter title, scene frame (a 960×870 offscreen canvas, crossfaded
  at chapter changes), glosses with arrows to scene anchors, the verse card, translation, dots, cover and outro.
  Verses longer than 3 lines are split into pages (breaks prefer waqf signs). `render.mjs` refuses to render if any
  web font failed to load (`window.R.fontsOk`) or the page logged an error.
- Scenes are merged from three modules, and each exposes `{ draw(ctx, t, T), anchors(t, T) }`:
  - `scenes.js`: the 10 hand-made plates for Al-Hijr 15:57–77. It also exports the shared helpers `SW`/`SH`/`HY`,
    `withCam` and `par`.
  - `scenes_musa.js`: the hand-made plates for 26:60–68.
  - `scenes_lib.js`: the generic `ambient` and `stage` scenes used by every other passage.

  The hand-made scenes are tied to specific words of their passage. `verify.py` (`CUSTOM_SCENES`) allows them only
  there, and the Studio refuses to regenerate or delete those two projects (`LEGACY` in `server.mjs`).
- Fonts: the Quran text uses Scheherazade New, the UI uses Tajawal, titles use Lalezar, and English uses Montserrat
  with Scheherazade New as fallback. Amiri Quran was rejected for shaping errors. Compare any new font in
  `renderer/tests/shaping3.html` before adopting it. `verify.py` checks that each font has every code point it draws.

### Studio app (`platform/`)

- `server.mjs` is a dependency-free Node HTTP server bound to 127.0.0.1. It runs the pipeline scripts as child
  processes through two serial queues: one for preparation (fetch → direct → verify → prepare) and one for rendering.
- Scripts report progress with stdout lines of the form `@@ {json}`. `fetch_data.py`, `direct.py`, `prepare.py`,
  `verify.py --json` and `render.mjs video` all emit them. Keep this protocol when you change those scripts.
- Project state (stage, steps, review, render) is stored in `data/<id>/project.json`. Passages that have a storyboard
  and data but no `project.json` are adopted when the server starts.
- Storyboard edits from the app pass through `applyEdits()` (only chapter titles and scenes, and glosses). They are
  then dry-verified as `storyboard/<id>.candidate.json` before being saved.
- Export is locked until the review is approved: every verse ticked, titles confirmed, any timing correction
  confirmed by ear, and a reviewer name entered.
- `platform/public/app.js` is a no-build SPA with hash routes. It drives the renderer preview in an iframe through
  `window.player`.

### Claude director (`pipeline/direct.py --mode claude`)

- It calls the Anthropic SDK with structured output (`output_config.format` = the JSON schema built from the
  catalog). If the model rejects the schema, it retries asking for plain JSON.
- Every draft goes through `verify.check()`. Up to 2 repair rounds send the FAIL messages back to Claude.
  `sanitize()` then removes anything that still fails: a failing scene becomes ambient `light`, and a failing gloss is
  dropped. Nothing is invented as a replacement.
- The model comes from `CLAUDE_MODEL` in `.env` (default `claude-opus-5-5`). Cost is recorded in
  `storyboard.director`. `.env` also holds `ANTHROPIC_API_KEY`, and `Client_ID`/`Client_Secret` for the QF OAuth
  sources (`--source qf-prelive|qf-production`). The default source, `public` (api.quran.com v4), needs no key.

## Content rules (from `scene_catalog.json` `rules` and `docs/STORYBOARD_GUIDE.md`)

- Allah is never depicted. Prophets, angels and honoured people (Maryam; people whose status is disputed, such as
  al-Khidr and Dhul-Qarnayn) appear only as labelled light drops. Ordinary people are faceless.
- No violence. The unseen (Paradise, Hell, the Hereafter, jinn), rulings and Allah's attributes use the `ambient`
  scene.
- A number the Quran leaves unknown is never shown as a countable group (use `sleepers` or `"uncountable": true`).
  No text is baked into the art.
- A gloss excerpt is a verbatim substring of that verse's tafsir (16 Al-Muyassar or 91 As-Sa'di), at most 64
  characters. It must contain no `{…}`/`﴿…﴾` quotation, no two consecutive verse words and no fully vocalised Quran
  word. Gloss starts are at least 1 s apart. Beats are at least 0.8 s apart, with at most 24 per chapter.
- Titles: 1–28 characters, no diacritics, never quoting the Quran. Cover titles are at most 26 characters.

## Repository contents beyond the pipeline

- `plans/18.json` splits Al-Kahf into 34 planned videos, each with cautions. `brief.py` prints the plan entry for an
  id. The research data behind it is in `data/_analysis/18_1-110/`.
- `storyboard/` and `data/` currently cover all of Al-Kahf with Yasser ad-Dussary (`_r97`), the two hand-made pilots,
  and a few test passages.
- `agent-handoff/` is **unrelated to this project**: it holds tooling and a prompt for a separate "Creative Hub"
  media-library import. Leave it alone unless asked.
- The `.mp4` at the repo root is a third-party reference video (Al-Hijr, Hazza Al-Balushi). It is not project
  output.
