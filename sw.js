importScripts('/scramjet/scramjet.all.js');
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const proxy = new ScramjetServiceWorker();
let flight, configured = false, version = 0;
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => { if (event.data?.['scramjet$type'] === 'loadConfig') { configured = false; version++; } });
async function prepare() {
  if (flight) return flight;
  if (configured) return;
  const started = version;
  flight = (async () => { proxy.config = undefined; await proxy.loadConfig(); if (!proxy.config) throw new Error('Missing configuration'); configured = started === version; })().finally(() => { flight = null; });
  return flight;
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || (!url.pathname.startsWith('/proxy/') && url.pathname !== '/scramjet/scramjet.wasm.wasm')) return;
  event.respondWith((async () => {
    try { await prepare(); return proxy.route(event) ? await proxy.fetch(event) : await fetch(event.request); }
    catch { return new Response('Slipstream could not connect. Reload the browser to retry.', { status: 503, headers: { 'Content-Type': 'text/plain' } }); }
  })());
});
