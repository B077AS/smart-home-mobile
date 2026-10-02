const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export class ApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  async login(username, password) {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      return data;
    } catch (error) {
      console.error("API: Login error:", error);
      throw error;
    }
  }

  async triggerGarage(accessToken) {
    try {
      const response = await fetch(`${this.baseUrl}/api/garage/trigger`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401) {
        console.error("API: 401 Unauthorized - token is invalid or expired");
        throw new Error("TOKEN_EXPIRED");
      }

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        throw new Error(data.message || data || "Failed to trigger garage");
      }

      return data;
    } catch (error) {
      console.error("API: Trigger error:", error);
      throw error;
    }
  }

  async getGarageStatus(accessToken) {
    try {
      const response = await fetch(`${this.baseUrl}/api/garage/status`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 401) {
        console.error("API: 401 Unauthorized - token is invalid or expired");
        throw new Error("TOKEN_EXPIRED");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("API: Status error data:", errorData);
        throw new Error(errorData.message || "Failed to get garage status");
      }

      return await response.json();
    } catch (error) {
      console.error("API: Status error:", error);
      throw error;
    }
  }

  async resetGarageState(accessToken) {
    try {
      const response = await fetch(`${this.baseUrl}/api/garage/reset`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401) {
        throw new Error("TOKEN_EXPIRED");
      }

      if (!response.ok) {
        throw new Error("Failed to reset garage state");
      }

      return await response.text();
    } catch (error) {
      console.error("API: Reset error:", error);
      throw error;
    }
  }

  async turnPlugOn(accessToken) {
    try {
      const response = await fetch(`${this.baseUrl}/api/garage/plug/on`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401) {
        throw new Error("TOKEN_EXPIRED");
      }

      if (!response.ok) {
        throw new Error("Failed to turn plug ON");
      }

      return await response.json();
    } catch (error) {
      console.error("API: Plug ON error:", error);
      throw error;
    }
  }

  async turnPlugOff(accessToken) {
    try {
      const response = await fetch(`${this.baseUrl}/api/garage/plug/off`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401) {
        throw new Error("TOKEN_EXPIRED");
      }

      if (!response.ok) {
        throw new Error("Failed to turn plug OFF");
      }

      return await response.json();
    } catch (error) {
      console.error("API: Plug OFF error:", error);
      throw error;
    }
  }

  async getMqttStatus(accessToken) {
    try {
      const response = await fetch(`${this.baseUrl}/api/mqtt/status`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 401) {
        throw new Error("TOKEN_EXPIRED");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to get MQTT status");
      }

      return await response.json();
    } catch (error) {
      console.error("API: MQTT status error:", error);
      throw error;
    }
  }

  async getAllDevicesWithStatus(accessToken) {
    try {
      const response = await fetch(`${this.baseUrl}/api/devices/all-with-status`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 401) {
        throw new Error("TOKEN_EXPIRED");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to get device states");
      }

      return await response.json();
    } catch (error) {
      console.error("API: Get all devices error:", error);
      throw error;
    }
  }

  async getLightStates(accessToken) {
    try {
      const response = await fetch(`${this.baseUrl}/api/devices/lights`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 401) {
        throw new Error("TOKEN_EXPIRED");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to get light states");
      }

      return await response.json();
    } catch (error) {
      console.error("API: Get light states error:", error);
      throw error;
    }
  }

  async refreshLights(accessToken) {
    try {
      const response = await fetch(`${this.baseUrl}/api/devices/lights/refresh`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401) {
        throw new Error("TOKEN_EXPIRED");
      }

      if (!response.ok) {
        throw new Error("Failed to refresh lights");
      }

      return await response.json();
    } catch (error) {
      console.error("API: Refresh lights error:", error);
      throw error;
    }
  }

  async applyPreset(accessToken, deviceName, presetId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/devices/lights/${deviceName}/apply-preset/${presetId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401) {
        throw new Error("TOKEN_EXPIRED");
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to apply preset");
      }

      return data;
    } catch (error) {
      console.error("API: Apply preset error:", error);
      throw error;
    }
  }

  async setLightPower(accessToken, deviceName, on) {
    try {
      const response = await fetch(`${this.baseUrl}/api/devices/lights/${deviceName}/${on ? "on" : "off"}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401) {
        throw new Error("TOKEN_EXPIRED");
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `Failed to turn light ${on ? "ON" : "OFF"}`);
      }

      return data;
    } catch (error) {
      console.error("API: Set light power error:", error);
      throw error;
    }
  }

  async resetLightToDefault(accessToken, deviceName) {
    try {
      const response = await fetch(`${this.baseUrl}/api/devices/lights/${deviceName}/reset-to-default`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401) {
        throw new Error("TOKEN_EXPIRED");
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to reset light to default preset");
      }

      return data;
    } catch (error) {
      console.error("API: Reset light to default error:", error);
      throw error;
    }
  }

  async setLightState(accessToken, deviceName, settings) {
    try {
      const response = await fetch(`${this.baseUrl}/api/devices/lights/${deviceName}/state`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      if (response.status === 401) {
        throw new Error("TOKEN_EXPIRED");
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to update light");
      }

      return data;
    } catch (error) {
      console.error("API: Set light state error:", error);
      throw error;
    }
  }

  async listPresets(accessToken) {
    try {
      const response = await fetch(`${this.baseUrl}/api/light-presets`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 401) {
        throw new Error("TOKEN_EXPIRED");
      }

      if (!response.ok) {
        throw new Error("Failed to load presets");
      }

      return await response.json();
    } catch (error) {
      console.error("API: List presets error:", error);
      throw error;
    }
  }

  async createPreset(accessToken, deviceName, name) {
    try {
      const response = await fetch(`${this.baseUrl}/api/light-presets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceName, name }),
      });

      if (response.status === 401) {
        throw new Error("TOKEN_EXPIRED");
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to save preset");
      }

      return data;
    } catch (error) {
      console.error("API: Create preset error:", error);
      throw error;
    }
  }

  async setDefaultPreset(accessToken, id) {
    try {
      const response = await fetch(`${this.baseUrl}/api/light-presets/${id}/default`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401) {
        throw new Error("TOKEN_EXPIRED");
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to set default preset");
      }

      return data;
    } catch (error) {
      console.error("API: Set default preset error:", error);
      throw error;
    }
  }

  async deletePreset(accessToken, id) {
    try {
      const response = await fetch(`${this.baseUrl}/api/light-presets/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 401) {
        throw new Error("TOKEN_EXPIRED");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete preset");
      }

      return true;
    } catch (error) {
      console.error("API: Delete preset error:", error);
      throw error;
    }
  }
}
