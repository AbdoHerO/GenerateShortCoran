# Writing a storyboard by hand (studio mode)

A storyboard (`storyboard/<id>.json`) tells the renderer how to illustrate one passage:
- chapters, each with a title, a scene, its parameters, events and beats;
- glosses: short tafsir explanations that pop up on a word;
- the cover.

**It never contains Quranic text.** Words are referenced only by `[verse, word position]`. The Arabic, the
translation, the audio and the timings come from the Quran Foundation data and are drawn exactly as received.

Reference examples (read both first):
- `storyboard/18_17-18_r97.json`: story scene (cave, sleepers, dog, sun_arc, turn_sleepers, camera beats, 8 glosses).
- `storyboard/18_109-109_r97.json`: calm scene (sea mood, ambient beats, 3 glosses).

The contract for every scene, actor, event and beat is `renderer/js/scene_catalog.json`. `pipeline/verify.py`
enforces it.

## Workflow for one passage

1. `.venv/Scripts/python -I -X utf8 pipeline/brief.py <id>` prints:
   - the plan entry and its cautions;
   - every word with its position and its start time (seconds from the first word);
   - the translation and both tafsirs, in the exact text glosses must be copied from.
2. Load `storyboard/<id>.json` (the app's base file) and replace **only** `chapters`, `glosses`, `cover` and
   `director` (`{"mode": "hand", "notes": "..."}`). Keep every other field as it is: passage, data_dir,
   recitation_id, credits, intro/outro, tafsir labels, timing_corrections.
3. `.venv/Scripts/python -I -X utf8 pipeline/verify.py storyboard/<id>.json` must end with `PASSED`. Read every
   FAIL and fix the storyboard. Never weaken the verifier.

## Chapters

- Cover every verse exactly once, in order, with consecutive verses. Each chapter is one beat of the story, roughly
  8–30 s of recitation. A one-verse video may be a single chapter.
- **Titles** are UI text, 2–4 words of Modern Standard Arabic, no diacritics, max 28 characters. A title is a
  descriptive heading and **never quotes the Quran**: the verifier rejects any two consecutive words of the passage,
  so also avoid famous Quran phrases from other verses.
- `scene: "stage"` is for events narrated in this world. Everything else is `scene: "ambient"`: rulings,
  admonition, Allah's names and attributes, the unseen (Paradise, Hell, the Hereafter, angels, jinn, Iblis), and
  violence.

## Beats (this is what makes the video alive)

- `params.beats = [{"at": [v, w], "do": ..., "who": ..., "to": ...}]`.
- Aim for **one beat every 3–6 s** of recitation, on meaningful words: the word that names the thing, the verb of
  the action, the start of speech. Beats must be at least 0.8 s apart, at most 24 per chapter.
- Vary the camera: shot_wide, then shot_close on whoever acts or speaks, then pan toward where the sun goes, and so
  on.
- In stage scenes, use actor beats for dialogue and feeling:
  - `speak` on the speaker when a speech starts;
  - `raise_hands` for du'a;
  - `bow` for regret or humility;
  - `point` when someone shows something;
  - `wring_hands` for regret;
  - `walk_to` for movement.
- In ambient scenes, use the ambient beats: light_up, stars, rain_start/stop, bloom, wither, waves, pattern_turn,
  ink_waves.
- Events (stage) are the big moments (`at` = the word that states them). Beats are the small ones in between.

## Motion graphics v3 (required for every video)

Every storyboard that is built and published must carry `"motion": 3` at the top level. `produce.py build` refuses
anything else, and `verify.py` then enforces the v3 rules below.

### Motifs (`params.motifs`, on ambient and stage chapters)

```json
"motifs": [{"at": [17, 2], "until": [17, 14], "motif": "sun", "place": "top", "size": "s", "exit": "fly"}]
```

- A motif is a line-art symbol on a cream plate with a gold ring. It **draws itself on** at the word `at`, then
  **lives**: it breathes with every recited word and has its own motion and particles. It **leaves** at `until`,
  when the next motif at the same place starts (the match cut, done automatically), or at the chapter end.
- `motif`: one of the library in `renderer/js/scene_catalog.json` → `motifs.library` (44 symbols: book, scroll, pen,
  scales, hourglass, two_paths, door, key, lamp, candle, sun, moon, stars, cloud_rain, drop, wave, growth, leaf,
  mountain, wind, coins, jewel, crown, house, ship, fish, cave, dog, hands, chains, burst, crowd, geometric, light,
  palm, wheat, fire, lightning, footsteps, bricks, bird, night_day, river, seal). Proof sheet:
  `node renderer/tests/lib_shot.mjs motifs`.
- `place`: `top` (best over stage scenes: it stays above the actors), `center`, `left`, `right` or `bottom`.
  `size`: `s` (170 px, use on stage scenes), `m` (240 px, ambient scenes), `l` (320 px, a single big symbol).
- `exit` (optional): `dissolve` (default), `fly` (rises out), `undraw` (the strokes retract).
- Put each motif on the word that **names** the concept. Aim for one motif every 4–8 s in ambient chapters and
  1–3 per stage chapter (the actors and events carry the story there).
- At least 0.8 s between motif starts; at most 16 per chapter.
- A gloss may point at the motif on screen with `"target": "motif"`.
- **Adab:**
  - Allah and His attributes are never a figure: for His names, attributes and words, use `geometric`, `light` or
    `seal`.
  - Prophets, angels and honoured people stay as light drops in the scene, never as motifs.
  - `fire` is only worldly fire, never Hell. The unseen gets no literal motif: use `light`, `geometric`, `hourglass`
    or `scales` as symbols.
  - `crowd` is drawn uncountable; `crown` is never on a prophet.

### Transitions (`params.transition`, on the chapter that begins)

`dissolve` (default), `wipe`, `iris`, `light_sweep`, `slide`, `page_turn` or `morph`. Forward motion follows the
right-to-left reading direction. Vary them across a video, and match them to the meaning:
- `light_sweep` for guidance or revelation;
- `page_turn` for a new episode of a story;
- `iris` to focus in on a scene;
- `morph` for "and then";
- `wipe` or `slide` for a change of place.

### Density rule

In every chapter, at least one beat, motif or event must start every 6 s of recitation (from the first word to
the last). The verifier names the gap when it fails. `renderer/tests/motion_check.mjs` also renders the whole video
and fails if any 2-second window of the picture is still.

### Kinetic UI text (automatic)

Chapter titles arrive word by word with a light sweep. Gloss boxes draw their border and type the explanation in.
The Quranic text is **never** animated, deformed or revealed letter by letter: the verse card keeps its exact
Mushaf rendering, with only the gold highlight.

## Glosses

- Copy the excerpt **character for character** from the tafsir text of **that verse**, as printed by `brief.py`:
  same spelling, diacritics and punctuation. Pick explanation words only. Never pick text inside `{ }` or `﴿ ﴾`,
  never two consecutive words of the verses, and never a fully vocalised Quran word. Max 64 characters; 12–45 reads
  best.
- Al-Muyassar (16) is usually the clearest. As-Sa'di (91) is fine when it explains better.
- About one gloss every 6–12 s, on the words a viewer most needs explained. Starts must be at least 1 s apart; aim
  for 3 s or more.
- `target`: an anchor of the chapter's scene, or "" for no arrow. Ambient anchors are center, sky, light and
  ground; stage anchors are center, sky, ground and the actor ids. Only target an actor who is visible at that
  moment.
- `tone`:
  - red: punishment, warning, disbelief;
  - green: mercy, faith, reward;
  - blue: neutral explanation;
  - amber: time, place, emphasis, a sign.
- Where the two tafsirs differ (for example on whether al-Khidr was a prophet), never choose an excerpt that takes
  one side as fact.

## Cover (first frame and thumbnail)

`cover = {"series_ar", "series_en", "title_ar", "title_en", "at": [v, w]}`.
- Take the series and title from the surah plan (`plans/<surah>.json`).
- The Arabic titles follow the title rules: no diacritics, never quoting the Quran (a story's well-known name, like
  أصحاب الكهف, is allowed as the series name).
- `at` is the word whose picture is the most telling for the thumbnail.

## Picture rules (critical)

- Allah is never depicted.
- Prophets appear only as `prophet` light drops with a name label; angels only as `angel` drops; honoured people
  (for example Yusha' bin Nun, al-Khidr) only as `honored`/`prophet` drops with a name label.
- People are faceless.
- No killing or violence is ever shown.
- Never show a countable group where the Quran leaves the number to Allah. For sleeping figures, use the
  `sleepers` actor. For an awake group, use a group actor with `"uncountable": true` (e.g. the youths of the cave).
- Where scholars differ on someone's status, use the neutral `honored` drop (green) with their name, not `prophet`.
  Examples are al-Khidr (label «الخضر») and Yusha' bin Nun (label «يوشع بن نون»).
- Dhul-Qarnayn's status is uncertain. A hadith reports the Prophet ﷺ saying «ما أدري ذا القرنين أنبيًّا كان أم لا».
  So he is a neutral `honored` drop labelled «ذو القرنين», never a human figure and never `king`. Gog and Magog
  are never drawn.
- A gloss must keep its meaning when cut out of its sentence. Never cut a negation or a condition
  («إن فعلتم ذلك»). Never show a disbeliever's claim on its own as if it were a statement. Never let a first-person
  paraphrase of Allah's words read like a quotation.
- Follow the cautions printed by `brief.py` for each video.


### Camera beats and edges (added 2026-11-21)
- Automatic camera beats (`pipeline/autobeats.py`) are `shot_wide`, `pan_left` and `pan_right` only. No push_in,
  shot_sky or shot_ground drifts toward a scene's light while the Name, «رب», an attribute, an angel or a prophet is
  recited. Zooms are written by hand, on chosen words, and never there.
- Video edges: `audit_surah.py` marks "nocut" boundaries, which have a pause but no clean audio cut.
  `plan_split.py` treats them like JOINED. When an edge turns out to be "nocut", re-split along chapter lines; never
  cut a chapter.
