# Mission prompt for the cloud agent

> Copy everything below the line and paste it as the task of a new Claude Code session on the web
> (claude.ai/code, this repository, branch `production`). It is written so that you can paste it again, unchanged,
> to start every following session. The agent continues from the progress files.

---

## Who I am and what I need

I am the owner of this repository. I make short vertical videos of the Quran: animated motion graphics, the
recitation of **Yasser ad-Dussary (ياسر الدوسري, QF recitation id 97)**, the Arabic text highlighted word by
word, an English translation, and short tafsir explanations. I no longer work on my PC, so you, in the cloud, do
the production from now on.

**Your mission is to produce the videos for the whole Quran, surah by surah, with zero mistakes, and upload every
finished video to my Creative Hub** (`https://creatives.abdocloud.com`, platform **« Coran »**) as **drafts** for
my review.

Accuracy is the most important thing. The Quranic text, the recitation, the word highlighting, the translation,
the explanations and the story must all be exactly right. If you are not sure about something, do not guess:
investigate, choose the safe option, and tell me.

## Read first, in this order
1. `CLAUDE.md`: the absolute rules (already loaded; obey every one).
2. `docs/MASTER_DOCUMENTATION.md`: the whole system, the rules, the production method, publishing, and the cloud
   setup. Read all of it.
3. `docs/STORYBOARD_GUIDE.md`: how to write a storyboard.
4. `docs/progress/STATUS.md`, `plans/18.json` and `publish/ledger.json`: where the work stands.
5. Two reference storyboards: `storyboard/18_17-18_r97.json` (story scene) and `storyboard/18_109-109_r97.json`
   (calm scene).

## Start of every session
1. Run `bash scripts/cloud-setup.sh`. Do not continue until it prints `SETUP OK`. If something is missing (ffmpeg,
   a blocked domain, the Creative Hub token), stop and tell me exactly what to change in the environment settings.
2. Run `git fetch origin`, then check out `production` and pull. Create it from `main` the first time and push it.
3. Run `python pipeline/progress.py` and read `docs/progress/STATUS.md` and `publish/ledger.json`. Find the next
   unit of work from the order below. Never redo or re-upload something already in the ledger.
4. Run `python pipeline/publish_hub.py check` once per session. Confirm the token works and see whether the
   platform « Coran » exists. Never print the token.

## Order of work
1. **Motion graphics v3 (do this first, once).** I want **every** video to be motion graphics: animated, alive and
   interactive. Today several calm videos are mostly a static background with a slow drift, "just some objects and
   something classic". That is not acceptable any more. Implement section 8 of the master documentation:
   - `params.motifs`: animated symbolic illustrations that draw themselves on, tied to the words, added to the
     scene catalog and validated by the verifier;
   - continuous motion in every layer;
   - designed transitions between chapters;
   - kinetic UI typography (UI text only, never the Quranic text).

   Prove it with contact sheets and one real rendered video. Look at the frames yourself, and update the docs and
   catalog. Rule: something visibly moves in every 2-second window, with a motif, event or beat every 4–6 s.
2. **Al-Kahf (surah 18).** Its 33 storyboards are written, verified and independently reviewed, but they predate
   v3.
   - Upgrade each one with motifs and transitions, keeping every gloss and title that passed the review.
   - Re-verify, build, check frames, then publish all 33 as drafts.
3. **Every other surah, in order: 1, 2, 3 … 114** (skip 18). For each surah, follow section 9 of the master
   documentation completely:
   1. **Investigate.** Run `audit_surah.py <n> --reciter 97`, then read every verse with its translation and both
      tafsirs.
      - A text mismatch with Tanzil stops everything until it is understood.
      - Note the timing defects, the short-timing flags and every JOINED boundary.
   2. **Decide how many videos the surah can give, and write `plans/<n>.json`.** Split by meaning (stories,
      episodes, themes):
      - 20–120 s each, at most 40 verses;
      - boundaries only at real pauses, never at JOINED ones;
      - cautions for every sensitive point;
      - the scholarly differences, noted from the two tafsirs.

      Commit the plan before producing.
   3. **Storyboards:** `produce.py new` for each video, then write each storyboard by hand. Use stage scenes for
      narrated events, ambient scenes plus motifs for everything else, beats and motifs throughout, and one cover
      per video. `verify.py` must print PASSED.
   4. **Independent review:** run `gloss_audit_dump.py`, then a **separate reviewer sub-agent** that did not write
      the storyboards. Fix every serious finding and re-verify.
   5. **Build one video at a time** (`produce.py build <id>`). Look at contact sheets of the frames; a static
      stretch, a rule break or a misplaced arrow means fix and rebuild.
   6. **Publish drafts.** Run `publish_hub.py plan <n>`, then `publish_hub.py upload <plan>`. Never use
      `--approve`. Check the counts, and that the ledger was updated.
   7. **Record.** Run `progress.py`, commit the plan, storyboards, ledger and status, and push to `production`.
      You may delete the local media of that batch only after the ledger is pushed.

   Long surahs (Al-Baqarah, Al-Imran, An-Nisa…) take many sessions. Plan the whole surah first, then produce and
   publish it group by group (3–6 videos per batch), committing after each batch.

## Extra creative files (optional, encouraged)
Beside each video you may create other publishable media that you think will work well:
- a 16:9 YouTube thumbnail;
- a 4:5 Instagram post;
- a carousel telling the story in 4–7 slides;
- a 10–20 s teaser made only of whole verses;
- Story frames.

The rules for all of them:
- **No faces**, and every picture rule in section 2.4 applies.
- Quranic text in an image is rendered from the API data, never typed.
- You may stay in the house style, invent new styles (paper-cut, line-art, watercolour-flat, geometric,
  isometric…) or mix them, consistently within one piece.
- Upload them with the video in the same import (section 10 explains how each is packaged). Extend
  `release.json` and `publish_hub.py` for them.

## Never
- Never type, generate or "correct" Quranic text, a verse number, the translation or a tafsir excerpt.
- Never publish anything publicly, never approve creatives, never use `--approve`.
- Never re-import an id that is in `publish/ledger.json`, never run two imports at once, never delete or edit
  existing creatives.
- Never weaken `verify.py`, `align.py` or the audits to make something pass. Change the plan instead, or ask me.
- Never cut the audio through the reciter's voice or at a JOINED boundary. Never guess a word timing.
- Never depict Allah, prophets or angels as figures, faces of anyone, the unseen literally, or violence.
- Never print, log, write or commit the Creative Hub token or `.env`.
- Never end a session with built but unpublished, or uncommitted, work.

## Report at the end of every session (and after every surah)
Keep it short and in plain words:
- **What was done:** the surah, videos planned / storyboarded / built / uploaded, and the Creative Hub import id
  and links.
- **How many videos each finished surah gave, and why:** the split, plus any JOINED boundaries or defects that
  shaped it.
- **For my review:**
  - every moment to check by ear (aligned verse changes, short-timing flags);
  - every gloss or picture choice that needed judgement;
  - every scholarly difference you handled.
- **Problems:** anything that failed, anything blocked, anything you need from me (environment, permissions,
  decisions).
- **What comes next.**

When every surah is done and uploaded, tell me. I will review and approve the videos in Creative Hub, surah by
surah.
