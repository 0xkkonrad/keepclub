/* Drop it, get a receipt.
 *
 * The decision behind this screen (import, #6 in project.md) is that the thing
 * people lose in Anki's importer is not the cards — it is the *knowledge of
 * what happened to them*. "39 notes imported" is not an account. So the import
 * ends in a plain reckoning: what landed, what did not, and what changed on the
 * way. Nothing here is a progress bar with a checkmark at the end.
 *
 * Loaded on demand: the parsers are a good chunk of code and nobody who is
 * studying their own deck should be paying for them on every boot.
 */

import { readApkg, ApkgError } from './lib/anki.js';
import { buildDeck } from './lib/deck.js';
import * as store from './lib/store.js';

const RAVENS = ['perch', 'peek', 'flap', 'carry', 'roost', 'hoard', 'puff', 'strut', 'quill', 'bow'];

const CSS = `
  .imp { position: fixed; inset: 0; z-index: 95; overflow-y: auto;
    background: var(--bg); color: var(--text); padding: 24px 20px
    calc(28px + env(safe-area-inset-bottom)); }
  .imp-inner { max-width: 460px; margin: 0 auto; }
  .imp-top { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
  .imp-top h2 { font-size: 1.05rem; font-weight: 500; margin: 0; text-transform: lowercase; }
  .imp-top .dood { width: 30px; height: 30px; color: var(--accent); }
  .imp-x { margin-left: auto; background: none; border: 0; color: var(--muted);
    font: inherit; font-size: 1.2rem; cursor: pointer; min-width: var(--tap);
    min-height: var(--tap); }
  .imp-drop { border: var(--bw) dashed var(--stroke); border-radius: var(--r);
    background: var(--surface); padding: 34px 20px; text-align: center; }
  .imp-drop.over { border-color: var(--accent); color: var(--accent); }
  .imp-drop b { display: block; font-weight: 500; text-transform: lowercase; }
  .imp-drop p { margin: 6px 0 0; color: var(--muted); font-size: .82rem; }
  .imp-file { margin-top: 16px; min-height: var(--tap); width: 100%;
    background: var(--accent); color: var(--accent-ink); font: inherit; font-size: .9rem;
    text-transform: lowercase; cursor: pointer; border: var(--bw) solid var(--stroke);
    border-radius: var(--r-sm); box-shadow: var(--sh-sm); }
  .imp-how { margin-top: 22px; color: var(--muted); font-size: .78rem; line-height: 1.6; }
  .imp-how b { color: var(--text); font-weight: 500; }
  .imp-work { text-align: center; padding: 40px 0; }
  .imp-work .dood { width: 46px; height: 46px; color: var(--accent);
    animation: hop 2.2s ease-in-out infinite; }
  .imp-work p { color: var(--muted); font-size: .86rem; margin: 14px 0 0; }
  .imp-bar { height: 6px; margin: 16px auto 0; max-width: 240px; background: var(--surface);
    border: var(--bw) solid var(--stroke); border-radius: 99px; overflow: hidden; }
  .imp-bar i { display: block; height: 100%; width: 0; background: var(--accent); }
  .imp-h { font-size: 1.15rem; font-weight: 500; margin: 0 0 2px; }
  .imp-sub { color: var(--muted); font-size: .84rem; margin: 0 0 20px; }
  .imp-book { border: var(--bw) solid var(--stroke); border-radius: var(--r);
    background: var(--surface); box-shadow: var(--sh); padding: 4px 16px 14px; margin-bottom: 16px; }
  .imp-book h3 { font-size: .78rem; font-weight: 500; text-transform: lowercase;
    letter-spacing: .04em; color: var(--muted); margin: 14px 0 8px; }
  .imp-book ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; }
  .imp-book li { display: flex; gap: 12px; align-items: baseline; font-size: .88rem; }
  .imp-book li b { font-weight: 500; font-variant-numeric: tabular-nums; min-width: 3.2em;
    text-align: right; flex: none; }
  .imp-book li span { color: var(--muted); }
  .imp-book li.said { color: var(--muted); font-size: .82rem; }
  .imp-book li.said b { visibility: hidden; }
  .imp-eg { display: block; color: var(--muted); font-size: .76rem; font-style: italic; }
  .imp-acts { display: grid; gap: 10px; margin-top: 20px; }
  .imp-acts button { min-height: var(--tap); font: inherit; font-size: .92rem;
    text-transform: lowercase; cursor: pointer; border: var(--bw) solid var(--stroke);
    border-radius: var(--r-sm); box-shadow: var(--sh-sm);
    background: var(--surface); color: var(--text); }
  .imp-acts .go { background: var(--accent); color: var(--accent-ink); }
  .imp-err { border: var(--bw) solid var(--stroke); border-left-width: 6px;
    border-left-color: var(--g1, #c0392b); border-radius: var(--r); background: var(--surface);
    padding: 16px; }
  .imp-err b { display: block; font-weight: 500; margin-bottom: 4px; }
  .imp-err p { margin: 0; color: var(--muted); font-size: .84rem; }`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v) => Number(v).toLocaleString('en-GB');
const plural = (v, one, many) => `${n(v)} ${v === 1 ? one : many || one + 's'}`;

function size(bytes) {
  if (!bytes) return '';
  const mb = bytes / 1048576;
  return mb >= 1 ? `${mb.toFixed(mb >= 10 ? 0 : 1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function doodle(name) {
  const d = (globalThis.MUNIN_DOODLE || {})[name] || (globalThis.MUNIN_DOODLE || {}).perch || '';
  return `<svg class="dood" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

/* ── the receipt ──────────────────────────────────────────────────────────
 * Three headings, in the order a person asks the questions: what have I got,
 * what did I not get, and what is different now. */

function landed(r) {
  const li = [];
  li.push(`<li><b>${n(r.made.cards)}</b><span>cards, from ${plural(r.read.notes, 'note')}</span></li>`);
  li.push(`<li><b>${n(r.made.sections)}</b><span>${r.made.sections === 1 ? 'section' : 'sections'
    }, from your ${plural(r.read.decks, 'deck')}</span></li>`);
  if (r.kinds.length > 1) {
    const say = r.kinds.slice(0, 4).map((k) => `${n(k.n)} ${k.name}`).join(', ');
    li.push(`<li class="said"><b></b><span>${esc(say)}</span></li>`);
  }
  const m = r.media;
  if (m.images || m.sounds) {
    const bits = [];
    if (m.images) bits.push(plural(m.images, 'picture'));
    if (m.sounds) bits.push(plural(m.sounds, 'sound'));
    li.push(`<li><b>${n(m.images + m.sounds)}</b><span>${bits.join(' and ')}${
      m.bytes ? `, ${size(m.bytes)}` : ''}</span></li>`);
  }
  return li.join('');
}

function lost(r) {
  const li = [];
  for (const s of r.skipped) {
    li.push(`<li><b>${n(s.count)}</b><span>${s.count === 1 ? 'card' : 'cards'} dropped: ${esc(s.why)}${
      s.examples.length ? `<span class="imp-eg">${esc(s.examples[0])}…</span>` : ''}</span></li>`);
  }
  if (r.media.missingCount) {
    li.push(`<li><b>${n(r.media.missingCount)}</b><span>${
      r.media.missingCount === 1 ? 'file the package does not contain' : 'files the package does not contain'
    }<span class="imp-eg">${esc(r.media.missing.slice(0, 3).join(', '))}</span></span></li>`);
  }
  if (r.unknownFields.length) {
    li.push(`<li><b></b><span>templates asked for fields that are not there: ${
      esc(r.unknownFields.join(', '))}</span></li>`);
  }
  return li.join('');
}

function changed(r) {
  const li = [];
  li.push('<li class="said"><b></b><span>scheduling does not come across — every card starts new</span></li>');
  if (r.suspended) {
    li.push(`<li class="said"><b></b><span>${plural(r.suspended, 'card')} suspended in Anki: Munin studies ${
      r.suspended === 1 ? 'it' : 'them'} like the rest</span></li>`);
  }
  if (r.duplicates) {
    li.push(`<li class="said"><b></b><span>${plural(r.duplicates, 'card')} identical to another — kept, not merged</span></li>`);
  }
  if (r.latex) {
    li.push(`<li class="said"><b></b><span>${plural(r.latex, 'note')} written in LaTeX: the source shows, not the equation</span></li>`);
  }
  li.push('<li class="said"><b></b><span>the deck’s own fonts and colours are dropped; Munin uses its own</span></li>');
  return li.join('');
}

function receiptHtml(r, existing) {
  return `<h2 class="imp-h">${esc(r.title)}</h2>
    <p class="imp-sub">read from ${r.modern ? 'a current' : 'a legacy'} anki export</p>
    <div class="imp-book">
      <h3>what landed</h3><ul>${landed(r)}</ul>
      ${lost(r) ? `<h3>what didn’t</h3><ul>${lost(r)}</ul>` : ''}
      <h3>what is different now</h3><ul>${changed(r)}</ul>
    </div>
    ${existing ? `<p class="imp-sub">you already have a deck called ${esc(existing.title)}, imported ${
      new Date(existing.created).toLocaleDateString('en-GB')}.</p>` : ''}
    <div class="imp-acts">
      ${existing
    ? `<button type="button" class="go" data-keep="replace">replace it, keeping my progress</button>
         <button type="button" data-keep="new">keep both</button>`
    : '<button type="button" class="go" data-keep="new">start studying</button>'}
      <button type="button" data-cancel>throw it away</button>
    </div>`;
}

/* ── the screen ───────────────────────────────────────────────────────────── */

export function openImporter() {
  if (!document.getElementById('imp-css')) {
    const s = document.createElement('style');
    s.id = 'imp-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  const el = document.createElement('div');
  el.className = 'imp';
  el.innerHTML = `<div class="imp-inner">
    <div class="imp-top">${doodle('carry')}<h2>your own deck</h2>
      <button type="button" class="imp-x" aria-label="Close">✕</button></div>
    <div class="imp-body"></div>
  </div>`;
  document.body.appendChild(el);
  const body = el.querySelector('.imp-body');
  const close = () => { el.remove(); };
  el.querySelector('.imp-x').addEventListener('click', close);

  function pick() {
    body.innerHTML = `
      <div class="imp-drop" id="imp-drop">
        <b>drop an .apkg here</b>
        <p>your cards stay on this device</p>
      </div>
      <button type="button" class="imp-file">choose a file</button>
      <input type="file" accept=".apkg,.colpkg,application/zip" hidden id="imp-input">
      <p class="imp-how">in anki: <b>File → Export</b>, choose <b>Anki Deck Package</b>, and
        include scheduling or not — it makes no difference, Munin starts every card new.
        Both the current format and the older one are read.</p>`;
    const input = body.querySelector('#imp-input');
    body.querySelector('.imp-file').addEventListener('click', () => input.click());
    input.addEventListener('change', () => { if (input.files[0]) go(input.files[0]); });

    const zone = body.querySelector('#imp-drop');
    for (const ev of ['dragenter', 'dragover']) {
      zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('over'); });
    }
    for (const ev of ['dragleave', 'drop']) {
      zone.addEventListener(ev, () => zone.classList.remove('over'));
    }
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f) go(f);
    });
  }

  // A page-wide drop target: aiming at a dashed rectangle with a file in hand
  // is a small indignity, and the whole screen is unambiguous.
  el.addEventListener('dragover', (e) => e.preventDefault());
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f && body.querySelector('#imp-drop')) go(f);
  });

  function working(line) {
    body.innerHTML = `<div class="imp-work">${doodle('perch')}
      <p id="imp-say">${esc(line)}</p>
      <div class="imp-bar"><i id="imp-bar"></i></div></div>`;
  }

  function fail(message, detail) {
    body.innerHTML = `<div class="imp-err"><b>${esc(message)}</b><p>${esc(detail || '')}</p></div>
      <div class="imp-acts"><button type="button" class="go" data-again>try another file</button></div>`;
    body.querySelector('[data-again]').addEventListener('click', pick);
  }

  async function go(file) {
    working('reading the package…');
    const say = body.querySelector('#imp-say');
    const bar = body.querySelector('#imp-bar');
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    await frame();

    let built, col;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      col = await readApkg(bytes);
      built = await buildDeck(col, {
        yield: frame,
        onProgress(done, total, stage) {
          say.textContent = total > 1 ? `${stage} — ${n(done)} of ${n(total)}` : stage + '…';
          bar.style.width = total ? `${Math.round((done / total) * 100)}%` : '0';
        },
      });
    } catch (e) {
      console.error(e);
      if (e instanceof ApkgError) fail('that file could not be read', e.message);
      else if (e && /quota|storage/i.test(e.name + e.message)) {
        fail('there is no room for this deck', 'the browser is out of space for this site.');
      } else fail('something went wrong reading that deck', e?.message || String(e));
      return;
    }

    if (!built.deck.cards.length) {
      fail('nothing to study in that package',
        'every card in it came out empty. If it is a shared deck, it may use a note type whose templates are not in the file.');
      return;
    }

    const existing = (await store.list()).find((d) => d.title === built.deck.name);
    body.innerHTML = receiptHtml(built.receipt, existing);
    body.querySelector('[data-cancel]').addEventListener('click', close);
    for (const b of body.querySelectorAll('[data-keep]')) {
      b.addEventListener('click', () => keep(built, b.dataset.keep === 'replace' ? existing : null));
    }
  }

  async function keep(built, replacing) {
    working('putting it away…');
    const id = replacing ? replacing.id : 'local-' + Date.now().toString(36);
    try {
      await store.put({
        id,
        title: built.deck.name,
        created: replacing ? replacing.created : Date.now(),
        updated: Date.now(),
        cards: built.deck.cards.length,
        art: RAVENS[Math.abs(hash(built.deck.name)) % RAVENS.length],
        sectionArt: built.sectionArt,
        groupArt: built.groupArt,
        receipt: built.receipt,
        deck: built.deck,
      }, built.media);
    } catch (e) {
      console.error(e);
      fail('the deck could not be saved',
        /quota|space/i.test(e?.name + e?.message)
          ? 'the browser is out of space for this site. Removing a deck you no longer study will free it.'
          : e?.message || String(e));
      return;
    }
    // The deck you just imported is the one you meant to study.
    localStorage.setItem('munin/last-course', id);
    location.reload();
  }

  pick();
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}
