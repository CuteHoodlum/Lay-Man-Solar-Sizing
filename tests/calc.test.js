/* Lightweight test harness for the Simple Mode calculation engine
 * (computeSystem in ../simple.js). No test framework / build step —
 * run directly with `node tests/calc.test.js`.
 *
 * simple.js is written to run in a browser, so it references `document`
 * and `localStorage` at module load time (inside a DOMContentLoaded
 * listener). We load it into a vm context with minimal stubs for those
 * so the pure calculation functions (computeSystem, getScenario, etc.,
 * all plain `function` declarations) become callable from here without
 * needing a real DOM.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const simpleJsSource = fs.readFileSync(
  path.join(__dirname, "..", "simple.js"),
  "utf8"
);

const sandbox = {
  document: {
    addEventListener: () => {},
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
  window: {},
  console,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(simpleJsSource, sandbox, { filename: "simple.js" });

const { computeSystem } = sandbox;

// ===================
// Tiny assertion helpers
// ===================
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

function assertClose(actual, expected, tolerance, msg) {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${msg} (expected ~${expected}, got ${actual})`
  );
}

function assertFinitePositive(value, label) {
  assert(Number.isFinite(value) && value >= 0, `${label} should be a finite, non-negative number (got ${value})`);
}

function appliance(watts, qty, usageKey) {
  return { watts, qty, usageKey };
}

function run(name, fn) {
  console.log(`\n--- ${name} ---`);
  fn();
}

// ===================
// Scenario A: Small Home — lights, TV, fan, fridge
// ===================
run("A. Small Home", () => {
  const state = {
    scenarioId: "small-home",
    regionId: "us-south",
    assumptions: {},
    appliances: [
      appliance(9, 5, "evening"),   // LED bulbs
      appliance(100, 1, "evening"), // TV
      appliance(75, 2, "allday"),   // Fans
      appliance(150, 1, "allday"),  // Fridge
    ],
  };
  const r = computeSystem(state);

  const expectedDailyWh =
    9 * 5 * 4 + 100 * 1 * 4 + 75 * 2 * 24 + 150 * 1 * 24;
  assertClose(r.dailyWh, expectedDailyWh, 1, "daily Wh matches manual sum");
  assertFinitePositive(r.batteryKWh, "battery kWh");
  assertFinitePositive(r.solarArrayW, "solar array W");
  assertFinitePositive(r.inverterVA, "inverter VA");
  assertFinitePositive(r.controllerA, "controller A");
  assert(r.panelCount >= 1, "at least 1 panel recommended");
  assert(r.inverterVA >= r.peakLoadW, "inverter VA covers peak load with margin");
});

// ===================
// Scenario B: Medium Home — fridge, washer, router, TV, fans
// ===================
run("B. Medium Home", () => {
  const state = {
    scenarioId: "medium-home",
    regionId: "us-west",
    assumptions: {},
    appliances: [
      appliance(150, 1, "allday"),
      appliance(500, 1, "morning"),
      appliance(10, 1, "allday"),
      appliance(100, 2, "evening"),
      appliance(75, 3, "allday"),
    ],
  };
  const r = computeSystem(state);
  assertFinitePositive(r.dailyKWh, "daily kWh");
  assertFinitePositive(r.batteryKWh, "battery kWh");
  assertFinitePositive(r.solarArrayW, "solar array W");
  assert(r.systemVoltage === 48, "medium home defaults to 48V system");
});

// ===================
// Scenario C: High Load — AC, pump, microwave, multiple appliances
// ===================
run("C. High Load (shop/business)", () => {
  const state = {
    scenarioId: "shop",
    regionId: "middle-east",
    assumptions: {},
    appliances: [
      appliance(1500, 2, "afternoon"), // 2x AC
      appliance(750, 1, "morning"),    // pump
      appliance(1000, 1, "fewminutes"),// microwave
      appliance(100, 10, "evening"),   // lots of lighting
    ],
  };
  const r = computeSystem(state);
  assertFinitePositive(r.dailyKWh, "daily kWh");
  assertFinitePositive(r.inverterVA, "inverter VA");
  assert(r.inverterVA >= 4000, "high load should size a large inverter");
  assert(r.panelCount >= 5, "high load should need a meaningfully sized array");
});

// ===================
// Scenario D: Backup-only — night-only essential loads
// ===================
run("D. Backup-Only (night essentials)", () => {
  const state = {
    scenarioId: "backup",
    regionId: "uk-n-europe",
    assumptions: {},
    appliances: [
      appliance(150, 1, "allday"), // fridge (runs all day, most load at night)
      appliance(9, 6, "evening"),  // lights
      appliance(10, 1, "allday"),  // router
    ],
  };
  const r = computeSystem(state);
  assertFinitePositive(r.batteryKWh, "battery kWh");
  assert(r.autonomyDays === 1, "backup-only defaults to 1 day autonomy");
  assert(r.nightWh > 0, "backup scenario should have meaningful night load");
});

// ===================
// Scenario E: Off-Grid — high autonomy requirement
// ===================
run("E. Off-Grid (2-day autonomy)", () => {
  const state = {
    scenarioId: "off-grid",
    regionId: "w-africa",
    assumptions: {},
    appliances: [
      appliance(150, 1, "allday"),
      appliance(9, 8, "evening"),
      appliance(75, 2, "allday"),
      appliance(500, 1, "morning"),
    ],
  };
  const rOffGrid = computeSystem(state);
  assert(rOffGrid.autonomyDays === 2, "off-grid defaults to 2-day autonomy");

  const stateOneDay = { ...state, assumptions: { autonomyDays: 1 } };
  const rOneDay = computeSystem(stateOneDay);
  assert(
    rOffGrid.batteryKWh >= rOneDay.batteryKWh,
    "2-day autonomy battery should be >= 1-day autonomy battery for the same load"
  );
});

// ===================
// Scenario F: Stress test — large but valid load profile
// ===================
run("F. Stress Test (large valid load)", () => {
  const state = {
    scenarioId: "off-grid",
    regionId: "not-sure",
    assumptions: {},
    appliances: [
      appliance(3500, 1, "allday"),  // large AC, running continuously
      appliance(1500, 1, "allday"),  // heater
      appliance(1500, 2, "morning"),
      appliance(1000, 5, "evening"),
      appliance(150, 4, "allday"),
    ],
  };
  const r = computeSystem(state);
  ["dailyWh", "batteryKWh", "solarArrayW", "inverterVA", "controllerA", "panelCount"].forEach((key) => {
    assert(Number.isFinite(r[key]), `${key} is finite under stress load (got ${r[key]})`);
    assert(!Number.isNaN(r[key]), `${key} is not NaN under stress load`);
  });
  assert(r.panelCount < 1000, "panel count stays within a sane bound (no runaway math)");
});

// ===================
// Edge cases: zero / empty / no appliances
// ===================
run("Edge case: no appliances", () => {
  const state = { scenarioId: "small-home", regionId: "us-south", assumptions: {}, appliances: [] };
  const r = computeSystem(state);
  assert(r.dailyWh === 0, "zero appliances => zero daily energy");
  assert(!Number.isNaN(r.batteryKWh) && Number.isFinite(r.batteryKWh), "battery kWh finite with no load");
  assert(!Number.isNaN(r.solarArrayW) && Number.isFinite(r.solarArrayW), "solar array finite with no load");
  assert(r.panelCount >= 1, "panel count floors at 1 even with zero load");
  assert(r.inverterVA > 0, "inverter still returns a minimum standard size with zero load");
});

run("Edge case: zero watts / zero qty appliance", () => {
  const state = {
    scenarioId: "small-home",
    regionId: "us-south",
    assumptions: {},
    appliances: [appliance(0, 0, "evening"), appliance(NaN, 1, "evening")],
  };
  const r = computeSystem(state);
  assert(Number.isFinite(r.dailyWh) && !Number.isNaN(r.dailyWh), "NaN/zero-watt appliances don't poison total (dailyWh finite)");
  assert(Number.isFinite(r.batteryKWh), "battery kWh stays finite");
  assert(Number.isFinite(r.inverterVA), "inverter VA stays finite");
});

run("Edge case: negative watts/qty never produce negative or NaN output", () => {
  const state = {
    scenarioId: "small-home",
    regionId: "us-south",
    assumptions: {},
    appliances: [appliance(-500, -3, "evening"), appliance(100, 1, "evening")],
  };
  const r = computeSystem(state);
  assert(r.dailyWh >= 0, "daily Wh never goes negative from a bad row");
  assert(r.peakLoadW >= 0, "peak load never goes negative from a bad row");
  assertFinitePositive(r.batteryKWh, "battery kWh with a negative-input row");
  assertFinitePositive(r.inverterVA, "inverter VA with a negative-input row");
  // The negative row should be treated as 0, so results should match the
  // single valid 100W appliance alone.
  const solo = computeSystem({
    ...state,
    appliances: [appliance(100, 1, "evening")],
  });
  assertClose(r.dailyWh, solo.dailyWh, 0.01, "negative row contributes exactly 0, not a negative offset");
});

run("Edge case: tampered/out-of-range assumptions don't produce Infinity or negative results", () => {
  const state = {
    scenarioId: "off-grid",
    regionId: "not-sure",
    assumptions: { batteryDoD: -1, inverterEfficiency: 0, systemLosses: 0, sunHours: -5, safetyMargin: -2, systemVoltage: 0 },
    appliances: [appliance(500, 1, "allday")],
  };
  const r = computeSystem(state);
  ["dailyWh", "batteryKWh", "solarArrayW", "inverterVA", "controllerA", "systemVoltage", "sunHours"].forEach((key) => {
    assert(Number.isFinite(r[key]), `${key} finite even with hostile/zero/negative assumption overrides (got ${r[key]})`);
    assert(r[key] >= 0, `${key} non-negative even with hostile assumption overrides (got ${r[key]})`);
  });
});

run("Edge case: assumptions overridden to extremes don't produce Infinity", () => {
  const state = {
    scenarioId: "off-grid",
    regionId: "not-sure",
    assumptions: { batteryDoD: 0.5, inverterEfficiency: 0.8, systemLosses: 0.7, sunHours: 2.5, safetyMargin: 1.5 },
    appliances: [appliance(2000, 1, "allday")],
  };
  const r = computeSystem(state);
  ["dailyWh", "batteryKWh", "solarArrayW", "inverterVA", "controllerA"].forEach((key) => {
    assert(Number.isFinite(r[key]), `${key} finite with low sun-hours + tight assumptions`);
  });
});

// ===================
// Consistency: more appliances/hours never DECREASE recommendations
// ===================
run("Consistency: increasing load increases recommendations", () => {
  const base = {
    scenarioId: "medium-home",
    regionId: "us-south",
    assumptions: {},
    appliances: [appliance(100, 1, "evening")],
  };
  const more = {
    ...base,
    appliances: [appliance(100, 1, "evening"), appliance(1500, 1, "allday")],
  };
  const rBase = computeSystem(base);
  const rMore = computeSystem(more);
  assert(rMore.dailyKWh > rBase.dailyKWh, "adding a heavy appliance increases daily energy");
  assert(rMore.batteryKWh >= rBase.batteryKWh, "adding load doesn't decrease battery size");
  assert(rMore.solarArrayW >= rBase.solarArrayW, "adding load doesn't decrease solar array size");
  assert(rMore.inverterVA >= rBase.inverterVA, "adding load doesn't decrease inverter size");
});

// ===================
// Summary
// ===================
console.log(`\n============================`);
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("\nFailed assertions:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
} else {
  console.log("All calculation tests passed.");
  process.exit(0);
}
