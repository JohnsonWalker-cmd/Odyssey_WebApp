// ======================== GAMEPAD SUPPORT ======================== //
let gamepadIndex = null;
let prevButtons = [];
let lastAxisCommand = null;

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
      // --- BUTTONS --- //
      gp.buttons.forEach((btn, i) => {
        if (btn.pressed && !prevButtons[i]) {
          handleButtonPress(i);
        }
      });

      // --- DPAD --- //
      if (gp.buttons[12]?.pressed) handleDirection("forward");  // Up
      if (gp.buttons[13]?.pressed) handleDirection("backward"); // Down
      if (gp.buttons[14]?.pressed) handleDirection("left");     // Left
      if (gp.buttons[15]?.pressed) handleDirection("right");    // Right

      // --- LEFT JOYSTICK --- //
      const x = gp.axes[0]; // left stick horizontal (-1 left, +1 right)
      const y = gp.axes[1]; // left stick vertical   (-1 up, +1 down)
      const deadzone = 0.4;
      let axisCommand = null;

      if (Math.abs(x) > Math.abs(y)) {
        if (x > deadzone) axisCommand = "right";
        else if (x < -deadzone) axisCommand = "left";
      } else {
        if (y > deadzone) axisCommand = "backward";
        else if (y < -deadzone) axisCommand = "forward";
      }

      if (axisCommand && axisCommand !== lastAxisCommand) {
        handleDirection(axisCommand);
        lastAxisCommand = axisCommand;
      }
      if (!axisCommand) {
        lastAxisCommand = null; // reset when stick released
      }

      prevButtons = gp.buttons.map((b) => b.pressed);
    }
  }
  requestAnimationFrame(pollGamepad);
}
pollGamepad();

// Handle special button presses
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

// Handle D-Pad or joystick directions
async function handleDirection(direction) {
  console.log("Direction:", direction);
  await postJson("/command", { command: direction });

  // Also flash UI button like when clicked
  const btn = document.querySelector(`.ps-controls [data-direction="${direction}"]`);
  if (btn) {
    btn.classList.add("pressed");
    setTimeout(() => btn.classList.remove("pressed"), 150);
  }
}
