import bulbsTemplate from "../../pages/bulbs.html?raw";

const KNOWN_BULBS = [
  { deviceName: "OfficeLight1", label: "Office Light 1" },
  { deviceName: "OfficeLight2", label: "Office Light 2" },
];

const INFO_FIELDS = [
  { key: "state", label: "State", icon: "mdi-power" },
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
    this.pendingApplyDevice = null;
    this.pendingDeleteId = null;
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
              <div class="device-icon bulb-icon">
                <i class="mdi mdi-lightbulb"></i>
              </div>
              <div class="device-row-name">${bulb.label}</div>
            </div>
            <div class="device-row-header-right">
              <span class="status-badge status-checking" data-role="state-badge">
                <span class="status-dot"></span>
              </span>
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
              <button class="btn btn-secondary" data-action="save-preset" data-device="${bulb.deviceName}" disabled>
                <i class="mdi mdi-content-save-outline"></i>
                <span>Save as Preset</span>
              </button>
              <button class="btn btn-secondary" data-action="apply-preset" data-device="${bulb.deviceName}">
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
    const deviceList = this.container.querySelector("#bulbs-device-list");

    backBtn.addEventListener("click", () => this.onBack());
    refreshBtn.addEventListener("click", () => this.handleRefresh());
    managePresetsBtn.addEventListener("click", () => this.openPresetPicker(null));

    deviceList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const deviceName = btn.getAttribute("data-device");
      const action = btn.getAttribute("data-action");

      if (action === "details") {
        e.preventDefault();
        e.stopPropagation();
        this.openBulbDetailsModal(deviceName);
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

    this.setupPresetNameModal();
    this.setupPresetPickerModal();
    this.setupBulbDetailsModal();
    this.setupConfirmDeleteModal();
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
      if (row && this.pendingApplyDevice) {
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

    const hasData = state && Object.keys(state).length > 0;
    saveBtn.disabled = !hasData;
    toggle.disabled = !hasData;

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

  openPresetPicker(deviceName) {
    this.pendingApplyDevice = deviceName;
    const title = this.container.querySelector("#preset-picker-title");
    title.textContent = deviceName ? `Apply to ${this.getBulbLabel(deviceName)}` : "Manage Presets";

    // Render from the already-loaded cache first so the modal opens fully laid out —
    // fetching after showing it causes a visible height/scrollbar jump as content pops in.
    this.renderPresetPicker();
    this.container.querySelector("#preset-picker-overlay").classList.add("visible");
  }

  closePresetPicker() {
    this.pendingApplyDevice = null;
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

    const applyable = !!this.pendingApplyDevice;

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
    const deviceName = this.pendingApplyDevice;
    if (!deviceName) return;

    try {
      await this.runWithTokenRetry(() =>
        this.apiService.applyPreset(this.authService.getAccessToken(), deviceName, presetId),
      );
      this.closePresetPicker();
      this.showMessage(messageContainer, "success", `Preset applied to ${this.getBulbLabel(deviceName)}`);
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
