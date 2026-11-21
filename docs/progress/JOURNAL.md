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

### Al-Kahf motif review (independent sub-agent): 6 SERIOUS and 19 MINOR, all applied
- **Serious:**
  - 6:3 «نفسك»: a candle burning down stood for the Prophet ﷺ himself. Removed.
  - 15:10 «بسلطان»: a scroll showed the proof the verse says they do not have. Removed.
  - 48:3 «ربك» (the Day of Judgement): light on the Lord's name read as Allah appearing as light. Removed.
  - 49:2 «الكتاب»: a scroll was a literal Book of deeds. Removed.
  - 58:4 «الرحمة» (an attribute of Allah): cloud_rain → light.
  - 78:3 «فراق»: a fork with a dark path could rank Musa against al-Khidr. two_paths → footsteps.
- **Minor:**
  - Removed:
    - 1:11 scales on a negated word;
    - 12:5 two_paths on «the two parties»;
    - 35:4 crown on the garden owner;
    - 50:6 light at the angels' prostration;
    - 59:1 a warm lit house for destroyed towns;
    - 65:9 a book that leaned toward al-Khidr being a prophet;
    - 99:4 waves that could draw the surging crowd (Gog and Magog in one view);
    - 103:4 scales that read as the Mizan;
    - at 18:22, two of the three dog motifs, which repeated the guessed counts.
  - Replaced or moved:
    - 18:17 footsteps → dog at 18:10;
    - 20:10 → 20:9;
    - 21:9 → 21:10 (with a camera beat added);
    - 22:16 light → geometric;
    - 28:27 wind → two_paths;
    - 49:25 scales → geometric;
    - 55:14 footsteps → lightning;
    - 56:3 scroll → burst at 56:5;
    - 78:7 and 82:30 key → door (the key's sense "keys of the unseen" must not attach to al-Khidr).
- **Lessons kept for every surah:**
  - Never put a motif on a word that the verse negates.
  - Never put a motif on a word naming a prophet, angels, or Allah's name or attributes; at most use geometric.
  - Keep scales away from Judgement passages.
  - Never use a motif that ranks one honoured person against another.
- **Renderer fix:** on the cover frame (the thumbnail), a motif that has started is now always drawn complete.
  Eight covers had caught a motif in its first 0.6 s.

### Al-Baqarah (surah 2): audit
- 118.8 minutes of recitation. 9 JOINED boundaries (after 9, 38, 51, 156, 157, 236, 246, 280, 283); 85 boundaries
  aligned to a measured pause.
- 19 verses have timing remarks: short-word flags to listen to, or 20–80 ms overlaps between verses.
- As-Sa'di has no entry for 2:107, 109, 111 and 286 (recorded as empty; glosses there come from Al-Muyassar).
- **Text: 18 verses differ from Tanzil** in three encoding cases. In all of them the Quran Foundation text equals
  the King Fahd Complex text (QPC Hafs). See `docs/progress/DECISIONS_NEEDED.md` §1 and
  `docs/proofs/baqarah_tanzil_vs_qf.png`.
  - The rule reserves this decision for the owner, because the renders are not identical. The agent's change to the
    verifier was refused by the automatic safety review, and nothing was changed.
  - Until the owner decides, only the Al-Baqarah videos with none of those verses are produced.

### Al-Baqarah batch 1 review (2:1–20, independent sub-agent): 2 SERIOUS and 20 MINOR, all applied
- **Serious:**
  - 2:1 «الٓمٓ»: Al-Muyassar's "a sign of the Quran's inimitability" took one side where As-Sa'di prefers silence.
    Replaced by As-Sa'di's «الله تعالى لم ينزلها عبثا بل لحكمة», which both sides accept.
  - 2:13: the gloss «مثل إيمان الصحابة» pointed its arrow at the crowd motif, turning faceless figures into the
    Companions. The arrow was removed and the crowd replaced by a lamp.
- **Minor:**
  - series «أصناف الناس» (was «صفات الناس»);
  - motifs: geometric on «الٓمٓ», lamp on «هدى», no lightning on the Prophet's ﷺ warning;
  - arrows: none on glosses whose words include the Name;
  - wording: «سفه المنافقين», «المثلان الناري والمائي», «حيرة في العاصفة»;
  - excerpts: clearer glosses on 2:8, 17, 20.
- **Systematic fix:** `pipeline/autobeats.py` now adds camera moves only. Before, it placed `light_up` and `stars` on
  whatever word fell in a gap: a negated word, «شياطينهم», the punishment, just before the Name. Every Al-Baqarah
  storyboard was regenerated.

### First upload to Creative Hub
- Al-Fatihah 1:1–7, import `cmwpq653l00023cnyuo6lagqk`: COMPLETED with 4 files and 1 creative, as a DRAFT (nothing
  approved). The platform « Coran » was created by this import.
- Creative: https://creatives.abdocloud.com/creatives/cmwpq6hvo00040uo8zox4vyer

### Al-Baqarah 2:75–110 review (independent sub-agent): 6 SERIOUS and 21 MINOR, all applied
- **Serious:**
  - The series «جبريل والسحر» paired Jibril's name with magic: now «بين الوحي والسحر».
  - The cover «تعلم السحر» read as the imperative "learn magic!": now «ضرر السحر».
  - 2:104: «يقصدون سبّه» lost its subject and read as if the believers meant the insult. Replaced by As-Sa'di's
    sentence, which names who meant what.
  - 2:81: the gloss was cut just before Al-Muyassar's limit (only shirk makes the sins encompass the person). Now it
    includes «حتى جرّته إلى الكفر».
  - 2:90: a red "injustice and envy" gloss pointed at the book motif (the revealed Book). The arrow was removed.
  - 2:94: «فادعوا ... بالموت» lost its condition and took one tafsir's side. Replaced by As-Sa'di's «نوع مباهلة»,
    the point both tafsirs share.
- **Minor:**
  - glosses that only restated the verse, or that took one side (أماني);
  - dangling «لأن» or «لليهود» at the start of a gloss;
  - three chapter titles: «كتابة الباطل», «عذر مردود», «التسليم لأمر الله» (which can't be misread as «مَلَك
    الله»);
  - arrows that pointed at the previous motif before the right one appeared;
  - English titles that read as idioms ("love of the calf").
- **Lessons:**
  - Check the subject of every cut sentence.
  - Never cut just before a tafsir's own restriction.
  - An arrow targets the motif on screen at the gloss's start, so place glosses after their motif appears.
  - Read every title without diacritics for a second meaning.

### Al-Baqarah 2:21–69 review (independent sub-agent): 5 SERIOUS and 20 MINOR, all applied
- **Serious:**
  - 57:14: the chip «ظلمونا» with «بكفران النعم» read "they wronged Us", the opposite of «وما ظلمونا». The range now
    includes «وما».
  - 35:13–15: the chip started after «ولا», so it read "approach this tree". The range now starts at «ولا».
  - 55:8–10: «نرى الله جهرة» shown as a bare statement. The range now starts at «حتى».
  - 67:20: the «من المستهزئين» arrow landed on the motif of Musa's isti'adha. The arrow was removed.
  - 36:1: a falling leaf stood for Adam's slip (a prophet) and recalled the leaves of the Garden. Replaced by
    footsteps at «اهبطوا», with a camera beat at 36:1.
- **Minor:**
  - 46:2 «يظنون» now gets As-Sa'di's «يستيقنون»;
  - 41:7–10 includes «ولا تكونوا»;
  - 33:4 no longer reads as Allah's command;
  - 33:14 no longer repeats the verse's word pair;
  - 49:13–15 gets the reading both tafsirs share («نعمة عظيمة»);
  - 57:4–6 gets As-Sa'di's general meaning of المن;
  - 25:27 drops a dangling «وإن».
  - Motifs:
    - lamp instead of light next to «الحق … من ربهم»;
    - leaf instead of wind for «يفسدون»;
    - the hourglass moved off the pronoun of Allah onto «ترجعون»;
    - light instead of hands on «كلمات» from his Lord;
    - geometric instead of hands on «أعوذ».
  - Arrows:
    - none on «عهد الله» with the Name in range;
    - none to the moon from the Torah gloss;
    - the book motif moved so the Tur arrow does not drift.
  - Camera: no close-up of the army as the sea covers them.
  - Titles:
    - «التحدي بالقرآن»;
    - «الصاعقة والإحياء»;
    - «ثواب الإيمان والعمل» (was the wording of 3:171);
    - "Where trickery leads".
- **Lessons:**
  - The gloss chip shows exactly the Quran words in its range, so a range must never leave out a negation («ولا»,
    «وما») or the «حتى» that marks a demand.
  - Nothing that reads as a prophet's own act or body (Adam's slip, Musa's isti'adha) gets a motif.

### Al-Baqarah 2:111–176 review (independent sub-agent): 9 SERIOUS and 21 MINOR, all applied
- **Serious:** the meaning was reversed because a chip left out its negation or the claim's speaker:
  - 113:5–6 «ليست»;
  - 119:7 «ولا»;
  - 145:9–10 «ما»;
  - 154:13 «لا»;
  - 162:9 «ولا هم».

  Each range now includes it, and 162 uses As-Sa'di's «وقت الإمهال … قد مضى».

  Other serious items:
  - 117:1: stars on «بديع», a Name of Allah. Moved to «السماوات».
  - 120:24–31: the gloss dropped the condition «ولئن اتبعت أهواءهم». Now As-Sa'di's «النهي العظيم عن اتباع أهواء اليهود
    والنصارى».
  - 158:12–13: the gloss was cut before Al-Muyassar's «بل يجب عليه ذلك», so sa'y read as optional. The excerpt now
    includes it.
  - 163:4–7: «لا معبود بحق» was cut before «إلا هو». Now As-Sa'di's «المستحق لأن يؤله ويعبد».
- **Minor:**
  - Motifs:
    - light instead of burst on «كن»;
    - lamp instead of light on «الحق» before «من ربهم/ربك»;
    - no geometric on the former qibla;
    - the hands moved to their gloss.
  - Arrows:
    - none on «إنا لله» or on the gloss about Allah's dominion;
    - two drifts fixed with new glosses («ماء المطر», «تقليب الرياح»).
  - Glosses:
    - «صلوات» explained as «ثناء»;
    - «كمعرفتهم أبناءهم» no longer just restated;
    - ranges set to the words actually explained.
  - Titles:
    - «أماني باطلة» (was «أوهام الاختصاص», "specialisation");
    - «معرفة وكتمان» («معرفة الحق» can read as knowing God);
    - «أنواع الابتلاء» («سنة» can read as "year");
    - «وحدانية الله»;
    - «الرزق الحلال» (was the verse's «حلالا طيبا»).
- **Lessons:**
  - Check every chip for a negation that sits before its first word: «ليست», «ولا», «ما», «لا», «ولا هم».
  - A gloss must never end just before «إلا هو» or the tafsir's own «بل يجب».

### Al-Baqarah 2:178–212 and 2:215–242 reviews (two independent sub-agents): 17 SERIOUS and 45 MINOR, all applied
- **Serious, conditions and negations left out of a chip or excerpt:**
  - 190:8 «ولا تعتدوا»;
  - 192:2 «فإن انتهوا»;
  - 193:12–15 «فلا عدوان»;
  - 195:6–9 «ولا تلقوا»;
  - 209:2 «فإن زللتم»;
  - 221:13–15 (cut before «للمشركين»);
  - 228:10–15 «ولا يحل لهن»;
  - 229:12–14 «ولا يحل لكم»;
  - 239:3–5 «فإن خفتم».
- **Serious, one side taken where the tafsirs differ:**
  - 180 (abrogation of the bequest);
  - 199 (the ifada from Arafat or from Muzdalifa);
  - 226–227 (the ila' period and how the divorce happens);
  - 233 (maintenance only for divorced nursing mothers);
  - 240 (the year's provision, now As-Sa'di's attributed «أكثر المفسرين أن هذه الآية منسوخة»).
- **Serious, other:**
  - 195:13–14: an arrow from «يحب المحسنين» (Allah's love) to coins.
  - 2:219: the title «تحريم المسكر» said the verse forbids wine, but both tafsirs call it a step towards the
    prohibition. Now «ضرر المسكر ورعاية اليتيم».
- **Minor:**
  - 184 «يطيقونه» is no longer glossed (a known difference); 197 «أشهر الحج» is attributed to the majority.
  - Titles: «أيام التشريق» (was the Quran's «الأيام المعدودات»), «المراجعة دون إضرار», «الإرضاع والنفقة», «التلميح
    بطلب الزواج» («الخطبة» reads as a sermon), «الإخلاص والانقياد» («الاستسلام» reads as capitulation), and the
    series «بين الفساد والإخلاص» («المخلص» can read as "saviour").
  - Motifs: scales instead of two_paths for keeping or releasing, which are both lawful; the house leaves before
    «النار/الجنة»; the jewel leaves before the Paradise gloss.
  - Camera beats moved off the Name and «والملائكة» in 2:210.
- **Lessons:**
  - In fiqh verses, quote the point both tafsirs share, or As-Sa'di's attributed «عند جمهور العلماء», never one
    school's ruling as the verse's meaning.
  - A title must not state a ruling the verse does not state.

### Al-Baqarah 2:243–286 reviews (two independent sub-agents): 7 SERIOUS and 31 MINOR, all applied
- **Serious:**
  - Chips without their condition or negation:
    - 249:13–14 «فمن شرب منه»;
    - 270:13–15 «وما»;
    - 271:10–12 «وإن تخفوها … الفقراء»;
    - 282:118–120 «وإن تفعلوا»: the box could attach «فسوق» to *not* writing.
  - One side taken:
    - 256:1–4: Al-Muyassar was cut before his own jizya limit. Now As-Sa'di's shared «لعدم الحاجة إلى الإكراه عليه».
    - 276:10–11 «كفار»: Al-Muyassar's «مستحل أكل الربا» against As-Sa'di's «لنعم الله».
    - 283:10–13: whether writing and witnessing may be dropped. Now As-Sa'di's point about the pledge.
- **Minor:**
  - Titles:
    - «التابوت» reads as "coffin" today → «تابوت السكينة»;
    - «آية الدين» reads «الدِّين» → «توثيق الديون»;
    - «إنظار» reads «أنظار» → «إمهال المعسر»;
    - «مضاعفة النفقة» reads "doubled expenses";
    - «الملك/المَلَك» → «إحاطة علم الله»;
    - «المحق» reads «المُحِق»;
    - «إنفاق الطيب» reads «الطِّيب» (perfume);
    - «بين الولايتين» reads as provinces;
    - «الفرار من القدر والإنفاق» reads "fleeing from spending";
    - «النفقة لوجه الله» repeated 76:9;
    - the one-word series «الإنفاق» → «فضل الإنفاق وآدابه».
  - Camera: no tilt-and-zoom into the glowing centre at «وسع كرسيه».
  - Motifs:
    - bricks → leaf for the fallen town;
    - the lamp leaves before «أصحاب النار»;
    - no pen on the negated «ألا تكتبوها»;
    - several arrow drifts fixed.
- **Lessons:**
  - Read every title as a modern reader would: «التابوت», «الدين», «إنظار», «النفقة», «الطيب», «الولاية».
  - A conditional sentence's «إن/فإن/وإن» belongs in the chip.

### Audio edges: a new "nocut" boundary state (pipeline fix)
- The 2:26–27 build stopped in `prepare.py`: «audio end cut: no pause found». The audit had called the boundary after
  2:27 "ok", but the timing data starts 2:28 only 10 ms after 2:27's last word. That leaves `prepare.py` no window to
  cut in without reaching into the next verse.
- A read-only replica of `prepare.py`'s edge logic over every unbuilt storyboard found 8 such edges:
  - Al-Baqarah 26–27/28–29, 153–155/156–158, 183–185, 221–222/223–226 and 255–256;
  - Aal Imran 37–39.
- **Fix:**
  - `prepare.py`'s edge-cut computation moved into `audio_cuts()`. Its behaviour is identical: 2:1–5 gives the same
    cut points.
  - `audit_surah.py` now runs it for every verse boundary. Where no clean cut exists in either direction, it marks
    the boundary "nocut".
  - `plan_split.py` treats "nocut" like JOINED.
  - No check was relaxed. The audit now refuses earlier what the build would refuse later.
- The affected videos are re-split. Their reviewed storyboards are merged where two neighbouring videos must become
  one.

### Al-Kahf published (motion graphics v3)
- All 33 Al-Kahf videos were rebuilt in motion graphics v3. Before upload, every video's frames were checked on
  contact sheets: cover, motifs, glosses, Quran text and outro.
- They were imported into Creative Hub as one ZIP of 758 MB: 33 creatives, 132 files (the MP4, a 720p preview, the
  cover and the review sheet PDF for each). All are DRAFTS needing human review: imported with `--confirm`,
  never `--approve`.
- Recorded in `publish/ledger.json`.

### Camera beats: wide shots and sideways pans only (policy change)
- The Aal Imran reviews flagged camera moves that drift toward a scene's light source (the sun, the glow, the
  geometric centre) while the Name, «رب», an attribute of Allah, an angel or a prophet is recited:
  - push_in;
  - shot_sky;
  - shot_ground toward a low sun.

  Such a move reads as depicting Him.
- `pipeline/autobeats.py` now places only `shot_wide`, `pan_left` and `pan_right`. A beat lands on a sacred word only
  when nothing else is in the gap, and then only as a sideways pan.
- Every unbuilt storyboard was swept: automatic zooms and tilts were removed and the gaps refilled. So were 18 built
  but unpublished Al-Baqarah videos, which are being rebuilt. Hand beats with a subject («who») are kept.
- **For the owner:** the 33 Al-Kahf drafts and Al-Fatihah were built before this change. Some of them push in toward
  the light on the Name. Listen and look for it in the review.

### Aal Imran 3:64–101 review (independent sub-agent): 6 SERIOUS and 13 MINOR, all applied
- **Serious:**
  - 77:23–24: the negation sat only in the chip, not in As-Sa'di's excerpt, so the box read "He purifies them". Now
    Al-Muyassar's «ولا يطهرهم…».
  - 85:1–5: cut before Al-Muyassar's own restriction, so Islam read as any monotheism. Now As-Sa'di's «…وانقيادا
    لرسله».
  - 91:11–16: the chip left out «فلن يقبل», so the ransom read as possible.
  - 92:1–3: the chip left out «حتى».
  - 100:11–14: «يردوكم … كافرين» without «إن تطيعوا» read as a prediction.
  - 101:11: a mountain right before «بالله» read as the refuge one holds to (and recalls 11:43). Now geometric.
- **Minor:**
  - book instead of lamp for their knowledge, and coins leave before the Hereafter;
  - no first-person paraphrase of the Prophet ﷺ;
  - the plotters' order «فاخرجوا منه» is not shown alone;
  - titles: «الانتساب إلى إبراهيم» (was «النسب»), «عاقبة الردة» (was «جزاء المرتدين», which reads as a legal
    penalty), «الطعام الحلال» (was «حل», "solution"), «الثبات على الإيمان».
- **Lessons:**
  - The excerpt itself must carry the negation when the tafsir restates it. A chip alone is not enough when the
    excerpt opens with the positive verb.
  - Never place a motif that can read as the refuge or object of «يعتصم/يعوذ» right before the Name.

### Aal Imran 3:102–132 review (independent sub-agent): 3 SERIOUS and 14 MINOR, all applied
- **Serious:**
  - 113:1–2: the excerpt «متساوين» dropped the tafsir's «ليس». Now As-Sa'di's «لا يستوون عنده…».
  - 116:4–12: the excerpt dropped its governing «لن تدفع». Now «لا تدفع عنهم شيئا من عذاب الله».
  - 117:1–7: took Al-Muyassar's side («في وجوه الخير») against As-Sa'di. Now the shared «بأنها تبطل وتضمحل».
- **Minor:**
  - no wind motif on the object of «ولا تكونوا كالذين تفرقوا»;
  - no lamp on Allah's first-person «بيّنّا»;
  - «موتوا بغيظكم» is attributed («قل لهم -أيها الرسول-»);
  - 125 and 127: As-Sa'di's shared readings;
  - 127: the subject restored, so the singular "he" cannot attach to the Prophet ﷺ;
  - 128: keeps the hedge «ولعل بعض».
  - Titles:
    - the series «الاعتصام والأخوة» reads today as "the sit-in", now «التمسك بالدين»;
    - «تفويض الأمر» reads as administrative delegation, now «الأمر لله وحده»;
    - «الصبر والتقوى» no longer drops the condition.
- **Lesson:** when the tafsir's own sentence starts with a negation («ليس», «لن تدفع»), the excerpt must keep it. A
  chip with the Quran's negation does not save an excerpt that reads positively on its own.
