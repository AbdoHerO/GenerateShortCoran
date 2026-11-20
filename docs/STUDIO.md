# Quran Video Studio

A local web app for making recitation videos like the Al-Hijr and Musa ones from **any passage** of the Quran.

## Start

Double-click **`Start Quran Studio.bat`** in the project folder. The app opens in your browser at
<http://localhost:5178>. Keep the black window open while you work; close it to stop the app.

(From a terminal: `node platform/server.mjs --open`.)

## Make a video in three steps

1. **Create.** Pick a surah (type a number, a name or a meaning), the verse range (up to 40 verses), a reciter and
   the visual style. Click **Create video draft**. The app then:
   - downloads the verses, the translation, both tafsirs and the recitation;
   - writes the storyboard;
   - runs every accuracy check;
   - prepares the audio.

   This usually takes under a minute.
2. **Review.** Watch the preview and play each verse with ▶. Read along and tick **Checked** for each verse.
   Then confirm that the titles and pictures are appropriate, and confirm by ear any timing the app flags.
   Enter the reviewer's name and click **Approve for export**.
   The **Edit** tab lets you:
   - rename chapters and change their visuals;
   - remove explanations;
   - add an explanation: click the word, then select a phrase in the tafsir.

   Every edit is re-checked before it is saved.
3. **Export.** Click **Render video**. It takes about 2.5 minutes per minute of video. When it finishes, you get
   the MP4 (1080×1920, 30 fps, −14 LUFS), a review sheet (PDF) and an **Open folder** button. Files are saved in
   `out/<passage>/`.

## Surah pages and video plans

Videos are organised by surah. The home page lists the surahs you have made videos for, and **All 114 surahs**
opens any surah's page, which lists every video of that surah in verse order.

A surah can also have a **plan** (`plans/<surah>.json`): a researched split of the whole surah into short videos,
each with an estimated length, a suggested visual style and warnings, plus a **Create** button.
`plans/18.json` (Al-Kahf: 34 videos, 4 stories) is the first. The Al-Kahf research data is in `data/_analysis/18_1-110/`.

## Claude (optional, recommended)

Without a key, the app runs in **simple mode**: calm visuals, the surah name as the title, and no explanations
(you can add them by hand).

With a key, Claude writes the chapter titles, chooses story scenes or calm visuals, and picks short explanations
copied word for word from the tafsir. If the checks reject anything, Claude gets the errors and fixes them. Anything
that still fails is removed, never forced through.

- To connect Claude: open **Settings** and paste an Anthropic API key (from
  [console.anthropic.com](https://console.anthropic.com/settings/keys)). The key is stored only in `.env` on this
  computer, as `ANTHROPIC_API_KEY`.
- Models: Claude Opus 5.5 gives the best quality; Claude Sonnet 5.5 costs about half as much. The app shows the
  cost of each storyboard; it is usually a few cents to a few tens of cents.
- A Claude Code subscription does not power this button: the app needs its own API key, billed per use.

## What is guaranteed, and what is not

- **The Quran text is never typed or generated.** It comes from the Quran Foundation dataset and is
  cross-checked against Tanzil. Every word must have a timing, and audio cuts must fall in silence. If any of
  these fail, the passage is **blocked** and no video is made. Try another reciter or verse range.
- **Explanations** must be exact quotes from Al-Muyassar or As-Sa'di. They may not quote the verse itself.
- **Pictures** follow the rules in `renderer/js/scene_catalog.json`:
  - Allah is never depicted.
  - Prophets, angels and honoured women appear only as labelled lights.
  - People have no faces.
  - The unseen (Paradise, Hell, the Hereafter) is never illustrated literally.
- **A person must still review every video.** The checks cannot judge whether a title or scene is fitting, or
  catch a one-word quotation. The app does not unlock export until every verse is ticked.
- Before publishing, make sure you have the right to use the recitation and the data (Quran Foundation terms).

## First-time setup on a new computer

You need Node.js 20+, Google Chrome, ffmpeg (on the PATH) and Python 3.12+. Then run, in the project folder:

```sh
python -m venv .venv
.venv\Scripts\python -m pip install fonttools anthropic
cd renderer && npm install && cd ..
```

On first start, the app downloads the surah and reciter list (`data/catalog.json`).

## Where things live

| What | Where |
|---|---|
| The app (server + page) | `platform/server.mjs`, `platform/public/` |
| One passage's data, checks, audio | `data/<passage>/` (`project.json` holds the app state and the review) |
| Storyboard (chapters, titles, scenes, explanations) | `storyboard/<passage>.json` |
| Finished videos | `out/<passage>/` |
| Shared recitation downloads | `data/_audio/` |
| Scene library and its rules | `renderer/js/scenes_lib.js`, `renderer/js/scene_catalog.json` |
