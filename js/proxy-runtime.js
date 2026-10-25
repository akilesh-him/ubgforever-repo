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
      var connection = new BareMux.BareMuxConnection("/baremux/worker.js");
      await connection.setTransport("/js/transport.mjs", [
        {
          wisp:
            (location.protocol === "https:" ? "wss://" : "ws://") +
            location.host +
            "/wisp/",
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
