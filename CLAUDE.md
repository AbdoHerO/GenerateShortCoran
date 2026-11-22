# Quran Video Studio: rules for every Claude session

Animated vertical Quran recitation videos (reciter Yasser ad-Dussary, QF id 97), surah by surah. Finished videos go
as DRAFTS to the owner's Creative Hub (platform « Coran »).
- Full documentation: `docs/MASTER_DOCUMENTATION.md` (read it before working).
- Storyboards: `docs/STORYBOARD_GUIDE.md`.
- Progress: `docs/progress/STATUS.md`.
- Mission prompt: `CLOUD_AGENT_PROMPT.md`.

## Absolute rules (accuracy is critical; one mistake is unacceptable)
1. **Never type, generate or "fix" Quranic text.** All verse text, words, numbers, translation, tafsir and timings
   come from the API data. Storyboards reference words as `[verse, word]` only. Captions reference surah and verse
   numbers, never verse text.
2. `python pipeline/verify.py storyboard/<id>.json` must print **PASSED** before anything is built. Never weaken a
   check to make something pass.
3. **Audio:**
   - Run `pipeline/audit_surah.py` before planning a surah.
   - Never start or end a video at a JOINED boundary (the reciter joins the verses).
   - Never guess a word timing.
   - `prepare.py` aligns verse changes to the measured pauses.
   - Short-timing flags must be listed for the human reviewer.
4. **Glosses:**
   - They are verbatim tafsir excerpts (Al-Muyassar 16 / As-Sa'di 91), at most 64 characters.
   - They must keep their meaning when cut out: never drop a negation or condition, never present a
     disbeliever's claim as a statement, never take a side where the tafsirs differ.
   - Every surah gets an independent reviewer sub-agent pass (`pipeline/gloss_audit_dump.py`).
5. **Pictures:**
   - Allah is never depicted.
   - Prophets appear only as blue labelled light drops, angels only as gold drops.
   - Honoured or disputed-status people appear only as green labelled drops: al-Khidr, Yusha' bin Nun,
     Dhul-Qarnayn, Maryam.
   - People are always faceless.
   - No literal depiction of the unseen (Paradise, Hell, Judgement, jinn, Iblis).
   - No violence.
   - Never show a countable group where the Quran leaves the number to Allah.
   - No pyramids outside Egypt.
   - Gog and Magog are never drawn.
6. **Titles and covers:** 2–4 words of MSA, no diacritics, never repeating Quran wording. Watch modern meanings
   («الرحلة غربا», not «رحلة المغرب»).
7. **Every video opens on its cover frame** (series, title, surah and verses, reciter over a picture). The export
   includes `cover.jpg`.
8. **Every video must be motion graphics, animated, never static** (section 8 of the master documentation:
   motifs, continuous motion, designed transitions). Something must move in every 2-second window.
   - Storyboards carry `"motion": 3`, with `params.motifs` and `params.transition` (STORYBOARD_GUIDE.md →
     "Motion graphics v3").
   - `verify.py` enforces an action at least every 6 s; `renderer/tests/motion_check.mjs` checks the frames.
   - Motifs are symbols only: never for Allah, prophets or angels; nothing literal for the unseen. No `fire`, river
     or gold motif in a Paradise or Hell passage, and no scales at the Mizan.
   - **Staging v4 (owner decision 2026-11-21):** every this-world passage is a `stage` scene with a place, faceless
     people and gestures, like Al-Kahf. `ambient` is only for Allah's names and attributes, the unseen and battles
     (STORYBOARD_GUIDE.md → "Staging v4").
   - Every person, place, object, number and gesture on stage comes from the verse or the Al-Muyassar / As-Sa'di
     tafsir. Nothing is invented. When unsure, check official sources or draw less.
   - The Prophet Muhammad ﷺ is never shown, not even as a drop.
   - Every restaged surah gets an independent picture review.
   - Videos already published are re-published as new versions « - v2 »
     (`publish_hub.py plan <ch> --ids … --version 2`).
9. **Human review is mandatory.**
   - Upload to Creative Hub only as drafts (`--confirm`, **never `--approve`**), with the review sheet PDF.
   - Never re-import an id that is in `publish/ledger.json`: duplicates become « (2) ».
10. **Secrets:** never print, log, write or commit `CREATIVE_HUB_TOKEN` or `.env`. The token lives only in
    environment variables and is sent only to `https://creatives.abdocloud.com/api/agent/v1/…`.

## Autonomous operation and usage limits (owner decision 2026-11-22)
The owner wants the production to run without stopping and without their action:
- **Check the usage limit** at the start of every turn and before starting any token-consuming work (sub-agents,
  reviews, long writing). Read the newest `rate_limit_event` with `list_events(session_id=<this session>,
  kinds=["rate_limit_event"])`. Look at `unifiedWindows.five_hour.utilization` and `seven_day.utilization`, and
  `resetsAt` (epoch seconds).
- **At 95% or more in a window:**
  - Stop every token-consuming task (TaskStop the running sub-agents; their work is saved and they are resumed
    later with SendMessage).
  - Leave background renders and builds running: they use no tokens.
  - Schedule the resume with `send_later` at that window's reset + 1 minute (reset 05:00 → 05:01, UTC), then end
    the turn.
- **Under 95%:** continue the work.
- Always keep one pending resume `send_later` at the current five-hour window's reset + 1 minute, so the work
  restarts by itself even if the limit is hit in the middle of a task.
- After each resume, check again and repeat for the next reset. Continue until every surah in scope is done; never
  wait for the owner's approval to resume.

## Current scope (owner decision 2026-11-22): surahs 1–15 and Al-Kahf (18) only
- Finish all the work on surahs **1 to 15** and on **Al-Kahf (18)**, then **stop**.
  - The work includes: restage with Staging v4, independent picture reviews, fixes, builds, frame checks and
    publishing drafts.
  - Al-Kahf needs its v2 with all the renderer fixes (Name plates, desert, prayer and plate rules, quiet words, light
    mood).
- **Do not start surah 16 or any later surah:** the owner will do 16 to 114 later.
- When surahs 1–15 and 18 are all published with their final pictures (except the videos blocked by the owner's
  pending decisions in DECISIONS_NEEDED), do these steps:
  - commit and push;
  - cancel the pending resume `send_later`, and do not schedule a new one;
  - report the final state to the owner.

## Working conventions
- **Start of a session:** `bash scripts/cloud-setup.sh` must print `SETUP OK`. Then work on the branch
  `production`: `git fetch origin && git checkout production && git pull` (create it from `main` the first time).
- **Python:**
  - Linux / cloud: `.venv/bin/python -I -X utf8 pipeline/<script>.py`
  - Windows: `.venv/Scripts/python -I -X utf8 …`
- **One video at a time:** `pipeline/produce.py new|build|status`.
- **Look at frames before publishing:** `node renderer/render.mjs sheet …`.
- **Commit and push** (`git push origin HEAD:production`) after every published batch:
  `plans/`, `storyboard/`, `publish/ledger.json`, `docs/progress/STATUS.md` (from `pipeline/progress.py`) and code.
  Never commit media, `data/*` (except `data/catalog.json`), `out/` or `.env`.
- Cloud VMs can be reclaimed: build → check → publish → commit in small units. Never end a session with built but
  unpublished videos.
