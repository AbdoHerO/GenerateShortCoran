// Prints how many card pages each passage has (verses vs. blocks), to confirm which verses are paged.
// node renderer/tests/pages.mjs data/15_57-77/render_data.json [...]   (needs the Studio server on :5178)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome' });
const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
for (const d of process.argv.slice(2)) {
  await pg.goto(`http://127.0.0.1:5178/renderer/index.html?export=1&data=${encodeURIComponent(d)}`);
  await pg.waitForFunction('window.R && window.R.ready');
  const r = await pg.evaluate(async (d) => ({ verses: (await (await fetch('/' + d)).json()).verses.length, pages: window.R.pages }), d);
  console.log(d, r);
}
await b.close();
