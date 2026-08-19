/* pwa.js — service worker registration, install prompt, and offline
 * status. Connectivity logic is written as small, dependency-injectable
 * functions (fetch/now overrides) so it can be unit-tested without a
 * real network — see tests/pwa.test.js.
 */

// ===================
// CONNECTIVITY STATUS
// ===================
// navigator.onLine only reflects the OS/network-interface state, not
// whether this app can actually reach anything — a captive portal or a
// dead upstream link can leave onLine === true while nothing loads. So
// on top of the online/offline events, we do a small same-origin HEAD
// request to verify real connectivity before hiding the banner.
const CONNECTIVITY_CHECK_URL = "manifest.json";
const CONNECTIVITY_CHECK_TIMEOUT_MS = 2500;
const CONNECTIVITY_CHECK_MIN_INTERVAL_MS = 5000;

let connectivityCheckInFlight = false;
let lastConnectivityCheckAt = -Infinity; // sentinel: "never checked yet" so the first call is never throttled, regardless of what Date.now() returns

function setOfflineBannerVisible(isOffline, docOverride) {
  const doc = docOverride || (typeof document !== "undefined" ? document : null);
  const banner = doc && doc.getElementById("offline-banner");
  if (!banner) return;
  banner.hidden = !isOffline;
}

// Resolves to true (online), false (offline), or null (skipped because
// a check is already in flight or the minimum interval hasn't passed —
// this is what prevents a request loop/hammering the network).
async function verifyConnectivity(options) {
  const opts = options || {};
  const doFetch = opts.fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  const now = typeof opts.now === "number" ? opts.now : Date.now();
  const doc = opts.docOverride;

  if (!doFetch) {
    setOfflineBannerVisible(true, doc);
    return false;
  }
  if (connectivityCheckInFlight) return null;
  if (now - lastConnectivityCheckAt < CONNECTIVITY_CHECK_MIN_INTERVAL_MS) return null;

  connectivityCheckInFlight = true;
  lastConnectivityCheckAt = now;

  let timeoutId = null;
  try {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    if (controller) {
      timeoutId = setTimeout(() => controller.abort(), CONNECTIVITY_CHECK_TIMEOUT_MS);
    }
    await doFetch(`${CONNECTIVITY_CHECK_URL}?ping=${now}`, {
      method: "HEAD",
      cache: "no-store",
      signal: controller ? controller.signal : undefined,
    });
    setOfflineBannerVisible(false, doc);
    return true;
  } catch (e) {
    // Fetch failing is the expected/normal case while offline — treat
    // it as a signal, not an error. Never let it surface in the
    // console or interrupt anything else on the page.
    setOfflineBannerVisible(true, doc);
    return false;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    connectivityCheckInFlight = false;
  }
}

// Exposed for tests to reset the module-level throttle state between cases.
function resetConnectivityCheckState() {
  connectivityCheckInFlight = false;
  lastConnectivityCheckAt = -Infinity;
}

function handleBrowserOffline() {
  setOfflineBannerVisible(true);
  // A genuine browser-reported offline transition is significant enough
  // that the *next* online check shouldn't be suppressed by the min-
  // interval throttle (which exists to stop rapid-fire polling, not to
  // block a real reconnect check that happens to land soon after the
  // last one — e.g. a brief Wi-Fi drop within 5s of page load).
  lastConnectivityCheckAt = -Infinity;
}

function handleBrowserOnline() {
  // The browser says we're back — verify with a real request before
  // trusting it enough to hide the banner.
  verifyConnectivity();
}

if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("online", handleBrowserOnline);
  window.addEventListener("offline", handleBrowserOffline);
}

if (typeof window !== "undefined" && window.addEventListener) {
  // Deliberately waits for the full `load` event (same timing as the
  // service worker registration below) rather than DOMContentLoaded —
  // running the connectivity probe while other render-blocking requests
  // (fonts, CDN assets) are still contending for the network made the
  // very-first check flaky in testing, aborting on its own timeout for
  // no real connectivity reason. By `load`, the page has already settled.
  window.addEventListener("load", () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setOfflineBannerVisible(true);
    } else {
      verifyConnectivity();
    }
  });
}

// ===================
// SERVICE WORKER REGISTRATION
// ===================
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

// ===================
// INSTALL PROMPT
// ===================
let deferredInstallPrompt = null;

function isIos() {
  return typeof window !== "undefined" && /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true)
  );
}

async function handleInstallClick() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    const btn = document.getElementById("install-app-btn");
    if (btn) btn.hidden = true;
    return;
  }
  if (isIos()) {
    alert('To install: tap the Share icon in Safari, then choose "Add to Home Screen."');
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById("install-app-btn");
    if (btn) btn.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    const btn = document.getElementById("install-app-btn");
    if (btn) btn.hidden = true;
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    if (isIos() && !isStandalone()) {
      const btn = document.getElementById("install-app-btn");
      if (btn) btn.hidden = false;
    }
  });
}
