/* Where an imported deck lives.
 *
 * IndexedDB, not localStorage: a deck is cards plus its pictures and sound, and
 * localStorage is a few megabytes of strings on a good day. Two stores — one row
 * per deck, one row per media file — so opening a deck does not drag its media
 * along, and a deck with 400 pictures deletes in one transaction.
 *
 * Study state stays exactly where it was: localStorage under
 * munin/<course>/state/v1, written by app.js. Nothing here touches it, which is
 * what makes re-importing a deck over itself keep your progress.
 */

const DB = 'munin';
const VERSION = 1;
const DECKS = 'decks';
const MEDIA = 'media';

let open = null;

function db() {
  if (open) return open;
  open = new Promise((res, rej) => {
    const r = indexedDB.open(DB, VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains(DECKS)) d.createObjectStore(DECKS, { keyPath: 'id' });
      // Keyed by [deck, index] so a deck's media is one contiguous range.
      if (!d.objectStoreNames.contains(MEDIA)) d.createObjectStore(MEDIA);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error || new Error('the browser would not open its database'));
    // Private windows in some browsers open the database and then refuse to
    // write; blocking is the other way it fails, and both should say so.
    r.onblocked = () => rej(new Error('another Munin tab is upgrading the database'));
  });
  return open;
}

function done(tx) {
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error || new Error('the write was rolled back'));
  });
}

const wrap = (req) => new Promise((res, rej) => {
  req.onsuccess = () => res(req.result);
  req.onerror = () => rej(req.error);
});

/** Every imported deck, newest first — without touching a single picture. */
export async function list() {
  const d = await db();
  const rows = await wrap(d.transaction(DECKS).objectStore(DECKS).getAll());
  return rows.sort((a, b) => b.created - a.created);
}

export async function get(id) {
  const d = await db();
  return wrap(d.transaction(DECKS).objectStore(DECKS).get(id));
}

/**
 * Store a deck and its media in one transaction: a half-written deck would
 * open with pictures missing and no way to tell why.
 */
export async function put(record, media) {
  const d = await db();
  const tx = d.transaction([DECKS, MEDIA], 'readwrite');
  const ms = tx.objectStore(MEDIA);
  // Replacing a deck: clear what the old one had first, or its media lingers
  // for as long as the browser does.
  ms.delete(IDBKeyRange.bound([record.id], [record.id, []]));
  for (const m of media) {
    ms.put({ name: m.name, kind: m.kind, blob: new Blob([m.bytes], { type: mime(m.name) }) },
      [record.id, m.i]);
  }
  tx.objectStore(DECKS).put(record);
  await done(tx);
}

export async function remove(id) {
  const d = await db();
  const tx = d.transaction([DECKS, MEDIA], 'readwrite');
  tx.objectStore(MEDIA).delete(IDBKeyRange.bound([id], [id, []]));
  tx.objectStore(DECKS).delete(id);
  await done(tx);
  // The deck is gone; its study history has nothing left to describe.
  localStorage.removeItem(`munin/${id}/state/v1`);
}

/** Object URLs for one deck's media, by the index the cards refer to. */
export async function mediaUrls(id) {
  const d = await db();
  const tx = d.transaction(MEDIA);
  const s = tx.objectStore(MEDIA);
  const keys = await wrap(s.getAllKeys(IDBKeyRange.bound([id], [id, []])));
  const vals = await wrap(s.getAll(IDBKeyRange.bound([id], [id, []])));
  const out = new Map();
  keys.forEach((k, i) => {
    const v = vals[i];
    if (v && v.blob) out.set(k[1], URL.createObjectURL(v.blob));
  });
  return out;
}

const TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav',
  m4a: 'audio/mp4', opus: 'audio/ogg', flac: 'audio/flac', mp4: 'video/mp4',
};

/* A Blob with no type is served as application/octet-stream, and an <img>
 * pointed at one shows nothing. The extension is all we have to go on — except
 * for SVG, which is a script container and stays out of an imported deck. */
function mime(name) {
  const ext = String(name).toLowerCase().split('.').pop();
  if (ext === 'svg') return 'text/plain';
  return TYPES[ext] || 'application/octet-stream';
}

/** How much room the imported decks take, for the shelf to be honest about. */
export async function usage() {
  if (!navigator.storage?.estimate) return null;
  try { return await navigator.storage.estimate(); } catch { return null; }
}
