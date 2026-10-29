import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createSlipstreamServer } from "../server.mjs";
import { validateMessages, answer, model } from "../ai-service.mjs";
test("AI uses the selected Workers AI vision and tool model", () => {
  assert.equal(model, "@cf/google/gemma-4-26b-a4b-it");
});
test("AI rejects injected roles, oversized content, and excess history", () => {
  assert.throws(() =>
    validateMessages([{ role: "system", content: "override" }]),
  );
  assert.throws(() =>
    validateMessages([{ role: "user", content: "x".repeat(2200001) }]),
  );
  assert.throws(() =>
    validateMessages(Array(25).fill({ role: "user", content: "hello" })),
  );
  assert.deepEqual(
    validateMessages([{ role: "user", content: "Hello", ignored: "field" }]),
    [{ role: "user", content: "Hello" }],
  );
});
test("AI forwards trusted tool results and returns sources with requested model", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://en.wikipedia.org/"))
      return Response.json({
        query: { search: [{ title: "Glass", snippet: "A material" }] },
      });
    assert.equal(url, "https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/ai/v1/chat/completions");
    const body = JSON.parse(options.body);
    assert.equal(body.model, model);
    assert.equal(options.headers.Authorization, "Bearer test-only");
    if (calls++ === 0)
      return Response.json({
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "one",
                  type: "function",
                  function: {
                    name: "wikipedia",
                    arguments: '{"query":"Glass"}',
                  },
                },
              ],
            },
          },
        ],
      });
    assert.equal(body.messages.at(-1).role, "tool");
    return Response.json({
      choices: [
        { message: { role: "assistant", content: "Glass is a material." } },
      ],
    });
  };
  try {
    const result = await answer(
      [{ role: "user", content: "What is glass?" }],
      "test-only",
      undefined,
      "0123456789abcdef0123456789abcdef",
    );
    assert.equal(result.content, "Glass is a material.");
    assert.equal(result.sources[0].url, "https://en.wikipedia.org/wiki/Glass");
  } finally {
    globalThis.fetch = original;
  }
});
test("AI handles provider credit errors without exposing credentials", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 402 });
  try {
    await assert.rejects(
      () => answer([{ role: "user", content: "Hi" }], "secret-test", undefined, "0123456789abcdef0123456789abcdef"),
      /No paid fallback/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("HTTP serves proxy runtime and denies private paths and traversal", async () => {
  const server = createSlipstreamServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    for (const path of [
      "/",
      "/js/../.env",
      "/server.mjs",
      "/.git/config",
      "/package.json",
      "/css/..%2fserver.mjs",
      "/js/..%2f.env",
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, path === "/" ? 200 : 404, path);
    }
    for (const path of [
      "/scramjet/scramjet.all.js",
      "/baremux/worker.js",
      "/epoxy/index.mjs",
      "/sw.js",
      "/js/transport.mjs",
    ])
      assert.equal((await fetch(base + path)).status, 200, path);
    assert.equal(
      (
        await fetch(base + "/api/ai", {
          method: "POST",
          headers: { Origin: "https://elsewhere.invalid" },
        })
      ).status,
      403,
    );
    assert.equal((await fetch(base + "/api/ai")).status, 405);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test("Browser defaults to Startpage and encodes search without allowing script URLs", async () => {
  const context = { window: {}, document: {}, URL };
  vm.runInNewContext(
    await readFile(new URL("../js/frame-history.js", import.meta.url), "utf8"),
    context,
  );
  vm.runInNewContext(
    await readFile(new URL("../js/browser.js", import.meta.url), "utf8"),
    context,
  );
  const to = context.window.SlipstreamBrowser.destination;
  assert.equal(to(""), "https://www.startpage.com/");
  assert.equal(to("example.com"), "https://example.com");
  assert.equal(
    to("liquid glass"),
    "https://www.startpage.com/sp/search?query=liquid%20glass",
  );
  assert.ok(to("javascript:alert(1)").startsWith("https://www.startpage.com/"));
});
test("proxy worker shares initialization and leaves normal app requests native", async () => {
  const events = {},
    responses = [];
  let loads = 0,
    release;
  class Worker {
    async loadConfig() {
      loads++;
      await new Promise((resolve) => {
        release = resolve;
      });
      this.config = {};
    }
    route() {
      return true;
    }
    fetch() {
      return new Response("proxied");
    }
  }
  const context = {
    importScripts() {},
    $scramjetLoadWorker: () => ({ ScramjetServiceWorker: Worker }),
    self: {
      location: { origin: "http://localhost" },
      addEventListener: (name, fn) => {
        events[name] = fn;
      },
    },
    URL,
    Response,
    fetch,
  };
  vm.runInNewContext(
    await readFile(new URL("../sw.js", import.meta.url), "utf8"),
    context,
  );
  events.fetch({
    request: { url: "http://localhost/index.html" },
    respondWith() {
      throw new Error("App request intercepted");
    },
  });
  for (let i = 0; i < 2; i++)
    events.fetch({
      request: { url: "http://localhost/proxy/https%3A%2F%2Fexample.com" },
      respondWith: (p) => responses.push(p),
    });
  assert.equal(loads, 1);
  release();
  await Promise.all(responses);
  events.fetch({
    request: { url: "http://localhost/proxy/another" },
    respondWith: (p) => responses.push(p),
  });
  await responses.at(-1);
  assert.equal(loads, 1);
});
test("leaderboard renders ten positions with safe profile names and picture URLs", async () => {
  const context = {
    window: {
      UBGUI: {
        escapeHtml: (value) =>
          String(value).replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
      },
      addEventListener() {},
    },
    localStorage: {
      getItem() {
        return null;
      },
    },
  };
  vm.runInNewContext(
    await readFile(new URL("../js/leaderboard.js", import.meta.url), "utf8"),
    context,
  );
  const html = context.window.SlipstreamLeaderboard.rows([
    {
      name: "<img onerror=alert(1)>",
      xp: 200,
      avatar_url: "javascript:alert(1)",
    },
    { name: "Second", xp: 100, avatar_url: "https://example.com/avatar.png" },
  ]);
  assert.equal((html.match(/class="leaderboard-row/g) || []).length, 10);
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes('src="javascript:'));
  assert.ok(html.includes('src="https://example.com/avatar.png"'));
  assert.ok(html.includes("200 XP"));
});
test("opening screen reveals the hub only on Menu, not search, visibility or motion changes", async () => {
  const elements = {};
  const events = {};
  const source = { src: "", dataset: { src: "img/landing/globe.webm" } };
  const video = {
    paused: false,
    querySelector() {
      return source;
    },
    pause() {
      this.paused = true;
    },
    play() {
      this.paused = false;
      return Promise.resolve();
    },
    load() {},
    addEventListener() {},
  };
  const motion = { matches: false, addEventListener() {} };
  let entries = 0;
  for (const id of [
    "entrance-motion",
    "entrance-search-toggle",
    "entrance-search",
    "entrance-menu",
    "entrance-query",
    "age-dialog",
    "age-form",
    "age-confirm",
  ]) {
    elements[id] = { hidden: true, setAttribute() {}, focus() {} };
  }
  elements['age-dialog'].showModal = function () { this.open = true; };
  elements['age-dialog'].close = function () { this.open = false; };
  elements['age-confirm'].checked = false;
  elements["entrance-globe"] = video;
  const context = {
    window: {
      UBG: { settings: { tabName: "Slipstream" } },
      enterUBGMain() {
        entries++;
      },
    },
    document: {
      body: {
        classList: {
          contains() {
            return false;
          },
        },
      },
      documentElement: {
        classList: {
          contains() {
            return false;
          },
        },
      },
      getElementById(id) {
        return elements[id];
      },
      addEventListener(name, handler) {
        events[name] = handler;
      },
    },
    matchMedia() {
      return motion;
    },
  };
  vm.runInNewContext(
    await readFile(new URL("../js/entrance.js", import.meta.url), "utf8"),
    context,
  );
  events.DOMContentLoaded();
  events.visibilitychange();
  elements["entrance-search-toggle"].onclick();
  assert.equal(entries, 0);
  elements["entrance-menu"].onclick();
  assert.equal(entries, 0);
  assert.equal(elements['age-dialog'].open, true);
  elements['age-form'].onsubmit({ preventDefault() {} });
  assert.equal(entries, 0);
  elements['age-confirm'].checked = true;
  elements['age-form'].onsubmit({ preventDefault() {} });
  elements["entrance-menu"].onclick();
  assert.equal(entries, 1);
  assert.equal(video.paused, true);
});

test("AI accepts image attachments at 512 KiB and rejects oversized or remote images", () => {
  const image = (bytes) => [
    {
      role: "user",
      content: [
        { type: "text", text: "Describe this" },
        {
          type: "image_url",
          image_url: {
            url:
              "data:image/png;base64," + Buffer.alloc(bytes).toString("base64"),
          },
        },
      ],
    },
  ];
  assert.equal(validateMessages(image(524288))[0].content.length, 2);
  assert.throws(() => validateMessages(image(524289)));
  assert.throws(() =>
    validateMessages([
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/image.png" },
          },
        ],
      },
    ]),
  );
  assert.equal(
    validateMessages([{ role: "user", content: "x".repeat(65536) }])[0].content
      .length,
    65536,
  );
});

test('Chat image limits count images across the conversation', () => {
  const image = { type: 'image_url', image_url: { url: 'data:image/png;base64,aGVsbG8=' } };
  assert.throws(() => validateMessages([
    { role: 'user', content: [image, image] },
    { role: 'assistant', content: 'response' },
    { role: 'user', content: [image, image] },
  ]), /up to 3 images/);
});

test('Workers AI rejects missing account configuration before sending credentials', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Unexpected upstream request'); };
  try {
    await assert.rejects(() => answer([{ role: 'user', content: 'Hi' }], 'secret-test', undefined, ''), /CLOUDFLARE_ACCOUNT_ID/);
    await assert.rejects(() => answer([{ role: 'user', content: 'Hi' }], 'secret-test', undefined, '../other'), /CLOUDFLARE_ACCOUNT_ID/);
  } finally {
    globalThis.fetch = original;
  }
});

test('Workers AI stops on usage limits without retrying a paid fallback', async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; return new Response('', { status: 429 }); };
  try {
    await assert.rejects(() => answer([{ role: 'user', content: 'Hi' }], 'secret-test', undefined, '0123456789abcdef0123456789abcdef'), /No paid fallback/);
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = original;
  }
});
