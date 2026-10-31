import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createSlipstreamServer } from '../server.mjs';

test('hosted Node service serves browser engine assets with executable MIME types', async t => {
  const server = createSlipstreamServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const health = await fetch(base + '/healthz');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', service: 'slipstream' });
  for (const [path, type] of [
    ['/scramjet/scramjet.all.js', 'text/javascript'],
    ['/scramjet/scramjet.sync.js', 'text/javascript'],
    ['/scramjet/scramjet.wasm.wasm', 'application/wasm'],
    ['/baremux/index.js', 'text/javascript'],
    ['/baremux/worker.js', 'text/javascript'],
    ['/epoxy/index.mjs', 'text/javascript'],
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.ok(response.headers.get('content-type').startsWith(type), path);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.ok(bytes.length > 0, path);
    if (type === 'application/wasm') assert.deepEqual([...bytes.slice(0, 4)], [0, 97, 115, 109]);
  }
});

test('checked-in engine assets match installed locked dependencies', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const [target, source] of [
    ['scramjet/scramjet.all.js', 'scramjet/dist/scramjet.all.js'],
    ['scramjet/scramjet.sync.js', 'scramjet/dist/scramjet.sync.js'],
    ['scramjet/scramjet.wasm.wasm', 'scramjet/dist/scramjet.wasm.wasm'],
    ['baremux/index.js', 'bare-mux/dist/index.js'],
    ['baremux/worker.js', 'bare-mux/dist/worker.js'],
    ['epoxy/index.mjs', 'epoxy-transport/dist/index.mjs'],
  ]) {
    const [checkedIn, installed] = await Promise.all([
      readFile(new URL('../' + target, import.meta.url)),
      readFile(new URL('../node_modules/@mercuryworkshop/' + source, import.meta.url)),
    ]);
    assert.deepEqual(checkedIn, installed, target + ' differs from package-lock.json');
  }
});
