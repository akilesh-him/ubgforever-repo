import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createSlipstreamServer } from '../server.mjs';
const catalog = JSON.parse(await readFile(new URL('../js/provider-catalog.json', import.meta.url)));

test('bundled providers contain distinct playable destinations and accurate counts', () => {
  assert.equal(new Set(catalog.games.map(game => game.id)).size, catalog.games.length);
  assert.ok(catalog.games.length > 6000);
  for (const [provider, count] of Object.entries(catalog.counts)) assert.equal(catalog.games.filter(game => game.provider === provider).length, count);
  for (const game of catalog.games) { assert.ok(game.name); assert.equal(new URL(game.file).protocol,'https:'); }
});

test('additional games load when all external catalog requests fail', async () => {
  const context={window:{dispatchEvent(){}},document:{addEventListener(){}},localStorage:{getItem(){return null}},fetch:async url=>{if(url==='/js/provider-catalog.json')return Response.json(catalog);throw new Error('offline')},AbortController,setTimeout,clearTimeout,CustomEvent:class{},console:{warn(){}}};
  for(const file of ['games-providers.js','games-data.js','games.js'])vm.runInNewContext(await readFile(new URL('../js/'+file,import.meta.url),'utf8'),context);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.ok(context.window.UBGGames.total()>4000);
  assert.ok(context.window.UBGGames.search('Bowmasters',50).length);
});

test('game proxy rejects arbitrary URLs and preserves relative asset locations', async () => {
  const server=createSlipstreamServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const original=globalThis.fetch;
  try {
    assert.equal((await original(base+'/game-proxy?provider=ugs&file=https://example.com')).status,400);
    const game=catalog.games.find(game=>game.provider==='3kh0-lite');
    globalThis.fetch=async(url,options)=> String(url).startsWith(base)?original(url,options):new Response('<html><head></head><body>game</body></html>');
    const response=await original(base+'/game-proxy?provider='+game.provider+'&file='+encodeURIComponent(game.file));
    assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/html/);assert.ok((await response.text()).includes('<base href="'+new URL('.',game.file).href+'">'));
  } finally {globalThis.fetch=original;await new Promise(resolve=>server.close(resolve));}
});

test('providers are enabled when the catalog arrives before the Games view mounts', async () => {
  let mount;
  const root={innerHTML:'',querySelector(){throw new Error('markup-ready')}};
  const context={window:{dispatchEvent(){}},document:{addEventListener(name,callback){if(name==='DOMContentLoaded')mount=callback},getElementById(){return root}},localStorage:{getItem(){return null}},fetch:async url=>{if(url==='/js/provider-catalog.json')return Response.json(catalog);throw new Error('offline')},AbortController,setTimeout,clearTimeout,CustomEvent:class{},console:{warn(){}}};
  for(const file of ['games-providers.js','games-data.js','games.js'])vm.runInNewContext(await readFile(new URL('../js/'+file,import.meta.url),'utf8'),context);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.throws(()=>mount(),/markup-ready/);
  const option=root.innerHTML.match(/<option value="3kh0-lite"[^>]*>/)[0];
  assert.ok(!option.includes('disabled'));
  assert.ok(!root.innerHTML.includes('value="duckmath"'));
});
