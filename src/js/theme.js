const THEMES = ["blue", "green", "red", "purple"];
const STORAGE_KEY = "app_accent_theme";
const DEFAULT_THEME = "blue";

export class ThemeManager {
  constructor() {
    this.currentTheme = DEFAULT_THEME;
  }

  async load() {
    try {
      const saved = await this._read();
      if (saved && THEMES.includes(saved)) {
        this.currentTheme = saved;
      }
    } catch {
      this.currentTheme = DEFAULT_THEME;
    }
    this._apply(this.currentTheme);
    return this.currentTheme;
  }

  async setTheme(theme) {
    if (!THEMES.includes(theme)) return;
    this.currentTheme = theme;
    this._apply(theme);
    await this._save(theme);
  }

  getTheme() {
    return this.currentTheme;
  }

  _apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  async _read() {
    if (this._hasCapacitor()) {
      const { Preferences } = window.Capacitor.Plugins;
      const result = await Preferences.get({ key: STORAGE_KEY });
      return result.value;
    }
    return localStorage.getItem(STORAGE_KEY);
  }

  async _save(value) {
    if (this._hasCapacitor()) {
      const { Preferences } = window.Capacitor.Plugins;
      await Preferences.set({ key: STORAGE_KEY, value });
      return;
    }
    localStorage.setItem(STORAGE_KEY, value);
  }

  _hasCapacitor() {
    return typeof window !== "undefined" && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences;
  }
}

export const themeManager = new ThemeManager();
