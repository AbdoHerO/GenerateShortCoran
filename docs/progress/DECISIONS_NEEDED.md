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
videos: **2:13–16, 2:74, 2:150–152 and 2:253–254**. 2:122–125 and 2:138–141 are already held by decision 1.

**The agent's reading:** the overlaps are aligner jitter, far shorter than a word. `prepare.py` (through `align.py`)
already moves every verse change onto the reciter's measured pause, and lists each move on the review sheet.

**Please choose one:**
- **A.** Allow overlaps under 100 ms only where the measured-pause alignment resolves them. Each would be reported as
  INFO and listed on the review sheet for listening.
- **B.** Keep the rule. These 4 videos are not made.
