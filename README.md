# Quran Video Studio

Animated vertical (9:16) Quran recitation videos, produced surah by surah. Each video has:
- the Mushaf text highlighted word by word as the reciter (Yasser ad-Dussary) recites;
- the English translation (Saheeh International);
- verbatim tafsir explanations (Al-Muyassar, As-Sa'di);
- symbolic motion graphics, with faceless people and prophets and angels only as labelled lights;
- a cover frame.

Every video passes an automatic verifier and a human review before it is approved.

- **Start here:** [docs/MASTER_DOCUMENTATION.md](docs/MASTER_DOCUMENTATION.md)
- **Rules for Claude sessions:** [CLAUDE.md](CLAUDE.md) · **mission prompt for the cloud agent:**
  [CLOUD_AGENT_PROMPT.md](CLOUD_AGENT_PROMPT.md)
- **Progress:** [docs/progress/STATUS.md](docs/progress/STATUS.md) · **plans:** [plans/](plans/) ·
  **uploaded to Creative Hub:** [publish/ledger.json](publish/ledger.json)
- **Local web app (Windows):** double-click `Start Quran Studio.bat`; see [docs/STUDIO.md](docs/STUDIO.md).
- **Cloud session:** `bash scripts/cloud-setup.sh`, then `python pipeline/produce.py …` (see the master
  documentation, section 12).

Data: Quran Foundation (quran.com) for text, recitation, word timings and tafsir; Tanzil (alquran.cloud) as the
second source. Fonts are OFL (see [docs/CREDITS.md](docs/CREDITS.md)). Publishing rights for the recitation audio
and the data must be confirmed before public use.
