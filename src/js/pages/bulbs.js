import bulbsTemplate from "../../pages/bulbs.html?raw";

const KNOWN_BULBS = [
  { deviceName: "OfficeLight1", label: "Office Light 1" },
  { deviceName: "OfficeLight2", label: "Office Light 2" },
];

// Not a real Zigbee2MQTT effect value — a synthetic preset that asks for the
// "fading" effect (which cycles through effect_colors) seeded with a rainbow
// palette, since the bulb has no native rainbow mode.
const RAINBOW_COLORS = [
  { r: 255, g: 0, b: 0 },
  { r: 255, g: 127, b: 0 },
  { r: 255, g: 255, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 0, g: 0, b: 255 },
  { r: 75, g: 0, b: 130 },
  { r: 148, g: 0, b: 211 },
];

const COLOR_TEMP_MIN_KELVIN = 2000;
const COLOR_TEMP_MAX_KELVIN = 6500;
// Matches .color-wheel-wrap's fixed CSS size (and the canvas width/height) —
// used instead of wrap.clientWidth, which reads 0 (and sends the cursor flying
// to the top-left corner) whenever it's positioned while the color row is
// hidden behind the White tab.
const COLOR_WHEEL_SIZE = 220;

const INFO_FIELDS = [
  { key: "state", label: "State", icon: "mdi-power" },
  { key: "brightness", label: "Brightness", icon: "mdi-brightness-6", format: (v) => `${Math.round((v / 254) * 100)}%` },
  { key: "color_temp", label: "Color Temp", icon: "mdi-thermometer-lines", format: (v) => `${v} mired` },
  { key: "color_mode", label: "Color Mode", icon: "mdi-palette" },
  { key: "effect", label: "Effect", icon: "mdi-creation" },
  { key: "power_on_behavior", label: "Power-On Behavior", icon: "mdi-power-plug" },
  { key: "dimming_range_minimum", label: "Dim Min", icon: "mdi-brightness-4", format: (v) => `${v}%` },
  { key: "dimming_range_maximum", label: "Dim Max", icon: "mdi-brightness-7", format: (v) => `${v}%` },
  { key: "device_temperature", label: "Temp", icon: "mdi-thermometer", format: (v) => `${v}°C` },
  { key: "linkquality", label: "Link Quality", icon: "mdi-signal" },
];

export class BulbsPage {
  constructor(container, authService, apiService, onBack, onLogout) {
    this.container = container;
    this.authService = authService;
    this.apiService = apiService;
    this.onBack = onBack;
    this.onLogout = onLogout;

    this.lightStates = {};
    this.presets = [];
    this.pendingPresetDevice = null;
    this.pendingApplyDevices = [];
    this.pendingDeleteId = null;
    this.pendingControlDevices = [];
    this.selectedDevices = new Set();

    // Per-device memory of the last color used in "Color" mode and the last
    // kelvin value used in "White" mode, so switching tabs restores + re-applies
    // whichever one was last active instead of guessing from (possibly stale/
    // absent) device state for the inactive mode.
    this.lastColorHex = {};
    this.lastColorTemp = {};
    this.lastEffect = {};

    // Tracks the bulb-icon color last actually applied per device, so the
    // "ignite" glow animation only plays on a real on/color change — not on
    // every periodic state refresh that happens to report the same thing.
    this.lastBulbIconColor = {};
  }

  render() {
    this.container.innerHTML = bulbsTemplate;
    this.renderBulbRows();
    this.setupHandlers();
    this.loadLightStates();
    this.loadPresets();
  }

  getBulbLabel(deviceName) {
    const bulb = KNOWN_BULBS.find((b) => b.deviceName === deviceName);
    return bulb ? bulb.label : deviceName;
  }

  renderBulbRows() {
    const list = this.container.querySelector("#bulbs-device-list");
    list.innerHTML = KNOWN_BULBS.map(
      (bulb) => `
        <details class="device-row" data-device="${bulb.deviceName}">
          <summary class="device-row-header">
            <div class="device-row-title">
              <button class="select-check-btn" data-action="toggle-select" data-device="${bulb.deviceName}" title="Select">
                <i class="mdi mdi-checkbox-blank-circle-outline"></i>
              </button>
              <div class="device-icon bulb-icon">
                <i class="mdi mdi-lightbulb"></i>
              </div>
              <div class="device-row-name">${bulb.label}</div>
            </div>
            <div class="device-row-header-right">
              <span class="status-badge status-checking" data-role="state-badge">
                <span class="status-dot"></span>
              </span>
              <i class="mdi mdi-chevron-down accordion-chevron"></i>
            </div>
          </summary>
          <div class="device-row-body">
            <div class="action-tile-grid action-tile-grid-4">
              <button class="action-tile" data-action="power-on" data-device="${bulb.deviceName}" disabled>
                <i class="mdi mdi-lightbulb-on"></i>
                <span>On</span>
              </button>
              <button class="action-tile" data-action="power-off" data-device="${bulb.deviceName}" disabled>
                <i class="mdi mdi-lightbulb-off"></i>
                <span>Off</span>
              </button>
              <button class="action-tile" data-action="adjust" data-device="${bulb.deviceName}" title="Color & Brightness" disabled>
                <i class="mdi mdi-palette"></i>
                <span>Color</span>
              </button>
              <button class="action-tile" data-action="details" data-device="${bulb.deviceName}">
                <i class="mdi mdi-information-outline"></i>
                <span>Info</span>
              </button>
              <button class="action-tile" data-action="save-preset" data-device="${bulb.deviceName}" title="Save Preset" disabled>
                <i class="mdi mdi-content-save-outline"></i>
                <span>Save</span>
              </button>
              <button class="action-tile" data-action="apply-preset" data-device="${bulb.deviceName}" title="Apply Preset">
                <i class="mdi mdi-bookmark-check"></i>
                <span>Apply</span>
              </button>
              <button class="action-tile" data-action="effects" data-device="${bulb.deviceName}" disabled>
                <i class="mdi mdi-creation"></i>
                <span>Effects</span>
              </button>
              <button class="action-tile" data-action="reset-default" data-device="${bulb.deviceName}" disabled>
                <i class="mdi mdi-backup-restore"></i>
                <span>Reset</span>
              </button>
            </div>
          </div>
        </details>
      `,
    ).join("");
  }

  setupHandlers() {
    const backBtn = this.container.querySelector("#bulbs-back-btn");
    const refreshBtn = this.container.querySelector("#bulbs-refresh-btn");
    const managePresetsBtn = this.container.querySelector("#manage-presets-btn");
    const selectAllBtn = this.container.querySelector("#bulbs-select-all-btn");
    const optionsBtn = this.container.querySelector("#bulbs-options-btn");
    const optionsDropdown = this.container.querySelector("#bulbs-options-dropdown");
    const optionsBackdrop = this.container.querySelector("#bulbs-options-backdrop");
    const deviceList = this.container.querySelector("#bulbs-device-list");

    backBtn.addEventListener("click", () => this.onBack());
    refreshBtn.addEventListener("click", () => this.handleRefresh());
    managePresetsBtn.addEventListener("click", () => this.openPresetPicker(null));
    selectAllBtn.addEventListener("click", () => this.toggleSelectAll());

    optionsBtn.addEventListener("click", () => {
      optionsDropdown.classList.add("open");
      optionsBackdrop.classList.add("visible");
    });
    optionsBackdrop.addEventListener("click", () => {
      optionsDropdown.classList.remove("open");
      optionsBackdrop.classList.remove("visible");
    });
    optionsDropdown.addEventListener("click", (e) => {
      if (e.target.closest(".hero-dropdown-item")) {
        optionsDropdown.classList.remove("open");
        optionsBackdrop.classList.remove("visible");
      }
    });

    deviceList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const deviceName = btn.getAttribute("data-device");
      const action = btn.getAttribute("data-action");

      if (action === "details") {
        this.openBulbDetailsModal(deviceName);
      } else if (action === "adjust") {
        this.openLightControlModal(deviceName);
      } else if (action === "toggle-select") {
        e.preventDefault();
        e.stopPropagation();
        this.toggleDeviceSelection(deviceName, btn);
      } else if (action === "save-preset") {
        this.openPresetModal(deviceName);
      } else if (action === "apply-preset") {
        this.openPresetPicker(deviceName);
      } else if (action === "effects") {
        this.openLightControlModal(deviceName, "effect");
      } else if (action === "reset-default") {
        this.handleResetToDefault(deviceName, btn);
      } else if (action === "power-on") {
        this.handlePowerButtonClick(deviceName, true, btn);
      } else if (action === "power-off") {
        this.handlePowerButtonClick(deviceName, false, btn);
      }
    });

    this.setupSelectionBar();
    this.setupPresetNameModal();
    this.setupPresetPickerModal();
    this.setupBulbDetailsModal();
    this.setupConfirmDeleteModal();
    this.setupLightControlModal();
  }

  setupSelectionBar() {
    const onBtn = this.container.querySelector("#selection-power-on-btn");
    const offBtn = this.container.querySelector("#selection-power-off-btn");
    const adjustBtn = this.container.querySelector("#selection-adjust-btn");
    const presetBtn = this.container.querySelector("#selection-preset-btn");
    const effectBtn = this.container.querySelector("#selection-effect-btn");

    onBtn.addEventListener("click", () => this.handleGroupPower(true));
    offBtn.addEventListener("click", () => this.handleGroupPower(false));
    adjustBtn.addEventListener("click", () => {
      if (this.selectedDevices.size === 0) return;
      this.openLightControlModal(Array.from(this.selectedDevices));
    });
    presetBtn.addEventListener("click", () => {
      if (this.selectedDevices.size === 0) return;
      this.openPresetPicker(Array.from(this.selectedDevices));
    });
    effectBtn.addEventListener("click", () => {
      if (this.selectedDevices.size === 0) return;
      this.openLightControlModal(Array.from(this.selectedDevices), "effect");
    });
  }

  // Selecting all is just "select every bulb that isn't already selected" —
  // and tapping it again when everything's already selected clears it, so it
  // doubles as a clear-all without needing a separate cancel control.
  toggleSelectAll() {
    const allSelected = this.selectedDevices.size === KNOWN_BULBS.length;
    const list = this.container.querySelector("#bulbs-device-list");

    KNOWN_BULBS.forEach((bulb) => {
      const shouldSelect = !allSelected;
      const btn = list.querySelector(`.select-check-btn[data-device="${bulb.deviceName}"]`);
      if (shouldSelect) {
        this.selectedDevices.add(bulb.deviceName);
      } else {
        this.selectedDevices.delete(bulb.deviceName);
      }
      if (btn) {
        btn.classList.toggle("selected", shouldSelect);
        btn.querySelector("i").className = shouldSelect ? "mdi mdi-checkbox-marked-circle" : "mdi mdi-checkbox-blank-circle-outline";
      }
    });

    this.updateSelectionBar();
  }

  toggleDeviceSelection(deviceName, btn) {
    const icon = btn.querySelector("i");
    if (this.selectedDevices.has(deviceName)) {
      this.selectedDevices.delete(deviceName);
      btn.classList.remove("selected");
      icon.className = "mdi mdi-checkbox-blank-circle-outline";
    } else {
      this.selectedDevices.add(deviceName);
      btn.classList.add("selected");
      icon.className = "mdi mdi-checkbox-marked-circle";
    }
    this.updateSelectionBar();
  }

  updateSelectionBar() {
    const bar = this.container.querySelector("#bulbs-selection-bar");
    const count = this.selectedDevices.size;

    bar.classList.toggle("hidden", count === 0);
    this.container.querySelector("#selection-power-on-btn").disabled = count === 0;
    this.container.querySelector("#selection-power-off-btn").disabled = count === 0;
    this.container.querySelector("#selection-adjust-btn").disabled = count === 0;
    this.container.querySelector("#selection-preset-btn").disabled = count === 0;
    this.container.querySelector("#selection-effect-btn").disabled = count === 0;

    const selectAllBtn = this.container.querySelector("#bulbs-select-all-btn");
    const allSelected = count > 0 && count === KNOWN_BULBS.length;
    selectAllBtn.classList.toggle("active", allSelected);
    selectAllBtn.querySelector("i").className = allSelected ? "mdi mdi-checkbox-marked-circle" : "mdi mdi-checkbox-blank-circle-outline";
    selectAllBtn.querySelector("span").textContent = allSelected ? "Deselect All" : "Select All";
  }

  async handleGroupPower(turnOn) {
    const devices = Array.from(this.selectedDevices);
    if (devices.length === 0) return;

    const messageContainer = this.container.querySelector("#bulbs-message-container");

    try {
      await this.runWithTokenRetry(() =>
        Promise.all(devices.map((d) => this.apiService.setLightPower(this.authService.getAccessToken(), d, turnOn))),
      );
      this.showMessage(messageContainer, "success", `${devices.length} light${devices.length > 1 ? "s" : ""} turned ${turnOn ? "ON" : "OFF"}`);
      setTimeout(() => this.loadLightStates(), 1000);
    } catch (error) {
      this.showMessage(messageContainer, "error", error.message);
    }
  }

  setupPresetNameModal() {
    const overlay = this.container.querySelector("#preset-name-overlay");
    const closeBtn = this.container.querySelector("#preset-name-close-btn");
    const confirmBtn = this.container.querySelector("#preset-name-confirm-btn");
    const input = this.container.querySelector("#preset-name-input");

    closeBtn.addEventListener("click", () => this.closePresetModal());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.closePresetModal();
    });
    confirmBtn.addEventListener("click", () => this.confirmSavePreset());
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.confirmSavePreset();
    });
  }

  setupPresetPickerModal() {
    const overlay = this.container.querySelector("#preset-picker-overlay");
    const closeBtn = this.container.querySelector("#preset-picker-close-btn");
    const list = this.container.querySelector("#preset-picker-list");

    closeBtn.addEventListener("click", () => this.closePresetPicker());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.closePresetPicker();
    });

    list.addEventListener("click", (e) => {
      const iconBtn = e.target.closest("button[data-action]");
      if (iconBtn) {
        const id = iconBtn.getAttribute("data-id");
        if (iconBtn.getAttribute("data-action") === "set-default") {
          this.handleSetDefault(id, iconBtn);
        } else if (iconBtn.getAttribute("data-action") === "delete-preset") {
          this.openConfirmDeleteModal(id);
        }
        return;
      }

      const row = e.target.closest(".preset-row[data-id]");
      if (row && this.pendingApplyDevices.length > 0) {
        this.handleApplyPreset(row.getAttribute("data-id"));
      }
    });
  }

  setupBulbDetailsModal() {
    const overlay = this.container.querySelector("#bulb-details-overlay");
    const closeBtn = this.container.querySelector("#bulb-details-close-btn");

    closeBtn.addEventListener("click", () => this.closeBulbDetailsModal());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.closeBulbDetailsModal();
    });
  }

  setupConfirmDeleteModal() {
    const overlay = this.container.querySelector("#confirm-delete-overlay");
    const closeBtn = this.container.querySelector("#confirm-delete-close-btn");
    const cancelBtn = this.container.querySelector("#confirm-delete-cancel-btn");
    const confirmBtn = this.container.querySelector("#confirm-delete-confirm-btn");

    closeBtn.addEventListener("click", () => this.closeConfirmDeleteModal());
    cancelBtn.addEventListener("click", () => this.closeConfirmDeleteModal());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.closeConfirmDeleteModal();
    });
    confirmBtn.addEventListener("click", () => this.confirmDeletePreset());
  }

  setupLightControlModal() {
    const overlay = this.container.querySelector("#light-control-overlay");
    const closeBtn = this.container.querySelector("#light-control-close-btn");
    const brightnessSlider = overlay.querySelector('[data-role="brightness-slider"]');
    const modeToggle = overlay.querySelector('[data-role="mode-toggle"]');
    const tempSlider = overlay.querySelector('[data-role="temp-slider"]');
    const wrap = overlay.querySelector('[data-role="wheel-wrap"]');
    const effectGrid = overlay.querySelector(".effect-option-grid");
    const effectSpeedSlider = overlay.querySelector('[data-role="effect-speed-slider"]');

    closeBtn.addEventListener("click", () => this.closeLightControlModal());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.closeLightControlModal();
    });

    brightnessSlider.addEventListener("input", () => {
      overlay.querySelector('[data-role="brightness-value"]').textContent = `${brightnessSlider.value}%`;
    });
    brightnessSlider.addEventListener("change", () => {
      this.handleBrightnessChange(this.pendingControlDevices, Number(brightnessSlider.value));
    });

    modeToggle.addEventListener("click", (e) => {
      const btn = e.target.closest(".mode-toggle-btn");
      if (!btn || btn.classList.contains("active")) return;
      this.switchLightControlMode(overlay, this.pendingControlDevices, btn.getAttribute("data-mode"));
    });

    tempSlider.addEventListener("input", () => {
      overlay.querySelector('[data-role="temp-value"]').textContent = `${tempSlider.value}K`;
    });
    tempSlider.addEventListener("change", () => {
      this.handleColorTempChange(this.pendingControlDevices, Number(tempSlider.value));
    });

    this.drawColorWheel(overlay.querySelector('[data-role="color-wheel"]'));
    this.setupColorWheelDrag(wrap, (hex) => this.handleColorChange(this.pendingControlDevices, hex));

    effectGrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".effect-option-btn");
      if (!btn) return;
      effectGrid.querySelectorAll(".effect-option-btn").forEach((b) => b.classList.toggle("active", b === btn));
      this.handleEffectChange(this.pendingControlDevices, btn.getAttribute("data-effect"));
    });

    effectSpeedSlider.addEventListener("input", () => {
      overlay.querySelector('[data-role="effect-speed-value"]').textContent = `${effectSpeedSlider.value}%`;
    });
    effectSpeedSlider.addEventListener("change", () => {
      this.handleEffectSpeedChange(this.pendingControlDevices, Number(effectSpeedSlider.value));
    });
  }

  openLightControlModal(deviceNameOrNames, initialMode) {
    const devices = Array.isArray(deviceNameOrNames) ? deviceNameOrNames : [deviceNameOrNames];
    this.pendingControlDevices = devices;
    const overlay = this.container.querySelector("#light-control-overlay");
    this.container.querySelector("#light-control-title").textContent =
      devices.length === 1 ? this.getBulbLabel(devices[0]) : `${devices.length} Lights`;

    // Seed each device's known effect from its live state the first time we see
    // it, so a color/white/brightness change made without ever opening the
    // Effect tab this session still knows an effect is running and needs to be
    // kept, instead of silently cancelling it.
    devices.forEach((d) => {
      if (this.lastEffect[d] === undefined) {
        this.lastEffect[d] = (this.lightStates[d] || {}).effect;
      }
    });

    // Multiple devices may currently differ — the first selected device's state is
    // just the starting point shown in the modal; every slider/color change still
    // gets sent to all selected devices together.
    const state = this.lightStates[devices[0]] || {};
    this.populateColorControls(overlay, state, devices[0]);

    if (initialMode === "effect") {
      this.populateEffectControls(overlay, state);
      this.setLightControlMode(overlay, "effect");
    }

    overlay.classList.add("visible");
  }

  closeLightControlModal() {
    this.pendingControlDevices = [];
    this.container.querySelector("#light-control-overlay").classList.remove("visible");
  }

  populateColorControls(root, state, deviceName) {
    // Keep each device's last-used color and last-used white temp around,
    // independent of which mode it's actually in right now — the bulb only
    // reports live data for its *current* mode, so this is what lets switching
    // tabs restore the other mode's last value instead of guessing.
    if (deviceName) {
      if (state.color_mode === "color_temp" && typeof state.color_temp === "number") {
        this.lastColorTemp[deviceName] = Math.round(1000000 / state.color_temp);
      } else if (state.color) {
        const hex = this.deriveColorHex(state);
        if (hex) this.lastColorHex[deviceName] = hex;
      }
    }
    const rememberedTemp = deviceName ? this.lastColorTemp[deviceName] : undefined;
    const rememberedHex = deviceName ? this.lastColorHex[deviceName] : undefined;

    const brightnessSlider = root.querySelector('[data-role="brightness-slider"]');
    const percent = typeof state.brightness === "number" ? Math.round((state.brightness / 254) * 100) : 100;
    brightnessSlider.value = Math.min(100, Math.max(1, percent));
    root.querySelector('[data-role="brightness-value"]').textContent = `${brightnessSlider.value}%`;

    const tempSlider = root.querySelector('[data-role="temp-slider"]');
    const kelvin = rememberedTemp ?? (typeof state.color_temp === "number" ? Math.round(1000000 / state.color_temp) : 4000);
    tempSlider.value = Math.min(COLOR_TEMP_MAX_KELVIN, Math.max(COLOR_TEMP_MIN_KELVIN, kelvin));
    root.querySelector('[data-role="temp-value"]').textContent = `${tempSlider.value}K`;

    const color = state.color;
    let hue = 0;
    let saturation = 0;
    if (!rememberedHex && state.color_mode !== "color_temp" && color && typeof color.hue === "number" && typeof color.saturation === "number") {
      hue = color.hue;
      saturation = color.saturation;
    } else {
      const hex = rememberedHex || this.deriveColorHex(state) || "#ffffff";
      const [r, g, b] = this.hexToRgb(hex);
      [hue, saturation] = this.rgbToHsv(r, g, b);
    }
    this.positionColorWheelCursor(root.querySelector('[data-role="wheel-wrap"]'), hue, saturation);

    this.setLightControlMode(root, state.color_mode === "color_temp" ? "white" : "color");
  }

  setLightControlMode(root, mode) {
    root.querySelectorAll(".mode-toggle-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-mode") === mode);
    });
    root.querySelector(".color-picker-row").classList.toggle("hidden", mode !== "color");
    root.querySelector(".color-temp-row").classList.toggle("hidden", mode !== "white");
    root.querySelector(".effect-row").classList.toggle("hidden", mode !== "effect");
  }

  // Clicking a mode tab doesn't just swap which controls are visible — it actually
  // switches the bulb's color mode, re-sending whichever value (color or white
  // temp) was last used so the device genuinely changes instead of just the UI.
  // Switching into the Effect tab is the exception: there's no sensible "last
  // effect" to blindly resend, so it just reveals the controls and waits for a tap.
  switchLightControlMode(root, devices, mode) {
    this.setLightControlMode(root, mode);
    if (!devices || devices.length === 0) return;

    if (mode === "effect") {
      this.populateEffectControls(root, this.lightStates[devices[0]] || {});
      return;
    }

    const deviceName = devices[0];
    if (mode === "white") {
      const tempSlider = root.querySelector('[data-role="temp-slider"]');
      const kelvin = this.lastColorTemp[deviceName] ?? Number(tempSlider.value);
      tempSlider.value = kelvin;
      root.querySelector('[data-role="temp-value"]').textContent = `${kelvin}K`;
      this.handleColorTempChange(devices, kelvin);
    } else {
      const hex = this.lastColorHex[deviceName] || root.querySelector(".color-hex-value").textContent;
      this.handleColorChange(devices, hex);
    }
  }

  populateEffectControls(root, state) {
    const speed = typeof state.effect_speed === "number" ? state.effect_speed : 50;
    const speedSlider = root.querySelector('[data-role="effect-speed-slider"]');
    speedSlider.value = speed;
    root.querySelector('[data-role="effect-speed-value"]').textContent = `${speed}%`;

    // "rainbow" never matches — the device only ever reports one of the 5 real
    // effect values, never the synthetic composite.
    root.querySelectorAll(".effect-option-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-effect") === state.effect);
    });
  }

  drawColorWheel(canvas) {
    const size = canvas.width;
    const radius = size / 2;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(size, size);

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const dx = px - radius;
        const dy = py - radius;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (py * size + px) * 4;

        if (dist > radius) {
          imageData.data[idx + 3] = 0;
          continue;
        }

        let hue = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (hue < 0) hue += 360;
        const saturation = Math.min(1, dist / radius) * 100;
        const [r, g, b] = this.hsvToRgb(hue, saturation, 100);

        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  setupColorWheelDrag(wrap, onCommit) {
    let dragging = false;

    const updateFromPoint = (clientX, clientY, commit) => {
      const rect = wrap.getBoundingClientRect();
      const radius = rect.width / 2;
      const dx = clientX - rect.left - radius;
      const dy = clientY - rect.top - radius;
      const dist = Math.min(radius, Math.sqrt(dx * dx + dy * dy));

      let hue = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (hue < 0) hue += 360;
      const saturation = (dist / radius) * 100;

      const clampedX = radius + Math.cos((hue * Math.PI) / 180) * dist;
      const clampedY = radius + Math.sin((hue * Math.PI) / 180) * dist;
      const hex = this.applyColorWheelSelection(wrap, clampedX, clampedY, hue, saturation);

      if (commit) onCommit(hex);
    };

    wrap.addEventListener("pointerdown", (e) => {
      dragging = true;
      wrap.setPointerCapture(e.pointerId);
      updateFromPoint(e.clientX, e.clientY, false);
    });
    wrap.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      updateFromPoint(e.clientX, e.clientY, false);
    });
    wrap.addEventListener("pointerup", (e) => {
      if (!dragging) return;
      dragging = false;
      updateFromPoint(e.clientX, e.clientY, true);
    });
    wrap.addEventListener("pointercancel", () => {
      dragging = false;
    });
  }

  applyColorWheelSelection(wrap, cursorX, cursorY, hue, saturation) {
    const cursor = wrap.querySelector(".wheel-cursor");
    const hex = this.hsvToHex(hue, saturation, 100);

    cursor.style.left = `${cursorX}px`;
    cursor.style.top = `${cursorY}px`;
    cursor.style.background = hex;
    wrap.closest(".color-picker-row").querySelector(".color-hex-value").textContent = hex.toUpperCase();

    return hex;
  }

  positionColorWheelCursor(wrap, hue, saturation) {
    const radius = COLOR_WHEEL_SIZE / 2;
    const dist = (Math.min(100, saturation) / 100) * radius;
    const x = radius + Math.cos((hue * Math.PI) / 180) * dist;
    const y = radius + Math.sin((hue * Math.PI) / 180) * dist;
    this.applyColorWheelSelection(wrap, x, y, hue, saturation);
  }

  async applyLightSettings(devices, settings) {
    if (!devices || devices.length === 0) return;

    try {
      await this.runWithTokenRetry(() =>
        Promise.all(devices.map((d) => this.apiService.setLightState(this.authService.getAccessToken(), d, settings))),
      );
      setTimeout(() => this.loadLightStates(), 800);
    } catch (error) {
      this.showMessage(this.container.querySelector("#bulbs-message-container"), "error", error.message);
    }
  }

  // An effect is "active" for these purposes once it's been explicitly chosen
  // (or seeded from live device state) and isn't "off" — in that case brightness/
  // color/temp changes must re-send the full effect bundle instead of a bare
  // partial update, or they'd silently cancel the running effect.
  activeEffectFor(deviceName) {
    const effect = this.lastEffect[deviceName];
    return effect && effect !== "off" ? effect : null;
  }

  currentEffectSpeed() {
    return Number(this.container.querySelector('[data-role="effect-speed-slider"]').value);
  }

  handleBrightnessChange(devices, percent) {
    const activeEffect = this.activeEffectFor(devices[0]);
    if (activeEffect) {
      return this.applyLightSettings(devices, this.buildEffectPayload(devices[0], activeEffect, this.currentEffectSpeed()));
    }
    // Send the raw ZCL level (0-254) rather than "brightness_percent" — that
    // convenience key isn't guaranteed to be wired up by every Zigbee2MQTT device
    // converter, while the raw level is supported by every dimmable Zigbee bulb.
    return this.applyLightSettings(devices, { brightness: Math.round((percent / 100) * 254) });
  }

  handleColorTempChange(devices, kelvin) {
    devices.forEach((d) => { this.lastColorTemp[d] = kelvin; });
    const activeEffect = this.activeEffectFor(devices[0]);
    if (activeEffect) {
      devices.forEach((d) => { this.lastColorHex[d] = this.kelvinToHex(kelvin); });
      return this.applyLightSettings(devices, this.buildEffectPayload(devices[0], activeEffect, this.currentEffectSpeed()));
    }
    return this.applyLightSettings(devices, { color_temp: Math.round(1000000 / kelvin) });
  }

  handleColorChange(devices, hex) {
    devices.forEach((d) => { this.lastColorHex[d] = hex; });
    const activeEffect = this.activeEffectFor(devices[0]);
    if (activeEffect) {
      return this.applyLightSettings(devices, this.buildEffectPayload(devices[0], activeEffect, this.currentEffectSpeed()));
    }
    return this.applyLightSettings(devices, { color: { hex } });
  }

  // Aqara's firmware only reliably animates the effect when state/brightness/
  // effect_colors ride along in the SAME /set payload as effect+effect_speed —
  // a bare {"effect":"breathing"} is known to silently no-op on some units
  // (confirmed against Zigbee2MQTT directly, not just this app). So every effect
  // change always sends the full bundle, never just the effect key alone.
  buildEffectPayload(deviceName, effect, speed) {
    const realEffect = effect === "rainbow" ? "fading" : effect;
    const colors = effect === "rainbow" ? RAINBOW_COLORS : this.effectColorsFor(deviceName, effect);
    const brightnessSlider = this.container.querySelector('[data-role="brightness-slider"]');
    const brightness = Math.round((Number(brightnessSlider.value) / 100) * 254);

    return {
      state: "ON",
      brightness,
      effect: realEffect,
      effect_speed: speed,
      effect_colors: colors,
    };
  }

  // Only "fading" cross-fades THROUGH the effect_colors list, so it's the only
  // one that needs a second stop to fade to — breathing/candlelight/flash pulse
  // or flicker a single color, and jump jarringly between hues if handed two
  // very different ones. So the complement-color trick is scoped to fading only.
  effectColorsFor(deviceName, effect) {
    const hex = this.lastColorHex[deviceName] || "#ff8800";
    const [r, g, b] = this.hexToRgb(hex);
    if (effect !== "fading") {
      return [{ r, g, b }];
    }
    const [hue, saturation] = this.rgbToHsv(r, g, b);
    const complementHex = this.hsvToHex((hue + 180) % 360, Math.max(saturation, 40), 100);
    const [cr, cg, cb] = this.hexToRgb(complementHex);
    return [{ r, g, b }, { r: cr, g: cg, b: cb }];
  }

  // "Off" isn't a device effect worth sending — it means "stop doing effects",
  // which this app treats as "go back to the default preset" rather than
  // literally writing effect:"off" (which would just leave whatever color/
  // brightness the effect last left behind).
  handleEffectChange(devices, effect) {
    if (!devices || devices.length === 0) return;
    devices.forEach((d) => { this.lastEffect[d] = effect; });

    if (effect === "off") {
      return this.resetDevicesToDefault(devices);
    }
    return this.applyLightSettings(devices, this.buildEffectPayload(devices[0], effect, this.currentEffectSpeed()));
  }

  handleEffectSpeedChange(devices, speed) {
    if (!devices || devices.length === 0) return;
    const effect = this.lastEffect[devices[0]] || "breathing";
    return this.applyLightSettings(devices, this.buildEffectPayload(devices[0], effect, speed));
  }

  async handleResetToDefault(deviceName, btn) {
    return this.resetDevicesToDefault([deviceName], btn);
  }

  async resetDevicesToDefault(devices, btn) {
    if (!devices || devices.length === 0) return;
    const messageContainer = this.container.querySelector("#bulbs-message-container");
    if (btn) btn.disabled = true;

    try {
      await this.runWithTokenRetry(() =>
        Promise.all(devices.map((d) => this.apiService.resetLightToDefault(this.authService.getAccessToken(), d))),
      );
      devices.forEach((d) => { this.lastEffect[d] = "off"; });
      const target = devices.length === 1 ? this.getBulbLabel(devices[0]) : `${devices.length} lights`;
      this.showMessage(messageContainer, "success", `${target} reset to default preset`);
      setTimeout(() => this.loadLightStates(), 1000);
    } catch (error) {
      this.showMessage(messageContainer, "error", error.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // Best-effort preview only — actual color commands are sent as hex and converted
  // device-side by Zigbee2MQTT, which knows the bulb's real gamut.
  deriveColorHex(state) {
    const color = state.color;
    if (!color) return null;

    if (typeof color.hue === "number" && typeof color.saturation === "number") {
      return this.hsvToHex(color.hue, color.saturation, 100);
    }
    if (typeof color.x === "number" && typeof color.y === "number") {
      return this.xyToHex(color.x, color.y);
    }
    if (typeof color.r === "number" && typeof color.g === "number" && typeof color.b === "number") {
      return this.rgbToHex(color.r, color.g, color.b);
    }
    return null;
  }

  hsvToHex(h, s, v) {
    return this.rgbToHex(...this.hsvToRgb(h, s, v));
  }

  hsvToRgb(h, s, v) {
    s /= 100;
    v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let rgb = [0, 0, 0];
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return rgb.map((v) => Math.round((v + m) * 255));
  }

  rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let hue = 0;
    if (delta !== 0) {
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
    }
    if (hue < 0) hue += 360;

    const saturation = max === 0 ? 0 : (delta / max) * 100;
    return [hue, saturation];
  }

  hexToRgb(hex) {
    const clean = hex.replace("#", "");
    return [
      parseInt(clean.substring(0, 2), 16),
      parseInt(clean.substring(2, 4), 16),
      parseInt(clean.substring(4, 6), 16),
    ];
  }

  xyToHex(x, y) {
    const z = 1 - x - y;
    const Y = 1;
    const X = y > 0 ? (Y / y) * x : 0;
    const Z = y > 0 ? (Y / y) * z : 0;

    let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
    let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
    let b = X * 0.051713 - Y * 0.121364 + Z * 1.01153;

    [r, g, b] = [r, g, b].map((c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));

    const max = Math.max(r, g, b, 0.0001);
    if (max > 1) {
      r /= max;
      g /= max;
      b /= max;
    }

    return this.rgbToHex(...[r, g, b].map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255)));
  }

  rgbToHex(r, g, b) {
    return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
  }

  openConfirmDeleteModal(id) {
    const preset = this.presets.find((p) => String(p.id) === String(id));
    this.pendingDeleteId = id;
    this.container.querySelector("#confirm-delete-message").textContent = preset
      ? `Delete "${preset.name}"? This can't be undone.`
      : "Delete this preset? This can't be undone.";
    this.container.querySelector("#confirm-delete-overlay").classList.add("visible");
  }

  closeConfirmDeleteModal() {
    this.pendingDeleteId = null;
    this.container.querySelector("#confirm-delete-overlay").classList.remove("visible");
  }

  async confirmDeletePreset() {
    const id = this.pendingDeleteId;
    if (!id) return;

    const confirmBtn = this.container.querySelector("#confirm-delete-confirm-btn");
    confirmBtn.disabled = true;

    try {
      await this.runWithTokenRetry(() => this.apiService.deletePreset(this.authService.getAccessToken(), id));
      this.closeConfirmDeleteModal();
      this.loadPresets();
    } catch (error) {
      this.showMessage(this.container.querySelector("#bulbs-message-container"), "error", error.message);
    } finally {
      confirmBtn.disabled = false;
    }
  }

  async runWithTokenRetry(action) {
    try {
      return await action();
    } catch (error) {
      if (error.message === "TOKEN_EXPIRED") {
        const reLoginSuccess = await this.authService.handleTokenExpired();
        if (!reLoginSuccess) {
          this.onLogout();
          throw error;
        }
        return await action();
      }
      throw error;
    }
  }

  async loadLightStates() {
    try {
      this.lightStates = await this.runWithTokenRetry(() =>
        this.apiService.getLightStates(this.authService.getAccessToken()),
      );
      KNOWN_BULBS.forEach((bulb) => this.updateBulbRow(bulb.deviceName, this.lightStates[bulb.deviceName] || {}));
    } catch (error) {
      console.warn("BulbsPage: Failed to load light states", error);
    }
  }

  updateBulbRow(deviceName, state) {
    const row = this.container.querySelector(`.device-row[data-device="${deviceName}"]`);
    if (!row) return;

    const badge = row.querySelector('[data-role="state-badge"]');
    const powerOnBtn = row.querySelector('button[data-action="power-on"]');
    const powerOffBtn = row.querySelector('button[data-action="power-off"]');
    const saveBtn = row.querySelector('button[data-action="save-preset"]');
    const adjustBtn = row.querySelector('button[data-action="adjust"]');
    const effectsBtn = row.querySelector('button[data-action="effects"]');
    const resetBtn = row.querySelector('button[data-action="reset-default"]');
    const bulbIcon = row.querySelector(".bulb-icon i");

    const hasData = state && Object.keys(state).length > 0;
    const hasDefaultPreset = this.presets.some((p) => p.default);
    saveBtn.disabled = !hasData;
    powerOnBtn.disabled = !hasData;
    powerOffBtn.disabled = !hasData;
    adjustBtn.disabled = !hasData;
    effectsBtn.disabled = !hasData;
    resetBtn.disabled = !hasData || !hasDefaultPreset;

    if (!hasData) {
      badge.className = "status-badge status-checking";
      badge.innerHTML = '<span class="status-dot"></span><span>No Data</span>';
      this.setBulbIconColor(deviceName, bulbIcon, null);
      return;
    }

    const isOn = state.state === "ON";
    badge.className = isOn ? "status-badge status-online" : "status-badge status-offline";
    badge.innerHTML = `<span class="status-dot"></span><span>${state.state || "Unknown"}</span>`;

    this.setBulbIconColor(deviceName, bulbIcon, isOn ? this.computeBulbColor(state) : null);
  }

  // Applies the bulb's color to its row icon, with a one-shot "ignite" glow
  // animation that only plays when the color actually changes (first real data
  // arriving, turning on, or switching hue) — not on every identical poll.
  setBulbIconColor(deviceName, bulbIcon, color) {
    const prev = this.lastBulbIconColor[deviceName];
    this.lastBulbIconColor[deviceName] = color;

    bulbIcon.style.color = color || "";
    bulbIcon.classList.toggle("is-on", !!color);

    if (color && color !== prev) {
      bulbIcon.classList.remove("igniting");
      void bulbIcon.offsetWidth; // restart the animation even if it's already mid-play
      bulbIcon.classList.add("igniting");
    } else if (!color) {
      bulbIcon.classList.remove("igniting");
    }
  }

  // Shows the bulb's actual current color on its row icon: the live hue/saturation
  // (or xy/rgb) while in color mode, or an approximate black-body tint derived from
  // color_temp while in white mode — falls back to the default icon color (CSS)
  // when it's off or nothing's determinable.
  computeBulbColor(state) {
    if (state.color_mode === "color_temp" && typeof state.color_temp === "number") {
      return this.kelvinToHex(Math.round(1000000 / state.color_temp));
    }
    return this.deriveColorHex(state);
  }

  // Approximates the RGB tint of a given correlated color temperature using the
  // standard black-body radiation curve fit (Tanner Helland's algorithm) — good
  // enough for a decorative icon tint, not meant to be colorimetrically exact.
  kelvinToHex(kelvin) {
    const temp = kelvin / 100;

    const r = temp <= 66 ? 255 : 329.698727446 * Math.pow(temp - 60, -0.1332047592);

    const g =
      temp <= 66
        ? 99.4708025861 * Math.log(temp) - 161.1195681661
        : 288.1221695283 * Math.pow(temp - 60, -0.0755148492);

    const b = temp >= 66 ? 255 : temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;

    return this.rgbToHex(...[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c)))));
  }

  openBulbDetailsModal(deviceName) {
    const state = this.lightStates[deviceName] || {};
    this.container.querySelector("#bulb-details-title").textContent = this.getBulbLabel(deviceName);

    const list = this.container.querySelector("#bulb-details-list");
    const rows = INFO_FIELDS.filter((field) => state[field.key] !== undefined)
      .map((field) => {
        const raw = state[field.key];
        const value = field.format ? field.format(raw) : raw;
        return `
          <div class="info-row">
            <span class="info-label"><i class="mdi ${field.icon}"></i><span>${field.label}</span></span>
            <span class="info-value">${value}</span>
          </div>
        `;
      })
      .join("");

    list.innerHTML =
      rows ||
      '<div class="info-row"><span class="info-label"><i class="mdi mdi-information-outline"></i><span>No data yet — tap refresh</span></span></div>';

    this.container.querySelector("#bulb-details-overlay").classList.add("visible");
  }

  closeBulbDetailsModal() {
    this.container.querySelector("#bulb-details-overlay").classList.remove("visible");
  }

  async handleRefresh() {
    const refreshBtn = this.container.querySelector("#bulbs-refresh-btn");
    const messageContainer = this.container.querySelector("#bulbs-message-container");
    refreshBtn.disabled = true;
    refreshBtn.querySelector("i").classList.add("spin");

    try {
      await this.runWithTokenRetry(() => this.apiService.refreshLights(this.authService.getAccessToken()));
      // The refresh request just asks Zigbee2MQTT to re-report state — give it a
      // beat to actually arrive over MQTT before re-polling, then confirm with a
      // toast so the action doesn't look like a no-op when nothing had changed.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await this.loadLightStates();
      this.showMessage(messageContainer, "success", "Lights refreshed");
    } catch (error) {
      this.showMessage(messageContainer, "error", error.message);
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.querySelector("i").classList.remove("spin");
    }
  }

  async handlePowerButtonClick(deviceName, turnOn, btn) {
    const messageContainer = this.container.querySelector("#bulbs-message-container");
    btn.disabled = true;

    try {
      await this.runWithTokenRetry(() => this.apiService.setLightPower(this.authService.getAccessToken(), deviceName, turnOn));
      this.showMessage(messageContainer, "success", `${this.getBulbLabel(deviceName)} turned ${turnOn ? "ON" : "OFF"}`);
      setTimeout(() => this.loadLightStates(), 1000);
    } catch (error) {
      this.showMessage(messageContainer, "error", error.message);
    } finally {
      btn.disabled = false;
    }
  }

  openPresetModal(deviceName) {
    this.pendingPresetDevice = deviceName;
    const overlay = this.container.querySelector("#preset-name-overlay");
    const input = this.container.querySelector("#preset-name-input");
    input.value = "";
    overlay.classList.add("visible");
    setTimeout(() => input.focus(), 50);
  }

  closePresetModal() {
    this.pendingPresetDevice = null;
    this.container.querySelector("#preset-name-overlay").classList.remove("visible");
  }

  async confirmSavePreset() {
    const input = this.container.querySelector("#preset-name-input");
    const name = input.value.trim();
    const messageContainer = this.container.querySelector("#bulbs-message-container");

    if (!name || !this.pendingPresetDevice) return;

    const confirmBtn = this.container.querySelector("#preset-name-confirm-btn");
    confirmBtn.disabled = true;

    try {
      await this.runWithTokenRetry(() =>
        this.apiService.createPreset(this.authService.getAccessToken(), this.pendingPresetDevice, name),
      );
      this.closePresetModal();
      this.showMessage(messageContainer, "success", `Preset "${name}" saved`);
      this.loadPresets();
    } catch (error) {
      this.showMessage(messageContainer, "error", error.message);
    } finally {
      confirmBtn.disabled = false;
    }
  }

  openPresetPicker(deviceNameOrNames) {
    const devices = !deviceNameOrNames ? [] : Array.isArray(deviceNameOrNames) ? deviceNameOrNames : [deviceNameOrNames];
    this.pendingApplyDevices = devices;

    const title = this.container.querySelector("#preset-picker-title");
    title.textContent =
      devices.length === 0
        ? "Manage Presets"
        : devices.length === 1
          ? `Apply to ${this.getBulbLabel(devices[0])}`
          : `Apply to ${devices.length} Lights`;

    // Render from the already-loaded cache first so the modal opens fully laid out —
    // fetching after showing it causes a visible height/scrollbar jump as content pops in.
    this.renderPresetPicker();
    this.container.querySelector("#preset-picker-overlay").classList.add("visible");
  }

  closePresetPicker() {
    this.pendingApplyDevices = [];
    this.container.querySelector("#preset-picker-overlay").classList.remove("visible");
  }

  async loadPresets() {
    try {
      this.presets = await this.runWithTokenRetry(() => this.apiService.listPresets(this.authService.getAccessToken()));
      this.renderPresetPicker();
      // Whether a default preset exists affects the Reset tile's enabled state,
      // independent of the light-state poll — refresh it for every known bulb.
      KNOWN_BULBS.forEach((bulb) => this.updateBulbRow(bulb.deviceName, this.lightStates[bulb.deviceName] || {}));
    } catch (error) {
      console.warn("BulbsPage: Failed to load presets", error);
    }
  }

  renderPresetPicker() {
    const list = this.container.querySelector("#preset-picker-list");
    const emptyState = this.container.querySelector("#preset-picker-empty-state");

    if (this.presets.length === 0) {
      list.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    const applyable = this.pendingApplyDevices.length > 0;

    list.innerHTML = this.presets
      .map((preset) => {
        const isDefault = !!preset.default;
        return `
          <div class="preset-row ${applyable ? "preset-row-selectable" : ""}" data-id="${preset.id}">
            <div class="preset-row-main">
              <div class="preset-icon"><i class="mdi mdi-bookmark"></i></div>
              <div class="preset-row-name">${preset.name}</div>
            </div>
            <div class="preset-row-actions">
              ${
                isDefault
                  ? '<span class="default-badge" title="Default"><i class="mdi mdi-star"></i></span>'
                  : `<button class="icon-btn" data-action="set-default" data-id="${preset.id}" title="Set as default"><i class="mdi mdi-star-outline"></i></button>`
              }
              <button class="icon-btn danger" data-action="delete-preset" data-id="${preset.id}" title="Delete preset">
                <i class="mdi mdi-trash-can-outline"></i>
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  async handleApplyPreset(presetId) {
    const messageContainer = this.container.querySelector("#bulbs-message-container");
    const devices = this.pendingApplyDevices;
    if (devices.length === 0) return;

    try {
      await this.runWithTokenRetry(() =>
        Promise.all(devices.map((d) => this.apiService.applyPreset(this.authService.getAccessToken(), d, presetId))),
      );
      this.closePresetPicker();
      const target = devices.length === 1 ? this.getBulbLabel(devices[0]) : `${devices.length} lights`;
      this.showMessage(messageContainer, "success", `Preset applied to ${target}`);
      setTimeout(() => this.loadLightStates(), 1200);
    } catch (error) {
      this.showMessage(messageContainer, "error", error.message);
    }
  }

  async handleSetDefault(id, btn) {
    btn.disabled = true;
    try {
      await this.runWithTokenRetry(() => this.apiService.setDefaultPreset(this.authService.getAccessToken(), id));
      this.loadPresets();
    } catch (error) {
      this.showMessage(this.container.querySelector("#bulbs-message-container"), "error", error.message);
      btn.disabled = false;
    }
  }

  showMessage(container, type, message) {
    const icon = type === "success" ? "mdi-check-circle" : "mdi-alert-circle";
    container.innerHTML = `
      <div class="${type}-message">
        <i class="mdi ${icon}"></i>
        <span>${message}</span>
      </div>
    `;
    if (type === "success") {
      setTimeout(() => {
        container.innerHTML = "";
      }, 3000);
    }
  }
}
