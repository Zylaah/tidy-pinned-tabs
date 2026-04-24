// ==UserScript==
// @include   main
// @loadOrder 99999999999991
// @ignorecache
// ==/UserScript==

(function () {
  "use strict";

  if (location.href !== "chrome://browser/content/browser.xhtml") return;

  let _lastRequestAt = 0;
  const MIN_INTERVAL_MS = 800;

  /**
   * @param {string} raw
   * @returns {{ filtered?: string, rewritten?: string } | null}
   */
  function parseJsonResponse(raw) {
    if (!raw || typeof raw !== "string") return null;
    let s = raw.trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) s = fence[1].trim();
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      const obj = JSON.parse(s.slice(start, end + 1));
      if (obj && typeof obj.rewritten === "string") return obj;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * @param {object} deps
   * @param {typeof window.zenRenamePinnedTabsUtils} deps.utils
   */
  function createAiRename(deps) {
    const { utils } = deps;
    const {
      getPref,
      createDebugLog,
      redactSensitiveData,
      MISTRAL_API_KEY_PREF,
      MODEL_PREF,
      MISTRAL_URL,
      PINNED_TAB_SYSTEM_PROMPT,
      DEBUG_PREF,
    } = utils;

    /**
     * @param {object} params
     * @param {string} params.title
     * @param {string} params.url
     * @param {AbortSignal} [params.signal]
     * @returns {Promise<string | null>} Short label or null
     */
    async function getRewrittenTitle({ title, url, signal }) {
      const debug = getPref(DEBUG_PREF, false);
      const debugLog = createDebugLog(debug);

      const apiKey = getPref(MISTRAL_API_KEY_PREF, "");
      if (!apiKey || apiKey.length < 10) {
        console.warn("[Rename Pinned Tab] Missing or invalid Mistral API key");
        return null;
      }

      const now = Date.now();
      const wait = _lastRequestAt + MIN_INTERVAL_MS - now;
      if (wait > 0) {
        await new Promise(r => setTimeout(r, wait));
      }
      _lastRequestAt = Date.now();

      const userContent = `The page URL is: ${url}\nThe browser tab title is: ${title}\n\nRespond with only a single JSON object matching the schema (keys: filtered, rewritten). No markdown outside the JSON.`;

      const model = getPref(MODEL_PREF, "mistral-small-latest");

      try {
        const response = await fetch(MISTRAL_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: PINNED_TAB_SYSTEM_PROMPT },
              { role: "user", content: userContent },
            ],
            temperature: 0.2,
            max_tokens: 256,
          }),
          signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`HTTP ${response.status}: ${redactSensitiveData(errText)}`);
        }

        const data = await response.json();
        const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
        debugLog("Mistral raw:", raw);

        const parsed = parseJsonResponse(raw);
        if (!parsed?.rewritten) return null;

        let label = parsed.rewritten.replace(/^["'\s]+|["'\s]+$/g, "").trim();
        if (!label || label.length > 120) return null;
        return label;
      } catch (e) {
        const msg = e instanceof Error ? redactSensitiveData(e.message) : String(e);
        console.error("[Rename Pinned Tab] AI error:", msg);
        return null;
      }
    }

    return { getRewrittenTitle };
  }

  window.zenRenamePinnedTabsAi = { createAiRename };
})();
