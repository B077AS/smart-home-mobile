import { Preferences } from '@capacitor/preferences';

export class StorageService {
  static CREDENTIALS_KEY = 'smart_home_credentials';
  static ACCESS_TOKEN_KEY = 'smart_home_access_token';

  async saveCredentials(username, password) {
    await Preferences.set({
      key: StorageService.CREDENTIALS_KEY,
      value: JSON.stringify({ username, password }),
    });
  }

  async getCredentials() {
    const { value } = await Preferences.get({ key: StorageService.CREDENTIALS_KEY });
    return value ? JSON.parse(value) : null;
  }

  async saveAccessToken(token) {
    await Preferences.set({
      key: StorageService.ACCESS_TOKEN_KEY,
      value: token,
    });
  }

  async getAccessToken() {
    const { value } = await Preferences.get({ key: StorageService.ACCESS_TOKEN_KEY });
    return value;
  }

  async clearAll() {
    await Preferences.remove({ key: StorageService.CREDENTIALS_KEY });
    await Preferences.remove({ key: StorageService.ACCESS_TOKEN_KEY });
  }
}