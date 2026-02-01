export class WebSocketService {
  constructor(accessToken, onStatusUpdate, onSensorUpdate, onPlugUpdate, authService) {
    this.ws = null;
    this.accessToken = accessToken;
    this.onStatusUpdate = onStatusUpdate;
    this.onSensorUpdate = onSensorUpdate;
    this.onPlugUpdate = onPlugUpdate;
    this.authService = authService;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.isIntentionallyClosed = false;
    this.onConnectionChange = null;
    this.tokenRefreshAttempted = false;
  }

  connect() {
    this.isIntentionallyClosed = false;
    this.tokenRefreshAttempted = false;

    const wsUrl = import.meta.env.VITE_WS_URL;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;

      const connectFrame = `CONNECT\nAuthorization:Bearer ${this.accessToken}\naccept-version:1.2,1.1,1.0\nheart-beat:10000,10000\n\n\0`;

      this.ws.send(connectFrame);
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = (error) => {
      console.error("WS: Error", error);
    };

    this.ws.onclose = (event) => {
      if (this.onConnectionChange) {
        this.onConnectionChange(false);
      }

      if (!this.isIntentionallyClosed) {
        this.handleReconnect();
      }
    };
  }

  async handleReconnect() {
    if (!this.tokenRefreshAttempted && this.authService) {
      this.tokenRefreshAttempted = true;

      try {
        await this.authService.reLoginWithStoredCredentials();

        this.accessToken = this.authService.getAccessToken();
        this.reconnectAttempts = 0;

        setTimeout(() => this.connect(), 1000);
        return;
      } catch (error) {
        console.error("WS: Token refresh failed:", error);
      }
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), this.reconnectDelay);
    } else {
      console.error("WS: Max reconnection attempts reached");
    }
  }

  handleMessage(data) {
    if (data.startsWith("CONNECTED")) {
      if (this.onConnectionChange) {
        this.onConnectionChange(true);
      }

      this.subscribeToTopics();
      return;
    }

    if (data.startsWith("ERROR")) {
      const lines = data.split("\n");
      for (const line of lines) {
        if (line.startsWith("message:")) {
          if (line.includes("Authentication") || line.includes("JWT") || line.includes("token")) {
            console.log("WS: Authentication error detected, will attempt token refresh on reconnect");
            this.tokenRefreshAttempted = false;
            this.ws.close();
          }
        }
      }
      return;
    }

    if (data.startsWith("MESSAGE")) {
      const lines = data.split("\n");
      let destination = "";
      let body = "";
      let isBody = false;

      for (const line of lines) {
        if (isBody) {
          body += line;
        } else if (line.startsWith("destination:")) {
          destination = line.substring(12);
        } else if (line === "") {
          isBody = true;
        }
      }

      body = body.replace(/\0$/, "");

      if (body) {
        try {
          const payload = JSON.parse(body);
          this.routeMessage(destination, payload);
        } catch (e) {
          console.error("WS: Failed to parse message body", e);
        }
      }
    }
  }

  subscribeToTopics() {
    this.subscribe("/topic/garage/status");
    this.subscribe("/topic/zigbee/VibrationSensor");
    this.subscribe("/topic/zigbee/TiltSensor");
    this.subscribe("/topic/zigbee/GarageDoorPlug");
  }

  subscribe(destination) {
    const subscribeFrame = `SUBSCRIBE\nid:sub-${Date.now()}-${Math.random()}\ndestination:${destination}\n\n\0`;

    this.ws.send(subscribeFrame);
  }

  disconnect() {
    this.isIntentionallyClosed = true;
    if (this.ws) {
      const disconnectFrame = `DISCONNECT\n\n\0`;
      this.ws.send(disconnectFrame);
      this.ws.close();
      this.ws = null;
    }
  }

  routeMessage(destination, payload) {
    if (destination === "/topic/garage/status") {
      if (this.onStatusUpdate) {
        this.onStatusUpdate(payload);
      }
    } else if (destination === "/topic/zigbee/VibrationSensor") {
      if (this.onSensorUpdate) {
        this.onSensorUpdate("vibration", payload);
      }
    } else if (destination === "/topic/zigbee/TiltSensor") {
      if (this.onSensorUpdate) {
        this.onSensorUpdate("tilt", payload);
      }
    } else if (destination === "/topic/zigbee/GarageDoorPlug") {
      if (this.onPlugUpdate) {
        this.onPlugUpdate(payload);
      }
    }
  }

  updateToken(newToken) {
    this.accessToken = newToken;
    if (this.isConnected()) {
      this.disconnect();
      this.connect();
    }
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  setConnectionChangeCallback(callback) {
    this.onConnectionChange = callback;
  }
}
