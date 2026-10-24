import http from "node:http";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

const srv = http.createServer((req, res) => { res.writeHead(200); res.end("ok"); });
srv.on("upgrade", (req, socket, head) => {
  if (req.url.startsWith("/wisp/")) wisp.routeRequest(req, socket, head);
  else socket.end();
});
srv.listen(process.env.PORT || 8080);
