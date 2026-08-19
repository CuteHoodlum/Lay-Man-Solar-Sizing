/* Tests for mode.js — the sole owner of Simple/Advanced mode state.
 * Run with `node tests/mode.test.js`.
 *
 * mode.js executes `applyMode(resolveInitialMode())` at load time, so
 * each test case loads a *fresh* vm context (fresh module state) with a
 * stub document/localStorage, mirroring a real fresh page load.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const modeJsSource = fs.readFileSync(path.join(__dirname, "..", "mode.js"), "utf8");

function makeFakeStorage(initial) {
  const store = { ...(initial || {}) };
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
    _dump: () => ({ ...store }),
  };
}

function makeFakeDoc() {
  const els = {};
  ["simple-mode", "advanced-mode", "mode-simple-btn", "mode-advanced-btn"].forEach((id) => {
    const el = { id, hidden: false, _classSet: {}, _attrs: {} };
    el.classList = {
      toggle(cls, on) {
        el._classSet[cls] = !!on;
      },
      contains(cls) {
        return !!el._classSet[cls];
      },
    };
    el.setAttribute = (k, v) => {
      el._attrs[k] = v;
    };
    el.getAttribute = (k) => el._attrs[k];
    els[id] = el;
  });
  return {
    getElementById: (id) => els[id] || null,
    _els: els,
  };
}

function loadModeJs(storage) {
  const sandbox = {
    document: makeFakeDoc(),
    localStorage: storage,
    window: {},
    console,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(modeJsSource, sandbox, { filename: "mode.js" });
  return sandbox;
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

function run(name, fn) {
  console.log(`\n--- ${name} ---`);
  fn();
}

// ===================
// resolveInitialMode / applyMode via fresh load (simulates real page load)
// ===================
run("No v2 preference -> Simple", () => {
  const storage = makeFakeStorage({});
  const sandbox = loadModeJs(storage);
  assert(sandbox.resolveInitialMode() === "simple", "resolveInitialMode() defaults to simple with no stored value");
  assert(sandbox.document._els["advanced-mode"].hidden === true, "advanced-mode is hidden on load with no preference");
  assert(sandbox.document._els["simple-mode"].hidden === false, "simple-mode is visible on load with no preference");
});

run("v2 = 'simple' -> Simple", () => {
  const storage = makeFakeStorage({ "solarCalc.mode.v2": "simple" });
  const sandbox = loadModeJs(storage);
  assert(sandbox.document._els["simple-mode"].hidden === false, "simple-mode visible");
  assert(sandbox.document._els["advanced-mode"].hidden === true, "advanced-mode hidden");
});

run("v2 = 'advanced' -> Advanced", () => {
  const storage = makeFakeStorage({ "solarCalc.mode.v2": "advanced" });
  const sandbox = loadModeJs(storage);
  assert(sandbox.document._els["advanced-mode"].hidden === false, "advanced-mode visible on load when v2=advanced");
  assert(sandbox.document._els["simple-mode"].hidden === true, "simple-mode hidden on load when v2=advanced");
});

run("Invalid v2 value -> Simple", () => {
  const storage = makeFakeStorage({ "solarCalc.mode.v2": "some-garbage-value" });
  const sandbox = loadModeJs(storage);
  assert(sandbox.document._els["simple-mode"].hidden === false, "garbage v2 value falls back to simple");
  assert(sandbox.document._els["advanced-mode"].hidden === true, "garbage v2 value keeps advanced hidden");
});

run("v1 alone (no v2) cannot force Advanced Mode", () => {
  // This is the exact scenario the previous report worried about: an old
  // experimental v1 value sitting in localStorage from before the v2 key
  // existed. It must be ignored entirely.
  const storage = makeFakeStorage({ "solarCalc.mode.v1": "advanced" });
  const sandbox = loadModeJs(storage);
  assert(sandbox.resolveInitialMode() === "simple", "v1=advanced with no v2 still resolves to simple");
  assert(sandbox.document._els["simple-mode"].hidden === false, "simple-mode visible despite stale v1=advanced");
  assert(sandbox.document._els["advanced-mode"].hidden === true, "advanced-mode hidden despite stale v1=advanced");
});

run("v1 present AND v2 present -> v2 wins", () => {
  const storage = makeFakeStorage({ "solarCalc.mode.v1": "advanced", "solarCalc.mode.v2": "simple" });
  const sandbox = loadModeJs(storage);
  assert(sandbox.document._els["simple-mode"].hidden === false, "v2=simple wins over stale v1=advanced");
});

// ===================
// setAppMode: explicit switch + persistence
// ===================
run("setAppMode('advanced') applies and persists under v2", () => {
  const storage = makeFakeStorage({});
  const sandbox = loadModeJs(storage);
  const resolved = sandbox.setAppMode("advanced");
  assert(resolved === "advanced", "setAppMode returns the resolved mode");
  assert(sandbox.document._els["advanced-mode"].hidden === false, "advanced-mode now visible after explicit switch");
  assert(storage.getItem("solarCalc.mode.v2") === "advanced", "v2 key persisted as 'advanced'");
});

run("setAppMode('simple') after 'advanced' switches back and persists", () => {
  const storage = makeFakeStorage({ "solarCalc.mode.v2": "advanced" });
  const sandbox = loadModeJs(storage);
  assert(sandbox.document._els["advanced-mode"].hidden === false, "starts in advanced (persisted)");
  sandbox.setAppMode("simple");
  assert(sandbox.document._els["simple-mode"].hidden === false, "switches back to simple");
  assert(storage.getItem("solarCalc.mode.v2") === "simple", "v2 key updated to 'simple'");
});

run("setAppMode with an invalid mode falls back to simple and persists 'simple'", () => {
  const storage = makeFakeStorage({});
  const sandbox = loadModeJs(storage);
  const resolved = sandbox.setAppMode("not-a-real-mode");
  assert(resolved === "simple", "invalid mode resolves to simple");
  assert(storage.getItem("solarCalc.mode.v2") === "simple", "invalid mode persists as simple, not garbage");
});

run("Simulated reload: setAppMode('advanced') then a fresh load reads it back", () => {
  const storage = makeFakeStorage({});
  const first = loadModeJs(storage);
  first.setAppMode("advanced");
  // Simulate a full page reload: new vm context, same underlying storage.
  const second = loadModeJs(storage);
  assert(second.document._els["advanced-mode"].hidden === false, "reload restores advanced mode from v2");
});

console.log(`\n============================`);
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("\nFailed assertions:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
} else {
  console.log("All mode.js tests passed.");
  process.exit(0);
}
