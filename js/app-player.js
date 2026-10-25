(function () {
  "use strict";

  var generation = 0;
  var frame;
  var history;
  var $ = function (id) {
    return document.getElementById(id);
  };

  function updateNavigation() {
    $("player-back").disabled = !history?.canBack;
    $("player-forward").disabled = !history?.canForward;
  }

  function move(direction) {
    var url = history?.move(direction);
    if (frame && url) frame.go(url);
    updateNavigation();
  }

  function close() {
    generation++;
    frame = null;
    history = null;
    var element = $("player-iframe");
    element.onload = null;
    element.removeAttribute("srcdoc");
    element.src = "about:blank";
    $("v-player").hidden = true;
    document.body.style.overflow = "";
    if (document.fullscreenElement)
      document.exitFullscreen().catch(function () {});
    location.hash = "apps";
  }

  async function open(app) {
    var current = ++generation;
    frame = null;
    history = new window.SlipstreamFrameHistory();
    updateNavigation();
    var previous = $("player-iframe");
    var element = previous.cloneNode(false);
    element.removeAttribute("src");
    element.removeAttribute("srcdoc");
    previous.replaceWith(element);
    var loader = $("player-loader-overlay");
    var tip = $("player-loader-tip");
    $("player-app-title").textContent = app.name || "App";
    element.title = app.name || "App";
    loader.classList.remove("done");
    loader.style.display = "flex";
    loader.querySelector(".spin").hidden = false;
    tip.textContent = window.UBG.settings.ultOpt ? "" : "Opening your app…";
    element.onload = function () {
      if (current === generation) loader.style.display = "none";
    };
    try {
      if (app.proxy_url) {
        var client = await window.SlipstreamProxy.createFrame(element);
        if (current !== generation) return;
        frame = client;
        history.visit(app.proxy_url);
        client.addEventListener("urlchange", function (event) {
          if (current !== generation) return;
          history.visit(String(event.url || ""));
          updateNavigation();
        });
        client.go(app.proxy_url);
      } else if (app.html_code) element.srcdoc = app.html_code;
      else if (app.app_url) element.src = app.app_url;
      else throw new Error("This app has no launch destination.");
    } catch (error) {
      if (current !== generation) return;
      loader.style.display = "flex";
      loader.querySelector(".spin").hidden = true;
      tip.textContent = error.message + " Close the app and retry.";
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("player-exit").onclick = close;
    $("player-back").onclick = function () {
      move(-1);
    };
    $("player-forward").onclick = function () {
      move(1);
    };
  });
  window.SlipstreamAppPlayer = { open: open, close: close };
})();
