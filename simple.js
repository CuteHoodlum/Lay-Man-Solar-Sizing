/* simple.js — Simple Mode wizard: Scenario -> Location -> Appliances -> Usage -> Results
   Beginner-friendly layer on top of the existing Advanced calculator.
   No technical terms (VA, power factor, DoD, MPPT) are shown here — those
   live only in the "View assumptions & technical details" panel and in
   Advanced Mode. */

// ===================
// DATA
// ===================
const STORAGE_KEY = "solarCalc.state.v1";

const SIMPLE_HP_TO_W = 746;

const SCENARIOS = [
  { id: "small-home", label: "Home", icon: "fa-house", desc: "Power your everyday household appliances and lighting.", autonomyDays: 1, systemVoltage: 24 },
  { id: "medium-home", label: "Large Home", icon: "fa-house-chimney", desc: "Cover a bigger home with multiple rooms and appliances.", autonomyDays: 1, systemVoltage: 48 },
  { id: "office", label: "Office", icon: "fa-building", desc: "Keep computers, lighting, and office equipment running.", autonomyDays: 1, systemVoltage: 48 },
  { id: "shop", label: "Shop / Business", icon: "fa-store", desc: "Power retail equipment, lighting, and point-of-sale systems.", autonomyDays: 1, systemVoltage: 48 },
  { id: "backup", label: "Backup Power", icon: "fa-battery-half", desc: "Stay powered during outages while staying grid-connected.", autonomyDays: 1, systemVoltage: 48 },
  { id: "off-grid", label: "Off-Grid", icon: "fa-mountain-sun", desc: "Run entirely on solar — no utility connection at all.", autonomyDays: 2, systemVoltage: 48 },
  { id: "hybrid", label: "Hybrid Solar", icon: "fa-plug-circle-bolt", desc: "Use solar to cut your bill while staying connected to the grid.", autonomyDays: 1, systemVoltage: 48 },
];

const REGIONS = [
  { id: "us-southwest", label: "US Southwest (AZ, NV, NM)", sunHours: 6.5 },
  { id: "us-west", label: "US West Coast (CA)", sunHours: 5.5 },
  { id: "us-south", label: "US South (TX, FL, GA)", sunHours: 5.0 },
  { id: "us-midwest", label: "US Midwest", sunHours: 4.3 },
  { id: "us-northeast", label: "US Northeast", sunHours: 4.2 },
  { id: "us-pacific-nw", label: "US Pacific Northwest", sunHours: 3.6 },
  { id: "canada", label: "Canada (Southern)", sunHours: 3.8 },
  { id: "uk-n-europe", label: "UK & Northern Europe", sunHours: 3.0 },
  { id: "s-europe", label: "Southern Europe (Spain, Italy, Greece)", sunHours: 5.2 },
  { id: "middle-east", label: "Middle East (UAE, Saudi Arabia)", sunHours: 6.0 },
  { id: "n-africa", label: "North Africa (Egypt, Morocco)", sunHours: 6.2 },
  { id: "w-africa", label: "West Africa (Nigeria, Ghana)", sunHours: 5.0 },
  { id: "e-s-africa", label: "East & Southern Africa (Kenya, South Africa)", sunHours: 5.5 },
  { id: "south-asia", label: "South Asia (India, Pakistan, Bangladesh)", sunHours: 5.2 },
  { id: "se-asia", label: "Southeast Asia (Philippines, Indonesia, Vietnam)", sunHours: 4.5 },
  { id: "e-asia", label: "East Asia (China, Japan, South Korea)", sunHours: 4.0 },
  { id: "australia", label: "Australia", sunHours: 5.8 },
  { id: "south-america", label: "South America (Brazil, Argentina)", sunHours: 5.0 },
  { id: "central-america", label: "Central America & Caribbean", sunHours: 5.3 },
  { id: "not-sure", label: "Not sure / use a global average", sunHours: 4.5 },
];

const USAGE_PRESETS = {
  fewminutes: { label: "A few minutes", timeRange: "~30 minutes/day", hours: 0.5, dayHours: 0.4, nightHours: 0.1 },
  morning: { label: "Morning", timeRange: "6:00 AM – 9:00 AM", hours: 3, dayHours: 3, nightHours: 0 },
  afternoon: { label: "Afternoon", timeRange: "12:00 PM – 4:00 PM", hours: 4, dayHours: 4, nightHours: 0 },
  evening: { label: "Evening / Night", timeRange: "6:00 PM – 10:00 PM", hours: 4, dayHours: 0, nightHours: 4 },
  allday: { label: "All day", timeRange: "Runs continuously, 24 hours", hours: 24, dayHours: 12, nightHours: 12 },
};

const APPLIANCE_PRESETS = [
  { id: "led-bulb", name: "LED Light Bulb", icon: "fa-lightbulb", watts: 9, min: 5, max: 20, category: "Lighting", defaultQty: 5, defaultUsage: "evening" },
  { id: "television", name: "Television", icon: "fa-tv", watts: 100, min: 30, max: 400, category: "Entertainment", defaultQty: 1, defaultUsage: "evening" },
  { id: "fan", name: "Fan (standing/ceiling)", icon: "fa-fan", watts: 75, min: 30, max: 120, category: "Cooling", defaultQty: 2, defaultUsage: "allday" },
  { id: "air-conditioner", name: "Air Conditioner", icon: "fa-snowflake", watts: 1500, min: 900, max: 3500, category: "Cooling", defaultQty: 1, defaultUsage: "afternoon" },
  { id: "refrigerator", name: "Refrigerator", icon: "fa-kitchen-set", watts: 150, min: 100, max: 400, category: "Kitchen", defaultQty: 1, defaultUsage: "allday" },
  { id: "microwave", name: "Microwave", icon: "fa-square", watts: 1000, min: 600, max: 1500, category: "Kitchen", defaultQty: 1, defaultUsage: "fewminutes" },
  { id: "blender", name: "Blender", icon: "fa-blender", watts: 400, min: 200, max: 800, category: "Kitchen", defaultQty: 1, defaultUsage: "fewminutes" },
  { id: "dish-washer", name: "Dish Washer", icon: "fa-sink", watts: 1500, min: 1000, max: 2000, category: "Kitchen", defaultQty: 1, defaultUsage: "evening" },
  { id: "washing-machine", name: "Washing Machine", icon: "fa-shirt", watts: 500, min: 300, max: 1200, category: "Laundry", defaultQty: 1, defaultUsage: "morning" },
  { id: "iron", name: "Clothes Iron", icon: "fa-shirt", watts: 1000, min: 800, max: 1800, category: "Laundry", defaultQty: 1, defaultUsage: "fewminutes" },
  { id: "water-pump", name: "Water Pump", icon: "fa-faucet-drip", watts: 750, min: 350, max: 1500, category: "Other", defaultQty: 1, defaultUsage: "morning" },
  { id: "heater", name: "Water / Space Heater", icon: "fa-fire", watts: 2000, min: 1000, max: 3000, category: "Other", defaultQty: 1, defaultUsage: "evening" },
  { id: "laptop", name: "Laptop / Computer", icon: "fa-laptop", watts: 65, min: 30, max: 150, category: "Office", defaultQty: 1, defaultUsage: "allday" },
  { id: "wifi-router", name: "WiFi Router", icon: "fa-wifi", watts: 10, min: 5, max: 20, category: "Office", defaultQty: 1, defaultUsage: "allday" },
  { id: "phone-charger", name: "Phone Charger", icon: "fa-mobile-screen", watts: 10, min: 5, max: 20, category: "Office", defaultQty: 2, defaultUsage: "evening" },
  { id: "other", name: "Something else", icon: "fa-plug", watts: 100, min: 1, max: 5000, category: "Other", defaultQty: 1, defaultUsage: "evening", custom: true },
];

const DEFAULT_ASSUMPTIONS = {
  batteryDoD: 0.9, // usable fraction of battery capacity (lithium-ion)
  inverterEfficiency: 0.9, // AC power out vs DC power in
  systemLosses: 0.85, // wiring, temperature, dirt, mismatch derate on panels
  safetyMargin: 1.25, // extra headroom on inverter + panel sizing
  assumedPowerFactor: 0.9, // typical mix of resistive + motor loads
  panelWattage: 400, // Wp per panel used for the panel-count estimate
};

const SIMPLE_STANDARD_INVERTER_SIZES_VA = [
  500, 800, 1000, 1500, 2000, 2200, 2500, 3000, 3500, 4000, 4500, 5000, 5500,
  6000, 7500, 8000, 10000, 12000, 15000, 20000,
];

function pickStandardInverterVA(requiredVA) {
  for (const size of SIMPLE_STANDARD_INVERTER_SIZES_VA) {
    if (size >= requiredVA) return size;
  }
  return SIMPLE_STANDARD_INVERTER_SIZES_VA[SIMPLE_STANDARD_INVERTER_SIZES_VA.length - 1];
}

// ===================
// STATE
// ===================
function defaultState() {
  return {
    version: 1,
    step: "scenario",
    scenarioId: null,
    regionId: null,
    appliances: [], // { uid, presetId, name, watts, qty, usageKey }
    assumptions: { ...DEFAULT_ASSUMPTIONS },
    lastResult: null,
  };
}

let simpleState = defaultState();
let uidCounter = 1;

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(simpleState));
  } catch (e) {
    /* localStorage unavailable (private mode, quota) — silently skip persistence */
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

// ===================
// HELPERS
// ===================
const simpleToNumber = (v, d = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
};

function getScenario(id) {
  return SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
}
function getRegion(id) {
  return REGIONS.find((r) => r.id === id) || REGIONS[REGIONS.length - 1];
}
function getPreset(id) {
  return APPLIANCE_PRESETS.find((p) => p.id === id) || APPLIANCE_PRESETS[APPLIANCE_PRESETS.length - 1];
}

function fmt(n, decimals = 1) {
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(decimals);
}

// ===================
// CALCULATION ENGINE
// ===================
function computeSystem(state) {
  const scenario = getScenario(state.scenarioId);
  const region = getRegion(state.regionId);
  const a = { ...DEFAULT_ASSUMPTIONS, ...state.assumptions };

  // Defense-in-depth: clamp assumptions to physically sane ranges so a
  // corrupted localStorage value or a future "edit assumptions" UI can
  // never divide by zero or push a result negative/Infinite.
  a.batteryDoD = Math.min(1, Math.max(0.1, simpleToNumber(a.batteryDoD, DEFAULT_ASSUMPTIONS.batteryDoD)));
  a.inverterEfficiency = Math.min(1, Math.max(0.5, simpleToNumber(a.inverterEfficiency, DEFAULT_ASSUMPTIONS.inverterEfficiency)));
  a.systemLosses = Math.min(1, Math.max(0.3, simpleToNumber(a.systemLosses, DEFAULT_ASSUMPTIONS.systemLosses)));
  a.safetyMargin = Math.max(1, simpleToNumber(a.safetyMargin, DEFAULT_ASSUMPTIONS.safetyMargin));
  a.assumedPowerFactor = Math.min(1, Math.max(0.5, simpleToNumber(a.assumedPowerFactor, DEFAULT_ASSUMPTIONS.assumedPowerFactor)));
  a.panelWattage = Math.max(50, simpleToNumber(a.panelWattage, DEFAULT_ASSUMPTIONS.panelWattage));

  let dailyWh = 0;
  let dayWh = 0;
  let nightWh = 0;
  let peakLoadW = 0;

  state.appliances.forEach((item) => {
    const usage = USAGE_PRESETS[item.usageKey] || USAGE_PRESETS.evening;
    // Clamp to >= 0 so a stray negative or non-numeric input can never
    // pull the whole system's numbers negative or produce NaN downstream.
    const safeWatts = Math.max(0, simpleToNumber(item.watts));
    const safeQty = Math.max(0, simpleToNumber(item.qty, 1));
    const itemW = safeWatts * safeQty;
    peakLoadW += itemW;
    dailyWh += itemW * usage.hours;
    dayWh += itemW * usage.dayHours;
    nightWh += itemW * usage.nightHours;
  });

  const systemVoltage = Math.max(6, simpleToNumber(a.systemVoltage, scenario.systemVoltage) || scenario.systemVoltage);
  const autonomyDays = Math.max(0.5, simpleToNumber(a.autonomyDays, scenario.autonomyDays) || scenario.autonomyDays);
  const sunHours = Math.max(0.5, simpleToNumber(a.sunHours, region.sunHours) || region.sunHours);

  // Inverter: cover the worst case of everything running at once, with headroom.
  const inverterRequiredVA =
    (peakLoadW / a.assumedPowerFactor) * a.safetyMargin;
  const inverterVA = pickStandardInverterVA(inverterRequiredVA);

  // Battery: stores the night-time portion for the chosen number of backup days.
  const usableBatteryWh = nightWh * autonomyDays;
  const nominalBatteryWh = a.batteryDoD > 0 ? usableBatteryWh / a.batteryDoD : usableBatteryWh;
  const batteryWhWithLosses = a.inverterEfficiency > 0 ? nominalBatteryWh / a.inverterEfficiency : nominalBatteryWh;
  const batteryKWh = Math.max(0, Math.ceil((batteryWhWithLosses / 1000) * 2) / 2); // round up to nearest 0.5 kWh
  const batteryAh = systemVoltage > 0 ? (batteryKWh * 1000) / systemVoltage : 0;

  // Solar array: must cover total daily energy after conversion + derate losses,
  // spread across the available peak sun hours.
  const requiredPVWh =
    a.systemLosses > 0 && a.inverterEfficiency > 0
      ? dailyWh / (a.systemLosses * a.inverterEfficiency)
      : dailyWh;
  const requiredPVWattsRaw = sunHours > 0 ? requiredPVWh / sunHours : 0;
  const panelCount = Math.max(1, Math.ceil(requiredPVWattsRaw / a.panelWattage));
  const solarArrayW = panelCount * a.panelWattage;

  // Charge controller (for off-grid style charging, sized off the array).
  const controllerA = systemVoltage > 0 ? (solarArrayW / systemVoltage) * 1.25 : 0;
  const controllerType = solarArrayW > 1000 ? "MPPT" : "MPPT (or PWM for small systems)";

  return {
    scenario,
    region,
    assumptions: a,
    dailyWh,
    dailyKWh: dailyWh / 1000,
    dayWh,
    nightWh,
    peakLoadW,
    inverterRequiredVA,
    inverterVA,
    inverterKVA: inverterVA / 1000,
    autonomyDays,
    batteryKWh,
    batteryAh: Math.round(batteryAh),
    systemVoltage,
    sunHours,
    panelCount,
    panelWattage: a.panelWattage,
    solarArrayW,
    solarArrayKW: solarArrayW / 1000,
    controllerA: Math.round(controllerA),
    controllerType,
  };
}

// ===================
// VALIDATION
// ===================
function wattageWarning(preset, watts) {
  if (preset.custom) return null;
  const w = simpleToNumber(watts);
  if (w <= 0) return "Please enter a power value greater than 0.";
  if (w > 20000) return "That's higher than almost any home appliance — double check the number.";
  if (w < preset.min * 0.4 || w > preset.max * 2.5) {
    return `That looks unusual for a ${preset.name}. Typical is ${preset.min}–${preset.max}W — did you mean ${preset.watts}W?`;
  }
  return null;
}

function qtyWarning(qty) {
  const q = simpleToNumber(qty);
  if (!Number.isInteger(q) || q <= 0) return "Quantity must be a whole number of 1 or more.";
  if (q > 100) return "That's a lot of units — double check the quantity.";
  return null;
}

// ===================
// STEP DEFINITIONS
// ===================
const STEP_ORDER = ["scenario", "location", "appliances", "usage", "results"];
const STEP_LABELS = {
  scenario: "What are you sizing solar for?",
  location: "Where are you located?",
  appliances: "What do you want to run?",
  usage: "How often do you use them?",
  results: "Your Recommended Solar System",
};

function stepIndex(step) {
  return STEP_ORDER.indexOf(step);
}

function goToStep(step) {
  simpleState.step = step;
  saveState();
  renderSimpleMode();
  const heading = document.getElementById("wizard-heading");
  if (heading) heading.focus();
}

// ===================
// RENDERING
// ===================
function renderSimpleMode() {
  const root = document.getElementById("simple-mode");
  if (!root) return;

  const idx = stepIndex(simpleState.step);
  const isResults = simpleState.step === "results";

  const progressHtml = !isResults
    ? `
    <div class="wizard-progress" role="progressbar" aria-valuemin="1" aria-valuemax="${STEP_ORDER.length - 1}" aria-valuenow="${idx + 1}">
      ${STEP_ORDER.slice(0, -1)
        .map((s, i) => {
          const state = i < idx ? "done" : i === idx ? "active" : "";
          return `<div class="wizard-progress-step ${state}"><span class="wizard-progress-dot">${i < idx ? '<i class="fas fa-check"></i>' : i + 1}</span><span class="wizard-progress-label">${STEP_LABELS[s]}</span></div>`;
        })
        .join("")}
    </div>`
    : "";

  root.innerHTML = `
    ${progressHtml}
    <div class="wizard-card">
      <h2 id="wizard-heading" tabindex="-1" class="wizard-heading">${STEP_LABELS[simpleState.step]}</h2>
      <div id="wizard-step-body"></div>
    </div>
  `;

  const body = document.getElementById("wizard-step-body");
  switch (simpleState.step) {
    case "scenario":
      renderScenarioStep(body);
      break;
    case "location":
      renderLocationStep(body);
      break;
    case "appliances":
      renderAppliancesStep(body);
      break;
    case "usage":
      renderUsageStep(body);
      break;
    case "results":
      renderResultsStep(body);
      break;
  }
}

function renderScenarioStep(body) {
  body.innerHTML = `
    <p class="wizard-subtext">Choose the option that best matches how you plan to use solar power. You can change this later.</p>
    <div class="scenario-grid">
      ${SCENARIOS.map(
        (s) => `
        <button type="button" class="scenario-card ${s.id === simpleState.scenarioId ? "selected" : ""}" data-scenario="${s.id}">
          <i class="fas ${s.icon}"></i>
          <span class="scenario-label">${s.label}</span>
          <span class="scenario-desc">${s.desc}</span>
        </button>`
      ).join("")}
    </div>
    <div class="wizard-actions">
      <button type="button" class="btn btn-primary" id="scenario-next" ${simpleState.scenarioId ? "" : "disabled"}>
        Next <i class="fas fa-arrow-right"></i>
      </button>
    </div>
  `;

  body.querySelectorAll(".scenario-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      simpleState.scenarioId = btn.dataset.scenario;
      const scenario = getScenario(simpleState.scenarioId);
      simpleState.assumptions.autonomyDays = scenario.autonomyDays;
      simpleState.assumptions.systemVoltage = scenario.systemVoltage;
      saveState();
      renderSimpleMode();
    });
  });

  const nextBtn = document.getElementById("scenario-next");
  if (nextBtn) nextBtn.addEventListener("click", () => goToStep("location"));
}

function renderLocationStep(body) {
  body.innerHTML = `
    <p class="wizard-subtext">
      This tells us how much sunshine your panels can expect on an average day.
      Pick the closest match — you don't need to be exact.
    </p>
    <div class="input-group">
      <label for="region-select"><i class="fas fa-location-dot"></i> Region / Country</label>
      <select id="region-select" class="wizard-select">
        <option value="" disabled ${!simpleState.regionId ? "selected" : ""}>-- Select your region --</option>
        ${REGIONS.map(
          (r) =>
            `<option value="${r.id}" ${r.id === simpleState.regionId ? "selected" : ""}>${r.label}</option>`
        ).join("")}
      </select>
      <p class="field-hint" id="region-hint"></p>
    </div>
    <div class="wizard-actions">
      <button type="button" class="btn btn-secondary" id="location-back"><i class="fas fa-arrow-left"></i> Back</button>
      <button type="button" class="btn btn-primary" id="location-next" ${simpleState.regionId ? "" : "disabled"}>
        Next <i class="fas fa-arrow-right"></i>
      </button>
    </div>
  `;

  const select = document.getElementById("region-select");
  const hint = document.getElementById("region-hint");
  const nextBtn = document.getElementById("location-next");

  function updateHint() {
    const region = getRegion(select.value);
    if (select.value) {
      hint.textContent = `Average peak sun hours: about ${region.sunHours} hours/day.`;
    } else {
      hint.textContent = "";
    }
  }
  updateHint();

  select.addEventListener("change", () => {
    simpleState.regionId = select.value;
    saveState();
    nextBtn.disabled = !select.value;
    updateHint();
  });

  document.getElementById("location-back").addEventListener("click", () => goToStep("scenario"));
  nextBtn.addEventListener("click", () => goToStep("appliances"));
}

function makeApplianceItem(preset) {
  return {
    uid: uidCounter++,
    presetId: preset.id,
    name: preset.name,
    watts: preset.watts,
    qty: preset.defaultQty,
    usageKey: preset.defaultUsage,
  };
}

function liveDailyEstimateWh(appliances) {
  let total = 0;
  appliances.forEach((item) => {
    const usage = USAGE_PRESETS[item.usageKey] || USAGE_PRESETS.evening;
    total += simpleToNumber(item.watts) * simpleToNumber(item.qty, 1) * usage.hours;
  });
  return total;
}

function renderAppliancesStep(body) {
  const categories = [...new Set(APPLIANCE_PRESETS.map((p) => p.category))];
  const totalWh = liveDailyEstimateWh(simpleState.appliances);

  body.innerHTML = `
    <p class="wizard-subtext">Tap an appliance to add it. Add as many as you like — you can adjust quantity and power below.</p>

    <div class="appliance-picker">
      ${categories
        .map(
          (cat) => `
        <div class="appliance-category">
          <h3 class="appliance-category-title">${cat}</h3>
          <div class="appliance-chip-row">
            ${APPLIANCE_PRESETS.filter((p) => p.category === cat)
              .map(
                (p) => `
              <button type="button" class="appliance-chip" data-preset="${p.id}">
                <i class="fas ${p.icon}"></i> ${p.name}
              </button>`
              )
              .join("")}
          </div>
        </div>`
        )
        .join("")}
    </div>

    <div class="appliance-list" id="appliance-list" aria-live="polite">
      ${simpleState.appliances.length === 0 ? `<p class="empty-state">No appliances added yet. Tap one above to get started.</p>` : ""}
      ${simpleState.appliances.map((item) => renderApplianceRow(item)).join("")}
    </div>

    <div class="live-estimate" id="live-estimate">
      <i class="fas fa-bolt"></i>
      Estimated daily energy so far: <strong>${fmt(totalWh / 1000, 2)} kWh/day</strong>
    </div>

    <div class="wizard-actions">
      <button type="button" class="btn btn-secondary" id="appliances-back"><i class="fas fa-arrow-left"></i> Back</button>
      <button type="button" class="btn btn-primary" id="appliances-next" ${simpleState.appliances.length ? "" : "disabled"}>
        Next <i class="fas fa-arrow-right"></i>
      </button>
    </div>
  `;

  body.querySelectorAll(".appliance-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const preset = getPreset(chip.dataset.preset);
      simpleState.appliances.push(makeApplianceItem(preset));
      saveState();
      renderAppliancesStep(body);
    });
  });

  wireApplianceRows(body, renderAppliancesStep);

  document.getElementById("appliances-back").addEventListener("click", () => goToStep("location"));
  document.getElementById("appliances-next").addEventListener("click", () => goToStep("usage"));
}

function renderApplianceRow(item) {
  const preset = getPreset(item.presetId);
  const warning = wattageWarning(preset, item.watts) || qtyWarning(item.qty);
  return `
    <div class="appliance-row" data-uid="${item.uid}">
      <div class="appliance-row-main">
        <i class="fas ${preset.icon}"></i>
        <span class="appliance-row-name">${item.name}</span>
        <button type="button" class="remove-appliance-btn" data-remove="${item.uid}" aria-label="Remove ${item.name}">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="appliance-row-fields">
        <label class="appliance-field">
          <span>Quantity</span>
          <input type="number" min="1" step="1" class="appliance-qty" data-field="qty" data-uid="${item.uid}" value="${item.qty}" />
        </label>
        <label class="appliance-field">
          <span>Power (Watts)</span>
          <input type="number" min="0" step="1" class="appliance-watts" data-field="watts" data-uid="${item.uid}" value="${item.watts}" />
          ${!preset.custom ? `<span class="field-hint">Typical: ${preset.min}–${preset.max}W</span>` : ""}
        </label>
      </div>
      <details class="dont-know-details">
        <summary>I don't know the wattage</summary>
        <p>
          Check the label on the appliance or its plug — it usually lists Watts (W) or Amps (A × Volts = Watts).
          If you can't find it, leave the value as-is; we've filled in a typical estimate
          (${preset.min}–${preset.max}W for a ${preset.name.toLowerCase()}).
        </p>
      </details>
      ${warning ? `<p class="field-warning"><i class="fas fa-triangle-exclamation"></i> ${warning}</p>` : ""}
    </div>
  `;
}

function wireApplianceRows(body, rerender) {
  body.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("input", () => {
      const uid = parseInt(input.dataset.uid, 10);
      const item = simpleState.appliances.find((a) => a.uid === uid);
      if (!item) return;
      item[input.dataset.field] = input.value;
      saveState();

      const row = input.closest(".appliance-row");
      const preset = getPreset(item.presetId);
      const warning = wattageWarning(preset, item.watts) || qtyWarning(item.qty);
      let warnEl = row.querySelector(".field-warning");
      if (warning) {
        if (!warnEl) {
          warnEl = document.createElement("p");
          warnEl.className = "field-warning";
          row.appendChild(warnEl);
        }
        warnEl.innerHTML = `<i class="fas fa-triangle-exclamation"></i> ${warning}`;
      } else if (warnEl) {
        warnEl.remove();
      }

      const liveEl = document.getElementById("live-estimate");
      if (liveEl) {
        const totalWh = liveDailyEstimateWh(simpleState.appliances);
        liveEl.innerHTML = `<i class="fas fa-bolt"></i> Estimated daily energy so far: <strong>${fmt(totalWh / 1000, 2)} kWh/day</strong>`;
      }
    });
  });

  body.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const uid = parseInt(btn.dataset.remove, 10);
      simpleState.appliances = simpleState.appliances.filter((a) => a.uid !== uid);
      saveState();
      rerender(body);
    });
  });
}

function renderUsageStep(body) {
  if (simpleState.appliances.length === 0) {
    body.innerHTML = `<p class="empty-state">No appliances added yet.</p>
      <div class="wizard-actions">
        <button type="button" class="btn btn-secondary" id="usage-back"><i class="fas fa-arrow-left"></i> Back</button>
      </div>`;
    document.getElementById("usage-back").addEventListener("click", () => goToStep("appliances"));
    return;
  }

  const totalWh = liveDailyEstimateWh(simpleState.appliances);

  body.innerHTML = `
    <p class="wizard-subtext">For each appliance, pick when it's typically used during the day.</p>
    <div class="usage-list">
      ${simpleState.appliances
        .map((item) => {
          const preset = getPreset(item.presetId);
          return `
        <div class="usage-row" data-uid="${item.uid}">
          <div class="usage-row-title"><i class="fas ${preset.icon}"></i> ${item.name} <span class="usage-row-qty">(×${item.qty})</span></div>
          <div class="usage-chip-row" role="group" aria-label="Usage time for ${item.name}">
            ${Object.entries(USAGE_PRESETS)
              .map(
                ([key, u]) => `
              <button type="button" class="usage-chip ${item.usageKey === key ? "selected" : ""}" data-uid="${item.uid}" data-usage="${key}" title="${u.timeRange}">
                ${u.label}
                <span class="usage-chip-time">${u.timeRange}</span>
              </button>`
              )
              .join("")}
          </div>
        </div>`;
        })
        .join("")}
    </div>

    <div class="live-estimate" id="live-estimate">
      <i class="fas fa-bolt"></i>
      Estimated daily energy: <strong>${fmt(totalWh / 1000, 2)} kWh/day</strong>
    </div>

    <div class="wizard-actions">
      <button type="button" class="btn btn-secondary" id="usage-back"><i class="fas fa-arrow-left"></i> Back</button>
      <button type="button" class="btn btn-success btn-cta" id="usage-calculate">
        <i class="fas fa-calculator"></i> Calculate My Solar System
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </button>
    </div>
  `;

  body.querySelectorAll(".usage-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const uid = parseInt(chip.dataset.uid, 10);
      const item = simpleState.appliances.find((a) => a.uid === uid);
      if (!item) return;
      item.usageKey = chip.dataset.usage;
      saveState();

      body.querySelectorAll(`.usage-chip[data-uid="${uid}"]`).forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");

      const liveEl = document.getElementById("live-estimate");
      if (liveEl) {
        const total = liveDailyEstimateWh(simpleState.appliances);
        liveEl.innerHTML = `<i class="fas fa-bolt"></i> Estimated daily energy: <strong>${fmt(total / 1000, 2)} kWh/day</strong>`;
      }
    });
  });

  document.getElementById("usage-back").addEventListener("click", () => goToStep("appliances"));
  document.getElementById("usage-calculate").addEventListener("click", () => {
    simpleState.lastResult = computeSystem(simpleState);
    saveState();
    goToStep("results");
  });
}

function renderResultsStep(body) {
  const result = simpleState.lastResult || computeSystem(simpleState);
  const r = result;

  body.innerHTML = `
    <p class="wizard-subtext">Based on your scenario, location, and appliances, here's what we recommend:</p>

    <p class="estimate-disclaimer">
      <i class="fas fa-circle-info"></i>
      This is an estimate based on your inputs and standard solar assumptions.
      Final system design should be confirmed by a qualified installer.
    </p>

    <div class="results-grid">
      <div class="result-card">
        <i class="fas fa-solar-panel result-icon"></i>
        <h3>Solar Panels</h3>
        <div class="result-value">${r.panelCount} × ${r.panelWattage}W</div>
        <div class="result-sub">${fmt(r.solarArrayKW, 2)} kW total array</div>
      </div>
      <div class="result-card">
        <i class="fas fa-car-battery result-icon"></i>
        <h3>Battery</h3>
        <div class="result-value">${fmt(r.batteryKWh, 1)} kWh</div>
        <div class="result-sub">${r.batteryAh} Ah @ ${r.systemVoltage}V</div>
      </div>
      <div class="result-card">
        <i class="fas fa-microchip result-icon"></i>
        <h3>Inverter</h3>
        <div class="result-value">${fmt(r.inverterKVA, 1)} kW</div>
        <div class="result-sub">${r.inverterVA.toLocaleString()} VA</div>
      </div>
      <div class="result-card">
        <i class="fas fa-chart-line result-icon"></i>
        <h3>Daily Energy Need</h3>
        <div class="result-value">${fmt(r.dailyKWh, 2)} kWh/day</div>
        <div class="result-sub">${Math.round(r.peakLoadW)}W peak load</div>
      </div>
      <div class="result-card">
        <i class="fas fa-wave-square result-icon"></i>
        <h3>Charge Controller</h3>
        <div class="result-value">${r.controllerA} A</div>
        <div class="result-sub">${r.controllerType}</div>
      </div>
      <div class="result-card">
        <i class="fas fa-bolt result-icon"></i>
        <h3>System Voltage</h3>
        <div class="result-value">${r.systemVoltage}V</div>
        <div class="result-sub">Battery bank voltage</div>
      </div>
    </div>

    <div class="why-section">
      <h3><i class="fas fa-circle-question"></i> Why this system?</h3>
      <p>
        Your appliances use about <strong>${fmt(r.dailyKWh, 2)} kWh</strong> per day. Of that,
        about <strong>${fmt(r.nightWh / 1000, 2)} kWh</strong> happens after dark, so we sized a
        <strong>${fmt(r.batteryKWh, 1)} kWh battery</strong> to store enough power for
        ${r.autonomyDays} day${r.autonomyDays > 1 ? "s" : ""} of night-time use.
        With an average of <strong>${fmt(r.sunHours, 1)} peak sun hours</strong> in your area,
        <strong>${r.panelCount} solar panels</strong> (${r.panelWattage}W each) should generate enough
        energy on a typical day to cover your usage and recharge the battery.
        Your appliances can draw up to <strong>${Math.round(r.peakLoadW)}W</strong> at once, so we
        sized the inverter at <strong>${r.inverterVA.toLocaleString()}VA</strong> to comfortably handle
        that with room to spare.
      </p>
    </div>

    <details class="assumptions-details">
      <summary><i class="fas fa-list-check"></i> View assumptions &amp; technical details</summary>
      <div class="assumptions-body">
        <table class="assumptions-table">
          <tbody>
            <tr><td>Peak sun hours</td><td>${fmt(r.sunHours, 1)} h/day</td></tr>
            <tr><td>Battery depth of discharge (DoD)</td><td>${Math.round(r.assumptions.batteryDoD * 100)}%</td></tr>
            <tr><td>Inverter efficiency</td><td>${Math.round(r.assumptions.inverterEfficiency * 100)}%</td></tr>
            <tr><td>System losses (wiring, heat, dirt)</td><td>${Math.round((1 - r.assumptions.systemLosses) * 100)}%</td></tr>
            <tr><td>Autonomy / backup days</td><td>${r.autonomyDays} day(s)</td></tr>
            <tr><td>Safety margin (inverter &amp; array)</td><td>+${Math.round((r.assumptions.safetyMargin - 1) * 100)}%</td></tr>
            <tr><td>Assumed power factor</td><td>${r.assumptions.assumedPowerFactor}</td></tr>
            <tr><td>System voltage</td><td>${r.systemVoltage}V DC</td></tr>
            <tr><td>Day-time energy use</td><td>${fmt(r.dayWh / 1000, 2)} kWh/day</td></tr>
            <tr><td>Night-time energy use</td><td>${fmt(r.nightWh / 1000, 2)} kWh/day</td></tr>
          </tbody>
        </table>
        <p class="field-hint">
          Want to fine-tune these numbers yourself? Switch to
          <strong>Advanced / Installer Mode</strong> above for full control over every
          assumption, plus detailed load-table, apparent power, and inverter database search.
        </p>
      </div>
    </details>

    <div class="wizard-actions results-actions">
      <button type="button" class="btn btn-secondary" id="results-edit"><i class="fas fa-arrow-left"></i> Edit Inputs</button>
      <button type="button" class="btn btn-secondary" id="results-print"><i class="fas fa-print"></i> Print / Save PDF</button>
      <button type="button" class="btn btn-secondary" id="results-share"><i class="fas fa-share-nodes"></i> Share</button>
      <button type="button" class="btn btn-primary" id="results-restart"><i class="fas fa-rotate"></i> Start Again</button>
    </div>

    <div class="install-promo" id="install-promo" hidden>
      <i class="fas fa-mobile-screen-button"></i>
      <span>Want to keep this calculator on your phone?</span>
      <button type="button" class="install-app-btn install-app-btn--promoted" onclick="handleInstallClick()">
        <i class="fas fa-download"></i> Install the App
      </button>
    </div>
  `;

  const installBtnTopBar = document.getElementById("install-app-btn");
  const installPromo = document.getElementById("install-promo");
  if (installPromo && installBtnTopBar && !installBtnTopBar.hidden) {
    installPromo.hidden = false;
  }

  document.getElementById("results-edit").addEventListener("click", () => goToStep("usage"));
  document.getElementById("results-print").addEventListener("click", () => window.print());
  document.getElementById("results-share").addEventListener("click", async () => {
    const shareText =
      `My recommended solar system: ${r.panelCount} x ${r.panelWattage}W panels, ` +
      `${fmt(r.batteryKWh, 1)} kWh battery, ${fmt(r.inverterKVA, 1)} kW inverter ` +
      `(${fmt(r.dailyKWh, 2)} kWh/day usage). Estimated with the Solar Sizing Calculator.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "My Recommended Solar System", text: shareText });
      } catch (e) {
        /* user cancelled the share sheet — nothing to do */
      }
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(shareText);
        alert("Summary copied to clipboard — paste it wherever you'd like to share it.");
        return;
      } catch (e) {
        /* clipboard blocked — fall through to the print fallback */
      }
    }
    window.print();
  });
  document.getElementById("results-restart").addEventListener("click", () => {
    if (!confirm("Start a new calculation? This will clear your current appliances.")) return;
    simpleState = defaultState();
    saveState();
    renderSimpleMode();
  });
}

// ===================
// INIT
// ===================
document.addEventListener("DOMContentLoaded", () => {
  const saved = loadState();
  if (saved) {
    simpleState = saved;
    const maxUid = simpleState.appliances.reduce((m, a) => Math.max(m, a.uid || 0), 0);
    uidCounter = maxUid + 1;
    if (!STEP_ORDER.includes(simpleState.step)) simpleState.step = "scenario";
  }
  renderSimpleMode();
});
