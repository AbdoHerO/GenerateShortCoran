// Quran Video Studio - single-page app (no build step). Quranic text shown here always comes from the API data.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s) => { if (s == null || isNaN(s)) return '–'; s = Math.max(0, s); const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s - m * 60)).padStart(2, '0')}`; };
const fmtMin = (s) => (s < 90 ? `${Math.max(1, Math.round(s))} s` : `${Math.round(s / 60)} min`);
const view = $('#view');
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } } };

async function api(path, opts = {}) {
  const r = await fetch('/api/' + path, { ...opts, headers: { 'Content-Type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = r.headers.get('content-type')?.includes('json') ? await r.json() : await r.text();
  if (!r.ok) { const e = new Error(data?.error || `Request failed (${r.status})`); e.status = r.status; e.data = data; throw e; }
  return data;
}
let toastT;
function toast(msg, bad = false) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = ''), bad ? 6000 : 3200);
}
const ICON = {
  play: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#1f2b4f"/><path d="M10 8l6 4-6 4z" fill="#fff"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  story: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M3 18h18M5 18c1-4 3-6 5-6s3 2 4 2 2-3 4-3 2 3 2 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="7" r="2.5" fill="currentColor"/></svg>',
  calm: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const badge8 = (n) => `<span class="badge8"><svg viewBox="0 0 56 56"><g fill="#d9a948" stroke="#9c7128" stroke-width="1"><rect x="13" y="13" width="30" height="30"/><rect x="13" y="13" width="30" height="30" transform="rotate(45 28 28)"/></g><circle cx="28" cy="28" r="13.5" fill="#1f2b4f" stroke="#d4a955" stroke-width="1.5"/></svg><b>${n}</b></span>`;

let CAT = null;
async function catalog(force = false) { if (!CAT || force) CAT = await api('catalog'); return CAT; }
const surah = (n) => CAT.surahs.find((s) => s.n === n);
const reciterName = (r) => `${r.name_en}${r.style === 'Mujawwad' ? ' (Mujawwad)' : ''}`;

function stageInfo(p) {
  if (p.render === 'running' || p.render === 'queued') return ['work', 'Rendering…'];
  if (p.stage === 'preparing') return ['work', 'Preparing…'];
  if (p.stage === 'blocked') return ['bad', 'Blocked by the checks'];
  if (p.stage === 'error') return ['bad', 'Needs attention'];
  if (p.render === 'done') return ['ok', 'Video ready'];
  if (p.approved) return ['ok', 'Approved'];
  return ['review', 'Ready for review'];
}
const pill = (p) => { const [c, t] = stageInfo(p); return `<span class="pill ${c}">${t}</span>`; };

// ======================================================================= router
let poll = null;
function route() {
  clearTimeout(poll); poll = null;
  const [, a, id, tab] = location.hash.split('/');
  if (a === 'p' && id) return projectPage(decodeURIComponent(id), tab);
  if (a === 's') return id ? surahPage(+id) : surahIndex();
  return home();
}
addEventListener('hashchange', route);
$('#settingsBtn').onclick = () => settings();

// ======================================================================= home
const IDEAS = [
  { t: 'Ayat al-Kursi', ch: 2, a: 255, b: 255 }, { t: 'Al-Fatihah', ch: 1, a: 1, b: 7 }, { t: 'Al-Ikhlas', ch: 112, a: 1, b: 4 },
  { t: 'Al-Asr', ch: 103, a: 1, b: 3 }, { t: "Yusuf's dream", ch: 12, a: 4, b: 6 }, { t: "Nuh's ark", ch: 11, a: 40, b: 44 },
  { t: 'The elephant', ch: 105, a: 1, b: 5 }, { t: 'People of the cave', ch: 18, a: 9, b: 13 },
];
const norm = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[ً-ٰٟ]/g, '').replace(/^(al|an|ar|as|ash|at|az|ad|adh)[- ]/, '').replace(/[^a-z0-9ء-ي]/g, '').replace(/^ال/, '');

async function home() {
  view.innerHTML = '<div class="muted">Loading…</div>';
  let surahs;
  try { [, surahs] = await Promise.all([catalog(true), api('surahs')]); }
  catch (e) { view.innerHTML = `<div class="notice red">Could not reach the Studio server: ${esc(e.message)}. Is the Studio window still open?</div>`; return; }
  const f = { chapter: null, from: 1, to: 1, reciter: 7, style: 'story', ...store.get('form', {}), ...(store.get('prefill', null) || {}) };
  store.set('prefill', null);
  if (!CAT.reciters.some((r) => r.id === f.reciter)) f.reciter = CAT.reciters[0].id;
  const claude = CAT.claude.configured;
  if (!claude) f.style = 'calm';

  view.innerHTML = `
  <div class="home">
    <section>
      <h1>Create a Quran recitation video</h1>
      <p class="lead">Pick a passage and a reciter. The verses, recitation and tafsir come from the Quran Foundation and are checked automatically. You review every verse, then export the video.</p>
      <div class="card">
        <div class="field">
          <label class="f" for="sq">Surah</label>
          <div id="surahBox"></div>
        </div>
        <div class="field">
          <label class="f">Verses</label>
          <div class="range"><input class="input" id="vf" type="number" min="1" inputmode="numeric" aria-label="From verse"><span>to</span><input class="input" id="vt" type="number" min="1" inputmode="numeric" aria-label="To verse"></div>
          <div class="hint" id="rangeHint">&nbsp;</div>
        </div>
        <div class="field">
          <label class="f" for="rc">Reciter</label>
          <select class="input" id="rc">${CAT.reciters.map((r) => `<option value="${r.id}">${esc(reciterName(r))} · ${esc(r.name_ar)}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label class="f">Visuals</label>
          <div class="styles">
            <label class="choice"><input type="radio" name="st" value="story" ${claude ? '' : 'disabled'}><span class="ic">${ICON.story}</span><b>Story scenes</b><small>Symbolic illustrated scenes for stories; calm visuals for everything else.</small></label>
            <label class="choice"><input type="radio" name="st" value="calm"><span class="ic">${ICON.calm}</span><b>Calm visuals</b><small>Light, sky, nature and geometric patterns only.</small></label>
          </div>
        </div>
        <div class="field">${claude
          ? `<div class="notice green">${ICON.check}<span><b>Claude is connected.</b> It writes the chapter titles, picks the scenes and selects short explanations quoted word-for-word from the tafsir.</span></div>`
          : `<div class="notice gold"><span><b>Simple mode.</b> Without a Claude API key the video gets calm visuals and no tafsir explanations (you can add them by hand). <button class="link" id="openSettings">Connect Claude</button> to unlock story scenes and explanations.</span></div>`}</div>
        <button class="btn big" id="create" style="width:100%">Create video draft</button>
      </div>
      <div class="ideas" aria-label="Ideas">${IDEAS.map((x, i) => `<button class="chip" data-i="${i}">${esc(x.t)}<span class="ar">${esc(surah(x.ch).name_ar)}</span></button>`).join('')}</div>
    </section>
    <section>
      ${(() => {
        const mine = surahs.filter((s) => s.videos > 0).sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
        return `<div class="lib-head"><h2>Your surahs</h2><a class="link" href="#/s">All 114 surahs →</a></div>
        <div class="lib">${mine.length ? mine.map(surahCard).join('') : '<div class="empty">Each surah you make videos for gets its own page here.</div>'}</div>`;
      })()}
    </section>
  </div>`;

  // surah combobox
  const box = $('#surahBox');
  const drawPicked = () => {
    const s = surah(f.chapter);
    box.innerHTML = s ? `<div class="input picked"><span><b>${s.n}. ${esc(s.name_en)}</b> <span class="muted small">· ${esc(s.meaning)} · ${s.verses} verses</span></span><span class="ar">${esc(s.name_ar)}</span></div>
      <div class="hint"><button class="link" id="chg">Change surah</button></div>` : '';
    if (s) $('#chg').onclick = () => drawSearch();
    else drawSearch();
  };
  const drawSearch = () => {
    box.innerHTML = `<div class="combo"><input class="input" id="sq" placeholder="Search: number, name or meaning (e.g. 18, Kahf, الكهف, cave)" autocomplete="off"><div class="combo-list hidden" id="sl"></div></div>`;
    const q = $('#sq'), list = $('#sl');
    let items = [], on = 0;
    const show = () => {
      const t = norm(q.value);
      items = CAT.surahs.filter((s) => !t || String(s.n) === q.value.trim() || norm(s.name_en).includes(t) || norm(s.name_ar).includes(t) || norm(s.meaning).includes(t)).slice(0, 40);
      on = 0;
      list.innerHTML = items.map((s, i) => `<div class="combo-item${i === 0 ? ' on' : ''}" data-n="${s.n}"><span class="num">${s.n}</span><span><b>${esc(s.name_en)}</b> <span class="muted small">${esc(s.meaning)} · ${s.verses}</span></span><span class="ar">${esc(s.name_ar)}</span></div>`).join('') || '<div class="muted small" style="padding:8px">No surah found</div>';
      list.classList.remove('hidden');
    };
    const pick = (n) => { f.chapter = n; const s = surah(n); f.from = 1; f.to = Math.min(s.verses, 7); syncRange(); drawPicked(); };
    q.oninput = show; q.onclick = show;
    q.onkeydown = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); on = Math.max(0, Math.min(items.length - 1, on + (e.key === 'ArrowDown' ? 1 : -1))); $$('.combo-item', list).forEach((el, i) => el.classList.toggle('on', i === on)); $$('.combo-item', list)[on]?.scrollIntoView({ block: 'nearest' }); }
      if (e.key === 'Enter' && items[on]) { e.preventDefault(); pick(items[on].n); }
      if (e.key === 'Escape') list.classList.add('hidden');
    };
    list.onmousedown = (e) => { const it = e.target.closest('.combo-item'); if (it) { e.preventDefault(); pick(+it.dataset.n); } };
    q.onblur = () => setTimeout(() => list.classList.add('hidden'), 120);
    if (f.chapter == null) setTimeout(() => q.focus(), 50);
  };
  const vf = $('#vf'), vt = $('#vt'), hint = $('#rangeHint');
  const syncRange = () => {
    const s = surah(f.chapter);
    vf.disabled = vt.disabled = !s;
    if (!s) { hint.innerHTML = 'Choose a surah first.'; return; }
    vf.max = vt.max = s.verses; vf.value = f.from; vt.value = f.to;
    const n = f.to - f.from + 1;
    hint.innerHTML = n >= 1 ? `${n} verse${n > 1 ? 's' : ''} of ${s.verses}${n > 40 ? ' · <b style="color:var(--red)">max 40 per video</b>' : n > 15 ? ' · a longer video' : ''}` : '<b style="color:var(--red)">The last verse must come after the first.</b>';
  };
  const clampRange = () => {
    const s = surah(f.chapter); if (!s) return;
    f.from = Math.max(1, Math.min(s.verses, Math.round(+vf.value || 1)));
    f.to = Math.max(1, Math.min(s.verses, Math.round(+vt.value || f.from)));
    syncRange();
  };
  vf.onchange = () => { clampRange(); if (f.to < f.from) { f.to = f.from; syncRange(); } };
  vt.onchange = clampRange;
  vf.oninput = vt.oninput = () => { f.from = +vf.value; f.to = +vt.value; const s = surah(f.chapter); if (s) hint.textContent = f.to >= f.from ? `${f.to - f.from + 1} verses of ${s.verses}` : 'The last verse must come after the first.'; };
  $('#rc').value = f.reciter; $('#rc').onchange = (e) => (f.reciter = +e.target.value);
  $$('input[name=st]').forEach((r) => { r.checked = r.value === f.style; r.onchange = () => (f.style = r.value); });
  $('#openSettings')?.addEventListener('click', settings);
  $$('.ideas .chip').forEach((b) => (b.onclick = () => { const x = IDEAS[+b.dataset.i]; f.chapter = x.ch; f.from = x.a; f.to = x.b; drawPicked(); syncRange(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
  drawPicked(); syncRange();

  $('#create').onclick = async (ev) => {
    clampRange();
    const s = surah(f.chapter);
    if (!s) return toast('Choose a surah first.', true);
    if (f.to < f.from) return toast('The last verse must come after the first.', true);
    if (f.to - f.from + 1 > 40) return toast('Please choose at most 40 verses per video.', true);
    store.set('form', { reciter: f.reciter, style: f.style });
    await createVideo({ chapter: f.chapter, from: f.from, to: f.to, reciter: f.reciter, style: f.style }, ev.currentTarget);
  };
}

// one place that starts a draft (home form, surah page, plan suggestions)
async function createVideo(payload, btn) {
  const s = surah(payload.chapter);
  const label = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Starting…'; }
  payload = { ...payload, director: CAT.claude.configured ? 'claude' : 'auto', style: CAT.claude.configured ? payload.style : 'calm' };
  try {
    const r = await api('projects', { method: 'POST', body: payload });
    location.hash = `#/p/${encodeURIComponent(r.id)}`;
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = label; }
    if (e.status === 409 && e.data?.id) {
      const again = e.data.error === 'exists' && await confirmDlg('You already made this video', `${s.name_en} ${payload.chapter}:${payload.from}–${payload.to} with this reciter already exists. Open it, or start it again from scratch (your review will be reset)?`, 'Start again', 'Open it');
      if (again) { try { const r = await api('projects', { method: 'POST', body: { ...payload, replace: true } }); location.hash = `#/p/${encodeURIComponent(r.id)}`; } catch (e2) { toast(e2.message, true); } }
      else location.hash = `#/p/${encodeURIComponent(e.data.id)}`;
    } else toast(e.message, true);
  }
}

// ======================================================================= surahs
function surahCard(s) {
  return `<a class="pcard" href="#/s/${s.n}">${badge8(s.n)}
    <div><div class="t">${esc(s.name_en)}<span class="ar">${esc(s.name_ar)}</span></div>
    <div class="s">${s.videos} video${s.videos > 1 ? 's' : ''}${s.ready ? ` · ${s.ready} ready` : ''} · ${s.verses} verses</div></div>
    <span class="muted">›</span></a>`;
}

async function surahIndex() {
  view.innerHTML = '<div class="muted">Loading…</div>';
  let list;
  try { [, list] = await Promise.all([catalog(), api('surahs')]); } catch (e) { view.innerHTML = `<div class="notice red">${esc(e.message)}</div>`; return; }
  view.innerHTML = `<a class="back" href="#/">← Home</a>
    <div class="phead"><div><h1>All surahs</h1><div class="muted">Open a surah to see its videos, its suggested video plan, and to make new ones.</div></div>
    <input class="input" id="sf" placeholder="Search: number, name or meaning" style="max-width:340px"></div>
    <div class="sgrid" id="sg"></div>`;
  const draw = () => {
    const t = norm($('#sf').value);
    $('#sg').innerHTML = list.filter((s) => !t || String(s.n) === $('#sf').value.trim() || norm(s.name_en).includes(t) || norm(s.name_ar).includes(t) || norm(s.meaning).includes(t))
      .map((s) => `<a class="stile ${s.videos ? 'has' : ''}" href="#/s/${s.n}"><span class="num">${s.n}</span><span class="ar">${esc(s.name_ar)}</span>
        <span class="en">${esc(s.name_en)}</span><span class="cnt">${s.videos ? `${s.videos} video${s.videos > 1 ? 's' : ''}` : `${s.verses} verses`}${s.plan ? ' · plan' : ''}</span></a>`).join('');
  };
  $('#sf').oninput = draw; draw();
}

async function surahPage(n) {
  view.innerHTML = '<div class="muted">Loading…</div>';
  let d;
  try { await catalog(); d = await api(`surahs/${n}`); } catch (e) { view.innerHTML = `<a class="back" href="#/s">← All surahs</a><div class="notice red">${esc(e.message)}</div>`; return; }
  const s = d.surah, plan = d.plan;
  const form = { reciter: store.get('form', {}).reciter || 7, style: store.get('form', {}).style || 'story' };
  if (!CAT.reciters.some((r) => r.id === form.reciter)) form.reciter = CAT.reciters[0].id;
  const made = (a, b) => d.videos.filter((v) => v.from === a && v.to === b);
  view.innerHTML = `<a class="back" href="#/s">← All surahs</a>
    <div class="phead"><div><div class="ar-title">سورة ${esc(s.name_ar)}</div>
      <div class="meta"><b style="color:var(--navy)">${s.n}. ${esc(s.name_en)}</b><span>${esc(s.meaning)}</span><span>${s.verses} verses</span><span>${s.place === 'makkah' ? 'Meccan' : 'Medinan'}</span></div></div></div>
    <div class="card" style="margin-bottom:22px">
      <div class="row" style="flex-wrap:wrap;gap:12px;align-items:flex-end">
        <div style="flex:1;min-width:220px"><label class="f" for="src">Reciter for new videos</label><select class="input" id="src">${CAT.reciters.map((r) => `<option value="${r.id}">${esc(reciterName(r))} · ${esc(r.name_ar)}</option>`).join('')}</select></div>
        <div><label class="f">Verses</label><div class="range" style="width:230px"><input class="input" id="sa" type="number" min="1" max="${s.verses}" value="1"><span>to</span><input class="input" id="sb" type="number" min="1" max="${s.verses}" value="${Math.min(s.verses, 7)}"></div></div>
        <button class="btn" id="snew">New video</button>
      </div></div>
    ${plan ? `<h2>Suggested videos <span class="muted small" style="font-weight:500">· ${esc(plan.summary || '')}</span></h2>
      ${plan.notes?.length ? `<details class="notice gold" style="display:block;margin-bottom:12px"><summary><b>Read before making these videos</b></summary><ul class="fails">${plan.notes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
      ${plan.groups.map((g) => `<div class="card" style="margin-bottom:14px"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h3 style="margin:0">${esc(g.title_en)} <span class="ar" style="margin-left:6px">${esc(g.title_ar)}</span></h3><span class="muted small">verses ${g.from}–${g.to}</span></div>
        ${g.intro ? `<p class="muted small" style="margin:6px 0 10px">${esc(g.intro)}</p>` : ''}
        ${g.videos.map((v) => { const m = made(v.from, v.to); return `<div class="planrow">
          <div><div class="ar" style="font-weight:800;color:var(--navy);font-size:17px">${esc(v.title_ar)}</div><div class="small">${esc(v.title_en)} · <b>${s.n}:${v.from}${v.to !== v.from ? '–' + v.to : ''}</b> · ~${fmt(v.est_s)} · ${v.visual === 'stage' ? 'story scene' : 'calm visuals'}</div>
            ${v.care ? `<div class="small" style="color:#8a5a14;margin-top:2px">⚠ ${esc(v.care)}</div>` : ''}
            ${m.length ? `<div class="small" style="margin-top:4px">${m.map((x) => `<a href="#/p/${encodeURIComponent(x.id)}">${esc(x.reciter_en)}</a> ${pill(x)}`).join(' ')}</div>` : ''}</div>
          <button class="btn light" data-a="${v.from}" data-b="${v.to}" data-st="${v.visual === 'stage' ? 'story' : 'calm'}">Create</button></div>`; }).join('')}
        </div>`).join('')}` : ''}
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;margin-top:8px"><h2 style="margin:0">Your videos in this surah</h2>
      ${d.videos.some((v) => v.approved && !['done', 'running', 'queued'].includes(v.render)) ? `<button class="btn gold" id="renderAll">Render all approved (${d.videos.filter((v) => v.approved && !['done', 'running', 'queued'].includes(v.render)).length})</button>` : ''}</div>
    <p class="muted small">${d.videos.length} videos · ${d.videos.filter((v) => v.approved).length} approved · ${d.videos.filter((v) => v.render === 'done').length} rendered</p>
    <div class="lib">${d.videos.length ? d.videos.map((p) => `<a class="pcard" href="#/p/${encodeURIComponent(p.id)}">${badge8(p.chapter)}
      <div><div class="t">${p.chapter}:${p.from}${p.to !== p.from ? '–' + p.to : ''}</div><div class="s">${esc(p.reciter_en || '')}${p.duration ? ' · ' + fmt(p.duration) : ''}</div></div>${pill(p)}</a>`).join('')
      : '<div class="empty">No videos in this surah yet.</div>'}</div>`;
  $('#src').value = form.reciter;
  $('#src').onchange = (e) => { form.reciter = +e.target.value; store.set('form', { ...store.get('form', {}), reciter: form.reciter }); };
  $('#snew').onclick = (ev) => {
    const a = Math.max(1, Math.min(s.verses, +$('#sa').value || 1)), b = Math.max(a, Math.min(s.verses, +$('#sb').value || a));
    if (b - a + 1 > 40) return toast('Please choose at most 40 verses per video.', true);
    createVideo({ chapter: s.n, from: a, to: b, reciter: form.reciter, style: form.style }, ev.currentTarget);
  };
  $('#renderAll')?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget; b.disabled = true;
    try { const r = await api(`surahs/${s.n}/render-approved`, { method: 'POST' }); toast(`${r.queued} video(s) queued for rendering. Keep the Studio window open.`); surahPage(s.n); }
    catch (e) { toast(e.message, true); b.disabled = false; }
  });
  $$('[data-a]').forEach((btn) => (btn.onclick = () => createVideo({ chapter: s.n, from: +btn.dataset.a, to: +btn.dataset.b, reciter: form.reciter, style: btn.dataset.st }, btn)));
}

// ======================================================================= dialogs
function confirmDlg(title, text, yes = 'OK', no = 'Cancel', danger = false) {
  return new Promise((resolve) => {
    const d = $('#dlg');
    d.innerHTML = `<div class="card"><h2>${esc(title)}</h2><p class="muted">${esc(text)}</p><div class="actions" style="justify-content:flex-end">
      <button class="btn light" id="dn">${esc(no)}</button><button class="btn ${danger ? 'danger' : ''}" id="dy">${esc(yes)}</button></div></div>`;
    d.showModal();
    $('#dy', d).onclick = () => { d.close(); resolve(true); };
    $('#dn', d).onclick = () => { d.close(); resolve(false); };
    d.oncancel = () => resolve(false);
  });
}

async function settings() {
  await catalog(true);
  const d = $('#dlg');
  const c = CAT.claude;
  d.innerHTML = `<div class="card">
    <h2>Settings</h2>
    <div class="field"><label class="f" for="key">Claude API key</label>
      <input class="input" id="key" type="password" placeholder="${c.configured ? 'A key is saved (enter a new one to replace it)' : 'sk-ant-…'}" autocomplete="off">
      <div class="hint">Claude writes the storyboard: titles, scenes and tafsir explanations. Create a key at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> (billed per use, roughly a few cents to a few dimes per video). The key is saved only in the <code>.env</code> file on this computer.</div></div>
    <div class="field"><label class="f" for="mdl">Model</label>
      <select class="input" id="mdl"><option value="claude-opus-5-5">Claude Opus 5.5 · best quality</option><option value="claude-sonnet-5-5">Claude Sonnet 5.5 · about half the cost</option></select></div>
    <div class="notice ${c.configured ? 'green' : 'gold'}" style="margin-bottom:16px">${c.configured ? 'Claude is connected.' : 'No key saved: videos use simple mode.'}</div>
    <div class="actions" style="justify-content:space-between">
      ${c.configured ? '<button class="btn danger" id="rm">Remove key</button>' : '<span></span>'}
      <div class="actions"><button class="btn light" id="cx">Close</button><button class="btn" id="sv">Save</button></div>
    </div></div>`;
  $('#mdl', d).value = c.model;
  d.showModal();
  $('#cx', d).onclick = () => d.close();
  const saveS = async (bodyS) => {
    try { await api('settings', { method: 'POST', body: bodyS }); d.close(); toast('Settings saved'); await catalog(true); if (!location.hash.startsWith('#/p/')) home(); }
    catch (e) { toast(e.message, true); }
  };
  $('#sv', d).onclick = () => { const k = $('#key', d).value.trim(); saveS({ ...(k ? { anthropic_api_key: k } : {}), claude_model: $('#mdl', d).value }); };
  $('#rm', d)?.addEventListener('click', () => saveS({ anthropic_api_key: '' }));
}

// ======================================================================= project
let P = null, panelKey = '', R = null, saveT = null;

async function projectPage(id, tab) {
  if (!P || P.id !== id) { view.innerHTML = '<div class="muted">Loading…</div>'; panelKey = ''; R = null; }
  try { await catalog(); P = await api(`projects/${encodeURIComponent(id)}`); }
  catch (e) { view.innerHTML = `<a class="back" href="#/s">← All surahs</a><div class="notice red">${esc(e.message)}</div>`; return; }
  if (!$('#ph') || view.dataset.pid !== id) {
    view.dataset.pid = id;
    view.innerHTML = `<a class="back" href="#/s/${P.chapter}">← Surat ${esc(P.surah_en)}</a><div class="phead" id="ph"></div><div class="stepper" id="stepper"></div><div id="panel"></div>`;
  }
  const active = P.stage === 'preparing' || P.render?.state === 'running' || P.render?.state === 'queued';
  const cur = currentTab(tab);
  drawHead(); drawStepper(cur);
  const key = [cur, P.stage, P.render?.state, P.review?.approved, P.data_version, P.ready].join('|');
  if (key !== panelKey) { panelKey = key; ({ prepare: drawPrepare, review: drawReview, export: drawExport })[cur](); }
  else if (cur === 'prepare') updateSteps();
  else if (cur === 'export') updateRender();
  else if (cur === 'review') updateEditBanner();
  if (active) poll = setTimeout(() => projectPage(id, tab), 1000);
}
function currentTab(tab) {
  const editing = P.stage === 'preparing' && P.ready && P.steps?.find((s) => s.key === 'direct')?.state === 'done' && P.steps?.find((s) => s.key === 'fetch')?.state === 'done' && P.verses.length;
  if (P.stage === 'preparing' && !editing) return 'prepare';
  if (P.stage === 'error' || P.stage === 'blocked') return P.ready && tab === 'review' ? 'review' : 'prepare';
  if (tab === 'export' || (P.render?.state && P.render.state !== 'idle' && tab !== 'review')) return 'export';
  return tab === 'export' ? 'export' : 'review';
}
function go(tab) { location.hash = `#/p/${encodeURIComponent(P.id)}/${tab}`; }

function drawHead() {
  const s = surah(P.chapter) || {};
  const d = P.director_info;
  const by = P.handmade ? 'Hand-made production' : d?.mode === 'claude' ? `Storyboard by Claude${d.cost_usd != null ? ` ($${d.cost_usd.toFixed(2)})` : ''}` : d?.mode === 'hand' ? 'Hand-written storyboard' : 'Simple storyboard';
  $('#ph').innerHTML = `<div><div class="ar-title">سورة ${esc(P.surah_ar)}</div>
    <div class="meta"><b style="color:var(--navy)">${esc(P.surah_en)} ${P.chapter}:${P.from}${P.to !== P.from ? '–' + P.to : ''}</b><span>${esc(P.reciter_en)}${P.reciter_style === 'Mujawwad' ? ' (Mujawwad)' : ''} · <span class="ar">${esc(P.reciter_ar)}</span></span>
    ${P.duration ? `<span>${fmt(P.duration)}</span>` : ''}<span>${esc(by)}</span>${pill({ ...P, render: P.render?.state, approved: P.review?.approved })}</div></div>
    ${P.handmade ? '' : `<button class="ghost" id="del" title="Delete this video">${ICON.trash}<span>Delete</span></button>`}`;
  $('#del')?.addEventListener('click', async () => {
    if (!(await confirmDlg('Delete this video?', 'The draft, the review and any exported files of this passage are removed from this computer.', 'Delete', 'Cancel', true))) return;
    try { await api(`projects/${encodeURIComponent(P.id)}`, { method: 'DELETE' }); toast('Deleted'); location.hash = `#/s/${P.chapter}`; } catch (e) { toast(e.message, true); }
  });
}

function drawStepper(cur) {
  const prepDone = P.ready && P.stage !== 'preparing' && P.stage !== 'error' && P.stage !== 'blocked';
  const st = [
    ['prepare', '1', 'Prepare', prepDone ? 'done' : ''],
    ['review', '2', 'Review', P.review?.approved ? 'done' : prepDone ? 'avail' : ''],
    ['export', '3', 'Export', P.render?.state === 'done' ? 'done' : P.review?.approved ? 'avail' : ''],
  ];
  $('#stepper').innerHTML = st.map(([k, n, l, c]) => `<button class="stp ${k === cur ? 'cur' : c}" data-k="${k}" ${c || k === cur ? '' : 'disabled'}><span class="n">${c === 'done' && k !== cur ? '✓' : n}</span><span class="lbl">${l}</span></button>`).join('');
  $$('#stepper .stp').forEach((b) => (b.onclick = () => { if (b.dataset.k !== 'prepare' && b.dataset.k !== cur) go(b.dataset.k); }));
}

// ----------------------------------------------------------------------- prepare
function stepsHTML() {
  return `<ul class="steps" id="steps">${P.steps.map((s) => `<li class="${s.state}"><span class="ico">${s.state === 'done' ? ICON.check : s.state === 'error' ? ICON.x : ''}</span>
    <div><div>${esc(s.label)}</div>${s.detail ? `<div class="d">${esc(s.detail)}</div>` : ''}${s.state === 'running' ? `<div class="bar ${s.progress == null ? 'indef' : ''}"><i style="width:${Math.round((s.progress || 0) * 100)}%"></i></div>` : ''}</div></li>`).join('')}</ul>`;
}
function updateSteps() { const el = $('#steps'); if (el) el.outerHTML = stepsHTML(); const q = $('#qwait'); if (q) q.classList.toggle('hidden', !(P.stage === 'preparing' && !P.steps.some((s) => s.state === 'running'))); }
function drawPrepare() {
  const e = P.error;
  $('#panel').innerHTML = `<div class="prep">
    <div class="card">${e ? '' : `<h2>Preparing your video</h2><p class="muted" style="margin-top:-6px">This usually takes under a minute${P.director === 'claude' ? ' (Claude may need a minute or two more)' : ''}. You can leave this page.</p>`}
      ${e ? `<div class="notice red" style="display:block"><b style="font-size:16px">${esc(e.title)}</b><div style="margin-top:4px">${esc(e.detail || '')}</div>
        ${e.fails?.length ? `<ul class="fails">${e.fails.map((x) => `<li><b>${esc(x.area)}</b>: ${esc(x.msg)}</li>`).join('')}</ul>` : ''}</div>
        <div class="actions" style="margin:16px 0 6px">
          ${P.stage === 'blocked' ? '<button class="btn" id="other">Choose another reciter or range</button>' : '<button class="btn" id="retry">Try again</button>'}
          ${e.canSimple ? '<button class="btn light" id="simple">Continue without Claude</button>' : ''}
          ${P.stage === 'blocked' ? '<button class="btn light" id="retry">Check again</button>' : ''}
        </div>` : ''}
      <div id="qwait" class="notice ${P.stage === 'preparing' && !P.steps.some((s) => s.state === 'running') ? '' : 'hidden'}" style="margin-bottom:10px">Waiting for another video to finish preparing…</div>
      ${stepsHTML()}
      ${e?.log?.length ? `<details style="margin-top:12px"><summary class="muted small">Technical details</summary><pre class="log">${esc(e.log.join('\n'))}</pre></details>` : ''}
    </div></div>`;
  const retry = (b) => async () => { try { await api(`projects/${encodeURIComponent(P.id)}/retry`, { method: 'POST', body: b }); panelKey = ''; projectPage(P.id); } catch (er) { toast(er.message, true); } };
  $$('#retry').forEach((x) => (x.onclick = retry({})));
  $('#simple')?.addEventListener('click', retry({ simple: true }));
  $('#other')?.addEventListener('click', () => { store.set('prefill', { chapter: P.chapter, from: P.from, to: P.to }); location.hash = '#/'; });
}

// ----------------------------------------------------------------------- review
function previewUrl() { return `/renderer/index.html?data=${encodeURIComponent(P.data_url)}&t=0&v=${P.data_version}`; }
function player() { try { return $('#pv').contentWindow.player; } catch { return null; } }
function playAt(t) { const p = player(); if (p) p.playFrom(Math.max(0, t - 0.25)); else toast('The preview is still loading…'); }
function saveReview(approve = false) {
  clearTimeout(saveT);
  const body = { ...R, approve };
  const send = () => api(`projects/${encodeURIComponent(P.id)}/review`, { method: 'POST', body }).then((r) => { P.review = r.review; return r; });
  if (approve) return send();
  saveT = setTimeout(() => send().catch((e) => toast(e.message, true)), 400);
}
function updateEditBanner() {
  const b = $('#editing'); if (!b) return;
  const on = P.stage === 'preparing';
  b.classList.toggle('hidden', !on);
}

function drawReview() {
  R = { verses: { ...(P.review?.verses || {}) }, timing: { ...(P.review?.timing || {}) }, titles: !!P.review?.titles, reviewer: P.review?.reviewer || store.get('reviewer', '') };
  const v = P.verify, d = P.director_info;
  $('#panel').innerHTML = `<div class="revlay">
    <div class="phone"><div class="frame"><iframe id="pv" title="Video preview" src="${previewUrl()}"></iframe></div>
      <div class="hint" style="text-align:center">Space = play/pause · ←/→ = 2 s · <a href="${previewUrl()}" target="_blank" rel="noopener">open larger</a></div></div>
    <div>
      <div id="editing" class="notice gold ${P.stage === 'preparing' ? '' : 'hidden'}" style="margin-bottom:12px"><span class="spinner" style="border-color:rgba(110,83,32,.3);border-top-color:#6e5320"></span><span>Applying your changes and re-checking… the preview refreshes when it is done.</span></div>
      ${P.stage === 'error' ? `<div class="notice red" style="margin-bottom:12px"><span><b>${esc(P.error?.title || 'Problem')}</b> ${esc(P.error?.detail || '')} ${P.error?.fails?.length ? `<ul class="fails">${P.error.fails.map((x) => `<li>${esc(x.msg)}</li>`).join('')}</ul>` : ''}</span></div>` : ''}
      <div class="card" style="margin-bottom:16px">
        <div class="checks">
          ${v ? `<div class="notice ${v.passed ? 'green' : 'red'}" style="flex:1">${v.passed ? ICON.check : ICON.x}<span><b>${v.passed ? 'All automatic checks passed' : 'Some checks failed'}</b> · ${v.pass} checks: Quran text against a second source (Tanzil), every word timed, explanations quoted word-for-word from the tafsir, fonts. <button class="link" id="report">View report</button></span></div>` : ''}
        </div>
        ${d?.notes ? `<div class="hint" style="margin-top:12px"><b>${d.mode === 'claude' ? 'Note from Claude' : 'Note'}:</b> ${esc(d.notes)}</div>` : ''}
        ${d?.removed?.length ? `<details class="hint"><summary>${d.removed.length} item(s) removed because they could not be verified</summary><ul class="fails">${d.removed.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
      </div>
      <div class="tabs"><button class="tab on" data-t="check">Review</button><button class="tab" data-t="edit" ${P.handmade ? 'disabled title="Hand-made productions are edited in code"' : ''}>Edit</button></div>
      <div id="tabBody"></div>
    </div></div>`;
  $('#report')?.addEventListener('click', showReport);
  $$('.tab').forEach((t) => (t.onclick = () => { if (t.disabled) return; $$('.tab').forEach((x) => x.classList.toggle('on', x === t)); t.dataset.t === 'edit' ? drawEdit() : drawChecklist(); }));
  drawChecklist();
}

async function showReport() {
  const d = $('#dlg');
  const txt = await (await fetch(`/api/projects/${encodeURIComponent(P.id)}/report`)).text();
  d.innerHTML = `<div class="card"><h2>Verification report</h2><pre class="log" style="max-height:60vh;background:#faf6ee;color:#24263a;direction:ltr">${esc(txt)}</pre><div class="actions" style="justify-content:flex-end"><button class="btn" id="ok">Close</button></div></div>`;
  d.style.width = 'min(860px, 94vw)'; d.showModal(); $('#ok', d).onclick = () => { d.close(); d.style.width = ''; };
}

function drawChecklist() {
  const tc = P.timing_corrections || [];
  const body = $('#tabBody');
  body.innerHTML = `
    ${tc.length ? `<div class="card" style="margin-bottom:14px;border-color:#efd9a8;background:#fffaf0"><h3>Listen and confirm</h3>
      <p class="muted small" style="margin-top:-4px">The timing data had a known error here and was corrected. Play it and check the gold highlight by ear.</p>
      ${tc.map((c, i) => { const vv = P.verses.find((x) => x.n === c.verse); const w = vv?.words[c.set_word - 1]; return `<div class="row" style="flex-wrap:wrap;margin:8px 0">
        <button class="play" data-t="${c.video_t}">${ICON.play}${fmt(c.video_t)}</button>
        <span>${P.chapter}:${c.verse}: the highlight should be on <span class="quran" style="font-size:22px">${esc(w?.text)}</span> (word ${c.set_word})</span>
        <label class="tick"><input type="radio" name="tc${i}" value="ok" ${R.timing[i] === 'ok' ? 'checked' : ''}>Sounds right</label>
        <label class="tick"><input type="radio" name="tc${i}" value="wrong" ${R.timing[i] === 'wrong' ? 'checked' : ''}>Wrong</label></div>`; }).join('')}</div>` : ''}
    ${(P.timing_flags || []).length ? `<div class="card" style="margin-bottom:14px;border-color:#efd9a8;background:#fffaf0"><h3>Listen closely: very short word timings</h3>
      <p class="muted small" style="margin-top:-4px">The timing data gives these words less than 0.15 s, so their gold highlight only flashes. Play each one and check that the highlight still matches the voice; if not, note the time in the review.</p>
      ${P.timing_flags.map((f) => `<div class="row" style="flex-wrap:wrap;margin:6px 0"><button class="play" data-t="${f.video_t - 1.5}">${ICON.play}${fmt(f.video_t)}</button>
        <span>${P.chapter}:${f.verse}, word ${f.word} <span class="quran" style="font-size:22px">${esc(f.text)}</span> · ${f.dur_ms} ms</span></div>`).join('')}</div>` : ''}
    ${(P.aligned_boundaries || []).length ? `<div class="card" style="margin-bottom:14px;border-color:#c9d6e8;background:#f6f9fd"><h3>Verse changes aligned to the recitation</h3>
      <p class="muted small" style="margin-top:-4px">The timing data placed these verse changes while the reciter was still sounding. They were moved onto the real pause measured in the audio. Play each one: the highlight must jump to the next verse exactly when the reciter starts it.</p>
      <div class="row" style="flex-wrap:wrap;gap:8px">${P.aligned_boundaries.map((m) => `<button class="play" data-t="${m.video_t - 1.2}">${ICON.play}${P.chapter}:${m.after} → ${m.after + 1} · ${fmt(m.video_t)}</button>`).join('')}</div></div>` : ''}
    <div class="verse ${R.titles ? 'ok' : ''}" id="titlesBox">
      <div class="vh"><b style="color:var(--navy)">Chapter titles and pictures</b><label class="tick"><input type="checkbox" id="titles" ${R.titles ? 'checked' : ''}>Appropriate</label></div>
      <div class="muted small" style="margin-bottom:8px">Titles are written by ${P.director_info?.mode === 'claude' ? 'Claude' : 'the app'}, not Quran text. Check that each title and scene fits the meaning and the etiquette (no depiction of prophets, angels or the unseen).</div>
      ${P.chapters.map((c) => `<div class="row" style="justify-content:space-between;border-top:1px solid #f0e9dc;padding:6px 0"><span class="ar" style="font-weight:800;font-size:17px;color:var(--navy)">${esc(c.title)}</span>
        <span class="row small muted">${sceneLabel(c)} · ${c.verses.length > 1 ? `verses ${c.verses[0]}–${c.verses[c.verses.length - 1]}` : `verse ${c.verses[0]}`}<button class="play" data-t="${c.start + (c.start > 0 ? 0.3 : 0)}">${ICON.play}${fmt(c.start)}</button></span></div>`).join('')}
    </div>
    ${P.verses.map((v) => `<div class="verse ${R.verses[v.n] ? 'ok' : ''}" data-n="${v.n}">
      <div class="vh"><span class="row"><button class="play" data-t="${v.start}">${ICON.play}${fmt(v.start)}</button><span class="key">${esc(v.key)}</span></span>
        <label class="tick"><input type="checkbox" class="vchk" data-n="${v.n}" ${R.verses[v.n] ? 'checked' : ''}>Checked</label></div>
      <div class="quran qt">${esc(v.words.map((w) => w.text).join(' '))} <span style="color:var(--gold-ink)">﴿${esc(v.num_ar)}﴾</span></div>
      <div class="tr">${esc(v.translation)}</div>
      ${v.glosses.map((g) => `<div class="gl"><span class="quran">${esc(g.chip)}</span><span>←</span><span class="ex">${esc(g.excerpt)}</span><small>${esc(g.source)} · ${fmt(g.start)}</small></div>`).join('')}
    </div>`).join('')}
    <div class="approve" id="approveBox"></div>`;
  $$('.play', body).forEach((b) => (b.onclick = () => playAt(+b.dataset.t)));
  $$('.vchk', body).forEach((c) => (c.onchange = () => { R.verses[c.dataset.n] = c.checked; c.closest('.verse').classList.toggle('ok', c.checked); unapproveLocal(); saveReview(); drawApprove(); }));
  $('#titles').onchange = (e) => { R.titles = e.target.checked; $('#titlesBox').classList.toggle('ok', R.titles); unapproveLocal(); saveReview(); drawApprove(); };
  tc.forEach((_, i) => $$(`input[name=tc${i}]`, body).forEach((r) => (r.onchange = () => { R.timing[i] = r.value; unapproveLocal(); saveReview(); drawApprove(); })));
  drawApprove();
}
function sceneLabel(c) {
  const sc = CAT.scenes;
  if (c.scene === 'ambient') return esc(sc.ambient.moods[c.params?.mood]?.label || 'Calm visual');
  if (c.scene === 'stage') return `Story scene · ${esc(sc.stage.settings[c.params?.setting]?.label || '')}`;
  return 'Hand-drawn scene';
}
function unapproveLocal() { if (P.review?.approved) { P.review.approved = false; drawStepper(currentTab('review')); } }

function drawApprove() {
  const box = $('#approveBox'); if (!box) return;
  const n = P.verses.length, done = P.verses.filter((v) => R.verses[v.n]).length;
  const tc = P.timing_corrections || [];
  const tcOk = tc.every((_, i) => R.timing[i] === 'ok'), tcWrong = tc.some((_, i) => R.timing[i] === 'wrong');
  const all = done === n && R.titles && tcOk;
  if (P.review?.approved) {
    box.innerHTML = `<div class="card"><div class="notice green">${ICON.check}<span><b>Approved by ${esc(P.review.reviewer)}</b> · ${new Date(P.review.approved_at).toLocaleString()}</span></div>
      <div class="actions"><button class="btn gold big" id="toExport">Continue to export →</button></div></div>`;
    $('#toExport').onclick = () => go('export');
    return;
  }
  box.innerHTML = `<div class="card">
    <div class="row" style="justify-content:space-between;flex-wrap:wrap"><span class="progress-txt">${done} of ${n} verse${n > 1 ? 's' : ''} checked${R.titles ? ' · titles ✓' : ''}${tc.length ? ` · timing ${tcOk ? '✓' : 'to confirm'}` : ''}</span>
      ${done < n ? '<span class="muted small">Play each verse, read along, then tick it.</span>' : ''}</div>
    <div class="bar"><i style="width:${Math.round((100 * (done + (R.titles ? 1 : 0))) / (n + 1))}%"></i></div>
    ${tcWrong ? '<div class="notice red">You marked a timing as wrong. Do not export: note the time and report it, or choose another reciter.</div>' : ''}
    <div class="row" style="flex-wrap:wrap"><input class="input" id="rv" placeholder="Reviewer name" style="flex:1;min-width:180px" value="${esc(R.reviewer)}">
      <button class="btn green" id="approve" ${all && !tcWrong ? '' : 'disabled'}>Approve for export</button></div>
    <div class="hint">Approve only after a person who reads Quranic Arabic has listened to the whole video. The approval and reviewer name are saved with this video.</div></div>`;
  $('#rv').oninput = (e) => { R.reviewer = e.target.value; store.set('reviewer', R.reviewer); saveReview(); };
  $('#approve').onclick = async () => {
    if (!R.reviewer.trim()) { $('#rv').focus(); return toast('Enter the reviewer name.', true); }
    try { await saveReview(true); toast('Approved'); panelKey = ''; projectPage(P.id, 'review'); } catch (e) { toast(e.message, true); }
  };
}

// ----------------------------------------------------------------------- edit
let SRC = null, ED = null;
async function drawEdit() {
  const body = $('#tabBody');
  body.innerHTML = '<div class="muted">Loading…</div>';
  try { SRC = await api(`projects/${encodeURIComponent(P.id)}/source`); } catch (e) { body.innerHTML = `<div class="notice red">${esc(e.message)}</div>`; return; }
  ED = { chapters: SRC.chapters.map((c) => ({ id: c.id, title: c.title, scene: c.scene, mood: c.params?.mood, params: c.params, verses: c.verses })), glosses: SRC.glosses.map((g) => ({ ...g })) };
  renderEdit();
}
const TONES = { blue: ['#3a7cc8', 'Explanation'], green: ['#3d9a68', 'Mercy / faith'], red: ['#c9473f', 'Warning'], amber: ['#d6962a', 'Time / place / sign'] };
function anchorsFor(verse) {
  const c = ED.chapters.find((x) => x.verses.includes(verse)); if (!c) return [];
  if (c.scene === 'ambient') return SRC.scenes.ambient.anchors;
  if (c.scene === 'stage') return [...SRC.scenes.stage.anchors_base, ...(c.params?.actors || []).map((a) => a.id)];
  return [];
}
function wordsText(vn, a, b) { const v = SRC.verses.find((x) => x.n === vn); return v ? v.words.slice(a - 1, b).map((w) => w.text).join(' ') : ''; }

function renderEdit() {
  const body = $('#tabBody');
  const moods = SRC.scenes.ambient.moods;
  body.innerHTML = `
    <div class="card" style="margin-bottom:14px"><h3>Chapters</h3>
      <p class="muted small" style="margin-top:-4px">Each chapter is one scene with a title above the picture. Titles are short Arabic headings, never Quran text.</p>
      ${ED.chapters.map((c, i) => `<div class="chap">
        <div class="row" style="justify-content:space-between"><span class="muted small">Chapter ${i + 1} · ${c.verses.length > 1 ? `verses ${c.verses[0]}–${c.verses[c.verses.length - 1]}` : `verse ${c.verses[0]}`}</span></div>
        <input class="input ar" data-ci="${i}" data-f="title" maxlength="28" value="${esc(c.title)}" aria-label="Chapter title">
        <select class="input" data-ci="${i}" data-f="scene" ${!['ambient', 'stage'].includes(c.scene) ? 'disabled' : ''}>
          ${c.scene === 'stage' ? `<option value="stage" selected>Story scene (as written by Claude)</option>` : ''}
          ${!['ambient', 'stage'].includes(c.scene) ? `<option selected>Hand-drawn scene</option>` : ''}
          <optgroup label="Calm visuals">${Object.entries(moods).map(([k, m]) => `<option value="ambient:${k}" ${c.scene === 'ambient' && c.mood === k ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</optgroup>
        </select></div>`).join('')}
    </div>
    <div class="card" style="margin-bottom:14px"><h3>Explanations</h3>
      <p class="muted small" style="margin-top:-4px">Short notes that pop up when a word is recited. They are quoted word-for-word from the tafsir, so you choose them by selecting text in the tafsir.</p>
      <div id="gls">${ED.glosses.length ? '' : '<div class="muted small" style="margin-bottom:8px">No explanations yet.</div>'}
        ${[...ED.glosses].map((g, i) => ({ g, i })).sort((a, b) => a.g.verse - b.g.verse || a.g.words[0] - b.g.words[0]).map(({ g, i }) => `<div class="glitem">
          <div class="gl" style="margin:0;background:none;padding:0"><span class="muted small" style="direction:ltr">${P.chapter}:${g.verse}</span><span class="quran">${esc(wordsText(g.verse, g.words[0], g.words[1]))}</span><span>←</span><span class="ex">${esc(g.excerpt)}</span>
            <small><span class="tone" style="background:${TONES[g.tone]?.[0]}"></span>${esc(SRC.tafsir_labels[g.tafsir])}</small></div>
          <button class="ghost" data-del="${i}" title="Remove">${ICON.x}</button></div>`).join('')}</div>
      <button class="btn light" id="addGl">+ Add an explanation</button>
      <div id="builder"></div>
    </div>
    <div class="card"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><span class="muted small">Saving re-runs every check and rebuilds the preview. Your review ticks are reset.</span>
      <div class="actions"><button class="btn light" id="discard">Discard changes</button><button class="btn" id="saveEd">Save changes</button></div></div><div id="edErr"></div></div>`;
  $$('[data-f=title]', body).forEach((el) => (el.oninput = () => (ED.chapters[+el.dataset.ci].title = el.value)));
  $$('[data-f=scene]', body).forEach((el) => (el.onchange = () => {
    const c = ED.chapters[+el.dataset.ci];
    if (el.value.startsWith('ambient:')) { c.scene = 'ambient'; c.mood = el.value.split(':')[1]; }
    else if (el.value === 'stage') { c.scene = 'stage'; }
  }));
  $$('[data-del]', body).forEach((b) => (b.onclick = () => { ED.glosses.splice(+b.dataset.del, 1); renderEdit(); }));
  $('#addGl').onclick = () => builder();
  $('#discard').onclick = () => drawEdit();
  $('#saveEd').onclick = async (ev) => {
    const b = ev.currentTarget; b.disabled = true; b.innerHTML = '<span class="spinner"></span> Checking…';
    $('#edErr').innerHTML = '';
    try {
      await api(`projects/${encodeURIComponent(P.id)}/storyboard`, { method: 'PUT', body: {
        chapters: ED.chapters.map((c) => ({ id: c.id, title: c.title, scene: c.scene, mood: c.mood, params: c.scene === 'stage' ? c.params : undefined })),
        glosses: ED.glosses } });
      toast('Saved. Re-checking and rebuilding the preview…');
      panelKey = ''; projectPage(P.id, 'review');
    } catch (e) {
      b.disabled = false; b.textContent = 'Save changes';
      $('#edErr').innerHTML = `<div class="notice red" style="margin-top:12px;display:block"><b>${esc(e.message)}</b>${e.data?.fails ? `<ul class="fails">${e.data.fails.map((x) => `<li>${esc(x.msg)}</li>`).join('')}</ul>` : ''}</div>`;
    }
  };
}

function builder() {
  const el = $('#builder');
  const S = { verse: SRC.verses[0].n, a: null, b: null, tafsir: Object.keys(SRC.tafsir_labels)[0], excerpt: '', tone: 'blue', target: '' };
  const draw = () => {
    const v = SRC.verses.find((x) => x.n === S.verse);
    const anchors = anchorsFor(S.verse);
    el.innerHTML = `<div class="chap" style="margin-top:12px;border-color:#efd9a8;background:#fffcf5">
      <div class="grid2"><div><label class="f">1 · Verse</label><select class="input" id="bv">${SRC.verses.map((x) => `<option value="${x.n}" ${x.n === S.verse ? 'selected' : ''}>${esc(x.key)}</option>`).join('')}</select></div>
        <div><label class="f">Arrow points to</label><select class="input" id="bt"><option value="">No arrow</option>${anchors.map((a) => `<option ${a === S.target ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></div></div>
      <div><label class="f">2 · Click the word (or first and last word)</label><div class="wsel">${v.words.map((w) => `<button data-p="${w.pos}" class="${S.a && w.pos >= S.a && w.pos <= (S.b || S.a) ? 'on' : ''}">${esc(w.text)}</button>`).join('')}</div></div>
      <div><label class="f">3 · Select the explanation in the tafsir</label>
        <div class="tabs" style="margin-bottom:8px">${Object.entries(SRC.tafsir_labels).map(([k, l]) => `<button class="tab ${k === S.tafsir ? 'on' : ''}" data-tf="${k}"><span class="ar">${esc(l)}</span></button>`).join('')}</div>
        <div class="tafbox" id="tbox">${esc(v.tafsir[S.tafsir] || '(empty for this verse)')}</div>
        <div class="hint">Drag across a short phrase that explains the word (up to 64 characters). Avoid the parts that quote the verse.</div>
        <div class="sel" id="bsel">${esc(S.excerpt) || '<span class="faint" style="font-weight:500">Selected text appears here</span>'}</div></div>
      <div><label class="f">4 · Colour</label><div class="tones">${Object.entries(TONES).map(([k, [c, l]]) => `<label><input type="radio" name="tone" value="${k}" ${k === S.tone ? 'checked' : ''}><span class="tone" style="background:${c}"></span>${l}</label>`).join('')}</div></div>
      <div class="actions" style="justify-content:flex-end"><button class="btn light" id="bcx">Cancel</button><button class="btn" id="bok">Add explanation</button></div></div>`;
    $('#bv').onchange = (e) => { S.verse = +e.target.value; S.a = S.b = null; S.excerpt = ''; S.target = ''; draw(); };
    $('#bt').onchange = (e) => (S.target = e.target.value);
    $$('.wsel button', el).forEach((b) => (b.onclick = () => {
      const p = +b.dataset.p;
      if (!S.a || S.b) { S.a = p; S.b = null; } else if (p >= S.a && p - S.a < 4) S.b = p; else { S.a = p; S.b = null; }
      draw();
    }));
    $$('[data-tf]', el).forEach((b) => (b.onclick = () => { S.tafsir = b.dataset.tf; S.excerpt = ''; draw(); }));
    $('#tbox').onmouseup = $('#tbox').onkeyup = () => {
      const s = String(window.getSelection() || '').replace(/\s+/g, ' ').trim();
      if (s) { S.excerpt = s; $('#bsel').textContent = s; $('#bsel').style.color = s.length > 64 ? 'var(--red)' : ''; }
    };
    $$('input[name=tone]', el).forEach((r) => (r.onchange = () => (S.tone = r.value)));
    $('#bcx').onclick = () => (el.innerHTML = '');
    $('#bok').onclick = () => {
      if (!S.a) return toast('Click the word to explain.', true);
      if (!S.excerpt) return toast('Select the explanation text in the tafsir.', true);
      if (S.excerpt.length > 64) return toast(`The selection is ${S.excerpt.length} characters; keep it to 64 or fewer.`, true);
      ED.glosses.push({ verse: S.verse, words: [S.a, S.b || S.a], tafsir: +S.tafsir, excerpt: S.excerpt, target: S.target, tone: S.tone });
      renderEdit(); toast('Added. Save changes to check it and update the preview.');
    };
  };
  draw();
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ----------------------------------------------------------------------- export
function updateRender() {
  const r = P.render || {};
  const bar = $('#rbar'); if (!bar) return;
  $('i', bar).style.width = `${Math.round((r.progress || 0) * 100)}%`;
  $('#rtxt').textContent = r.state === 'queued' ? 'Waiting for another video to finish…' : r.detail ? r.detail : `${Math.round((r.progress || 0) * 100)}%${r.eta_s != null ? ` · about ${fmtMin(r.eta_s)} left` : ''}`;
}
function drawExport() {
  const r = P.render || {};
  const panel = $('#panel');
  if (!P.review?.approved && r.state !== 'done') {
    panel.innerHTML = `<div class="export card"><h2>Export</h2><p class="muted">Approve the review first: every verse, the titles and scenes, and any flagged timing must be checked by a person.</p><button class="btn" id="toRev">Go to review</button></div>`;
    $('#toRev').onclick = () => go('review'); return;
  }
  const est = (P.duration || 60) * 2.6;
  if (r.state === 'running' || r.state === 'queued') {
    panel.innerHTML = `<div class="export card"><h2>Rendering your video</h2><p class="muted" style="margin-top:-6px">Every frame is drawn at full quality (1080 × 1920, 30 fps). You can leave this page; keep the Studio window open.</p>
      <div class="bar" id="rbar" style="height:12px"><i style="width:0"></i></div><div class="progress-txt" id="rtxt" style="margin-top:8px"></div></div>`;
    updateRender(); return;
  }
  if (r.state === 'done') {
    const v = `/${r.file}?v=${encodeURIComponent(r.finished_at || '')}`;
    panel.innerHTML = `<div class="export"><div class="done-grid"><video src="${v}" ${r.cover ? `poster="/${r.cover}?v=${encodeURIComponent(r.finished_at || '')}"` : ''} controls playsinline preload="metadata"></video>
      <div class="card"><h2>Your video is ready</h2>
        <p class="muted" style="margin-top:-6px">1080 × 1920 · 30 fps · MP4 (H.264 + AAC, −14 LUFS) · ${fmt(P.duration)}</p>
        ${P.review?.approved ? `<div class="notice green" style="margin-bottom:14px">${ICON.check}<span>Approved by ${esc(P.review.reviewer)}</span></div>` : '<div class="notice gold" style="margin-bottom:14px">This video has not been approved in the app yet.</div>'}
        <div class="actions"><a class="btn gold big" href="/api/projects/${encodeURIComponent(P.id)}/download">Download MP4</a>
          ${r.cover ? `<a class="btn light" href="/${r.cover}" download>Cover image (JPG)</a>` : ''}
          ${r.sheet ? `<a class="btn light" href="/${r.sheet}" target="_blank" rel="noopener">Review sheet (PDF)</a>` : ''}
          <button class="btn light" id="folder">Open folder</button></div>
        <div class="hint" style="margin-top:14px">Before publishing: confirm you have the rights to publish the recitation and the data (Quran Foundation terms), and keep the signed review sheet.</div>
        ${P.review?.approved ? '<div style="margin-top:14px"><button class="link" id="again">Render again</button></div>' : ''}</div></div></div>`;
    $('#folder').onclick = () => api(`projects/${encodeURIComponent(P.id)}/open-folder`, { method: 'POST' }).catch((e) => toast(e.message, true));
    $('#again')?.addEventListener('click', startRender);
    return;
  }
  panel.innerHTML = `<div class="export card"><h2>Export the video</h2>
    ${r.state === 'stale' ? '<div class="notice gold" style="margin-bottom:12px">The storyboard changed since the last export.</div>' : ''}
    ${r.state === 'error' ? `<div class="notice red" style="margin-bottom:12px;display:block"><b>The last render failed.</b><pre class="log">${esc(r.error || '')}</pre></div>` : ''}
    <p class="muted">1080 × 1920 vertical · 30 fps · MP4 · ${fmt(P.duration)} long. Rendering takes about <b>${fmtMin(est)}</b> on this computer.</p>
    <button class="btn gold big" id="go">Render video</button></div>`;
  $('#go').onclick = startRender;
}
async function startRender(ev) {
  if (ev?.currentTarget) { ev.currentTarget.disabled = true; }
  try { await api(`projects/${encodeURIComponent(P.id)}/render`, { method: 'POST' }); panelKey = ''; go('export'); projectPage(P.id, 'export'); }
  catch (e) { toast(e.message, true); if (ev?.currentTarget) ev.currentTarget.disabled = false; }
}

route();
