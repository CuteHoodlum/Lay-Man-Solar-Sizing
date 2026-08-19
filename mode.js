/* mode.js — sole owner of Simple/Advanced mode state.
 *
 * Loaded via a plain <script src> placed immediately after the
 * #simple-mode / #advanced-mode markup in index.html, so it executes
 * synchronously as soon as the parser reaches that point — before
 * app.js, simple.js, or any DOMContentLoaded handler runs. That means
 * there is exactly one place that decides the initial mode, and it runs
 * before the rest of the page even finishes loading, so there is no
 * window in which the wrong mode could be visible.
 *
 * The default HTML markup already ships with #advanced-mode hidden and
 * the Simple Mode button marked active, so even with JavaScript
 * disabled entirely, Simple Mode is what a visitor sees — this script
 * only needs to *change* that when a returning visitor's stored
 * preference says otherwise.
 */

const MODE_STORAGE_KEY = "solarCalc.mode.v2";
const VALID_MODES = ["simple", "advanced"];

// NOTE: the previous, experimental preference key ("solarCalc.mode.v1")
// is intentionally NOT read or migrated here. Migrating it would let an
// old/experimental value silently force a returning visitor into
// Advanced Mode even though the product's intended default is
// beginner-first. If a user wants Advanced Mode again, one click saves
// it under the new v2 key. The old v1 key is simply ignored going
// forward (harmless leftover data, never consulted).
function resolveInitialMode(storageOverride) {
  const store =
    storageOverride || (typeof localStorage !== "undefined" ? localStorage : null);
  let stored = null;
  if (store) {
    try {
      stored = store.getItem(MODE_STORAGE_KEY);
    } catch (e) {
      stored = null;
    }
  }
  return VALID_MODES.includes(stored) ? stored : "simple";
}

// Applies the given mode to the DOM. Returns the mode actually applied
// (always a valid mode — an invalid input falls back to "simple").
function applyMode(mode, docOverride) {
  const doc = docOverride || (typeof document !== "undefined" ? document : null);
  const resolvedMode = VALID_MODES.includes(mode) ? mode : "simple";
  if (!doc) return resolvedMode;

  const simple = doc.getElementById("simple-mode");
  const advanced = doc.getElementById("advanced-mode");
  const simpleBtn = doc.getElementById("mode-simple-btn");
  const advancedBtn = doc.getElementById("mode-advanced-btn");
  const isSimple = resolvedMode === "simple";

  if (simple) simple.hidden = !isSimple;
  if (advanced) advanced.hidden = isSimple;
  if (simpleBtn) {
    simpleBtn.classList.toggle("active", isSimple);
    simpleBtn.setAttribute("aria-selected", String(isSimple));
  }
  if (advancedBtn) {
    advancedBtn.classList.toggle("active", !isSimple);
    advancedBtn.setAttribute("aria-selected", String(!isSimple));
  }

  return resolvedMode;
}

// Applies the mode AND persists it as the user's explicit preference.
// This is what the mode-toggle buttons call (onclick="setAppMode(...)").
function setAppMode(mode, storageOverride) {
  const store =
    storageOverride || (typeof localStorage !== "undefined" ? localStorage : null);
  const resolvedMode = applyMode(mode);
  if (store) {
    try {
      store.setItem(MODE_STORAGE_KEY, resolvedMode);
    } catch (e) {
      /* localStorage unavailable (private mode, quota) — mode still
         applies visually for this page view, just won't persist. */
    }
  }
  return resolvedMode;
}

// Deterministic, single-owner initial mode application. Uses applyMode
// (not setAppMode) so merely *loading* the page with an existing
// preference doesn't rewrite localStorage — only an explicit user click
// does that.
applyMode(resolveInitialMode());
