import providerCatalog from './js/provider-catalog.json' with { type: 'json' };
import { aiPolicy } from "./js/ai-policy.mjs";
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import { answer, validateMessages } from "./ai-service.mjs";
import { allowedOrigin, parsePublicOrigins } from "./server-origins.mjs";
const root = dirname(fileURLToPath(import.meta.url));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".webm": "video/webm",
};
const routes = {
  "/scramjet/": resolve(root, "node_modules/@mercuryworkshop/scramjet/dist"),
  "/baremux/": resolve(root, "node_modules/@mercuryworkshop/bare-mux/dist"),
  "/epoxy/": resolve(
    root,
    "node_modules/@mercuryworkshop/epoxy-transport/dist",
  ),
};
const providerFiles = new Map(providerCatalog.games.map(game => [game.provider + '|' + game.file, game.file]));
const rates = new Map();
function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}
async function serveGameProxy(req, res, url) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Use GET.' });
  const provider = url.searchParams.get('provider') || '';
  const file = url.searchParams.get('file') || '';
  const target = provider === 'ugs' && /^cl[^/\\]+\.html$/.test(file)
    ? 'https://cdn.jsdelivr.net/gh/bubbls/ugs-singlefile@main/UGS-Files/' + encodeURIComponent(file)
    : providerFiles.get(provider + '|' + file);
  if (!target) return json(res, 400, { error: 'Unknown game destination.' });
  try {
    const response = await fetch(target, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) return json(res, response.status, { error: 'Game source is unavailable.' });
    const base = '<base href="' + new URL('.', target).href.replaceAll('&', '&amp;').replaceAll('"', '&quot;') + '">';
    const original = await response.text();
    const html = /<head\b[^>]*>/i.test(original) ? original.replace(/<head\b[^>]*>/i, match => match + base) : base + original;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(html);
  } catch {
    json(res, 502, { error: 'Game source could not be reached. Please retry.' });
  }
}
export function createSlipstreamServer() {
  const publicOrigins = parsePublicOrigins(process.env.PUBLIC_ORIGINS || "");
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "same-origin");
      if (url.pathname === "/healthz") {
        if (!["GET", "HEAD"].includes(req.method)) return json(res, 405, { error: "Use GET." });
        try {
          await Promise.all([
            stat(resolve(routes["/scramjet/"], "scramjet.all.js")),
            stat(resolve(routes["/scramjet/"], "scramjet.wasm.wasm")),
            stat(resolve(routes["/baremux/"], "index.js")),
            stat(resolve(routes["/epoxy/"], "index.mjs")),
          ]);
          if (req.method === "HEAD") { res.writeHead(200, { "Cache-Control": "no-store" }); return res.end(); }
          return json(res, 200, { status: "ok", service: "slipstream" });
        } catch {
          return json(res, 503, { error: "Browser engine files are missing. Run npm ci before starting the server." });
        }
      }
      if (url.pathname === "/api/ai") {
        if (req.method !== "POST")
          return json(res, 405, { error: "Use POST." });
        if (
          !allowedOrigin(req.headers.origin, req.headers.host, publicOrigins)
        )
          return json(res, 403, { error: "Origin not allowed." });
        if (!process.env.GROQ_API_KEY)
          return json(res, 503, {
            error: "AI is not configured on this server.",
          });
        const ip = req.socket.remoteAddress,
          now = Date.now(),
          record = rates.get(ip);
        const rate =
          !record || now - record.start > 60000
            ? { start: now, count: 0 }
            : record;
        if (++rate.count > 10)
          return json(res, 429, {
            error: "Please wait a minute before trying again.",
          });
        rates.set(ip, rate);
        for (const [key, value] of rates)
          if (now - value.start > 60000) rates.delete(key);
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > aiPolicy.maxRequestBytes)
            return json(res, 413, { error: "Message is too large." });
          chunks.push(chunk);
        }
        let messages;
        try {
          messages = validateMessages(
            JSON.parse(Buffer.concat(chunks).toString("utf8")).messages,
          );
        } catch (error) {
          return json(res, 400, { error: error.message });
        }
        try {
          return json(
            res,
            200,
            await answer(
              messages,
              process.env.GROQ_API_KEY,
              AbortSignal.timeout(120000),
            ),
          );
        } catch (error) {
          return json(res, 502, {
            error:
              error.name === "TimeoutError"
                ? "The AI timed out. Please retry."
                : error.message,
          });
        }
      }
      if (url.pathname === '/game-proxy') return await serveGameProxy(req, res, url);
      if (!["GET", "HEAD"].includes(req.method))
        return json(res, 405, { error: "Method not allowed." });
      const pathname = decodeURIComponent(url.pathname);
      let base = root,
        relative = pathname === "/" ? "index.html" : pathname.slice(1);
      for (const [prefix, directory] of Object.entries(routes))
        if (pathname.startsWith(prefix)) {
          base = directory;
          relative = pathname.slice(prefix.length);
          break;
        }
      if (
        base === root &&
        !(
          /^(index\.html|sw\.js)$/.test(relative) ||
          /^(css|js|img|game-pictures|apps|links)\//.test(relative)
        )
      )
        return json(res, 404, { error: "Not found." });
      if (
        relative
          .split("/")
          .some((part) => part.startsWith(".") || part === "..")
      )
        return json(res, 404, { error: "Not found." });
      const file = resolve(base, relative);
      if (!file.startsWith(base + sep))
        return json(res, 404, { error: "Not found." });
      const info = await stat(file);
      if (!info.isFile()) return json(res, 404, { error: "Not found." });
      res.setHeader(
        "Content-Type",
        mime[extname(file)] || "application/octet-stream",
      );
      res.setHeader("Content-Length", info.size);
      res.setHeader(
        "Cache-Control",
        pathname === "/sw.js" ? "no-store" : "no-cache",
      );
      if (pathname === "/sw.js") res.setHeader("Service-Worker-Allowed", "/");
      if (req.method === "HEAD") return res.end();
      createReadStream(file).pipe(res);
    } catch {
      if (!res.headersSent) json(res, 404, { error: "Not found." });
      else res.end();
    }
  });
  server.on("upgrade", (req, socket, head) => {
    try {
      if (
        ["/wisp", "/wisp/"].includes(new URL(req.url, "http://localhost").pathname) &&
        allowedOrigin(req.headers.origin, req.headers.host, publicOrigins)
      )
      {
        req.url = "/wisp/";
        wisp.routeRequest(req, socket, head);
      }
      else socket.destroy();
    } catch {
      socket.destroy();
    }
  });
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  createSlipstreamServer().listen(
    Number(process.env.PORT) || 5186,
    process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
    () =>
      console.log(
        "Slipstream preview: http://localhost:" + (process.env.PORT || 5186),
      ),
  );
