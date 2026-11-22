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

### Aal Imran 3:180–200 review (independent sub-agent): 1 SERIOUS and 17 MINOR, all applied
- **Serious:** 188:13–17 limited «بمفازة من العذاب» to this world (Al-Muyassar only). Now As-Sa'di's general «بل قد
  استحقوه، وسيصيرون إليه».
- **Minor:**
  - Glosses:
    - 180 no longer types the forbidden belief («أن هذا البخل خير لهم»);
    - chips keep «إن كنتم صادقين»;
    - 192 keeps its «وما»;
    - 194 uses As-Sa'di's reading that includes the Hereafter;
    - 199 and 200 glosses fitted to their words.
  - Motifs:
    - the coins leave before «سيطوقون»;
    - the lit house leaves before «جنات» (it would read as a dwelling in Paradise);
    - the footsteps sit on «هاجروا».
  - Titles:
    - «مقولة شنيعة» («مقالة» reads as "article");
    - «خيانة الميثاق»;
    - «تلبية النداء»;
    - «رجاء الوعد» («سؤال الوعد» reads as questioning it);
    - English titles reworded.
- **Lesson:** a motif from this world (coins, a house, a jewel) must leave before the verse turns to the Hereafter,
  or it reads as part of it.

### Aal Imran 3:140–175 review (independent sub-agent): 12 SERIOUS and 25 MINOR, all applied
- **Serious, the condition or negation dropped (prophecy or statement in place of a condition):**
  - 149 «إن تطيعوا»;
  - 157 «ولئن قتلتم»;
  - 159 «ولو كنت» (the excerpt described the Prophet ﷺ as harsh);
  - 169 «ولا تحسبن» (the excerpt said the martyrs are dead);
  - 144:10–16 «رجعتم عن دينكم» (stated that the Companions apostatised).
- **Serious, other:**
  - 161: cut before Al-Muyassar's limit «غير ما اختصه الله به»;
  - 168: the hypocrites' claim shown as a statement;
  - 154 and 167: one tafsir's reading.
  - Motifs:
    - two_paths at 152 ranked the Companions into guided and misguided;
    - a lamp on the Prophet's ﷺ act «ويعلمهم» (evoking «سراجا منيرا»).
  - The 175 English title took one reading.
- **Minor:**
  - glosses restored to explain their own words;
  - motifs moved off Allah's acts («ويعلم», «عفا»);
  - a falling leaf for «مصيبة» read as the fallen, now waves;
  - Titles:
    - «الولاء لله» («ولاية» reads as a province or mandate);
    - «الوعد والزلة» («العصيان» reads as mutiny);
    - «منة البعثة النبوية» («البعثة» reads as a delegation or scholarship);
    - «ثواب محفوظ» («حفظ الأجور» reads as wage protection);
    - «استجابة رغم الآلام» («الجراح» reads as «الجرّاح», surgeon);
    - «الأجل المحتوم» and «عون الله» (both avoid Quran wording).
- **Lessons:**
  - In battle passages, never rank the Companions with a motif.
  - Never let an excerpt say what the verse negates (the martyrs dead, the Companions apostate) even if the chip
    carries the negation.

### An-Nisa 4:1–57 reviews (two independent sub-agents): 8 SERIOUS and 29 MINOR, all applied (2026-11-21)

- **Pictures (5 serious, 8 minor):**
  - Worldly motifs that stayed on screen over sensitive words: coins and a jewel over «فما استمتعتم به منهن…
    أجورهن» (24) and over «غير مسافحات ولا متخذات أخدان» (25), coins over the rest of 4:34. Fixed with `until`,
    a seal for «فريضة», or removal.
  - Coins on a negated word («ومن لم يستطع منكم طولا», 25:5) and on objects of blame (10:4, 19:16): removed.
  - A crown on «ملكا عظيما» (54): As-Sa'di reads it as the prophets' kingship; removed.
  - Minor: bricks moved onto «حدود», a leaf (decay) replaced by growth on «وأصلحا», two paths (guidance vs. error)
    replaced by scales on «حكما» so neither spouse is cast as misguided, a scroll limited to «الكلم».
  - The same lingering-motif check was applied to 58–104 (29:12, 85:3, 89:13, 100:15 got `until`).
- **Glosses (3 serious, 21 minor):**
  - 24:4–7: the captive-women excerpt read as lawful "to the Muslims" as a group; now Al-Muyassar «سبيتم منهن في
    الجهاد».
  - 24:11–15: «كل ما لم يذكر في هذه الآية فإنه حلال» stated a false absolute in a one-verse video; now «وأجاز لكم
    نكاح من سواهن».
  - 19:4–10: As-Sa'di's «فنهى… عن جميع هذه الأحوال» cut before his own exception «إلا حالتين»; now «وهن كارهات لذلك
    كله» on «كرها».
  - Minor: kept the condition «فإن خاف» (3), the third condition of repentance «وعزما على أن لا يعودا» (16),
    dropped one tafsir's reading (6 «رشد», 11 «فوق اثنتين», 14 «يعص», 43 «صعيدا»), dropped a pointer to a
    non-canonical reading (12), dropped As-Sa'di-only framings in 21 and 34:25–28, fixed «أمر اليهود» (read
    as "He commanded the Jews").
  - Titles: «أموال الأيتام», «ظلم الأيتام» (avoid Quran wording), «الثناء على النفس» («تزكية النفس» means
    praiseworthy self-purification), «الحسد على النعمة», «التيسير ورفع الحرج».
- **Lessons:**
  - A motif is judged by everything it stays over, not only its first word: give worldly motifs an `until`.
  - In sensitive passages, never let money or adornment sit next to women.
  - An excerpt that says "this verse" lies when the video holds only part of the list.

### Al-Baqarah: first 23 videos published as drafts; one stuck empty import (2026-11-21)

- 23 videos (2:35–56, 97–121, 142–148, 159–161, 188–208, 243–245) frame-checked and imported as drafts
  (92 files, 0 rejected, 0 approved). Ledger updated.
- An earlier upload attempt of the same ZIP was interrupted while uploading: import
  `cmwpv55d1000i3cnyb4i3vh83` stays in status UPLOADING with 0 files. It created no creatives. Cancelling it
  needs the owner's permission (the agent's cancel call was refused). It is harmless, but the owner may cancel it
  in the app.
- Builds now run in one detached manager (`buildall.sh`, 3 workers) because background shells are stopped after
  2 hours; the chained queues lost two runs that way.

### An-Nisa 4:58–115 gloss review (independent sub-agent): 4 SERIOUS and 13 MINOR, all applied (2026-11-21)

- **Serious:**
  - 76:13–15: «أهل الكفر والشرك الذين يتولون الشيطان» under «فقاتلوا» read as a general command against all
    non-Muslims. The chip is narrowed to «أولياء الشيطان», with only who they are.
  - 75:1–7: As-Sa'di's «تهييج… على القتال» read as a general call to fight. It is replaced by his own restriction:
    «من باب القتال والذب عن عيلاتكم وأولادكم ومحارمكم».
  - 91:15–22: the excerpt dropped «ويكفوا أيديهم» and took Al-Muyassar's «الاستسلام التام» before «فخذوهم
    واقتلوهم». It is now As-Sa'di's «اعتزال المؤمنين وترك قتالهم».
  - 93:7–8: «فلا يجازيهم بالخلود» under «خالدا فيها» looked like a contradiction of the recited words. It is now
    Al-Muyassar's hinge «إن جازاه على ذنبه», in red.
- **Minor:**
  - Glosses:
    - dropped Al-Muyassar's «مستسلمين» for «السلم» in 90;
    - kept «لمن اتقى» out of a chip whose excerpt lacked it;
    - kept the fourth condition of istighfar (110);
    - kept Al-Muyassar's «قولا مؤثرا» instead of As-Sa'di's «سرا» (63);
    - narrowed «كل من حكم بغير شرع الله فهو طاغوت» to the hypocrites' disputes (60);
    - fixed «أمر أولئك» (read as "He commanded").
    - replaced three dangling or headless fragments (68, 83, 87).
  - Titles: «الجمع للحساب» («يوم الجمع» is a Quranic name of the Day), «الذكر بعد الصلاة».
- **Lessons:**
  - In fighting passages, never gloss the object of «قاتلوا» with a general label: keep the tafsir's own restriction
    (defence, those who fight).
  - Never put a gloss that seems to deny the recited words under them; use the tafsir's hinge.

### An-Nisa 4:58–176 picture review (independent sub-agent): 5 SERIOUS and 20 MINOR, all applied (2026-11-21)

- **Serious (all were symbols lingering after their word):**
  - Hands of «أسلم» stayed over «ملة إبراهيم… خليلا».
  - Geometric (Allah) stayed over 159, where every pronoun is Isa.
  - A lamp stayed over «فقاتل» (84).
  - Light stayed over «وأرسلناك للناس رسولا» (79) and over «يحكموك… قضيت» (65).
  - All now carry an `until`.
- **Minor:**
  - `until` on ten more motifs (over prohibitions, claims, blamed acts, the angels).
  - Removed:
    - two paths that split believers' disputes or the Companions into guided and misguided (59, 88: moved onto «أركسهم»);
    - hands on «السلم»;
    - a lamp, and a moon on blamed night plotting.
  - Footsteps moved off a negated «سبيلا».
  - 171's mood changed from light to geometric (rays could read as the spirit descending on Maryam).
- **Rule:** `until` is exclusive (the exit starts when that word begins). The same check was applied at once to
  the Al-Ma'idah storyboards written so far (8 motifs given an `until`).

### An-Nisa 4:116–176 gloss review (independent sub-agent): 2 SERIOUS and 14 MINOR, all applied (2026-11-21)

- **Serious:**
  - 157:32–34: «بل شاكين متوهمين» under «وما قتلوه يقينا» could read as "they killed him but were unsure". It was
    dropped; 157:10–16 already says what both tafsirs say.
  - 140:15–17: «فلا تجلسوا مع الكافرين والمستهزئين» read as a general ban. The chip is now 15–22, with As-Sa'di's
    «غير الكفر بآيات الله والاستهزاء بها».
- **Minor:**
  - Glosses:
    - 171 «وروح منه» reduced to what both tafsirs share, «نفخها جبريل بأمر ربه»;
    - 150 keeps only the refutation «إن هذا إلا مجرد أماني»;
    - 148 keeps the limit «ليبين مظلمته»;
    - 176 no longer drops «إن لم يكن لها ولد»;
    - dangling conditionals narrowed (143, 176);
    - «سلطانا» glossed as «حجة ظاهرة».
  - Titles: «خداع الشيطان» («غرور» reads as conceit), «حقيقة المسيح» («الحق في…» reads as "the right to"), «فضل
    الصلح», «تربص المنافقين», «تردد المنافقين», «حكم الكلالة», cover «إرث الإخوة والأخوات».
- With this, all 63 unblocked An-Nisa storyboards have had both independent reviews and are queued for building.

### Al-Ma'idah: audit, plan and all 46 unblocked storyboards written (2026-11-21)

- **Audit:**
  - Recitation: 55.3 min.
  - JOINED after 64, 97, 117 and 119; no clean cut after 13 more verses.
  - Short-word flags: 90, 93.
- **Text:**
  - 5:111 is the small-yā' case of DECISIONS_NEEDED §1.
  - **5:52 is a new kind of case:** the Quran Foundation API serves word 12 «دائرة» with a space inside the word
    (`'دَآئِرَ ةٌۭ ۚ'`). QPC Hafs and Tanzil have one word. The text was not touched; video 5:51–52 is blocked and
    the case is in DECISIONS_NEEDED §1.
- **Timing:** 5:84 overlaps 5:83 by 20 ms, so video 5:82–84 is blocked (§2).
- **prepare.py fix (surah-final verse):**
  - The timing data ends 5:120 at 3418.0 s, but the reciter's last elongation sounds until 3419.1 s; silence
    (-30 to -47 dB) follows.
  - The end-cut search after a verse with no next verse was limited to 0.6 s, so the check failed at -21 dB.
  - It now looks up to 2.5 s when nothing follows. `find_cut` still takes the quiet point nearest the timed end
    under the same -26 dB limit, so every cut that was found before is unchanged (re-checked on 2:286, 3:200, 4:176).

### Al-Ma'idah: independent reviews applied (2026-11-21)

Three independent reviewer sub-agents: glosses 1-58 (228 glosses), glosses 59-120 (204 glosses), and motifs over
all 46 videos. Reports: `out/wip/review_5a_gloss.md`, `review_5b_gloss.md`, `review_5_motif.md` (not committed).

- **Glosses 1-58: 2 serious, 14 minor.**
  - Serious:
    - 5:26 no longer stops before «أربعين سنة»: it is now As-Sa'di's «وهذه عقوبة دنيوية» over words 1-6.
    - 5:21 no longer reads as a present-day command to fight; only «فتخسروا خير الدنيا وخير الآخرة» is kept.
  - Minor:
    - 5:27 chip narrowed, so «لأنه كان تقيًّا» is not under «ولم يتقبل من الآخر».
    - Dangling or headless fragments replaced (5:8, 5:43, 5:58), and 5:56 is narrowed.
    - 5:50 no longer repeats «حكم الجاهلية».
  - Titles:
    - Series «الحكم بالوحي» (was a doctrinal phrase of the Quran).
    - Covers «الوحي أو الهوى» and «نور القرآن».
    - Chapters «الرسول والقرآن», «المحبة والولاية», «صرف بطش الأعداء» and «صيانة الحرمات».
- **Glosses 59-120: 2 serious, 19 minor.**
  - Serious:
    - 5:74 lost a leading «من», so it no longer reads "seek forgiveness *for* tawhid".
    - Cover «رفع الحرج» became «ما قبل التحريم»: under the wine series, the old title read as "no blame".
  - Minor:
    - 5:115 no longer takes a side on whether the table came down.
    - 5:66 is reduced to «فريقًا معتدلا»; 5:118 is now Al-Muyassar's «تفعل بهم ما تشاء بعدلك».
    - Dropped: 5:106 «صلاة المسلمين» and 5:87 «ولا تعتدوا»; the tafsirs differ on both.
    - Chips narrowed (5:60, 5:90, 5:92, 5:106).
  - Titles:
    - «وحدانية الله», «صلاح الناس وأمنهم», «أكل الحرام», «ما يعيبونه علينا» and «أسوأ الجزاء».
    - «السكوت عن المعاصي» («التناهي» reads as finiteness).
    - «ترك السؤال المنهي عنه» (was 5 words) and «المباح والممنوع في الإحرام».
- **Motifs: 2 serious, 14 minor.**
  - Serious:
    - The light after 90:15 no longer stays over the Shaytan, wine and gambling of 91.
    - The dog of 4:13 leaves before the Name in 4:17.
  - Minor:
    - Lingering motifs cut with `until` (1:5, 2:38, 14:7, 23:11, 26:5, 48:42, 65:9).
    - Scroll removed from «يحرفون الكلم» (13:9, 41:28).
    - Scales moved off the Prophet's ﷺ own act to «المقسطين», and 49:2 replaced by a book.
    - 55 geometric limited to the Name; 93 growth leaves before the negated «جناح».
    - Mood of 27-29 is now night_sky.
- **Verifier gaps the reviewers found** (to strengthen, never weaken):
  - The title skeleton reads the dagger alif as a full alif, so «إله واحد» against «إِلَـٰهٌۭ وَٰحِدٌۭ» was missed.
  - Prefixes such as «أف» are not stripped in the bigram check, so «حكم الجاهلية» against «أفحكم الجاهلية» was missed.
- All 46 storyboards re-verified PASSED and are queued for building.

### Al-An'am 59-83: six storyboards (2026-11-21)

- 59-60, 67-70, 71-73, 74-77, 78-79 and 80-83 are written, verified and cut-checked.
- Care points:
  - Ibrahim has no motif or figure.
  - No star, moon, sun or idol is drawn; 76-78 use the geometric mood (no sky).
  - Every «هذا ربي» is glossed as argument with the opponent, as both tafsirs say.
  - 71:11-17 (a rhetorical question) is not glossed.
  - The unseen, the Horn and the Fire are not drawn.

### Al-An'am: all 45 unblocked storyboards written; reviews started (2026-11-21)

- 59-165 written in seven batches, all verified PASSED and cut-checked.
- **Care points:**
  - No first-person paraphrase of Allah.
  - Every claim, invented rule (136-140), excuse (156-157) and the fate argument (148) is framed by the tafsir.
  - Disputed points are left unglossed: 89 «قوما», 91:31-37, 125 «الرجس», 128 «إلا ما شاء الله», 131, 151 «إلا
    بالحق».
  - 145 is glossed so the list is not read as exhaustive.
  - No prophet, angel, jinn, idol, killing, slaughter or the unseen drawn.
- Three independent reviewers are running: glosses 1-90, glosses 91-165, and motifs (reports in `out/wip/`).

### Al-A'raf: audit and plan (2026-11-21)

- **Recitation:** 69.3 min.
  - 47 JOINED boundaries and 15 with no clean cut.
  - Three long units cannot be split: 47-53 (258 s), 96-102 (167 s), 142-147 (165 s).
- **Text:** two encoding differences from Tanzil, both cases already in DECISIONS_NEEDED §1:
  - 7:161 (hamza with dagger alef);
  - 7:196 (small yā').
  - Videos 160-162 and 196-198 are blocked.
- **Timing:**
  - 7:203 overlaps 7:202 by 40 ms; video 201-203 is blocked (§2).
  - Short-word flags: 81, 169, 180, 197, 201.
- **Plan:** `plans/7.json`, 60 videos in 12 series. 193-198 and 199-203 were split at clean pauses, so that only the
  part with the affected verse is blocked.

### Al-An'am: the three independent reviews applied (2026-11-21)

- **Motifs: 1 serious, 9 minor.**
  - Serious: the `dawn` mood draws a rising sun, and it sat under Ibrahim's argument (6:74-75, and 80-81). The moods
    are now `light` and `geometric`.
  - Minor:
    - Spans shortened so no motif sits over the Name, a claim, «ولا يُطعم» or a blamed act (14, 57, 118, 126, 136,
      150).
    - Night sky for the threat and claim chapters (10-11, 136).
- **Glosses 1-90: 3 serious, 25 minor.**
  - Serious:
    - 6:50 chip widened, so «عندي خزائن الله» never shows without «لا أقول لكم».
    - 6:78-79 no longer read as Ibrahim's own conversion; now As-Sa'di's «المقام مقام مناظرة».
    - 6:55 no longer has a first-person paraphrase.
  - Minor:
    - Chips realigned (25, 31, 32, 46).
    - Glosses replaced where they quoted other verses (17 «فلا راد لفضله», 45, 59 «علم الساعة… الأرحام», 79).
    - Renunciation and condition readings fixed (24, 70, 82).
  - Titles:
    - Sixteen changed, e.g. «طلب رسول ملائكي» (was «طلب الملك», "seeking kingship").
    - Series «العلم والتدبير» (was «علم الغيب», 53:35).
- **Glosses 91-165: 9 serious, 17 minor.**
  - Serious:
    - 6:104 had lost its negation («أحصي أعمالكم»).
    - 6:130 stated a disputed point without its hedge.
    - 6:145-146: the exhaustiveness question is now framed as «واختلف العلماء… في هذا الحصر», and the tafsirs'
      disagreement on the rump fat is left out.
    - 6:148 had a dangling «إلا».
    - 6:158 had lost its condition.
    - 6:94 dropped the exception for deeds.
    - 6:108 generalised «عقوبة لهم».
  - Minor:
    - Quotations of other verses removed (139, 150, 163, 91, 118).
    - Chips realigned (109, 121, 156).
    - 107's two affirmative definitions of negated words dropped.
  - Titles:
    - Fifteen changed.
    - Series «عظمة الخالق وآياته» and «الهداية والضلال».
    - English «Allah's ten counsels» for «الوصايا العشر».
- **Verifier made stricter (never looser):**
  - A gloss must start and end on word boundaries of the tafsir; only a leading «و/ف/ب/ل/ك» may be left out. This
    catches «لا مستند له» cut from «لهم».
  - Each dagger alef may be read as an alef or as nothing, independently («السموات»).
  - All storyboards were re-verified; the only new failure is the published 2:107-110 (DECISIONS_NEEDED §3).
- **Data note:** As-Sa'di's 6:89 entry repeats his 6:88 text, so no 6:89 excerpt may come from tafsir 91.

### Al-A'raf: all 57 unblocked storyboards written; reviews started (2026-11-21)

- 1-206 written in twelve batches, all verified PASSED and cut-checked. Transitions now vary with the meaning
  (light_sweep, page_turn, wipe, iris, morph, slide).
- **Care points:**
  - Adam, Hawwa and every prophet are never drawn or given a motif.
  - Iblis's and the Shaytan's claims are framed («معارضا لربه», «في محاولة المكر بهما», «وهو كاذب في ذلك»).
  - The garden, the Mizan, the heights, the Fire and the Hour are not drawn.
  - Disputed points are left unglossed: 37 «نصيبهم من الكتاب», 46 who the men of the heights are, 93 when Shu'ayb
    turned away, 137 which land, 145 «دار الفاسقين», 175 who the man was.
  - 189 carries Al-Muyassar's «والمراد جنس الزوجين من ذرية آدم».
  - Allah's own speech in 143 and 156 is not paraphrased.
- **Lesson:** trimming an excerpt to avoid a Quran bigram must never drop a negation. 7:89 «وليس لنا أن…» was cut to
  «نتحول إلى غير دين ربنا» and was removed at once.
- Three independent reviewers are running: glosses 1-102, glosses 103-206, and motifs/moods/transitions.

### Al-Anfal: audit, plan and all 23 unblocked storyboards (2026-11-21)

- **Audit:**
  - 25.0 min of recitation.
  - Text: two cases already in DECISIONS_NEEDED §1, 8:6 «بعد ما» (spacing) and 8:66 «الآن» (hamza).
  - Timing: 8:47 overlaps 8:46 by 60 ms (§2).
  - Short-word flags: 44, 54, 70.
- **Plan:** `plans/8.json`, 26 videos. Blocked: 6-8, 46-47 and 66. One long unit, 56-61.
- **Care:**
  - The battle, the angels, the Shaytan, weapons, killing and captives are never drawn.
  - Fighting verses keep only what both tafsirs say, with their restrictions: 15-16 exceptions, 39 «فتنة» = «شرك
    وصد عن سبيل اللّه», 45 «طائفة من الكفار تقاتلكم», 57 «في حال المحاربة… لا يكون لهم عهد», 58 «من قرائن
    أحوالهم… وأخبرهم», 60 «الساعين في هلاككم», 61 peace, 72 the treaty exception.
  - «فشرد بهم», «ترهبون به» and the striking in 12 and 50 are not glossed.
  - No people are named politically (Al-Muyassar's naming in 56 is not used), and As-Sa'di's «حزب الله» is avoided.
- Two independent reviewers are running (glosses; motifs).

### Al-A'raf reviews applied: glosses 103-206 and motifs (2026-11-21)

- **Glosses 103-206** (0 serious, 25 minor), all applied:
  - 157 now names the Prophet with ﷺ: «الذي لا يقرأ ولا يكتب، وهو محمد صلى الله عليه وسلم».
  - Fixed:
    - a misspelt salutation (150);
    - a first-person reading (142);
    - a dropped condition (185);
    - a side taken on the dog simile (176);
    - a pronoun with no referent (133);
    - «مدبر», which reads as "fleeing" (188);
    - unmarked quotations of 33:23, 9:112 and 6:157 (174, 165, 177);
    - a restated verse (155);
    - a stray comma (149);
    - «احبسهما», As-Sa'di's view alone (111);
    - two tatweels (114, 165).
  - Five optional gloss notes (168, 180, 181, 192, 199) were also applied.
- **Titles:**
  - Covers:
    - «ميثاق الفطرة»: «الميثاق الأول» implied the 'alam al-dharr reading that As-Sa'di rejects.
    - «الهوى بعد العلم»: «العالم» read as "the world".
    - «التوفيق والخذلان».
    - «موعد المناجاة».
    - «الغيرة لله».
  - Eleven chapter titles no longer restate the verse; «المستضعفين» (a political slogan word) is gone.
  - Series 158-171 is renamed «عبر من بني إسرائيل».
- **Motifs** (2 serious, 15 minor):
  - SERIOUS:
    - The `mountains` mood lit a sparkle on the summit at «فلما تجلى ربه للجبل»; 142-143 is now `geometric`.
    - The rising sun stood over the prostration verse 206; it is now `light`.
  - Dawn removed from four threat or blame chapters (34-36, 52-53, 168-169, 189-190).
  - Sea removed under «وأغرقنا» (63-64) and the idol request (138-139).
  - Palm groves removed under «الشجرة» (20-22).
  - Eight motif spans trimmed: off the Prophet's self-description, off «ربكم», off the angels and «نوح», and off the
    disbelievers' reply and the punishment.
- **Lesson:**
  - A mood is a picture too.
  - `mountains` draws light on a summit and `dawn` draws a sun: never use either where the verse speaks of Allah's
    manifestation, a prostration, a threat or a punishment.
  - The glosses 1-102 reviewer is still running.
- **For the human reviewer:** at 7:193 the English translation (believers inviting the idolaters) differs from both
  tafsirs (idolaters calling their idols).

### Al-Anfal motif review applied (2026-11-21)

- 0 serious, 7 minor; all applied:
  - Light no longer stays over the threat to the captives (71) or over «فقد خانوا».
  - Coins leave before «أولئك هم المؤمنون حقا».
  - Light moves off the Messenger's call onto «لما يحييكم».
  - The light now stays on «يستغفرون» (33).
  - Dawn removed under «فأخذهم الله بذنوبهم» (52-53) and under the hypocrites' claim (49).
  - The c2 transition of 38-40 is now a dissolve, so no gleam falls on the command to fight.
- Left for the human reviewer: the dawn over 60 and 65, and the mountains for Badr's valley (42).

### Al-A'raf glosses 1-102 review applied (2026-11-21)

- 2 SERIOUS, 32 MINOR; all applied, plus the optional notes.
- **SERIOUS:**
  - 7:51: the chip «وما كانوا بآياتنا يجحدون» was cut from its «كما», and with the tooltip «مع علمهم بأنها حق» it read
    as "they did not reject Our verses". The gloss is now the full «ولكونهم بأدلة الله وبراهينه ينكرون مع علمهم بأنها
    حق».
  - 7:94: the chip «وما أرسلنا في قرية من نبي» stopped before «إلا أخذنا…» for 16.8 s, which read as a denial that
    prophets were sent. The chip now runs to word 11.
- **MINOR:**
  - Cut constructions narrowed (20, 24, 43).
  - Dropped conditions fixed (3, 94).
  - Sides no longer taken (52 dropped, 79 «بعدما أهلكهم» removed).
  - Unmarked Quran wording removed (19, 31, 42, 54 dropped, 57, 77, 79, 100, 101).
  - The «سميتوها» typo removed (71).
  - A Latin «;» removed (99).
- **Titles:**
  - Twelve chapter titles and two covers changed: «النهي والخديعة», and «لوط وقومه» replaces the exact Quran phrase
    «قوم لوط».
  - «براءة شعيب» (modern sense "innocence") is now «تبرؤ شعيب».
- **Lesson:** a chip that opens on «وما» or «ما» must be checked for a negation reading. A «ما… إلا» or «كما… ما»
  construction must never be split across chips, especially when the reciter holds the last word.

### Al-Anfal gloss review applied (2026-11-21)

- 8 SERIOUS, 24 MINOR; all applied, plus the optional notes.
- **SERIOUS:**
  - 8:12 «الرعب»: «أعظم جند لكم عليهم» was shown over the striking; it is now «الخوف الشديد والذلة والصَّغَار».
  - 8:37: an unbraced As-Sa'di quotation of 39:15.
  - 8:50: «ولكنه عام في حق كل كافر» under «يضربون وجوههم» read as a general licence; it is dropped.
  - 8:55: As-Sa'di's three traits restored («الكفر، وعدم الإيمان، والخيانة»).
  - 8:60: «الآن» gave a present-day reading.
  - 8:70: the condition «إن يعلم الله في قلوبكم خيرا» is now inside the chip.
  - 8:73: «موالاة المؤمنين ومعاداة الكافرين» read as a general order of hostility; it is now Al-Muyassar's «نصراء
    بعض».
  - 8:75: a gloss under «إن الله بكل شيء عليم» could read as limiting His knowledge.
- **MINOR:**
  - The battle condition in 8:15 («إذا التقى الزحفان»).
  - The addressee in 8:19.
  - Dropped conditions in 8:26 and 8:38.
  - «من مال الكفار قهرا» (8:41) and «حثهم… بكل ما يقوي عزائمهم» (8:65) removed.
  - «وجاهدوا لإعلاء كلمة الله» (8:74) dropped.
- **Titles:**
  - Series «أحكام الجهاد» is now «الكفاية والرحمة», and «الولاية بين المؤمنين» is now «الأخوة الإيمانية».
  - Covers changed: «تقوية العزائم», «صدق الانقياد», «الأمانة والاختبار», «عاقبة الجحود», «أخوة الإيمان»,
    «المحبة والتناصر».
  - Chapter title «الإعداد» (a slogan word) is now «الاستعداد والبذل».
- **Lesson:**
  - In fighting passages a gloss can read as a general licence or as a present-day reading. Watch words like «عام»,
    «الآن» and «كل كافر», and series names like «أحكام الجهاد».
  - Prefer the tafsir that is narrower.
- **Data warning:** As-Sa'di's 8:52 entry has its braces reversed; never take an 8:52 excerpt from tafsir 91.

### Batch 1 built and 19 drafts published (2026-11-21)

- **Built:** 21 videos (Al-Baqarah 85-86 and 275-286; Aal Imran 1-52).
- **Frame-checked:** three sheets of 8 frames per video (cover first). Motion, chips and covers are fine.
- **Published:** 19 as Creative Hub drafts (`--confirm`, no `--approve`), 76 files, 0 failed. The ledger now has
  128 entries.
- **Held back:** 3:38-39 and 3:42-46.
  - Their `burst` motif (glad tidings) stayed on screen over «بيحيى» and «المسيح عيسى ابن مريم». A motif must never
    lie on a prophet's name, so both are now `light`, ending before the name (one beat added in 38-39 to keep the 6 s
    rule).
  - Both are queued for a rebuild.
- **Lesson:**
  - The early scratchpad spec files for Aal Imran are stale: the reviews were applied to the storyboard JSON directly.
    Re-running one of them overwrote six reviewed storyboards; this was reverted from git at once.
  - From now on, fix already-reviewed storyboards in the JSON, never by re-running an old spec.
- **Clean-up:** removed `storyboard/3_33-36` and `3_37-39`. They were superseded by the 33-37 / 38-39 re-split, and
  they are in no plan and not in the ledger.

### Aal Imran 87-94 re-split; At-Tawba 60-80 written (2026-11-21)

- **Aal Imran 87-94:**
  - `prepare.py` refused 3_87-91: the reciter joins 90-91-92 with no pause, so no video may end at 91. The surah
    audit had not flagged it.
  - Re-split as 87-89 (33 s) and 90-94 (119 s).
  - The reviewed chapters, glosses and covers were carried over unchanged, except one 3:91 excerpt: «ليفتدي به نفسه
    من عذاب الله» now meets 3:93's «نفسه من», so it is As-Sa'di's «ليفتدي به من عذاب الله ما نفعه ذلك».
  - 92-94 was removed before its build finished. Neither old id was ever published.
- **At-Tawba 60-80:** nine storyboards, all verified PASSED and cut-checked.
  - 60: the eight zakat categories; «وفي سبيل الله» is not glossed.
  - 61-79: the hypocrites' sayings and oaths are framed.
  - 73: only As-Sa'di's restriction «حيث اقتضت الحال الغلظة عليهم» is glossed; Al-Muyassar's «بالسيف» is not used.
  - 75: Tha'laba is not named.
  - 72 (Paradise): `light` mood only.
  - Series renamed: «فريضة الزكاة», «وجوه النفاق».

### Batch 2 published; batch 3 started (2026-11-21, after the quota reset)

- **Batch 2:** 19 videos (Aal Imran 53-86 and 95-143). Frame-checked on three sheets, then published as Creative Hub
  drafts: 76 files, 0 failed. The ledger now has 147 entries.
- **Batch 3 is building:**
  - first the four rebuilds: 3:38-39 and 3:42-46 (motif off the prophets' names), 3:87-89 and 3:90-94 (the re-split);
  - then Aal Imran 144-195.
- All 250 queued videos were cut-checked (`cutcheck.py`): no other joined edge.
- The two At-Tawba reviewers stopped at the 5-hour quota and were resumed after the reset.

### At-Tawba 1-59 reviews applied (2026-11-21)

- **Glosses** (6 SERIOUS, 17 MINOR), all applied:
  - SERIOUS:
    - The 9:5-6 cover «انقضاء المهلة والأمان» read as "the respite and the safety have expired"; it is now
      «انقضاء المهلة وبقاء الأمان».
    - 9:12: «عابوه، وسخروا منه» stayed on screen through the held «فقاتلوا» with only "they mocked" as the reason;
      it is dropped.
    - 9:12: «الرؤساء الطاعنين في دين الرحمن» read as a general licence; it is now «وخصهم بالذكر لعظم جنايتهم…».
    - 9:12: «حتى ينتهوا عن كفرهم» read as "fight until they leave disbelief", and the tafsirs differ; it is
      dropped.
    - 9:24: the threat had lost its condition; it is now «إن فَضَّلتم ذلك على حب الله».
    - 9:29: «إيمانا صحيحا…» dropped the negation and widened the target; it is now «بالبعث والجزاء» on words 7-8
      only.
  - MINOR:
    - Removed: the hijra-recruitment formula (9:20), «فلا يتبعون شرعه» as a reason to fight (9:29), tatweels
      (9:13), echoes of the chip or the Quran (9:13, 9:15, 9:16, 9:40, 9:43, 9:59), «ما قدره» (9:51).
    - Narrowed: «شبابًا وشيوخًا» (9:41).
    - The 9:58 chip is widened to keep «إن… إذا هم يسخطون» together.
    - Abu Bakr now gets Al-Muyassar's honorific line (9:40).
  - Titles: «عقد الذمة» is now «حكم الجزية»; «الطاعة في التشريع» (a hakimiyya slogan) is now «إخلاص العبادة».
  - 9:28 now shows As-Sa'di's «وليس المراد هنا، نجاسة البدن، فإن الكافر كغيره طاهر البدن».
- **Motifs** (1 SERIOUS, 17 MINOR), all applied:
  - SERIOUS: the sunrise over «قاتلوهم يعذبهم الله بأيديكم» (14) is gone; that chapter is now `geometric` with a
    dissolve.
  - Removed: the `mountains` summit sparkles on Allah's name (16, 42), plates over Allah's name (3, 6, 24, 36),
    plates over the Prophet's name ﷺ (7, 59), the march footsteps (42), the gleam on «وينصركم» (now a seal), the
    loot coins (34; now scales), and the dark branch for «إحدى الحسنيين» (now light).
  - Three transitions that peaked on a command or a plot are now dissolves or morphs.
- **Lessons:**
  - In a fighting verse, the reciter holding the command for seconds turns any gloss into its stated reason: keep
    only the tafsir's restriction there, or nothing.
  - A cover title is read on its own: «X والأمان» after «انقضاء» negates both.
  - `mountains` lights a summit on every word, Allah's name included: never use it where His name is recited.

### At-Tawba 97-129 written: the whole surah is now in storyboards (2026-11-21)

- 11 storyboards, all verified PASSED and cut-checked. At-Tawba now has 46 storyboards for its 129 verses.
- **Care points:**
  - 97: «الأعراب» are compared with the town dwellers, and 99 opens with As-Sa'di's «وليس الأعراب كلهم مذمومين».
  - Not glossed where the tafsirs differ: 101 «مرتين», 105 «اعملوا», 110 «تقطع قلوبهم», 112 «السائحون».
  - Fighting verses: 111:11-16, 120:31-46 and 123:1-11 are not glossed, and nothing is drawn there.
  - 117 uses Al-Muyassar's respectful reading for the Prophet ﷺ.
  - 128 (the Prophet ﷺ): no motif at all.
  - 129: the Throne is not drawn.
  - The mosque of harm (107-110): no building and no destruction drawn.
  - `mountains` is not used anywhere Allah's name is recited.
- **Series renamed:** «أصناف الناس», «رحمة التوبة».
- Two independent reviewers (glosses; motifs) are running on 60-129.

### At-Tawba 60-129 motif review applied; Yunus 1-93 written (2026-11-21)

- **At-Tawba 60-129 motifs:** 0 serious, 7 minor, all applied, plus five draw-time fixes.
  - Wind moved off «بالله» (62).
  - Geometric replaces scales on «فما كان الله ليظلمهم» (70).
  - Mood changes:
    - verse 79 (blame only): `geometric`;
    - 128: `night_sky` instead of a light falling on «رسول».
  - Motif changes:
    - 92 «ما ينفقون» (what they did not have): light instead of coins, which dropped the negation;
    - 109 «شفا جرف هار»: wind instead of the "steadfast" mountain;
    - 111 (lives sold for Paradise): a seal instead of coins.
  - The gloss reviewer for 60-129 is still running.
- **Yunus:**
  - 24 storyboards for 1-93 are written, verified and cut-checked.
  - 24-26 is one unit: the end of 25 has no clean cut.
  - Blocked: 31-34, 50-51, 91 and 104-107 (decisions 1 and 2).
  - 89-90 ends on Pharaoh's late declaration of faith, whose refutation (91) is blocked. Its chapter title
    «إيمان بعد فوات» and the gloss «وجزم بهلاكه» frame it; the reviewer should confirm this is enough.

### At-Tawba 60-129 gloss review applied; long-chip renderer fix (2026-11-21)

- **Glosses** (6 SERIOUS, 35 MINOR), all applied.
  - SERIOUS:
    - 9:63: «بأن تهاون بأوامر الله…» stayed over the eternal Fire and read as the Khariji view (any sinner); it is
      now «هؤلاء المنافقون» on words 1-2.
    - 9:91: the chip had lost «ليس على».
    - 9:120: a «لا… إلا» chip was split.
    - 9:111: «وما أعد الله…» read as a negation, and over «يقاتلون… ويقتلون» as a reward for killing. It is dropped,
      and the «بمبايعة» wording is gone.
    - The 9:110-111 cover «الصفقة الرابحة» is a recruitment slogan; it is now «أصدق الوعود».
    - 9:121: the chip ran off the screen.
  - MINOR: chapter titles with modern misreadings (cover «جنازة المنافق», «لمز المتصدقين», «عقوبة المتثاقلين»…);
    unmarked Quran echoes dropped; chips widened to keep «إلا» and «ألا يجدوا ما ينفقون» whole; As-Sa'di's
    qualified comparison for the Bedouins; the three Companions' names in a "punish or forgive" frame dropped.
- **Renderer** (`renderer/js/main.js`):
  - A chip wider than W-80 now shrinks its Quran font, never below 26 px. Every chip is clamped inside the frame.
  - Checked on two stills of 3:183-186 (70- and 65-letter chips).
  - Chips at normal length render exactly as before.
  - 22 chips in unpublished storyboards exceed 60 letters; none is published.
  - 3:183-186 was built with the old renderer and is queued for a rebuild before publishing.

### Aal Imran batch 3 checked; motif plates over the Name removed from all queued storyboards (2026-11-21)

- **Batch 3:** 21 Aal Imran videos built.
  - 7 checked on frame sheets and published as drafts: 3:38-39, 152-153, 170-171, 175, 187-189, 193-194, 195.
  - 3:183-186 is being rebuilt with the chip fix.
  - 3:196-200 failed the motion check at 88.6 s (0.39 % < 0.40 %, the switch into verse 200); a camera beat now
    opens 200:1.
- **Sweep (new scratch check):** a motif other than geometric, light or seal must not stay on screen while the Name
  or «رب» is recited, and `mountains` must not be used where His name is recited (the At-Tawba review lessons).
  - Run on every queued storyboard (surahs 3-9): 74 motifs over the Name and 8 `mountains` moods.
  - All fixed in the JSON:
    - each motif now leaves (`until`) at the first such word;
    - 5 motifs that would have lived for fewer than 2 words are dropped (3:172, 3:191, 4:13, 4:130, 4:146);
    - the `mountains` moods are now `dawn` (3:146, 7:65-89, 7:155, 8:42).
  - Two motifs now also leave before a named honoured person or the Messenger: 3:44 «مريم», 4:136 «رسوله».
  - 4:13 now uses geometric for «تلك حدود الله». 4:130 got 2 neutral camera beats.
  - All re-verified PASSED.
  - 13 built Aal Imran videos are being rebuilt.
  - Already published drafts (surahs 1-2, early Aal Imran) are not changed. The reviewer may see such plates there.
- Yunus still to fix with its review: 10:9, 10:19, 10:57, 10:85.

### Yunus reviews applied; Hud 18-60 written (2026-11-21)

- **Yunus motifs** (1 SERIOUS, 13 MINOR), all applied:
  - SERIOUS: the 24-26 cover was the garden mood under «الدنيا والدار الباقية», with Paradise in the same video. The
    cover now sits on 25:2 (light).
  - Plates leave before «ربهم/ربك/ربكم» (9, 19, 57, 85; 61 stars → geometric).
  - The lamp flame in a Paradise passage (9) is now light.
  - Scales on «لا يظلم الناس» (44) → geometric.
  - Plates no longer start on «وبشر», «قل» or «قل» (2, 35, 58).
  - Moods changed:
    - 20 → night_sky (ultimatum);
    - 60 → geometric (threat);
    - 89 → geometric (Pharaoh's punishment).
  - The light_sweep peaking on «هو الذي جعل الشمس ضياء» (5) is now a dissolve.
- **Yunus glosses** (2 SERIOUS, 36 MINOR), all applied:
  - S1: 10:89-90 alone ends on Pharaoh's «آمنت… وأنا من المسلمين» with no refutation possible inside 89-90.
    - 89-90 and 92-93 are held (plans/10.json, DECISIONS_NEEDED §1 Yunus).
    - They become 89-91 then 92-93 once 10:91 is unblocked.
  - S2: 10:61 split «وما تتلو… إلا» across chips (addressed to the Prophet ﷺ). Words 1-4 now carry As-Sa'di's «يخبر تعالى،
    عن عموم مشاهدته…», and the 5-9 gloss is dropped.
  - MINOR:
    - Framed: the chiefs' accusation (78).
    - Disputed reading dropped (100 → «أمره ونهيه»).
    - Musa-only gloss narrowed (75).
    - Source slip fixed (88).
    - Quran echoes removed (13, 16, 18, 41, 46, 71, 79, 96, 102, 108).
    - Unreadably short boxes merged (26, 28, 68, 89).
    - 16 titles, covers and series renamed: «نوح والرسل», «التوحيد الخالص», «نهاية فرعون» (not a slogan), «أمن المتقين»
      (74:56 describes Allah), and others.
  - All 29 re-verified PASSED.
  - 27 Yunus videos queued (89-90 and 92-93 held).
- **Hud 18-60:** 10 storyboards, all PASSED and cut-checked.
  - Nuh 25-40 (no plate for Nuh; the ark only as a symbol, never the flood).
  - 50-60 re-split to 50-52 / 53-56 / 57-60, so Hud's oath (54:8-55:7, one sentence) stays in one video.
  - The chiefs' claims are framed with As-Sa'di's «رادين», «بزعمهم», «يعنون بذلك», «وكذبوا في قولهم هذا».
  - 11:35: the tafsirs differ on who is meant (Nuh, or the Prophet ﷺ), so the gloss is neutral and nothing is drawn.

### Yusuf: audit and plan (2026-11-21)

- 34.3 minutes recited. 6 JOINED boundaries (after 3, 23, 86, 98, 109, 110) and 12 more with no clean audio cut.
- Text: 12:39 and 12:41 «يا صاحبي» differ from Tanzil in a drawn letter (QF dagger alef; Tanzil alef maqsura +
  dagger alef). This is new decision §6. 12:51 «الآن» falls under decision 1, and 12:91 (20 ms overlap) under
  decision 2.
- 32 videos planned; 4 are blocked (39-40, 41-42, 50-52, 90-93). The other 28 have base storyboards and all
  cut-check clean.
- Care:
  - Yusuf, Ya'qub and the Prophet ﷺ get no motif.
  - Never drawn: the dream, the well, the wolf, blood, the wife of al-Aziz, the women and the prostration.
  - 53: the tafsirs differ on who speaks, so its glosses must stay neutral.
- Hud reviewers (glosses; motifs) are running on all 30 Hud storyboards.

### Hud motif review applied (2026-11-21)

- 2 SERIOUS, 5 MINOR, all applied; 2 optional motion fixes also applied.
- SERIOUS (covers seen alone):
  - 69-72: a gold burst under «بشارة الملائكة» read as the angels drawn as gold light. The cover is now the hospitality
    frame (69:11), and the burst on «بالبشرى» is now a scroll.
  - 64-68: a burst under «عاقبة ثمود» read as the blast that destroyed them. The cover is now the hourglass of
    «ثلاثة أيام» (65:6).
- MINOR:
  - 6:9 wheat over the repeated «الله» → seal.
  - 14:6 book over «بعلم الله» → light.
  - 5-8 c3 wipe peaking on «وهو الذي خلق» → slide.
  - 1-4 c2 dawn over «عذاب يوم كبير» → geometric (light_sweep → dissolve).
- Motion fixes: 29:8 geometric, 84:19 wheat.
- Lesson: a burst or star on a cover can be read as an angel or a blast. On a cover, prefer a plate whose meaning
  cannot be mistaken.

### Hud gloss review applied; Hud queued (2026-11-21)

- 0 SERIOUS, 53 MINOR, all applied. All 31 storyboards were re-verified PASSED and have no plate over the Name.
- Fixed first: four boxes that, read alone, dropped the negation the pill keeps.
  - 88:14-21 now «وأنا أول مبتدر لتركه». Before, Shu'ayb seemed to say he commits what he forbids.
  - 20:7-14, 113:8-14 and 63:13-18 now keep the question or negation.
- Also fixed:
  - 34: a condition shown alone; now one 34:1-14 chip.
  - 109:16-20: the tafsirs differ on «نصيبهم».
  - 83:4-8: the qualifier is restored.
  - 65:2-7: the threat is now shown as a threat.
  - 78:23-26: «مروجهم» could read as "meadows".
  - Quran echoes removed: 8:39, 61:5, 11:27, 28:63, 40:78, 3:5, 2:27.
  - Seven Latin commas trimmed.
  - 17 boxes that were too short are merged or dropped.
- Titles:
  - «كمال القرآن», «العلم المحيط», «الدعوة إلى التوحيد», «بناء السفينة», «تحدي هود», «نجاة الموحدين»,
    «التوحيد والاستغفار», «تقليد الآباء», «شفقة إبراهيم» (not «حلم الخليل», "the dream of Hebron"), «حكمة الإمهال»,
    «سبب الهلاك» (not «بقايا الصالحين», "relics"), «المشيئة النافذة» (not «حكمة الاختلاف», a pluralism slogan),
    «وعيد المعرضين», «ختام السورة».
  - Series name: «إبراهيم والملائكة».
- Lessons:
  - Read the box alone: it must keep the pill's negation or question.
  - Remove Latin commas from excerpts.
  - Avoid words whose modern sense differs («انحلال», «مروج», «بقايا», «حلم»).
- The 31 Hud videos are queued for building.

### Ar-Ra'd: audit and plan (2026-11-21)

- 15.9 minutes recited. 1 JOINED boundary (after 39). No timing defects.
- Text: at 13:37 QF writes «بعد ما» as two words where Tanzil has one word, «بعدما». The letters are the same; only
  the word boundary differs. This is new decision §7, and 37 is blocked.
- 17 videos planned. 16 have base storyboards, all cut-checked clean; 35-36 is planned apart from 37, so that 35-36
  is not held with it.

### Ar-Ra'd written; Ibrahim audit and plan (2026-11-21)

- **Ar-Ra'd:** 16 storyboards, all verified PASSED and cut-checked. 37 is blocked (§7).
  - Care points:
    - The angels (11, 13, 23), Paradise (23-24, 35), Hell, the Throne and the Tablet are never drawn.
    - Lightning appears only as a sign, never striking anyone.
    - The prostration of 15 is not drawn; its chapter is light, not dawn.
    - Not glossed where the tafsirs differ: 8:7-11, 11 «من أمر الله», 31:1-14, 39:1-5, 41:1-8, 43:12-15.
    - Al-Muyassar's battle readings (31, 34, 41) are not used.
  - A combined reviewer (glosses and pictures) is running.
- **Ibrahim:** 17.8 minutes recited. The text is identical to Tanzil. Short-word flags at 22 and 31.
  - 19 JOINED boundaries; 43-52 is one 181 s unit, kept long as in 3:102-108 and 7:47-53.
  - 14 videos planned. All have base storyboards and cut-check clean.

### Yusuf motif review applied (2026-11-21)

- 1 SERIOUS, 6 MINOR, all applied; optional motion and transition fixes too.
- SERIOUS: the 5-6 cover was the crescent moon and stars under «بداية الرؤيا». It read as Yusuf's dream drawn. That
  chapter is now geometric.
- MINOR:
  - Covers:
    - 43-47: wheat under «تعبير الحلم» → the hourglass frame.
    - 86-89: a light plate frozen on «الله» under «الأمل في الله» → the geometric frame.
  - 7:6 burst after «وإخوته» (the brothers are the dream's stars) → book.
  - The night sky with a moon over the temptation passages (25, 31, 32) → geometric.
  - 108 light mood pulsing on the Prophet's ﷺ «أنا» → geometric.
- Transitions now vary: page_turn, slide and morph on eight chapters.
- Lesson: in a story about a dream of stars and a moon, the night_sky mood itself is a picture of the dream. Keep it
  away from the dream, its covers and the brothers.

### Yusuf gloss review applied; Yusuf queued (2026-11-21)

- 1 SERIOUS, 25 MINOR, all applied. All 28 storyboards were re-verified PASSED and have no plate over the Name.
- SERIOUS: at 33:15-17 the box «فإن هذا جهل، لأنه آثر لذة قليلة منغصة», read without its condition, sounded like
  something Yusuf did. The 33:9-17 chip now keeps the condition «إن لم تدفع عني السوء».
- MINOR:
  - 25:11-23 keeps «ما… إلا» whole.
  - 79 keeps its condition.
  - 80:24-34 keeps «حتى…».
  - Quran echoes removed: 3:154, 2:67, 12:51 (the Uthmani «امرأت» hid it from the check), 12:55, 6:50.
  - Too-short boxes merged: 8, 108.
  - 15 titles, covers and the series renamed: «بيت العزيز», «عفة يوسف», «مجلس الضيافة» (not «مكر النساء»),
    «حسن التدبير», «الأمانة والكفاءة», «ثمرة التقوى» (not «جزاء الإحسان», 55:60), «اللقاء الأول», «بشائر الفرج»,
    «طريق التوحيد», and others.
- Plan note corrected: both tafsirs give 12:53 to the wife of al-Aziz.
- The 28 Yusuf videos are queued for building.
- The unused Ibrahim bases 14_42-42 and 14_43-52 are removed (merged into 42-52).

### Ibrahim written; Al-Hijr audit and plan (2026-11-21)

- **Ibrahim:** 13 storyboards, all PASSED.
  - 42 is merged into 42-52 because 43 «مهطعين» continues its sentence. 42-52 is a 213 s video.
  - The Day, Satan, Hell, Paradise and the Kaaba are never drawn.
  - Not glossed where the tafsirs differ: 9 «فردوا أيديهم», 15 «واستفتحوا», 23 the greeting, 46 «لتزول منه الجبال»,
    48 the change of the earth.
  - A combined reviewer is running.
- **Al-Hijr:** 13.0 minutes recited. Text identical to Tanzil. Short-word flag at 65.
  - 12 videos. Short units are merged by hand: 6-15, 68-79 (Ayka joined to Lut's end), 80-89 (84 cannot be cut
    from 85).
  - All base storyboards cut-check clean.

### Ar-Ra'd review applied; Ar-Ra'd queued (2026-11-21)

- Independent reviewer: 0 SERIOUS, 40 MINOR, all applied. All 16 storyboards re-verified PASSED, with no plate over
  the Name.
- Boxes that misread when seen alone:
  - 11:30-35 now says «ولا أحد يمنعهم منه». The old box read as if someone protects them.
  - 33:14-20 drops «علم بذلك», which read as «عَلِمَ» under «لا يعلم».
  - 16:29-37 keeps the source's question mark.
  - 6:17-20 keeps «مَن أصرَّ».
- Not glossed where the tafsirs differ: 22:13-15 («فتمحوها»).
- Removed:
  - Quran echoes in 2, 7, 8, 11, 18, 30, 33, 43 and 32.
  - A paraphrase of an imperative of Allah (40:1-8).
  - The data typo «هومها» (42:9-13).
- Too-short boxes merged: 3:8, 19:9-11. 33:12-13 widened to 33:9-13.
- Titles:
  - 17 titles, covers and series names reworded: «عجائب الأرض», «تبدل الأحوال» (not «سنة التغيير»), «ثبات الحق»,
    «عاقبة الفريقين», «حياة القلوب», «الجزاء العادل», «بشرى للأتقياء» and others.
  - Series in English: "Arguments of the obstinate".
- Pictures:
  - The lamp on «ولكل قوم هاد» (a messenger, per both tafsirs) is now light.
  - 14 chapter transitions are now slide, page_turn or morph.
  - 13_1-3 and 13_4 motion fixes.
- The 16 Ar-Ra'd videos are queued for building (13:37 stays held, DECISIONS_NEEDED §7).

### Ibrahim review applied; Ibrahim queued; Al-Hijr 1-67 written (2026-11-21)

- **Ibrahim** independent review: 1 SERIOUS and 29 MINOR, all applied. All 13 storyboards re-verified PASSED, with no
  plate over the Name.
- **SERIOUS:** the 42-52 cover showed the book plate of «هذا بلاغ» under the Day series, so it could read as the
  record of deeds handed out at the Judgement. The cover is now the hourglass at 42:8.
- **Boxes that misread when seen alone:**
  - 22:28-33 (it made Satan sound like "your rescuer").
  - 4:10-16, now split into 10-13 and 14-16.
  - 17:5-12 now keeps «ولكن الله قضى أن لا يموتوا».
  - 20:1-5, 7:4-6 (keeps its condition), 4:1-9 and 33:6-9.
- **Where the tafsirs differ:**
  - 14:6-10 «مقامي».
  - 43:8-9: As-Sa'di says the hearts are «مملوءة من كل هم».
  - 37:1-5: «لأن إسحاق في الشام» is dropped.
- **Removed:** Quran echoes in 16:1-3, 52:6-10 and 25:1-6.
- **Boxes:** three that were too fast to read are fixed.
- **Titles:**
  - Nine titles, covers and series reworded: «موعظة موسى», «دروس الماضي», «ثبات القلوب», «العلم المحيط», «شكر إبراهيم»
    and «أهوال القيامة» (not «يوم الحساب»).
  - Al-Hijr 22-24 is now «الرياح والإحياء», because «علم الله» is a Quran pair.
- **Pictures:**
  - The ship plate now leaves before «بأمره».
  - 16 of the 21 transitions now vary.
- **For the human reviewer:** 14:11 word 9 «ولكن» has an 8.9 s timing segment with continuous voice, which is likely
  an unmarked repeat. Listen at 6-15 s of 14_11-12.
- The 13 Ibrahim videos are queued for building.
- **Al-Hijr:** 1-67 written (8 storyboards, all PASSED). 68-99 are next.

### Owner feedback: the reels need people and places (2026-11-21)

- **Feedback:** the reels of surahs 2-4 only switch between a sky and a round symbol, with no place, no people
  and no story. The owner wants them like Al-Kahf.
- **Owner decisions (asked in session):**
  1. Every this-world passage gets a `stage` scene: stories, believers' deeds, rulings shown as everyday life, and
     signs in nature. `ambient` stays only for Allah's names, the unseen and battles.
  2. The roughly 200 drafts already in Creative Hub are restaged and uploaded as new versions next to the old ones,
     with « - v2 » at the end of the name.
- **Renderer daily-life pack:**
  - New settings: `home`, `prayer_hall` (arcade and carpet rows; no Kaaba, no writing), `market` and `fields`.
  - New actor beats: `pray`, `ruku`, `sujud`, `rise` (a side-view prayer figure; `sit` sits in prayer), `give`
    (a purse travels to the receiver) and `read` (an open book in both hands).
  - Indoors, the night tint is softened.
- **Publishing:** `publish_hub.py plan <ch> --ids … --version 2` keys the ledger `id@v2` and names the creative
  « … - v2 ». It refuses a version of a video that was never published, and the very same render.
- **Guide:** a new section "Staging v4" in docs/STORYBOARD_GUIDE.md gives a recipe for each kind of passage.
- **Builds:** batch 6 was stopped. The ambient videos it built (4_93-101 and 3_90-94, 4_25, 4_77-78, 4_82-91) are
  not published; they will be restaged first.

### Staging v4 progress (2026-11-21, evening)

- **Restaged (verify PASSED):**
  - Al-Fatiha: built and published as v2.
  - Al-Baqara: all 85 storyboards, in 4 parallel batches.
  - Al-Hijr: all 12.
- **Independent picture reviews:**
  - **2:1-84: 4 SERIOUS, 6 MINOR.**
    - Bani Isra'il were shown praying with the Muslims (2:43 is a command).
    - The sea crossing misread (2:50).
    - The Sabbath-breakers faded out on «فقلنا» before «كونوا قردة» (2:65).
    - The "few" were drawn as a crowd (2:83).
  - **2:175-237: 4 SERIOUS, 10 MINOR.**
    - A family on screen during the vow (2:226) and during the waiting period (2:228). Both are now ambient.
    - The Paradise gloss appeared over a close-up of the disbelievers (2:212).
    - A burst plate was on screen at a repeated «ربنا» (2:201).
  - Fixes are being applied by the restagers, then checked again.
- **allahcheck.py (tools/restage/) now times every recited occurrence**, the reciter's repeats included. Over all
  storyboards it flags:
  - Aal Imran: 48 plates over the Name. They are fixed during its restage.
  - Al-Kahf (published): 26 plates over the Name, a stricter lesson adopted after Al-Kahf was published. To be fixed
    in an Al-Kahf v2 later.
- **Blocked:**
  - 2_255-256 (published) cannot be rebuilt: the reciter joins 2:254-255, and this "nocut" edge has been refused
    since today's audio audit. It needs a re-split or an owner decision.
  - 2_13-16, 2_183-185 and 3_24-26 stay audio-blocked, as before.
- **Fixed:** `render.mjs sheet` used one shared temp folder, so sheets rendered in parallel could show another
  storyboard. Each run now has its own folder.

### Staging v4: first v2 batch published; autonomous operation (2026-11-22)

- **Al-Baqara 1-84:**
  - 20 v2 drafts published (« - v2 »), after the independent picture review, its fixes and a frame check.
  - 2_24-25 stayed ambient and rendered identical to the published video, so it was not re-published.
  - 2_13-16 is still audio-blocked.
- **Al-Baqara 85-286:** reviews and fixes done.
  - 85-237 and Al-Hijr (55 videos) are building.
  - 238-286 (18 buildable; 2_255-256 is blocked by the nocut edge) is queued next.
- **Aal Imran:** all 54 restaged; three independent picture reviews are running.
- **An-Nisa:** restaging started (part 1 of 3).
- **Owner rule (CLAUDE.md, "Autonomous operation and usage limits"):**
  - Usage is read from `rate_limit_event`.
  - At 95% of a window, token work stops (background builds go on), and a `send_later` resume is set at reset + 1
    minute.
  - One resume is always pending at the current five-hour reset + 1 minute.
- **Renderer fixes after the reviews:**
  - No cross on the rich robe.
  - Pale-stone mountain caps.
  - Gentler pans.
  - Light woven tents with a shaded door; a dark tent with a gold-lit door could read as the Kaaba.

### Desert background reshaped (2026-11-22)

- **Why:** the Aal Imran review found that the small symmetric middle mesa, with its horizontal "course" lines, read
  as a truncated pyramid, especially with the sun behind it (CLAUDE.md rule 5: no pyramids outside Egypt).
- **Change:** the desert now has only wide, low, uneven plateaus, with no course lines.
- **To re-render as v3, because the v2 drafts were rendered with the old desert:**
  1_1-7, 2_49-52, 2_53-56, 2_57-59 and 2_67-69.
- **Also affected:** Al-Kahf 18_60-64 and 18_83-88 (v1). They will be fixed in the Al-Kahf v2, together with its
  Name-plate fixes.

### Name-safe plates revealed whole (2026-11-22)

- **Why:** the independent picture review of Al-An'am 1-58 found that the geometric plate, which is used on the Name,
  drew its outlines stroke by stroke. For about 0.2 s its half-drawn circle and inner star formed a curl that reads
  like a head in profile. On plates that live less than about 0.9 s the plate even faded out at that point.
  The defect is in the renderer, so it affected every surah, not just Al-An'am.
- **Change (`renderer/js/motifs.js`):**
  - The three motifs allowed on the Name or «رب» (geometric, seal, light) are now revealed whole: each outline fades
    in complete and never shows a partial stroke.
  - A short-lived motif draws on faster, so it is complete before it starts to leave and is never seen half drawn.
- **Re-render:** 63 published or built renders were made with the old code and contain one of these motifs. They are
  queued for rebuild (Aal Imran first, then Al-Fatiha, Al-Hijr and Al-Baqara) and will be re-published as the next
  version:
  - Al-Fatiha: 1;
  - Al-Hijr: 11;
  - Al-Baqara: 47;
  - Aal Imran (not yet published as v2): 4.

  The 21 affected Al-Kahf videos will get the fix in the Al-Kahf v2.

### Prayer poses redrawn (2026-11-22)

- **Why:** the independent picture review of Al-A'raf 1-46 found two problems with three-man groups in prayer.
  - Sujud read as bodies lying in a heap: the back was flat and the hips were low.
  - In ruku and sujud the faceless head with its head ring read like the open end of a tube.
- **Change (`renderer/js/scenes_lib.js`):**
  - Sujud now has the hips raised over the knees and the back sloping down to the forehead on the ground, with the
    hands flat beside the head.
  - The head ring is drawn edge-on and fades out as the head bows.
- **Re-render:** 10 built renders use ruku or sujud and were made with the old poses. They are queued for rebuild and
  re-publication as the next version: 7 Al-Baqara drafts and 3 Aal Imran.
  The 63 renders already queued for the Name-plate fix get the new poses too.

### No ambient pulse on His acts (2026-11-22)

- **Why:** the Al-A'raf 109-165 restager found that ambient moods light a star or pattern tile on every word that is
  not marked sacred. At «تجلى» (7:143) a gold star lit up exactly as Allah's manifestation to the mountain is recited.
- **Change (`renderer/js/main.js`):** «تجلى», «استوى» and «وجهه» are added to the sacred words, so the ambient
  backgrounds never pulse on them.
- **Affected published renders:**
  - 2:26-29 («استوى»): already queued for rebuild.
  - 18:27-28 («وجهه»): will be fixed in the Al-Kahf v2.

### No plate over prayer, no light band on the Name (2026-11-22)

- **Why:** the Al-A'raf reviews found three patterns that recur across surahs:
  - people pray under a plate, which reads as praying to it (a scan found 65 such moments in 34 storyboards);
  - a `light_sweep` transition crosses the frame as the Name is recited;
  - in the home and prayer-hall settings a plate in front of a hanging lamp's chain reads as an object hanging in
    the room.
- **Change (renderer, so every storyboard is covered):**
  - Motif plates fade out whenever a group is in prayer (pray, ruku, sujud, sitting), starting 0.6 s before the
    prayer begins. Gloss arrows no longer point to a hidden plate.
  - A `light_sweep` becomes a dissolve when a sacred word is recited within its window.
  - Hanging lamps fade out while a plate is on screen.
- **Re-render:**
  - 8 renders built with the old code are set aside and queued in a follow-up build chain: 6 Al-Baqara and 3:102-108
    and 3:113-115, already published as v2.
  - The 27 affected storyboards still in the build queue get the fix automatically.
  - Al-Kahf 18:57-59 is left for the Al-Kahf v2.
