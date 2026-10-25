(function () {
  "use strict";

  var frame;
  var mounted = false;
  var history = new window.SlipstreamFrameHistory();
  var initializing;
  var $ = function (id) {
    return document.getElementById(id);
  };

  function destination(value) {
    var query = String(value || "").trim();
    if (!query) return "https://www.startpage.com/";
    if (/^https?:\/\//i.test(query)) return new URL(query).href;
    if (/^[\w-]+(?:\.[\w-]+)+(?:[:/].*)?$/.test(query))
      return "https://" + query;
    return (
      "https://www.startpage.com/sp/search?query=" + encodeURIComponent(query)
    );
  }

  function status(text) {
    $("browser-status").textContent = text;
  }

  function record(url) {
    history.visit(url);
    updateNavigation();
  }

  function updateNavigation() {
    $("browser-back").disabled = !history.canBack;
    $("browser-forward").disabled = !history.canForward;
  }

  async function initializeFrame() {
    if (frame) return frame;
    if (initializing) return initializing;
    initializing = window.SlipstreamProxy.createFrame($("ubgb-frame"))
      .then(function (client) {
        frame = client;
        frame.addEventListener("urlchange", function (event) {
          if (!event.url) return;
          $("browser-address").value = String(event.url);
          record(String(event.url));
        });
        $("ubgb-frame").onload = function () {
          status("");
        };
        return frame;
      })
      .catch(function (error) {
        initializing = null;
        throw error;
      });
    return initializing;
  }

  async function go(value) {
    mount();
    location.hash = "browser";
    try {
      var url = destination(value);
      $("browser-address").value = url;
      status("Connecting…");
      await initializeFrame();
      $("browser-welcome").hidden = true;
      $("ubgb-frame").hidden = false;
      record(url);
      frame.go(url);
    } catch (error) {
      status(error.message);
    }
  }

  function step(direction) {
    var url = history.move(direction);
    if (!frame || !url) return;
    $("browser-address").value = url;
    frame.go(url);
    updateNavigation();
  }

  function mount() {
    if (mounted) return;
    mounted = true;
    $("browser-root").innerHTML = `
      <div class="ubgb-win">
        <div class="browser-toolbar">
          <a class="browser-exit" href="#home" aria-label="Exit Browser">×</a>
          <button id="browser-back" aria-label="Back" disabled>←</button>
          <button id="browser-forward" aria-label="Forward" disabled>→</button>
          <button id="browser-reload" aria-label="Reload page">↻</button>
          <form id="browser-form">
            <input id="browser-address" aria-label="Search or enter a URL" placeholder="Search Startpage or enter a URL" autocomplete="off"/>
            <button type="submit" aria-label="Go">↗</button>
          </form>
        </div>
        <div class="browser-status" id="browser-status" role="status"></div>
        <div class="browser-welcome" id="browser-welcome">
          <img src="img/slipstream.png" alt=""/>
          <button class="btn outline" id="browser-start">Open Startpage</button>
        </div>
        <iframe id="ubgb-frame" title="Slipstream Browser" allow="fullscreen; autoplay; clipboard-write; encrypted-media" hidden></iframe>
      </div>`;
    $("browser-form").onsubmit = function (event) {
      event.preventDefault();
      go($("browser-address").value);
    };
    $("browser-start").onclick = function () {
      go("");
    };
    $("browser-back").onclick = function () {
      step(-1);
    };
    $("browser-forward").onclick = function () {
      step(1);
    };
    $("browser-reload").onclick = function () {
      if (frame) frame.reload();
      else go($("browser-address").value);
    };
  }

  window.UBGBrowserInit = mount;
  window.openBrowserPage = function () {
    location.hash = "browser";
  };
  window.SlipstreamBrowser = { go: go, destination: destination };
})();
