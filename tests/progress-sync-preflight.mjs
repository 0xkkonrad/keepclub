/* The committed web deploy depends on the progress-v2 RPC. Exercise the live
 * readiness probe against a disposable HTTP server so a missing migration can
 * never be mistaken for a safe Pages push. */
import http from 'node:http';
import { spawn } from 'node:child_process';

const SCRIPT = new URL('../scripts/check-progress-sync-v2.mjs', import.meta.url).pathname;
const passed = [], failed = [];
const ok = (condition, message) =>
  (condition ? passed : failed).push(`${condition ? 'PASS' : 'FAIL'}  ${message}`);

async function probe(status, responseBody) {
  let request = null;
  const server = http.createServer((incoming, outgoing) => {
    let body = '';
    incoming.setEncoding('utf8');
    incoming.on('data', (chunk) => { body += chunk; });
    incoming.on('end', () => {
      request = {
        url: incoming.url,
        method: incoming.method,
        authorization: incoming.headers.authorization,
        apikey: incoming.headers.apikey,
        body: JSON.parse(body),
      };
      outgoing.writeHead(status, { 'Content-Type': 'application/json' });
      outgoing.end(JSON.stringify(responseBody));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const child = spawn(process.execPath, [SCRIPT], {
    env: {
      ...process.env,
      KEEPCLUB_SYNC_ENDPOINT: `http://127.0.0.1:${port}`,
      KEEPCLUB_SYNC_ANON: 'public-test-key',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exit = await new Promise((resolve) => child.on('close', resolve));
  await new Promise((resolve) => server.close(resolve));
  return { exit, stdout, stderr, request };
}

const ready = await probe(200, []);
ok(ready.exit === 0 && /RPC is ready/.test(ready.stdout),
  'the preflight accepts an installed v2 RPC');
ok(ready.request?.url === '/rest/v1/rpc/sync_get_v2'
    && ready.request.method === 'POST'
    && ready.request.authorization === 'Bearer public-test-key'
    && ready.request.apikey === 'public-test-key'
    && ready.request.body.p_writer_version === 2
    && ready.request.body.p_key_hash === '0'.repeat(64),
  'the probe exercises the exact public RPC capability with a non-user key hash');

const missing = await probe(404, { code: 'PGRST202', message: 'function not found' });
ok(missing.exit !== 0 && /not deployed.*404.*PGRST202/s.test(missing.stderr),
  'the preflight refuses a missing migration before web deployment');

const malformed = await probe(200, { ok: true });
ok(malformed.exit !== 0 && /unexpected response/.test(malformed.stderr),
  'the preflight refuses a response that is not the sync_get_v2 row array');

console.log([...passed, ...failed].join('\n'));
console.log(`\n${passed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
