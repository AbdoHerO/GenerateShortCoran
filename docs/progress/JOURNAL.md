# Production journal (cloud agent)

Running notes, newest last: what was done, decisions, review findings, and everything the owner must check by ear
or by eye. The per-surah summary goes into each `plans/<n>.json` "notes"; this file keeps the session-level story.

## 2026-11-21: session 1

### Setup
- `scripts/cloud-setup.sh` passed after loading `CREATIVE_HUB_URL` and `CREATIVE_HUB_TOKEN` into the shell from the
  owner's `.env` on `main`. The environment variables were not set in this cloud environment. The token is never
  printed or written anywhere.
- Creative Hub: the token works and may import. The platform « Coran » does not exist yet, so the first import
  creates it.

### Motion graphics v3 (done)
- Motifs:
  - 44 line-art symbols in `renderer/js/motifs.js`, each on a cream plate with a gold ring.
  - A motif draws itself on at its word, pulses with every recited word, has its own motion and particles, then
    hands off to the next motif or leaves.
- Seven chapter transitions:
  - `wipe` and `slide` follow the right-to-left reading direction;
  - `iris` with a gold ring;
  - `light_sweep`, `page_turn` and `morph`;
  - `dissolve` stays the default.
- A living light layer on every scene: drifting motes and a periodic sheen.
- Kinetic UI text:
  - chapter titles arrive word by word with a light sweep;
  - gloss boxes draw their border and type in the explanation.

  The Quran text is never animated.
- Rules:
  - `verify.py` checks motifs and transitions, and requires an action at least every 6 s in `"motion": 3`
    storyboards (gaps with no word start inside them are exempt);
  - `produce.py build` refuses non-v3 storyboards and runs `renderer/tests/motion_check.mjs`.
- Proof:
  - contact sheets: `lib_shot.mjs motifs`, `motif_phases` and `motif_stage`;
  - the first full video, 18:17–18: 1080×1920, 30 fps, H.264 + AAC 48 kHz, −14.0 LUFS. All its frames were looked
    at.
- Render speed on this VM: about 136 ms per frame, so a 1-minute video takes about 4 minutes. Two or three builds in
  parallel nearly double or triple the throughput.

### Al-Kahf
- All 33 storyboards were upgraded to v3 by hand, with 160 motifs and varied transitions. The glosses and titles
  were kept exactly as they were reviewed.
- Picture choices made for adab:
  - No motif on the killing in 18:74.
  - Nothing literal in the Hell and Paradise verses (18:29, 18:31, 18:100, 18:102, 18:106–108). Only symbols are
    used there: two_paths, scales (justice), seal, burst and light.
  - Gog and Magog never appear.
  - No crown near Dhul-Qarnayn.
  - At 18:105 the word «وزنا» (the weighing of deeds) gets no scales motif.
- Independent motif review: see below once it returns.

### Al-Fatihah (surah 1)
- Audit:
  - The text is identical to Tanzil.
  - There are no timing defects.
  - Dussary joins 6→7. That boundary is inside the video, so nothing is cut there.
- One video, 1:1–7, about 54 s: three ambient chapters, 9 glosses, motifs geometric / stars / light / hourglass /
  hands / lamp / two_paths.
- Independent review (a separate sub-agent) found 1 SERIOUS and 4 MINOR items, all fixed:
  - **Serious:** the gloss «المربي لجميع خلقه بنعمه» on «رب العالمين» pointed its arrow at the stars motif. It could
    read as if the stars were the Rabb (compare the star scene in 6:76), so the arrow was removed.
  - 1:1: a clearer excerpt, «المعبود بحق دون سواه، وهو أخص أسماء الله تعالى». The old one began with «علم», easily
    read as "knowledge".
  - 1:3: now As-Sa'di's joint explanation of both names. Muyassar gives الرحمن and الرحيم different meanings.
  - 1:4: dropped the loose «وهو».
  - 1:7: «فهم أهل الهداية والاستقامة» replaces the list of the four groups, which is the wording of An-Nisa 4:69.
- **Lesson for every surah:** a gloss arrow must never make a motif look like it stands for Allah. Use no arrow on
  glosses about Allah's names and attributes.
