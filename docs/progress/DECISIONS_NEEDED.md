# Decisions needed from the owner

The agent cannot decide these alone, because a rule reserves them for you. Each one blocks only the videos listed;
all other work continues.

## 1. Al-Baqarah: 18 verses where Tanzil's encoding differs from the Quran Foundation text (found 2026-11-21)

`audit_surah.py 2` reports a text mismatch with the second source (Tanzil Uthmani) in **2:61, 71, 124, 125, 126, 127,
130, 132, 133, 135, 136, 140, 177, 181, 187, 213, 258, 260**. Following section 9.1 of the master documentation,
the agent investigated character by character, rendered both versions (`docs/proofs/baqarah_tanzil_vs_qf.png`), and
also checked the King Fahd Complex text (QPC Hafs), which the Quran Foundation API serves as `text_qpc_hafs`. There
are three cases.

| Case | Verses | Quran Foundation (what the video draws) | Tanzil | King Fahd Complex text (QPC Hafs) |
|---|---|---|---|---|
| Small yā' in إبراهيم and النبيين | 61, 124–127, 130, 132, 133, 135, 136, 140, 177, 213, 258, 260 | tatweel + small **high** yā' (U+0640 U+06E7): «إِبْرَٰهِـۧمَ», «ٱلنَّبِيِّـۧنَ» | small yā' (U+06E6) | same as the Quran Foundation (U+0640 U+06E7) |
| Hamza in «الآن» | 71, 187 | standalone hamza + fatha + dagger alef (U+0621 U+064E U+0670) | tatweel + fatha + dagger alef + hamza above | (same letters) |
| Word spacing | 181 | «بَعْدَ مَا»: two words | «بَعْدَمَا»: one word | «بَعۡدَ مَا»: two words, same as the Quran Foundation |

**The agent's reading:** the letters and the reading are the same in every case. The Quran Foundation text matches
the King Fahd Complex text, which matches the printed Madina Mushaf (Al-Baqarah prints «إبراهـۧم» with a raised
small yā'). The differences are Tanzil's own way of encoding. They are of the same kind as the equivalences
`verify.py` already accepts (tatweel + dagger alef, hamza on a kashida).

**Why the agent did not add them itself:** the rule allows a new equivalence only "with visual proof that both
encodings render identically". In Scheherazade New the two encodings put the small yā' and the hamza in visibly
different places (see the proof image), so they do not render identically. The rule therefore leaves the decision
to you. The automatic safety review also refused a change to the verifier, correctly.

**Please choose one:**
- **A (recommended).** Allow three documented equivalences in `pipeline/verify.py`, each limited to its exact
  characters:
  1. `U+0640 U+06E7 ≡ U+06E6`;
  2. `ـَٰٔ ≡ ءَٰ`;
  3. a verse-specific spacing exception for 2:181 «بعد ما», accepted only where QPC Hafs agrees.

  The agent will then produce all of Al-Baqarah.
- **B.** Keep the rule as it is. The 18 verses stay blocked, and the videos that contain them are not made.
- **C.** Use another second source for these verses, for example compare with the QPC Hafs text.

Until you decide, Al-Baqarah is planned in full, and only the videos that contain **none** of these verses are
produced.

**Also affected: An-Nisa (surah 4):** 4:18 («الآن», case 2) and 4:69, 4:163 (small yā', case 1); videos 4:18, 4:69–70 and 4:163 are blocked.

**Also affected: Aal Imran (surah 3).** 3:20, 21, 75, 79, 80 and 81 differ from Tanzil only in the first case (the
small yā' in «الأميين», «النبيين», «ربانيين»). Their videos (3:20, 21–23, 74–76, 79–80, 81–83) are blocked by the same
decision. The agent checked: with only this one substitution, each verse is identical to Tanzil.

**Also affected: Al-Ma'idah (surah 5).**
- 5:111 differs from Tanzil only in the first case (the small yā' in «الحواريين»). Video 5:111–114 is blocked by the
  same decision.
- **New case, 5:52 (a text error in the Quran Foundation data, not an encoding variant).** Word 12, «دائرة», is
  served as `'دَآئِرَ ةٌۭ ۚ'`, with a space inside the word. On screen the word would be split in two.
  - The King Fahd Complex text (QPC Hafs, from the same API) has one word, `'دَآئِرَةٞۚ'`, and so does Tanzil.
  - The agent did not change the text: the rules forbid "fixing" Quranic text.
  - Video 5:51–52 is blocked.
  - **Please choose:**
    - **A.** Allow `verify.py` and the renderer to remove that one space, only where QPC Hafs and Tanzil both
      have a single word.
    - **B.** Keep the video blocked.
    - **C.** Report the error to the Quran Foundation and wait for a fix.

**Also affected: Al-A'raf (surah 7).**
- 7:161 «خطيئاتكم»: the second case (hamza with dagger alef: QF `ءَٰ`, Tanzil `ـَٰٔ`).
- 7:196 «وليي»: the first case (QF tatweel + small high yā' `ـِّۧ`, Tanzil `ۦِّ`).
- Videos 7:160–162 and 7:196–198 are blocked by the same decision.

## 2. Al-Baqarah: verse boundaries that overlap by 20–80 ms in the timing data (found 2026-11-21)

In the Quran Foundation word timings for Yasser ad-Dussary, the first word of some verses starts slightly before the
previous verse's last word ends:

| Verse | Overlap |
|---|---|
| 14 | 40 ms |
| 74 | 40 ms |
| 124 | 40 ms |
| 141 | 20 ms |
| 150 | 80 ms |
| 253 | 20 ms |

`verify.py` treats any overlap as a failure, and the master documentation (2.2) says overlaps block a video. Blocked
videos: **2:13–16, 2:74, 2:149–152, 2:250–252 and 2:253–254**. A video that ends right before an overlapping verse is
blocked too, because its last word overlaps the next verse. 2:122–125 and 2:138–141 are already held by decision 1.

**The agent's reading:** the overlaps are aligner jitter, far shorter than a word. `prepare.py` (through `align.py`)
already moves every verse change onto the reciter's measured pause, and lists each move on the review sheet.

**Please choose one:**
- **A.** Allow overlaps under 100 ms only where the measured-pause alignment resolves them. Each would be reported as
  INFO and listed on the review sheet for listening.
- **B.** Keep the rule. These 4 videos are not made.

**Also waiting for this decision (no clean audio cut):** 2:183–185 can only start after 2:182, where the audio has no
clean cut. 2:182 belongs to 2:180–182, which decision 1 blocks (2:181). Likewise Ayat al-Kursi, 2:255–256, can only
start with 2:253–254, which decision 2 blocks (2:253).

**Also affected: Aal Imran (surah 3).**
- Overlaps:
  - 134: 40 ms;
  - 139: 80 ms;
  - 177: 80 ms.
- 3:135 words 1–2 have no timing at all, so option A would not unblock that one.
- Blocked videos: 3:133–136, 3:137–139 and 3:176–179.
- An-Nisa: 4:74 word 1 has no timing (with no clean cut after 4:73, so 4:73–74 is blocked); 4:162 overlaps 4:161 by 40 ms (4:161–162 blocked).
- 3:25 has a broken word segment: word 15 is timed 576180–576170 ms, so it ends before it starts. The verse also
  has five word segments of 70–100 ms. `verify.py` fails it («segment with end<start»), so 3:24–26 is blocked as
  well. A `timing_corrections` entry cannot fix an end time and must be confirmed by ear in any case.
- Al-Ma'idah: 5:84 overlaps 5:83 by 20 ms, so video 5:82–84 is blocked.
- Al-An'am (surah 6):
  - 6:27 word 14 has no timing.
  - Overlaps: 6:29 by 80 ms, 6:48 by 60 ms, 6:63 by 20 ms, 6:98 by 20 ms and 6:143 by 80 ms.
  - Blocked videos: 6:27–30, 47–49, 61–62, 63–66, 96–103 and 141–144 (61–62 and 141–142 end right before an
    overlapping verse).
- Al-A'raf (surah 7): 7:203 overlaps 7:202 by 40 ms, so video 7:201–203 is blocked.

## 3. Published drafts: glosses caught by the stricter wording check (found 2026-11-21)

`verify.py` now also compares UI text against two alternative spellings of each Quran word:
- the dagger alef read as nothing («إلـٰه» = «إله»);
- the accusative tanween alef dropped («أحدا» = «أحد»).

Titles are also compared after leading prefixes are stripped («أفحكم» = «حكم»). This is stricter only.

Three drafts that are already on Creative Hub would now fail. They cannot be re-imported (the ledger rule), so
please check them while reviewing:

| Draft | Gloss | Close to the Quran's | Note |
|---|---|---|---|
| 18_45-49 | 18:48 «مصطَفِّين لا يُحجب منهم أحد» | «منهم أحدا» | Al-Muyassar's wording; reads as explanation. |
| 18_79-81 | 18:81 «بمن هو خير منه صلاحًا ودينًا وبرًا بهما» | «خيرا منه» | Al-Muyassar's wording; reads as explanation. |
| 2_97-101 | 2:97 «لما سبقه من كتب الله» | «كتاب الله» (2:101) | False positive: «كتب» (books) is not «كتاب». |
| 2_107-110 | 2:107 gloss containing «السموات والأرض» | «السماوات والأرض» | Found when the check also read the dagger alef as an alef in only one place («السموات»). |

Unpublished videos with the same issue were corrected before building: 2:85, 4:19, 4:92 and 4:170, plus the title
of 6:12–14.

## 4. Al-Baqarah import with failed files (2026-11-21)

Import `cmwq13gbp000q3cnypy1tpwde` (27 videos) completed, but 11 of its 108 files failed with a storage error
(`@aws-sdk XML parse error`).

| Video | What happened | Ledger |
|---|---|---|
| 2:62–64 «رفع الجبل والميثاق» | All 4 files failed; no creative was created. | Kept, marked IMPORT FAILED. |
| 2:65–66 «عاقبة التحايل» | All 4 files failed; no creative was created. | Kept, marked IMPORT FAILED. |
| 2:67–69 «ذبح البقرة» | The creative exists, but only its review PDF is attached (video, preview and cover failed). | DRAFT, with the note. |

The documentation says to re-import only the missing creatives. The ledger guard, however, refuses any id it
already holds. I kept the two entries rather than remove them on my own.

**Options:**
- **A. Re-import 2:62–64 and 2:65–66.** I remove their two ledger lines and import a ZIP of only those two. No
  duplicate is possible, because no creative exists for them.
- **B. Leave them.**

For 2:67–69, please attach the files from `out/2_67-69_r97/` to the existing creative in the app, or tell me to
import it again. Re-importing would create « (2) » next to the PDF-only creative.
