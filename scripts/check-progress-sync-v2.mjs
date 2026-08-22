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
const stop = new AbortController();
const timeout = setTimeout(() => stop.abort(), 10000);

let response;
let body = '';
try {
  response = await fetch(`${endpoint}/rest/v1/rpc/sync_get_v2`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_app: 'day-skipper',
      // SHA-256 cannot realistically produce this value. The read is therefore
      // both non-secret and non-mutating while still exercising RPC resolution,
      // grants, arguments, and the writer-version check through PostgREST.
      p_key_hash: '0'.repeat(64),
      p_writer_version: 2,
    }),
    signal: stop.signal,
  });
  body = await response.text();
} catch (error) {
  const reason = error && error.name === 'AbortError' ? 'timed out' : String(error);
  throw new Error(`progress sync v2 preflight ${reason}`);
} finally {
  clearTimeout(timeout);
}

if (!response.ok) {
  let code = '';
  try { code = JSON.parse(body).code || ''; } catch { /* status is enough */ }
  throw new Error(`progress sync v2 is not deployed (HTTP ${response.status}${code ? `, ${code}` : ''})`);
}

let rows;
try { rows = JSON.parse(body); } catch { rows = null; }
if (!Array.isArray(rows)) throw new Error('progress sync v2 returned an unexpected response');
console.log('progress sync v2 RPC is ready');
