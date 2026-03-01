import homeTemplate from "../../pages/home.html?raw";
import { WebSocketService } from "../websocket.js";
import { themeManager } from "../theme.js";

export class HomePage {
  constructor(container, authService, apiService, onLogout) {
    this.container = container;
    this.authService = authService;
    this.apiService = apiService;
    this.onLogout = onLogout;

    this.garageOnline = false;
    this.triggerInProgress = false;
    this.statusCheckInProgress = false;
    this.wsConnected = false;

    this.tiltSensorData = {};
    this.vibrationSensorData = {};
    this.plugData = {};
    this.garageStatus = {};

    this.wsService = null;
  }

  render() {
    this.container.innerHTML = homeTemplate;
    this.setupHandlers();
    this.setupPullToRefresh();
    this.checkGarageStatus();
    this.initializeWebSocket();
    this.syncThemeSheet();
  }

  setupHandlers() {
    const logoutBtn = this.container.querySelector("#logout-btn");
    const triggerBtn = this.container.querySelector("#garage-trigger-btn");
    const refreshBtn = this.container.querySelector("#refresh-btn");
    const openBtn = this.container.querySelector("#open-btn");
    const closeBtn = this.container.querySelector("#close-btn");
    const resetBtn = this.container.querySelector("#reset-btn");
    const plugOnBtn = this.container.querySelector("#plug-on-btn");
    const plugOffBtn = this.container.querySelector("#plug-off-btn");
    const themeBtn = this.container.querySelector("#theme-btn");
    const themeOverlay = this.container.querySelector("#theme-overlay");
    const themeOptions = this.container.querySelectorAll(".theme-option");

    logoutBtn.addEventListener("click", async () => {
      if (this.wsService) {
        this.wsService.disconnect();
      }
      await this.authService.logout();
      this.onLogout();
    });

    refreshBtn.addEventListener("click", () => {
      this.checkGarageStatus();
    });

    triggerBtn.addEventListener("click", () => this.handleGarageTrigger());
    openBtn.addEventListener("click", () => this.handleGarageTrigger());
    closeBtn.addEventListener("click", () => this.handleGarageTrigger());
    resetBtn.addEventListener("click", () => this.handleResetState());
    plugOnBtn.addEventListener("click", () => this.handlePlugControl(true));
    plugOffBtn.addEventListener("click", () => this.handlePlugControl(false));

    themeBtn.addEventListener("click", () => {
      themeOverlay.classList.add("visible");
    });

    themeOverlay.addEventListener("click", (e) => {
      if (e.target === themeOverlay) {
        themeOverlay.classList.remove("visible");
      }
    });

    themeOptions.forEach((opt) => {
      opt.addEventListener("click", async () => {
        const color = opt.getAttribute("data-color");
        await themeManager.setTheme(color);
        this.syncThemeSheet();
        setTimeout(() => themeOverlay.classList.remove("visible"), 280);
      });
    });
  }

  syncThemeSheet() {
    const current = themeManager.getTheme();
    const options = this.container.querySelectorAll(".theme-option");
    options.forEach((opt) => {
      if (opt.getAttribute("data-color") === current) {
        opt.classList.add("active");
      } else {
        opt.classList.remove("active");
      }
    });
  }

  initializeWebSocket() {
    const accessToken = this.authService.getAccessToken();

    if (!accessToken) {
      console.error("HomePage: Cannot initialize WebSocket - no access token!");
      return;
    }

    if (this.wsService) {
      this.wsService.disconnect();
    }

    this.wsService = new WebSocketService(
      accessToken,
      (status) => this.handleGarageStatusUpdate(status),
      (sensorType, data) => this.handleSensorUpdate(sensorType, data),
      (data) => this.handlePlugUpdate(data),
      this.authService,
    );

    this.wsService.setConnectionChangeCallback((connected) => {
      this.wsConnected = connected;
      this.updateConnectionStatus();
    });

    this.wsService.setOnConnectedCallback(() => {
      this.fetchAllDeviceStates();
    });

    this.wsService.connect();
  }

  refreshWebSocketConnection() {
    console.log("HomePage: Refreshing WebSocket connection");
    if (this.wsService) {
      this.wsService.disconnect();
    }
    this.initializeWebSocket();
  }

  async fetchAllDeviceStates() {
    try {
      const data = await this.apiService.getAllDevicesWithStatus(this.authService.getAccessToken());

      if (data.garageStatus) {
        this.handleGarageStatusUpdate(data.garageStatus);
      }
      if (data.tiltSensor && Object.keys(data.tiltSensor).length > 0) {
        this.handleSensorUpdate("tilt", data.tiltSensor);
      }
      if (data.vibrationSensor && Object.keys(data.vibrationSensor).length > 0) {
        this.handleSensorUpdate("vibration", data.vibrationSensor);
      }
      if (data.plug && Object.keys(data.plug).length > 0) {
        this.handlePlugUpdate(data.plug);
      }
    } catch (error) {
      console.warn("HomePage: Failed to fetch initial device states", error);
    }
  }

  updateConnectionStatus() {
    const wsDot = this.container.querySelector("#ws-conn-dot");

    if (wsDot) {
      wsDot.className = this.wsConnected ? "conn-dot online" : "conn-dot offline";
    }

    const wsIndicator = this.container.querySelector("#ws-status-indicator");
    if (wsIndicator) {
      if (this.wsConnected) {
        wsIndicator.className = "status-badge status-online hidden";
        wsIndicator.innerHTML = '<span class="status-dot"></span><span>Connected</span>';
      } else {
        wsIndicator.className = "status-badge status-offline hidden";
        wsIndicator.innerHTML = '<span class="status-dot"></span><span>Disconnected</span>';
      }
    }
  }

  handleGarageStatusUpdate(status) {
    this.garageStatus = status;
    this.updateGarageDisplay(status);
  }

  handleSensorUpdate(sensorType, data) {
    if (sensorType === "tilt") {
      this.tiltSensorData = data;
      this.updateTiltSensorDisplay(data);
    } else if (sensorType === "vibration") {
      this.vibrationSensorData = data;
      this.updateVibrationSensorDisplay(data);
    }
  }

  handlePlugUpdate(data) {
    this.plugData = data;
    this.updatePlugDisplay(data);
  }

  updateGarageDisplay(status) {
    const positionLabel = this.container.querySelector("#door-position-label");
    const bigIcon = this.container.querySelector("#door-big-icon");
    const progressBar = this.container.querySelector("#door-progress-bar");
    const progressContainer = this.container.querySelector(".progress-container");
    const doorStateDisplay = this.container.querySelector("#door-state-display");
    const openBtn = this.container.querySelector("#open-btn");
    const closeBtn = this.container.querySelector("#close-btn");

    if (!status || !status.state) return;

    const state = status.state.toLowerCase();
    const isMoving = state.includes("opening") || state.includes("closing");

    let displayText = status.state.replace(/_/g, " ");
    let stateClass = state;

    if (state.includes("closed")) {
      stateClass = "closed";
    } else if (state.includes("open") && !state.includes("opening")) {
      stateClass = "open";
    } else if (state.includes("opening")) {
      stateClass = "opening";
    } else if (state.includes("closing")) {
      stateClass = "closing";
    }

    doorStateDisplay.className = `door-state-display door-status-wrapper state-${stateClass}`;

    const iconMap = {
      open: "mdi-garage-open-variant",
      opening: "mdi-arrow-up-circle",
      closing: "mdi-arrow-down-circle",
      closed: "mdi-garage-variant",
    };
    bigIcon.className = `mdi ${iconMap[stateClass] || "mdi-garage-variant"} door-big-icon ${stateClass}`;

    positionLabel.textContent = displayText;
    positionLabel.className = `door-state-value door-position-label ${stateClass}`;

    if (state.includes("idle_closed") || state === "closed") {
      openBtn.style.display = "flex";
      closeBtn.style.display = "none";
    } else if (state.includes("idle_open") || state === "open") {
      openBtn.style.display = "none";
      closeBtn.style.display = "flex";
    } else if (state.includes("opening") || state.includes("jammed") || state.includes("stopped")) {
      openBtn.style.display = "none";
      closeBtn.style.display = "flex";
    } else if (state.includes("closing")) {
      openBtn.style.display = "flex";
      closeBtn.style.display = "none";
    } else {
      openBtn.style.display = "flex";
      closeBtn.style.display = "flex";
    }

    if (isMoving) {
      progressContainer.classList.add("active");
      progressBar.style.width = `${status.estimatedProgress || 0}%`;
    } else {
      progressContainer.classList.remove("active");
    }
  }

  updateTiltSensorDisplay(data) {
    const contactValue = this.container.querySelector("#tilt-contact-value");
    const batteryIndicator = this.container.querySelector("#tilt-battery");
    const batteryValue = this.container.querySelector("#tilt-battery-value");
    const batteryLowValue = this.container.querySelector("#tilt-battery-low-value");
    const linkqualityValue = this.container.querySelector("#tilt-linkquality-value");

    if (data.contact !== undefined) {
      const isOpen = !data.contact;
      contactValue.textContent = isOpen ? "Open" : "Closed";
      contactValue.className = isOpen ? "info-value on" : "info-value";
    }

    if (data.battery !== undefined) {
      this.updateBatteryIndicator(batteryIndicator, data.battery);
      batteryValue.textContent = `${data.battery}%`;
    }

    if (data.battery_low !== undefined) {
      batteryLowValue.textContent = data.battery_low ? "Yes" : "No";
      batteryLowValue.className = data.battery_low ? "info-value warning" : "info-value";
    }

    if (data.linkquality !== undefined) {
      linkqualityValue.textContent = data.linkquality;
    }
  }

  updateVibrationSensorDisplay(data) {
    const vibrationValue = this.container.querySelector("#vibration-value");
    const batteryIndicator = this.container.querySelector("#vibration-battery");
    const batteryValue = this.container.querySelector("#vibration-battery-value");
    const temperatureValue = this.container.querySelector("#vibration-temperature-value");
    const linkqualityValue = this.container.querySelector("#vibration-linkquality-value");
    const angleValue = this.container.querySelector("#vibration-angle-value");
    const voltageValue = this.container.querySelector("#vibration-voltage-value");

    if (data.vibration !== undefined) {
      vibrationValue.textContent = data.vibration ? "Yes" : "No";
      vibrationValue.className = data.vibration ? "info-value on" : "info-value";
    }

    if (data.battery !== undefined) {
      this.updateBatteryIndicator(batteryIndicator, data.battery);
      batteryValue.textContent = `${data.battery}%`;
    }

    if (data.device_temperature !== undefined) {
      temperatureValue.textContent = `${data.device_temperature}°C`;
    }

    if (data.linkquality !== undefined) {
      linkqualityValue.textContent = data.linkquality;
    }

    if (data.angle !== undefined) {
      angleValue.textContent = `${data.angle}°`;
    }

    if (data.voltage !== undefined) {
      voltageValue.textContent = `${data.voltage}mV`;
    }
  }

  updatePlugDisplay(data) {
    const stateValue = this.container.querySelector("#plug-state-value");
    const statusIndicator = this.container.querySelector("#plug-status-indicator");
    const powerValue = this.container.querySelector("#plug-power-value");
    const voltageValue = this.container.querySelector("#plug-voltage-value");
    const currentValue = this.container.querySelector("#plug-current-value");
    const energyValue = this.container.querySelector("#plug-energy-value");
    const temperatureValue = this.container.querySelector("#plug-temperature-value");
    const plugOnBtn = this.container.querySelector("#plug-on-btn");
    const plugOffBtn = this.container.querySelector("#plug-off-btn");

    if (data.state !== undefined) {
      const isOn = data.state === "ON";
      stateValue.textContent = data.state;
      stateValue.className = isOn ? "info-value on" : "info-value off";

      statusIndicator.className = isOn ? "status-badge status-online" : "status-badge status-offline";
      statusIndicator.innerHTML = `<span class="status-dot"></span><span>${data.state}</span>`;

      plugOnBtn.style.display = isOn ? "none" : "flex";
      plugOffBtn.style.display = isOn ? "flex" : "none";
    }

    if (data.power !== undefined) powerValue.textContent = `${data.power.toFixed(2)} W`;
    if (data.voltage !== undefined) voltageValue.textContent = `${data.voltage} V`;
    if (data.current !== undefined) currentValue.textContent = `${data.current.toFixed(2)} A`;
    if (data.energy !== undefined) energyValue.textContent = `${data.energy.toFixed(2)} kWh`;
    if (data.device_temperature !== undefined) temperatureValue.textContent = `${data.device_temperature}°C`;
  }

  updateBatteryIndicator(element, batteryLevel) {
    let batteryClass, iconClass;

    if (batteryLevel >= 70) {
      batteryClass = "high";
      iconClass = "mdi-battery-charging";
    } else if (batteryLevel >= 30) {
      batteryClass = "medium";
      iconClass = "mdi-battery-50";
    } else {
      batteryClass = "low";
      iconClass = "mdi-battery-alert";
    }

    element.className = `battery-indicator ${batteryClass}`;
    element.innerHTML = `<i class="mdi ${iconClass}"></i><span class="battery-text">${batteryLevel}%</span>`;
  }

  async handleGarageTrigger() {
    if (!this.garageOnline || this.triggerInProgress) return;

    const triggerBtn = this.container.querySelector("#garage-trigger-btn");
    const openBtn = this.container.querySelector("#open-btn");
    const closeBtn = this.container.querySelector("#close-btn");
    const messageContainer = this.container.querySelector("#message-container");

    this.triggerInProgress = true;
    triggerBtn.disabled = true;
    openBtn.disabled = true;
    closeBtn.disabled = true;
    messageContainer.innerHTML = "";

    try {
      await this.apiService.triggerGarage(this.authService.getAccessToken());
      this.showSuccessMessage(messageContainer, "Garage door triggered successfully!");
    } catch (error) {
      if (error.message === "TOKEN_EXPIRED") {
        await this.handleTokenExpiredDuringAction(messageContainer, () => this.apiService.triggerGarage(this.authService.getAccessToken()));
      } else {
        this.showErrorMessage(messageContainer, error.message);
      }
    } finally {
      this.triggerInProgress = false;
      if (this.garageOnline) {
        triggerBtn.disabled = false;
        openBtn.disabled = false;
        closeBtn.disabled = false;
      }
    }
  }

  async handleResetState() {
    if (!this.garageOnline) return;

    const resetBtn = this.container.querySelector("#reset-btn");
    const messageContainer = this.container.querySelector("#message-container");

    resetBtn.disabled = true;
    messageContainer.innerHTML = "";

    try {
      await this.apiService.resetGarageState(this.authService.getAccessToken());
      this.showSuccessMessage(messageContainer, "State reset successfully!");
      setTimeout(() => this.checkGarageStatus(), 1000);
    } catch (error) {
      if (error.message === "TOKEN_EXPIRED") {
        await this.handleTokenExpiredDuringAction(messageContainer, () => this.apiService.resetGarageState(this.authService.getAccessToken()));
      } else {
        this.showErrorMessage(messageContainer, error.message);
      }
    } finally {
      if (this.garageOnline) resetBtn.disabled = false;
    }
  }

  async handlePlugControl(turnOn) {
    if (!this.garageOnline) return;

    const plugOnBtn = this.container.querySelector("#plug-on-btn");
    const plugOffBtn = this.container.querySelector("#plug-off-btn");
    const messageContainer = this.container.querySelector("#message-container");

    plugOnBtn.disabled = true;
    plugOffBtn.disabled = true;
    messageContainer.innerHTML = "";

    try {
      if (turnOn) {
        await this.apiService.turnPlugOn(this.authService.getAccessToken());
        this.showSuccessMessage(messageContainer, "Plug turned ON!");
      } else {
        await this.apiService.turnPlugOff(this.authService.getAccessToken());
        this.showSuccessMessage(messageContainer, "Plug turned OFF!");
      }
    } catch (error) {
      if (error.message === "TOKEN_EXPIRED") {
        await this.handleTokenExpiredDuringAction(messageContainer, () => (turnOn ? this.apiService.turnPlugOn(this.authService.getAccessToken()) : this.apiService.turnPlugOff(this.authService.getAccessToken())));
      } else {
        this.showErrorMessage(messageContainer, error.message);
      }
    } finally {
      if (this.garageOnline) {
        plugOnBtn.disabled = false;
        plugOffBtn.disabled = false;
      }
    }
  }

  async handleTokenExpiredDuringAction(messageContainer, retryAction) {
    const reLoginSuccess = await this.authService.handleTokenExpired();

    if (reLoginSuccess) {
      this.refreshWebSocketConnection();
      try {
        await retryAction();
        this.showSuccessMessage(messageContainer, "Action completed successfully!");
      } catch (retryError) {
        this.showErrorMessage(messageContainer, retryError.message);
      }
    } else {
      this.onLogout();
    }
  }

  showSuccessMessage(container, message) {
    container.innerHTML = `
      <div class="success-message">
        <i class="mdi mdi-check-circle"></i>
        <span>${message}</span>
      </div>
    `;
    setTimeout(() => {
      container.innerHTML = "";
    }, 3000);
  }

  showErrorMessage(container, message) {
    container.innerHTML = `
      <div class="error-message">
        <i class="mdi mdi-alert-circle"></i>
        <span>${message}</span>
      </div>
    `;
  }

  setupPullToRefresh() {
    const mainContent = this.container.querySelector("#main-content");
    let startY = 0;
    let isPulling = false;
    let triggered = false;

    mainContent.addEventListener("touchstart", (e) => {
      if (mainContent.scrollTop === 0) {
        startY = e.touches[0].pageY;
        isPulling = true;
        triggered = false;
      }
    });

    mainContent.addEventListener("touchmove", (e) => {
      if (!isPulling) return;
      const currentY = e.touches[0].pageY;
      const delta = currentY - startY;

      if (delta > 80 && mainContent.scrollTop === 0 && !triggered) {
        triggered = true;
        isPulling = false;
        this.checkGarageStatus();
        this.fetchAllDeviceStates();
      }
    });

    mainContent.addEventListener("touchend", () => {
      isPulling = false;
    });
  }

  async checkGarageStatus() {
    if (this.statusCheckInProgress) return;

    this.statusCheckInProgress = true;
    const statusIndicator = this.container.querySelector("#status-indicator");
    const triggerBtn = this.container.querySelector("#garage-trigger-btn");
    const openBtn = this.container.querySelector("#open-btn");
    const closeBtn = this.container.querySelector("#close-btn");
    const resetBtn = this.container.querySelector("#reset-btn");
    const plugOnBtn = this.container.querySelector("#plug-on-btn");
    const plugOffBtn = this.container.querySelector("#plug-off-btn");
    const refreshBtn = this.container.querySelector("#refresh-btn");

    statusIndicator.className = "status-badge status-checking";
    statusIndicator.innerHTML = '<i class="mdi mdi-loading spin"></i>';

    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.querySelector("i").classList.add("spin");
    }

    try {
      const status = await this.apiService.getGarageStatus(this.authService.getAccessToken());
      this.setGarageOnline(statusIndicator, triggerBtn, openBtn, closeBtn, resetBtn, plugOnBtn, plugOffBtn);
      this.handleGarageStatusUpdate(status);
      this.checkMqttStatus();
    } catch (error) {
      if (error.message === "TOKEN_EXPIRED") {
        const reLoginSuccess = await this.authService.handleTokenExpired();
        if (!reLoginSuccess) {
          this.onLogout();
          return;
        }
        this.refreshWebSocketConnection();
        this.statusCheckInProgress = false;
        await this.checkGarageStatus();
        return;
      } else {
        this.setGarageOffline(statusIndicator, triggerBtn, openBtn, closeBtn, resetBtn, plugOnBtn, plugOffBtn);
      }
    } finally {
      this.statusCheckInProgress = false;
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.querySelector("i").classList.remove("spin");
      }
    }
  }

  async checkMqttStatus() {
    const mqttDot = this.container.querySelector("#mqtt-conn-dot");
    const mqttIndicator = this.container.querySelector("#mqtt-status-indicator");

    try {
      const mqttStatus = await this.apiService.getMqttStatus(this.authService.getAccessToken());
      if (mqttStatus.connected) {
        if (mqttDot) mqttDot.className = "conn-dot online";
        if (mqttIndicator) {
          mqttIndicator.className = "status-badge status-online hidden";
          mqttIndicator.innerHTML = '<span class="status-dot"></span><span>Connected</span>';
        }
      } else {
        if (mqttDot) mqttDot.className = "conn-dot offline";
        if (mqttIndicator) {
          mqttIndicator.className = "status-badge status-offline hidden";
          mqttIndicator.innerHTML = '<span class="status-dot"></span><span>Disconnected</span>';
        }
      }
    } catch (error) {
      if (mqttDot) mqttDot.className = "conn-dot offline";
      if (mqttIndicator) {
        mqttIndicator.className = "status-badge status-offline hidden";
        mqttIndicator.innerHTML = '<span class="status-dot"></span><span>Error</span>';
      }
    }
  }

  setGarageOnline(statusIndicator, triggerBtn, openBtn, closeBtn, resetBtn, plugOnBtn, plugOffBtn) {
    this.garageOnline = true;
    statusIndicator.className = "status-badge status-online";
    statusIndicator.innerHTML = '<span class="status-dot"></span><span>Online</span>';
    [triggerBtn, openBtn, closeBtn, resetBtn, plugOnBtn, plugOffBtn].forEach((btn) => (btn.disabled = false));
  }

  setGarageOffline(statusIndicator, triggerBtn, openBtn, closeBtn, resetBtn, plugOnBtn, plugOffBtn) {
    this.garageOnline = false;
    statusIndicator.className = "status-badge status-offline";
    statusIndicator.innerHTML = '<span class="status-dot"></span><span>Offline</span>';
    [triggerBtn, openBtn, closeBtn, resetBtn, plugOnBtn, plugOffBtn].forEach((btn) => (btn.disabled = true));
  }
}
