// ==UserScript==
// @include   main
// @loadOrder 99999999999999
// @ignorecache
// ==/UserScript==

(function () {
  "use strict";

  if (location.href !== "chrome://browser/content/browser.xhtml") return;

  if (document.documentElement.getAttribute("windowtype") !== "navigator:browser") {
    return;
  }

  try {
    if (window.toolbar && !window.toolbar.visible) return;
    if (window.opener) return;
  } catch (_) {}

  setTimeout(() => {
    const missing = ["#navigator-toolbox", "#browser"].filter(
      (sel) => !document.querySelector(sel)
    );
    if (missing.length) {
      console.warn("[Rename Pinned Tab] Missing chrome nodes:", missing.join(", "));
      return;
    }
    if (window.outerWidth < 400 || window.outerHeight < 300) return;
    if (document.documentElement.hasAttribute("dlgtype")) return;

    if (window.__zenRenamePinnedTabsBundleExecuted) {
      console.warn("[Rename Pinned Tab] Already initialized in this window.");
      return;
    }
    window.__zenRenamePinnedTabsBundleExecuted = true;

    (function tryInit(attempt) {
      const utils = window.zenRenamePinnedTabsUtils;
      const aiFactory = window.zenRenamePinnedTabsAi?.createAiRename;
      const hooksInit = window.zenRenamePinnedTabsHooks?.init;

      if (utils && aiFactory && hooksInit && typeof gBrowser !== "undefined") {
        const ai = aiFactory({ utils });
        hooksInit({
          gBrowser,
          win: window,
          ai,
          utils,
        });
        console.log("[Rename Pinned Tab] Ready. Pin a tab to rename; Shift+click icon to revert (see preferences).");
        return;
      }
      if (attempt < 80) {
        setTimeout(() => tryInit(attempt + 1), 50);
        return;
      }
      console.error(
        "[Rename Pinned Tab] Modules not loaded. Check theme.json script order and paths."
      );
    })(0);
  }, 100);
})();
