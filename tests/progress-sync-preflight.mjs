/* The committed web deploy depends on the progress-v2 RPC. Exercise the live
 * readiness probe against a disposable HTTP server so a missing migration can
 * never be mistaken for a safe Pages push. */
import http from 'node:http';
import { spawn } from 'node:child_process';

const SCRIPT = new URL('../scripts/check-progress-sync-v2.mjs', import.meta.url).pathname;
const passed = [], failed = [];
const ok = (condition, message) =>
  (condition ? passed : failed).push(`${condition ? 'PASS' : 'FAIL'}  ${message}`);

async function probe(handler) {
  const requests = [];
  const server = http.createServer((incoming, outgoing) => {
    let body = '';
    incoming.setEncoding('utf8');
    incoming.on('data', (chunk) => { body += chunk; });
    incoming.on('end', () => {
      const request = {
        url: incoming.url,
        method: incoming.method,
        authorization: incoming.headers.authorization,
        apikey: incoming.headers.apikey,
        body: JSON.parse(body),
      };
      requests.push(request);
      const reply = handler(request, requests.length - 1);
      outgoing.writeHead(reply.status, { 'Content-Type': 'application/json' });
      outgoing.end(JSON.stringify(reply.body));
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
  return { exit, stdout, stderr, requests };
}

const readyReply = (request) => {
  if (request.url === '/rest/v1/rpc/sync_get_v2'
      && request.body.p_writer_version === null) {
    return { status: 400, body: { code: '22023', message: 'unsupported writer version' } };
  }
  if (request.url === '/rest/v1/rpc/sync_get_v2'
      && request.body.p_app === null) {
    return { status: 400, body: { code: '22023', message: 'bad app' } };
  }
  if (request.url === '/rest/v1/rpc/sync_get_v2') {
    return { status: 200, body: [] };
  }
  if (request.url === '/rest/v1/rpc/sync_put_v2'
      && request.body.p_key_hash === 'not-a-sha256-key') {
    return { status: 400, body: { code: '22023', message: 'bad key' } };
  }
  if (request.url === '/rest/v1/rpc/sync_put_v2'
      && request.body.p_app === null
      && request.body.p_rev === null) {
    return { status: 400, body: { code: '22023', message: 'bad revision' } };
  }
  return { status: 500, body: { code: 'TEST', message: 'unexpected probe' } };
};

const ready = await probe(readyReply);
ok(ready.exit === 0 && /RPCs and locked conflict fences are ready/.test(ready.stdout),
  'the preflight accepts both installed v2 RPCs with every repaired fence semantic');
ok(ready.requests.length === 5
    && ready.requests.every((request) => request.method === 'POST'
      && request.authorization === 'Bearer public-test-key'
      && request.apikey === 'public-test-key')
    && ready.requests[0].url === '/rest/v1/rpc/sync_get_v2'
    && ready.requests[0].body.p_writer_version === null
    && ready.requests[1].url === '/rest/v1/rpc/sync_get_v2'
    && ready.requests[1].body.p_app === null
    && ready.requests[1].body.p_writer_version === 2
    && ready.requests[2].url === '/rest/v1/rpc/sync_get_v2'
    && ready.requests[2].body.p_writer_version === 2
    && /^[0-9a-f]{64}$/.test(ready.requests[2].body.p_key_hash)
    && ready.requests[2].body.p_key_hash === ready.requests[0].body.p_key_hash
    && ready.requests[2].body.p_key_hash === ready.requests[1].body.p_key_hash
    && ready.requests[3].url === '/rest/v1/rpc/sync_put_v2'
    && ready.requests[3].body.p_writer_version === 2
    && ready.requests[3].body.p_key_hash === 'not-a-sha256-key'
    && ready.requests[4].url === '/rest/v1/rpc/sync_put_v2'
    && ready.requests[4].body.p_app === null
    && ready.requests[4].body.p_rev === null,
  'the gate fingerprints all fence repairs and resolves public GET and PUT without creating a row');

const readyAgain = await probe(readyReply);
ok(readyAgain.exit === 0
    && /^[0-9a-f]{64}$/.test(readyAgain.requests[2].body.p_key_hash)
    && ready.requests[2].body.p_key_hash !== '0'.repeat(64)
    && readyAgain.requests[2].body.p_key_hash !== ready.requests[2].body.p_key_hash,
  'each gate run uses a fresh unpredictable capability-probe key');

const missing = await probe(() => ({
  status: 404, body: { code: 'PGRST202', message: 'function not found' },
}));
ok(missing.exit !== 0 && /read-fence repair is not deployed/.test(missing.stderr),
  'the preflight refuses a missing migration before web deployment');

const oldRead = await probe((request) => ({
  status: 200,
  body: request.url.endsWith('/sync_get_v2') ? [] : { code: 'PGRST202' },
}));
ok(oldRead.exit !== 0 && /read-fence repair is not deployed/.test(oldRead.stderr)
    && oldRead.requests.length === 1,
  'the preflight refuses the old same-named GET that accepted a NULL capability');

const racyReadFence = await probe((request) => {
  if (request.body.p_writer_version === null) return readyReply(request);
  if (request.url.endsWith('/sync_get_v2') && request.body.p_app === null) {
    return { status: 200, body: [] };
  }
  return readyReply(request);
});
ok(racyReadFence.exit !== 0
    && /locked read fence is not deployed/.test(racyReadFence.stderr)
    && racyReadFence.requests.length === 2,
  'the preflight refuses the racy two-command GET definition');

const missingWrite = await probe((request) => (
  request.url.endsWith('/sync_put_v2')
    ? { status: 404, body: { code: 'PGRST202', message: 'function not found' } }
    : readyReply(request)
));
ok(missingWrite.exit !== 0 && /PUT is not deployed.*404.*PGRST202/s.test(missingWrite.stderr),
  'the preflight refuses a missing or ungranted sync_put_v2 capability');

const oldConflictFence = await probe((request) => {
  if (request.url.endsWith('/sync_put_v2') && request.body.p_app === null) {
    return { status: 400, body: { code: '22023', message: 'unknown app' } };
  }
  return readyReply(request);
});
ok(oldConflictFence.exit !== 0
    && /conflict fence is not deployed/.test(oldConflictFence.stderr)
    && oldConflictFence.requests.length === 5,
  'the preflight refuses the prior PUT that returned before conflict-fence semantics');

const malformedRead = await probe((request) => {
  if (request.body.p_writer_version === null || request.body.p_app === null) {
    return readyReply(request);
  }
  return request.url.endsWith('/sync_get_v2')
    ? { status: 200, body: { ok: true } }
    : readyReply(request);
});
ok(malformedRead.exit !== 0 && /GET returned an unexpected response/.test(malformedRead.stderr),
  'the preflight refuses a response that is not the sync_get_v2 row array');

console.log([...passed, ...failed].join('\n'));
console.log(`\n${passed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
