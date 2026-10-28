import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createVercelServer } from '../vercel-server.mjs';
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

test('Vercel adapter preserves Wisp upgrade handling', () => {
  const server = createVercelServer('/wisp/');
  const req = { url: '/api/wisp', headers: { origin: 'https://attacker.example', host: 'slipstream.example' } };
  let destroyed = false;
  server.emit('upgrade', req, { destroy() { destroyed = true; } }, Buffer.alloc(0));
  assert.equal(req.url, '/wisp/');
  assert.equal(destroyed, true);
});
