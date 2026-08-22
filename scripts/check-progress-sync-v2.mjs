#!/usr/bin/env node
/* Refuse a production web deploy until the progress-v2 RPC boundary exists.
 *
 * The endpoint and anon key are public client configuration, read from the exact
 * sync.js being deployed so this check cannot silently drift to another project.
 * Tests may override both with a disposable HTTP server.
 */
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../web/sync.js', import.meta.url), 'utf8');
const shipped = (name) => {
  const match = new RegExp(`const ${name} = '([^']+)';`).exec(source);
  if (!match) throw new Error(`cannot find ${name} in web/sync.js`);
  return match[1];
};

const endpoint = process.env.KEEPCLUB_SYNC_ENDPOINT || shipped('ENDPOINT');
const anon = process.env.KEEPCLUB_SYNC_ANON || shipped('ANON');
const call = async (name, payload) => {
  const stop = new AbortController();
  const timeout = setTimeout(() => stop.abort(), 10000);
  let response;
  let body = '';
  try {
    response = await fetch(`${endpoint}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: stop.signal,
    });
    body = await response.text();
  } catch (error) {
    const reason = error && error.name === 'AbortError' ? 'timed out' : String(error);
    throw new Error(`progress sync v2 preflight ${reason}`);
  } finally {
    clearTimeout(timeout);
  }
  let json = null;
  try { json = JSON.parse(body); } catch { /* Callers validate the shape. */ }
  return { response, json };
};

const app = 'day-skipper';
const absentKey = '0'.repeat(64);

// The first published v2 function accidentally accepted NULL and did not fence
// rows on read. The repair changed both semantics in one fresh migration. This
// non-mutating negative call fingerprints that repair instead of merely proving
// that a same-named old RPC exists.
const repaired = await call('sync_get_v2', {
  p_app: app,
  p_key_hash: absentKey,
  p_writer_version: null,
});
if (repaired.response.status !== 400 || repaired.json?.code !== '22023') {
  throw new Error('progress sync v2 read-fence repair is not deployed');
}

// The final GET performs one locked read, instead of an UPDATE followed by a
// separately snapshotted SELECT. NULL cannot name a real app, so this exact
// error fingerprints the locked implementation without reading or writing a
// row. The prior two-command function returned an empty array here.
const lockedReadFence = await call('sync_get_v2', {
  p_app: null,
  p_key_hash: absentKey,
  p_writer_version: 2,
});
if (lockedReadFence.response.status !== 400
    || lockedReadFence.json?.code !== '22023'
    || lockedReadFence.json?.message !== 'bad app') {
  throw new Error('progress sync v2 locked read fence is not deployed');
}

const read = await call('sync_get_v2', {
  p_app: app,
  // SHA-256 cannot realistically produce this value. The read is therefore
  // both non-secret and non-mutating while exercising resolution and grants.
  p_key_hash: absentKey,
  p_writer_version: 2,
});
if (!read.response.ok) {
  const code = read.json?.code || '';
  throw new Error(`progress sync v2 GET is not deployed (HTTP ${read.response.status}${code ? `, ${code}` : ''})`);
}
if (!Array.isArray(read.json)) {
  throw new Error('progress sync v2 GET returned an unexpected response');
}

// Bad input reaches the function without creating a health-check row. SQLSTATE
// 22023 proves PostgREST resolved sync_put_v2 and the public client can execute
// it; a missing function or grant produces a different status/code.
const write = await call('sync_put_v2', {
  p_app: app,
  p_key_hash: 'not-a-sha256-key',
  p_rev: 0,
  p_data: {},
  p_writer_version: 2,
});
if (write.response.status !== 400 || write.json?.code !== '22023') {
  const code = write.json?.code || '';
  throw new Error(`progress sync v2 PUT is not deployed (HTTP ${write.response.status}${code ? `, ${code}` : ''})`);
}

// The final fence repair validates revision before app lookup. Using an
// intentionally unknown app and NULL revision cannot create or update a row,
// while the exact error distinguishes it from the prior function which said
// "unknown app" before it ever reached revision validation.
const conflictFence = await call('sync_put_v2', {
  // sync.apps.app is a primary key and therefore cannot be NULL. Unlike a
  // made-up string, this is guaranteed never to become a real app later.
  p_app: null,
  p_key_hash: absentKey,
  p_rev: null,
  p_data: {},
  p_writer_version: 2,
});
if (conflictFence.response.status !== 400
    || conflictFence.json?.code !== '22023'
    || conflictFence.json?.message !== 'bad revision') {
  throw new Error('progress sync v2 conflict fence is not deployed');
}

console.log('progress sync v2 RPCs and locked conflict fences are ready');
