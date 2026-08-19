/* Tests for pwa.js — connectivity-check logic behind the offline banner.
 * Run with `node tests/pwa.test.js`.
 *
 * fetch and Date.now() are injected explicitly into verifyConnectivity()
 * so these tests run with zero real network access.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const pwaJsSource = fs.readFileSync(path.join(__dirname, "..", "pwa.js"), "utf8");

function makeFakeBanner() {
  return { id: "offline-banner", hidden: true };
}

function makeSandbox() {
  const banner = makeFakeBanner();
  const listeners = { window: {}, document: {} };
  const doc = {
    getElementById: (id) => (id === "offline-banner" ? banner : null),
    addEventListener: (evt, fn) => {
      listeners.document[evt] = listeners.document[evt] || [];
      listeners.document[evt].push(fn);
    },
  };
  const win = {
    addEventListener: (evt, fn) => {
      listeners.window[evt] = listeners.window[evt] || [];
      listeners.window[evt].push(fn);
    },
    navigator: { onLine: true, userAgent: "test-agent" },
    matchMedia: () => ({ matches: false }),
  };
  const sandbox = {
    document: doc,
    window: win,
    navigator: win.navigator,
    console,
    setTimeout,
    clearTimeout,
    AbortController: typeof AbortController !== "undefined" ? AbortController : undefined,
  };
  sandbox.window = win;
  vm.createContext(sandbox);
  vm.runInContext(pwaJsSource, sandbox, { filename: "pwa.js" });
  return { sandbox, banner, listeners };
}

let pass = 0;
let fail = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(msg);
    console.log(`  FAIL: ${msg}`);
  }
}
const pendingRuns = [];
function run(name, fn) {
  pendingRuns.push(async () => {
    console.log(`\n--- ${name} ---`);
    await fn();
  });
}

// ===================
// Successful connectivity check hides the banner
// ===================
run("Successful fetch -> banner hidden (online)", async () => {
  const { sandbox, banner } = makeSandbox();
  sandbox.resetConnectivityCheckState();
  banner.hidden = false; // start "shown" to prove the check actually flips it

  const fakeFetch = async () => ({ ok: true });
  const result = await sandbox.verifyConnectivity({ fetchImpl: fakeFetch, now: 1000 });

  assert(result === true, "verifyConnectivity resolves true on a successful fetch");
  assert(banner.hidden === true, "banner is hidden after a successful connectivity check");
});

// ===================
// Failed connectivity check shows the banner, without throwing
// ===================
run("Failed fetch -> banner shown (offline), no throw", async () => {
  const { sandbox, banner } = makeSandbox();
  sandbox.resetConnectivityCheckState();
  banner.hidden = true;

  const fakeFetch = async () => {
    throw new Error("network error (expected/simulated, not a real failure)");
  };

  let threw = false;
  let result;
  try {
    result = await sandbox.verifyConnectivity({ fetchImpl: fakeFetch, now: 1000 });
  } catch (e) {
    threw = true;
  }
  assert(threw === false, "a failed fetch inside verifyConnectivity never throws/propagates");
  assert(result === false, "verifyConnectivity resolves false on a failed fetch");
  assert(banner.hidden === false, "banner is shown after a failed connectivity check");
});

// ===================
// Throttling: rapid repeated calls don't hammer the network
// ===================
run("Repeated calls within the min interval are throttled (no request loop)", async () => {
  const { sandbox } = makeSandbox();
  sandbox.resetConnectivityCheckState();
  let callCount = 0;
  const countingFetch = async () => {
    callCount++;
    return { ok: true };
  };

  await sandbox.verifyConnectivity({ fetchImpl: countingFetch, now: 1000 });
  const secondResult = await sandbox.verifyConnectivity({ fetchImpl: countingFetch, now: 1001 });
  const thirdResult = await sandbox.verifyConnectivity({ fetchImpl: countingFetch, now: 2000 });

  assert(callCount === 1, `fetch is only actually called once for rapid repeated invocations (got ${callCount} calls)`);
  assert(secondResult === null, "a call within the throttle window returns null (skipped), not a real result");
  assert(thirdResult === null, "2000 - 1000 = 1000ms is still within the 5000ms throttle window, so this is also skipped");
});

run("A call after the throttle window elapses performs a real check", async () => {
  const { sandbox } = makeSandbox();
  sandbox.resetConnectivityCheckState();
  let callCount = 0;
  const countingFetch = async () => {
    callCount++;
    return { ok: true };
  };

  await sandbox.verifyConnectivity({ fetchImpl: countingFetch, now: 1000 });
  const later = await sandbox.verifyConnectivity({ fetchImpl: countingFetch, now: 1000 + 5000 + 1 });

  assert(callCount === 2, `fetch is called again once the throttle window has passed (got ${callCount} calls)`);
  assert(later === true, "the post-throttle-window call returns a real result");
});

// ===================
// Browser online/offline events wire up correctly
// ===================
run("Browser 'offline' event shows the banner directly (no fetch needed)", () => {
  const { sandbox, banner, listeners } = makeSandbox();
  banner.hidden = true;
  const offlineHandlers = listeners.window.offline || [];
  assert(offlineHandlers.length > 0, "an 'offline' listener was registered on window");
  offlineHandlers.forEach((fn) => fn());
  assert(banner.hidden === false, "banner shows immediately on the browser's offline event");
});

run("Browser 'online' event triggers revalidation (not an instant hide)", async () => {
  const { sandbox, banner, listeners } = makeSandbox();
  sandbox.resetConnectivityCheckState();
  banner.hidden = false;

  // Monkey-patch global fetch inside the sandbox so the internal
  // (non-injected) call path used by the real event handler is exercised.
  sandbox.fetch = async () => ({ ok: true });

  const onlineHandlers = listeners.window.online || [];
  assert(onlineHandlers.length > 0, "an 'online' listener was registered on window");
  onlineHandlers.forEach((fn) => fn());
  // verifyConnectivity() is async/fire-and-forget from the event handler;
  // give its microtask queue a tick to settle.
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert(banner.hidden === true, "banner hides after the online event's revalidation succeeds");
});

run("Offline event resets the throttle so the next online check isn't suppressed", async () => {
  const { sandbox, banner, listeners } = makeSandbox();
  sandbox.resetConnectivityCheckState();

  // Prime the throttle with a "recent" check, as if the page just loaded.
  await sandbox.verifyConnectivity({ fetchImpl: async () => ({ ok: true }), now: 1000 });
  banner.hidden = true;

  // Browser reports offline shortly after (within the normal 5s throttle
  // window) -- this must show the banner AND clear the throttle so the
  // reconnect check that follows isn't silently skipped.
  (listeners.window.offline || []).forEach((fn) => fn());
  assert(banner.hidden === false, "banner shown immediately on the offline event");

  // Browser reports online again, just 1s later -- well within the 5s
  // window that would normally throttle a second check.
  const fastFetch = async () => ({ ok: true });
  const result = await sandbox.verifyConnectivity({ fetchImpl: fastFetch, now: 1500 });
  assert(result === true, "the post-offline-event online check is NOT throttled/skipped, even though it's within the normal window");
  assert(banner.hidden === true, "banner correctly hides once the post-offline reconnect check succeeds");
});

// ===================
// No fetch available at all (very old browser) degrades gracefully
// ===================
run("No fetch implementation available -> treated as offline, no throw", async () => {
  const { sandbox, banner } = makeSandbox();
  sandbox.resetConnectivityCheckState();
  banner.hidden = true;
  const result = await sandbox.verifyConnectivity({ fetchImpl: null, now: 1000 });
  assert(result === false, "no fetch available resolves false");
  assert(banner.hidden === false, "banner shown when connectivity can't even be checked");
});

(async () => {
  for (const runner of pendingRuns) {
    await runner();
  }

  console.log(`\n============================`);
  console.log(`Results: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log("\nFailed assertions:");
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  } else {
    console.log("All pwa.js tests passed.");
    process.exit(0);
  }
})();
