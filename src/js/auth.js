import { ApiService } from "./api.js";
import { StorageService } from "./storage.js";

export class AuthService {
  constructor() {
    this.api = new ApiService();
    this.storage = new StorageService();
    this.currentUser = null;
    this.accessToken = null;
  }

  async login(username, password, rememberCredentials = true) {
    try {
      const response = await this.api.login(username, password);

      this.accessToken = response.accessToken;
      this.currentUser = response.username;

      await this.storage.saveAccessToken(response.accessToken);

      if (rememberCredentials) {
        await this.storage.saveCredentials(username, password);
      }

      return response;
    } catch (error) {
      throw error;
    }
  }

  async reLoginWithStoredCredentials() {
    const credentials = await this.storage.getCredentials();

    if (!credentials) {
      throw new Error("No stored credentials");
    }

    return await this.login(credentials.username, credentials.password, true);
  }

  async handleTokenExpired() {
    try {
      await this.reLoginWithStoredCredentials();
      return true;
    } catch (error) {
      await this.logout();
      return false;
    }
  }

  async checkAuth() {
    const token = await this.storage.getAccessToken();
    if (token) {
      this.accessToken = token;
      return true;
    }
    return false;
  }

  async logout() {
    this.accessToken = null;
    this.currentUser = null;
    await this.storage.clearAll();
  }

  isAuthenticated() {
    return !!this.accessToken;
  }

  getAccessToken() {
    return this.accessToken;
  }

  getCurrentUser() {
    return this.currentUser;
  }
}
