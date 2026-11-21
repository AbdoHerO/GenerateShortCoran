// Screenshots of the Studio web app for visual checks.
// node renderer/tests/ui_shot.mjs <out-prefix> <hash>[,<hash>...] [width] [height] [--click=<selector>]
import { launchBrowser } from '../browser.mjs';
const [, , out = 'out/wip/ui', hashes = '#/', w = '1280', h = '900'] = process.argv;
const click = process.argv.find((a) => a.startsWith('--click='))?.slice(8);
const b = await launchBrowser();
const pg = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errs = [];
pg.on('pageerror', (e) => errs.push(String(e)));
pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
let i = 0;
for (const hash of hashes.split(',')) {
  await pg.goto('http://127.0.0.1:5178/' + hash);
  await pg.waitForTimeout(1800);
  if (click) { for (const s of click.split('|')) { await pg.click(s); await pg.waitForTimeout(900); } }
  await pg.screenshot({ path: `${out}_${i++}.png`, fullPage: true });
}
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
await b.close();
