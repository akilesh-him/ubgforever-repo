(function () {
  "use strict";

  var video = document.getElementById("entrance-globe");
  var motionButton = document.getElementById("entrance-motion");
  var searchButton = document.getElementById("entrance-search-toggle");
  var search = document.getElementById("entrance-search");
  var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  var pausedByUser = false;
  var entered = false;

  function motionReduced() {
    return (
      reduceMotion.matches ||
      document.body.classList.contains("effects-reduced") ||
      document.documentElement.classList.contains("reduce-motion")
    );
  }

  function updateMotion() {
    if (entered || document.hidden || motionReduced() || pausedByUser) {
      video.pause();
      return;
    }
    var source = video.querySelector("source");
    if (!source.src) {
      source.src = source.dataset.src;
      video.load();
    }
    video.play().catch(function () {
      motionButton.hidden = true;
    });
  }

  video.addEventListener("playing", function () {
    motionButton.hidden = false;
    motionButton.setAttribute("aria-label", "Pause background video");
    motionButton.innerHTML =
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 6h4v12H7zm6 0h4v12h-4z"/></svg>';
  });

  video.addEventListener("pause", function () {
    motionButton.setAttribute("aria-label", "Play background video");
    motionButton.innerHTML =
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 12 7-12 7z"/></svg>';
  });

  motionButton.onclick = function () {
    pausedByUser = !video.paused;
    if (pausedByUser) video.pause();
    else if (!entered)
      video.play().catch(function () {
        motionButton.hidden = true;
      });
  };

  searchButton.onclick = function () {
    search.hidden = !search.hidden;
    searchButton.setAttribute("aria-expanded", String(!search.hidden));
    if (!search.hidden) document.getElementById("entrance-query").focus();
  };

  document.getElementById("entrance-menu").onclick = function () {
    if (entered) return;
    entered = true;
    video.pause();
    window.enterUBGMain();
  };

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !search.hidden) {
      search.hidden = true;
      searchButton.setAttribute("aria-expanded", "false");
      searchButton.focus();
    }
  });

  document.addEventListener("visibilitychange", updateMotion);
  reduceMotion.addEventListener("change", updateMotion);
  document.addEventListener("DOMContentLoaded", updateMotion);
  if (window.UBG.settings.tabName === "Slipstream")
    document.title = "Harvard University";
})();
