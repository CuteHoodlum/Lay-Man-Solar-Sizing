/* solar.js — complete version with desktop + mobile sync, day/night banks */

// ===================
// GLOBAL STATE
// ===================
let stepProgress = 1;

// energy banks (Wh per day)
let dayEnergyWh = 0;    // handled directly by PV in daytime
let nightEnergyWh = 0;  // supplied via battery at night

// derived selections
let calculatedInverterKVA = 0;     // computed after inverter sizing (VA → kVA)
let calculatedSystemVoltage = 48;  // default; user can change in Inverter section
let selectedInverter = null;

// ===================
// HELPERS
// ===================
const HP_TO_W = 746;

const clampPF = (pf) => {
  const n = parseFloat(pf);
  if (!Number.isFinite(n)) return 0.9;
  return Math.min(1, Math.max(0.1, n));
};

const toNumber = (v, d = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
};

const toggleBtn = (btn, on) => {
  if (!btn) return;
  btn.disabled = !on;
  btn.style.opacity = on ? "1" : "0.5";
  btn.style.cursor = on ? "pointer" : "not-allowed";
};

// ===================
// Helper:  "Add Inverter / Battery / Panel" buttons below the last added section
// ===================

// NEW: global helper – reuse everywhere
function showAllActionButtons() {
  ["add-inverter", "add-battery", "add-panel"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.style.display = "inline-flex";
      btn.disabled = false;
    }
  });
}

function moveActionButtonsBelow(lastSectionContainer) {
  const actionButtons = document.querySelector(".action-buttons"); // make sure your HTML has this class
  if (!actionButtons || !lastSectionContainer || !lastSectionContainer.parentNode) return;

  // Remove from current position
  if (actionButtons.parentNode) {
    actionButtons.parentNode.removeChild(actionButtons);
  }

  // Insert after the container of the last added section
  lastSectionContainer.parentNode.insertBefore(
    actionButtons,
    lastSectionContainer.nextSibling
  );

  // Optional: If you want to hide all buttons after panel is added
  if (
    lastSectionContainer.id === "panel-container" &&
    lastSectionContainer.children.length > 0
  ) {
    actionButtons.style.display = "none";
  }
}

function moveActionButtonsToOriginalPosition() {
  const actionButtons = document.querySelector(".action-buttons");
  if (!actionButtons) return;

  // Remove from wherever it is right now
  if (actionButtons.parentNode) {
    actionButtons.parentNode.removeChild(actionButtons);
  }

  // MOBILE: Put buttons directly after Load Summary
  if (window.innerWidth <= 768) {
    const loadSummary = document.getElementById("load-summary");
    if (loadSummary && loadSummary.parentNode) {
      loadSummary.parentNode.insertBefore(actionButtons, loadSummary.nextSibling);
    }
  } else {
    // DESKTOP: Before inverter container
    const inverterContainer = document.getElementById("inverter-container");
    if (inverterContainer && inverterContainer.parentNode) {
      inverterContainer.parentNode.insertBefore(actionButtons, inverterContainer);
    }
  }

  actionButtons.style.display = "flex";

  updateActionButtonsVisibility();
}

// ===================
// PRESET POWER FACTORS & UNITS
// ===================
const powerFactors = {
  "led-bulb": 0.95,
  television: 0.93,
  fan: 0.85,
  "air-conditioner": 0.9,
  refrigerator: 0.85,
  blender: 0.8,
  "dish-washer": 0.88,
  "washing-machine": 0.85,
  "water-pump": 0.8,
  heater: 1.0,
  other: 0.8,
};

// Appliances usually in horsepower
const hpAppliances = new Set(["water-pump", "air-conditioner"]);

function getPresetPF(appliance) {
  const pf = powerFactors[appliance];
  return Number.isFinite(pf) ? pf : 0.9;
}

function applyPowerUnitForApplianceRow(row) {
  const sel = row.querySelector(".gadget-description");
  const unitSelect = row.querySelector(".power-type");
  const powerInput = row.querySelector(".watts");
  if (!sel || !unitSelect || !powerInput) return;

  const appliance = sel.value;
  if (hpAppliances.has(appliance)) {
    unitSelect.value = "hp";
    powerInput.placeholder = "Enter power (hp)";
  } else {
    unitSelect.value = "w";
    powerInput.placeholder = "Enter power (W)";
  }
}

function applyPresetPFToRow(row) {
  const sel = row.querySelector(".gadget-description");
  const pfInput = row.querySelector(".power-factor");
  if (!sel || !pfInput) return;

  const val = sel.value;
  if (!val) return;

  if (val === "other") {
    pfInput.readOnly = false;
    pfInput.placeholder = "0.80";
    if (!pfInput.value) pfInput.value = getPresetPF(val).toFixed(2);
  } else {
    pfInput.value = getPresetPF(val).toFixed(2);
    pfInput.readOnly = true;
  }
}

function applyPresetPFToCard(card) {
  const sel = card.querySelector(".gadget-description");
  const pfInput = card.querySelector(".power-factor");
  if (!sel || !pfInput) return;

  const val = sel.value;
  if (!val) return;

  if (val === "other") {
    pfInput.readOnly = false;
    pfInput.placeholder = "0.80";
    if (!pfInput.value) pfInput.value = getPresetPF(val).toFixed(2);
  } else {
    pfInput.value = getPresetPF(val).toFixed(2);
    pfInput.readOnly = true;
  }
}

function applyPowerUnitForApplianceCard(card) {
  const sel = card.querySelector(".gadget-description");
  const unitSelect = card.querySelector(".power-type");
  const powerInput = card.querySelector(".watts");
  if (!sel || !unitSelect || !powerInput) return;

  const appliance = sel.value;
  if (hpAppliances.has(appliance)) {
    unitSelect.value = "hp";
    powerInput.placeholder = "Enter power (hp)";
  } else {
    unitSelect.value = "w";
    powerInput.placeholder = "Enter power (W)";
  }
}

// ===================
// PROGRESS / BUTTONS
// ===================
function updateProgress(newStep) {
  stepProgress = Math.max(stepProgress, newStep);
  updateProgressIndicator();
  updateButtonStates();
}

function updateProgressIndicator() {
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById(`step-${i}`);
    if (!step) continue;
    step.classList.remove("active", "completed");
    if (i < stepProgress) step.classList.add("completed");
    else if (i === stepProgress) step.classList.add("active");
  }
  updateButtonStates();
}

function updateButtonStates() {
  const addInverterBtn = document.getElementById("add-inverter");
  const addBatteryBtn = document.getElementById("add-battery");
  const addPanelBtn = document.getElementById("add-panel");

  const inverterContainer = document.getElementById("inverter-container");
  const batteryContainer = document.getElementById("battery-container");

  const inverterExists = inverterContainer
    ? inverterContainer.children.length > 0
    : false;
  const batteryExists = batteryContainer
    ? batteryContainer.children.length > 0
    : false;

  toggleBtn(addInverterBtn, stepProgress >= 2);
  toggleBtn(addBatteryBtn, stepProgress >= 3 && inverterExists);
  toggleBtn(addPanelBtn, stepProgress >= 4 && batteryExists);
}

// Controls visibility of Add Inverter / Add Battery / Add Panel
function updateActionButtonsVisibility() {
  const addInverterBtn = document.getElementById("add-inverter");
  const addBatteryBtn = document.getElementById("add-battery");
  const addPanelBtn = document.getElementById("add-panel");

  const inverterExists =
    document.getElementById("inverter-container")?.children.length > 0;
  const batteryExists =
    document.getElementById("battery-container")?.children.length > 0;
  const panelExists =
    document.getElementById("panel-container")?.children.length > 0;

  // Inverter: show only if none exists
  if (addInverterBtn) {
    addInverterBtn.style.display = inverterExists ? "none" : "inline-flex";
    addInverterBtn.disabled = false;
  }

  // Battery: show only if inverter exists AND no battery yet
  if (addBatteryBtn) {
    addBatteryBtn.style.display =
      !inverterExists || batteryExists ? "none" : "inline-flex";
    addBatteryBtn.disabled = false;
  }

  // Panel: show only if battery exists AND no panel yet
  if (addPanelBtn) {
    addPanelBtn.style.display =
      !batteryExists || panelExists ? "none" : "inline-flex";
    addPanelBtn.disabled = false;
  }
}

// ===================
// DESKTOP MULTI–TIME–BLOCKS
// ===================
function initMultiTimeBlocks(row) {
  const container = row.querySelector(".multi-time-blocks");
  if (!container || container._init) return;
  container._init = true;

  const totalDisplay = container.querySelector(".total-h");
  const hiddenHoursInput = container.querySelector(".hours");

  function calculateTotalHours() {
    let total = 0;
    container.querySelectorAll(".time-block").forEach((block) => {
      const start = block.querySelector(".start-time")?.value;
      const end = block.querySelector(".end-time")?.value;
      if (!start || !end) return;

      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      let s = sh + sm / 60;
      let e = eh + em / 60;
      if (e < s) e += 24;
      const h = e - s;
      if (h > 0) total += h;
    });

    const rounded = Math.round(total * 10) / 10;
    if (totalDisplay) totalDisplay.textContent = rounded.toFixed(1);
    if (hiddenHoursInput) hiddenHoursInput.value = rounded.toFixed(1);
  }

  const addBtn = container.querySelector(".add-block-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const block = document.createElement("div");
      block.className = "time-block";
      block.innerHTML = `
        <input type="time" class="start-time" value="08:00">
        <span>–</span>
        <input type="time" class="end-time" value="09:00">
        <button type="button" class="remove-block">×</button>
      `;
      container.insertBefore(block, addBtn);

      block
        .querySelectorAll("input[type='time']")
        .forEach((i) => i.addEventListener("change", calculateTotalHours));

      block
        .querySelector(".remove-block")
        .addEventListener("click", () => {
          block.remove();
          calculateTotalHours();
        });

      calculateTotalHours();
    });
  }

  container.addEventListener("click", (e) => {
    if (!e.target.classList.contains("remove-block")) return;
    const block = e.target.closest(".time-block");
    if (!block) return;
    block.remove();
    calculateTotalHours();
  });

  container
    .querySelectorAll(".time-block input[type='time']")
    .forEach((i) => i.addEventListener("change", calculateTotalHours));

  calculateTotalHours();
}

// Appliance realistic usage presets
const appliancePresets = {
  "led-bulb": { blocks: [["18:00", "22:00"]] },
  television: { blocks: [["19:00", "23:00"]] },
  fan: { blocks: [["20:00", "23:00"], ["06:00", "08:00"]] },
  "air-conditioner": { blocks: [["12:00", "18:00"]] },
  refrigerator: { blocks: [["00:00", "23:59"]] },
  blender: { blocks: [["07:00", "07:30"], ["18:00", "18:30"]] },
  "dish-washer": { blocks: [["20:00", "21:30"]] },
  "washing-machine": { blocks: [["09:00", "10:30"]] },
  "water-pump": { blocks: [["06:00", "07:00"], ["17:00", "18:00"]] },
  heater: { blocks: [["05:00", "07:00"], ["20:00", "22:00"]] },
  other: { blocks: [["08:00", "17:00"]] },
};

function initAppliancePreset(row) {
  const select = row.querySelector(".gadget-description");
  const container = row.querySelector(".multi-time-blocks");
  if (!select || !container) return;

  select.addEventListener("change", () => {
    const preset = appliancePresets[select.value];
    if (!preset || !preset.blocks?.length) return;

    const blocks = container.querySelectorAll(".time-block");
    blocks.forEach((b, i) => {
      if (i > 0) b.remove();
    });

    const firstBlock = container.querySelector(".time-block");
    if (!firstBlock) return;

    firstBlock.querySelector(".start-time").value = preset.blocks[0][0];
    firstBlock.querySelector(".end-time").value = preset.blocks[0][1];

    for (let i = 1; i < preset.blocks.length; i++) {
      const newBlock = document.createElement("div");
      newBlock.className = "time-block";
      newBlock.innerHTML = `
        <input type="time" class="start-time" value="${preset.blocks[i][0]}">
        <span>–</span>
        <input type="time" class="end-time" value="${preset.blocks[i][1]}">
        <button type="button" class="remove-block">×</button>
      `;
      container.insertBefore(newBlock, container.querySelector(".add-block-btn"));
    }

    initMultiTimeBlocks(row);
  });
}

// ===================
// MOBILE CARDS
// ===================
function syncTableToCards() {
  const mobileContainer = document.getElementById("mobile-card-container");
  const tableRows = document.querySelectorAll("#item-container .item-row");
  if (!mobileContainer) return;

  mobileContainer.innerHTML = "";
  tableRows.forEach((row, index) => {
    row.dataset.rowIndex = index;
    const card = createMobileCard(row, index);
    mobileContainer.appendChild(card);
    initMobileTimeBlocks(card, row);
  });
}

function createMobileCard(tableRow, index) {
  const card = document.createElement("div");
  card.className = "appliance-card";
  card.dataset.rowIndex = index;

  const descSel = tableRow.querySelector(".gadget-description");
  const description = descSel?.value || `Appliance ${index + 1}`;
  const quantity = tableRow.querySelector(".quantity-input").value;
  const watts = tableRow.querySelector(".watts").value;
  const powerType = tableRow.querySelector(".power-type")?.value || "w";
  const powerFactor = tableRow.querySelector(".power-factor").value;
  const hours = tableRow.querySelector(".hours").value;
  const totalWatts = tableRow.querySelector(".total-watts").value;
  const apparentPower = tableRow.querySelector(".apparent-power").value;
  const apparentPowerHour =
    tableRow.querySelector(".apparent-power-hour").value;
  const totalWattsHour = tableRow.querySelector(".total-watts-hour").value;

  const descOptionsHTML = descSel
    ? descSel.innerHTML
    : `
      <option value="" disabled>-- Select an Appliance --</option>
      <option value="other">Other</option>
    `;

  // Build time-slot markup from the desktop row's multi-time-blocks if present
  let timeBlocksMarkup = "";
  const mtb = tableRow.querySelector(".multi-time-blocks");
  if (mtb) {
    const blocks = mtb.querySelectorAll(".time-block");
    if (blocks.length > 0) {
      blocks.forEach((block, i) => {
        const sVal = block.querySelector(".start-time")?.value || "18:00";
        const eVal = block.querySelector(".end-time")?.value || "22:00";
        const showRemove = i === 0 ? 'style="display:none;"' : "";
        timeBlocksMarkup += `
          <div class="time-block">
            <input type="time" class="start-time" value="${sVal}">
            <span>–</span>
            <input type="time" class="end-time" value="${eVal}">
            <button type="button" class="remove-block" ${showRemove}>×</button>
          </div>
        `;
      });
    }
  }

  if (!timeBlocksMarkup) {
    timeBlocksMarkup = `
      <div class="time-block">
        <input type="time" class="start-time" value="18:00">
        <span>–</span>
        <input type="time" class="end-time" value="22:00">
        <button type="button" class="remove-block" style="display:none;">×</button>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">
        <i class="fas fa-plug"></i>
        <span class="card-appliance-name">${description || "Appliance"}</span>
      </div>
      <button class="remove-btn" onclick="removeInput(this)">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="card-field">
      <label><i class="fas fa-tag"></i> Appliance</label>
      <select class="gadget-description" onchange="syncCardToTable(this)">
        ${descOptionsHTML}
      </select>
    </div>

    <div class="card-field">
      <label><i class="fas fa-hashtag"></i> Quantity</label>
      <input type="number" class="quantity-input" min="0" step="1" placeholder="5"
             value="${quantity}" oninput="syncCardToTable(this)" />
    </div>

    <div class="card-field">
      <label><i class="fas fa-bolt"></i> Watts / hp</label>
      <div class="input-select-cell">
        <input type="number" class="watts" min="0" step="0.1" placeholder="10"
               value="${watts}" oninput="syncCardToTable(this)" />
        <select class="power-type" onchange="syncCardToTable(this)">
          <option value="w"  ${powerType === "w" ? "selected" : ""}>w</option>
          <option value="hp" ${powerType === "hp" ? "selected" : ""}>hp</option>
        </select>
      </div>
    </div>

    <div class="card-field" style="display:none;">
      <label><i class="fas fa-wave-square"></i> Power Factor</label>
      <input type="number" class="power-factor" min="0.1" max="1" step="0.01" placeholder="0.9"
             value="${powerFactor}" oninput="syncCardToTable(this)" />
    </div>

    <div class="card-field">
      <label><i class="fas fa-clock"></i> Usage Time (per day)</label>
      <div class="mobile-time-blocks">
        ${timeBlocksMarkup}
        <button type="button" class="add-block-btn">
          <i class="fas fa-plus"></i> Add time slot
        </button>
        <div class="total-hours-display">
          <strong><span class="total-h">${hours || "0.0"}</span> hours/day</strong>
          <input type="hidden" class="hours" value="${hours || "0"}" />
        </div>
      </div>
    </div>

    <div class="card-outputs">
      <h4><i class="fas fa-chart-bar"></i> Calculated Results</h4>

      <div class="card-field output-field">
        <label><i class="fas fa-calculator"></i> Total Watts</label>
        <input type="number" class="total-watts output-field" readonly placeholder="Auto" value="${totalWatts}" />
      </div>

      <div class="card-field output-field" style="display:none;">
        <label><i class="fas fa-chart-line"></i> Apparent Power (VA)</label>
        <input type="number" class="apparent-power output-field" readonly placeholder="Auto" value="${apparentPower}" />
      </div>

      <div class="card-field output-field" style="display:none;">
        <label><i class="fas fa-clock-rotate-left"></i> VA-Hours/Day</label>
        <input type="number" class="apparent-power-hour output-field" readonly placeholder="Auto" value="${apparentPowerHour}" />
      </div>

      <div class="card-field output-field">
        <label><i class="fas fa-battery-full"></i> Watt-Hours/Day</label>
        <input type="number" class="total-watts-hour output-field" readonly placeholder="Auto" value="${totalWattsHour}" />
      </div>
    </div>
  `;

  const cardDescSel = card.querySelector(".gadget-description");
  if (cardDescSel && descSel) cardDescSel.value = descSel.value || "";

  applyPresetPFToCard(card);
  applyPowerUnitForApplianceCard(card);

  return card;
}

function syncCardToTable(input) {
  const card = input.closest(".appliance-card");
  if (!card) return;
  const rowIndex = parseInt(card.dataset.rowIndex);
  const tableRows = document.querySelectorAll("#item-container .item-row");
  const tableRow = tableRows[rowIndex];
  if (!tableRow) return;

  if (input.classList.contains("gadget-description")) {
    const cardTitle = card.querySelector(".card-appliance-name");
    const text =
      input.tagName === "SELECT"
        ? input.selectedOptions[0]?.textContent || "Appliance"
        : input.value || "Appliance";
    cardTitle.textContent = text;
  }

  const fieldClass = input.className.split(" ")[0];
  const tableInput = tableRow.querySelector(`.${fieldClass}`);
  if (tableInput) {
    tableInput.value = input.value;

    if (document.querySelector(".show-outputs")) {
      calculateRow(tableRow);
      syncRowToCard(tableRow, card);
      updateSummary();
    }
  }
}

function syncRowToCard(row, card) {
  card.querySelector(".total-watts").value =
    row.querySelector(".total-watts").value;
  card.querySelector(".apparent-power").value =
    row.querySelector(".apparent-power").value;
  card.querySelector(".apparent-power-hour").value =
    row.querySelector(".apparent-power-hour").value;
  card.querySelector(".total-watts-hour").value =
    row.querySelector(".total-watts-hour").value;
}

// ===================
// MOBILE TIME BLOCKS
// ===================
function initMobileTimeBlocks(card, tableRow) {
  const container = card.querySelector(".mobile-time-blocks");
  if (!container || container._init) return;
  container._init = true;

  const totalDisplay = container.querySelector(".total-h");
  const hiddenHoursInput = container.querySelector(".hours");
  const rowHoursInput = tableRow.querySelector(".hours");

  function calculateMobileHours() {
    let total = 0;

    container.querySelectorAll(".time-block").forEach((block) => {
      const s = block.querySelector(".start-time")?.value;
      const e = block.querySelector(".end-time")?.value;
      if (!s || !e) return;

      const [sh, sm] = s.split(":").map(Number);
      const [eh, em] = e.split(":").map(Number);

      let start = sh + sm / 60;
      let end = eh + em / 60;
      if (end < start) end += 24;

      const h = end - start;
      if (h > 0) total += h;
    });

    const rounded = Math.round(total * 10) / 10;
    const roundedStr = rounded.toFixed(1);

    if (totalDisplay) totalDisplay.textContent = roundedStr;
    if (hiddenHoursInput) hiddenHoursInput.value = roundedStr;
    if (rowHoursInput) rowHoursInput.value = roundedStr;

    calculateRow(tableRow);
    updateSummary();
    syncRowToCard(tableRow, card);
  }

  const addBtn = container.querySelector(".add-block-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const block = document.createElement("div");
      block.className = "time-block";
      block.innerHTML = `
        <input type="time" class="start-time" value="08:00">
        <span>–</span>
        <input type="time" class="end-time" value="09:00">
        <button type="button" class="remove-block">×</button>
      `;
      container.insertBefore(block, addBtn);

      block
        .querySelectorAll("input[type='time']")
        .forEach((i) => i.addEventListener("change", calculateMobileHours));

      block
        .querySelector(".remove-block")
        .addEventListener("click", () => {
          block.remove();
          calculateMobileHours();
        });

      calculateMobileHours();
    });
  }

  container.addEventListener("click", (e) => {
    if (!e.target.classList.contains("remove-block")) return;
    const block = e.target.closest(".time-block");
    if (!block) return;
    block.remove();
    calculateMobileHours();
  });

  container
    .querySelectorAll(".time-block input[type='time']")
    .forEach((i) => i.addEventListener("change", calculateMobileHours));

  calculateMobileHours();
}

// ===================
// DAY / NIGHT HOUR SPLIT (10:00–15:00 = PV day)
// ===================
const DAY_START = 10; // 10:00
const DAY_END = 15; // 15:00

function getRowDayNightHours(row) {
  // Prefer mobile card time blocks if present
  let container = null;

  const indexAttr = row.dataset.rowIndex;
  if (indexAttr !== undefined) {
    const card = document.querySelector(
      `.appliance-card[data-row-index="${indexAttr}"]`
    );
    const mobileContainer = card?.querySelector(".mobile-time-blocks");
    if (mobileContainer && mobileContainer.querySelector(".time-block")) {
      container = mobileContainer;
    }
  }

  // Fallback to desktop multi-time-blocks
  if (!container) {
    const rowContainer = row.querySelector(".multi-time-blocks");
    if (rowContainer && rowContainer.querySelector(".time-block")) {
      container = rowContainer;
    }
  }

  if (!container) {
    const h = toNumber(row.querySelector(".hours")?.value, 0);
    return { totalHours: h, dayHours: 0, nightHours: h };
  }

  let total = 0;
  let day = 0;

  container.querySelectorAll(".time-block").forEach((block) => {
    const startVal = block.querySelector(".start-time")?.value;
    const endVal = block.querySelector(".end-time")?.value;
    if (!startVal || !endVal) return;

    const [sh, sm] = startVal.split(":").map(Number);
    const [eh, em] = endVal.split(":").map(Number);

    let start = sh + sm / 60;
    let end = eh + em / 60;

    if (end < start) end += 24;

    const hours = end - start;
    if (hours <= 0) return;

    total += hours;

    const overlapStart = Math.max(start, DAY_START);
    const overlapEnd = Math.min(end, DAY_END);
    const dayHours = Math.max(0, overlapEnd - overlapStart);

    day += dayHours;
  });

  const night = Math.max(0, total - day);
  return { totalHours: total, dayHours: day, nightHours: night };
}

// ===================
// ROW CALC
// ===================
function calculateRow(row) {
  const quantity = toNumber(row.querySelector(".quantity-input").value);
  const powerInput = toNumber(row.querySelector(".watts").value);
  const powerType = row.querySelector(".power-type")?.value || "w";
  const powerFactor = clampPF(row.querySelector(".power-factor").value);
  const hours = toNumber(row.querySelector(".hours").value);

  const watts = powerType === "hp" ? powerInput * HP_TO_W : powerInput;

  const totalWatts = quantity * watts;
  const apparentPower = powerFactor > 0 ? totalWatts / powerFactor : 0;
  const apparentPowerHour = apparentPower * hours;
  const totalWattsHour = totalWatts * hours;

  row.querySelector(".total-watts").value = isNaN(totalWatts)
    ? ""
    : totalWatts.toFixed(2);
  row.querySelector(".apparent-power").value =
    isNaN(apparentPower) || !isFinite(apparentPower)
      ? ""
      : apparentPower.toFixed(2);
  row.querySelector(".apparent-power-hour").value =
    isNaN(apparentPowerHour) || !isFinite(apparentPowerHour)
      ? ""
      : apparentPowerHour.toFixed(2);
  row.querySelector(".total-watts-hour").value = isNaN(totalWattsHour)
    ? ""
    : totalWattsHour.toFixed(2);
}

// ===================
// ADD / REMOVE ROWS
// ===================
function addmore() {
  const container = document.getElementById("item-container");
  const templateRow = document.querySelector("#item-container .item-row");
  if (!templateRow || !container) return;

  const row = templateRow.cloneNode(true);

  row.querySelectorAll("input").forEach((el) => {
    if (el.type === "hidden") return;
    el.value = "";
  });

  const select = row.querySelector(".gadget-description");
  if (select) select.value = "";

  const pfInput = row.querySelector(".power-factor");
  if (pfInput) pfInput.value = "";

  const timeContainer = row.querySelector(".multi-time-blocks");
  if (timeContainer) {
    timeContainer.innerHTML = `
      <div class="time-block">
        <input type="time" class="start-time" value="18:00">
        <span>–</span>
        <input type="time" class="end-time" value="22:00">
        <button type="button" class="remove-block" style="display:none;">×</button>
      </div>
      <button type="button" class="add-block-btn">
        <i class="fas fa-plus"></i> Add time slot
      </button>
      <div class="total-hours-display">
        <strong><span class="total-h">4.0</span> hours/day</strong>
        <input type="hidden" class="hours" value="4.0" />
      </div>
    `;
  }

  container.appendChild(row);

  applyPresetPFToRow(row);
  initMultiTimeBlocks(row);
  initAppliancePreset(row);
  applyPowerUnitForApplianceRow(row);

  syncTableToCards();
}

function removeInput(el) {
  const tableRows = document.querySelectorAll("#item-container .item-row");
  let row = el.closest(".item-row");
  let card = el.closest(".appliance-card");

  let index = null;
  if (card && card.dataset.rowIndex !== undefined) {
    index = parseInt(card.dataset.rowIndex);
    row = tableRows[index];
  } else if (row && row.dataset.rowIndex !== undefined) {
    index = parseInt(row.dataset.rowIndex);
    card = document.querySelector(`.appliance-card[data-row-index="${index}"]`);
  }

  const totalRows = tableRows.length;
  if (totalRows <= 1) {
    alert("You must have at least one appliance!");
    return;
  }

  if (row) row.remove();
  if (card) card.remove();

  syncTableToCards();
  if (document.querySelector(".show-outputs")) updateSummary();
}

// ===================
// VALIDATION
// ===================
function validateBeforeCalculate() {
  const rows = document.querySelectorAll(".item-row");
  let allValid = true;
  const errorMessages = [];

  // Detect if we're in mobile view (cards are visible, table is hidden)
  const isMobileView = window.innerWidth <= 768;

  rows.forEach((row, index) => {
    const select = row.querySelector(".gadget-description");
    const quantity = row.querySelector(".quantity-input");
    const watts = row.querySelector(".watts");
    const pfInput = row.querySelector(".power-factor");
    const hoursInput = row.querySelector(".hours");

    // Clear previous errors from both row and corresponding card
    [select, quantity, watts, hoursInput].forEach((el) =>
      el?.classList.remove("error")
    );

    const card = document.querySelector(
      `.appliance-card[data-row-index="${index}"]`
    );
    if (card) {
      card
        .querySelectorAll(
          ".gadget-description, .quantity-input, .watts, .hours"
        )
        .forEach((el) => el.classList.remove("error"));
    }

    // Sync mobile card data to table row ONLY if in mobile view
    if (isMobileView && card) {
      const cardSelect = card.querySelector(".gadget-description");
      const cardQuantity = card.querySelector(".quantity-input");
      const cardWatts = card.querySelector(".watts");
      const cardPowerType = card.querySelector(".power-type");
      const cardPF = card.querySelector(".power-factor");
      const cardHours = card.querySelector(".hours");

      if (cardSelect && select) select.value = cardSelect.value;
      if (cardQuantity && quantity) quantity.value = cardQuantity.value;
      if (cardWatts && watts) watts.value = cardWatts.value;
      if (cardPowerType && row.querySelector(".power-type")) {
        row.querySelector(".power-type").value = cardPowerType.value;
      }
      if (cardPF && pfInput) pfInput.value = cardPF.value;
      if (cardHours && hoursInput) hoursInput.value = cardHours.value;
    }

    // Recompute hours from time blocks (desktop/mobile) before validating
    const hoursInfo = getRowDayNightHours(row);
    if (hoursInput) hoursInput.value = hoursInfo.totalHours.toFixed(1);

    // Validate appliance selection
    if (!select.value) {
      select.classList.add("error");
      if (card)
        card
          .querySelector(".gadget-description")
          ?.classList.add("error");
      errorMessages.push(
        `Appliance ${index + 1}: Please select an appliance type`
      );
      allValid = false;
    }

    // Validate quantity
    if (!quantity.value || quantity.value <= 0) {
      quantity.classList.add("error");
      if (card)
        card
          .querySelector(".quantity-input")
          ?.classList.add("error");
      errorMessages.push(
        `Appliance ${index + 1}: Please enter a valid quantity`
      );
      allValid = false;
    }

    // Validate watts
    if (!watts.value || watts.value <= 0) {
      watts.classList.add("error");
      if (card) card.querySelector(".watts")?.classList.add("error");
      errorMessages.push(
        `Appliance ${index + 1}: Please enter valid power consumption`
      );
      allValid = false;
    }

    // Validate hours
    if (!hoursInput.value || toNumber(hoursInput.value) <= 0) {
      hoursInput.classList.add("error");
      if (card) card.querySelector(".hours")?.classList.add("error");
      errorMessages.push(
        `Appliance ${index + 1}: Please set usage time (use time slots)`
      );
      allValid = false;
    }

    // Validate power factor for "other" appliances
    const isOtherAppliance = select.value === "other";
    const pfIsEditable = pfInput && !pfInput.readOnly;

    if (isOtherAppliance || pfIsEditable) {
      const pfVal = clampPF(pfInput.value);
      if (!pfInput.value || pfVal < 0.1 || pfVal > 1) {
        pfInput.classList.add("error");
        if (card)
          card
            .querySelector(".power-factor")
            ?.classList.add("error");
        errorMessages.push(
          `Appliance ${index + 1}: Power factor must be between 0.1 and 1.0`
        );
        allValid = false;
      }
    } else {
      if (!pfInput.value || pfInput.value.trim() === "") {
        pfInput.value = "0.90";
      }
    }
  });

  if (!allValid) {
    const message =
      errorMessages.length > 0
        ? `Please fix the following errors:\n\n${errorMessages
            .slice(0, 5)
            .join("\n")}${
            errorMessages.length > 5 ? "\n\n...and more" : ""
          }`
        : "Please fill in all fields correctly before calculating.";
    alert(message);
  }

  return allValid;
}

// ===================
// CALCULATE LOAD
// ===================
function calculate() {
  if (!validateBeforeCalculate()) return;

  const container = document.getElementById("audit-container");
  const calculateBtn = document.querySelector(".btn-success");
  if (!container || !calculateBtn) return;

  calculateBtn.classList.add("calculating");
  calculateBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Calculating...';

  setTimeout(() => {
    container.classList.add("show-outputs");
    const itemRows = document.getElementsByClassName("item-row");

    for (let row of itemRows) {
      const qty = toNumber(row.querySelector(".quantity-input").value);
      const pin = toNumber(row.querySelector(".watts").value);
      const unit = row.querySelector(".power-type")?.value || "w";
      const pf = clampPF(row.querySelector(".power-factor").value);
      const hrs = toNumber(row.querySelector(".hours").value);

      const watts = unit === "hp" ? pin * HP_TO_W : pin;

      const totalWatts = qty * watts;
      const apparentPower = pf > 0 ? totalWatts / pf : 0;
      const apparentPowerHour = apparentPower * hrs;
      const totalWattsHour = totalWatts * hrs;

      animateValue(row.querySelector(".total-watts"), totalWatts);
      animateValue(row.querySelector(".apparent-power"), apparentPower);
      animateValue(
        row.querySelector(".apparent-power-hour"),
        apparentPowerHour
      );
      animateValue(
        row.querySelector(".total-watts-hour"),
        totalWattsHour
      );
    }

    syncTableToCards();

    const loadSummary = document.getElementById("load-summary");
    if (loadSummary) loadSummary.style.display = "block";
    updateSummary();
    updateProgress(2);

    calculateBtn.classList.remove("calculating");
    calculateBtn.innerHTML = '<i class="fas fa-check"></i> Calculated!';
    container.classList.add("calculated");

    setTimeout(() => {
      calculateBtn.innerHTML =
        '<i class="fas fa-calculator"></i> Recalculate';
      container.classList.remove("calculated");
    }, 1200);
  }, 300);
}

function animateValue(element, endValue) {
  if (!element) return;
  const startValue = 0;
  const duration = 800;
  const startTime = performance.now();

  function updateValue(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const currentValue = startValue + (endValue - startValue) * easeOut;

    element.value =
      isNaN(currentValue) || !isFinite(currentValue)
        ? ""
        : currentValue.toFixed(2);
    if (progress < 1) requestAnimationFrame(updateValue);
  }

  requestAnimationFrame(updateValue);
}

// ============================================
// APPROVED INVERTER SIZE LIST (kVA)
// ============================================
const APPROVED_INVERTER_SIZES_KVA = [
  0.5, 0.8, 1.0, 1.5, 2.0, 2.2, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.5,
  8.0, 10.0, 12.0, 15.0, 20.0,
];

const APPROVED_INVERTER_SIZES_VA = APPROVED_INVERTER_SIZES_KVA.map(
  (kva) => kva * 1000
);

function pickClosestInverterSize(requiredVA) {
  for (let size of APPROVED_INVERTER_SIZES_VA) {
    if (size >= requiredVA) return size;
  }
  return APPROVED_INVERTER_SIZES_VA[APPROVED_INVERTER_SIZES_VA.length - 1];
}

// ===================
// SUMMARY + DAY / NIGHT BANKS + INVERTER BASE
// ===================
function updateSummary() {
  const itemRows = document.getElementsByClassName("item-row");
  let totalLoad = 0;
  let totalApparent = 0;
  let dailyEnergy = 0;
  let totalVAh = 0;

  let daytimeWh = 0;
  let nighttimeWh = 0;

  for (let row of itemRows) {
    const w = toNumber(row.querySelector(".total-watts").value);
    const va = toNumber(row.querySelector(".apparent-power").value);
    const vah = toNumber(row.querySelector(".apparent-power-hour").value);
    const wh = toNumber(row.querySelector(".total-watts-hour").value);

    totalLoad += w;
    totalApparent += va;
    dailyEnergy += wh;
    totalVAh += vah;

    if (w > 0) {
      const hoursInfo = getRowDayNightHours(row);
      daytimeWh += w * hoursInfo.dayHours;
      nighttimeWh += w * hoursInfo.nightHours;
    }
  }

  // store global banks
  dayEnergyWh = daytimeWh;
  nightEnergyWh = nighttimeWh;

  // existing totals
  const totalLoadEl = document.getElementById("totalLoad");
  const totalApparentEl = document.getElementById("totalApparentPower");
  const totalApparentHourEl = document.getElementById("totalApparentHour");
  const dailyEnergyEl = document.getElementById("dailyEnergy");
  const kiloEnergyEl = document.getElementById("kiloEnergy");

  if (totalLoadEl) totalLoadEl.textContent = totalLoad.toFixed(0);
  if (totalApparentEl) totalApparentEl.textContent = totalApparent.toFixed(0);
  if (totalApparentHourEl)
    totalApparentHourEl.textContent = totalVAh.toFixed(0);
  if (dailyEnergyEl) dailyEnergyEl.textContent = dailyEnergy.toFixed(0);
  if (kiloEnergyEl)
    kiloEnergyEl.textContent = (dailyEnergy / 1000).toFixed(2);

  // day / night cards
  const dayWhEl = document.getElementById("dailyEnergyDay");
  const nightWhEl = document.getElementById("dailyEnergyNight");
  const dayKWhEl = document.getElementById("kiloEnergyDay");
  const nightKWhEl = document.getElementById("kiloEnergyNight");

  if (dayWhEl) dayWhEl.textContent = daytimeWh.toFixed(0);
  if (nightWhEl) nightWhEl.textContent = nighttimeWh.toFixed(0);
  if (dayKWhEl) dayKWhEl.textContent = (daytimeWh / 1000).toFixed(2);
  if (nightKWhEl) nightKWhEl.textContent = (nighttimeWh / 1000).toFixed(2);

  // inverter base (if inverter section exists)
  const invAllow = document.getElementById("inverter-allowance");
  const invEff = document.getElementById("inverter-efficiency");

  if (invAllow && invEff) {
    const allowance = toNumber(invAllow.value, 1.25);
    const eff = toNumber(invEff.value, 0.9);

    const inverterSize = totalApparent * allowance;
    const recommendedInverter = pickClosestInverterSize(inverterSize);
    const inverterStandbyEnergy = 0.02 * recommendedInverter * 24;
    const inverterInputEnergy = totalVAh / eff;
    const consumerEnergyDemand =
      inverterInputEnergy + inverterStandbyEnergy;

    const sizeEl = document.getElementById("inverterSize");
    const stdbyEl = document.getElementById("inverter-standby-energy");
    const inputEl = document.getElementById("inverter-input-energy");
    const demandEl = document.getElementById("consumer-energy-demand");
    const recEl = document.getElementById("recommended-inverter");

    if (sizeEl) sizeEl.textContent = inverterSize.toFixed(0);
    if (stdbyEl) stdbyEl.textContent = inverterStandbyEnergy.toFixed(0);
    if (inputEl) inputEl.textContent = inverterInputEnergy.toFixed(0);
    if (demandEl) demandEl.textContent = consumerEnergyDemand.toFixed(0);

    if (recEl) {
      const kva = (recommendedInverter / 1000).toFixed(2);
      recEl.textContent = `${recommendedInverter} W (${kva} kVA)`;
    }

    calculatedInverterKVA = inverterSize / 1000;
  }
}

// ===================
// INVERTER SIZING
// ===================
function addInverterSizing() {
  const container = document.getElementById("inverter-container");
  if (!container) return;

  // Prevent multiple sections
  if (container.children.length > 0) return;

  container.innerHTML = ""; // Clear any old content

  // Default values from load summary (fallback to 0)
  const totalApparent =
    parseFloat(
      document.getElementById("totalApparentPower")?.textContent || "0"
    ) || 0;
  const totalVAh =
    parseFloat(
      document.getElementById("totalApparentHour")?.textContent || "0"
    ) || 0;

  const allowance = 1.25;
  const efficiency = 0.9;
  const inverterSize = totalApparent * allowance;
  const recommendedInverter = pickClosestInverterSize(inverterSize);
  const inverterStandbyEnergy = 0.02 * recommendedInverter * 24;
  const inverterInputEnergy = totalVAh / efficiency;
  const consumerEnergyDemand =
    inverterInputEnergy + inverterStandbyEnergy;

  const section = document.createElement("div");
  section.className = "summary-section inverter-summary";
  section.innerHTML = `
    <div class="section-header">
      <h2 class="section-title"><i class="fas fa-microchip"></i> Inverter Sizing</h2>
      <button class="remove-section-btn" onclick="removeInverterSection(this)"><i class="fas fa-times"></i></button>
    </div>
    <div class="subsection">
      <h3 class="subsection-title"><i class="fas fa-cog"></i> Inverter Configuration</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;">
        <div class="input-group">
          <label for="inverter-allowance" class="tooltip">
            <i class="fas fa-shield-alt"></i> Safety Factor (Multiplier)
            <span class="tooltiptext">Extra headroom for surge/future loads. 1.2 = +20%.</span>
          </label>
          <input type="number" id="inverter-allowance" min="1.0" max="2.0" step="0.05" value="${allowance}" onchange="updateInverterCalculations()" />
        </div>
        <div class="input-group">
          <label for="inverter-efficiency" class="tooltip">
            <i class="fas fa-bolt"></i> Inverter Efficiency (0-1)
            <span class="tooltiptext">0.9 = 90%, 0.95 = 95%.</span>
          </label>
          <input type="number" id="inverter-efficiency" min="0.7" max="1.0" step="0.01" value="${efficiency.toFixed(
            2
          )}" onchange="updateInverterCalculations()" />
        </div>
      </div>
    </div>
    <div class="summary-grid">
      <div class="summary-card">
        <h3>Calculated Inverter Size</h3>
        <div class="value" id="inverterSize">${inverterSize.toFixed(0)}</div>
        <div class="unit">VA</div>
      </div>
      <div class="summary-card">
        <h3>Recommended Inverter</h3>
        <div class="value" id="recommended-inverter">${recommendedInverter} VA (${(
    recommendedInverter / 1000
  ).toFixed(2)} kVA)</div>
        <div class="unit">Standard Size</div>
      </div>
      <div class="summary-card">
        <h3>Inverter Standby Energy</h3>
        <div class="value" id="inverter-standby-energy">${inverterStandbyEnergy.toFixed(
          0
        )}</div>
        <div class="unit">Wh/day</div>
      </div>
      <div class="summary-card">
        <h3>Inverter Input Energy</h3>
        <div class="value" id="inverter-input-energy">${inverterInputEnergy.toFixed(
          0
        )}</div>
        <div class="unit">Wh/day</div>
      </div>
      <div class="summary-card">
        <h3>Consumer Energy Demand</h3>
        <div class="value" id="consumer-energy-demand">${consumerEnergyDemand.toFixed(
          0
        )}</div>
        <div class="unit">Wh/day</div>
      </div>
    </div>

    <div class="inverter-selection-section">
      <h3 class="subsection-title"><i class="fas fa-search"></i> Find Matching Inverters</h3>
      <div class="inverter-filters">
        <div class="filter-group">
          <label><i class="fas fa-bolt"></i> System Voltage</label>
          <select id="filter-voltage">
            <option value="12">12V DC</option>
            <option value="24">24V DC</option>
            <option value="48" selected>48V DC</option>
            <option value="60">60V DC</option>
            <option value="72">72V DC</option>
            <option value="96">96V DC</option>
          </select>
        </div>
        <div class="filter-group">
          <label><i class="fas fa-plug"></i> Output Voltage</label>
          <select id="filter-output">
            <option value="110">110V AC</option>
            <option value="120">120V AC</option>
            <option value="220">220V AC</option>
            <option value="230" selected>230V AC</option>
            <option value="240">240V AC</option>
            <option value="400">400V AC (3-Phase)</option>
          </select>
        </div>
        <div class="filter-group">
          <label><i class="fas fa-layer-group"></i> Inverter Type</label>
          <select id="filter-type">
            <option value="all">All Types</option>
            <option value="Hybrid">Hybrid</option>
            <option value="Off-grid">Off-grid</option>
            <option value="Grid-tied">Grid-tied Only</option>
          </select>
        </div>
        <div class="filter-group">
          <label><i class="fas fa-sliders-h"></i> Min Efficiency (%)</label>
          <input type="number" id="filter-efficiency" min="80" max="99" step="0.1" value="90" />
        </div>
      </div>
      <button class="search-inverters-btn" onclick="searchInverters()">
        <i class="fas fa-search"></i> Search Inverters
      </button>
      <div class="inverter-results" id="inverter-results" style="display:none;">
        <h4 class="subsection-title">
          <i class="fas fa-list"></i> <span id="results-count">0 inverters found</span>
        </h4>
        <div class="inverter-grid" id="inverter-grid"></div>
      </div>
    </div>
  `;

  container.appendChild(section);

  // Hide the Add Inverter button
  const addInverterBtn = document.getElementById("add-inverter");
  if (addInverterBtn) addInverterBtn.style.display = "none";

  // Move action buttons below
  moveActionButtonsBelow(container);

  // Update state
  updateProgress(3);
  updateActionButtonsVisibility();

  // Scroll to section
  section.scrollIntoView({ behavior: "smooth", block: "start" });

  // Update global
  calculatedInverterKVA = inverterSize / 1000;
}

function removeInverterSection(button) {
  const section = button.closest(".summary-section");
  if (!section) return;
  section.style.animation = "fadeOutRow 0.3s ease-out";
  setTimeout(() => {
    section.remove();

    // Bring action button bar back
    moveActionButtonsToOriginalPosition();

    // Do NOT hard-force Add Inverter visible here.
    updateProgress(2);              // back to load step
    updateButtonStates();
    updateActionButtonsVisibility();
  }, 300);
}


function updateInverterCalculations() {
  const totalApparent =
    parseFloat(
      document.getElementById("totalApparentPower")?.textContent
    ) || 0;
  const totalVAh =
    parseFloat(
      document.getElementById("totalApparentHour")?.textContent
    ) || 0;

  const invAllowEl = document.getElementById("inverter-allowance");
  const invEffEl = document.getElementById("inverter-efficiency");
  if (!invAllowEl || !invEffEl) return;

  const allowance = toNumber(invAllowEl.value, 1.2);
  const eff = toNumber(invEffEl.value, 0.9);

  const inverterSize = totalApparent * allowance;
  const recommendedInverter = pickClosestInverterSize(inverterSize);
  const inverterStandbyEnergy = 0.02 * recommendedInverter * 24;
  const inverterInputEnergy = totalVAh / eff;
  const consumerEnergyDemand =
    inverterInputEnergy + inverterStandbyEnergy;

  document.getElementById("inverterSize").textContent =
    inverterSize.toFixed(0);
  document.getElementById(
    "inverter-standby-energy"
  ).textContent = inverterStandbyEnergy.toFixed(0);
  document.getElementById("inverter-input-energy").textContent =
    inverterInputEnergy.toFixed(0);
  document.getElementById("consumer-energy-demand").textContent =
    consumerEnergyDemand.toFixed(0);

  const kva = (recommendedInverter / 1000).toFixed(2);
  document.getElementById("recommended-inverter").textContent = `${recommendedInverter} W (${kva} kVA)`;

  calculatedInverterKVA = inverterSize / 1000;
}

function updateSystemVoltage() {
  const sv = document.getElementById("system-voltage");
  if (!sv) return;
  calculatedSystemVoltage = parseInt(sv.value, 10);
  const filt = document.getElementById("filter-voltage");
  if (filt) filt.value = String(calculatedSystemVoltage);
}

//  INVERTER SEARCHING
function searchInverters() {
  if (typeof window.inverterDatabase === "undefined") {
    alert(
      "Error: Inverter database not loaded. Please check that inverter-data.js is properly linked."
    );
    return;
  }

  const requiredKVA = parseFloat(calculatedInverterKVA) || 0;
  const filterVoltage = parseInt(
    document.getElementById("filter-voltage").value,
    10
  );
  const filterOutput = parseInt(
    document.getElementById("filter-output").value,
    10
  );
  const filterType = document.getElementById("filter-type").value;
  const minEfficiency =
    parseFloat(
      document.getElementById("filter-efficiency").value
    ) || 0;

  let results = window.inverterDatabase.filter((inv) => {
    const kvaMatch =
      inv.kva >= requiredKVA * 0.8 && inv.kva <= requiredKVA * 1.5;
    const voltageMatch = inv.inputVoltage.includes(filterVoltage);
    const outputMatch = inv.outputVoltage.some((v) => {
      if (
        filterOutput >= 220 &&
        filterOutput <= 240 &&
        v >= 220 &&
        v <= 240
      )
        return true;
      if (
        filterOutput >= 110 &&
        filterOutput <= 120 &&
        v >= 110 &&
        v <= 120
      )
        return true;
      return v === filterOutput;
    });
    const typeMatch = filterType === "all" || inv.type === filterType;
    const effMatch = inv.efficiency >= minEfficiency;
    return kvaMatch && voltageMatch && outputMatch && typeMatch && effMatch;
  });

  results.sort((a, b) => b.efficiency - a.efficiency);
  displayInverterResults(results);
}

function displayInverterResults(inverters) {
  const resultsSection = document.getElementById("inverter-results");
  const resultsCount = document.getElementById("results-count");
  const inverterGrid = document.getElementById("inverter-grid");
  if (!resultsSection || !resultsCount || !inverterGrid) return;

  resultsSection.style.display = "block";
  resultsCount.textContent = `${inverters.length} inverter${
    inverters.length !== 1 ? "s" : ""
  } found`;

  if (inverters.length === 0) {
    inverterGrid.innerHTML = `
      <div class="no-results-message">
        <i class="fas fa-info-circle"></i>
        <p>No inverters match your criteria. Try adjusting the filters.</p>
      </div>
    `;
    return;
  }

  inverterGrid.innerHTML = "";
  inverters.forEach((inv) => {
    const card = document.createElement("div");
    card.className = "inverter-card";
    card.onclick = () => selectInverter(inv, card);

    const typeClass = inv.type.toLowerCase().replace(/[\s-]/g, "");

    card.innerHTML = `
      <div class="inverter-card-header">
        <div>
          <div class="inverter-brand">${inv.brand}</div>
          <div class="inverter-model">${inv.model}</div>
        </div>
        <span class="inverter-type-badge type-${typeClass}">${inv.type}</span>
      </div>

      <div class="inverter-specs">
        <div class="spec-row"><span class="spec-label">Capacity</span><span class="spec-value">${inv.kva} kVA</span></div>
        <div class="spec-row"><span class="spec-label">Input DC</span><span class="spec-value">${inv.inputVoltage.join(
          "/"
        )}V</span></div>
        <div class="spec-row"><span class="spec-label">Output AC</span><span class="spec-value">${inv.outputVoltage.join(
          "/"
        )}V</span></div>
        <div class="spec-row"><span class="spec-label">Country</span><span class="spec-value">${inv.country}</span></div>
      </div>

      <div class="inverter-efficiency">
        <span class="efficiency-label">Efficiency</span>
        <span class="efficiency-value">${inv.efficiency}%</span>
      </div>
    `;
    inverterGrid.appendChild(card);
  });
}

function selectInverter(inverter, cardElement) {
  document
    .querySelectorAll(".inverter-card")
    .forEach((card) => card.classList.remove("selected"));
  cardElement.classList.add("selected");
  selectedInverter = inverter;
  alert(
    `Selected: ${inverter.brand} ${inverter.model} (${inverter.kva}kVA)`
  );
}

// ===================
// BATTERY SIZING (Night-time only, Li-ion in kWh)
// ===================
function addBatterySizing() {
  const container = document.getElementById("battery-container");
  if (!container) return;
  container.innerHTML = "";

  const addBatteryBtn = document.getElementById("add-battery");
  if (addBatteryBtn) addBatteryBtn.style.display = "none";

  const section = document.createElement("div");
  section.className = "summary-section battery-summary";
  section.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">
        <i class="fas fa-battery-half"></i> Battery Sizing (Lithium-ion)
      </h2>
      <button class="remove-section-btn" onclick="removeBatterySection(this)">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="subsection">
      <h3 class="subsection-title">
        <i class="fas fa-sliders-h"></i> Battery Configuration
      </h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;">
        <div class="input-group">
          <label><i class="fas fa-calendar-day"></i> Backup Nights:</label>
          <input type="number" id="backup-days" min="1" max="7" step="1" value="1" onchange="calculateBattery()" />
        </div>
        <div class="input-group" style="display:none;">
          <label for="dod" class="tooltip">
            <i class="fas fa-battery-empty"></i> Depth of Discharge (0–1)
            <span class="tooltiptext">
              Lithium-ion batteries can safely go deeper (80–90% DoD).
              0.9 = 90% usable before recharge.
            </span>
          </label>
          <input type="number" id="dod" min="0.5" max="0.95" step="0.05" value="0.9" onchange="calculateBattery()" />
        </div>
      </div>
      <p style="font-size:13px;color:#6b7280;margin-top:10px;font-style:italic;">
        <i class="fas fa-info-circle"></i>
        Battery is sized using <strong>night-time energy only</strong>.
      </p>
    </div>

    <div class="summary-grid" id="battery-results"></div>`;

  container.appendChild(section);

  // Move the action buttons below the battery section
  moveActionButtonsBelow(container);

  updateProgress(4);
  calculateBattery();
  updateActionButtonsVisibility();

  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function removeBatterySection(button) {
  const section = button.closest(".summary-section");
  if (!section) return;
  section.style.animation = "fadeOutRow 0.3s ease-out";

  setTimeout(() => {
    section.remove();
    moveActionButtonsToOriginalPosition();

    // Don't manually show add-battery/add-inverter.
    // Let visibility helper decide based on container children.
    updateProgress(3);              // back to inverter step
    updateButtonStates();
    updateActionButtonsVisibility();
  }, 300);
}


// NOTE on Simple vs Advanced Mode battery sizing (documented, not a bug):
// Advanced Mode sizes the battery as nightWh * days / DoD * 1.1 safety
// margin, and does NOT divide by inverter efficiency here (efficiency is
// instead applied earlier, to the inverter's own energy-demand figures).
// Simple Mode (simple.js -> computeSystem) uses the more conservative
// Battery_Wh = (Night_Wh * autonomy_days) / (DoD * inverter_efficiency),
// so a Simple Mode battery recommendation will run slightly larger than
// Advanced Mode's for the same load. Both are internally consistent;
// this divergence is intentional (Simple Mode is deliberately generous)
// and left in place per the "don't touch Advanced Mode unless necessary"
// constraint on this pass.
function calculateBattery() {
  let nightWh = nightEnergyWh;

  if (!nightWh || isNaN(nightWh) || nightWh <= 0) {
    const nightEl = document.getElementById("dailyEnergyNight");
    if (nightEl) nightWh = parseFloat(nightEl.textContent) || 0;

    if (!nightWh || isNaN(nightWh) || nightWh <= 0) {
      const dailyEl = document.getElementById("dailyEnergy");
      nightWh = dailyEl
        ? parseFloat(dailyEl.textContent || "0") * 0.5
        : 0;
    }
  }

  const backupDays = toNumber(
    document.getElementById("backup-days")?.value,
    2
  );

  const dod = toNumber(document.getElementById("dod")?.value, 0.9);

  const safetyFactor = 1.1;

  const totalNightEnergyWh = nightWh * backupDays;

  const usableBatteryKWh = totalNightEnergyWh / 1000;

  const nominalBatteryKWh = usableBatteryKWh / dod;

  const recommendedBatteryKWh = nominalBatteryKWh * safetyFactor;

  const resultsDiv = document.getElementById("battery-results");
  if (resultsDiv) {
    resultsDiv.innerHTML = `
      <div class="summary-card">
        <h3>Night Load (per day)</h3>
        <div class="value">${nightWh.toFixed(0)}</div>
        <div class="unit">Wh/night</div>
      </div>

      <div class="summary-card">
        <h3>Total Energy for ${backupDays} Night(s)</h3>
        <div class="value">${totalNightEnergyWh.toFixed(0)}</div>
        <div class="unit">Wh</div>
      </div>

      <div class="summary-card">
        <h3>Required Usable Storage</h3>
        <div class="value">${usableBatteryKWh.toFixed(2)}</div>
        <div class="unit">kWh (delivered)</div>
      </div>

      <div class="summary-card">
        <h3>Nominal Li-ion Bank</h3>
        <div class="value">${nominalBatteryKWh.toFixed(2)}</div>
        <div class="unit">kWh @ ${(dod * 100).toFixed(0)}% DoD</div>
      </div>

      <div class="summary-card">
        <h3>Recommended Li-ion Capacity</h3>
        <div class="value">${recommendedBatteryKWh.toFixed(2)}</div>
        <div class="unit">kWh (incl. 10% margin)</div>
      </div>
    `;
  }
}

// ===================
// PANEL SIZING
// ===================
function addPanelSizing() {
  const container = document.getElementById("panel-container");
  if (!container) return;
  container.innerHTML = "";

  const addPanelBtn = document.getElementById("add-panel");
  if (addPanelBtn) addPanelBtn.style.display = "none";

  const section = document.createElement("div");
  section.className = "summary-section panel-summary";
  section.innerHTML = `
    <div class="section-header">
      <h2 class="section-title"><i class="fas fa-solar-panel"></i> Solar Panel Sizing</h2>
      <button class="remove-section-btn" onclick="removePanelSection(this)"><i class="fas fa-times"></i></button>
    </div>

    <div class="subsection">
      <h3 class="subsection-title"><i class="fas fa-sun"></i> Solar Configuration</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;">
        <div class="input-group">
          <label><i class="fas fa-sun"></i> Peak Sun Hours/Day:</label>
          <input type="number" id="sun-hours" min="3" max="8" step="0.1" value="5" onchange="calculatePanel()" />
          <small>Daily equivalent of full sun hours (e.g. 4–6 in Nigeria).</small>
        </div>
        <div class="input-group">
          <label for="system-efficiency" class="tooltip">
            <i class="fas fa-percentage"></i> System Efficiency (0–1)
            <span class="tooltiptext">Total derate incl. wiring, temp, inverter, etc.</span>
          </label>
          <input type="number" id="system-efficiency" min="0.7" max="0.95" step="0.01" value="0.85" onchange="calculatePanel()" />
        </div>
        <div class="input-group">
          <label><i class="fas fa-solar-panel"></i> Panel Wattage (W):</label>
          <input type="number" id="panel-wattage" min="100" max="600" step="10" value="400" onchange="calculatePanel()" />
        </div>
      </div>
    </div>

    <div class="summary-grid" id="panel-results"></div>`;

  container.appendChild(section);

  // Move the action buttons below the panel section
  moveActionButtonsBelow(container);

  calculatePanel();
  updateProgress(4);
  updateActionButtonsVisibility();

  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function removePanelSection(button) {
  const section = button.closest(".summary-section");
  if (!section) return;
  section.style.animation = "fadeOutRow 0.3s ease-out";

  setTimeout(() => {
    section.remove();
    moveActionButtonsToOriginalPosition();

    // DO NOT force all three buttons visible here.
    // Just recompute visibility based on which sections exist.
    updateProgress(4);           // still in Step 4 (battery/inverter may exist)
    updateButtonStates();        // enable/disable based on progress
    updateActionButtonsVisibility(); // show/hide Add buttons correctly
  }, 300);
}


function calculatePanel() {
  const consumerEl = document.getElementById("consumer-energy-demand");
  const dailyEl = document.getElementById("dailyEnergy");

  let energyWh = consumerEl
    ? parseFloat(consumerEl.textContent)
    : parseFloat(dailyEl?.textContent || "0");

  if (!energyWh || isNaN(energyWh)) {
    alert("Please calculate load & inverter first.");
    return;
  }

  const sunHours = toNumber(
    document.getElementById("sun-hours")?.value,
    5
  );
  const systemEff = toNumber(
    document.getElementById("system-efficiency")?.value,
    0.85
  );
  const panelWp = toNumber(
    document.getElementById("panel-wattage")?.value,
    400
  );

  const daytimeRequiredPVWh = energyWh / systemEff;

  const dailyPanelWh = panelWp * sunHours;
  const panelCountForDay = Math.ceil(daytimeRequiredPVWh / dailyPanelWh);

  const nightWh = nightEnergyWh || 0;
  const totalPanelWhForRechargeForNight = nightWh / systemEff;

  const totalPVWhRequired =
    daytimeRequiredPVWh + totalPanelWhForRechargeForNight;

  const totalPanelCount = Math.ceil(totalPVWhRequired / dailyPanelWh);

  const resultsDiv = document.getElementById("panel-results");
  if (!resultsDiv) return;
  resultsDiv.innerHTML = `
    <div class="summary-card">
      <h3>Required PV Energy (Day)</h3>
      <div class="value">${daytimeRequiredPVWh.toFixed(0)}</div>
      <div class="unit">Wh/day</div>
    </div>

    <div class="summary-card">
      <h3>Panels Needed (DayTime)</h3>
      <div class="value">${panelCountForDay}</div>
      <div class="unit">@ ${panelWp} Wp</div>
    </div>

    <div class="summary-card">
      <h3>Night Energy Requirement (Recharge Battery)</h3>
      <div class="value">${nightWh.toFixed(0)}</div>
      <div class="unit">Wh</div>
    </div>

    <div class="summary-card">
      <h3>Total Panels Needed (DayTime + Recharge)</h3>
      <div class="value">${totalPanelCount}</div>
      <div class="unit">Panels</div>
    </div>
  `;
}

// ===================
// GLOBAL INPUT LISTENERS & INIT
// ===================

// initial row indices
document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelectorAll("#item-container .item-row")
    .forEach((row, index) => (row.dataset.rowIndex = index));
});

document.addEventListener("input", function (e) {
  if (
    e.target.matches(
      ".quantity-input, .watts, .power-factor, .hours, .power-type, .gadget-description"
    )
  ) {
    const row = e.target.closest(".item-row");
    if (row && document.querySelector(".show-outputs")) {
      calculateRow(row);
      updateSummary();
      syncTableToCards();
    }
  }
});

document.addEventListener("change", function (e) {
  if (e.target.matches(".gadget-description") && e.target.closest(".item-row")) {
    const row = e.target.closest(".item-row");
    applyPresetPFToRow(row);
    applyPowerUnitForApplianceRow(row);

    if (document.querySelector(".show-outputs")) {
      calculateRow(row);
      updateSummary();
    }
    syncTableToCards();
  }

  if (
    e.target.matches(".gadget-description") &&
    e.target.closest(".appliance-card")
  ) {
    const card = e.target.closest(".appliance-card");
    applyPresetPFToCard(card);
    applyPowerUnitForApplianceCard(card);
    syncCardToTable(e.target);
  }
});

document.addEventListener("keydown", function (e) {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === "Enter") {
      e.preventDefault();
      calculate();
    } else if (e.key === "+") {
      e.preventDefault();
      addmore();
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // icon cleanup (if any old icons)
  document.querySelectorAll(".fa-zap").forEach((i) => {
    i.classList.remove("fa-zap");
    i.classList.add("fa-bolt");
  });
  document.querySelectorAll(".fa-history").forEach((i) => {
    i.classList.remove("fa-history");
    i.classList.add("fa-clock-rotate-left");
  });

  updateProgressIndicator();

  document
    .querySelectorAll("#item-container .item-row")
    .forEach((row) => {
      applyPresetPFToRow(row);
      initMultiTimeBlocks(row);
      initAppliancePreset(row);
      applyPowerUnitForApplianceRow(row);
    });

  syncTableToCards();
});
