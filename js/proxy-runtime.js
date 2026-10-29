(function () {
  "use strict";
  var ready;
  var controller;
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = function () {
        script.remove();
        reject(
          new Error("Could not load the browser engine. Retry to reconnect."),
        );
      };
      document.head.appendChild(script);
    });
  }

  function checkWisp(url) {
    return new Promise(function (resolve, reject) {
      var socket = new WebSocket(url);
      var timer = setTimeout(function () { finish(new Error("The browsing server did not respond. Check the Wisp backend and WebSocket routing.")); }, 10000);
      function finish(error) {
        clearTimeout(timer);
        socket.onmessage = socket.onerror = socket.onclose = null;
        socket.close();
        if (error) reject(error);
        else resolve();
      }
      socket.onmessage = function (event) {
        if (typeof event.data === "string") finish(new Error("The browsing endpoint returned an invalid Wisp handshake."));
        else finish();
      };
      socket.onerror = socket.onclose = function () {
        finish(new Error("Could not connect to the browsing server. The host must route WebSocket requests to Wisp."));
      };
    });
  }

  async function initialize() {
    if (ready) return ready;
    ready = (async function () {
      if (!navigator.serviceWorker)
        throw new Error("Use localhost or HTTPS to open this page.");
      if (!window.$scramjetLoadController)
        await loadScript("/scramjet/scramjet.all.js");
      if (!window.BareMux) await loadScript("/baremux/index.js");
      controller = new (window.$scramjetLoadController().ScramjetController)({
        prefix: "/proxy/",
        files: {
          all: "/scramjet/scramjet.all.js",
          sync: "/scramjet/scramjet.sync.js",
          wasm: "/scramjet/scramjet.wasm.wasm",
        },
      });
      await controller.init();
      await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      if (
        !navigator.serviceWorker.controller ||
        !navigator.serviceWorker.controller.scriptURL.endsWith("/sw.js")
      ) {
        await new Promise(function (resolve, reject) {
          var timer = setTimeout(function () {
            navigator.serviceWorker.removeEventListener(
              "controllerchange",
              changed,
            );
            reject(
              new Error("Browser setup timed out. Reload Slipstream to retry."),
            );
          }, 12000);
          function changed() {
            if (
              navigator.serviceWorker.controller?.scriptURL.endsWith("/sw.js")
            ) {
              clearTimeout(timer);
              navigator.serviceWorker.removeEventListener(
                "controllerchange",
                changed,
              );
              resolve();
            }
          }
          navigator.serviceWorker.addEventListener("controllerchange", changed);
          changed();
        });
      }
      var wispURL = window.SlipstreamProxyConfig?.wispURL ||
        (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/wisp";
      await checkWisp(wispURL);
      var connection = new BareMux.BareMuxConnection("/baremux/worker.js");
      await connection.setTransport("/js/transport.mjs", [
        {
          wisp: wispURL,
        },
      ]);
    })().catch(function (error) {
      ready = null;
      throw error;
    });
    return ready;
  }

  window.SlipstreamProxy = {
    createFrame: async function (element) {
      await initialize();
      return controller.createFrame(element);
    },
  };
})();
