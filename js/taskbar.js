import { motionReduced, mountEffectsSetting } from "./ui-preferences.mjs";
import { mountHomeMotion } from "./home-motion.mjs";
(function () {
  "use strict";

  mountEffectsSetting(document.getElementById("toggle-effects"));
  mountHomeMotion(document.getElementById("hero"));

  var paths = {
    home: '<path d="m3 10 9-7 9 7v10H15v-7H9v7H3z"/>',
    games:
      '<path d="M7 6h10c3 0 4 3 4 7s-1 5-3 4l-3-2H9l-3 2c-2 1-3-1-3-4s1-7 4-7Z"/><path d="M6 11h5m-2.5-2.5v5m7-3h.1m2 2h.1"/>',
    apps: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    browser:
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',
    links:
      '<path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
    ai: '<path d="M4 4h16v13H10l-6 4V4Z"/><path d="M8 9h8m-8 4h5"/>',
  };

  document.querySelectorAll(".topnav a").forEach(function (link) {
    var label = link.dataset.nav === "ai" ? "AI" : link.textContent.trim();
    link.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      paths[link.dataset.nav] +
      "</svg><span>" +
      label +
      "</span>";
    link.setAttribute("aria-label", label);
  });

  var search = document.getElementById("top-search");
  var searchButton = document.getElementById("dock-search");
  searchButton.onclick = function () {
    search.hidden = !search.hidden;
    searchButton.setAttribute("aria-expanded", String(!search.hidden));
    if (!search.hidden) document.getElementById("search-input").focus();
  };

  function moveSelection() {
    var selected = document.querySelector(".topnav a.on");
    var nav = document.getElementById("topnav");
    var old = nav.querySelector(".dock-selection");
    if (!old) {
      old = document.createElement("i");
      old.className = "dock-selection";
      old.setAttribute("aria-hidden", "true");
      nav.prepend(old);
    }
    old.hidden = !selected;
    if (selected) {
      old.style.transform = "translateX(" + selected.offsetLeft + "px)";
      old.style.width = selected.offsetWidth + "px";
    }
  }

  window.addEventListener("slipstreamnavigate", function (event) {
    requestAnimationFrame(moveSelection);
    var section = document.getElementById(event.detail.view);
    if (section && !motionReduced()) {
      section.animate(
        [
          { opacity: 0.6, transform: "translateY(8px) scale(.992)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    }
  });
  window.addEventListener("resize", moveSelection);
  document.addEventListener("DOMContentLoaded", moveSelection);
})();
