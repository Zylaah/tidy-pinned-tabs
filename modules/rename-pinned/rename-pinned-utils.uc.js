// ==UserScript==
// @include   main
// @loadOrder 99999999999990
// @ignorecache
// ==/UserScript==

(function () {
  "use strict";

  if (location.href !== "chrome://browser/content/browser.xhtml") return;

  const { classes: Cc, interfaces: Ci } = Components;

  const MISTRAL_API_KEY_PREF = "extensions.zen.rename_pinned_tab.mistral_api_key";
  const ENABLED_PREF = "extensions.zen.rename_pinned_tab.enabled";
  const DEBUG_PREF = "extensions.zen.rename_pinned_tab.debug";
  const MODEL_PREF = "extensions.zen.rename_pinned_tab.mistral_model";
  const REVERT_MODIFIER_PREF = "extensions.zen.rename_pinned_tab.revert_modifier";
  const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

  /** System prompt (from project ai prompt.txt — content field). */
  const PINNED_TAB_SYSTEM_PROMPT = `You are a perfect editor, summarizer and translator.
I am bookmarking a tab in my browser.

The title is \`Wolfram|Alpha: Computational Intelligence\`.

- Remove the name of the site (wolframalpha.com), if it's not the only thing there).
- Remove other SEO cruft
- Don't make the title too general. As specific as possible without going over the word count.
- If the page is about a proper noun (personal site, restaurant homepage, brand homepage), the new title should always include the proper noun along with context. For example, "Individualized Eng Expectations - Anna Delvey" would translate to "Anna's Eng Expectations", and "Arc by the Browser Company: Monetization Strategy" would translate to "Arc Monetization".
- Remove words that describe the 'kind of page' (video, recipe, guide, etc)
- Err on the side of keeping the subject, main verb, and direct object. Remove other parts of speech.

Return a response using JSON, according to this schema:
\`\`\`
{
    filtered: string // The title translated and filtered to remove the cruft. No word limit.
    rewritten: string // The title rewritten in 1-3 words
}
\`\`\`

Write responses (but not JSON keys) in English.`;

  const _prefBranch = (() => {
    try {
      return Cc["@mozilla.org/preferences-service;1"]
        .getService(Ci.nsIPrefService)
        .getBranch("");
    } catch (_) {
      return null;
    }
  })();

  /**
   * @param {string} prefName
   * @param {string|number|boolean} defaultValue
   */
  function getPref(prefName, defaultValue) {
    try {
      const branch = _prefBranch;
      if (!branch) return defaultValue;
      if (typeof defaultValue === "boolean") {
        return branch.getBoolPref(prefName, defaultValue);
      }
      if (typeof defaultValue === "string") {
        return branch.getStringPref(prefName, defaultValue);
      }
      if (typeof defaultValue === "number") {
        return branch.getIntPref(prefName, defaultValue);
      }
      return defaultValue;
    } catch (e) {
      console.error("[Rename Pinned Tab] getPref:", e);
      return defaultValue;
    }
  }

  /**
   * @param {boolean} debug
   * @returns {(msg: string, ...args: unknown[]) => void}
   */
  function createDebugLog(debug) {
    return (msg, ...args) => {
      if (debug) {
        console.log(`[Rename Pinned Tab] ${msg}`, ...args);
      }
    };
  }

  function redactSensitiveData(text) {
    if (typeof text !== "string") return String(text);
    return text.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").replace(/"Authorization"\s*:\s*"[^"]+"/gi, '"Authorization":"[REDACTED]"');
  }

  window.zenRenamePinnedTabsUtils = {
    MISTRAL_API_KEY_PREF,
    ENABLED_PREF,
    DEBUG_PREF,
    MODEL_PREF,
    REVERT_MODIFIER_PREF,
    MISTRAL_URL,
    PINNED_TAB_SYSTEM_PROMPT,
    getPref,
    createDebugLog,
    redactSensitiveData,
  };
})();
