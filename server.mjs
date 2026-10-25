import { aiPolicy } from "./js/ai-policy.mjs";
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import { answer, validateMessages } from "./ai-service.mjs";
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
const rates = new Map();
function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}
export function createSlipstreamServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "same-origin");
      if (url.pathname === "/api/ai") {
        if (req.method !== "POST")
          return json(res, 405, { error: "Use POST." });
        if (
          req.headers.origin &&
          req.headers.origin !== "http://" + req.headers.host &&
          req.headers.origin !== "https://" + req.headers.host
        )
          return json(res, 403, { error: "Origin not allowed." });
        if (!process.env.OPENROUTER_API_KEY)
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
              process.env.OPENROUTER_API_KEY,
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
        req.url === "/wisp/" &&
        (!req.headers.origin ||
          new URL(req.headers.origin).host === req.headers.host)
      )
        wisp.routeRequest(req, socket, head);
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
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        "Slipstream preview: http://localhost:" + (process.env.PORT || 5186),
      ),
  );
