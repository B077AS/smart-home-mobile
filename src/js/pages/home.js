import { createElement, Home, LogOut, Loader2, CheckCircle2, AlertCircle, RefreshCw, DoorClosed, DoorOpen, ArrowUp, ArrowDown, Battery, BatteryCharging, BatteryWarning, Activity, TriangleRight, Plug, Power, PowerOff, Wifi, RotateCcw, Zap, Gauge, Thermometer, Leaf, Signal, Move3d, Maximize2, ArrowUpDown, Router } from "lucide";
import homeTemplate from "../../pages/home.html?raw";
import { WebSocketService } from "../websocket.js";

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

  createIcon(iconComponent, size = 24) {
    return createElement(iconComponent, {
      width: size,
      height: size,
      "stroke-width": 2,
    });
  }

  render() {
    this.container.innerHTML = homeTemplate;

    const headerTitle = this.container.querySelector("#header-title");
    headerTitle.insertBefore(this.createIcon(Home, 32), headerTitle.firstChild);

    const logoutBtn = this.container.querySelector("#logout-btn");
    logoutBtn.insertBefore(this.createIcon(LogOut, 18), logoutBtn.firstChild);

    const garageTitle = this.container.querySelector("#garage-title");
    garageTitle.insertBefore(this.createIcon(DoorClosed, 24), garageTitle.firstChild);

    const plugTitle = this.container.querySelector("#plug-title");
    plugTitle.insertBefore(this.createIcon(Plug, 24), plugTitle.firstChild);

    const connectionTitle = this.container.querySelector("#connection-title");
    connectionTitle.insertBefore(this.createIcon(Wifi, 24), connectionTitle.firstChild);

    const mqttTitle = this.container.querySelector("#mqtt-title");
    mqttTitle.insertBefore(this.createIcon(Router, 24), mqttTitle.firstChild);

    const refreshBtn = this.container.querySelector("#refresh-btn");
    refreshBtn.appendChild(this.createIcon(RefreshCw, 20));

    const tiltSensorTitle = this.container.querySelector("#tilt-sensor-title");
    tiltSensorTitle.insertBefore(this.createIcon(TriangleRight, 20), tiltSensorTitle.firstChild);

    const vibrationSensorTitle = this.container.querySelector("#vibration-sensor-title");
    vibrationSensorTitle.insertBefore(this.createIcon(Activity, 20), vibrationSensorTitle.firstChild);

    const resetBtn = this.container.querySelector("#reset-btn");
    resetBtn.insertBefore(this.createIcon(RotateCcw, 16), resetBtn.firstChild);

    const doorStatusLabel = this.container.querySelector("#door-status-label");
    doorStatusLabel.insertBefore(this.createIcon(Activity, 18), doorStatusLabel.firstChild);

    this.addIconsToInfoLabels();
    this.setupHandlers();
    this.setupPullToRefresh();
    this.checkGarageStatus();
    this.initializeWebSocket();
  }

  addIconsToInfoLabels() {
    // Plug info icons
    const plugStateLabel = this.container.querySelector("#plug-state-value").previousElementSibling;
    plugStateLabel.insertBefore(this.createIcon(Power, 18), plugStateLabel.firstChild);

    const plugPowerLabel = this.container.querySelector("#plug-power-value").previousElementSibling;
    plugPowerLabel.insertBefore(this.createIcon(Zap, 18), plugPowerLabel.firstChild);

    const plugVoltageLabel = this.container.querySelector("#plug-voltage-value").previousElementSibling;
    plugVoltageLabel.insertBefore(this.createIcon(Gauge, 18), plugVoltageLabel.firstChild);

    const plugCurrentLabel = this.container.querySelector("#plug-current-value").previousElementSibling;
    plugCurrentLabel.insertBefore(this.createIcon(Activity, 18), plugCurrentLabel.firstChild);

    const plugEnergyLabel = this.container.querySelector("#plug-energy-value").previousElementSibling;
    plugEnergyLabel.insertBefore(this.createIcon(Leaf, 18), plugEnergyLabel.firstChild);

    const plugTempLabel = this.container.querySelector("#plug-temperature-value").previousElementSibling;
    plugTempLabel.insertBefore(this.createIcon(Thermometer, 18), plugTempLabel.firstChild);

    // Tilt sensor icons
    const tiltContactLabel = this.container.querySelector("#tilt-contact-value").previousElementSibling;
    tiltContactLabel.insertBefore(this.createIcon(ArrowUpDown, 18), tiltContactLabel.firstChild);

    const tiltBatteryLabel = this.container.querySelector("#tilt-battery-value").previousElementSibling;
    tiltBatteryLabel.insertBefore(this.createIcon(Battery, 18), tiltBatteryLabel.firstChild);

    const tiltBatteryLowLabel = this.container.querySelector("#tilt-battery-low-value").previousElementSibling;
    tiltBatteryLowLabel.insertBefore(this.createIcon(BatteryWarning, 18), tiltBatteryLowLabel.firstChild);

    const tiltLinkLabel = this.container.querySelector("#tilt-linkquality-value").previousElementSibling;
    tiltLinkLabel.insertBefore(this.createIcon(Signal, 18), tiltLinkLabel.firstChild);

    // Vibration sensor icons
    const vibrationLabel = this.container.querySelector("#vibration-value").previousElementSibling;
    vibrationLabel.insertBefore(this.createIcon(Activity, 18), vibrationLabel.firstChild);

    const vibBatteryLabel = this.container.querySelector("#vibration-battery-value").previousElementSibling;
    vibBatteryLabel.insertBefore(this.createIcon(Battery, 18), vibBatteryLabel.firstChild);

    const vibTempLabel = this.container.querySelector("#vibration-temperature-value").previousElementSibling;
    vibTempLabel.insertBefore(this.createIcon(Thermometer, 18), vibTempLabel.firstChild);

    const vibLinkLabel = this.container.querySelector("#vibration-linkquality-value").previousElementSibling;
    vibLinkLabel.insertBefore(this.createIcon(Signal, 18), vibLinkLabel.firstChild);

    const vibAngleLabel = this.container.querySelector("#vibration-angle-value").previousElementSibling;
    vibAngleLabel.insertBefore(this.createIcon(Move3d, 18), vibAngleLabel.firstChild);

    const vibVoltageLabel = this.container.querySelector("#vibration-voltage-value").previousElementSibling;
    vibVoltageLabel.insertBefore(this.createIcon(Gauge, 18), vibVoltageLabel.firstChild);
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

    this.wsService.connect();
  }

  refreshWebSocketConnection() {
    console.log("HomePage: Refreshing WebSocket connection");

    if (this.wsService) {
      this.wsService.disconnect();
    }

    this.initializeWebSocket();
  }

  updateConnectionStatus() {
    const wsIndicator = this.container.querySelector("#ws-status-indicator");

    if (this.wsConnected) {
      wsIndicator.className = "status-badge status-online";
      wsIndicator.innerHTML = '<span class="status-dot"></span><span>Connected</span>';
    } else {
      wsIndicator.className = "status-badge status-offline";
      wsIndicator.innerHTML = '<span class="status-dot"></span><span>Disconnected</span>';
    }
  }

  handleGarageStatusUpdate(status) {
    //console.log("Garage status update:", status);
    this.garageStatus = status;
    this.updateGarageDisplay(status);
  }

  handleSensorUpdate(sensorType, data) {
    //console.log(`${sensorType} sensor update:`, data);

    if (sensorType === "tilt") {
      this.tiltSensorData = data;
      this.updateTiltSensorDisplay(data);
    } else if (sensorType === "vibration") {
      this.vibrationSensorData = data;
      this.updateVibrationSensorDisplay(data);
    }
  }

  handlePlugUpdate(data) {
    //console.log("Plug update:", data);
    this.plugData = data;
    this.updatePlugDisplay(data);
  }

  updateGarageDisplay(status) {
    const positionLabel = this.container.querySelector("#door-position-label");
    const progressBar = this.container.querySelector("#door-progress-bar");
    const progressContainer = this.container.querySelector(".progress-container");
    const doorStatusWrapper = this.container.querySelector(".door-status-wrapper");
    const openBtn = this.container.querySelector("#open-btn");
    const closeBtn = this.container.querySelector("#close-btn");

    if (!status || !status.state) return;

    // Parse the state (e.g., "IDLE_CLOSED", "OPENING", "CLOSING", "IDLE_OPEN")
    const state = status.state.toLowerCase();
    const isMoving = state.includes("opening") || state.includes("closing");

    // Determine display text and class
    let displayText = status.state.replace(/_/g, " ");
    let stateClass = state;

    // Simplify state classes
    if (state.includes("closed")) {
      stateClass = "closed";
    } else if (state.includes("open") && !state.includes("opening")) {
      stateClass = "open";
    } else if (state.includes("opening")) {
      stateClass = "opening";
    } else if (state.includes("closing")) {
      stateClass = "closing";
    }

    doorStatusWrapper.className = `door-status-wrapper state-${stateClass}`;
    positionLabel.textContent = displayText;
    positionLabel.className = `door-position-label ${stateClass}`;

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

      const progress = status.estimatedProgress || 0;
      progressBar.style.width = `${progress}%`;
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
      // Contact: false = OPEN (ON), true = CLOSED (OFF)
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

      if (isOn) {
        plugOnBtn.style.display = "none";
        plugOffBtn.style.display = "flex";
      } else {
        plugOnBtn.style.display = "flex";
        plugOffBtn.style.display = "none";
      }
    }

    if (data.power !== undefined) {
      powerValue.textContent = `${data.power.toFixed(2)} W`;
    }

    if (data.voltage !== undefined) {
      voltageValue.textContent = `${data.voltage} V`;
    }

    if (data.current !== undefined) {
      currentValue.textContent = `${data.current.toFixed(2)} A`;
    }

    if (data.energy !== undefined) {
      energyValue.textContent = `${data.energy.toFixed(2)} kWh`;
    }

    if (data.device_temperature !== undefined) {
      temperatureValue.textContent = `${data.device_temperature}°C`;
    }
  }

  updateBatteryIndicator(element, batteryLevel) {
    element.innerHTML = "";

    let batteryClass = "";
    let batteryIcon = Battery;

    if (batteryLevel >= 70) {
      batteryClass = "high";
      batteryIcon = BatteryCharging;
    } else if (batteryLevel >= 30) {
      batteryClass = "medium";
      batteryIcon = Battery;
    } else {
      batteryClass = "low";
      batteryIcon = BatteryWarning;
    }

    element.className = `battery-indicator ${batteryClass}`;
    element.appendChild(this.createIcon(batteryIcon, 16));

    const batteryText = document.createElement("span");
    batteryText.className = "battery-text";
    batteryText.textContent = `${batteryLevel}%`;
    element.appendChild(batteryText);
  }

  async handleGarageTrigger() {
    if (!this.garageOnline || this.triggerInProgress) {
      return;
    }

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
      if (this.garageOnline) {
        resetBtn.disabled = false;
      }
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
    const successMsg = document.createElement("div");
    successMsg.className = "success-message";
    successMsg.appendChild(this.createIcon(CheckCircle2, 20));
    const span = document.createElement("span");
    span.textContent = message;
    successMsg.appendChild(span);
    container.appendChild(successMsg);

    setTimeout(() => {
      container.innerHTML = "";
    }, 3000);
  }

  showErrorMessage(container, message) {
    const errorMsg = document.createElement("div");
    errorMsg.className = "error-message";
    errorMsg.appendChild(this.createIcon(AlertCircle, 20));
    const span = document.createElement("span");
    span.textContent = message;
    errorMsg.appendChild(span);
    container.appendChild(errorMsg);
  }

  setupPullToRefresh() {
    const mainContent = this.container.querySelector("#main-content");
    let startY = 0;
    let isPulling = false;

    mainContent.addEventListener("touchstart", (e) => {
      if (mainContent.scrollTop === 0) {
        startY = e.touches[0].pageY;
        isPulling = true;
      }
    });

    mainContent.addEventListener("touchmove", (e) => {
      if (!isPulling) return;

      const currentY = e.touches[0].pageY;
      const pullDistance = currentY - startY;

      if (pullDistance > 80 && mainContent.scrollTop === 0) {
        isPulling = false;
        this.checkGarageStatus();
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
    statusIndicator.innerHTML = "";
    const spinner = this.createIcon(Loader2, 16);
    spinner.classList.add("spin");
    statusIndicator.appendChild(spinner);

    if (refreshBtn) {
      refreshBtn.disabled = true;
      const refreshIcon = refreshBtn.querySelector("svg");
      if (refreshIcon) {
        refreshIcon.classList.add("spin");
      }
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
        const refreshIcon = refreshBtn.querySelector("svg");
        if (refreshIcon) {
          refreshIcon.classList.remove("spin");
        }
      }
    }
  }

  async checkMqttStatus() {
    const mqttIndicator = this.container.querySelector("#mqtt-status-indicator");

    if (!mqttIndicator) return;

    try {
      const mqttStatus = await this.apiService.getMqttStatus(this.authService.getAccessToken());

      if (mqttStatus.connected) {
        mqttIndicator.className = "status-badge status-online";
        mqttIndicator.innerHTML = '<span class="status-dot"></span><span>Connected</span>';
      } else {
        mqttIndicator.className = "status-badge status-offline";
        mqttIndicator.innerHTML = '<span class="status-dot"></span><span>Disconnected</span>';
      }
    } catch (error) {
      mqttIndicator.className = "status-badge status-offline";
      mqttIndicator.innerHTML = '<span class="status-dot"></span><span>Error</span>';
    }
  }

  setGarageOnline(statusIndicator, triggerBtn, openBtn, closeBtn, resetBtn, plugOnBtn, plugOffBtn) {
    this.garageOnline = true;
    statusIndicator.className = "status-badge status-online";
    statusIndicator.innerHTML = '<span class="status-dot"></span><span>Online</span>';

    triggerBtn.disabled = false;
    openBtn.disabled = false;
    closeBtn.disabled = false;
    resetBtn.disabled = false;
    plugOnBtn.disabled = false;
    plugOffBtn.disabled = false;
  }

  setGarageOffline(statusIndicator, triggerBtn, openBtn, closeBtn, resetBtn, plugOnBtn, plugOffBtn) {
    this.garageOnline = false;
    statusIndicator.className = "status-badge status-offline";
    statusIndicator.innerHTML = '<span class="status-dot"></span><span>Offline</span>';

    triggerBtn.disabled = true;
    openBtn.disabled = true;
    closeBtn.disabled = true;
    resetBtn.disabled = true;
    plugOnBtn.disabled = true;
    plugOffBtn.disabled = true;
  }
}
