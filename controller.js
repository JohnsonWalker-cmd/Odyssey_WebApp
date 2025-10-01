function postJson(url, body) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((r) => r.json())
    .catch(() => ({}));
}

let localModeOverride = { mode: null, expires: 0 };

// ======================== POWER TOGGLE ======================== //
const powerCheckbox = document.getElementById("power-toggle-checkbox");
const powerMobileBtn = document.getElementById("power-toggle-mobile");
let ignorePowerCheckboxChange = false;

if (powerCheckbox) {
  powerCheckbox.addEventListener("change", async () => {
    if (ignorePowerCheckboxChange) return;
    const checked = powerCheckbox.checked;
    const cmd = checked ? "power_on" : "power_off";
    updatePowerUI(checked);
    await postJson("/command", { command: cmd });
  });
}

if (powerMobileBtn) {
  powerMobileBtn.addEventListener("click", async () => {
    const isOn = powerMobileBtn.classList.contains("on");
    const newState = !isOn;
    updatePowerUI(newState);
    if (powerCheckbox) {
      ignorePowerCheckboxChange = true;
      powerCheckbox.checked = newState;
      setTimeout(() => { ignorePowerCheckboxChange = false; }, 0);
    }
    const cmd = newState ? "power_on" : "power_off";
    await postJson("/command", { command: cmd });
  });
}

function updatePowerUI(isOn) {
  const ps = document.getElementById("power-state");
  if (ps) {
    ps.textContent = "Rover Power: " + (isOn ? "ON" : "OFF");
    ps.classList.toggle("on", isOn);
    ps.classList.toggle("off", !isOn);
  }
  if (powerMobileBtn) {
    powerMobileBtn.classList.toggle("on", isOn);
    powerMobileBtn.classList.toggle("off", !isOn);
    powerMobileBtn.setAttribute("aria-pressed", String(isOn));
    powerMobileBtn.textContent = isOn ? "On" : "Off";
  }
}

// ======================== MOVEMENT BUTTONS ======================== //
document.querySelectorAll(".ps-controls [data-direction]").forEach((btn) => {
  let sending = false;
  const sendCommand = async () => {
    if (sending) return;
    sending = true;
    const command = btn.getAttribute("data-direction");
    btn.classList.add("pressed");
    try {
      await postJson("/command", { command });
    } finally {
      setTimeout(() => {
        btn.classList.remove("pressed");
        sending = false;
      }, 150);
    }
  };
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    sendCommand();
  });
  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      sendCommand();
    }
  });
});

// ======================== MODE SELECTOR ======================== //
function setActiveModeButton(mode) {
  document
    .querySelectorAll(".mode-selector .mode-button")
    .forEach((b) =>
      b.classList.toggle("active", b.getAttribute("data-mode") === mode)
    );
}

document.querySelectorAll(".mode-selector .mode-button").forEach((btn) =>
  btn.addEventListener("click", async () => {
    document
      .querySelectorAll(".mode-selector .mode-button")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const mode = btn.getAttribute("data-mode");
    localModeOverride.mode = mode;
    localModeOverride.expires = Date.now() + 5000;
    const cm = document.getElementById("current-mode");
    if (cm) cm.textContent = "Current Mode: " + mode.charAt(0).toUpperCase() + mode.slice(1);
    await postJson("/command", { command: "mode_change", mode });
  })
);

// ======================== POLLING ======================== //
async function poll() {
  try {
    const res = await fetch("/api/data");
    const data = await res.json();
    const power = !!data.power;
    updatePowerUI(power);
    if (powerCheckbox) {
      ignorePowerCheckboxChange = true;
      powerCheckbox.checked = power;
      setTimeout(() => { ignorePowerCheckboxChange = false; }, 0);
    }
    if (data.mode) {
      if (localModeOverride.mode && Date.now() < localModeOverride.expires) {
        if (data.mode === localModeOverride.mode) {
          localModeOverride.mode = null;
          localModeOverride.expires = 0;
          setActiveModeButton(data.mode);
          const cm = document.getElementById("current-mode");
          if (cm) cm.textContent = "Current Mode: " + capitalize(data.mode);
        }
      } else {
        setActiveModeButton(data.mode);
        const cm = document.getElementById("current-mode");
        if (cm) cm.textContent = "Current Mode: " + capitalize(data.mode);
      }
    }
    if (data.last_seen) {
      const ls = document.getElementById("last-seen");
      if (ls) ls.textContent = "Last Seen: " + data.last_seen;
    }
    if (power) {
      updateTelemetry(data);
    }
  } catch (e) {}
}
poll();
setInterval(poll, 1000);

function capitalize(str) {
  return String(str).charAt(0).toUpperCase() + String(str).slice(1);
}

function updateTelemetry(data) {
  const forward = data.forward_distance_cm ?? data.forward_distance;
  if (forward !== undefined) {
    const el = document.getElementById("forward-distance");
    if (el) el.textContent = String(forward) + " cm";
  }
  const temp = data.temperature_c ?? data.temperature;
  if (temp !== undefined) {
    const el = document.getElementById("temperature");
    if (el) el.textContent = Number(temp).toFixed(2) + " °C";
  }
  const hum = data.humidity_percent ?? data.humidity;
  if (hum !== undefined) {
    const el = document.getElementById("humidity");
    if (el) el.textContent = Number(hum).toFixed(2) + " %";
  }
  const aq = data.air_quality_raw ?? data.air_quality;
  if (aq !== undefined) {
    const el = document.getElementById("air-quality");
    if (el) el.textContent = String(aq);
  }
}

// ======================== GAMEPAD SUPPORT ======================== //
let gamepadIndex = null;
let prevButtons = [];

window.addEventListener("gamepadconnected", (e) => {
  console.log("Gamepad connected:", e.gamepad);
  gamepadIndex = e.gamepad.index;
});

window.addEventListener("gamepaddisconnected", (e) => {
  console.log("Gamepad disconnected:", e.gamepad);
  gamepadIndex = null;
});

function pollGamepad() {
  if (gamepadIndex !== null) {
    const gp = navigator.getGamepads()[gamepadIndex];
    if (gp) {
      gp.buttons.forEach((btn, i) => {
        if (btn.pressed && !prevButtons[i]) {
          handleButtonPress(i);
        }
      });
      prevButtons = gp.buttons.map(b => b.pressed);
    }
  }
  requestAnimationFrame(pollGamepad);
}
pollGamepad();

async function handleButtonPress(index) {
  switch (index) {
    case 2: // X button
      console.log("X pressed → toggle power");
      if (powerCheckbox) {
        powerCheckbox.checked = !powerCheckbox.checked;
        powerCheckbox.dispatchEvent(new Event("change"));
      }
      break;
    case 3: // Y button
      console.log("Y pressed → Manual mode");
      await postJson("/command", { command: "mode_change", mode: "manual" });
      setActiveModeButton("manual");
      break;
    case 1: // B button
      console.log("B pressed → Assisted mode");
      await postJson("/command", { command: "mode_change", mode: "assisted" });
      setActiveModeButton("assisted");
      break;
    case 0: // A button
      console.log("A pressed → Autonomous mode");
      await postJson("/command", { command: "mode_change", mode: "autonomous" });
      setActiveModeButton("autonomous");
      break;
    case 9: // Pause/Menu button
      console.log("Pause pressed → STOP");
      await postJson("/command", { command: "stop" });
      break;
  }
}
