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
}
