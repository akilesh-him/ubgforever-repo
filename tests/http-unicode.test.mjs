import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createSlipstreamServer } from "../server.mjs";

test("AI preserves multibyte characters split across request chunks", async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.CLOUDFLARE_API_TOKEN;
  const previousAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
  process.env.CLOUDFLARE_ACCOUNT_ID = "0123456789abcdef0123456789abcdef";
  let received;
  process.env.CLOUDFLARE_API_TOKEN = "local-test-key";
  globalThis.fetch = async (_, options) => {
    received = JSON.parse(options.body).messages.at(-1).content;
    return Response.json({
      choices: [{ message: { role: "assistant", content: "ok" } }],
    });
  };
  const server = createSlipstreamServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const message = "A pasted image of café 日本語";
    const bytes = Buffer.from(
      JSON.stringify({ messages: [{ role: "user", content: message }] }),
    );
    const split = bytes.indexOf(Buffer.from("日")) + 1;
    const result = await new Promise((resolve, reject) => {
      const request = http.request(
        {
          hostname: "127.0.0.1",
          port: server.address().port,
          path: "/api/ai",
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        (response) => {
          let body = "";
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () =>
            resolve({ status: response.statusCode, body }),
          );
        },
      );
      request.on("error", reject);
      request.write(bytes.subarray(0, split), () =>
        setImmediate(() => request.end(bytes.subarray(split))),
      );
    });
    assert.equal(result.status, 200);
    assert.equal(received, message);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousAccount === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID;
    else process.env.CLOUDFLARE_ACCOUNT_ID = previousAccount;
    if (previousKey === undefined) delete process.env.CLOUDFLARE_API_TOKEN;
    else process.env.CLOUDFLARE_API_TOKEN = previousKey;
    await new Promise((resolve) => server.close(resolve));
  }
});
