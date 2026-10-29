import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  createAttachmentQueue,
  messagePayload,
} from "../js/ai-attachments.mjs";
import { aiPolicy } from "../js/ai-policy.mjs";
import { createBottomFollow } from "../js/ai-scroll.mjs";
import { HomeRow } from "../js/home-motion.mjs";

const source = (name) =>
  readFile(new URL("../js/" + name, import.meta.url), "utf8");

test("attachment readiness waits for reads and preserves the image in the outgoing payload", async () => {
  let release;
  const queue = createAttachmentQueue({
    read: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  queue.enqueue([{ name: "pasted.png", size: 30 }]);
  let ready = false;
  const outgoing = queue.ready().then((files) => {
    ready = true;
    return messagePayload("Describe it", files);
  });
  await Promise.resolve();
  assert.equal(ready, false);
  release({ name: "pasted.png", image: "data:image/png;base64,AA==" });
  const payload = await outgoing;
  assert.equal(payload[1].type, "image_url");
});

test("reset invalidates a pending image and queue recovers after read errors", async () => {
  let release;
  const errors = [];
  const queue = createAttachmentQueue({
    read: (file) =>
      file.name === "pending"
        ? new Promise((resolve) => {
            release = resolve;
          })
        : Promise.reject(new Error("unreadable")),
    onError: (error) => errors.push(error),
  });
  queue.enqueue([{ name: "pending", size: 1 }]);
  await Promise.resolve();
  queue.reset();
  release({ name: "pending", content: "discarded" });
  assert.deepEqual(await queue.ready(), []);
  queue.enqueue([{ name: "broken", size: 1 }]);
  await queue.ready();
  assert.deepEqual(errors, ["unreadable"]);
});

test("upload and paste use the same inclusive file size and count limits", async () => {
  const errors = [];
  const queue = createAttachmentQueue({
    read: async (file) => ({ name: file.name, content: "text" }),
    onError: (error) => errors.push(error),
  });
  queue.enqueue([
    { name: "at-limit.txt", size: aiPolicy.maxFileBytes },
    { name: "too-large.txt", size: aiPolicy.maxFileBytes + 1 },
  ]);
  assert.equal((await queue.ready()).length, 1);
  assert.match(errors[0], /exceeds 512 KB/);
  queue.enqueue(
    Array.from({ length: 4 }, (_, i) => ({ name: "small" + i, size: 1 })),
  );
  assert.equal((await queue.ready()).length, 4);
  assert.match(errors.at(-1), /four files/);
});

test("chat follows new replies only when pinned and jump resumes following", () => {
  let bottom = true,
    active = true,
    shown = false,
    scrolls = 0;
  const frames = [];
  const follower = createBottomFollow({
    isActive: () => active,
    isAtBottom: () => bottom,
    scrollToBottom: () => {
      scrolls++;
      bottom = true;
    },
    showButton: (value) => {
      shown = value;
    },
    schedule: (fn) => frames.push(fn),
  });
  follower.contentChanged();
  frames.shift()();
  assert.equal(scrolls, 1);
  bottom = false;
  follower.userScrolled();
  assert.equal(shown, true);
  follower.contentChanged();
  frames.shift()();
  assert.equal(scrolls, 1);
  follower.jump();
  assert.equal(scrolls, 2);
  follower.contentChanged();
  frames.shift()();
  assert.equal(scrolls, 3);
  active = false;
  follower.update();
  assert.equal(shown, false);
});

test("frame history preserves forward navigation and drops it on a new destination", async () => {
  const context = { window: {} };
  vm.runInNewContext(await source("frame-history.js"), context);
  const history = new context.window.SlipstreamFrameHistory();
  history.visit("one");
  history.visit("two");
  assert.equal(history.move(-1), "one");
  history.visit("one");
  assert.equal(history.canForward, true);
  assert.equal(history.move(1), "two");
  history.move(-1);
  history.visit("three");
  assert.equal(history.canForward, false);
  assert.equal(history.move(-1), "one");
});

test("proxy initialization is shared without mounting either interface", async () => {
  let initialized = 0,
    created = 0;
  class Controller {
    async init() {
      initialized++;
    }
    createFrame(element) {
      created++;
      return { element };
    }
  }
  const context = {
    setTimeout,
    clearTimeout,
    WebSocket: class {
      constructor(url) {
        assert.equal(url, "ws://localhost/wisp");
        queueMicrotask(() => this.onmessage({ data: new ArrayBuffer(9) }));
      }
      close() {}
    },
    window: {
      $scramjetLoadController: () => ({ ScramjetController: Controller }),
      BareMux: {},
    },
    navigator: {
      serviceWorker: {
        controller: { scriptURL: "http://localhost/sw.js" },
        async register() {},
      },
    },
    document: {
      getElementById() {
        throw new Error("Proxy must not access interface elements");
      },
    },
    location: { protocol: "http:", host: "localhost" },
    BareMux: {
      BareMuxConnection: class {
        async setTransport() {}
      },
    },
  };
  vm.runInNewContext(await source("proxy-runtime.js"), context);
  await Promise.all([
    context.window.SlipstreamProxy.createFrame("app"),
    context.window.SlipstreamProxy.createFrame("browser"),
  ]);
  assert.equal(initialized, 1);
  assert.equal(created, 2);
});

function rowFixture() {
  const animations = [];
  const track = {
    children: [],
    get firstElementChild() {
      return this.children[0];
    },
    get lastElementChild() {
      return this.children.at(-1);
    },
    append(node) {
      this.children.push(node);
      node.track = this;
    },
    prepend(node) {
      this.children.unshift(node);
      node.track = this;
    },
    animate(keyframes) {
      let resolve, reject;
      const finished = new Promise((a, b) => {
        resolve = a;
        reject = b;
      });
      const animation = {
        finished,
        keyframes,
        playState: "running",
        pause() {
          this.playState = "paused";
        },
        play() {
          this.playState = "running";
        },
        cancel() {
          this.playState = "idle";
          reject(new Error("cancelled"));
        },
        complete: resolve,
      };
      animations.push(animation);
      return animation;
    },
  };
  const tile = () => ({
    offsetWidth: 160,
    remove() {
      this.track.children.splice(this.track.children.indexOf(this), 1);
    },
  });
  for (let i = 0; i < 3; i++) track.append(tile());
  const element = { querySelector: () => track, isConnected: true };
  return { track, tile, element, animations };
}

test("continuous row recycles without changing card count and restarts after reset", async () => {
  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ gap: "18px" });
  try {
    const fixture = rowFixture();
    let paused = false;
    const row = new HomeRow(fixture.element, {
      right: false,
      choose: () => ({ id: "new" }),
      tile: fixture.tile,
      paused: () => paused,
    });
    row.start();
    assert.equal(fixture.track.children.length, 4);
    paused = true;
    row.sync();
    assert.equal(row.travel.playState, "paused");
    paused = false;
    row.sync();
    assert.equal(row.travel.playState, "running");
    fixture.animations[0].complete();
    await Promise.resolve();
    assert.equal(fixture.animations.length, 2);
    assert.equal(fixture.track.children.length, 4);
    row.reset();
    await Promise.resolve();
    assert.equal(row.travel, null);
    assert.equal(fixture.track.children.length, 3);
    row.start();
    assert.equal(fixture.track.children.length, 4);
    row.dispose();
    await Promise.resolve();
    assert.equal(fixture.track.children.length, 3);
    row.start();
    assert.equal(row.travel, null);
  } finally {
    globalThis.getComputedStyle = previous;
  }
});

test("profile uploads reject unsupported or oversized pictures before decoding", async () => {
  const { validateProfilePicture } = await import("../js/profile-picture.mjs");
  assert.doesNotThrow(() =>
    validateProfilePicture({ type: "image/png", size: 8 * 1024 * 1024 }),
  );
  assert.throws(
    () => validateProfilePicture({ type: "image/gif", size: 1 }),
    /JPG, PNG or WebP/,
  );
  assert.throws(
    () =>
      validateProfilePicture({ type: "image/png", size: 8 * 1024 * 1024 + 1 }),
    /8 MB/,
  );
});

test("storage reports write failure to callers without breaking state notifications", async () => {
  let notifications = 0;
  const context = {
    window: {
      dispatchEvent() {
        notifications++;
      },
    },
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {
        throw new Error("quota");
      },
    },
    CustomEvent: class {},
  };
  vm.runInNewContext(await source("storage.js"), context);
  assert.equal(context.window.UBGStore.save(), false);
  assert.equal(notifications, 1);
});

test("closing an app during proxy initialization cannot reopen it", async () => {
  let release,
    goCalls = 0;
  const elements = {};
  const element = () => ({
    style: {},
    classList: { remove() {} },
    hidden: false,
    removeAttribute() {},
    cloneNode() {
      return element();
    },
    replaceWith(next) {
      elements["player-iframe"] = next;
    },
    querySelector() {
      return { hidden: false };
    },
  });
  for (const id of [
    "player-iframe",
    "player-back",
    "player-forward",
    "v-player",
    "player-app-title",
    "player-loader-overlay",
    "player-loader-tip",
  ])
    elements[id] = element();
  const context = {
    document: {
      getElementById: (id) => elements[id],
      addEventListener() {},
      body: { style: {} },
      fullscreenElement: null,
    },
    location: { hash: "" },
    window: {
      UBG: { settings: {} },
      SlipstreamProxy: {
        createFrame: () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      },
    },
  };
  vm.runInNewContext(await source("frame-history.js"), context);
  vm.runInNewContext(await source("app-player.js"), context);
  const loading = context.window.SlipstreamAppPlayer.open({
    name: "Test",
    proxy_url: "https://example.com/",
  });
  context.window.SlipstreamAppPlayer.close();
  release({
    go() {
      goCalls++;
    },
    addEventListener() {},
  });
  await loading;
  assert.equal(goCalls, 0);
  assert.equal(context.location.hash, "apps");
  assert.equal(elements["v-player"].hidden, true);
  await context.window.SlipstreamAppPlayer.open({
    name: "Editor",
    app_url: "/apps/editor.html",
  });
  assert.equal(elements["player-iframe"].src, "/apps/editor.html");
});

test("bottom row enters from the left and moves right without a boundary pause", async () => {
  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ gap: "18px" });
  try {
    const fixture = rowFixture();
    const row = new HomeRow(fixture.element, {
      right: true,
      choose: () => ({ id: "next" }),
      tile: fixture.tile,
      paused: () => false,
    });
    row.start();
    assert.equal(
      fixture.animations[0].keyframes[0].transform,
      "translateX(-178px)",
    );
    assert.equal(
      fixture.animations[0].keyframes[1].transform,
      "translateX(0px)",
    );
    fixture.animations[0].complete();
    await Promise.resolve();
    assert.equal(fixture.animations.length, 2);
    row.dispose();
  } finally {
    globalThis.getComputedStyle = previous;
  }
});
