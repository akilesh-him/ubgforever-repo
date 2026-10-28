import { createSlipstreamServer } from './server.mjs';

export function createVercelServer(pathname) {
  const server = createSlipstreamServer();
  function route(req) {
    const url = new URL(req.url, 'http://localhost');
    req.url = pathname + url.search;
  }
  server.prependListener('request', route);
  server.prependListener('upgrade', route);
  return server;
}
