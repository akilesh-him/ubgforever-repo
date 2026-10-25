(function () {
  "use strict";

  var modal = document.getElementById("community-chat-modal");
  var sheet = document.getElementById("sheet");
  var previousFocus;

  function visibleOverlay() {
    if (!modal.classList.contains("hidden")) return modal;
    if (!sheet.hidden) return sheet;
    return null;
  }

  function focusable(root) {
    return Array.from(
      root.querySelectorAll(
        'button, a[href], input, textarea, select, [tabindex="0"]',
      ),
    ).filter(function (element) {
      return !element.disabled && element.getClientRects().length;
    });
  }

  function trackOverlay() {
    var overlay = visibleOverlay();
    if (overlay && !previousFocus) {
      previousFocus = document.activeElement;
      var first = focusable(overlay)[0];
      if (first) first.focus();
    } else if (!overlay && previousFocus) {
      var saved = previousFocus;
      previousFocus = null;
      if (saved.isConnected) saved.focus();
    }
  }

  new MutationObserver(trackOverlay).observe(modal, {
    attributes: true,
    attributeFilter: ["class"],
  });
  new MutationObserver(trackOverlay).observe(sheet, {
    attributes: true,
    attributeFilter: ["hidden"],
  });

  document.addEventListener("keydown", function (event) {
    var overlay = visibleOverlay();
    if (event.key === "Escape") {
      if (overlay === modal) window.closeCommunityChat();
      if (overlay === sheet) sheet.hidden = true;
      var search = document.getElementById("top-search");
      if (!search.hidden) {
        search.hidden = true;
        document
          .getElementById("dock-search")
          .setAttribute("aria-expanded", "false");
        document.getElementById("dock-search").focus();
      }
      return;
    }
    if (event.key !== "Tab" || !overlay) return;
    var items = focusable(overlay);
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  document.addEventListener("click", function (event) {
    var search = document.getElementById("top-search");
    if (!search.hidden && !event.target.closest("#top-search, #dock-search")) {
      search.hidden = true;
      document
        .getElementById("dock-search")
        .setAttribute("aria-expanded", "false");
    }
  });

  document.getElementById("shell").addEventListener("click", function (event) {
    var link = event.target.closest(".topnav a");
    if (!link) return;
    document.querySelectorAll(".topnav a").forEach(function (item) {
      if (item === link) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
  });
})();
