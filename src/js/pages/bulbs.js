import bulbsTemplate from "../../pages/bulbs.html?raw";

const KNOWN_BULBS = [
  { deviceName: "OfficeLight1", label: "Office Light 1" },
  { deviceName: "OfficeLight2", label: "Office Light 2" },
];

const COLOR_TEMP_MIN_KELVIN = 2000;
const COLOR_TEMP_MAX_KELVIN = 6500;

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
    this.selectionMode = false;
    this.selectedDevices = new Set();
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
              <button class="icon-btn" data-action="adjust" data-device="${bulb.deviceName}" title="Color & Brightness" disabled>
                <i class="mdi mdi-palette"></i>
              </button>
              <button class="icon-btn" data-action="details" data-device="${bulb.deviceName}" title="Details">
                <i class="mdi mdi-information-outline"></i>
              </button>
              <i class="mdi mdi-chevron-down accordion-chevron"></i>
            </div>
          </summary>
          <div class="device-row-body">
            <div class="info-list">
              <div class="info-row">
                <span class="info-label"><i class="mdi mdi-power"></i><span>State</span></span>
                <label class="toggle-switch">
                  <input type="checkbox" data-role="power-toggle" data-device="${bulb.deviceName}" disabled />
                  <span class="toggle-track"><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
            <div class="device-row-actions">
              <button class="btn-compact" data-action="save-preset" data-device="${bulb.deviceName}" disabled>
                <i class="mdi mdi-content-save-outline"></i>
                <span>Save Preset</span>
              </button>
              <button class="btn-compact" data-action="apply-preset" data-device="${bulb.deviceName}">
                <i class="mdi mdi-palette-swatch"></i>
                <span>Apply Preset</span>
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
    const selectModeBtn = this.container.querySelector("#bulbs-select-btn");
    const deviceList = this.container.querySelector("#bulbs-device-list");

    backBtn.addEventListener("click", () => this.onBack());
    refreshBtn.addEventListener("click", () => this.handleRefresh());
    managePresetsBtn.addEventListener("click", () => this.openPresetPicker(null));
    selectModeBtn.addEventListener("click", () => this.toggleSelectionMode());

    deviceList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const deviceName = btn.getAttribute("data-device");
      const action = btn.getAttribute("data-action");

      if (action === "details") {
        e.preventDefault();
        e.stopPropagation();
        this.openBulbDetailsModal(deviceName);
      } else if (action === "adjust") {
        e.preventDefault();
        e.stopPropagation();
        this.openLightControlModal(deviceName);
      } else if (action === "toggle-select") {
        e.preventDefault();
        e.stopPropagation();
        this.toggleDeviceSelection(deviceName, btn);
      } else if (action === "save-preset") {
        this.openPresetModal(deviceName);
      } else if (action === "apply-preset") {
        this.openPresetPicker(deviceName);
      }
    });

    deviceList.addEventListener("change", (e) => {
      const toggle = e.target.closest('input[data-role="power-toggle"]');
      if (!toggle) return;
      this.handlePowerToggle(toggle.getAttribute("data-device"), toggle.checked, toggle);
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
  }

  toggleSelectionMode() {
    this.selectionMode = !this.selectionMode;
    this.selectedDevices.clear();

    const list = this.container.querySelector("#bulbs-device-list");
    list.classList.toggle("select-mode", this.selectionMode);
    list.querySelectorAll(".select-check-btn").forEach((btn) => {
      btn.classList.remove("selected");
      btn.querySelector("i").className = "mdi mdi-checkbox-blank-circle-outline";
    });

    const selectModeBtn = this.container.querySelector("#bulbs-select-btn");
    selectModeBtn.querySelector("i").className = this.selectionMode ? "mdi mdi-close" : "mdi mdi-checkbox-multiple-marked-outline";
    selectModeBtn.title = this.selectionMode ? "Cancel Selection" : "Select Multiple";

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

    bar.classList.toggle("hidden", !this.selectionMode);
    this.container.querySelector("#bulbs-selection-count").textContent = count === 0 ? "Select lights" : `${count} selected`;
    this.container.querySelector("#selection-power-on-btn").disabled = count === 0;
    this.container.querySelector("#selection-power-off-btn").disabled = count === 0;
    this.container.querySelector("#selection-adjust-btn").disabled = count === 0;
    this.container.querySelector("#selection-preset-btn").disabled = count === 0;
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
    const brightnessSlider = this.container.querySelector("#light-control-brightness-slider");
    const modeToggle = this.container.querySelector("#light-control-mode-toggle");
    const tempSlider = this.container.querySelector("#light-control-temp-slider");

    closeBtn.addEventListener("click", () => this.closeLightControlModal());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.closeLightControlModal();
    });

    brightnessSlider.addEventListener("input", () => {
      this.container.querySelector("#light-control-brightness-value").textContent = `${brightnessSlider.value}%`;
    });
    brightnessSlider.addEventListener("change", () => {
      this.handleBrightnessChange(Number(brightnessSlider.value));
    });

    modeToggle.addEventListener("click", (e) => {
      const btn = e.target.closest(".mode-toggle-btn");
      if (!btn) return;
      this.setLightControlMode(btn.getAttribute("data-mode"));
    });

    tempSlider.addEventListener("input", () => {
      this.container.querySelector("#light-control-temp-value").textContent = `${tempSlider.value}K`;
    });
    tempSlider.addEventListener("change", () => {
      this.handleColorTempChange(Number(tempSlider.value));
    });

    this.drawColorWheel(this.container.querySelector("#light-control-color-wheel"));
    this.setupColorWheelDrag();
  }

  openLightControlModal(deviceNameOrNames) {
    const devices = Array.isArray(deviceNameOrNames) ? deviceNameOrNames : [deviceNameOrNames];
    this.pendingControlDevices = devices;
    this.container.querySelector("#light-control-title").textContent =
      devices.length === 1 ? this.getBulbLabel(devices[0]) : `${devices.length} Lights`;

    // Multiple devices may currently differ — the first selected device's state is
    // just the starting point shown in the modal; every slider/color change still
    // gets sent to all selected devices together.
    const state = this.lightStates[devices[0]] || {};

    const brightnessSlider = this.container.querySelector("#light-control-brightness-slider");
    const percent = typeof state.brightness === "number" ? Math.round((state.brightness / 254) * 100) : 100;
    brightnessSlider.value = Math.min(100, Math.max(1, percent));
    this.container.querySelector("#light-control-brightness-value").textContent = `${brightnessSlider.value}%`;

    const tempSlider = this.container.querySelector("#light-control-temp-slider");
    const kelvin = typeof state.color_temp === "number" ? Math.round(1000000 / state.color_temp) : 4000;
    tempSlider.value = Math.min(COLOR_TEMP_MAX_KELVIN, Math.max(COLOR_TEMP_MIN_KELVIN, kelvin));
    this.container.querySelector("#light-control-temp-value").textContent = `${tempSlider.value}K`;

    const color = state.color;
    let hue = 0;
    let saturation = 0;
    if (color && typeof color.hue === "number" && typeof color.saturation === "number") {
      hue = color.hue;
      saturation = color.saturation;
    } else {
      const hex = this.deriveColorHex(state) || "#ffffff";
      const [r, g, b] = this.hexToRgb(hex);
      [hue, saturation] = this.rgbToHsv(r, g, b);
    }
    this.positionColorWheelCursor(hue, saturation);

    this.setLightControlMode(state.color_mode === "color_temp" ? "white" : "color");

    this.container.querySelector("#light-control-overlay").classList.add("visible");
  }

  closeLightControlModal() {
    this.pendingControlDevices = [];
    this.container.querySelector("#light-control-overlay").classList.remove("visible");
  }

  setLightControlMode(mode) {
    this.container.querySelectorAll("#light-control-mode-toggle .mode-toggle-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-mode") === mode);
    });
    this.container.querySelector("#light-control-color-row").classList.toggle("hidden", mode !== "color");
    this.container.querySelector("#light-control-temp-row").classList.toggle("hidden", mode !== "white");
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

  setupColorWheelDrag() {
    const wrap = this.container.querySelector("#light-control-wheel-wrap");
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
      const hex = this.applyColorWheelSelection(clampedX, clampedY, hue, saturation);

      if (commit) this.handleColorChange(hex);
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

  applyColorWheelSelection(cursorX, cursorY, hue, saturation) {
    const cursor = this.container.querySelector("#light-control-wheel-cursor");
    const hex = this.hsvToHex(hue, saturation, 100);

    cursor.style.left = `${cursorX}px`;
    cursor.style.top = `${cursorY}px`;
    cursor.style.background = hex;
    this.container.querySelector("#light-control-color-hex").textContent = hex.toUpperCase();

    return hex;
  }

  positionColorWheelCursor(hue, saturation) {
    const wrap = this.container.querySelector("#light-control-wheel-wrap");
    const radius = wrap.clientWidth / 2;
    const dist = (Math.min(100, saturation) / 100) * radius;
    const x = radius + Math.cos((hue * Math.PI) / 180) * dist;
    const y = radius + Math.sin((hue * Math.PI) / 180) * dist;
    this.applyColorWheelSelection(x, y, hue, saturation);
  }

  async applyToPendingDevices(settings) {
    const devices = this.pendingControlDevices;
    if (devices.length === 0) return;

    try {
      await this.runWithTokenRetry(() =>
        Promise.all(devices.map((d) => this.apiService.setLightState(this.authService.getAccessToken(), d, settings))),
      );
      setTimeout(() => this.loadLightStates(), 800);
    } catch (error) {
      this.showMessage(this.container.querySelector("#bulbs-message-container"), "error", error.message);
    }
  }

  handleBrightnessChange(percent) {
    // Send the raw ZCL level (0-254) rather than "brightness_percent" — that
    // convenience key isn't guaranteed to be wired up by every Zigbee2MQTT device
    // converter, while the raw level is supported by every dimmable Zigbee bulb.
    return this.applyToPendingDevices({ brightness: Math.round((percent / 100) * 254) });
  }

  handleColorTempChange(kelvin) {
    return this.applyToPendingDevices({ color_temp: Math.round(1000000 / kelvin) });
  }

  handleColorChange(hex) {
    return this.applyToPendingDevices({ color: { hex } });
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
    const toggle = row.querySelector('input[data-role="power-toggle"]');
    const saveBtn = row.querySelector('button[data-action="save-preset"]');
    const adjustBtn = row.querySelector('button[data-action="adjust"]');

    const hasData = state && Object.keys(state).length > 0;
    saveBtn.disabled = !hasData;
    toggle.disabled = !hasData;
    adjustBtn.disabled = !hasData;

    if (!hasData) {
      badge.className = "status-badge status-checking";
      badge.innerHTML = '<span class="status-dot"></span><span>No Data</span>';
      return;
    }

    const isOn = state.state === "ON";
    badge.className = isOn ? "status-badge status-online" : "status-badge status-offline";
    badge.innerHTML = `<span class="status-dot"></span><span>${state.state || "Unknown"}</span>`;
    toggle.checked = isOn;
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
    refreshBtn.disabled = true;
    refreshBtn.querySelector("i").classList.add("spin");

    try {
      await this.runWithTokenRetry(() => this.apiService.refreshLights(this.authService.getAccessToken()));
      setTimeout(() => this.loadLightStates(), 1200);
    } catch (error) {
      this.showMessage(this.container.querySelector("#bulbs-message-container"), "error", error.message);
    } finally {
      setTimeout(() => {
        refreshBtn.disabled = false;
        refreshBtn.querySelector("i").classList.remove("spin");
      }, 1200);
    }
  }

  async handlePowerToggle(deviceName, turnOn, toggleEl) {
    const messageContainer = this.container.querySelector("#bulbs-message-container");
    toggleEl.disabled = true;

    try {
      await this.runWithTokenRetry(() => this.apiService.setLightPower(this.authService.getAccessToken(), deviceName, turnOn));
      this.showMessage(messageContainer, "success", `${this.getBulbLabel(deviceName)} turned ${turnOn ? "ON" : "OFF"}`);
      setTimeout(() => this.loadLightStates(), 1000);
    } catch (error) {
      toggleEl.checked = !turnOn;
      this.showMessage(messageContainer, "error", error.message);
    } finally {
      toggleEl.disabled = false;
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
              <div class="preset-icon"><i class="mdi mdi-palette-swatch"></i></div>
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
