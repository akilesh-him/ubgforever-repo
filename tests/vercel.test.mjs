import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createVercelServer } from '../vercel-server.mjs';
import aiHandler from '../api/ai.mjs';
import gameProxyHandler from '../api/game-proxy.mjs';
import wispHandler from '../api/wisp.mjs';
import { readAIResponse } from '../js/ai-response.mjs';

test('AI rejects HTML responses with deployment guidance', async () => {
  await assert.rejects(readAIResponse(new Response('<html>error</html>', { headers: { 'content-type': 'text/html' } })), /deployment API routing/);
  assert.deepEqual(await readAIResponse(Response.json({ content: 'hello' })), { content: 'hello' });
  await assert.rejects(readAIResponse(Response.json({ error: 'AI not configured' }, { status: 503 })), /AI not configured/);
});

test('Vercel adapter routes rewritten game requests and preserves query parameters', async t => {
  const server = createVercelServer('/game-proxy');
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/game-proxy?provider=missing&file=missing');
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Unknown game destination.' });
});

test('Vercel API entry points export callable request handlers', () => {
  for (const handler of [aiHandler, gameProxyHandler, wispHandler])
    assert.equal(typeof handler, 'function');
});

test('Vercel request handler dispatches rewritten requests', async t => {
  const server = createServer(gameProxyHandler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/game-proxy?provider=missing&file=missing');
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Unknown game destination.' });
});

test('Vercel adapter preserves Wisp upgrade handling', () => {
  const server = createVercelServer('/wisp/');
  const req = { url: '/api/wisp', headers: { origin: 'https://attacker.example', host: 'slipstream.example' } };
  let destroyed = false;
  server.emit('upgrade', req, { destroy() { destroyed = true; } }, Buffer.alloc(0));
  assert.equal(req.url, '/wisp/');
  assert.equal(destroyed, true);
});

test('Wisp completes binary handshakes without relying on a trailing slash', async t => {
  const { default: WebSocket } = await import('ws');
  const { createSlipstreamServer } = await import('../server.mjs');
  for (const adapter of [false, true]) {
    const server = adapter ? createVercelServer('/wisp/') : createSlipstreamServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    for (const path of ['/wisp', '/wisp/', '/wisp?session=test']) {
      const socket = new WebSocket('ws://127.0.0.1:' + server.address().port + path);
      const timer = setTimeout(() => socket.terminate(), 3000);
      try {
        const [data, binary] = await once(socket, 'message');
        assert.equal(binary, true);
        assert.equal(data[0], 3);
        assert.equal(data.readUInt32LE(1), 0);
      } finally {
        clearTimeout(timer);
        const closed = once(socket, 'close');
        socket.close();
        await closed;
      }
    }
  }
});
